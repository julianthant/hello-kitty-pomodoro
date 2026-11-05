import {
  DEFAULT_SETTINGS,
  DEFAULT_STATE,
  LIMITS,
  LONG_EVERY,
  clamp,
  dayKey,
  durationMs,
  formatClock,
} from '../shared/constants.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const SVG_NS = 'http://www.w3.org/2000/svg';
const MODES = ['focus', 'short', 'long'];

const RING_R = 106;
const RING_C = 2 * Math.PI * RING_R;

let settings = { ...DEFAULT_SETTINGS };
let state = { ...DEFAULT_STATE };
let daily = null;
let celebrating = false;
let nudged = false;
let lastKey = '';
let lastClock = '';

/* ---------- messaging + storage ---------- */

const send = (type, extra = {}) =>
  chrome.runtime.sendMessage({ target: 'background', type, ...extra }).catch(() => {});

async function refresh() {
  const data = await chrome.storage.local.get(['settings', 'state', 'daily']);
  settings = { ...DEFAULT_SETTINGS, ...data.settings };
  state = { ...DEFAULT_STATE, ...data.state };
  daily = data.daily ?? null;
}

const saveSettings = () => chrome.storage.local.set({ settings });

/* ---------- derived values ---------- */

function view() {
  const idleTotal = durationMs(settings, state.mode);
  const total = state.status === 'idle' ? idleTotal : state.durationMs ?? idleTotal;
  let remaining = total;
  if (state.status === 'running') remaining = Math.max(0, state.endTime - Date.now());
  else if (state.status === 'paused') remaining = state.remainingMs ?? total;
  return { total, remaining };
}

function face() {
  if (celebrating) return 'happy';
  if (state.status === 'paused') return 'sleepy';
  if (state.status === 'running' && state.mode !== 'focus') return 'happy';
  return 'idle';
}

function caption() {
  if (celebrating) return 'session complete';
  const onBreak = state.mode !== 'focus';
  if (state.status === 'running') return onBreak ? 'on a break' : 'focusing';
  if (state.status === 'paused') return 'paused';
  return onBreak ? 'time for a break' : 'ready to focus';
}

/* ---------- rendering ---------- */

function render() {
  const key = `${state.mode}|${state.status}`;
  const changed = key !== lastKey;
  lastKey = key;
  nudged = false;

  const body = document.body;
  body.dataset.mode = state.mode;
  body.dataset.status = state.status;
  body.dataset.face = face();

  MODES.forEach((m, i) => {
    const tab = $(`.tab[data-mode="${m}"]`);
    const selected = m === state.mode;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected) $('#tabs').style.setProperty('--i', i);
  });

  $('#main-label').textContent =
    state.status === 'running' ? 'Pause' : state.status === 'paused' ? 'Resume' : 'Start';
  $('#caption').textContent = caption();

  if (changed) {
    // Jump the ring to its new position instead of sweeping across the card.
    const ring = $('.ring');
    ring.classList.add('snap');
    requestAnimationFrame(() => requestAnimationFrame(() => ring.classList.remove('snap')));
  }

  renderDots();
  renderToday();
  const task = $('#task');
  if (document.activeElement !== task && task.value !== state.task) task.value = state.task;
  renderSettings();
  tick();
}

function renderDots() {
  const box = $('#dots');
  const done = state.mode === 'long' ? LONG_EVERY : Math.min(state.cycle, LONG_EVERY);
  const sig = String(done);
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.replaceChildren(
    ...Array.from({ length: LONG_EVERY }, (_, i) => {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      if (i < done) svg.classList.add('done');
      const use = document.createElementNS(SVG_NS, 'use');
      use.setAttribute('href', '#i-heart');
      svg.append(use);
      return svg;
    }),
  );
}

function renderToday() {
  const n = daily?.date === dayKey() ? daily.count : 0;
  $('#today').textContent = n
    ? `${n} ${n === 1 ? 'session' : 'sessions'} today`
    : 'no sessions yet today';
}

