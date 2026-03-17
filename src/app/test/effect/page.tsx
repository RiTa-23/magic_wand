"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { FloatingParticles } from "@/components/floating-particles";
import { useSearchParams } from "next/navigation";
import { Cinzel } from "next/font/google";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

type MagicType = "LUMOS" | "VENTUS" | "AGUAMENTI" | "INCENDIO" | "EXCALIBUR";

const MAGIC_THEMES = {
  LUMOS: {
    name: "LUMOS",
    color: "255, 255, 255", // White
    particles: "255, 250, 220", // Warm white
    gradient: "from-yellow-200 via-white to-yellow-100",
    glow: "rgba(255, 255, 255, 0.8)",
  },
  VENTUS: {
    name: "VENTUS",
    color: "0, 255, 200", // Aqua/Neon Green
    particles: "52, 211, 153", // Emerald
    gradient: "from-[#0891b2] via-[#10b981] to-[#4ade80]", // Aqua -> Green -> Neon
    glow: "rgba(16, 185, 129, 0.6)",
  },
  AGUAMENTI: {
    name: "AGUAMENTI",
    color: "30, 144, 255", // Dodger Blue
    particles: "135, 206, 250", // Light Sky Blue
    gradient: "from-blue-600 via-cyan-100 to-blue-400",
    glow: "rgba(0, 191, 255, 0.8)",
  },
  INCENDIO: {
    name: "INCENDIO",
    color: "255, 69, 0", // Red Orange
    particles: "255, 100, 50", // Fiery orange
    gradient: "from-red-600 via-orange-400 to-yellow-500",
    glow: "rgba(255, 69, 0, 0.8)",
  },
  EXCALIBUR: {
    name: "EXCALIBUR",
    color: "100, 180, 255", // Blue
    particles: "212, 175, 55", // Classic gold
    gradient: "from-blue-400 via-white to-purple-400",
    glow: "rgba(255, 255, 255, 0.8)",
  },
};

/**風魔法のエフェクト：中心コアを排した3Dボルテックス（竜巻） */
function WindEffect() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const particles = useMemo(() => {
    return [...Array(30)].map((_, i) => ({
      width: 1 + Math.random() * 2,
      height: 2 + Math.random() * 8,
      left: 45 + Math.random() * 10,
      tx: (Math.random() - 0.5) * 240,
      ty: -100 - Math.random() * 150, // 高度を抑えて文字との重なりを防ぐ
      rz: Math.random() * 720,
      delay: Math.random() * -5,
      duration: 1 + Math.random() * 1.5,
    }));
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible [perspective:1200px] [transform-style:preserve-3d]">
      {/* 1. Bloom Base (空間の光のベール) - サイズ調整 */}
      <div className="absolute w-[400px] h-[560px] bg-[radial-gradient(circle,_rgba(8,145,178,0.4)_0%,_rgba(16,185,129,0.15)_40%,_transparent_70%)] rounded-full blur-[90px]" />

      {/* 2. 3D Vortex Structure (竜巻の形をした光の筋) */}
      <div className="relative w-full h-full flex items-center justify-center [transform-style:preserve-3d]">
        {[...Array(20)].map((_, i) => {
          const size = 80 + i * 20;
          const zPos = i * 20 - 150;
          const opacity = 0.1 + i * 0.04;
          // 高さ（i）に応じて色を変える (Aqua -> Neon Green)
          const color = i < 10 ? "#0891b2" : "#4ade80";

          return (
            <div
              key={`tornado-layer-${i}`}
              className="absolute animate-wind-vortex-layer"
              style={
                {
                  width: `${size}px`,
                  height: `${size}px`,
                  // @ts-ignore
                  "--z": `${zPos}px`,
                  "--op": opacity,
                  animationDelay: `${i * -0.5}s`,
                  animationDuration: `${2 + i * 0.05}s`,
                } as any
              }
            >
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full overflow-visible drop-shadow-[0_0_25px_var(--glow-color)]"
                style={{ "--glow-color": color } as any}
              >
                <path
                  d="M10,50 A40,40 0 0,1 90,50"
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  className="opacity-85 animate-wind-flow"
                  strokeDasharray="10 50"
                  style={{ filter: "blur(1px)" }}
                />
                {/* Bloom layer per ring - 輝度点灯 */}
                <path
                  d="M20,50 A30,30 0 0,1 80,50"
                  fill="none"
                  stroke={color}
                  strokeWidth={6}
                  strokeLinecap="round"
                  className="opacity-45 animate-wind-flow"
                  style={{ filter: "blur(6px)" }}
                />
              </svg>
            </div>
          );
        })}
      </div>

      {/* 3. Rising Particles (竜巻に巻き込まれる粒子) */}
      <div className="absolute inset-0 flex items-center justify-center [transform-style:preserve-3d]">
        {mounted &&
          particles.map((p, i) => (
            <div
              key={`vortex-p-${i}`}
              className="absolute bg-white/90 rounded-full blur-[1px] animate-wind-particle-tornado"
              style={
                {
                  width: `${p.width}px`,
                  height: `${p.height}px`,
                  left: `${p.left}%`,
                  // @ts-ignore
                  "--tx": `${p.tx}px`,
                  "--ty": `${p.ty}px`,
                  "--rz": `${p.rz}deg`,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                } as any
              }
            />
          ))}
      </div>
    </div>
  );
}

