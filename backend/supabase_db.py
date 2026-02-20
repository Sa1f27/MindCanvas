"""
Enhanced Supabase Vector Database with Advanced Clustering
Implements intelligent semantic clustering and graph generation
"""

import json
import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass, asdict
from collections import defaultdict, Counter

from sentence_transformers import SentenceTransformer
from supabase import create_client, Client
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import normalize

from langchain_openai import OpenAIEmbeddings
import os
from pathlib import Path
logger = logging.getLogger(__name__)

# Load environment variables from .env file
from dotenv import load_dotenv

# Load .env from backend directory
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)
# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Clean up credentials (remove potential quotes or whitespace)
if SUPABASE_URL:
    SUPABASE_URL = SUPABASE_URL.strip().strip("'").strip('"')
    # Remove trailing comments and slashes
    if "#" in SUPABASE_URL:
        SUPABASE_URL = SUPABASE_URL.split("#")[0].strip()
    SUPABASE_URL = SUPABASE_URL.rstrip('/')

if SUPABASE_KEY:
    SUPABASE_KEY = SUPABASE_KEY.strip().strip("'").strip('"')
    if "#" in SUPABASE_KEY:
        SUPABASE_KEY = SUPABASE_KEY.split("#")[0].strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("⚠️  Supabase credentials not found in .env file. Database features will fail.")

@dataclass
class ContentItem:
    url: str
    title: str
    summary: str
    content: str
    content_type: str
    key_topics: List[str]
    quality_score: int
    processing_method: str
    visit_timestamp: datetime
    content_hash: str
    embedding: Optional[List[float]] = None

