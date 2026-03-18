"use client";

import { ChevronLeft, ScrollText } from "lucide-react";
import Link from "next/link";
import { FloatingParticles } from "@/components/floating-particles";
import { SPELL_DICTIONARY } from "@/features/voice/lib/spell-matcher";

export default function SettingsPage() {
  return (
    <main className="relative h-svh w-full overflow-hidden overscroll-none bg-[color:var(--background)] text-[color:var(--foreground)]">
      {/* Background layers (match Home/Tutorial ambience) */}
      <div
        className="fixed inset-0"
        style={{ background: "var(--background)", opacity: 0.3 }}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.15), rgba(0,0,0,0.35))",
        }}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 shadow-[inset_0_0_200px_80px_rgba(0,0,0,0.6)]"
        aria-hidden="true"
      />

      <FloatingParticles />

      <div className="relative z-20 h-full overflow-hidden px-6 sm:px-10 flex flex-col">
        {/* Top area */}
        <div className="relative pt-8 sm:pt-10 flex-none">
          {/* Back link (match Tutorial style) */}
          <Link
            href="/home"
            className="absolute left-0 top-8 sm:top-10 group flex items-center gap-2 text-[color:var(--gold-dim)] transition-colors hover:text-[color:var(--gold-bright)]"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-xs uppercase tracking-widest text-shadow-glow">
              Back
            </span>
          </Link>

          {/* Title (top center) */}
          <header className="text-center">
            <ScrollText className="w-9 h-9 sm:w-10 sm:h-10 mx-auto mb-2 sm:mb-3 text-[color:var(--gold)] opacity-80" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-[0.4em] text-[color:var(--gold-bright)] uppercase">
              Spells
            </h1>
            <p className="mt-2 text-xs tracking-[0.22em] text-[color:var(--gold-dim)]/80">
              {"呪文一覧"}
            </p>
          </header>
        </div>

        {/* Center area */}
        <div className="flex-1 min-h-0 flex items-center justify-center py-6 sm:py-10">
          <div className="w-full max-w-4xl h-full min-h-0">
            <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-[color:var(--gold)]/15 bg-black/20 backdrop-blur-sm">
              <div className="h-full overflow-auto p-5 sm:p-8">
                <ul className="space-y-4">
                  {SPELL_DICTIONARY.map((spell) => (
                    <li
                      key={spell.id}
                      className="rounded-xl border border-[color:var(--gold)]/10 bg-stone/20 px-5 py-4"
                    >
                      <div className="flex items-start justify-between gap-6">
                        <div>
                          <div className="text-base sm:text-lg font-bold tracking-[0.18em] text-[color:var(--gold-bright)]">
                            {spell.name}
                          </div>
                          <div className="mt-2 text-xs tracking-[0.2em] text-[color:var(--gold-dim)]/80">
                            {spell.action}
                          </div>
                        </div>
                        <div className="text-[11px] tracking-[0.18em] text-[color:var(--gold-dim)]/60">
                          {spell.keywords.length} keywords
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
