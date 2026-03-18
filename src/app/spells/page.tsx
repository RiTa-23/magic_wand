"use client";

import { ChevronLeft, ScrollText } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FloatingParticles } from "@/components/floating-particles";
import { SPELL_DICTIONARY } from "@/features/voice/lib/spell-matcher";

export default function SpellsPage() {
  const spells = useMemo(() => SPELL_DICTIONARY, []);
  const [expandedSpellIds, setExpandedSpellIds] = useState<string[]>(() =>
    spells[0]?.id ? [spells[0].id] : [],
  );

  const spellMetaById = useMemo(
    () =>
      ({
        lumos: {
          description:
            "光を灯す呪文。対応するデバイスに『点灯』の意図を伝えます。",
        },
        nox: {
          description:
            "光を消す呪文。対応するデバイスに『消灯』の意図を伝えます。",
        },
        aguamenti: {
          description:
            "水を呼ぶ呪文（このアプリでは風の発動に割り当てられています）。",
        },
        ventus: {
          description:
            "風を呼ぶ呪文。デバイスへ『風を起こす』合図として使います。",
        },
        kyua_uppu_rapa_pa: {
          description:
            "おみくじを印刷する特別な呪文。特定のフレーズを含むと強く反応します。",
        },
        incendio: {
          description:
            "炎を灯す呪文。対応するデバイスに『点火』の意図を伝えます。",
        },
        wave: {
          description: "波動の呪文。次々に魔法が発動します。",
        },
        raiden: {
          description: "雷撃の呪文。電撃を放ちます。",
        },
      }) as Record<string, { description: string }>,
    [],
  );

  const placeholderImageSrc = "/spellimage/ventus.jpg";
  const imageSrcById = useMemo(
    () =>
      ({
        lumos: "/spellimage/lumos.png",
        raiden: "/spellimage/lightning.png",
        wave: "/spellimage/wave.png",
        incendio: "/spellimage/fire.jpg",
      }) as Record<string, string>,
    [],
  );

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
          </header>
        </div>

        {/* Center area */}
        <div className="flex-1 min-h-0 flex items-center justify-center py-6 sm:py-10">
          <div className="w-full max-w-4xl h-full min-h-0">
            <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-[color:var(--gold)]/15 bg-black/20 backdrop-blur-sm">
              <div className="magic-scroll h-full min-h-0 overflow-auto p-5 sm:p-8">
                <ul className="space-y-4" aria-label="呪文一覧">
                  {spells.map((spell) => {
                    const isExpanded = expandedSpellIds.includes(spell.id);
                    const panelId = `spell-panel-${spell.id}`;
                    const buttonId = `spell-trigger-${spell.id}`;
                    const description =
                      spellMetaById[spell.id]?.description ??
                      "この呪文の説明は準備中です。";
                    const imageSrc =
                      imageSrcById[spell.id] ?? placeholderImageSrc;
                    const shouldPrioritizeImage = spell.id === spells[0]?.id;

                    return (
                      <li key={spell.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSpellIds((prev) =>
                              prev.includes(spell.id)
                                ? prev.filter((id) => id !== spell.id)
                                : [...prev, spell.id],
                            )
                          }
                          id={buttonId}
                          className={
                            "w-full text-left rounded-xl border bg-stone/20 px-5 py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]/35 " +
                            (isExpanded
                              ? "border-[color:var(--gold)]/30 bg-gold/5"
                              : "border-[color:var(--gold)]/10 hover:border-[color:var(--gold)]/20 hover:bg-stone/25")
                          }
                          aria-expanded={isExpanded}
                          aria-controls={panelId}
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
                        </button>

                        <div
                          id={panelId}
                          role="region"
                          aria-labelledby={buttonId}
                          className={
                            "grid transition-[grid-template-rows,opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none " +
                            (isExpanded
                              ? "mt-3 grid-rows-[1fr] opacity-100 translate-y-0"
                              : "mt-0 grid-rows-[0fr] opacity-0 -translate-y-1 pointer-events-none")
                          }
                          aria-hidden={!isExpanded}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <div className="rounded-xl border border-[color:var(--gold)]/15 bg-black/10 backdrop-blur-sm px-5 py-4">
                              <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                                <div className="relative overflow-hidden rounded-xl border border-[color:var(--gold)]/10 bg-stone/20 w-full aspect-[2/1]">
                                  <Image
                                    src={imageSrc}
                                    alt=""
                                    fill
                                    className="object-contain p-2"
                                    sizes="(max-width: 640px) 100vw, 200px"
                                    priority={shouldPrioritizeImage}
                                    aria-hidden="true"
                                  />
                                </div>

                                <div>
                                  <div className="text-sm sm:text-base tracking-[0.14em] text-[color:var(--foreground)]/85">
                                    {description}
                                  </div>

                                  <div className="mt-4 text-xs tracking-[0.2em] text-[color:var(--gold-dim)]/80">
                                    {"認識キーワード"}
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {spell.keywords.map((keyword, index) => (
                                      <span
                                        key={`${spell.id}:${index}`}
                                        className="rounded-full border border-[color:var(--gold)]/15 bg-stone/20 px-3 py-1 text-[11px] tracking-[0.18em] text-[color:var(--foreground)]/85"
                                      >
                                        {keyword}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
