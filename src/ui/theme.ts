type Mode = 'system' | 'light' | 'dark';
const KEY = 'oddatlas:theme';
const ORDER: Mode[] = ['system', 'light', 'dark'];
const LABEL: Record<Mode, string> = { system: 'Auto', light: 'Light', dark: 'Dark' };

export function initTheme(nameEl: HTMLElement): () => void {
  let mode: Mode = 'system';
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') mode = v;
  } catch {
    /* ignore */
  }
  const apply = () => {
    if (mode === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = mode;
    nameEl.textContent = LABEL[mode];
  };
  apply();
  return () => {
    mode = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    try {
      if (mode === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, mode);
    } catch {
      /* ignore */
    }
    apply();
  };
}
