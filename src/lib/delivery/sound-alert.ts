/**
 * Sri Lanka POS - Delivery Partner Audio Alert Synthesizer
 * 
 * Uses Web Audio API to synthesize acoustic order chimes for incoming PickMe Food,
 * PickMe Flash, and Uber Eats Sri Lanka delivery orders without requiring external MP3 assets.
 */

let audioCtx: AudioContext | null = null;
let repeatingTimer: ReturnType<typeof setInterval> | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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
 * Plays a double-tone cheerful acoustic chime (880Hz -> 1320Hz)
 * modeled after delivery tablet arrival chimes.
 */
export function playDeliveryOrderChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Tone 1: High A (880Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: Higher E (1318.5Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1318.51, now + 0.18);
    gain2.gain.setValueAtTime(0, now + 0.18);
    gain2.gain.linearRampToValueAtTime(0.35, now + 0.23);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.65);

    // Tone 3: Harmonic High A (1760Hz) shimmer
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "triangle";
    osc3.frequency.setValueAtTime(1760, now + 0.35);
    gain3.gain.setValueAtTime(0, now + 0.35);
    gain3.gain.linearRampToValueAtTime(0.2, now + 0.4);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.35);
    osc3.stop(now + 0.85);
  } catch (err) {
    console.warn("Could not play delivery chime:", err);
  }
}

/**
 * Starts repeating delivery chime every `intervalMs` until stopped
 */
export function startRepeatingDeliveryAlert(intervalMs = 4000): void {
  stopRepeatingDeliveryAlert();
  playDeliveryOrderChime();
  repeatingTimer = setInterval(() => {
    playDeliveryOrderChime();
  }, intervalMs);
}

/**
 * Stops repeating delivery chime
 */
export function stopRepeatingDeliveryAlert(): void {
  if (repeatingTimer) {
    clearInterval(repeatingTimer);
    repeatingTimer = null;
  }
}
