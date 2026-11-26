import { create } from 'zustand';

export type RailTab = 'clusters' | 'search' | 'topics' | 'stats';

interface UiState {
  railTab: RailTab;
  railOpen: boolean;
  askOpen: boolean;
  paletteOpen: boolean;
  setRailTab: (tab: RailTab) => void;
  toggleRail: () => void;
  toggleAsk: () => void;
  setPaletteOpen: (open: boolean) => void;
}

export const useUi = create<UiState>(set => ({
  railTab: 'clusters',
  railOpen: true,
  askOpen: true,
  paletteOpen: false,
  // Choosing a tab always opens the rail, so a click is never a no-op.
  setRailTab: railTab => set({ railTab, railOpen: true }),
  toggleRail: () => set(s => ({ railOpen: !s.railOpen })),
  toggleAsk: () => set(s => ({ askOpen: !s.askOpen })),
  setPaletteOpen: paletteOpen => set({ paletteOpen }),
}));