/** 水魔法のエフェクト：ハリー・ポッター風の「浮遊する水球と神秘的な霧」 */
/** 水魔法のエフェクト：実在感を極めたハリー・ポッター風「Sacred Aqua Sigil」 */
function WaterEffect() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const spheres = useMemo(() => {
    return [...Array(12)].map((_, i) => ({
      size: 30 + Math.random() * 150,
      left: 10 + Math.random() * 80,
      top: 10 + Math.random() * 80,
      delay: Math.random() * -12,
      duration: 8 + Math.random() * 8,
    }));
  }, []);

  const bubbles = useMemo(() => {
    return [...Array(8)].map((_, i) => ({
      left: 20 + Math.random() * 60,
      width: 4 + Math.random() * 8,
      height: 4 + Math.random() * 8,
      delay: i * -1.5,
      duration: 5 + Math.random() * 3,
    }));
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible [perspective:1200px] [transform-style:preserve-3d]">
      {/* SVG Filters for Liquid Realism (液体のゆらぎを定義) */}
      <svg className="absolute w-0 h-0">
        <defs>
          <filter id="liquid-refraction">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.02"
              numOctaves="3"
              seed="1"
            >
              <animate
                attributeName="baseFrequency"
                dur="10s"
                values="0.02;0.05;0.02"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="10" />
          </filter>
        </defs>
      </svg>

      {/* 1. Aqua Core (魔法の源泉) */}
      <div className="absolute w-32 h-32 bg-white rounded-full blur-[40px] opacity-20 animate-pulse animate-ping" />
      <div className="absolute w-[500px] h-[500px] bg-[radial-gradient(circle,_rgba(255,255,255,0.2)_0%,_rgba(0,191,255,0.05)_40%,_transparent_70%)] rounded-full blur-[60px]" />

      {/* 2. Mystical Layered Mist (深く濃い水の霧) */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[...Array(8)].map((_, i) => (
          <div
            key={`sacred-mist-${i}`}
            className="absolute bg-[radial-gradient(circle,_rgba(135,206,250,0.1)_0%,_transparent_75%)] rounded-full blur-[90px] animate-water-mist-drift"
            style={{
              width: `${1200 - i * 120}px`,
              height: `${800 - i * 80}px`,
              animationDelay: `${i * -1.8}s`,
              animationDuration: `${12 + (8 - i) * 2}s`,
              transform: `rotate(${i * 45}deg) scale(${1 + i * 0.1})`,
            }}
          />
        ))}
      </div>

      {/* 3. Prismatic Aqua Spheres (極限まで透明度を高めた水球：もはや光の屈折) */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ filter: "url(#liquid-refraction)" }}
      >
        {mounted &&
          spheres.map((s, i) => (
            <div
              key={`sacred-sphere-${i}`}
              className="absolute bg-gradient-to-br from-white/15 via-blue-300/5 to-transparent border border-white/10 rounded-full animate-water-sphere-float shadow-[inset_0_0_30px_rgba(255,255,255,0.2)]"
              style={
                {
                  width: `${s.size}px`,
                  height: `${s.size}px`,
                  left: `${s.left}%`,
                  top: `${s.top}%`,
                  animationDelay: `${s.delay}s`,
                  animationDuration: `${s.duration}s`,
                } as any
              }
            >
              {/* Internal light refraction (球体内部の光の筋) */}
              <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] bg-white rounded-full blur-[4px] opacity-30" />
              <div className="absolute bottom-[10%] right-[10%] w-[15%] h-[15%] bg-cyan-100 rounded-full blur-[5px] opacity-20 animate-pulse" />
            </div>
          ))}
      </div>

      {/* 4. Ground Reservoir & Ripples (足元に出現する聖なる池) */}
      <div className="absolute [transform-style:preserve-3d] transform rotate-x-75 translate-y-48">
        {[...Array(6)].map((_, i) => (
          <div
            key={`abyssal-ripple-${i}`}
            className="absolute -inset-[32rem] border-4 border-white/10 rounded-full animate-water-ripple-flow"
            style={{ animationDelay: `${i * 1.8}s`, animationDuration: "5s" }}
          />
        ))}
        <div className="absolute -inset-[28rem] bg-[radial-gradient(circle,_rgba(255,255,255,0.15)_0%,_#0ea5e9_30%,_transparent_70%)] opacity-15 blur-[60px] animate-pulse" />
      </div>

      {/* 5. Glistening Particles (主張を完全に消した微細な水蒸気) */}
      <div className="absolute inset-x-0 h-screen">
        {mounted &&
          bubbles.map((b, i) => (
            <div
              key={`sacred-bubble-${i}`}
              className="absolute bg-white/10 rounded-full animate-bubble-rise"
              style={
                {
                  left: `${b.left}%`,
                  width: `${b.width}px`,
                  height: `${b.height}px`,
                  filter: "blur(3px)",
                  animationDelay: `${b.delay}s`,
                  animationDuration: `${b.duration}s`,
                } as any
              }
            />
          ))}
      </div>
    </div>
  );
}

