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
    <aside className="flex shrink-0 border-r border-line bg-panel">
      <nav aria-label="Panels" className="flex w-12 flex-col items-center gap-1 border-r border-line py-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = open && tab === id;
          return (
            <button key={id} onClick={() => (active ? toggle() : setTab(id))} aria-pressed={active}
              aria-label={label} title={label}
              className={`icon-btn size-9 ${active ? 'bg-panel-2 text-fg' : ''}`}>
              <Icon size={17} strokeWidth={1.75} />
            </button>
          );
        })}
      </nav>
      {open && (
        <div className="flex w-80 flex-col">
          <h2 className="border-b border-line px-4 py-3 text-[13px] font-medium text-fg">{TABS.find(t => t.id === tab)?.label}</h2>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            <Panel />
          </div>
        </div>
      )}
    </aside>
  );
}
