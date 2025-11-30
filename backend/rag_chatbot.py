"""
RAG-based Chatbot Backend for MindCanvas
Implements intelligent Q&A using knowledge graph content with LangChain-style components,
but with minimal, stable dependencies.
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass

from fastapi import HTTPException
from pydantic import BaseModel, Field

from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

# -----------------------------
# Pydantic Models for API Data Structures
# -----------------------------


class ChatMessage(BaseModel):
    """Represents a single message in a conversation."""
    role: str  # 'user', 'assistant', or 'system'
    content: str
    timestamp: Optional[datetime] = None


class ChatRequest(BaseModel):
    """Defines the structure for an incoming chat request from the client."""
    message: str
    conversation_history: List[ChatMessage] = Field(default_factory=list)
    use_rag: bool = True
    max_context_items: int = 5
    similarity_threshold: float = 0.3
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    """Defines the structure for a chat response sent back to the client."""
    response: str
    sources: List[Dict[str, Any]] = Field(default_factory=list)
    confidence: float = 0.0
    processing_time: float = 0.0
    tokens_used: int = 0
    conversation_id: str = ""


class SourceCitation(BaseModel):
    """Represents a cited source used to generate a response."""
    title: str
    url: str
    content_type: str = Field(default="")
    quality_score: float = Field(default=0.0)
    similarity: float = Field(default=0.0)
    summary: str = Field(default="")


@dataclass
class KnowledgeContext:
    """Internal representation of a piece of knowledge retrieved from the database."""
    content: str
    title: str
    url: str
    content_type: str
    quality_score: float
    similarity: float
    summary: str


# -----------------------------
# Lightweight Conversation Memory (to avoid heavy LangChain dependencies)
# -----------------------------


class _SimpleChatHistory:
    """
    A minimal, dependency-free replacement for LangChain's ChatMessageHistory.
    This class holds a list of messages in a format compatible with the LLM.
    """

    def __init__(self) -> None:
        self.messages: List[Any] = []

    def add_user_message(self, content: str) -> None:
        self.messages.append(HumanMessage(content=content))

    def add_ai_message(self, content: str) -> None:
        self.messages.append(AIMessage(content=content))

    def clear(self) -> None:
        self.messages.clear()


class _SimpleConversationMemory:
    """
    A lightweight, dependency-free replacement for LangChain's ConversationBufferMemory.
    It manages the chat history for a single conversation session.
    """

    def __init__(self) -> None:
        self.chat_memory = _SimpleChatHistory()

    def clear(self) -> None:
        self.chat_memory.clear()


# -----------------------------
# Core RAG Chatbot
# -----------------------------


class RAGChatbot:
    """
    The core class for the Retrieval-Augmented Generation (RAG) chatbot.

    This class orchestrates the entire chat process, including:
    - Managing conversation history.
    - Retrieving relevant context from the vector database (the 'R' in RAG).
    - Generating responses using a Large Language Model (the 'G' in RAG).
    - Handling both RAG-enabled and standard conversational queries.
    """
    def __init__(self, db, openai_key: Optional[str] = None, groq_key: Optional[str] = None):
        self.db = db
        self.client = db.client
        self.openai_api_key = openai_key

        # Initialize the Large Language Model (LLM) client.
        # We use ChatOpenAI from langchain_openai. The model can be changed (e.g., to "gpt-4o-mini")
        # to balance cost and performance.
        self.llm = ChatOpenAI(
            model="gpt-4.1", # A powerful model for high-quality responses.
            temperature=0.3,
            api_key=openai_key,  # or rely on env OPENAI_API_KEY
        )

        # System prompts
        self.system_prompt = """You are MindCanvas AI, an intelligent knowledge assistant that helps users explore and understand their personal knowledge graph.

Your capabilities:
- Answer questions using the user's browsing history and saved content
- Provide insights about learning patterns and knowledge gaps
- Suggest related content and learning paths
- Summarize complex topics from multiple sources
- Help with research and knowledge discovery

Guidelines:
- Always cite sources when providing information using format [Source: Title]
- Be conversational but precise
- If information is not in the knowledge base, clearly state this
- Suggest related topics when appropriate
- Help users discover connections between different concepts
- Provide actionable insights and recommendations

