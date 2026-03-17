"use client";

import { useState, useEffect, Suspense } from "react";
import { FloatingParticles } from "@/components/floating-particles";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type MagicType = "LUMOS" | "VENTUS" | "AGUAMENTI" | "EXCALIBUR";

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
      
      {/* HUD Link */}
      <div className="absolute top-8 left-8 z-50">
        <Link 
          href="/test/wand" 
          className="text-white/40 hover:text-white transition-colors flex items-center gap-2 group"
        >
          <span className="text-xl group-hover:-translate-x-1 transition-transform">←</span>
          <span className="font-medium tracking-wider text-sm">WAND TEST</span>
        </Link>
      </div>

      <div className="z-20 flex flex-col items-center justify-center gap-12 w-full max-w-2xl text-center">
        {/* Title Section */}
        <div className="space-y-3">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white/80 to-white/20 animate-fade-in">
            MAGIC EFFECTS
          </h1>
          <p className="text-magic-glow/60 text-sm md:text-base font-medium tracking-[0.2em] uppercase">
            {currentMagic} MODE
          </p>
        </div>

        {/* Effect Area */}
        <div className="relative h-[400px] w-full flex items-center justify-center">
          {/* Flash Effect on Cast - 魔法の色を反映 */}
          {castState === "cast" && (
            <div 
              className="absolute inset-0 rounded-full blur-[120px] animate-ping opacity-30 pointer-events-none"
              style={{ backgroundColor: `rgb(${theme.color})` }}
            />
          )}

          {/* Spell Name Overlay */}
          <div className={`
            absolute transform transition-all duration-700 ease-out
            ${castState === "cast" ? "opacity-100 translate-y-0 scale-125" : "opacity-0 translate-y-12 scale-90"}
          `}>
            <p 
              className={`text-6xl md:text-8xl font-black italic bg-clip-text text-transparent bg-gradient-to-r ${theme.gradient}`}
              style={{ filter: `drop-shadow(0 0 30px ${theme.glow})` }}
            >
              {theme.name}
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-white/20 text-[10px] tracking-[0.3em] uppercase mt-12">
          URL Parameter: ?magic=ventus | lumos | aguamenti
        </div>
      </div>

      <style jsx global>{`
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
