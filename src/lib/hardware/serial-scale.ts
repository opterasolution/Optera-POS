/**
 * Sri Lanka Retail POS - Web Serial Weighing Scale Driver & Hardware Engine
 * 
 * Comprehensive driver supporting RS232 / USB digital checkout scales standard
 * across Sri Lankan supermarkets (Keells, Cargills, Arpico, Laughs, local delis):
 * - CAS AP-1 / PD-II
 * - Mettler Toledo 8217 / PS60
 * - DIGI DS-788 / SM-100
 * - Rongta RLS 1000 / 1100 series
 * - Avery Berkel 6700 series
 * - Generic Continuous ASCII scales
 * 
 * Features:
 * - W3C Web Serial API (navigator.serial)
 * - Auto-reconnection to previously authorized COM ports
 * - Two-way commands: Tare (T), Zero (Z), Poll (W)
 * - Built-in High-Fidelity Scale Simulator for testing without physical hardware
 */

export type ScaleModel =
  | "GENERIC_CONTINUOUS"
  | "CAS_PD_II"
  | "METTLER_TOLEDO"
  | "DIGI_DS_788"
  | "RONGTA"
  | "AVERY_BERKEL";

export interface ScaleReading {
  weightKg: number;
  weightGrams: number;
  isStable: boolean;
  unit: "kg" | "g" | "lb";
  raw: string;
  grossWeightKg?: number;
  tareWeightKg?: number;
  timestamp: number;
}

export interface ScaleConnectionConfig {
  scaleModel?: ScaleModel;
  baudRate?: number;    // default 9600
  dataBits?: 7 | 8;     // default 8
  stopBits?: 1 | 2;     // default 1
  parity?: "none" | "even" | "odd"; // default "none"
  flowControl?: "none" | "hardware";
  autoPollIntervalMs?: number; // e.g. 250ms for polling scales
}

export class WebSerialScaleDriver {
  private port: any | null = null;
  private reader: any | null = null;
  private writer: any | null = null;
  private isReading = false;
  private config: ScaleConnectionConfig = {
    scaleModel: "CAS_PD_II",
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
  };
  private onReadingCallback?: (reading: ScaleReading) => void;
  private onErrorCallback?: (err: Error) => void;
  private pollTimer: any = null;
  private lastReading: ScaleReading | null = null;

  public static isSupported(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  public isSupported(): boolean {
    return WebSerialScaleDriver.isSupported();
  }

  public isConnected(): boolean {
    return this.port !== null && this.isReading;
  }

  public getLastReading(): ScaleReading | null {
    return this.lastReading;
  }

  /**
   * Prompts the user to pick an authorized COM/USB serial port and opens it.
   */
  public async connect(
    config: ScaleConnectionConfig = {},
    onReading: (reading: ScaleReading) => void,
    onError?: (err: Error) => void
  ): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error("Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
    }

    this.config = { ...this.config, ...config };
    this.onReadingCallback = onReading;
    this.onErrorCallback = onError;

    try {
      // Prompt user to select port
      this.port = await (navigator as any).serial.requestPort();
      await this.openPort();
      return true;
    } catch (err: any) {
      this.port = null;
      this.isReading = false;
      if (this.onErrorCallback) this.onErrorCallback(err);
      throw err;
    }
  }

  /**
   * Attempts to auto-reconnect to a previously granted serial port without showing the user prompt.
   */
  public async autoReconnect(
    config: ScaleConnectionConfig = {},
    onReading: (reading: ScaleReading) => void,
    onError?: (err: Error) => void
  ): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      const ports = await (navigator as any).serial.getPorts();
      if (!ports || ports.length === 0) return false;

      // Select the first permitted port
      this.port = ports[0];
      this.config = { ...this.config, ...config };
      this.onReadingCallback = onReading;
      this.onErrorCallback = onError;

