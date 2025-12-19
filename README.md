# 🧠 MindCanvas - AI Knowledge Graph

> Transform your browsing history into an intelligent, searchable knowledge graph with RAG-powered AI chat

[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/Python-3.9+-green?logo=python)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 🎯 Problem Statement

In our information-rich digital age, we consume vast amounts of content daily through browsing, reading articles, tutorials, and documentation. However, this knowledge remains scattered and disconnected, making it nearly impossible to:

- 🔍 Discover relationships between different topics you've learned
- 💡 Recall and build upon previous knowledge effectively
- 📊 Identify knowledge gaps in your learning journey
- 🤖 Leverage AI to understand and connect your personal knowledge

**MindCanvas solves this by transforming your browsing data into an intelligent, searchable knowledge network powered by AI.**

## ✨ Features

### 🧠 AI-Powered Analysis

- **Smart Content Extraction**: Automatic topic identification and summarization
- **Quality Scoring**: AI-driven content quality assessment (1-10 scale)
- **Semantic Understanding**: Deep content analysis beyond keywords

### 🕸️ Knowledge Graph

- **Interactive Visualization**: Force-directed clustering with Cytoscape.js
- **Multiple Layouts**: Force-directed, hierarchical, circular, and more
- **Semantic Color Coding**: Visual categorization by content type and topics

### 🔍 Advanced Search

- **Vector Similarity**: Find content by meaning, not just keywords
- **RAG Chatbot**: Natural language Q&A about your knowledge base
- **Multi-Modal**: Text search, semantic search, and conversational queries

### 🔐 Privacy First

- **Local Processing**: All analysis happens on your machine
- **No Data Sharing**: Your browsing data stays private
- **Open Source**: Full transparency and customization

## 📸 Screenshots

