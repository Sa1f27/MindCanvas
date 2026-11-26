import { useEffect, useRef, useState } from 'react';
import { ArrowUp, RotateCcw } from 'lucide-react';
import { api } from '../../lib/api';
import { useChat } from '../../store/chat';
import Answer from './Answer';

const FALLBACK_SUGGESTIONS = [
  'What have I been reading about most?',
  'Summarise what I know about Python',
  'Which topics connect to each other?',
];

/** Right side: ask anything about what you have read. Every answer cites the pages it came from. */
export default function AskPanel() {
  const turns = useChat(s => s.turns);
  const pending = useChat(s => s.pending);
  const ask = useChat(s => s.ask);
  const reset = useChat(s => s.reset);
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState(FALLBACK_SUGGESTIONS);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.suggestions().then(s => s.length && setSuggestions(s.slice(0, 3))).catch(() => undefined);
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [turns.length, pending]);

  const submit = (text: string) => {
    if (!text.trim() || pending) return;
    void ask(text);
    setDraft('');
  };

  return (
    <aside aria-label="Ask" className="flex w-[380px] shrink-0 flex-col border-l border-line bg-panel">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-medium">Ask your reading</h2>
        {turns.length > 0 && (
          <button onClick={reset} className="icon-btn size-7" aria-label="New conversation" title="New conversation">
            <RotateCcw size={14} />
          </button>
        )}
      </header>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {turns.length === 0 ? (
          <div className="flex h-full flex-col justify-end">
            <p className="text-[15px] leading-snug text-fg">Ask anything about what you have read.</p>
            <p className="mt-1 text-dim">Answers come from your own pages, and the map lights up the ones each answer used.</p>
            <ul className="mt-5 space-y-1.5">
              {suggestions.map(s => (
                <li key={s}>
                  <button onClick={() => submit(s)} className="w-full rounded-lg border border-line px-3 py-2 text-left text-dim transition-colors hover:border-line-hi hover:text-fg">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="space-y-6">
            {turns.map((t, i) => (
              <li key={i}>
                {t.role === 'user'
                  ? <p className="text-[14.5px] font-medium text-fg">{t.content}</p>
                  : <Answer turn={t} />}
              </li>
            ))}
            {pending && <li className="text-dim">Searching your pages…</li>}
          </ol>
        )}
        <div ref={bottom} />
      </div>

      <form onSubmit={e => { e.preventDefault(); submit(draft); }} className="border-t border-line p-3">
        <div className="flex items-end gap-2 rounded-xl border border-line bg-panel-2 p-1.5 pl-3 focus-within:border-line-hi">
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={1} placeholder="Ask a question"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit(draft);
              }
            }}
            aria-label="Your question"
            className="max-h-32 min-h-[34px] flex-1 resize-none bg-transparent py-1.5 text-[14px] text-fg outline-none placeholder:text-mute field-sizing-content" />
          <button type="submit" disabled={!draft.trim() || pending} aria-label="Send"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-fg text-ink transition-opacity disabled:opacity-30">
            <ArrowUp size={16} />
          </button>
        </div>
      </form>
    </aside>
  );
}