/** 炎魔法のエフェクト：揺らぐ炎 */
function FireEffect() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
      <div className="w-48 h-[360px] bg-gradient-to-t from-red-600 via-orange-500 to-transparent rounded-[50%_50%_35%_35%_/_80%_80%_20%_20%] blur-[45px] animate-fire-dance" />
    </div>
  );
}

/** 光魔法のエフェクト：画像イメージに基づく無数の黄金フィラメントの渦 */
function LightEffect() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const filaments = useMemo(() => {
    return [...Array(120)].map((_, i) => {
      const angle = Math.random() * 360;
      const radius = 30 + Math.random() * 120;
      const length = 30 + Math.random() * 60;
      const endAngle = angle + ((length / radius) * 180) / Math.PI;

      return {
        startX: 200 + Math.cos((angle * Math.PI) / 180) * radius,
        startY: 200 + Math.sin((angle * Math.PI) / 180) * radius,
        endX: 200 + Math.cos((endAngle * Math.PI) / 180) * radius,
        endY: 200 + Math.sin((endAngle * Math.PI) / 180) * radius,
        radius,
        length,
        strokeWidth: 0.4 + Math.random() * 1.2,
        opacity: 0.3 + Math.random() * 0.7,
        duration: 2 + Math.random() * 4,
        delay: Math.random() * -10,
      };
    });
  }, []);

  const glitter = useMemo(() => {
    return [...Array(50)].map((_, i) => ({
      tx: (Math.random() - 0.5) * 450,
      ty: (Math.random() - 0.5) * 450,
      delay: Math.random() * -5,
      duration: 2.5 + Math.random() * 2,
    }));
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible [perspective:1200px] [transform-style:preserve-3d]">
      {/* 1. Supernova Core (中心の強烈な輝き) */}
      <div className="absolute w-24 h-24 bg-white rounded-full blur-[20px] shadow-[0_0_50px_#fff,0_0_100px_#fde047,0_0_130px_#f59e0b] z-20 animate-pulse" />
      <div className="absolute w-[400px] h-[400px] bg-[radial-gradient(circle,_rgba(251,191,36,0.3)_0%,_transparent_70%)] rounded-full blur-[70px]" />

      {/* 2. Swirling Filaments (画像のような光の筋の渦) */}
      <div className="absolute inset-0 flex items-center justify-center animate-reverse-spin [animation-duration:15s]">
        <svg
          viewBox="0 0 400 400"
          className="w-[450px] h-[450px] overflow-visible"
        >
          {mounted &&
            filaments.map((f, i) => (
              <path
                key={i}
                d={`M ${f.startX} ${f.startY} A ${f.radius} ${f.radius} 0 0 1 ${f.endX} ${f.endY}`}
                fill="none"
                stroke={i % 2 === 0 ? "#fef3c7" : "#fbbf24"}
                strokeWidth={f.strokeWidth}
                strokeLinecap="round"
                className="animate-lumos-filament"
                style={
                  {
                    opacity: f.opacity,
                    // @ts-ignore
                    "--dash": f.length,
                    animationDelay: `${f.delay}s`,
                    animationDuration: `${f.duration}s`,
                  } as any
                }
              />
            ))}
        </svg>
      </div>

      {/* 3. Radiant Glitter (周囲に飛び散る光子) */}
      <div className="absolute inset-0">
        {mounted &&
          glitter.map((g, i) => (
            <div
              key={`glitter-${i}`}
              className="absolute w-1 h-1 bg-yellow-100 rounded-full blur-[1px] animate-light-particle-fly"
              style={
                {
                  left: "50%",
                  top: "50%",
                  // @ts-ignore
                  "--tx": `${g.tx}px`,
                  // @ts-ignore
                  "--ty": `${g.ty}px`,
                  animationDelay: `${g.delay}s`,
                  animationDuration: `${g.duration}s`,
                } as any
              }
            />
          ))}
      </div>
    </div>
  );
}

