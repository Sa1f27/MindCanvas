// Shapes returned by the FastAPI backend (backend/main.py, backend/rag_chatbot.py).

export interface GraphNode {
  id: string;
  title: string;
  url: string;
  summary: string;
  content_type: string;
  quality_score: number;
  key_topics: string[];
  cluster: string;
  cluster_id: number;
  visit_timestamp?: string | null;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  similarity: number;
  same_cluster: boolean;
}

export interface GraphExport {
  nodes: GraphNode[];
  links: GraphLink[];
  metadata?: { total_nodes: number; total_links: number; exported_at: string };
}

export interface ChatSource {
  id: string;
  title: string;
  url: string;
  content_type: string;
  quality_score: number;
  similarity: number;
  summary: string;
}

export interface ChatReply {
  response: string;
  sources: ChatSource[];
  confidence: number;
  processing_time: number;
  rag_used: boolean;
  conversation_id: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  failed?: boolean;
}

export interface SearchHit {
  id: string | number;
  title: string;
  url?: string;
  summary?: string;
  content_type?: string;
  similarity?: number;
}

export interface Stats {
  total_content: number;
  by_content_type: Record<string, number>;
  average_quality: number;
}

export interface TrendingTopic {
  topic: string;
  count: number;
}

/** A cluster as the UI uses it: name, colour and member count. */
export interface Cluster {
  name: string;
  color: string;
  size: number;
}