class SimpleVectorDB:
    def __init__(self, openai_api_key=None, st_embedder=None):
        self.client = create_client(SUPABASE_URL, SUPABASE_KEY)
        # st_embedder must be pre-loaded in a thread (via init_db) to avoid
        # blocking the async event loop during startup — which closes the httpx client.
        self.st_embedder = st_embedder
        self.openai_embedder = OpenAIEmbeddings(openai_api_key=openai_api_key) if openai_api_key else None
        logger.info("✅ Connected to Supabase with enhanced clustering")
        
    async def _ensure_match_function(self):
        """Ensure the vector similarity search function exists"""
        try:
            await asyncio.to_thread(
                self.client.rpc(
                    'match_processed_content',
                    {'query_embedding': [0.0] * 384, 'match_count': 1}
                ).execute
            )
            logger.info("✅ Vector search function verified")
        except Exception as e:
            logger.warning(f"Vector search function check: {e}")

    async def generate_embedding(self, text: str, use_openai: bool = True) -> List[float]:
        """Generate vector embedding for text"""
        # Default to 384 to match setup.py and SentenceTransformer
        target_dimension = 384
        text_preview = text[:80] + "..." if len(text) > 80 else text

        try:
            # Use SentenceTransformer (384 dims) to match database schema
            if self.st_embedder:
                embedding = await asyncio.to_thread(self.st_embedder.encode, text)
                return embedding.tolist()
            
            logger.warning(f"No embedder available for '{text_preview}'")
            return [0.0] * target_dimension
                
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return [0.0] * target_dimension

    async def store_content(self, item: ContentItem) -> bool:
        """Store content with vector embedding"""
        try:
            if not item.embedding:
                text = f"{item.title} {item.summary}"
                item.embedding = await self.generate_embedding(text, use_openai=bool(self.openai_embedder))
            
            data = asdict(item)
            
            if isinstance(data['visit_timestamp'], datetime):
                data['visit_timestamp'] = data['visit_timestamp'].isoformat()
            
            result = await asyncio.to_thread(
                self.client.table('processed_content').upsert(data).execute
            )
            return bool(result.data)
            
        except Exception as e:
            logger.error(f"Store failed for {item.url}: {e}")
            return False

    async def semantic_search(self, query: str, limit: int = 20, threshold: float = 0.3) -> List[Dict]:
        """Enhanced semantic search with better logging"""
        query_preview = query[:80] + "..." if len(query) > 80 else query
        logger.info(f"🔍 Semantic search: '{query_preview}'")
        
        try:
            query_embedding = await self.generate_embedding(query, use_openai=bool(self.openai_embedder))
            
            if not query_embedding or len(query_embedding) == 0:
                logger.error(f"Invalid query embedding for '{query_preview}'")
                return []

            embedding_dim = len(query_embedding)

            try:
                response = await asyncio.to_thread(
                    self.client.rpc(
                        'match_processed_content',
                        {
                            'query_embedding': query_embedding, 
                            'match_count': limit, 
                            'match_threshold': threshold
                        }
                    ).execute
                )
                
                if response.data:
                    results = [
                        {
                            'id': item.get('id'),
                            'url': item.get('url'),
                            'title': item.get('title'),
                            'summary': item.get('summary'),
                            'content_type': item.get('content_type'),
                            'key_topics': item.get('key_topics') or [],
                            'quality_score': item.get('quality_score'),
                            'similarity': round(item.get('similarity', 0), 3)
                        }
                        for item in response.data
                    ]
                    logger.info(f"✅ Found {len(results)} results via RPC")
                    return results
            except Exception as e:
                logger.warning(f"RPC search failed: {e}, falling back to manual search")
            
            # Manual fallback
            response = await asyncio.to_thread(
                self.client.table('processed_content').select(
                    'id, url, title, summary, content_type, key_topics, quality_score, embedding'
                ).filter('embedding', 'isnot', 'null').execute
            )
            
            if not response.data:
                return []
            
            results = []
            for item in response.data:
                item_embedding = item.get('embedding')
                if not item_embedding or len(item_embedding) != embedding_dim:
                    continue
                
                similarity = self._cosine_similarity(query_embedding, item_embedding)
                
                if similarity >= threshold:
                    results.append({
                        'id': item['id'],
                        'url': item['url'],
                        'title': item['title'],
                        'summary': item['summary'],
                        'content_type': item['content_type'],
                        'key_topics': item['key_topics'] or [],
                        'quality_score': item['quality_score'],
                        'similarity': round(similarity, 3)
                    })
            
            results.sort(key=lambda x: x['similarity'], reverse=True)
            logger.info(f"✅ Manual search yielded {len(results)} results")
            return results[:limit]
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}", exc_info=True)
            return []

    async def cluster_content(self) -> List[Dict]:
        """
        Advanced clustering using DBSCAN on embeddings + semantic topic analysis.
        Creates meaningful clusters based on content similarity and topics.
        """
        try:
            logger.info("🎯 Starting advanced clustering...")
            
            response = await asyncio.to_thread(
                self.client.table('processed_content').select(
                    'id, title, content_type, quality_score, key_topics, summary, embedding'
                ).execute
            )
            
            if not response.data or len(response.data) < 3:
                logger.warning("Insufficient data for clustering")
                return []
            
            items = response.data
            
            # Extract embeddings and filter valid ones
            embeddings = []
            valid_items = []
            
            target_dim = None
            for item in items:
                emb = item.get('embedding')
                if emb and len(emb) > 0:
                    if target_dim is None:
                        target_dim = len(emb)
                    if len(emb) == target_dim:
                        embeddings.append(emb)
                        valid_items.append(item)
            
            if len(embeddings) < 3:
                logger.warning("Not enough valid embeddings for clustering")
                return self._fallback_clustering(items)
            
            # Normalize embeddings
            embeddings_array = np.array(embeddings)
            embeddings_normalized = normalize(embeddings_array)
            
            # DBSCAN clustering with well-tuned parameters
            # eps controls neighbourhood size: 0.4 = moderate similarity required
            # min_samples: adaptive but kept small so smaller collections still cluster
            n = len(valid_items)
            eps = 0.4
            min_samples = max(2, min(4, n // 8))

            clustering = DBSCAN(eps=eps, min_samples=min_samples, metric='cosine', n_jobs=-1)
            labels = clustering.fit_predict(embeddings_normalized)
            
            # Organize clusters
            clusters_dict = defaultdict(list)
            for idx, label in enumerate(labels):
                cluster_id = int(label)
                clusters_dict[cluster_id].append(valid_items[idx])
            
            # Build cluster metadata
            clusters = []
            for cluster_id, cluster_items in clusters_dict.items():
                if cluster_id == -1:  # Noise cluster
                    continue
                    
                if len(cluster_items) < 2:
                    continue
                
                # Aggregate topics
                all_topics = []
                for item in cluster_items:
                    topics = item.get('key_topics') or []
                    all_topics.extend(topics)
                
                topic_counts = Counter(all_topics)
                top_topics = [topic for topic, _ in topic_counts.most_common(5)]
                
                # Calculate cluster quality
                avg_quality = sum(item.get('quality_score', 5) for item in cluster_items) / len(cluster_items)
                
                # Determine cluster name from top 1-2 dominant topics
                if len(top_topics) >= 2:
                    cluster_name = f"{top_topics[0].title()} & {top_topics[1].title()}"
                elif top_topics:
                    cluster_name = top_topics[0].title()
                else:
                    cluster_name = f"Cluster {cluster_id + 1}"
                
                # Content type distribution
                content_types = [item.get('content_type', 'Unknown') for item in cluster_items]
                type_counts = Counter(content_types)
                dominant_type = type_counts.most_common(1)[0][0] if type_counts else 'Mixed'
                
                clusters.append({
                    'id': cluster_id + 1,
                    'name': cluster_name,
                    'description': f"{len(cluster_items)} items - {dominant_type}",
                    'content_count': len(cluster_items),
                    'top_topics': top_topics,
                    'average_quality': round(avg_quality, 1),
                    'content_types': dict(type_counts),
                    'items': [item['id'] for item in cluster_items],
                    'representative_title': cluster_items[0]['title']
                })
            
            # Sort by size and quality
            clusters.sort(key=lambda x: (x['content_count'], x['average_quality']), reverse=True)
            
            logger.info(f"✅ Created {len(clusters)} semantic clusters using DBSCAN")
            return clusters
            
        except Exception as e:
            logger.error(f"Advanced clustering failed: {e}", exc_info=True)
            return self._fallback_clustering(items if 'items' in locals() else [])

    def _fallback_clustering(self, items: List[Dict]) -> List[Dict]:
        """Fallback clustering by content type"""
        logger.info("Using fallback clustering by content type")
        
        clusters_dict = defaultdict(list)
        for item in items:
            content_type = item.get('content_type', 'Unknown')
            clusters_dict[content_type].append(item)
        
        clusters = []
        for idx, (content_type, cluster_items) in enumerate(clusters_dict.items(), 1):
            if len(cluster_items) < 1:
                continue
            
            all_topics = []
            for item in cluster_items:
                topics = item.get('key_topics') or []
                all_topics.extend(topics)
            
            topic_counts = Counter(all_topics)
            top_topics = [topic for topic, _ in topic_counts.most_common(5)]
            
            avg_quality = sum(item.get('quality_score', 5) for item in cluster_items) / len(cluster_items)
            
            clusters.append({
                'id': idx,
                'name': f"{content_type} Cluster",
                'description': f"{len(cluster_items)} {content_type.lower()} items",
                'content_count': len(cluster_items),
                'top_topics': top_topics,
                'average_quality': round(avg_quality, 1),
                'content_types': {content_type: len(cluster_items)},
                'items': [item['id'] for item in cluster_items]
            })
        
        return clusters

    async def get_related_content(self, content_id: int, limit: int = 10) -> List[Dict]:
        """Find semantically related content"""
        try:
            source_response = await asyncio.to_thread(
                self.client.table('processed_content').select(
                    'embedding, title, summary'
                ).eq('id', content_id).execute
            )
            source = source_response.data
            
            if not source or not source[0].get('embedding'):
                return []
            
            source_embedding = source[0]['embedding']
            
            try:
                response = await asyncio.to_thread(
                    self.client.rpc(
                        'match_processed_content',
                        {
                            'query_embedding': source_embedding, 
                            'match_count': limit + 1,
                            'match_threshold': 0.3
                        }
                    ).execute
                )
                
                if response.data:
                    results = [
                        {
                            'id': item.get('id'),
                            'url': item.get('url'),
                            'title': item.get('title'),
                            'summary': item.get('summary'),
                            'content_type': item.get('content_type'),
                            'similarity': round(item.get('similarity', 0), 3)
                        }
                        for item in response.data
                        if item.get('id') != content_id
                    ]
                    return results[:limit]
            except Exception as e:
                logger.warning(f"RPC related content failed: {e}")
            
            # Manual fallback
            all_content_response = await asyncio.to_thread(
                self.client.table('processed_content').select(
                    'id, url, title, summary, content_type, embedding'
                ).neq('id', content_id).execute
            )
            
            results = []
            for item in all_content_response.data or []:
                if not item.get('embedding'):
                    continue
                
                similarity = self._cosine_similarity(source_embedding, item['embedding'])
                
                if similarity > 0.3:
                    results.append({
                        'id': item['id'],
                        'url': item['url'],
                        'title': item['title'],
                        'summary': item['summary'],
                        'content_type': item['content_type'],
                        'similarity': round(similarity, 3)
                    })
            
            results.sort(key=lambda x: x['similarity'], reverse=True)
            return results[:limit]
            
        except Exception as e:
            logger.error(f"Related content failed: {e}")
            return []

    async def get_trending_topics(self, limit: int = 10) -> List[Dict]:
        """Get most frequent topics"""
        try:
            response = await asyncio.to_thread(
                self.client.table('processed_content').select(
                    'key_topics, quality_score'
                ).execute
            )
            
            if not response.data:
                return []
            
            topic_counts = {}
            for item in response.data:
                topics = item.get('key_topics', [])
                quality = item.get('quality_score', 5)
                
                for topic in topics:
                    if topic not in topic_counts:
                        topic_counts[topic] = {'count': 0, 'total_quality': 0}
                    topic_counts[topic]['count'] += 1
                    topic_counts[topic]['total_quality'] += quality
            
            trending = []
            for topic, data in topic_counts.items():
                avg_quality = data['total_quality'] / data['count']
                trending.append({
                    'topic': topic,
                    'count': data['count'],
                    'average_quality': round(avg_quality, 1)
                })
            
            trending.sort(key=lambda x: x['count'], reverse=True)
            return trending[:limit]
            
        except Exception as e:
            logger.error(f"Trending topics failed: {e}")
            return []

    async def export_data(self) -> Dict:
        """
        Export knowledge graph with enhanced semantic edges.
        Creates edges based on:
        1. Shared topics (strong edges)
        2. Semantic similarity (medium edges)
        3. Same content type (weak edges)
        """
        try:
            logger.info("📊 Exporting enhanced knowledge graph...")
            
            response = await asyncio.to_thread(
                self.client.table('processed_content').select(
                    'id, title, summary, content_type, key_topics, quality_score, url, '
                    'visit_timestamp, processing_method, embedding'
                ).execute
            )
            
            if not response.data:
                return {
                    'nodes': [],
                    'edges': [],
                    'links': [],
                    'metadata': {
                        'total_nodes': 0,
                        'total_edges': 0,
                        'exported_at': datetime.now().isoformat()
                    }
                }
            
            items = response.data
            
            # Process nodes
            nodes = []
            embeddings_map = {}
            
            for item in items:
                node = {
                    "id": str(item['id']),
                    "name": item.get('title', f"Content {item['id']}"),
                    "title": item.get('title', f"Content {item['id']}"),
                    "type": item.get('content_type', 'Unknown'),
                    "content_type": item.get('content_type', 'Unknown'),
                    "quality": item.get('quality_score', 5),
                    "quality_score": item.get('quality_score', 5),
                    "summary": item.get('summary', ''),
                    "topics": item.get('key_topics', []),
                    "key_topics": item.get('key_topics', []),
                    "url": item.get('url', ''),
                    "visit_timestamp": item.get('visit_timestamp'),
                    "processing_method": item.get('processing_method', 'unknown')
                }
                nodes.append(node)
                
                # Store embedding for similarity calculation
                if item.get('embedding') and len(item.get('embedding', [])) > 0:
                    embeddings_map[str(item['id'])] = item['embedding']
            
            # Create enhanced edges with multiple strategies
            edges = []
            edge_id = 0
            
            for i, node1 in enumerate(nodes):
                topics1 = set(node1.get('topics', []))
                id1 = node1['id']
                
                for j, node2 in enumerate(nodes[i+1:], i+1):
                    topics2 = set(node2.get('topics', []))
                    id2 = node2['id']
                    shared_topics = topics1.intersection(topics2)
                    
                    # Strategy 1: Strong edges for shared topics (at least 1 shared topic)
                    if len(shared_topics) >= 1:
                        similarity = len(shared_topics) / max(len(topics1), len(topics2), 1)
                        edges.append({
                            "id": f"edge_{edge_id}",
                            "source": id1,
                            "target": id2,
                            "shared_topics": list(shared_topics),
                            "weight": len(shared_topics),
                            "similarity": round(similarity, 3),
                            "type": "topic"
                        })
                        edge_id += 1
                    
                    # Strategy 2: Medium edges for semantic similarity
                    elif id1 in embeddings_map and id2 in embeddings_map:
                        emb_similarity = self._cosine_similarity(
                            embeddings_map[id1],
                            embeddings_map[id2]
                        )
                        
                        if emb_similarity > 0.5:  # Medium-high semantic similarity
                            edges.append({
                                "id": f"edge_{edge_id}",
                                "source": id1,
                                "target": id2,
                                "shared_topics": list(shared_topics) if shared_topics else [],
                                "weight": 1,
                                "similarity": round(emb_similarity, 3),
                                "type": "semantic"
                            })
                            edge_id += 1
                    
                    # Strategy 3: Weak edges for same content type (limit these)
                    elif (node1.get('content_type') == node2.get('content_type') and 
                          node1.get('content_type') != 'Unknown' and
                          edge_id < len(nodes) * 2):  # Limit weak edges
                        edges.append({
                            "id": f"edge_{edge_id}",
                            "source": id1,
                            "target": id2,
                            "shared_topics": [],
                            "weight": 1,
                            "similarity": 0.3,
                            "type": "content_type"
                        })
                        edge_id += 1
            
            # Sort edges by similarity for better graph quality
            edges.sort(key=lambda x: x['similarity'], reverse=True)
            
            # Limit total edges to prevent overcrowding
            max_edges = min(len(edges), len(nodes) * 3)
            edges = edges[:max_edges]
            
            graph_data = {
                "nodes": nodes,
                "links": edges,
                "edges": edges,
                "metadata": {
                    "total_nodes": len(nodes),
                    "total_links": len(edges),
                    "exported_at": datetime.now().isoformat(),
                    "edge_types": {
                        "topic": len([e for e in edges if e['type'] == 'topic']),
                        "semantic": len([e for e in edges if e['type'] == 'semantic']),
                        "content_type": len([e for e in edges if e['type'] == 'content_type'])
                    }
                }
            }
            
            logger.info(f"✅ Exported graph: {len(nodes)} nodes, {len(edges)} edges")
            return graph_data
            
        except Exception as e:
            logger.error(f"Knowledge graph export failed: {e}", exc_info=True)
            return {
                'nodes': [],
                'edges': [],
                'links': [],
                'metadata': {
                    'total_nodes': 0,
                    'total_edges': 0,
                    'exported_at': datetime.now().isoformat(),
                    'error': str(e)
                }
            }

    async def get_analytics(self) -> Dict:
        """Enhanced analytics"""
        try:
            response = await asyncio.to_thread(
                self.client.table('processed_content').select(
                    'processing_method, content_type, quality_score, created_at'
                ).execute
            )
            
            data = response.data if response and response.data else []
            
            if not data:
                return {}
            
            total = len(data)
            by_method = {}
            by_type = {}
            quality_sum = 0
            
            for item in data:
                method = item.get('processing_method', 'unknown')
                content_type = item.get('content_type', 'unknown')
                quality = item.get('quality_score', 0)
                
                by_method[method] = by_method.get(method, 0) + 1
                by_type[content_type] = by_type.get(content_type, 0) + 1
                quality_sum += quality
            
            return {
                'total_content': total,
                'by_processing_method': by_method,
                'by_content_type': by_type,
                'average_quality': round(quality_sum / total, 2) if total > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Analytics failed: {e}")
            return {}

    async def health_check(self) -> Dict:
        """Health check"""
        db_connected = False
        error_message = None
        
        try:
            await asyncio.to_thread(
                self.client.table('processed_content').select('id').limit(1).execute
            )
            db_connected = True
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            error_message = str(e)

        embedding_configured = bool(self.openai_embedder) and bool(self.openai_embedder.openai_api_key)
        status = 'healthy' if db_connected and embedding_configured else 'degraded'
        
        if error_message:
            status = 'unhealthy'

        result = {
            'status': status,
            'database_connected': db_connected,
            'embedding_service_configured': embedding_configured,
            'timestamp': datetime.now().isoformat()
        }
        
        if error_message:
            result['error'] = error_message
            
        return result

    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Calculate cosine similarity"""
        try:
            vec_a = np.array(a)
            vec_b = np.array(b)

            if len(vec_a) != len(vec_b):
                return 0.0
            if len(vec_a) == 0:
                return 0.0
                
            dot_product = np.dot(vec_a, vec_b)
            norm_a = np.linalg.norm(vec_a)
            norm_b = np.linalg.norm(vec_b)
            
            if norm_a == 0 or norm_b == 0:
                return 0.0
            
            return float(dot_product / (norm_a * norm_b))
            
        except Exception as e:
            logger.error(f"Similarity calculation failed: {e}")
            return 0.0

async def init_db(openai_api_key=None):
    """Initialize database — loads SentenceTransformer in a thread to avoid blocking the event loop."""
    # Load the model in a worker thread so the async event loop (and httpx Supabase client) stays alive
    logger.info("⏳ Loading SentenceTransformer model (may take a moment)...")
    try:
        st_embedder = await asyncio.to_thread(SentenceTransformer, 'all-MiniLM-L6-v2')
        logger.info("✅ SentenceTransformer loaded")
    except Exception as e:
        logger.warning(f"SentenceTransformer failed to load: {e} — embeddings unavailable")
        st_embedder = None

    db = SimpleVectorDB(openai_api_key, st_embedder=st_embedder)
    await db._ensure_match_function()
    health = await db.health_check()
    logger.info(f"Database status: {health['status']}")
    return db