function EffectContent() {
  const [mounted, setMounted] = useState(false);
  const [castState, setCastState] = useState<"idle" | "charging" | "cast">(
    "idle",
  );
  const searchParams = useSearchParams();

  // URLパラメータ ?magic=ventus などから魔法の種類を取得
  const magicParam = searchParams.get("magic")?.toUpperCase() as MagicType;
  const currentMagic = MAGIC_THEMES[magicParam] ? magicParam : "LUMOS";
  const theme = MAGIC_THEMES[currentMagic];

  const handleCast = useCallback(() => {
    setCastState("charging");
    setTimeout(() => {
      setCastState("cast");
    }, 1000);
  }, []);

  useEffect(() => {
    setMounted(true);

    // パラメータがある場合は自動的に発動（テスト用）
    if (magicParam) {
      handleCast();
    }
  }, [handleCast, magicParam]);

  if (!mounted) return <div className="min-h-screen bg-[#0a0815]" />;

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_center,_#1a1033_0%,_#0a0815_100%)] flex flex-col items-center justify-center p-4">
      {/* Background Ambience - 魔法の色に合わせたパーティクル */}
      <FloatingParticles color={theme.particles} />

      <div className="z-20 flex flex-col items-center justify-start pt-16 gap-12 w-full max-w-2xl text-center h-[600px]">
        {/* Spell Name Overlay - 上部中央やや下からフェードイン */}
        <div className="relative w-full flex justify-center h-16">
          {castState === "cast" && (
            <div className="absolute transform animate-spell-reveal">
              <p
                className={`${cinzel.className} text-5xl md:text-7xl font-black bg-clip-text text-transparent bg-gradient-to-r ${theme.gradient} drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]`}
                style={{ filter: `drop-shadow(0 0 30px ${theme.glow})` }}
              >
                {theme.name}
              </p>
            </div>
          )}
        </div>

        {/* Effect Area - 中央 */}
        <div
          className={`relative flex-1 w-full flex items-center justify-center ${castState === "cast" && currentMagic === "VENTUS" ? "translate-y-24" : "translate-y-8"}`}
        >
          {castState === "cast" && currentMagic === "VENTUS" && <WindEffect />}
          {castState === "cast" && currentMagic === "AGUAMENTI" && (
            <WaterEffect />
          )}
          {castState === "cast" && currentMagic === "INCENDIO" && (
            <FireEffect />
          )}
          {(currentMagic === "LUMOS" || currentMagic === "EXCALIBUR") &&
            castState === "cast" && <LightEffect />}

          {/* Flash Effect on Cast - 魔法の色を反映 (VENTUS以外で表示) */}
          {castState === "cast" && currentMagic !== "VENTUS" && (
            <div
              className="absolute w-[300px] h-[300px] rounded-full blur-[120px] animate-ping opacity-30 pointer-events-none"
              style={{ backgroundColor: `rgb(${theme.color})` }}
            />
          )}
        </div>

        {/* Instructions */}
        <div className="text-white/20 text-[10px] tracking-[0.3em] uppercase mt-12">
          URL Parameter: ?magic=ventus | lumos | aguamenti | incendio
        </div>
      </div>

      <style jsx global>{`
        /* Wind: Constant Swirling State Animations */
        @keyframes wind-vortex-layer {
          0% {
            transform: rotateX(75deg) translateZ(var(--z)) rotateZ(0deg);
            opacity: 0;
          }
          10% {
            opacity: var(--op);
          }
          90% {
            opacity: var(--op);
          }
          100% {
            transform: rotateX(75deg) translateZ(calc(var(--z) + 50px))
              rotateZ(360deg);
            opacity: 0;
          }
        }
        .animate-wind-vortex-layer {
          animation: wind-vortex-layer linear infinite;
        }

        @keyframes wind-flow {
          from {
            stroke-dashoffset: 60;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        .animate-wind-flow {
          animation: wind-flow 1.5s linear infinite;
        }

        @keyframes wind-particle-tornado {
          0% {
            transform: translateY(300px) rotateZ(0deg) scale(0);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          100% {
            transform: translateY(var(--ty)) rotateZ(var(--rz))
              translateX(var(--tx)) scale(1.5);
            opacity: 0;
          }
        }
        .animate-wind-particle-tornado {
          animation: wind-particle-tornado linear infinite;
        }

        /* Existing Animations */
        @keyframes vortex-rise {
          0% {
            transform: translateY(100px) scaleX(1);
            opacity: 0;
          }
          50% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-300px) scaleX(0.2);
            opacity: 0;
          }
        }
        @keyframes vortex-spin {
          from {
            transform: rotate(0deg) scale(0.8);
          }
          to {
            transform: rotate(360deg) scale(1.2);
          }
        }
        .animate-vortex-rise {
          animation: vortex-rise infinite linear;
        }
        .animate-vortex-spin {
          animation: vortex-spin 4s linear infinite;
        }

        /* Water Animations */
        @keyframes bubble-rise {
          0% {
            transform: translateY(50px) translateX(0);
            opacity: 0;
          }
          50% {
            opacity: 1;
            transform: translateY(-50px) translateX(10px);
          }
          100% {
            transform: translateY(-150px) translateX(-10px);
            opacity: 0;
          }
        }
        @keyframes ripple {
          0% {
            transform: scale(0.5);
            opacity: 1;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        .animate-bubble-rise {
          animation: bubble-rise infinite ease-out;
        }
        .animate-ripple {
          animation: ripple 2s ease-out infinite;
        }

        /* Fire Animations */
        @keyframes ember-fly {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-200px) translateX(30px) scale(0);
            opacity: 0;
          }
        }
        @keyframes fire-dance {
          0%,
          100% {
            transform: scaleY(1) scaleX(1) skewX(2deg);
            opacity: 1;
          }
          50% {
            transform: scaleY(1.05) scaleX(0.95) skewX(-2deg);
            opacity: 0.9;
          }
        }
        .animate-ember-fly {
          animation: ember-fly 1.5s infinite ease-in;
        }
        .animate-fire-dance {
          animation: fire-dance 0.8s infinite alternate ease-in-out;
        }

        @keyframes light-beam {
          0%,
          100% {
            transform: scaleX(1);
            opacity: 0.2;
          }
          50% {
            transform: scaleX(2.5);
            opacity: 0.5;
          }
        }
        .animate-light-beam {
          animation: light-beam 0.3s infinite;
        }

        @keyframes lumos-filament {
          0% {
            stroke-dasharray: 0 var(--dash);
            stroke-dashoffset: 0;
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            stroke-dasharray: var(--dash) var(--dash);
            stroke-dashoffset: calc(var(--dash) * -1);
            opacity: 0;
          }
        }

        @keyframes light-particle-fly {
          0% {
            transform: translate(0, 0) scale(1.5);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) scale(0);
            opacity: 0;
          }
        }

        @keyframes reverse-spin {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }

        .animate-reverse-spin {
          animation: reverse-spin linear infinite;
        }
        .animate-lumos-filament {
          animation: lumos-filament linear infinite;
        }
        .animate-light-particle-fly {
          animation: light-particle-fly linear infinite;
        }

        @keyframes water-mist-drift {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
            opacity: 0.3;
          }
          50% {
            transform: translate(30px, -20px) scale(1.1);
            opacity: 0.6;
          }
        }
        @keyframes water-sphere-float {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
          33% {
            transform: translate(15px, -25px) rotate(10deg) scale(1.05);
          }
          66% {
            transform: translate(-10px, 15px) rotate(-5deg) scale(0.95);
          }
        }
        @keyframes water-ripple-flow {
          0% {
            transform: scale(0.3);
            border-color: rgba(255, 255, 255, 0.6);
            opacity: 1;
            border-width: 4px;
          }
          100% {
            transform: scale(3.5);
            border-color: rgba(30, 144, 255, 0);
            opacity: 0;
            border-width: 1px;
          }
        }
        .animate-water-mist-drift {
          animation: water-mist-drift 10s ease-in-out infinite;
        }
        .animate-water-sphere-float {
          animation: water-sphere-float 6s ease-in-out infinite;
        }
        .animate-water-ripple-flow {
          animation: water-ripple-flow 4s ease-out infinite;
        }

        @keyframes water-rotate {
          0% {
            transform: rotateX(70deg) rotateZ(0deg) scale(0.8);
            opacity: 0.3;
          }
          50% {
            transform: rotateX(70deg) rotateZ(180deg) scale(1.1);
            opacity: 0.6;
          }
          100% {
            transform: rotateX(70deg) rotateZ(360deg) scale(0.8);
            opacity: 0.3;
          }
        }
        @keyframes water-rotate-reverse {
          0% {
            transform: rotateX(70deg) rotateZ(360deg) scale(1.1);
            opacity: 0.2;
          }
          50% {
            transform: rotateX(70deg) rotateZ(180deg) scale(0.9);
            opacity: 0.4;
          }
          100% {
            transform: rotateX(70deg) rotateZ(0deg) scale(1.1);
            opacity: 0.2;
          }
        }
        .animate-water-rotate {
          animation: water-rotate 4s linear infinite;
        }
        .animate-water-rotate-reverse {
          animation: water-rotate-reverse 3s linear infinite;
        }

        @keyframes spell-reveal {
          0% {
            opacity: 0;
            transform: translateY(40px) scale(0.9);
            filter: blur(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0px);
          }
        }
        .animate-spell-reveal {
          animation: spell-reveal 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
        }
      `}</style>
    </main>
  );
}

export default function EffectTestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0815]" />}>
      <EffectContent />
    </Suspense>
  );
}