      await this.openPort();
      return true;
    } catch {
      this.port = null;
      return false;
    }
  }

  private async openPort() {
    await this.port.open({
      baudRate: this.config.baudRate || 9600,
      dataBits: this.config.dataBits || 8,
      stopBits: this.config.stopBits || 1,
      parity: this.config.parity || "none",
    });

    this.isReading = true;
    this.startReadLoop();

    // Start poll loop if polling interval configured or scale model requires active polling
    if (this.config.autoPollIntervalMs && this.config.autoPollIntervalMs > 0) {
      this.startPolling(this.config.autoPollIntervalMs);
    } else if (this.config.scaleModel === "METTLER_TOLEDO" || this.config.scaleModel === "AVERY_BERKEL") {
      this.startPolling(300);
    }
  }

  /**
   * Sends raw string/command to the scale via serial output stream.
   */
  public async sendCommand(cmd: string): Promise<void> {
    if (!this.port || !this.port.writable) return;
    try {
      const encoder = new TextEncoder();
      const writer = this.port.writable.getWriter();
      await writer.write(encoder.encode(cmd));
      writer.releaseLock();
    } catch (err) {
      console.warn("Failed to send command to scale:", err);
    }
  }

  /**
   * Sends Tare command to the physical scale.
   */
  public async sendTare(): Promise<void> {
    switch (this.config.scaleModel) {
      case "CAS_PD_II":
        await this.sendCommand("T\r\n");
        break;
      case "METTLER_TOLEDO":
        await this.sendCommand("T\r");
        break;
      case "DIGI_DS_788":
        await this.sendCommand("\x02T\x03\r\n");
        break;
      default:
        await this.sendCommand("T\r\n");
        break;
    }
  }

  /**
   * Sends Zero command to the physical scale.
   */
  public async sendZero(): Promise<void> {
    switch (this.config.scaleModel) {
      case "CAS_PD_II":
        await this.sendCommand("Z\r\n");
        break;
      case "METTLER_TOLEDO":
        await this.sendCommand("Z\r");
        break;
      case "DIGI_DS_788":
        await this.sendCommand("\x02Z\x03\r\n");
        break;
      default:
        await this.sendCommand("Z\r\n");
        break;
    }
  }

  /**
   * Sends Poll / Weight Query command to the scale.
   */
  public async pollWeight(): Promise<void> {
    switch (this.config.scaleModel) {
      case "CAS_PD_II":
        await this.sendCommand("W\r\n");
        break;
      case "METTLER_TOLEDO":
        await this.sendCommand("W\r");
        break;
      case "AVERY_BERKEL":
        await this.sendCommand("W\r");
        break;
      case "DIGI_DS_788":
        await this.sendCommand("\x05"); // ENQ byte
        break;
      default:
        await this.sendCommand("W\r\n");
        break;
    }
  }

  private startPolling(intervalMs: number) {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      if (this.isReading && this.port) {
        this.pollWeight().catch(() => {});
      }
    }, intervalMs);
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Closes the active serial port and terminates reading.
   */
  public async disconnect(): Promise<void> {
    this.stopPolling();
    this.isReading = false;
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (err: any) {
      console.error("Error closing scale serial port:", err);
    }
  }

  /**
   * Continuous stream reader loop.
   */
  private async startReadLoop() {
    if (!this.port || !this.port.readable) return;
    const textDecoder = new TextDecoderStream();
    this.port.readable.pipeTo(textDecoder.writable).catch(() => {});
    const reader = textDecoder.readable.getReader();
    this.reader = reader;

    let buffer = "";

    try {
      while (this.isReading) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split(/[\r\n]+/);
          // Keep the last partial segment in buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const parsed = this.parseScaleProtocol(line, this.config.scaleModel);
            if (parsed) {
              this.lastReading = parsed;
              if (this.onReadingCallback) {
                this.onReadingCallback(parsed);
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (this.isReading && this.onErrorCallback) {
        this.onErrorCallback(err);
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {}
    }
  }

  /**
   * Parses scale protocol string formats depending on scale model.
   */
  public parseScaleProtocol(rawLine: string, model: ScaleModel = "GENERIC_CONTINUOUS"): ScaleReading | null {
    const trimmed = rawLine.trim();
    if (!trimmed) return null;

    let isStable = true;
    let weightKg = 0;
    let unit: "kg" | "g" | "lb" = "kg";

    // CAS AP-1 / PD-II format: "ST,GS,+  0.450kg" or "US,GS,+  0.450kg"
    if (model === "CAS_PD_II" || trimmed.startsWith("ST,") || trimmed.startsWith("US,")) {
      if (trimmed.startsWith("US") || trimmed.includes(",NT,US") || trimmed.includes("UNSTABLE")) {
        isStable = false;
      }
      const match = trimmed.match(/([+-]?\s*\d+\.?\d*)/);
      if (match) {
        weightKg = parseFloat(match[1].replace(/\s+/g, ""));
      }
    }
    // Mettler Toledo 8217 / PS60 format: "S 0.450 kg" (Stable) or "D 0.450 kg" (Dynamic)
    else if (model === "METTLER_TOLEDO" || /^[SD]\s+/.test(trimmed)) {
      if (trimmed.startsWith("D")) isStable = false;
      const match = trimmed.match(/([+-]?\d+\.?\d*)/);
      if (match) weightKg = parseFloat(match[1]);
    }
    // Generic continuous / Rongta / Digi
    else {
      if (trimmed.includes("US") || trimmed.includes("MOT") || trimmed.includes("UNSTABLE")) {
        isStable = false;
      }
      const match = trimmed.match(/([+-]?\d+\.?\d*)/);
      if (match) {
        weightKg = parseFloat(match[1]);
      } else {
        return null;
      }
    }

    if (isNaN(weightKg)) return null;

    // Detect unit
    if (/g\b/i.test(trimmed) && !/kg/i.test(trimmed)) {
      unit = "g";
      weightKg = weightKg / 1000;
    } else if (/lb/i.test(trimmed)) {
      unit = "lb";
      weightKg = weightKg * 0.45359237;
    }

    weightKg = parseFloat(weightKg.toFixed(3));
    const weightGrams = Math.round(weightKg * 1000);

    return {
      weightKg,
      weightGrams,
      isStable,
      unit,
      raw: trimmed,
      timestamp: Date.now(),
    };
  }
}

/**
 * High-Fidelity Digital Scale Simulator
 * 
 * Enables supermarket cashiers and testing teams to simulate live electronic scale behavior
 * when physical USB/RS232 scale is not attached.
 */
export class ScaleSimulator {
  private targetWeightKg = 0;
  private currentWeightKg = 0;
  private tareGrams = 0;
  private isStable = true;
  private jitterTimer: any = null;
  private onReadingCallback?: (reading: ScaleReading) => void;

  constructor(onReading?: (reading: ScaleReading) => void) {
    this.onReadingCallback = onReading;
  }

  public setCallback(onReading: (reading: ScaleReading) => void) {
    this.onReadingCallback = onReading;
  }

  /**
   * Places an item of specified weight onto the simulated scale platter.
   * Simulates realistic weight sensor settling (brief motion before stable lock).
   */
  public placeWeight(weightKg: number) {
    this.targetWeightKg = Math.max(0, parseFloat(weightKg.toFixed(3)));
    this.isStable = false;

    if (this.jitterTimer) clearTimeout(this.jitterTimer);

    // Immediate jitter reading
    this.currentWeightKg = Math.max(0, parseFloat((this.targetWeightKg * (0.92 + Math.random() * 0.12)).toFixed(3)));
    this.emit();

    // Settle after 350ms
    this.jitterTimer = setTimeout(() => {
      this.currentWeightKg = this.targetWeightKg;
      this.isStable = true;
      this.emit();
    }, 350);
  }

  public setTare(tareGrams: number) {
    this.tareGrams = Math.max(0, tareGrams);
    this.emit();
  }

  public zero() {
    this.targetWeightKg = 0;
    this.currentWeightKg = 0;
    this.tareGrams = 0;
    this.isStable = true;
    this.emit();
  }

  public getNetWeightKg(): number {
    const rawNet = this.currentWeightKg - (this.tareGrams / 1000);
    return Math.max(0, parseFloat(rawNet.toFixed(3)));
  }

  private emit() {
    if (!this.onReadingCallback) return;
    const net = this.getNetWeightKg();
    this.onReadingCallback({
      weightKg: net,
      weightGrams: Math.round(net * 1000),
      grossWeightKg: this.currentWeightKg,
      tareWeightKg: parseFloat((this.tareGrams / 1000).toFixed(3)),
      isStable: this.isStable,
      unit: "kg",
      raw: `SIM:Gross=${this.currentWeightKg.toFixed(3)}kg,Tare=${this.tareGrams}g,Net=${net.toFixed(3)}kg,Stable=${this.isStable}`,
      timestamp: Date.now(),
    });
  }
}

// Global singleton instance for easy import across UI components
export const serialScale = new WebSerialScaleDriver();
