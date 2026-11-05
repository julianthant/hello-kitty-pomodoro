// Shared defaults and pure helpers used by the popup and the background worker.

export const DEFAULT_SETTINGS = {
  focus: 25, // minutes
  short: 5,
  long: 15,
  sound: true,
};

export const LIMITS = {
  focus: [1, 120],
  short: [1, 60],
  long: [1, 60],
};

/** Focus sessions before a long break. */
export const LONG_EVERY = 4;

export const DEFAULT_STATE = {
  mode: 'focus', // 'focus' | 'short' | 'long'
  status: 'idle', // 'idle' | 'running' | 'paused'
  endTime: null, // epoch ms, while running
  remainingMs: null, // ms left, while paused
  durationMs: null, // total length of the current session
  cycle: 0, // focus sessions finished since the last long break
  task: '',
  lastCompletedAt: 0,
};

export function durationMs(settings, mode) {
  return Math.round(settings[mode] * 60 * 1000);
}

export function clamp(n, [min, max]) {
  return Math.min(max, Math.max(min, n));
}

/** Local-time YYYY-MM-DD key. */
export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** What comes after a finished session: the next mode and the updated cycle count. */
export function nextStep(mode, cycle) {
  if (mode === 'focus') {
    const next = cycle + 1;
    return { mode: next >= LONG_EVERY ? 'long' : 'short', cycle: next };
  }
  if (mode === 'long') return { mode: 'focus', cycle: 0 };
  return { mode: 'focus', cycle };
}
