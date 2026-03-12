"use client";

import { ChevronLeft, Wifi, RefreshCw } from "lucide-react";
import Link from "next/link";
import { FloatingParticles } from "@/components/floating-particles";

import { useState, useCallback } from "react";

export default function ConnectionPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  const handleRescan = useCallback(() => {
    setIsScanning(true);
    setIsConnected(false);

    // ダミーのネットワークスキャン処理（2秒後に接続成功とする）
    setTimeout(() => {
      setIsScanning(false);
      setIsConnected(true);
    }, 2000);
  }, []);

  return (
    <main className="relative min-h-svh w-full overflow-hidden bg-background">
      <FloatingParticles />

      <div className="relative z-20 flex flex-col min-h-svh items-center justify-center px-10">
        {/* Back Link */}
        <Link
          href="/home"
          className="absolute top-10 left-10 group flex items-center gap-2 text-gold-dim transition-colors hover:text-gold-bright"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-xs uppercase text-shadow-glow tracking-[0.2em]">
            Back
          </span>
        </Link>

        {/* Content */}
        <header className="mb-20 text-center">
          <Wifi
            className={`w-12 h-12 mx-auto mb-4 transition-colors duration-500 ${
              isScanning
                ? "text-gold/40 animate-pulse"
                : isConnected
                  ? "text-gold opacity-80"
                  : "text-red-500/60"
            }`}
          />
          <h1 className="text-2xl font-bold tracking-[0.4em] text-gold-bright uppercase">
            Network
          </h1>
        </header>

        <div className="w-full max-w-sm space-y-4">
          <div className="flex flex-col items-center gap-4 p-10 rounded-full border border-gold-dim/15 bg-stone/20 backdrop-blur-sm shadow-2xl relative transition-all duration-500">
            {/* Status indicator light */}
            <div
              className={`w-4 h-4 rounded-full absolute top-4 right-10 shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-colors duration-500 ${
                isScanning
                  ? "bg-yellow-400 animate-pulse"
                  : isConnected
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-red-500"
              }`}
            />

            <span className="text-[10px] font-mono tracking-[0.3em] text-gold-dim/60 uppercase">
              {isScanning
                ? "Scanning Area..."
                : isConnected
                  ? "System Ready"
                  : "Disconnected"}
            </span>
            <p className="text-lg font-bold tracking-[0.2em] text-gold-bright transition-opacity duration-300">
              {isScanning
                ? "SEARCHING..."
                : isConnected
                  ? "CONNECTED"
                  : "OFFLINE"}
            </p>
          </div>

          <button
            onClick={handleRescan}
            disabled={isScanning}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-gold-dim/10 backdrop-blur-sm transition-all duration-300 active:scale-95 ${
              isScanning
                ? "bg-stone/10 cursor-not-allowed opacity-50"
                : "bg-stone/30 hover:bg-gold/5 text-gold-bright"
            }`}
          >
            <RefreshCw
              className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`}
            />
            <span className="text-xs font-bold tracking-[0.1em] uppercase">
              {isScanning ? "Scanning..." : "Rescan Network"}
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}
