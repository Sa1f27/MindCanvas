import { create } from 'zustand';
import { api } from '../lib/api';
import type { ChatTurn } from '../lib/types';
import { useGraph } from './graph';

interface ChatState {
  turns: ChatTurn[];
  pending: boolean;
  ask: (question: string) => Promise<void>;
  reset: () => void;
}

export const useChat = create<ChatState>((set, get) => ({
  turns: [],
  pending: false,

  ask: async question => {
    const text = question.trim();
    if (!text || get().pending) return;
    const history = get().turns;
    set({ turns: [...history, { role: 'user', content: text }], pending: true });
    try {
      const reply = await api.chat(text, history);
      set(s => ({ turns: [...s.turns, { role: 'assistant', content: reply.response, sources: reply.sources }] }));
      // The signature moment: the map turns to the pages this answer was retrieved from.
      useGraph.getState().highlight(reply.sources.map(src => src.id).filter(Boolean));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      set(s => ({ turns: [...s.turns, { role: 'assistant', content: message, failed: true }] }));
    } finally {
      set({ pending: false });
    }
  },

  reset: () => {
    set({ turns: [], pending: false });
    useGraph.getState().highlight([]);
  },
}));
