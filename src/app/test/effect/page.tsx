"use client";

import { useState, useEffect, Suspense } from "react";
import { FloatingParticles } from "@/components/floating-particles";
import Link from "next/link";
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
    glow: "rgba(255, 255, 255, 0.8)"
  },
  VENTUS: {
    name: "VENTUS",
    color: "0, 255, 200", // Aqua/Neon Green
    particles: "52, 211, 153", // Emerald
    gradient: "from-[#0891b2] via-[#10b981] to-[#4ade80]", // Aqua -> Green -> Neon
    glow: "rgba(16, 185, 129, 0.6)"
  },
  AGUAMENTI: {
    name: "AGUAMENTI",
    color: "30, 144, 255", // Dodger Blue
    particles: "135, 206, 250", // Light Sky Blue
    gradient: "from-blue-600 via-cyan-100 to-blue-400",
    glow: "rgba(0, 191, 255, 0.8)"
  },
  INCENDIO: {
    name: "INCENDIO",
    color: "255, 69, 0", // Red Orange
    particles: "255, 100, 50", // Fiery orange
    gradient: "from-red-600 via-orange-400 to-yellow-500",
    glow: "rgba(255, 69, 0, 0.8)"
  },
  EXCALIBUR: {
    name: "EXCALIBUR",
    color: "100, 180, 255", // Blue
    particles: "212, 175, 55", // Classic gold
    gradient: "from-blue-400 via-white to-purple-400",
    glow: "rgba(255, 255, 255, 0.8)"
  }
};

/**風魔法のエフェクト：中心コアを排した3Dボルテックス（竜巻） */
function WindEffect() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible [perspective:1200px] [transform-style:preserve-3d] translate-y-32">
      {/* 1. Bloom Base (空間の光のベール) - 輝度強化 */}
      <div className="absolute w-[500px] h-[700px] bg-[radial-gradient(circle,_rgba(8,145,178,0.4)_0%,_rgba(16,185,129,0.15)_40%,_transparent_70%)] rounded-full blur-[100px] animate-pulse" />

      {/* 2. 3D Vortex Structure (竜巻の形をした光の筋) */}
      <div className="relative w-full h-full flex items-center justify-center [transform-style:preserve-3d]">
        {[...Array(20)].map((_, i) => {
          const size = 100 + i * 25;
          const zPos = i * 25 - 200;
          const opacity = 0.1 + (i * 0.04);
          // 高さ（i）に応じて色を変える (Aqua -> Neon Green)
          const color = i < 10 ? '#0891b2' : '#4ade80';
          
          return (
            <div
              key={`tornado-layer-${i}`}
              className="absolute animate-wind-vortex-layer"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                // @ts-ignore
                "--z": `${zPos}px`,
                "--op": opacity,
                animationDelay: `${i * -0.5}s`,
                animationDuration: `${2 + i * 0.05}s`
              } as any}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-[0_0_25px_var(--glow-color)]" 
                style={{ '--glow-color': color } as any}>
                <path
                  d="M10,50 A40,40 0 0,1 90,50"
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  className="opacity-85 animate-wind-flow"
                  strokeDasharray="10 50"
                  style={{ filter: 'blur(1px)' }}
                />
                {/* Bloom layer per ring - 輝度点灯 */}
                <path
                  d="M20,50 A30,30 0 0,1 80,50"
                  fill="none"
                  stroke={color}
                  strokeWidth={6}
                  strokeLinecap="round"
                  className="opacity-45 animate-wind-flow"
                  style={{ filter: 'blur(6px)' }}
                />
              </svg>
            </div>
          );
        })}
      </div>

      {/* 3. Rising Particles (竜巻に巻き込まれる粒子) - 輝度強化 */}
      <div className="absolute inset-0 flex items-center justify-center [transform-style:preserve-3d]">
        {[...Array(30)].map((_, i) => (
          <div
            key={`vortex-p-${i}`}
            className="absolute bg-white/90 rounded-full blur-[1px] animate-wind-particle-tornado"
            style={{
              width: `${1 + Math.random() * 2}px`,
              height: `${2 + Math.random() * 8}px`,
              left: `${45 + Math.random() * 10}%`,
              // @ts-ignore
              "--tx": `${(Math.random() - 0.5) * 300}px`,
              "--ty": `${-300 - Math.random() * 400}px`,
              "--rz": `${Math.random() * 720}deg`,
              animationDelay: `${Math.random() * -5}s`,
              animationDuration: `${1 + Math.random() * 1.5}s`
            } as any}
          />
        ))}
      </div>
    </div>
  );
}

