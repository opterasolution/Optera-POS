/**
 * Sri Lanka Retail POS - ESC/POS Raw Thermal Printer & Cash Drawer Command Engine
 * 
 * Supports standard thermal printer command protocols (Epson, Citizen, Bixolon, Star, Rongta, Xprinter)
 * and RJ11/RJ12 Cash Drawer solenoid kick pulses.
 */

export const ESCPOS = {
  // Initialization
  INIT: [0x1b, 0x40], // ESC @

  // Text Alignment
  ALIGN_LEFT: [0x1b, 0x61, 0x00],
  ALIGN_CENTER: [0x1b, 0x61, 0x01],
  ALIGN_RIGHT: [0x1b, 0x61, 0x02],

  // Text Styling
  BOLD_ON: [0x1b, 0x45, 0x01],
  BOLD_OFF: [0x1b, 0x45, 0x00],
  DOUBLE_HEIGHT_ON: [0x1b, 0x21, 0x10],
  DOUBLE_WIDTH_ON: [0x1b, 0x21, 0x20],
  DOUBLE_SIZE_ON: [0x1b, 0x21, 0x30],
  NORMAL_TEXT: [0x1b, 0x21, 0x00],
  UNDERLINE_ON: [0x1b, 0x2d, 0x01],
  UNDERLINE_OFF: [0x1b, 0x2d, 0x00],

  // Paper Feeding & Cutting
  FEED_LINE: [0x0a],
  FEED_3_LINES: [0x1b, 0x64, 0x03],
  FEED_5_LINES: [0x1b, 0x64, 0x05],
  CUT_FULL: [0x1d, 0x56, 0x00],       // GS V 0 (Full Cut)
  CUT_PARTIAL: [0x1d, 0x56, 0x01],    // GS V 1 (Partial Cut)

  // Cash Drawer Kick Pulse (ESC p m t1 t2)
  // Pin 2 (standard cash drawer port): ESC p 0 25 250
  DRAWER_KICK_PIN2: [0x1b, 0x70, 0x00, 0x19, 0xfa],
  // Pin 5 (secondary cash drawer port): ESC p 1 25 250
  DRAWER_KICK_PIN5: [0x1b, 0x70, 0x01, 0x19, 0xfa],
};

/**
 * Builds binary ESC/POS cash drawer kick command
 */
export function buildDrawerKickCommand(pin: 0 | 1 = 0, onTimeMs = 50, offTimeMs = 500): Uint8Array {
  // onTime = t1 * 2ms, offTime = t2 * 2ms
  const t1 = Math.min(255, Math.max(1, Math.round(onTimeMs / 2)));
  const t2 = Math.min(255, Math.max(1, Math.round(offTimeMs / 2)));
  return new Uint8Array([0x1b, 0x70, pin, t1, t2]);
}

/**
 * Helper to encode UTF-8 text into printer byte buffer
 */
export function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Simulates or plays cash drawer pop click sound in browser environments
 */
export function playDrawerPopSound() {
  if (typeof window === "undefined") return;
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = "square";
    osc.frequency.setValueAtTime(320, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch {
    // AudioContext might be blocked before first user gesture
  }
}

/**
 * Attempts to kick the cash drawer via WebUSB or Web Serial if configured,
 * otherwise triggers browser notification and sound.
 */
export async function triggerCashDrawerKick(options?: {
  serialPort?: any;
  usbDevice?: any;
  pin?: "PIN2" | "PIN5" | 0 | 1;
  audioFeedback?: boolean;
}): Promise<{ success: boolean; method: string; message: string }> {
  if (options?.audioFeedback !== false) {
    playDrawerPopSound();
  }

  const pinNumber = options?.pin === "PIN5" || options?.pin === 1 ? 1 : 0;
  const kickBytes = buildDrawerKickCommand(pinNumber);

  // If active Web Serial port is available
  if (options?.serialPort && options.serialPort.writable) {
    try {
      const writer = options.serialPort.writable.getWriter();
      await writer.write(kickBytes);
      writer.releaseLock();
      return { success: true, method: "SERIAL", message: "Cash drawer opened via Web Serial." };
    } catch (err: any) {
      console.error("Serial drawer kick error:", err);
    }
  }

  // If active WebUSB printer is paired
  if (options?.usbDevice && options.usbDevice.opened) {
    try {
      await options.usbDevice.transferOut(1, kickBytes);
      return { success: true, method: "USB", message: "Cash drawer opened via WebUSB." };
    } catch (err: any) {
      console.error("WebUSB drawer kick error:", err);
    }
  }

  // Fallback dev/counter event
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("slpos_cash_drawer_kicked", { detail: { timestamp: new Date() } }));
  }

  return {
    success: true,
    method: "SIMULATED",
    message: "Cash drawer kick command triggered (audio & visual alert emitted).",
  };
}
