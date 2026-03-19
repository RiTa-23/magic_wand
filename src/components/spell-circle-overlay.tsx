"use client";

import { HeroMagicCircle } from "@/components/hero-magic-circle";

export const SPELL_DISPLAY_INFO: Record<
  string,
  { name: string; color: string }
> = {
  ventus: { name: "Ventus", color: "rgba(163,255,112,0.95)" },
  lumos: { name: "Lumos", color: "rgba(255,246,189,0.95)" },
  incendio: { name: "Incendio", color: "rgba(255,140,80,0.95)" },
  aguamenti: { name: "Aguamenti", color: "rgba(80,200,255,0.95)" },
  raiden: { name: "Raiden", color: "rgba(146,236,255,0.95)" },
  wave: { name: "Wave", color: "rgba(255,255,255,0.95)" },
  nox: { name: "Nox", color: "rgba(180,180,220,0.95)" },
  kyua_uppu_rapa_pa: {
    name: "キュアップ・ラパパ！",
    color: "rgba(255,100,210,0.95)",
  },
};

function AnchoredCircleLayer({
  sizePercent,
  className,
  style,
  children,
}: {
  sizePercent: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${className ?? ""}`}
      style={{ width: `${sizePercent}%`, height: `${sizePercent}%`, ...style }}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

interface SpellCircleOverlayProps {
  showCommitFeedback: boolean;
  showFailureFeedback: boolean;
  activeCircleSpell: string | null;
  /** trueのときグロー効果を表示（デフォルト: showCommitFeedback） */
  isMagicCircleGlowing?: boolean;
  /** trueのとき回転リングなどのイマーシブ追加エフェクトを表示 */
  isImmersiveGlowing?: boolean;
}

export function SpellCircleOverlay({
  showCommitFeedback,
  showFailureFeedback,
  activeCircleSpell,
  isMagicCircleGlowing,
  isImmersiveGlowing = false,
}: SpellCircleOverlayProps) {
  const glowing = isMagicCircleGlowing ?? showCommitFeedback;

  const activeSpellInfo = activeCircleSpell
    ? (SPELL_DISPLAY_INFO[activeCircleSpell] ?? null)
    : null;

  const isVentusCircleActive =
    showCommitFeedback && activeCircleSpell === "ventus";
  const isLumosCircleActive =
    showCommitFeedback && activeCircleSpell === "lumos";
  const isIncendioCircleActive =
    showCommitFeedback && activeCircleSpell === "incendio";
  const isRaidenCircleActive =
    showCommitFeedback && activeCircleSpell === "raiden";
  const isWaveCircleActive = showCommitFeedback && activeCircleSpell === "wave";
  const isAguamentiCircleActive =
    showCommitFeedback && activeCircleSpell === "aguamenti";
  const isOmikujiCircleActive =
    showCommitFeedback && activeCircleSpell === "kyua_uppu_rapa_pa";

  const magicCircleGlowClass = isWaveCircleActive
    ? "opacity-100 drop-shadow-[0_0_92px_rgba(255,255,255,0.75)]"
    : isAguamentiCircleActive
      ? "opacity-100 drop-shadow-[0_0_74px_rgba(80,200,255,0.64)]"
      : isOmikujiCircleActive
        ? "opacity-100 drop-shadow-[0_0_76px_rgba(255,80,200,0.68)]"
        : isVentusCircleActive
          ? "opacity-100 drop-shadow-[0_0_66px_rgba(163,255,112,0.56)]"
          : isLumosCircleActive
            ? "opacity-100 drop-shadow-[0_0_72px_rgba(255,246,189,0.62)]"
            : isRaidenCircleActive
              ? "opacity-100 drop-shadow-[0_0_78px_rgba(117,226,255,0.66)]"
              : isIncendioCircleActive
                ? "opacity-100 drop-shadow-[0_0_76px_rgba(255,117,66,0.64)]"
                : glowing
                  ? "opacity-100 drop-shadow-[0_0_42px_rgba(255,224,130,0.35)]"
                  : "opacity-95";

  return (
    <>
      {/* 魔法名表示 — 発動成功時に画面上部へ */}
      {showCommitFeedback && activeSpellInfo && (
        <div className="fixed inset-x-0 top-28 z-30 flex flex-col items-center pointer-events-none">
          <div
            className="absolute inset-x-0 inset-y-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 60% 100% at 50% 50%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)",
              filter: "blur(6px)",
            }}
          />
          <div className="flex items-center gap-3 mb-2">
            <div
              className="h-px w-14"
              style={{
                background: `linear-gradient(to right, transparent, ${activeSpellInfo.color.replace("0.95", "0.6")})`,
              }}
            />
            <p
              className="text-[9px] tracking-[0.6em] uppercase"
              style={{ color: activeSpellInfo.color.replace("0.95", "0.65") }}
            >
              Spell Cast
            </p>
            <div
              className="h-px w-14"
              style={{
                background: `linear-gradient(to left, transparent, ${activeSpellInfo.color.replace("0.95", "0.6")})`,
              }}
            />
          </div>
          <p
            className="text-6xl font-bold tracking-[0.28em] uppercase"
            style={{
              color: activeSpellInfo.color,
              textShadow: [
                `0 0 18px ${activeSpellInfo.color}`,
                `0 0 40px ${activeSpellInfo.color.replace("0.95", "0.55")}`,
                `0 0 80px ${activeSpellInfo.color.replace("0.95", "0.28")}`,
                `0 2px 6px rgba(0,0,0,0.9)`,
              ].join(", "),
            }}
          >
            {activeSpellInfo.name}
          </p>
          <div
            className="mt-3 h-px w-36"
            style={{
              background: `linear-gradient(to right, transparent, ${activeSpellInfo.color}, transparent)`,
            }}
          />
        </div>
      )}

      {/* Center magic circle */}
      <div className="fixed inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div
          className={`relative h-[460px] w-[460px] transition-[filter,opacity] duration-500 ease-out ${
            showFailureFeedback
              ? "opacity-100 drop-shadow-[0_0_60px_rgba(180,40,40,0.7)]"
              : magicCircleGlowClass
          }`}
        >
          {/* Raiden Circle */}
          <AnchoredCircleLayer
            sizePercent={100}
            className={`transition-all duration-700 ease-out ${
              isRaidenCircleActive
                ? "opacity-100 scale-100 blur-0"
                : "opacity-0 scale-[0.95] blur-[1.8px]"
            }`}
          >
            <AnchoredCircleLayer
              sizePercent={172}
              className="rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(146,236,255,0.34) 0%, rgba(92,182,255,0.22) 34%, rgba(195,244,255,0.1) 56%, rgba(8,22,36,0) 80%)",
                filter: "blur(26px)",
              }}
            >
              <></>
            </AnchoredCircleLayer>

            <AnchoredCircleLayer sizePercent={132}>
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <g className="origin-center animate-[spin_11s_linear_infinite]">
                  {Array.from({ length: 10 }, (_, i) => (
                    <path
                      key={`raiden-bolt-${i}`}
                      d="M 50 11 L 55 25 L 49 25 L 56 40 L 44 26 L 50 26 Z"
                      fill="rgba(191,244,255,0.88)"
                      transform={`rotate(${i * 36} 50 50)`}
                    />
                  ))}
                </g>
                <g className="origin-center animate-[spin_4.2s_linear_infinite_reverse]">
                  <circle
                    cx="50"
                    cy="50"
                    r="36"
                    fill="none"
                    stroke="rgba(126,227,255,0.76)"
                    strokeWidth="1.1"
                    strokeDasharray="2 6"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="28"
                    fill="none"
                    stroke="rgba(184,245,255,0.7)"
                    strokeWidth="0.95"
                    strokeDasharray="1 4"
                  />
                </g>
                <g className="origin-center animate-[pulse_0.95s_ease-in-out_infinite]">
                  <circle
                    cx="50"
                    cy="50"
                    r="11.2"
                    fill="rgba(142,226,255,0.86)"
                  />
                  <circle cx="50" cy="50" r="6" fill="rgba(238,252,255,0.97)" />
                </g>
              </svg>
            </AnchoredCircleLayer>
          </AnchoredCircleLayer>

          {/* Incendio Circle */}
          <AnchoredCircleLayer
            sizePercent={100}
            className={`transition-all duration-700 ease-out ${
              isIncendioCircleActive
                ? "opacity-100 scale-100 blur-0"
                : "opacity-0 scale-[0.95] blur-[1.8px]"
            }`}
          >
            <AnchoredCircleLayer
              sizePercent={168}
              className="rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,120,78,0.34) 0%, rgba(255,74,43,0.22) 34%, rgba(255,195,96,0.12) 58%, rgba(8,22,36,0) 80%)",
                filter: "blur(24px)",
              }}
            >
              <></>
            </AnchoredCircleLayer>

            <AnchoredCircleLayer sizePercent={132}>
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <g className="origin-center animate-[spin_6s_linear_infinite]">
                  {Array.from({ length: 12 }, (_, i) => (
                    <path
                      key={`incendio-flame-${i}`}
                      d="M 50 12 C 54 22, 54 31, 50 39 C 46 31, 46 22, 50 12"
                      fill="rgba(255,176,104,0.82)"
                      transform={`rotate(${i * 30} 50 50)`}
                    />
                  ))}
                </g>
                <g className="origin-center animate-[spin_3.8s_linear_infinite_reverse]">
                  <circle
                    cx="50"
                    cy="50"
                    r="35"
                    fill="none"
                    stroke="rgba(255,160,94,0.72)"
                    strokeWidth="1.1"
                    strokeDasharray="3 5"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="26"
                    fill="none"
                    stroke="rgba(255,214,126,0.68)"
                    strokeWidth="0.95"
                    strokeDasharray="2 4"
                  />
                </g>
                <g className="origin-center animate-[pulse_1.05s_ease-in-out_infinite]">
                  <circle
                    cx="50"
                    cy="50"
                    r="11.5"
                    fill="rgba(255,120,76,0.86)"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="6.2"
                    fill="rgba(255,234,168,0.96)"
                  />
                </g>
              </svg>
            </AnchoredCircleLayer>
          </AnchoredCircleLayer>

          {/* Lumos Circle */}
          <AnchoredCircleLayer
            sizePercent={100}
            className={`transition-all duration-700 ease-out ${
              isLumosCircleActive
                ? "opacity-100 scale-100 blur-0"
                : "opacity-0 scale-[0.95] blur-[1.6px]"
            }`}
          >
            <AnchoredCircleLayer
              sizePercent={170}
              className="rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,244,180,0.36) 0%, rgba(255,226,140,0.22) 34%, rgba(255,255,232,0.08) 56%, rgba(8,22,36,0) 80%)",
                filter: "blur(26px)",
              }}
            >
              <></>
            </AnchoredCircleLayer>

            <AnchoredCircleLayer sizePercent={128}>
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <g className="origin-center animate-[spin_14s_linear_infinite]">
                  {Array.from({ length: 24 }, (_, i) => (
                    <rect
                      key={`lumos-ray-${i}`}
                      x="49.5"
                      y="5"
                      width="1"
                      height="19"
                      rx="0.5"
                      fill="rgba(255,246,196,0.86)"
                      transform={`rotate(${i * 15} 50 50)`}
                    />
                  ))}
                </g>
                <g className="origin-center animate-[spin_7.2s_linear_infinite_reverse]">
                  <circle
                    cx="50"
                    cy="50"
                    r="34"
                    fill="none"
                    stroke="rgba(255,241,176,0.72)"
                    strokeWidth="1.05"
                    strokeDasharray="2 4"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="27"
                    fill="none"
                    stroke="rgba(255,255,226,0.72)"
                    strokeWidth="0.95"
                    strokeDasharray="1.5 3.5"
                  />
                </g>
                <g className="origin-center animate-[pulse_1.6s_ease-in-out_infinite]">
                  <circle cx="50" cy="50" r="11" fill="rgba(255,248,210,0.9)" />
                  <circle cx="50" cy="50" r="6" fill="rgba(255,255,246,0.96)" />
                </g>
              </svg>
            </AnchoredCircleLayer>
          </AnchoredCircleLayer>

          {/* Ventus Circle */}
          <AnchoredCircleLayer
            sizePercent={100}
            className={`transition-all duration-700 ease-out ${
              isVentusCircleActive
                ? "opacity-100 scale-100 blur-0"
                : "opacity-0 scale-[0.94] blur-[1.6px]"
            }`}
          >
            <AnchoredCircleLayer
              sizePercent={160}
              className="rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(153,255,103,0.28) 0%, rgba(88,235,116,0.2) 32%, rgba(29,80,42,0.08) 56%, rgba(8,22,36,0) 78%)",
                filter: "blur(24px)",
              }}
            >
              <></>
            </AnchoredCircleLayer>

            <AnchoredCircleLayer sizePercent={120}>
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <g className="origin-center animate-[spin_9s_linear_infinite]">
                  <ellipse
                    cx="50"
                    cy="50"
                    rx="45"
                    ry="16"
                    fill="none"
                    stroke="rgba(173,255,128,0.8)"
                    strokeWidth="1.2"
                    strokeDasharray="5 5"
                  />
                  <ellipse
                    cx="50"
                    cy="50"
                    rx="40"
                    ry="13"
                    fill="none"
                    stroke="rgba(124,255,144,0.72)"
                    strokeWidth="1"
                    transform="rotate(42 50 50)"
                  />
                  <ellipse
                    cx="50"
                    cy="50"
                    rx="34"
                    ry="11"
                    fill="none"
                    stroke="rgba(196,255,173,0.66)"
                    strokeWidth="0.9"
                    transform="rotate(118 50 50)"
                  />
                </g>
                <g className="origin-center animate-[spin_5.5s_linear_infinite_reverse]">
                  {Array.from({ length: 18 }, (_, i) => {
                    const angle = (i * 20 * Math.PI) / 180;
                    const x = Number((50 + 47 * Math.cos(angle)).toFixed(3));
                    const y = Number((50 + 47 * Math.sin(angle)).toFixed(3));
                    return (
                      <ellipse
                        key={`ventus-leaf-${i}`}
                        cx={x}
                        cy={y}
                        rx="1.15"
                        ry="2.7"
                        fill="rgba(178,255,137,0.88)"
                        transform={`rotate(${i * 20 + 90} ${x} ${y})`}
                      />
                    );
                  })}
                </g>
                <g className="origin-center animate-[spin_4.2s_linear_infinite]">
                  <path
                    d="M 22 50 C 31 25, 69 25, 78 50 C 69 75, 31 75, 22 50"
                    fill="none"
                    stroke="rgba(141,255,154,0.58)"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 50 22 C 75 31, 75 69, 50 78 C 25 69, 25 31, 50 22"
                    fill="none"
                    stroke="rgba(141,255,154,0.5)"
                    strokeWidth="0.95"
                    strokeLinecap="round"
                  />
                </g>
                <circle cx="50" cy="50" r="8.3" fill="rgba(223,255,198,0.85)" />
                <circle cx="50" cy="50" r="4.5" fill="rgba(255,255,235,0.95)" />
              </svg>
            </AnchoredCircleLayer>
          </AnchoredCircleLayer>

          {/* Omikuji Circle */}
          <AnchoredCircleLayer
            sizePercent={100}
            className={`transition-all duration-700 ease-out ${
              isOmikujiCircleActive
                ? "opacity-100 scale-100 blur-0"
                : "opacity-0 scale-[0.95] blur-[1.8px]"
            }`}
          >
            <AnchoredCircleLayer
              sizePercent={168}
              className="rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,80,200,0.36) 0%, rgba(220,50,180,0.22) 32%, rgba(255,180,230,0.1) 58%, rgba(8,22,36,0) 80%)",
                filter: "blur(24px)",
              }}
            >
              <></>
            </AnchoredCircleLayer>

            <AnchoredCircleLayer sizePercent={130}>
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <g className="origin-center animate-[spin_18s_linear_infinite]">
                  <ellipse
                    cx="50"
                    cy="33"
                    rx="13"
                    ry="17"
                    fill="rgba(255,80,200,0.22)"
                    stroke="rgba(255,180,235,0.84)"
                    strokeWidth="1.2"
                  />
                  <ellipse
                    cx="50"
                    cy="67"
                    rx="13"
                    ry="17"
                    fill="rgba(255,80,200,0.22)"
                    stroke="rgba(255,180,235,0.84)"
                    strokeWidth="1.2"
                  />
                  <ellipse
                    cx="33"
                    cy="50"
                    rx="17"
                    ry="13"
                    fill="rgba(255,80,200,0.22)"
                    stroke="rgba(255,180,235,0.84)"
                    strokeWidth="1.2"
                  />
                  <ellipse
                    cx="67"
                    cy="50"
                    rx="17"
                    ry="13"
                    fill="rgba(255,80,200,0.22)"
                    stroke="rgba(255,180,235,0.84)"
                    strokeWidth="1.2"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="7.5"
                    fill="rgba(255,100,210,0.50)"
                    stroke="rgba(255,210,242,0.72)"
                    strokeWidth="1.0"
                  />
                </g>
                <g className="origin-center animate-[spin_9s_linear_infinite_reverse]">
                  <polygon
                    points="50,12 56,35 77,23 65,44 88,50 65,56 77,77 56,65 50,88 44,65 23,77 35,56 12,50 35,44 23,23 44,35"
                    fill="none"
                    stroke="rgba(255,140,225,0.66)"
                    strokeWidth="0.85"
                    strokeLinejoin="round"
                  />
                </g>
                <g className="origin-center animate-[spin_5.5s_linear_infinite]">
                  <circle
                    cx="50"
                    cy="50"
                    r="34"
                    fill="none"
                    stroke="rgba(255,120,220,0.72)"
                    strokeWidth="1.05"
                    strokeDasharray="3 4"
                  />
                  {Array.from({ length: 16 }, (_, i) => {
                    const angle = (i * 22.5 * Math.PI) / 180;
                    const r = i % 2 === 0 ? 41 : 39;
                    const x = Number((50 + r * Math.sin(angle)).toFixed(2));
                    const y = Number((50 - r * Math.cos(angle)).toFixed(2));
                    return (
                      <circle
                        key={`omikuji-sparkle-${i}`}
                        cx={x}
                        cy={y}
                        r={i % 2 === 0 ? 1.3 : 0.7}
                        fill="rgba(255,210,242,0.92)"
                      />
                    );
                  })}
                </g>
                <g className="origin-center animate-[spin_3.2s_linear_infinite_reverse]">
                  <circle
                    cx="50"
                    cy="50"
                    r="26"
                    fill="none"
                    stroke="rgba(255,160,232,0.68)"
                    strokeWidth="0.95"
                    strokeDasharray="2 4"
                  />
                </g>
                <g className="origin-center animate-[pulse_1.2s_ease-in-out_infinite]">
                  <circle
                    cx="50"
                    cy="50"
                    r="11.5"
                    fill="rgba(255,80,200,0.86)"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="6.5"
                    fill="rgba(255,230,248,0.96)"
                  />
                </g>
              </svg>
            </AnchoredCircleLayer>
          </AnchoredCircleLayer>

          {/* Aguamenti Circle */}
          <AnchoredCircleLayer
            sizePercent={100}
            className={`transition-all duration-700 ease-out ${
              isAguamentiCircleActive
                ? "opacity-100 scale-100 blur-0"
                : "opacity-0 scale-[0.95] blur-[1.8px]"
            }`}
          >
            <AnchoredCircleLayer
              sizePercent={166}
              className="rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(80,200,255,0.34) 0%, rgba(40,140,220,0.22) 34%, rgba(160,230,255,0.1) 58%, rgba(8,22,36,0) 80%)",
                filter: "blur(24px)",
              }}
            >
              <></>
            </AnchoredCircleLayer>

            <AnchoredCircleLayer sizePercent={130}>
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <g className="origin-center animate-[spin_8s_linear_infinite]">
                  {Array.from({ length: 12 }, (_, i) => {
                    const angle = (i * 30 * Math.PI) / 180;
                    const x = Number((50 + 40 * Math.cos(angle)).toFixed(3));
                    const y = Number((50 + 40 * Math.sin(angle)).toFixed(3));
                    return (
                      <ellipse
                        key={`aguamenti-drop-${i}`}
                        cx={x}
                        cy={y}
                        rx="1.4"
                        ry="2.8"
                        fill="rgba(120,220,255,0.88)"
                        transform={`rotate(${i * 30 + 90} ${x} ${y})`}
                      />
                    );
                  })}
                </g>
                <g className="origin-center animate-[spin_4.5s_linear_infinite_reverse]">
                  <circle
                    cx="50"
                    cy="50"
                    r="34"
                    fill="none"
                    stroke="rgba(80,200,255,0.78)"
                    strokeWidth="1.1"
                    strokeDasharray="4 3"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="27"
                    fill="none"
                    stroke="rgba(160,235,255,0.70)"
                    strokeWidth="0.95"
                    strokeDasharray="2.5 4"
                  />
                </g>
                <g className="origin-center animate-[spin_13s_linear_infinite]">
                  <ellipse
                    cx="50"
                    cy="50"
                    rx="44"
                    ry="14"
                    fill="none"
                    stroke="rgba(100,210,255,0.72)"
                    strokeWidth="1.0"
                    strokeDasharray="6 4"
                  />
                  <ellipse
                    cx="50"
                    cy="50"
                    rx="38"
                    ry="11"
                    fill="none"
                    stroke="rgba(140,225,255,0.62)"
                    strokeWidth="0.9"
                    transform="rotate(55 50 50)"
                  />
                  <ellipse
                    cx="50"
                    cy="50"
                    rx="32"
                    ry="9"
                    fill="none"
                    stroke="rgba(180,240,255,0.54)"
                    strokeWidth="0.85"
                    transform="rotate(110 50 50)"
                  />
                </g>
                <g className="origin-center animate-[pulse_1.3s_ease-in-out_infinite]">
                  <circle
                    cx="50"
                    cy="50"
                    r="11.5"
                    fill="rgba(80,200,255,0.82)"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="6.5"
                    fill="rgba(200,245,255,0.96)"
                  />
                </g>
              </svg>
            </AnchoredCircleLayer>
          </AnchoredCircleLayer>

          {/* Wave Circle */}
          <AnchoredCircleLayer
            sizePercent={100}
            className={`transition-all duration-700 ease-out ${
              isWaveCircleActive
                ? "opacity-100 scale-100 blur-0"
                : "opacity-0 scale-[0.95] blur-[1.8px]"
            }`}
          >
            <AnchoredCircleLayer
              sizePercent={178}
              className="rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.26) 0%, rgba(255,150,80,0.16) 18%, rgba(80,185,255,0.14) 35%, rgba(130,235,255,0.12) 50%, rgba(255,245,130,0.1) 65%, rgba(150,255,100,0.08) 78%, rgba(8,22,36,0) 92%)",
                filter: "blur(30px)",
              }}
            >
              <></>
            </AnchoredCircleLayer>

            <AnchoredCircleLayer sizePercent={136}>
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <g className="origin-center animate-[spin_20s_linear_infinite]">
                  <path
                    d="M 50 8 C 53 13, 53 18, 50 22 C 47 18, 47 13, 50 8"
                    fill="rgba(255,150,80,0.90)"
                  />
                  <path
                    d="M 50 8 L 52 14 C 53.5 17, 53.5 20, 50 22 C 46.5 20, 46.5 17, 48 14 Z"
                    fill="rgba(80,185,255,0.90)"
                    transform="rotate(72 50 50)"
                  />
                  <path
                    d="M 51 8 L 53 14 L 51.5 14 L 54 21 L 47.5 15 L 49.5 15 L 48 8 Z"
                    fill="rgba(130,235,255,0.90)"
                    transform="rotate(144 50 50)"
                  />
                  <path
                    d="M 50 8 L 51.2 12.5 L 55.5 11.5 L 52.5 15 L 54.5 19.5 L 50 17 L 45.5 19.5 L 47.5 15 L 44.5 11.5 L 48.8 12.5 Z"
                    fill="rgba(255,245,130,0.90)"
                    transform="rotate(216 50 50)"
                  />
                  <path
                    d="M 47 9 C 54 11, 56 18, 51 22 C 46 19, 45 13, 47 9"
                    fill="rgba(150,255,100,0.90)"
                    transform="rotate(288 50 50)"
                  />
                </g>
                <g className="origin-center animate-[spin_12s_linear_infinite_reverse]">
                  <path
                    d="M 50 12 L 72 81 L 14 38 L 86 38 L 28 81 Z"
                    fill="none"
                    stroke="rgba(255,255,255,0.50)"
                    strokeWidth="0.85"
                    strokeDasharray="3 2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 50 28 L 63 68 L 29 43 L 71 43 L 37 68 Z"
                    fill="none"
                    stroke="rgba(255,255,255,0.36)"
                    strokeWidth="0.7"
                    strokeDasharray="2 3"
                    strokeLinejoin="round"
                  />
                </g>
                <g className="origin-center animate-[spin_7s_linear_infinite]">
                  {(
                    [
                      { color: "rgba(255,140,80,0.85)", rotation: -90 },
                      { color: "rgba(80,185,255,0.85)", rotation: -18 },
                      { color: "rgba(130,235,255,0.85)", rotation: 54 },
                      { color: "rgba(255,245,130,0.85)", rotation: 126 },
                      { color: "rgba(150,255,100,0.85)", rotation: 198 },
                    ] as { color: string; rotation: number }[]
                  ).map(({ color, rotation }, i) => (
                    <circle
                      key={`wave-arc-outer-${i}`}
                      cx="50"
                      cy="50"
                      r="33"
                      fill="none"
                      stroke={color}
                      strokeWidth="2.0"
                      strokeDasharray="37.5 170"
                      transform={`rotate(${rotation} 50 50)`}
                    />
                  ))}
                </g>
                <g className="origin-center animate-[spin_3.5s_linear_infinite_reverse]">
                  <circle
                    cx="50"
                    cy="50"
                    r="24"
                    fill="none"
                    stroke="rgba(255,255,255,0.65)"
                    strokeWidth="1.05"
                    strokeDasharray="2 5"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="18"
                    fill="none"
                    stroke="rgba(220,245,255,0.55)"
                    strokeWidth="0.9"
                    strokeDasharray="1.5 4"
                  />
                </g>
                <g className="origin-center animate-[pulse_1.0s_ease-in-out_infinite]">
                  <circle
                    cx="50"
                    cy="50"
                    r="13"
                    fill="rgba(255,255,255,0.20)"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="9.5"
                    fill="rgba(255,255,255,0.52)"
                  />
                  <circle cx="50" cy="50" r="6" fill="rgba(255,255,255,0.90)" />
                  <circle cx="50" cy="50" r="3" fill="rgba(255,255,255,1)" />
                </g>
              </svg>
            </AnchoredCircleLayer>
          </AnchoredCircleLayer>

          {/* イマーシブ追加エフェクト（Joy-Conモード専用） */}
          {isImmersiveGlowing && (
            <>
              <div
                className="absolute inset-[-24%] rounded-full"
                style={{
                  background: isWaveCircleActive
                    ? "conic-gradient(from 0deg, rgba(255,140,80,0.22), rgba(80,185,255,0.2), rgba(130,235,255,0.2), rgba(255,245,130,0.18), rgba(150,255,100,0.2), rgba(255,140,80,0.22))"
                    : isAguamentiCircleActive
                      ? "conic-gradient(from 0deg, rgba(80,200,255,0.24), rgba(40,140,220,0.18), rgba(160,235,255,0.2), rgba(80,200,255,0.24))"
                      : isOmikujiCircleActive
                        ? "conic-gradient(from 0deg, rgba(255,80,200,0.26), rgba(220,50,180,0.2), rgba(255,180,235,0.22), rgba(255,80,200,0.26))"
                        : isVentusCircleActive
                          ? "conic-gradient(from 0deg, rgba(167,255,123,0.23), rgba(81,240,125,0.16), rgba(167,255,123,0.23))"
                          : isLumosCircleActive
                            ? "conic-gradient(from 0deg, rgba(255,242,173,0.26), rgba(255,255,236,0.18), rgba(255,242,173,0.26))"
                            : isRaidenCircleActive
                              ? "conic-gradient(from 0deg, rgba(168,241,255,0.24), rgba(114,194,255,0.2), rgba(220,250,255,0.16), rgba(168,241,255,0.24))"
                              : isIncendioCircleActive
                                ? "conic-gradient(from 0deg, rgba(255,143,91,0.24), rgba(255,75,50,0.18), rgba(255,222,132,0.2), rgba(255,143,91,0.24))"
                                : "conic-gradient(from 0deg, rgba(255,214,120,0.18), rgba(92,255,229,0.12), rgba(255,214,120,0.18))",
                  animation: "spin 6s linear infinite",
                  filter: "blur(18px)",
                }}
                aria-hidden="true"
              />
              <div
                className={`absolute inset-[-12%] rounded-full border ${
                  isWaveCircleActive
                    ? "border-white/72"
                    : isAguamentiCircleActive
                      ? "border-[#50c8ff]/70"
                      : isOmikujiCircleActive
                        ? "border-[#ff50c8]/70"
                        : isVentusCircleActive
                          ? "border-[#a9ff84]/65"
                          : isLumosCircleActive
                            ? "border-[#fff1ac]/70"
                            : isRaidenCircleActive
                              ? "border-[#a9eeff]/72"
                              : isIncendioCircleActive
                                ? "border-[#ffb47f]/70"
                                : "border-[#ffd87f]/55"
                }`}
                style={{
                  animation:
                    "spin 8s linear infinite reverse, pulse 1.8s ease-in-out infinite",
                }}
                aria-hidden="true"
              />
            </>
          )}

          {/* グロー効果 */}
          {glowing && (
            <>
              <div
                className="absolute inset-[-18%] rounded-full animate-pulse"
                style={{
                  background: isWaveCircleActive
                    ? "radial-gradient(circle, rgba(255,255,255,0.38) 0%, rgba(200,235,255,0.24) 30%, rgba(150,255,200,0.14) 55%, rgba(13,30,46,0) 74%)"
                    : isAguamentiCircleActive
                      ? "radial-gradient(circle, rgba(80,200,255,0.36) 0%, rgba(40,140,220,0.22) 40%, rgba(13,30,46,0) 74%)"
                      : isOmikujiCircleActive
                        ? "radial-gradient(circle, rgba(255,80,200,0.38) 0%, rgba(220,50,180,0.22) 40%, rgba(13,30,46,0) 74%)"
                        : isVentusCircleActive
                          ? "radial-gradient(circle, rgba(164,255,121,0.28) 0%, rgba(95,235,120,0.16) 40%, rgba(13,30,46,0) 74%)"
                          : isLumosCircleActive
                            ? "radial-gradient(circle, rgba(255,245,184,0.32) 0%, rgba(255,235,167,0.2) 40%, rgba(13,30,46,0) 74%)"
                            : isRaidenCircleActive
                              ? "radial-gradient(circle, rgba(152,234,255,0.34) 0%, rgba(95,186,255,0.2) 40%, rgba(13,30,46,0) 74%)"
                              : isIncendioCircleActive
                                ? "radial-gradient(circle, rgba(255,146,98,0.34) 0%, rgba(255,90,61,0.2) 40%, rgba(13,30,46,0) 74%)"
                                : "radial-gradient(circle, rgba(255,226,138,0.22) 0%, rgba(84,255,238,0.12) 38%, rgba(13,30,46,0) 72%)",
                }}
                aria-hidden="true"
              />
              <div
                className={`absolute inset-[-6%] rounded-full border animate-ping ${
                  isWaveCircleActive
                    ? "border-white/80"
                    : isAguamentiCircleActive
                      ? "border-[#a0e8ff]/72"
                      : isOmikujiCircleActive
                        ? "border-[#ffb0e8]/75"
                        : isVentusCircleActive
                          ? "border-[#b8ff9e]/65"
                          : isLumosCircleActive
                            ? "border-[#fff4bf]/70"
                            : isRaidenCircleActive
                              ? "border-[#ccf5ff]/74"
                              : isIncendioCircleActive
                                ? "border-[#ffd1a0]/70"
                                : "border-[#f5d77a]/55"
                }`}
                style={{ animationDuration: "2.4s" }}
                aria-hidden="true"
              />
            </>
          )}

          {/* 失敗エフェクト */}
          <div
            className={`absolute inset-0 rounded-full transition-opacity duration-300 pointer-events-none ${
              showFailureFeedback ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden="true"
          >
            <div
              className="absolute inset-[-20%] rounded-full animate-pulse"
              style={{
                background:
                  "radial-gradient(circle, rgba(200,30,30,0.32) 0%, rgba(160,20,20,0.18) 40%, rgba(13,30,46,0) 72%)",
              }}
            />
            <div
              className="absolute inset-[-8%] rounded-full"
              style={{
                border: "1px solid rgba(220,60,60,0.6)",
                animation: "ping 0.7s ease-out 2",
              }}
            />
          </div>

          <div className="h-full w-full">
            <HeroMagicCircle />
          </div>
        </div>
      </div>
    </>
  );
}