Context: You have access to the user's processed web content including summaries, topics, and quality scores."""

        # This prompt is used specifically when RAG context is available.
        self.rag_system_prompt = """You are answering based on the user's personal knowledge base. Use the provided context to give accurate, helpful responses.

IMPORTANT RULES:
1. Only use information from the provided context
2. Always cite sources with [Source: Title]
3. If the context doesn't contain enough information, say so clearly
4. Connect related concepts when possible
5. Provide practical insights and actionable advice
6. Be conversational but accurate

The context includes content the user has previously browsed, with summaries and quality ratings."""

        # A dictionary to store conversation histories, keyed by a unique conversation ID.
        self.conversation_memories: Dict[str, _SimpleConversationMemory] = {}

    # -------------------------
    # Public API
    # -------------------------

    async def process_chat_request(self, request: ChatRequest) -> ChatResponse:
        """
        Main chat processing pipeline:
        1. Manages conversation state using a conversation ID.
        2. Retrieves relevant context from the database if RAG is enabled.
        3. Constructs a prompt with the user's query, history, and context.
        4. Generates a response using the LLM.
        """
        query_preview = request.message[:80] + "..." if len(request.message) > 80 else request.message
        start_time = datetime.now()

        try:
            # Conversation ID
            conversation_id = request.conversation_id or f"chat_{int(datetime.now().timestamp())}"

            # Initialize memory for a new conversation if it doesn't exist.
            if conversation_id not in self.conversation_memories:
                self.conversation_memories[conversation_id] = _SimpleConversationMemory()

            memory = self.conversation_memories[conversation_id]

            # Sync the incoming conversation history from the request into our internal memory.
            if request.conversation_history:
                memory.clear()
                for msg in request.conversation_history:
                    if msg.role == "user":
                        memory.chat_memory.add_user_message(msg.content)
                    elif msg.role == "assistant":
                        memory.chat_memory.add_ai_message(msg.content)
                    # System messages are encoded as system prompts already

            # Step 1: RAG Retrieval. Fetch relevant documents if RAG is enabled.
            context_items: List[KnowledgeContext] = []
            sources: List[Dict[str, Any]] = []

            if request.use_rag:
                # Retrieve documents from the vector database that are relevant to the user's message.
                logger.info(f"RAG: enabled for query: \"{query_preview}\"")
                docs = await self._retrieve_relevant_context(
                    request.message,
                    request.max_context_items,
                    request.similarity_threshold,
                )
                logger.info(f"RAG: retrieved {len(docs)} context items for \"{query_preview}\"")

                if docs:
                    context_items = docs
                    sources = [self._format_source(item) for item in context_items]
            else:
                logger.info(f"RAG: disabled for query: \"{query_preview}\"")

            # Step 2: Generate a response from the LLM, providing the retrieved context.
            response_text, tokens_used, confidence = await self._generate_response(
                request.message,
                context_items,
                memory,
            )

            processing_time = (datetime.now() - start_time).total_seconds()

            return ChatResponse(
                response=response_text,
                sources=sources,
                confidence=confidence,
                processing_time=processing_time,
                tokens_used=tokens_used,
                conversation_id=conversation_id,
            )

        except Exception as e:
            logger.error(f"Chat processing failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")

    # -------------------------
    # RAG Retrieval
    # -------------------------

    async def _retrieve_relevant_context(
        self,
        query: str,
        max_items: int,
        threshold: float,
    ) -> List[KnowledgeContext]:
        """
        Retrieve relevant content from the vector database using semantic search.

        This method queries the `SimpleVectorDB` to find content that is semantically
        similar to the user's query.
        """
        query_preview = query[:80] + "..." if len(query) > 80 else query
        logger.info(f"RAG: retrieving context for query: \"{query_preview}\"")

        try:
            results = await self.db.semantic_search(query, max_items, threshold)

            if not results:
                logger.info(f"RAG: no results for \"{query_preview}\"")
                return []

            logger.info(
                f"RAG: semantic_search returned {len(results)} candidates for \"{query_preview}\". "
                f"Fetching full content..."
            )

            context_items: List[KnowledgeContext] = []

            # For each search result, fetch the full content to provide to the LLM.
            for result in results:
                def _fetch_content():
                    return (
                        self.db.client.table("processed_content")
                        .select("content")
                        .eq("id", result["id"])
                        .execute()
                    )

                content_response = await asyncio.to_thread(_fetch_content)

                content = ""
                data = getattr(content_response, "data", None)
                if data and len(data) > 0:
                    content = data[0].get("content", "") or ""

                # Create a structured KnowledgeContext object.
                context_item = KnowledgeContext(
                    content=content,
                    title=result.get("title", "Untitled"),
                    url=result.get("url", ""),
                    content_type=result.get("content_type", ""),
                    quality_score=result.get("quality_score", 0.0),
                    similarity=result.get("similarity", 0.0),
                    summary=result.get("summary", ""),
                )
                context_items.append(context_item)

            logger.info(
                f"RAG: prepared {len(context_items)} KnowledgeContext items for \"{query_preview}\""
            )
            return context_items

        except Exception as e:
            logger.error(f"Context retrieval failed: {e}", exc_info=True)
            return []

    # -------------------------
    # Response Generation
    # -------------------------

    async def _generate_response(
        self,
        query: str,
        context_items: List[KnowledgeContext],
        memory: _SimpleConversationMemory,
    ) -> tuple[str, int, float]:
        """
        Generate response using ChatOpenAI.

        If context is provided (RAG path), it's injected into the prompt.
        If not (non-RAG path), the model answers based on its general knowledge.
        """
        query_preview = query[:80] + "..." if len(query) > 80 else query
        logger.info(
            f"RAG Generate: generating response for \"{query_preview}\" "
            f"with {len(context_items)} context items."
        )

        # No context → general model answer
        if not context_items: # This is the non-RAG path.
            logger.info(
                f"RAG Generate: no context items for \"{query_preview}\"; using non-RAG path."
            )
            messages = [
                SystemMessage(content=self.system_prompt),
                HumanMessage(
                    content=(
                        "Question: "
                        + query
                        + "\n\nNote: I will answer based on general knowledge, "
                        "as no specific MindCanvas knowledge-base context was found."
                    )
                ),
            ]
            try:
                response = await self.llm.ainvoke(messages)
                response_text = response.content

                usage = getattr(response, "usage_metadata", None) or {}
                tokens_used = (
                    usage.get("total_tokens")
                    or (
                        (usage.get("input_tokens") or 0)
                        + (usage.get("output_tokens") or 0)
                    )
                    or 0
                )

                confidence = 0.3  # lower confidence without RAG context
                return response_text, int(tokens_used), float(confidence)

            except Exception as e:
                logger.error(f"Chat completion (non-RAG) failed: {e}", exc_info=True)
                return self._generate_fallback_response(query, []), 0, 0.1

        # This is the RAG path, where context is used.
        try:
            context_str = self._build_context_string(context_items)

            if not context_str and context_items:
                logger.warning(
                    f"RAG Generate: context_items present ({len(context_items)}) "
                    f"but context_str is empty for \"{query_preview}\"."
                )
            elif context_str:
                logger.info(
                    f"RAG Generate: built context string for \"{query_preview}\". "
                    f"Preview:\n{context_str[:300]}..."
                )

            chat_history = memory.chat_memory.messages

            # Construct the final list of messages for the LLM.
            messages = [
                SystemMessage(content=self.rag_system_prompt),
                *chat_history,
                HumanMessage(
                    content=(
                        f"Context from my knowledge base:\n{context_str}\n\n"
                        f"Question: {query}"
                    )
                ),
            ]

            response = await self.llm.ainvoke(messages)
            response_text = response.content

            # Extract token usage metadata from the response.
            usage = getattr(response, "usage_metadata", None) or {}
            tokens_used = (
                usage.get("total_tokens")
                or (
                    (usage.get("input_tokens") or 0)
                    + (usage.get("output_tokens") or 0)
                )
                or 0
            )

            confidence = self._calculate_confidence(context_items, response_text)

            # Update the conversation memory with the latest user query and AI response.
            memory.chat_memory.add_user_message(query)
            memory.chat_memory.add_ai_message(response_text)

            return response_text, int(tokens_used), float(confidence)

        except Exception as e:
            logger.error(f"RAG response generation failed: {e}", exc_info=True)
            return self._generate_fallback_response(query, context_items), 0, 0.2

    # -------------------------
    # Helpers
    # -------------------------

    def _build_context_string(self, context_items: List[KnowledgeContext]) -> str:
        """
        Build a formatted string from the retrieved context items to be injected
        into the LLM prompt.
        """
        if not context_items:
            return ""

        parts: List[str] = []
        for i, item in enumerate(context_items, 1):
            snippet = item.content[:800] if item.content else ""
            context_part = f"""
Source {i}: {item.title}
Type: {item.content_type}
Quality: {item.quality_score}/10
URL: {item.url}
Summary: {item.summary}
Content: {snippet}...
Relevance: {item.similarity:.2f}
---
""".strip()
            parts.append(context_part)

        return "\n\n".join(parts)

    def _calculate_confidence(
        self,
        context_items: List[KnowledgeContext],
        response: str,
    ) -> float:
        """
        Calculate a heuristic confidence score for the generated response.

        The score is based on the average similarity and quality of the source context,
        and whether the response includes citations.
        """
        if not context_items:
            return 0.3

        avg_similarity = sum(item.similarity for item in context_items) / len(context_items)
        avg_quality = sum(item.quality_score for item in context_items) / len(context_items)

        citation_bonus = 0.1 if "[Source:" in response else 0.0
        length_factor = min(1.0, len(response) / 500.0)

        confidence = (
            avg_similarity * 0.4
            + avg_quality * 0.1
            + length_factor * 0.3
            + citation_bonus
        )
        return float(max(0.1, min(0.95, confidence)))

    def _generate_fallback_response(
        self,
        query: str,
        context_items: List[KnowledgeContext],
    ) -> str:
        """
        Generate a helpful fallback response when the main LLM call fails.

        If context was found, it points the user to the sources. If not, it provides general guidance.
        """
        if context_items:
            sources_info = "\n".join(
                [f"- {item.title} ({item.content_type})" for item in context_items[:3]]
            )
            return (
                f'I found some relevant content in your knowledge base related to "{query}":\n\n'
                f"{sources_info}\n\n"
                "However, I'm currently unable to process this information due to a temporary issue. "
                "You can view these sources directly to find the information you're looking for."
            )

        return (
            f'I don\'t have specific information about "{query}" in your current knowledge base.\n\n'
            "You might want to:\n"
            "1. Browse and save more content related to this topic\n"
            "2. Use the search function to explore existing content\n"
            "3. Check if there are related topics in your knowledge graph\n\n"
            "Is there a specific aspect of this topic you'd like me to help you explore?"
        )

    def _format_source(self, context_item: KnowledgeContext) -> Dict[str, Any]:
        """
        Format a KnowledgeContext object into a serializable dictionary
        suitable for the API response.
        """
        summary = context_item.summary or ""
        if len(summary) > 200:
            summary = summary[:200] + "..."

        return {
            "title": context_item.title,
            "url": context_item.url,
            "content_type": context_item.content_type,
            "quality_score": context_item.quality_score,
            "similarity": round(context_item.similarity, 3),
            "summary": summary,
        }

    # -------------------------
    # Extra analytics endpoints
    # -------------------------

    async def get_suggested_questions(self, limit: int = 5) -> List[str]:
        """
        Generate a list of suggested questions for the user to ask.

        These suggestions are based on high-quality content and common topics found in the user's knowledge base.
        """
        try:
            def _fetch():
                return (
                    self.client.table("processed_content")
                    .select("title, summary, content_type, key_topics, quality_score")
                    .gte("quality_score", 7)
                    .order("quality_score", desc=True)
                    .limit(20)
                    .execute()
                )

            response = await asyncio.to_thread(_fetch)

            data = getattr(response, "data", None) or []
            if not data:
                return [
                    "What topics have I been learning about recently?",
                    "Can you summarize my knowledge in a specific area?",
                    "What are some knowledge gaps I should focus on?",
                    "Show me connections between different topics I've studied",
                    "What would you recommend I learn next?",
                ]

            topics = set()
            content_types = set()

            for item in data:
                if item.get("key_topics"):
                    topics.update(item["key_topics"])
                content_types.add(item.get("content_type", "Unknown"))

            topics_list = list(topics)
            content_types_list = list(content_types)

            suggestions: List[str] = []

            if topics_list:
                suggestions.append(f"What have I learned about {topics_list[0]}?")
            else:
                suggestions.append("What topics have I been exploring?")

            if content_types_list:
                suggestions.append(
                    f"Can you explain the key concepts in my {content_types_list[0].lower()} content?"
                )
            else:
                suggestions.append("What types of content have I been consuming?")

            suggestions.extend(
                [
                    "What are the connections between different topics in my knowledge base?",
                    "What would you recommend I study next based on my interests?",
                    "Can you identify any knowledge gaps in my learning?",
                ]
            )

            return suggestions[:limit]

        except Exception as e:
            logger.error(f"Failed to generate suggested questions: {e}", exc_info=True)
            return [
                "What can you tell me about my learning patterns?",
                "Help me explore my knowledge graph",
                "What topics should I focus on next?",
                "Show me insights from my browsing history",
                "How can I better organize my knowledge?",
            ]

    async def get_conversation_insights(
        self,
        conversation_history: List[ChatMessage],
    ) -> Dict[str, Any]:
        """
        Analyzes the conversation history to provide simple insights.

        This is a basic implementation that extracts common keywords to identify topics and patterns.
        """
        try:
            user_messages = [msg.content for msg in conversation_history if msg.role == "user"]
            if not user_messages:
                return {"patterns": [], "topics": [], "suggestions": []}

            common_words: Dict[str, int] = {}
            for message in user_messages:
                for raw_word in message.lower().split():
                    word = "".join(ch for ch in raw_word if ch.isalnum())
                    if len(word) <= 3:
                        continue
                    common_words[word] = common_words.get(word, 0) + 1

            top_topics = sorted(common_words.items(), key=lambda x: x[1], reverse=True)[:5]

            patterns = [
                f"You frequently ask about {topic}"
                for topic, count in top_topics
                if count > 1
            ]
            topics = [topic for topic, _ in top_topics]

            suggestions = [
                "Try exploring related topics in your knowledge graph",
                "Consider diving deeper into your most frequently discussed topics",
                "Look for connections between different areas of interest",
            ]

            return {
                "patterns": patterns,
                "topics": topics,
                "suggestions": suggestions,
            }

        except Exception as e:
            logger.error(f"Conversation analysis failed: {e}", exc_info=True)
            return {"patterns": [], "topics": [], "suggestions": []}
