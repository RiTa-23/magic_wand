"use client";

import { useState, useEffect, Suspense } from "react";
import { FloatingParticles } from "@/components/floating-particles";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type MagicType = "LUMOS" | "VENTUS" | "AGUAMENTI" | "INCENDIO" | "EXCALIBUR";

const MAGIC_THEMES = {
  LUMOS: {
    name: "LUMOS!",
    color: "255, 255, 255", // White
    particles: "255, 250, 220", // Warm white
    gradient: "from-yellow-200 via-white to-yellow-100",
    glow: "rgba(255, 255, 255, 0.8)"
  },
  VENTUS: {
    name: "VENTUS!",
    color: "130, 255, 210", // Mint/Emerald
    particles: "110, 231, 183", // Emerald
    gradient: "from-emerald-300 via-white to-teal-200",
    glow: "rgba(110, 231, 183, 0.8)"
  },
  AGUAMENTI: {
    name: "AGUAMENTI!",
    color: "30, 144, 255", // Dodger Blue
    particles: "135, 206, 250", // Light Sky Blue
    gradient: "from-blue-600 via-cyan-100 to-blue-400",
    glow: "rgba(0, 191, 255, 0.8)"
  },
  INCENDIO: {
    name: "INCENDIO!",
    color: "255, 69, 0", // Red Orange
    particles: "255, 100, 50", // Fiery orange
    gradient: "from-red-600 via-orange-400 to-yellow-500",
    glow: "rgba(255, 69, 0, 0.8)"
  },
  EXCALIBUR: {
    name: "EXCALIBUR!!",
    color: "100, 180, 255", // Blue
    particles: "212, 175, 55", // Classic gold
    gradient: "from-blue-400 via-white to-purple-400",
    glow: "rgba(255, 255, 255, 0.8)"
  }
};

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
      setTimeout(() => {
        setCastState("idle");
      }, 3000);
    }, 1000);
  };

  if (!mounted) return <div className="min-h-screen bg-[#0a0815]" />;

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_center,_#1a1033_0%,_#0a0815_100%)] flex flex-col items-center justify-center p-4">
      {/* Background Ambience - 魔法の色に合わせたパーティクル */}
      <FloatingParticles color={theme.particles} />
      


      <div className="z-20 flex flex-col items-center justify-start pt-20 gap-12 w-full max-w-2xl text-center h-[600px]">
        {/* Spell Name Overlay - 上部中央に配置し、左から入って右に消える */}
        <div className="relative w-full flex justify-center h-24">
          {castState === "cast" && (
            <div className="absolute transform animate-slide-through">
              <p 
                className={`text-6xl md:text-8xl font-black italic bg-clip-text text-transparent bg-gradient-to-r ${theme.gradient} drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]`}
                style={{ filter: `drop-shadow(0 0 30px ${theme.glow})` }}
              >
                {theme.name}
              </p>
            </div>
          )}
        </div>

        {/* Effect Area - 中央 */}
        <div className="relative flex-1 w-full flex items-center justify-center">
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
        @keyframes slide-through {
          0% { opacity: 0; transform: translateX(-100vw) scale(0.6); filter: blur(20px); }
          45% { opacity: 1; transform: translateX(-2vw) scale(1.1); filter: blur(0px); }
          55% { opacity: 1; transform: translateX(2vw) scale(1.1); filter: blur(0px); }
          100% { opacity: 0; transform: translateX(100vw) scale(0.6); filter: blur(20px); }
        }
        .animate-slide-through {
          animation: slide-through 5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
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
