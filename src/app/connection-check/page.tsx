"use client";

import { ChevronLeft, Wifi, RefreshCw } from "lucide-react";
import Link from "next/link";
import { FloatingParticles } from "@/components/floating-particles";

export default function ConnectionPage() {
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
          <span className="text-xs uppercase tracking-widest text-shadow-glow tracking-[0.2em]">
            Back
          </span>
        </Link>

        {/* Content */}
        <header className="mb-20 text-center">
          <Wifi className="w-12 h-12 text-gold mx-auto mb-4 opacity-80" />
          <h1 className="text-2xl font-bold tracking-[0.4em] text-gold-bright uppercase">
            Network
          </h1>
        </header>

        <div className="w-full max-w-sm space-y-4">
          <div className="flex flex-col items-center gap-4 p-10 rounded-full border border-gold-dim/15 bg-stone/20 backdrop-blur-sm shadow-2xl relative">
            <div className="w-4 h-4 rounded-full bg-emerald-400 absolute top-4 right-10 pulse shadow-[0_0_15px_rgba(52,211,153,0.3)] animate-pulse" />
            <span className="text-[10px] font-mono tracking-[0.3em] text-gold-dim/60 uppercase">
              System Ready
            </span>
            <p className="text-lg font-bold tracking-[0.2em] text-gold-bright">
              CONNECTED
            </p>
          </div>

          <button className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-gold-dim/10 bg-stone/30 backdrop-blur-sm text-gold-bright transition-all duration-300 hover:bg-gold/5 active:scale-95">
            <RefreshCw className="w-4 h-4" />
            <span className="text-xs font-bold tracking-[0.1em] uppercase">
              Rescan Network
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}