function tick() {
  const { total, remaining } = view();
  const clock = formatClock(remaining);
  if (clock !== lastClock) {
    lastClock = clock;
    $('#time').textContent = clock;
    document.title = state.status === 'idle' ? 'Kitty Pomodoro' : `${clock} · Kitty Pomodoro`;
  }

  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0;
  const bar = $('#ring-bar');
  bar.style.strokeDasharray = `${RING_C}`;
  bar.style.strokeDashoffset = `${RING_C * (1 - progress)}`;
  bar.style.opacity = progress < 0.002 ? '0' : '1';
  $('#ring-knob').style.transform = `rotate(${progress * 360}deg)`;

  // If the worker hasn't noticed the timer ended yet, give it a nudge.
  if (state.status === 'running' && remaining <= 0 && !nudged) {
    nudged = true;
    send('reconcile');
  }
}

/* ---------- settings ---------- */

function renderSettings() {
  $$('.stepper').forEach((el) => {
    const key = el.dataset.key;
    const [min, max] = LIMITS[key];
    if (!el.firstChild) {
      el.innerHTML = `
        <button type="button" data-d="-1" aria-label="Decrease">−</button>
        <output></output>
        <button type="button" data-d="1" aria-label="Increase">+</button>`;
      el.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        settings[key] = clamp(settings[key] + Number(btn.dataset.d), LIMITS[key]);
        saveSettings();
        render();
      });
    }
    $('output', el).innerHTML = `${settings[key]} <small>min</small>`;
    $('[data-d="-1"]', el).disabled = settings[key] <= min;
    $('[data-d="1"]', el).disabled = settings[key] >= max;
  });
  $('#sound').checked = settings.sound;
}

function openSettings() {
  const panel = $('#panel-settings');
  panel.inert = false;
  panel.classList.add('open');
  $('#btn-back').focus({ preventScroll: true });
}

function closeSettings() {
  const panel = $('#panel-settings');
  panel.classList.remove('open');
  panel.inert = true;
  $('#btn-settings').focus({ preventScroll: true });
}

/* ---------- finishing a session ---------- */

// A short, earned moment: the mascot looks happy and hops twice.
function celebrate() {
  celebrating = true;
  document.body.classList.add('celebrate');
  render();
  setTimeout(() => {
    celebrating = false;
    document.body.classList.remove('celebrate');
    render();
  }, 2600);
}

/* ---------- events ---------- */

function wire() {
  $('#btn-main').addEventListener('click', () => send(state.status === 'running' ? 'pause' : 'start'));
  $('#btn-reset').addEventListener('click', () => send('reset'));

  $('#tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab && state.status !== 'running') send('setMode', { mode: tab.dataset.mode });
  });
  $('#tabs').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || state.status === 'running') return;
    const next = MODES[MODES.indexOf(state.mode) + (e.key === 'ArrowRight' ? 1 : -1)];
    if (next) {
      send('setMode', { mode: next });
      $(`.tab[data-mode="${next}"]`).focus();
    }
  });

  let taskTimer;
  $('#task').addEventListener('input', (e) => {
    clearTimeout(taskTimer);
    taskTimer = setTimeout(() => send('setTask', { task: e.target.value }), 250);
  });
  $('#task').addEventListener('keydown', (e) => e.key === 'Enter' && e.target.blur());

  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-back').addEventListener('click', closeSettings);
  $('#sound').addEventListener('change', (e) => {
    settings.sound = e.target.checked;
    saveSettings();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSettings();
    const typing = ['INPUT', 'BUTTON'].includes(document.activeElement?.tagName);
    if (e.code === 'Space' && !typing) {
      e.preventDefault();
      $('#btn-main').click();
    }
  });
}

/* ---------- boot ---------- */

chrome.storage.onChanged.addListener(async (_changes, area) => {
  if (area !== 'local') return;
  const before = state.lastCompletedAt;
  await refresh();
  if (state.lastCompletedAt && state.lastCompletedAt !== before) celebrate();
  else render();
});

(async function init() {
  await refresh();
  wire();
  render();
  if (Date.now() - state.lastCompletedAt < 6000) celebrate();
  setInterval(tick, 250);
})();
