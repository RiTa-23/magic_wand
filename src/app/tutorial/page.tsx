"use client";

import { ChevronLeft, BookOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { FloatingParticles } from "@/components/floating-particles";

export default function TutorialPage() {
  return (
    <main className="relative min-h-svh w-full overflow-hidden bg-background">
      <FloatingParticles />

      <div className="relative z-20 flex flex-col min-h-svh items-center justify-center px-10">
        {/* Back link */}
        <Link
          href="/home"
          className="absolute top-10 left-10 group flex items-center gap-2 text-gold-dim transition-colors hover:text-gold-bright"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-xs uppercase tracking-widest text-shadow-glow">
            Back
          </span>
        </Link>

        <header className="mb-12 text-center">
          <BookOpen className="w-10 h-10 text-gold mx-auto mb-4 opacity-80" />
          <h1 className="text-2xl font-bold tracking-[0.3em] text-gold-bright uppercase">
            Tutorial
          </h1>
        </header>

        <ul className="w-full max-w-sm space-y-8 font-serif leading-relaxed">
          <SimpleStep num="01" text="杖を手に、深呼吸をしてください。" />
          <SimpleStep num="02" text="呪文を唱え、正しい動きを加えます。" />
          <SimpleStep num="03" text="光とともに、魔法が顕現します。" />
        </ul>

        <div className="absolute bottom-20 mt-10 animate-pulse text-gold/60">
          <Sparkles className="w-6 h-6" />
        </div>
      </div>
    </main>
  );
}

function SimpleStep({ num, text }: { num: string; text: string }) {
  return (
    <li className="flex items-start gap-4">
      <span className="text-xl font-bold tracking-[0.2em] text-gold/40 border-b border-gold/20 pb-1">
        {num}
      </span>
      <p className="text-sm font-medium tracking-wide text-foreground/80 mt-1">
        {text}
      </p>
    </li>
  );
}
