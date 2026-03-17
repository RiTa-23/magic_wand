"use client";

import { useState, useEffect } from "react";
import { HeroMagicCircle } from "@/components/hero-magic-circle";
import { FloatingParticles } from "@/components/floating-particles";
import Link from "next/link";

export default function EffectTestPage() {
  const [mounted, setMounted] = useState(false);
  const [castState, setCastState] = useState<"idle" | "charging" | "cast">("idle");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCast = () => {
    setCastState("charging");
    setTimeout(() => {
      setCastState("cast");
      setTimeout(() => {
        setCastState("idle");
      }, 3000);
    }, 1500);
  };

  if (!mounted) return <div className="min-h-screen bg-[#0a0815]" />;

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_center,_#1a1033_0%,_#0a0815_100%)] flex flex-col items-center justify-center p-4">
      {/* Background Ambience */}
      <FloatingParticles />
      
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
            Visual Feedback & Particle System Test
          </p>
        </div>

        {/* Magic Circle Area */}
        <div className="relative group perspective-1000 h-[400px] w-full flex items-center justify-center">
          <div className={`
            transition-all duration-700 ease-out transform
            ${castState === "charging" ? "scale-110 rotate-[20deg] brightness-150" : ""}
            ${castState === "cast" ? "scale-[1.5] brightness-200 blur-[2px]" : ""}
            ${castState === "idle" ? "scale-100 hover:scale-[1.02]" : ""}
          `}>
            <HeroMagicCircle />
          </div>

          {/* Flash Effect on Cast */}
          {castState === "cast" && (
            <div className="absolute inset-0 bg-white rounded-full blur-[100px] animate-ping opacity-20 pointer-events-none" />
          )}

          {/* Spell Name Overlay */}
          <div className={`
            absolute bottom-0 transform transition-all duration-500
            ${castState === "cast" ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-90"}
          `}>
            <p className="text-5xl font-black italic bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-white to-purple-400 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
              EXCALIBUR!!
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
          <button 
            onClick={handleCast}
            disabled={castState !== "idle"}
            className={`
              relative group overflow-hidden px-8 py-4 rounded-xl border transition-all duration-300
              ${castState === "idle" 
                ? "bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10" 
                : "bg-white/2 border-white/5 opacity-50 cursor-not-allowed"}
            `}
          >
            <div className="flex items-center justify-center gap-3">
              <span className={`w-2 h-2 rounded-full ${castState === "idle" ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
              <span className="font-bold tracking-widest text-sm text-white/90">TRIGGER SPELL</span>
            </div>
          </button>

          <button 
            className="relative group overflow-hidden px-8 py-4 rounded-xl border border-white/10 bg-white/5 transition-all duration-300 hover:border-blue-400/50 hover:bg-blue-400/5"
          >
            <span className="font-bold tracking-widest text-sm text-white/90">PARTICLE SETTINGS</span>
          </button>
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
        .perspective-1000 {
          perspective: 1000px;
        }
      `}</style>
    </main>
  );
}
