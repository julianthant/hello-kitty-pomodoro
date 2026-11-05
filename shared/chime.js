// A tiny music-box chime synthesised with the Web Audio API (no audio files needed).

const SEQUENCES = {
  // Focus finished: a happy rising arpeggio.
  focus: [1046.5, 1318.5, 1568.0, 2093.0, 1568.0, 2093.0],
  // Break finished: a gentle "time to get back to it" nudge.
  break: [1568.0, 1318.5, 1568.0, 2093.0],
};

function pluck(ctx, freq, start, volume) {
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume * 0.5), start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.3);

  // Fundamental plus a soft overtone gives the "music box" shimmer.
  for (const [mult, type, level] of [[1, 'sine', 1], [2, 'triangle', 0.25]]) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = level;
    osc.type = type;
    osc.frequency.value = freq * mult;
    osc.connect(g).connect(gain);
    osc.start(start);
    osc.stop(start + 1.4);
  }
}

/** Play a chime. `kind` is 'focus' (work done) or 'break' (break done). Resolves when finished. */
export async function playChime(kind = 'focus', volume = 0.6) {
  const notes = SEQUENCES[kind] ?? SEQUENCES.focus;
  const ctx = new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const t0 = ctx.currentTime + 0.05;
  notes.forEach((freq, i) => pluck(ctx, freq, t0 + i * 0.17, volume));
  const totalMs = (notes.length * 0.17 + 1.5) * 1000;
  await new Promise((resolve) => setTimeout(resolve, totalMs));
  await ctx.close();
}
