"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { FloatingParticles } from "@/components/floating-particles";

export default function PlayPage() {
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
          <span className="text-xs uppercase tracking-widest text-shadow-glow">
            Back
          </span>
        </Link>

        {/* Content */}
        <header className="mb-20 text-center">
          <h1 className="text-2xl font-bold tracking-[0.4em] text-gold-bright uppercase">
            Play
          </h1>
          <p className="mt-4 text-sm font-serif tracking-[0.15em] text-gold-dim/60">
            魔法を発動エリア
          </p>
        </header>

        <div className="w-full max-w-sm space-y-4 text-center">
          {/* ここに魔法発動時のUIや音声認識状態などが追加される */}
          <div className="p-10 rounded-full border border-gold-dim/15 bg-stone/20 backdrop-blur-sm shadow-xl">
            <p className="text-lg font-bold tracking-[0.2em] text-gold-bright animate-pulse">
              待機中...
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
