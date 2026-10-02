/**
 * Sri Lanka Retail POS - Web Serial Weighing Scale Driver
 * 
 * Supports standard RS232 / USB retail counter scales (CAS PD-II / AP-1, Toledo, Avery Berkel, Dibal).
 * Communicates directly with serial COM ports via the W3C Web Serial API (navigator.serial).
 */

export interface ScaleReading {
  weightKg: number;
  weightGrams: number;
  isStable: boolean;
  unit: "kg" | "g" | "lb";
  raw: string;
}

export interface ScaleConnectionConfig {
  baudRate?: number;    // default 9600
  dataBits?: 7 | 8;     // default 8
  stopBits?: 1 | 2;     // default 1
  parity?: "none" | "even" | "odd"; // default "none"
}

export class WebSerialScaleDriver {
  private port: any | null = null;
  private reader: any | null = null;
  private isReading = false;
  private onReadingCallback?: (reading: ScaleReading) => void;
  private onErrorCallback?: (err: Error) => void;

  public static isSupported(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  public isSupported(): boolean {
    return WebSerialScaleDriver.isSupported();
  }

  public isConnected(): boolean {
    return this.port !== null && this.isReading;
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

    this.onReadingCallback = onReading;
    this.onErrorCallback = onError;

    try {
      // Prompt user to select port
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({
        baudRate: config.baudRate || 9600,
        dataBits: config.dataBits || 8,
        stopBits: config.stopBits || 1,
        parity: config.parity || "none",
      });

      this.isReading = true;
      this.startReadLoop();
      return true;
    } catch (err: any) {
      this.port = null;
      this.isReading = false;
      if (this.onErrorCallback) this.onErrorCallback(err);
      throw err;
    }
  }

  /**
   * Closes the active serial port and terminates reading.
   */
  public async disconnect(): Promise<void> {
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
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
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
            const parsed = this.parseScaleProtocol(line);
            if (parsed && this.onReadingCallback) {
              this.onReadingCallback(parsed);
            }
          }
        }
      }
    } catch (err: any) {
      if (this.isReading && this.onErrorCallback) {
        this.onErrorCallback(err);
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parses standard scale protocol string formats.
   * Format examples:
   * 1. CAS PD-II: "ST,GS,+00.450kg" or "US,GS,+00.450kg"
   * 2. Toledo: " 0.450 kg " or "0.450"
   * 3. NCI general: "  0.450KG"
   */
  public parseScaleProtocol(rawLine: string): ScaleReading | null {
    const trimmed = rawLine.trim();
    if (!trimmed) return null;

    let isStable = true;
    if (trimmed.startsWith("US") || trimmed.includes("UNSTABLE")) {
      isStable = false;
    }

    // Match floating point number: e.g. 0.450 or +00.450
    const match = trimmed.match(/([+-]?\d+\.?\d*)/);
    if (!match) return null;

    const val = parseFloat(match[1]);
    if (isNaN(val)) return null;

    // Detect unit
    let unit: "kg" | "g" | "lb" = "kg";
    if (/g\b/i.test(trimmed) && !/kg/i.test(trimmed)) {
      unit = "g";
    } else if (/lb/i.test(trimmed)) {
      unit = "lb";
    }

    const weightKg = unit === "g" ? val / 1000 : unit === "lb" ? val * 0.453592 : val;
    const weightGrams = Math.round(weightKg * 1000);

    return {
      weightKg: parseFloat(weightKg.toFixed(3)),
      weightGrams,
      isStable,
      unit,
      raw: trimmed,
    };
  }
}

// Global singleton instance for easy import across UI components
export const serialScale = new WebSerialScaleDriver();
