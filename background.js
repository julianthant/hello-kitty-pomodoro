// Kitty Pomodoro service worker.
// It owns the timer state (in chrome.storage.local) so the countdown keeps going
// when the popup is closed. The popup only sends commands and renders the state.

import {
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  LIMITS,
  clamp,
  dayKey,
  durationMs,
  nextStep,
} from './shared/constants.js';

const END_ALARM = 'kitty-end';
const TICK_ALARM = 'kitty-tick';
const NOTIFICATION_ID = 'kitty-done';
const CHIME_VOLUME = 0.5;
const BADGE_COLORS = { focus: '#e8577d', short: '#4aa6c8', long: '#8f78d6' };

const NOTES = {
  focus: { title: 'Focus session complete', message: 'Time for a break.' },
  short: { title: 'Break over', message: 'Ready to focus again?' },
  long: { title: 'Long break over', message: 'Ready for the next session?' },
};

/* ---------- storage ---------- */

async function load() {
  const data = await chrome.storage.local.get(['settings', 'state']);
  return {
    settings: { ...DEFAULT_SETTINGS, ...data.settings },
    state: { ...DEFAULT_STATE, ...data.state },
  };
}

const saveState = (state) => chrome.storage.local.set({ state });

// Run commands one at a time so rapid clicks and alarms can't interleave.
let queue = Promise.resolve();
function enqueue(fn) {
  const run = queue.then(fn);
  queue = run.catch((err) => console.error('[kitty]', err));
  return run;
}

/* ---------- badge + alarms ---------- */

async function updateBadge(state) {
  if (state.status === 'idle') {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const ms = state.status === 'running' ? state.endTime - Date.now() : state.remainingMs;
  const mins = Math.max(0, Math.ceil(ms / 60000));
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS[state.mode] });
  await chrome.action.setBadgeTextColor?.({ color: '#ffffff' });
  await chrome.action.setBadgeText({ text: state.status === 'paused' ? 'II' : String(mins) });
}

async function syncAlarms(state) {
  if (state.status === 'running') {
    await chrome.alarms.create(END_ALARM, { when: state.endTime });
    await chrome.alarms.create(TICK_ALARM, { periodInMinutes: 0.5 });
  } else {
    await chrome.alarms.clear(END_ALARM);
    await chrome.alarms.clear(TICK_ALARM);
  }
  await updateBadge(state);
}

/* ---------- sound + notification ---------- */

async function playChime(kind) {
  try {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (!contexts.length) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play a short chime when a timer finishes.',
      });
    }
    await chrome.runtime.sendMessage({ target: 'offscreen', type: 'chime', kind, volume: CHIME_VOLUME });
  } catch (err) {
    console.warn('[kitty] could not play chime', err);
  }
}

async function announce(finishedMode, settings) {
  try {
    await chrome.notifications.create(NOTIFICATION_ID, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: NOTES[finishedMode].title,
      message: NOTES[finishedMode].message,
      priority: 2,
    });
  } catch (err) {
    console.warn('[kitty] notification failed', err);
  }
  if (settings.sound) await playChime(finishedMode === 'focus' ? 'focus' : 'break');
}

/* ---------- state transitions ---------- */

async function countSession() {
  const key = dayKey();
  const { daily } = await chrome.storage.local.get('daily');
  const count = daily?.date === key ? daily.count + 1 : 1;
  await chrome.storage.local.set({ daily: { date: key, count } });
}

/** A session ran to the end: count it, move to the next mode and let the user know. */
async function complete({ silent = false } = {}) {
  const { settings, state } = await load();
  if (state.mode === 'focus') await countSession();

  const step = nextStep(state.mode, state.cycle);
  const next = {
    ...state,
    mode: step.mode,
    cycle: step.cycle,
    status: 'idle',
    endTime: null,
    remainingMs: null,
    durationMs: null,
    lastCompletedAt: Date.now(),
  };
  await saveState(next);
  await syncAlarms(next);
  if (!silent) await announce(state.mode, settings);
}

/** Make stored state agree with the clock (after a browser restart, a missed alarm, etc.). */
async function reconcile() {
  const { state } = await load();
  if (state.status !== 'running') {
    await syncAlarms(state);
    return;
  }
  const lateBy = Date.now() - state.endTime;
  if (lateBy >= -1500) {
    // Don't ping about a timer that ended long ago (e.g. the browser was closed).
    await complete({ silent: lateBy > 5 * 60 * 1000 });
  } else {
    await syncAlarms(state);
  }
}

/* ---------- commands from the popup ---------- */

const commands = {
  async start() {
    const { settings, state } = await load();
    if (state.status === 'running') return;
    const resuming = state.status === 'paused' && state.remainingMs > 0;
    const ms = resuming ? state.remainingMs : durationMs(settings, state.mode);
    const next = {
      ...state,
      status: 'running',
      durationMs: resuming ? state.durationMs ?? ms : ms,
      endTime: Date.now() + ms,
      remainingMs: null,
    };
    await saveState(next);
    await syncAlarms(next);
  },

  async pause() {
    const { state } = await load();
    if (state.status !== 'running') return;
    const next = {
      ...state,
      status: 'paused',
      remainingMs: Math.max(0, state.endTime - Date.now()),
      endTime: null,
    };
    await saveState(next);
    await syncAlarms(next);
  },

  async reset() {
    const { state } = await load();
    const next = { ...state, status: 'idle', endTime: null, remainingMs: null, durationMs: null };
    await saveState(next);
    await syncAlarms(next);
  },

  async setMode({ mode }) {
    if (!['focus', 'short', 'long'].includes(mode)) return;
    const { state } = await load();
    if (state.status === 'running') return;
    const next = { ...state, mode, status: 'idle', endTime: null, remainingMs: null, durationMs: null };
    await saveState(next);
    await syncAlarms(next);
  },

  async setTask({ task }) {
    const { state } = await load();
    await saveState({ ...state, task: String(task ?? '').slice(0, 80) });
  },

  async reconcile() {
    await reconcile();
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'background' || !commands[msg.type]) return false;
  enqueue(() => commands[msg.type](msg)).then(
    () => sendResponse({ ok: true }),
    (err) => sendResponse({ ok: false, error: String(err) }),
  );
  return true; // keep the channel open for the async response
});

/* ---------- lifecycle ---------- */

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === END_ALARM || alarm.name === TICK_ALARM) enqueue(reconcile);
});

chrome.notifications.onClicked.addListener((id) => chrome.notifications.clear(id));

chrome.runtime.onInstalled.addListener(() =>
  enqueue(async () => {
    const { settings, state } = await load();
    for (const key of Object.keys(LIMITS)) settings[key] = clamp(Number(settings[key]), LIMITS[key]);
    await chrome.storage.local.set({ settings, state });
    await reconcile();
  }),
);

chrome.runtime.onStartup.addListener(() => enqueue(reconcile));

// Also reconcile every time the worker wakes up.
enqueue(reconcile);