![Knowledge Graph](https://github.com/user-attachments/assets/74b813d9-681e-424d-b0c4-78eba019f4e8)
_Interactive knowledge graph with semantic clustering_

![AI Chat](https://github.com/user-attachments/assets/f00db503-d6ee-4828-8ce2-e7d42d707a69)
_RAG-powered chatbot with source citations_

![Analytics](https://github.com/user-attachments/assets/d93b3f21-30f6-4a8f-86ac-77fd38391946)
_Comprehensive knowledge analytics_

## 🚀 Quick Start (Docker - Recommended)

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- OpenAI API Key
- Supabase Account

### 1. Clone & Setup

```bash
git clone https://github.com/yourusername/mindcanvas.git
cd mindcanvas
```

### 2. Configure Environment

Create `backend/.env`:

```env
# Required
OPENAI_API_KEY=sk-your-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# Optional
GROQ_API_KEY=gsk-your-key-here
OPENAI_MODEL=gpt-4-turbo
```

### 3. Run with Docker

```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

### 4. Access Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8090
- **API Docs**: http://localhost:8090/docs

📖 **Detailed Docker guide**: See [DOCKER_SETUP.md](DOCKER_SETUP.md)

## 🛠️ Manual Installation (Alternative)

<details>
<summary>Click to expand manual setup instructions</summary>

### Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
python main.py
```

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

### Chrome Extension

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `extension/` folder

</details>

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│  Chrome Extension                       │
│  • Exports browsing history             │
│  • Privacy-first data collection        │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  FastAPI Backend                        │
│  • AI content analysis (GPT-4)          │
│  • Vector embeddings (OpenAI)           │
│  • RAG chatbot (LangChain)              │
│  • DBSCAN clustering                    │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  Supabase Database                      │
│  • PostgreSQL + pgvector                │
│  • Vector similarity search             │
│  • RPC functions for performance        │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  React Frontend                         │
│  • Cytoscape.js graph visualization     │
│  • Framer Motion animations             │
│  • Real-time chat interface             │
└─────────────────────────────────────────┘
```

## 💡 Key Technologies

### Backend

- **FastAPI** - High-performance Python web framework
- **LangChain** - LLM orchestration and RAG implementation
- **OpenAI GPT-4** - Content analysis and embeddings
- **Supabase** - Vector database with pgvector
- **Scikit-learn** - DBSCAN clustering algorithm

### Frontend

- **React 18** - Modern component-based UI
- **Cytoscape.js** - Advanced graph visualization
- **Framer Motion** - Smooth animations
- **Styled Components** - Dynamic theming
- **Zustand** - Lightweight state management

### AI & ML

- **GPT-4 Turbo** - Content understanding and chat
- **text-embedding-ada-002** - Vector embeddings (1536-dim)
- **DBSCAN** - Semantic clustering
- **Cosine Similarity** - Content relationship detection

## 📊 Data Flow

```
1. Browse Web → 2. Export History → 3. AI Analysis
                                         ↓
                                    Extract Topics
                                    Score Quality
                                    Generate Embeddings
                                         ↓
4. Store in Vector DB ← 5. Semantic Clustering
         ↓
6. Interactive Graph Visualization
         ↓
7. RAG Chatbot (Query your knowledge)
```

## 🎯 Use Cases

### 👨‍🎓 Students & Researchers

- Track research across multiple domains
- Discover connections between papers/topics
- Build comprehensive knowledge maps

### 👨‍💻 Developers & Engineers

- Connect technical concepts across frameworks
- Build learning paths for new technologies
- Maintain awareness of best practices

### ✍️ Content Creators

- Organize research for articles
- Find gaps in coverage
- Track evolution of ideas

### 📚 Lifelong Learners

- Visualize learning journey
- Identify knowledge gaps
- Build personal expertise maps

## 🔧 Configuration

### API Keys Setup

1. **OpenAI API Key** (Required)

   - Get from: https://platform.openai.com/api-keys
   - Used for: Content analysis and embeddings
   - Cost: ~$0.001 per page analyzed

2. **Groq API Key** (Optional)

   - Get from: https://console.groq.com
   - Used for: Faster inference (free tier available)
   - Alternative to OpenAI for some tasks

3. **Supabase** (Required)
   - Sign up: https://supabase.com
   - Create project → Get URL and anon key
   - Run SQL from `backend/setup_production.py`

### Supabase Database Setup

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create main table
CREATE TABLE processed_content (
    id BIGSERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    embedding vector(1536),
    -- ... other fields
);

-- Create vector search function
CREATE OR REPLACE FUNCTION match_processed_content(
    query_embedding vector(1536),
    match_count int DEFAULT 10
)
RETURNS TABLE (...) AS $$
    -- RPC function for fast similarity search
$$ LANGUAGE plpgsql;
```

Full SQL available in `backend/setup_production.py`

## 📚 API Reference

### Core Endpoints

```typescript
// Ingest browsing data
POST /api/ingest
Body: HistoryItem[]

// Chat with knowledge base
POST /api/chat
Body: {
  message: string,
  use_rag: boolean,
  max_context_items: number
}

// Semantic search
POST /api/search/semantic
Body: {
  query: string,
  limit: number
}

// Export knowledge graph
GET /api/knowledge-graph/export
Response: {
  nodes: Node[],
  links: Link[],
  metadata: {...}
}
```

📖 **Full API docs**: http://localhost:8090/docs (when running)

## 🐛 Troubleshooting

### Backend Issues

**"Cannot connect to Supabase"**

```bash
# Check environment variables
docker-compose exec backend env | grep SUPABASE

# Verify .env file exists
ls -la backend/.env

# Restart with fresh build
docker-compose down && docker-compose up --build
```

**"Invalid OpenAI API key"**

```bash
# Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Update .env with correct key
```

### Frontend Issues

**"API connection failed"**

```bash
# Check backend is running
curl http://localhost:8090/api/health

# Check CORS configuration in backend/.env
CORS_ORIGINS=http://localhost:3000
```

### Docker Issues

**"Port already in use"**

```bash
# Find and kill process
# Windows
netstat -ano | findstr :8090

# Mac/Linux
lsof -i :8090

# Or change port in docker-compose.yml
```

See [DOCKER_SETUP.md](DOCKER_SETUP.md) for comprehensive troubleshooting.

## 🧪 Development

### Running Tests

```bash
# Backend tests
cd backend
pytest tests/ -v

# Frontend tests
cd frontend
npm test
```

### Hot Reload Development

```bash
# Mount code as volume in docker-compose.yml
services:
  backend:
    volumes:
      - ./backend:/app
```

### Adding New Features

1. **New Content Types**: Update `backend/main.py` → `extract_content()`
2. **Graph Layouts**: Add to `frontend/src/components/ControlPanel.js`
3. **AI Providers**: Extend `backend/main.py` → `LLMProcessor`

## 📊 Performance

- **Embedding Generation**: ~50ms per query (OpenAI)
- **Vector Search**: ~100ms for 1000 documents
- **Clustering**: ~2-3s for 500 documents
- **Graph Rendering**: 60 FPS for 100 nodes

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## 📝 License

MIT License - see [LICENSE](LICENSE) file

## 🙏 Acknowledgments

- OpenAI for GPT and embeddings
- Supabase for vector database
- Cytoscape.js for graph visualization
- React and FastAPI communities

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/mindcanvas/issues)
- **Docs**: [Documentation](https://mindcanvas.readthedocs.io)
- **Discord**: [Join Community](https://discord.gg/mindcanvas)

---

**Built with ❤️ for the AI age** | [⭐ Star on GitHub](https://github.com/yourusername/mindcanvas) | [📖 Read the Docs](https://mindcanvas.readthedocs.io)
