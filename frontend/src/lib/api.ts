import type { ChatReply, ChatTurn, GraphExport, SearchHit, Stats, TrendingTopic } from './types';

const BASE = '/api';

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<T> {
  const signal = init.signal ?? AbortSignal.timeout(timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      signal,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') throw new ApiError('The server took too long to answer.');
    throw new ApiError('Cannot reach the MindCanvas server. Is the backend running on port 8090?');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { detail?: string } | null;
    throw new ApiError(body?.detail ?? `Request failed (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>('/health', {}, 5_000),

  graph: (force = false) => request<GraphExport>(`/knowledge-graph/export${force ? '?force=true' : ''}`, {}, 120_000),

  stats: () => request<Stats>('/stats'),

  trending: (limit = 12) =>
    request<{ trending_topics: TrendingTopic[] }>(`/trending?limit=${limit}`).then(r => r.trending_topics ?? []),

  semanticSearch: (query: string, limit = 20, signal?: AbortSignal) =>
    request<{ results: SearchHit[] }>('/search/semantic', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
      signal,
    }).then(r => r.results ?? []),

  related: (id: string, limit = 6) =>
    request<{ related_content: SearchHit[] }>(`/related/${encodeURIComponent(id)}?limit=${limit}`).then(r => r.related_content ?? []),

  suggestions: () =>
    request<{ suggestions: string[] }>('/chat/suggestions?limit=4').then(r => r.suggestions ?? []),

  chat: (message: string, history: ChatTurn[]) =>
    request<ChatReply>('/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        conversation_history: history.filter(t => !t.failed).map(({ role, content }) => ({ role, content })),
        use_rag: true,
        max_context_items: 5,
      }),
    }, 60_000),
};
