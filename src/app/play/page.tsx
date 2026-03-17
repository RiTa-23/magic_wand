"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { FloatingParticles } from "@/components/floating-particles";
import { HeroMagicCircle } from "@/components/hero-magic-circle";

export default function PlayPage() {
  return (
    <main className="relative min-h-svh w-full overflow-hidden bg-background text-foreground">
      {/* Background image layer (match Home's darker ambience) */}
      <div
        className="fixed inset-0 bg-background opacity-30"
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/80"
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 shadow-[inset_0_0_200px_80px_rgba(0,0,0,0.6)]"
        aria-hidden="true"
      />

      <FloatingParticles />

      {/* Center magic circle (same as Home) */}
      <div className="fixed inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div className="w-[460px] h-[460px]">
          <HeroMagicCircle />
        </div>
      </div>

      <div className="relative z-20 min-h-svh px-10">
        {/* Back Link */}
        <Link
          href="/home"
          className="absolute top-10 left-10 group flex items-center gap-2 text-gold-dim transition-colors hover:text-gold-bright"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-xs uppercase tracking-widest text-shadow-glow">
            Back
          </span>
        </Link>

        {/* Title (doesn't affect centering) */}
        <header className="absolute top-10 left-1/2 -translate-x-1/2 text-center">
          <h1 className="text-2xl font-bold tracking-[0.4em] text-gold-bright uppercase">
            Play
          </h1>
          <p className="mt-4 text-sm font-serif tracking-[0.15em] text-gold-dim/60">
            魔法を発動エリア
          </p>
        </header>

        {/* Center content */}
        <div className="min-h-svh flex items-center justify-center">
          <div className="w-full max-w-sm text-center">
            {/* ここに魔法発動時のUIや音声認識状態などが追加される */}
            <div className="px-10 py-6 rounded-full border border-gold-dim/15 bg-stone/20 backdrop-blur-sm shadow-xl">
              <p className="text-lg font-bold tracking-[0.2em] text-gold-bright animate-pulse">
                待機中...
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
