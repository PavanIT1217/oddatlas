type Mode = 'system' | 'light' | 'dark';
const KEY = 'oddatlas:theme';
const ORDER: Mode[] = ['dark', 'light', 'system'];
const LABEL: Record<Mode, string> = { system: 'Auto', light: 'Daylight', dark: 'HUD dark' };

export function initTheme(nameEl: HTMLElement): () => void {
  // The HUD is designed dark-first; "Auto" follows the device.
  let mode: Mode = 'dark';
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') mode = v;
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
      localStorage.setItem(KEY, mode);
    } catch {
      /* ignore */
    }
    apply();
  };
}
