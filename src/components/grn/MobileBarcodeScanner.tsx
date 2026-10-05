"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  CameraOff,
  Flashlight,
  FlashlightOff,
  RotateCcw,
  Barcode as BarcodeIcon,
  Search,
  CheckCircle2,
  AlertCircle,
  Zap,
  Volume2,
  VolumeX,
} from "lucide-react";
import { scannerAudio } from "@/lib/scanner-audio";

interface MobileBarcodeScannerProps {
  onScan: (barcode: string) => void;
  active?: boolean;
  debounceMs?: number;
  showManualInput?: boolean;
  className?: string;
  placeholder?: string;
}

export default function MobileBarcodeScanner({
  onScan,
  active = true,
  debounceMs = 1400,
  showManualInput = true,
  className = "",
  placeholder = "Scan barcode or enter SKU...",
}: MobileBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [lastScanTimestamp, setLastScanTimestamp] = useState<number>(0);
  const [manualInput, setManualInput] = useState("");
  const [laserFlash, setLaserFlash] = useState(false);

  // Hardware barcode gun buffer
  const hardwareBufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  // Trigger scan with debounce & audio
  const handleBarcodeDetected = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      const now = Date.now();
      if (trimmed === lastScannedCode && now - lastScanTimestamp < debounceMs) {
        // Debounced duplicate scan
        return;
      }

      setLastScannedCode(trimmed);
      setLastScanTimestamp(now);

      // Visual flash
      setLaserFlash(true);
      setTimeout(() => setLaserFlash(false), 300);

      // Sound & vibration
      if (soundEnabled) {
        scannerAudio.playSuccessBeep();
      }

      onScan(trimmed);
    },
    [lastScannedCode, lastScanTimestamp, debounceMs, soundEnabled, onScan]
  );

  // Camera start logic
  const startCamera = async () => {
    try {
      setCameraError(null);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError("Camera API not supported in this browser. Use manual entry or hardware scanner.");
        return;
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      // Check for torch capability
      const track = newStream.getVideoTracks()[0];
      const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.torch) {
        setHasTorch(true);
      }
    } catch (err: any) {
      console.warn("Camera start failed:", err);
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access in browser settings."
          : "Could not access device camera. Hardware scanner is still active."
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
    setTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track && hasTorch) {
      const nextState = !torchOn;
      try {
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch (e) {
        console.warn("Torch toggle error:", e);
      }
    }
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Initialize or stop camera based on active prop
  useEffect(() => {
    if (active) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [active, facingMode]);

  // Frame detection loop with native BarcodeDetector
  useEffect(() => {
    let animId: number;
    let isDetecting = false;

    // Check BarcodeDetector support
    const hasBarcodeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;
    let detector: any = null;

    if (hasBarcodeDetector) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: ["code_128", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e", "code_39"],
        });
      } catch (e) {
        console.warn("BarcodeDetector init failed:", e);
      }
    }

    const scanFrame = async () => {
      if (!cameraActive || !videoRef.current || !detector || isDetecting) {
        animId = requestAnimationFrame(scanFrame);
        return;
      }

      if (videoRef.current.readyState >= 2) {
        isDetecting = true;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue) {
              handleBarcodeDetected(rawValue);
            }
          }
        } catch {
          // Frame decode error or non-detected, ignore
        } finally {
          isDetecting = false;
        }
      }

      animId = requestAnimationFrame(scanFrame);
    };

    if (cameraActive && detector) {
      animId = requestAnimationFrame(scanFrame);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [cameraActive, handleBarcodeDetected]);

  // Hardware barcode scanner wedge listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const now = Date.now();
      // Hardware scanners typically send key events with < 30ms interval
      if (now - lastKeyTimeRef.current > 100) {
        hardwareBufferRef.current = "";
      }
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        if (hardwareBufferRef.current.length >= 3) {
          handleBarcodeDetected(hardwareBufferRef.current);
          hardwareBufferRef.current = "";
          e.preventDefault();
        }
      } else if (e.key.length === 1) {
        hardwareBufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleBarcodeDetected]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleBarcodeDetected(manualInput.trim());
      setManualInput("");
    }
  };

  return (
    <div className={`flex flex-col bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-xl ${className}`}>
      {/* Scanner Viewport */}
      <div className="relative aspect-video sm:aspect-21/9 bg-black overflow-hidden flex items-center justify-center">
        {cameraActive ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Target Reticle Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
              <div
                className={`relative w-4/5 max-w-sm h-36 border-2 rounded-2xl transition-all duration-200 ${
                  laserFlash
                    ? "border-emerald-400 bg-emerald-500/20 shadow-lg shadow-emerald-500/40"
                    : "border-blue-400/80 shadow-lg shadow-blue-500/20"
                }`}
              >
                {/* Corner Accents */}
                <span className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-emerald-400 rounded-tl-sm" />
                <span className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-emerald-400 rounded-tr-sm" />
                <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-emerald-400 rounded-bl-sm" />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-emerald-400 rounded-br-sm" />

                {/* Animated Laser Sweep Line */}
                <div
                  className={`absolute left-0 right-0 h-0.5 shadow-sm transition ${
                    laserFlash
                      ? "bg-emerald-300 shadow-emerald-400"
                      : "bg-rose-500/90 shadow-rose-500 animate-pulse"
                  }`}
                  style={{ top: "50%" }}
                />
              </div>
            </div>

            {/* In-viewport Controls */}
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2 rounded-xl backdrop-blur-md transition ${
                    torchOn
                      ? "bg-amber-500 text-white shadow-lg shadow-amber-500/40"
                      : "bg-black/50 text-white hover:bg-black/70"
                  }`}
                  title={torchOn ? "Turn off flashlight" : "Turn on flashlight"}
                >
                  {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                </button>
              )}

              <button
                type="button"
                onClick={toggleCameraFacing}
                className="p-2 rounded-xl bg-black/50 text-white hover:bg-black/70 backdrop-blur-md transition"
                title="Flip Camera"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-xl backdrop-blur-md transition ${
                  soundEnabled ? "bg-black/50 text-white" : "bg-rose-500/80 text-white"
                }`}
                title={soundEnabled ? "Mute scan beep" : "Unmute scan beep"}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={stopCamera}
                className="p-2 rounded-xl bg-black/50 text-white hover:bg-rose-600 backdrop-blur-md transition"
                title="Pause Camera"
              >
                <CameraOff className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom status indicator inside video */}
            <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-none text-[11px] font-bold text-white drop-shadow">
              <span className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Live Barcode Reticle</span>
              </span>
              {lastScannedCode && (
                <span className="bg-emerald-600/90 px-2.5 py-1 rounded-full backdrop-blur-xs font-mono">
                  Scanned: {lastScannedCode}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-200">Camera Viewfinder Paused</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                {cameraError || "Tap Start Camera to scan barcodes using your smartphone camera."}
              </p>
            </div>
            <button
              type="button"
              onClick={startCamera}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 mx-auto shadow-sm"
            >
              <Camera className="w-4 h-4" />
              <span>Start Camera Scanner</span>
            </button>
          </div>
        )}
      </div>

      {/* Hardware Scanner & Manual Entry Bar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <div className="flex items-center gap-1.5 font-medium text-emerald-400">
            <Zap className="w-3.5 h-3.5" />
            <span>Hardware Laser Gun Ready</span>
          </div>
          <span className="text-[11px]">Point physical scanner & pull trigger</span>
        </div>

        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <BarcodeIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Scan Item</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
