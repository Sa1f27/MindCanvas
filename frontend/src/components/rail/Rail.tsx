import { BarChart3, CircleDot, Hash, Search, type LucideIcon } from 'lucide-react';
import { useUi, type RailTab } from '../../store/ui';
import ClustersTab from './ClustersTab';
import SearchTab from './SearchTab';
import StatsTab from './StatsTab';
import TopicsTab from './TopicsTab';

const TABS: { id: RailTab; label: string; icon: LucideIcon }[] = [
  { id: 'clusters', label: 'Clusters', icon: CircleDot },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'topics', label: 'Topics', icon: Hash },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
];

const PANELS: Record<RailTab, () => React.ReactElement> = {
  clusters: ClustersTab,
  search: SearchTab,
  topics: TopicsTab,
  stats: StatsTab,
};

/** Left side: icon tabs always visible, the panel beside them can be collapsed for a full-width map. */
export default function Rail() {
  const tab = useUi(s => s.railTab);
  const open = useUi(s => s.railOpen);
  const setTab = useUi(s => s.setRailTab);
  const toggle = useUi(s => s.toggleRail);
  const Panel = PANELS[tab];

  return (
    <aside className="glass pointer-events-auto flex shrink-0 overflow-hidden">
      <nav aria-label="Panels" className="flex w-14 flex-col items-center gap-1.5 border-r border-white/[0.06] py-3">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = open && tab === id;
          return (
            <button key={id} onClick={() => (active ? toggle() : setTab(id))} aria-pressed={active}
              aria-label={label} title={label}
              className={`icon-btn size-10 rounded-xl ${active ? 'bg-iris/20 text-white shadow-[inset_0_0_0_1px_rgba(122,107,255,0.45)] hover:bg-iris/20 hover:text-white' : ''}`}>
              <Icon size={17} strokeWidth={1.75} />
            </button>
          );
        })}
      </nav>
      {open && (
        <div className="flex w-[300px] flex-col">
          <h2 className="border-b border-white/[0.06] px-4 py-3.5 text-[15px] font-semibold tracking-[-0.01em] text-fg">{TABS.find(t => t.id === tab)?.label}</h2>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            <Panel />
          </div>
        </div>
      )}
    </aside>
  );
}
