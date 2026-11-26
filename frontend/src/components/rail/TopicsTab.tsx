import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useGraph } from '../../store/graph';
import type { TrendingTopic } from '../../lib/types';

/** The topics that come up most across everything read. Click one to light its pages on the map. */
export default function TopicsTab() {
  const nodes = useGraph(s => s.nodes);
  const highlight = useGraph(s => s.highlight);
  const [topics, setTopics] = useState<TrendingTopic[] | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    api.trending(15).then(setTopics).catch(() => setTopics([]));
  }, []);

  const pick = (topic: string) => {
    if (active === topic) {
      setActive(null);
      highlight([]);
      return;
    }
    const t = topic.toLowerCase();
    setActive(topic);
    highlight(nodes.filter(n => n.key_topics.some(k => k.toLowerCase() === t)).map(n => n.id));
  };

  if (topics === null) return <p className="px-4 py-3 text-dim">Loading topics…</p>;
  if (!topics.length) return <p className="px-4 py-3 text-dim">No topics yet.</p>;
  const max = Math.max(...topics.map(t => t.count));

  return (
    <ul className="px-2 py-2">
      {topics.map(t => (
        <li key={t.topic}>
          <button onClick={() => pick(t.topic)} aria-pressed={active === t.topic}
            className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-panel-2 ${active === t.topic ? 'bg-panel-2' : ''}`}>
            <span className="min-w-0 flex-1 truncate text-fg">{t.topic}</span>
            <span className="relative h-1 w-16 shrink-0 overflow-hidden rounded-full bg-line">
              <span className="absolute inset-y-0 left-0 rounded-full bg-dim" style={{ width: `${(t.count / max) * 100}%` }} />
            </span>
            <span className="tnum w-6 shrink-0 text-right font-mono text-[12px] text-mute">{t.count}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
