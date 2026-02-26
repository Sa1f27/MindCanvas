# MindCanvas - AI Knowledge Graph

> Transform your browsing history into an intelligent, searchable knowledge graph with AI-powered clustering and RAG chatbot

[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/Python-3.11-green?logo=python)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Problem Statement

We consume vast amounts of content daily — articles, tutorials, documentation — but this knowledge remains scattered and disconnected. MindCanvas solves this by transforming your browsing data into an intelligent, visual knowledge network with AI-powered clustering and a conversational chatbot.

## Features

### AI-Powered Clustering
- **GPT-4.1-mini JSON Mode**: Nodes are clustered semantically using OpenAI's structured output — Python pages group with Python, SAP with SAP, etc.
- **Smart Fallback**: Topic-specificity algorithm when the API is unavailable

### Knowledge Graph Visualization
- **Neural Brain Layout**: Phyllotaxis golden-angle cluster placement with fCoSE physics
- **Glow Nodes**: Cytoscape.js with shadow-blur effects and cluster coloring
- **Interactive**: Hover to highlight connections, click to inspect

### RAG Chatbot
- **Knowledge-Aware Chat**: Ask questions about your browsing history
- **Source Citations**: Every answer references the content it draws from
- **Multi-Model**: Supports gpt-4.1-mini-2025-04-14, gpt-5-mini-2025-08-07, Groq (Llama)

### Chrome Extension
- **One-Click Export**: Send browsing history to MindCanvas
- **Privacy First**: Data stays on your machine, processed locally

## Screenshots

![Knowledge Graph](https://github.com/user-attachments/assets/74b813d9-681e-424d-b0c4-78eba019f4e8)
_Interactive knowledge graph with AI semantic clustering_

![AI Chat](https://github.com/user-attachments/assets/f00db503-d6ee-4828-8ce2-e7d42d707a69)
_RAG-powered chatbot with source citations_

## Quick Start (Docker)

### Prerequisites

- Docker 20.10+ & Docker Compose 2.0+
- OpenAI API Key
- Supabase Account (free tier works)

### 1. Clone & Setup

```bash
git clone https://github.com/Sa1f27/MindCanvas.git
cd MindCanvas
```

### 2. Configure Environment

Copy the example and fill in your keys:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
OPENAI_API_KEY=sk-your-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# Optional
GROQ_API_KEY=gsk-your-key-here
```

### 3. Run with Docker

```bash
docker-compose up -d --build
```

### 4. Access

- **Frontend**: http://localhost:3030
- **Backend API**: http://localhost:8090
- **API Docs**: http://localhost:8090/docs

### 5. Load Sample Data (Optional)

For a quick demo with 35 curated URLs across 10 topics:

```powershell
# PowerShell
.\sample\load_sample_data.ps1
```

Or with curl:

```bash
curl -X POST http://localhost:8090/api/ingest \
  -H "Content-Type: application/json" \
  -d @sample/sample_data.json
```

## Architecture

```
Chrome Extension
  Exports browsing history
         |
         v
FastAPI Backend (port 8090)
  Content extraction (BeautifulSoup)
  LLM analysis (Groq Llama / OpenAI)
  SentenceTransformer embeddings (384-dim)
  AI clustering (GPT-4.1-mini JSON mode)
  RAG chatbot (LangChain)
         |
         v
Supabase (PostgreSQL + pgvector)
  Vector similarity search
  Content storage
         |
         v
React Frontend (port 3030, Vite)
  Cytoscape.js graph (fCoSE layout)
  Styled-components dark theme
  Zustand state management
```

## Tech Stack

### Backend
- **FastAPI** — async Python web framework
- **SentenceTransformer** (`all-MiniLM-L6-v2`) — 384-dim embeddings
- **OpenAI gpt-4.1-mini-2025-04-14** — AI clustering & content analysis
- **LangChain** — RAG chatbot orchestration
- **Supabase** — PostgreSQL + pgvector
- **scikit-learn** — DBSCAN clustering (when embeddings available)

### Frontend
- **React 18** + **Vite** — fast dev server & builds
- **Cytoscape.js** + **cytoscape-fcose** — graph visualization
- **Styled Components** — dark indigo theme
- **Zustand** — lightweight state management

## Manual Installation

<details>
<summary>Click to expand</summary>

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8090
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Chrome Extension

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder

</details>

## API Reference

```
POST /api/ingest              — Import browsing history
POST /api/chat                — Chat with knowledge base
POST /api/search/semantic     — Vector similarity search
GET  /api/knowledge-graph/export — Export graph (nodes + links + clusters)
GET  /api/cluster             — Get cluster info
GET  /api/content             — List all content
GET  /api/trending            — Trending topics
GET  /api/recommendations     — Content recommendations
GET  /api/health              — System health check
```

Full interactive docs at http://localhost:8090/docs

## Supabase Setup

Run this SQL in the Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE processed_content (
    id BIGSERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    content_type TEXT DEFAULT 'Web Content',
    key_topics JSONB DEFAULT '[]',
    quality_score INTEGER DEFAULT 5,
    processing_method TEXT DEFAULT 'basic',
    content_hash TEXT,
    visit_timestamp TIMESTAMPTZ,
    embedding vector(384),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION match_processed_content(
    query_embedding vector(384),
    match_count int DEFAULT 10,
    match_threshold float DEFAULT 0.3
)
RETURNS TABLE (
    id bigint, url text, title text, summary text,
    content_type text, key_topics jsonb, quality_score int,
    similarity float
)
LANGUAGE sql STABLE AS $$
    SELECT id, url, title, summary, content_type, key_topics, quality_score,
           1 - (embedding <=> query_embedding) as similarity
    FROM processed_content
    WHERE 1 - (embedding <=> query_embedding) > match_threshold
    ORDER BY (embedding <=> query_embedding)
    LIMIT match_count;
$$;
```

## Troubleshooting

**Backend won't start**: Check `backend/.env` has valid `SUPABASE_URL`, `SUPABASE_KEY`, and `OPENAI_API_KEY`

**Graph shows no nodes**: Make sure you've ingested data via the Chrome extension or sample data script

**Clustering falls back to topics**: The OpenAI API key is missing or invalid — AI clustering requires it

**Port conflict**: Change ports in `docker-compose.yml` (backend: 8090, frontend: 3030)

## License

MIT License - see [LICENSE](LICENSE)

---

Built for the AI age | [GitHub](https://github.com/Sa1f27/MindCanvas)