/** 水魔法のエフェクト：上昇する泡と青い波紋 */
function WaterEffect() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute bottom-1/4 w-3 h-3 border border-blue-300/40 rounded-full animate-bubble-rise"
          style={{
            left: `${40 + Math.random() * 20}%`,
            animationDelay: `${i * 0.15}s`,
            animationDuration: `${1.5 + Math.random() * 1.5}s`,
            width: `${4 + Math.random() * 6}px`,
            height: `${4 + Math.random() * 6}px`,
          }}
        />
      ))}
      {/* Swirling water ring */}
      <div className="absolute w-72 h-16 border-2 border-cyan-400/30 rounded-[100%] animate-water-rotate blur-[1px]" />
      <div className="absolute w-64 h-12 border-2 border-blue-300/20 rounded-[100%] animate-water-rotate-reverse blur-[2px]" />
      
      <div className="w-80 h-80 bg-blue-500/10 rounded-full blur-[80px] animate-pulse" />
      <div className="absolute w-48 h-48 border-2 border-blue-400/30 rounded-full animate-ripple" />
    </div>
  );
}

/** 炎魔法のエフェクト：揺らぐ炎と火の粉 */
function FireEffect() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
      {[...Array(25)].map((_, i) => (
        <div
          key={i}
          className="absolute bottom-1/3 w-1 h-1 bg-orange-500 rounded-full animate-ember-fly"
          style={{
            left: `${45 + Math.random() * 10}%`,
            boxShadow: '0 0 10px #ff4500',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
      <div className="w-40 h-64 bg-gradient-to-t from-red-600 via-orange-500 to-transparent rounded-full blur-[40px] animate-fire-dance" />
    </div>
  );
}

/** 光魔法のエフェクト：中央からの強い輝き */
function LightEffect() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-1 h-full bg-white/40 blur-[20px] animate-light-beam" />
      <div className="absolute w-64 h-64 bg-white rounded-full blur-[100px] animate-ping opacity-20" />
      <div className="absolute w-32 h-32 bg-yellow-200 rounded-full blur-[40px] animate-pulse" />
    </div>
  );
}

function EffectContent() {
  const [mounted, setMounted] = useState(false);
  const [castState, setCastState] = useState<"idle" | "charging" | "cast">("idle");
  const searchParams = useSearchParams();
  
  // URLパラメータ ?magic=ventus などから魔法の種類を取得
  const magicParam = searchParams.get("magic")?.toUpperCase() as MagicType;
  const currentMagic = MAGIC_THEMES[magicParam] ? magicParam : "EXCALIBUR";
  const theme = MAGIC_THEMES[currentMagic];

  useEffect(() => {
    setMounted(true);
    
    // パラメータがある場合は自動的に発動（テスト用）
    if (searchParams.get("magic")) {
      handleCast();
    }
  }, [searchParams]);

  const handleCast = () => {
    setCastState("charging");
    setTimeout(() => {
      setCastState("cast");
    }, 1000);
  };

  if (!mounted) return <div className="min-h-screen bg-[#0a0815]" />;

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_center,_#1a1033_0%,_#0a0815_100%)] flex flex-col items-center justify-center p-4">
      {/* Background Ambience - 魔法の色に合わせたパーティクル */}
      <FloatingParticles color={theme.particles} />
      


      <div className="z-20 flex flex-col items-center justify-start pt-8 gap-12 w-full max-w-2xl text-center h-[600px]">
        {/* Spell Name Overlay - 上部中央に配置し、左から入って右に消える */}
        <div className="relative w-full flex justify-center h-24">
          {castState === "cast" && (
            <div className="absolute transform animate-slide-in">
              <p 
                className={`${cinzel.className} text-6xl md:text-8xl font-black bg-clip-text text-transparent bg-gradient-to-r ${theme.gradient} drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]`}
                style={{ filter: `drop-shadow(0 0 30px ${theme.glow})` }}
              >
                {theme.name}
              </p>
            </div>
          )}
        </div>

        {/* Effect Area - 中央 */}
        <div className="relative flex-1 w-full flex items-center justify-center">
          {castState === "cast" && currentMagic === "VENTUS" && <WindEffect />}
          {castState === "cast" && currentMagic === "AGUAMENTI" && <WaterEffect />}
          {castState === "cast" && currentMagic === "INCENDIO" && <FireEffect />}
          {castState === "cast" && currentMagic === "LUMOS" && <LightEffect />}
          
          {/* Flash Effect on Cast - 魔法の色を反映 */}
          {castState === "cast" && (
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
          0% { transform: rotateX(75deg) translateZ(var(--z)) rotateZ(0deg); opacity: 0; }
          10% { opacity: var(--op); }
          90% { opacity: var(--op); }
          100% { transform: rotateX(75deg) translateZ(calc(var(--z) + 50px)) rotateZ(360deg); opacity: 0; }
        }
        .animate-wind-vortex-layer {
          animation: wind-vortex-layer linear infinite;
        }

        @keyframes wind-flow {
          from { stroke-dashoffset: 60; }
          to { stroke-dashoffset: 0; }
        }
        .animate-wind-flow { animation: wind-flow 1.5s linear infinite; }

        @keyframes wind-particle-tornado {
          0% { transform: translateY(300px) rotateZ(0deg) scale(0); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(var(--ty)) rotateZ(var(--rz)) translateX(var(--tx)) scale(1.5); opacity: 0; }
        }
        .animate-wind-particle-tornado { animation: wind-particle-tornado linear infinite; }

        /* Existing Animations */
        @keyframes vortex-rise {
          0% { transform: translateY(100px) scaleX(1); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translateY(-300px) scaleX(0.2); opacity: 0; }
        }
        @keyframes vortex-spin {
          from { transform: rotate(0deg) scale(0.8); }
          to { transform: rotate(360deg) scale(1.2); }
        }
        .animate-vortex-rise { animation: vortex-rise infinite linear; }
        .animate-vortex-spin { animation: vortex-spin 4s linear infinite; }

        /* Water Animations */
        @keyframes bubble-rise {
          0% { transform: translateY(50px) translateX(0); opacity: 0; }
          50% { opacity: 1; transform: translateY(-50px) translateX(10px); }
          100% { transform: translateY(-150px) translateX(-10px); opacity: 0; }
        }
        @keyframes ripple {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        .animate-bubble-rise { animation: bubble-rise infinite ease-out; }
        .animate-ripple { animation: ripple 2s ease-out infinite; }

        /* Fire Animations */
        @keyframes ember-fly {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-200px) translateX(30px) scale(0); opacity: 0; }
        }
        @keyframes fire-dance {
          0%, 100% { transform: scaleY(1) skewX(0deg); }
          50% { transform: scaleY(1.2) skewX(5deg); }
        }
        .animate-ember-fly { animation: ember-fly 1.5s infinite ease-in; }
        .animate-fire-dance { animation: fire-dance 0.5s infinite alternate; }

        /* Light Animations */
        @keyframes light-beam {
          0%, 100% { transform: scaleX(1); opacity: 0.2; }
          50% { transform: scaleX(2.5); opacity: 0.5; }
        }
        .animate-light-beam { animation: light-beam 0.3s infinite; }

        @keyframes reverse-spin {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-reverse-spin { animation: reverse-spin 6s linear infinite; }

        @keyframes water-rotate {
          0% { transform: rotateX(70deg) rotateZ(0deg) scale(0.8); opacity: 0.3; }
          50% { transform: rotateX(70deg) rotateZ(180deg) scale(1.1); opacity: 0.6; }
          100% { transform: rotateX(70deg) rotateZ(360deg) scale(0.8); opacity: 0.3; }
        }
        @keyframes water-rotate-reverse {
          0% { transform: rotateX(70deg) rotateZ(360deg) scale(1.1); opacity: 0.2; }
          50% { transform: rotateX(70deg) rotateZ(180deg) scale(0.9); opacity: 0.4; }
          100% { transform: rotateX(70deg) rotateZ(0deg) scale(1.1); opacity: 0.2; }
        }
        .animate-water-rotate { animation: water-rotate 4s linear infinite; }
        .animate-water-rotate-reverse { animation: water-rotate-reverse 3s linear infinite; }

        @keyframes slide-in {
          0% { opacity: 0; transform: translateX(-100vw) scale(0.6); filter: blur(20px); }
          100% { opacity: 1; transform: translateX(0) scale(1.1); filter: blur(0px); }
        }
        .animate-slide-in {
          animation: slide-in 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
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
