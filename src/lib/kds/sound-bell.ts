/**
 * Web Audio API Acoustic Kitchen Bell Synthesizer
 * Synthesizes restaurant service bells, bump confirmations, and overdue warning chimes
 * directly in-browser with zero external audio assets or CORS network latency.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * High-pitched metallic restaurant service bell ("Ding!")
 * Played when a new order ticket enters the kitchen queue.
 */
export function playNewOrderBell() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Fundamental metallic strike
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1760, now); // A6
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    // High shimmer harmonic
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(3520, now); // A7
    gain2.gain.setValueAtTime(0.18, now);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    // Warm undertone
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "triangle";
    osc3.frequency.setValueAtTime(880, now); // A5
    gain3.gain.setValueAtTime(0.2, now);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc3.connect(gain3);
    gain3.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    osc1.stop(now + 1.25);
    osc2.stop(now + 0.65);
    osc3.stop(now + 0.85);
  } catch {
    // browser audio policies
  }
}

/**
 * Urgent delayed ticket warning pulse
 * Played when a ticket exceeds target preparation time.
 */
export function playOverdueAlertSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Beep 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(659.25, now); // E5
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.2);

    // Beep 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sawtooth";
    osc2.frequency.setValueAtTime(587.33, now + 0.22); // D5
    gain2.gain.setValueAtTime(0.28, now + 0.22);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.42);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.22);
    osc2.stop(now + 0.45);
  } catch {
    // audio policies
  }
}

/**
 * Bump / Item complete pleasant chirp
 */
export function playTicketBumpSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  } catch {
    // audio policies
  }
}
