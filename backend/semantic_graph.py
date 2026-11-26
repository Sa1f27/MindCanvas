"""
Graph structure from embeddings alone: clusters, cluster names and edges, no LLM needed.

Used when the LLM is unavailable (no API key, rate limits, outages), so a fresh clone still
produces a meaningful map.

- Clusters: Ward agglomerative clustering on the normalised local sentence embeddings.
- Names: class-based TF-IDF (the idea behind BERTopic). A cluster is named after the terms that
  are frequent inside it and rare in the other clusters.
- Edges: each page links to its k nearest neighbours above a similarity floor, so the graph
  stays sparse and every link means "these two are about the same thing".
"""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Dict, List, Sequence, Tuple

import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.preprocessing import normalize

STOPWORDS = frozenset(
    """a about above after again against all am an and any are as at be because been before being below
    between both but by can could did do does doing down during each few for from further get getting
    guide had has have having he her here hers how i if in into introduction is it its itself just learn
    learning more most my new no nor not now of off on once only or other our out over own page part
    quick quickstart same she should so some start started such tutorial than that the their them then
    there these they this those through to too under until up use using very was we what when where which
    while who why will with you your official docs documentation home overview basics reference minutes tour
    wikipedia mdn w3schools geeksforgeeks medium freecodecamp github web org com www site free complete
    beginners beginner understanding explained what's""".split()
)
TOKEN = re.compile(r"[a-z][a-z0-9+#.]{1,}")


def _tokens(text: str) -> List[str]:
    return [t.strip(".") for t in TOKEN.findall(text.lower()) if t.strip(".") not in STOPWORDS and len(t) > 2]


def _cluster_count(n: int) -> int:
    # Roughly one cluster per 6 pages, between 2 and 16. Small enough to read, fine enough to mean something.
    return max(2, min(16, round(n / 6)))


def cluster_embeddings(vectors: np.ndarray) -> np.ndarray:
    """Ward clustering on unit vectors (Euclidean distance there tracks cosine). Returns one label per row."""
    n = len(vectors)
    if n < 3:
        return np.zeros(n, dtype=int)
    # Ward keeps clusters balanced; average linkage tends to make one giant cluster plus singletons.
    model = AgglomerativeClustering(n_clusters=_cluster_count(n), linkage="ward")
    return model.fit_predict(normalize(vectors))


# Terms whose usual spelling is not simple title case.
CASING = {
    "javascript": "JavaScript", "typescript": "TypeScript", "graphql": "GraphQL", "postgresql": "PostgreSQL",
    "mongodb": "MongoDB", "numpy": "NumPy", "css": "CSS", "html": "HTML", "sql": "SQL", "api": "API",
    "llm": "LLM", "llms": "LLMs", "rag": "RAG", "ai": "AI", "ml": "ML", "aws": "AWS", "github": "GitHub",
    "fastapi": "FastAPI", "pytorch": "PyTorch", "tensorflow": "TensorFlow", "scikit": "scikit-learn",
    "kubernetes": "Kubernetes", "devops": "DevOps", "vue.js": "Vue.js", "node.js": "Node.js",
}


def _label(term: str) -> str:
    if term in CASING:
        return CASING[term]
    return term if any(c.isdigit() or c in "+#." for c in term) else term.capitalize()


def name_clusters(texts: Sequence[str], labels: np.ndarray) -> Dict[int, str]:
    """
    Class-based TF-IDF on document frequency: a term scores by the share of the cluster's pages that
    use it, weighted by how few clusters use it. The best term names the cluster, and a second term is
    added only when it is nearly as widespread inside the cluster, so names stay short and accurate.
    """
    doc_freq: Dict[int, Counter] = {}
    sizes: Counter = Counter()
    for text, label in zip(texts, labels):
        lab = int(label)
        doc_freq.setdefault(lab, Counter()).update(set(_tokens(text)))
        sizes[lab] += 1

    n_clusters = len(doc_freq)
    clusters_with_term: Counter = Counter()
    for counts in doc_freq.values():
        clusters_with_term.update(set(counts))

    names: Dict[int, str] = {}
    used: set = set()
    for label, counts in doc_freq.items():
        size = sizes[label]
        scored = sorted(
            ((term, (df / size) * math.log(1 + n_clusters / clusters_with_term[term]), df) for term, df in counts.items()),
            key=lambda x: x[1],
            reverse=True,
        )
        terms = [scored[0][0]] if scored else []
        if len(scored) > 1 and scored[1][2] >= max(2, 0.5 * size) and scored[1][1] >= 0.6 * scored[0][1]:
            terms.append(scored[1][0])
        name = " and ".join(_label(t) for t in terms) or f"Group {label + 1}"
        if name in used:
            name = f"{name} {label + 1}"
        used.add(name)
        names[label] = name
    return names


