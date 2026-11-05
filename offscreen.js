// Offscreen document: lets the service worker play a chime while the popup is closed.
import { playChime } from './shared/chime.js';

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.target === 'offscreen' && msg.type === 'chime') {
    playChime(msg.kind, msg.volume).catch((err) => console.warn('chime failed', err));
  }
});