def nearest_neighbour_edges(
    ids: Sequence[str], vectors: np.ndarray, k: int = 3, min_similarity: float = 0.35
) -> List[Tuple[str, str, float]]:
    """Each node links to its k most similar nodes above min_similarity. Undirected, no duplicates."""
    unit = normalize(vectors)
    sims = unit @ unit.T
    np.fill_diagonal(sims, -1.0)
    edges: Dict[Tuple[str, str], float] = {}
    for i in range(len(ids)):
        for j in np.argsort(sims[i])[::-1][:k]:
            s = float(sims[i, j])
            if s < min_similarity:
                break
            a, b = sorted((ids[i], ids[int(j)]))
            edges[(a, b)] = max(edges.get((a, b), 0.0), s)
    return [(a, b, round(s, 3)) for (a, b), s in edges.items()]


def build(items: List[dict], embeddings: Dict[str, List[float]]) -> Tuple[Dict[str, Tuple[str, int]], List[Tuple[str, str, float]]]:
    """
    items: rows with id, title, summary. embeddings: id -> vector.
    Returns ({id: (cluster_name, cluster_id)}, [(source_id, target_id, similarity)]).
    Items without an embedding are left out, and the caller assigns them a fallback cluster.
    """
    rows = [(str(it["id"]), it) for it in items if str(it["id"]) in embeddings]
    if len(rows) < 3:
        return {}, []
    ids = [rid for rid, _ in rows]
    vectors = np.array([embeddings[rid] for rid in ids], dtype=np.float32)
    labels = cluster_embeddings(vectors)
    # Titles say what a page is about most reliably, so they count twice.
    texts = [f"{it.get('title', '')} {it.get('title', '')} {it.get('summary', '')}" for _, it in rows]
    names = name_clusters(texts, labels)

    # Number clusters by size, largest first, so colours and order are stable between exports.
    order = {label: rank for rank, (label, _) in enumerate(Counter(labels.tolist()).most_common())}
    assignment = {rid: (names[int(lab)], order[int(lab)]) for rid, lab in zip(ids, labels)}
    return assignment, nearest_neighbour_edges(ids, vectors)


def merge_small_clusters(
    assignment: Dict[str, Tuple[str, int]], embeddings: Dict[str, List[float]], min_size: int = 3
) -> Dict[str, Tuple[str, int]]:
    """
    LLMs do not follow cluster counts reliably, so tiny clusters are folded into the cluster whose
    centroid is closest in meaning. Pages without an embedding keep their cluster.
    """
    members: Dict[str, List[str]] = {}
    for sid, (name, _) in assignment.items():
        members.setdefault(name, []).append(sid)
    big = {name: ids for name, ids in members.items() if len(ids) >= min_size}
    if not big or len(big) == len(members):
        return assignment

    centroids = {}
    for name, ids in big.items():
        vecs = [embeddings[i] for i in ids if i in embeddings]
        if vecs:
            centroids[name] = normalize(np.mean(np.array(vecs, dtype=np.float32), axis=0, keepdims=True))[0]
    if not centroids:
        return assignment

    names = list(centroids)
    matrix = np.stack([centroids[n] for n in names])
    ids_for = {name: assignment[ids[0]][1] for name, ids in big.items()}
    merged = dict(assignment)
    for name, ids in members.items():
        if name in big:
            continue
        for sid in ids:
            if sid not in embeddings:
                continue
            vec = normalize(np.array([embeddings[sid]], dtype=np.float32))[0]
            target = names[int(np.argmax(matrix @ vec))]
            merged[sid] = (target, ids_for[target])
    return merged
