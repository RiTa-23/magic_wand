"use client";

import Image from "next/image";
import { Cinzel, Cormorant_Garamond } from "next/font/google";
import { useEffect, useRef } from "react";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cinzel",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

type Particle = {
  x: number;
  y: number;
  radius: number;
  riseSpeed: number;
  driftSpeed: number;
  phase: number;
  twinkleSpeed: number;
  resetAt: number;
};

function MagicParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const getDpr = () => Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    const makeParticle = (w: number, h: number): Particle => {
      const spawnBand = Math.min(240, h * 0.32);
      const y = h - Math.pow(Math.random(), 2) * spawnBand;
      const mostlyBottom = Math.random() < 0.78;

      return {
        x: Math.random() * w,
        y,
        radius: 0.8 + Math.random() * 2.2,
        riseSpeed: 0.22 + Math.random() * 0.9,
        driftSpeed: (Math.random() - 0.5) * 0.18,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.012 + Math.random() * 0.028,
        resetAt: mostlyBottom ? 0.42 + Math.random() * 0.22 : 1.2,
      };
    };

    const resize = () => {
      const dpr = getDpr();
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const area = window.innerWidth * window.innerHeight;
      const targetCount = Math.max(70, Math.min(170, Math.floor(area / 16000)));

      const particles = particlesRef.current;
      while (particles.length < targetCount) {
        particles.push(makeParticle(window.innerWidth, window.innerHeight));
      }
      if (particles.length > targetCount) {
        particles.splice(targetCount);
      }
    };

    const tick = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      const now = performance.now();
      const particles = particlesRef.current;

      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(255, 140, 60, 0.85)";

      for (const p of particles) {
        p.y -= p.riseSpeed;
        p.phase += p.twinkleSpeed * (now / 16);
        p.x += p.driftSpeed + Math.sin(p.phase * 0.9) * 0.08;

        const heightT = Math.max(0, Math.min(1, (h - p.y) / h));

        if (p.y < -24 || (p.resetAt <= 1 && heightT >= p.resetAt)) {
          const spawnBand = Math.min(240, h * 0.32);
          p.y = h - Math.pow(Math.random(), 2) * spawnBand;
          p.x = Math.random() * w;
          p.radius = 0.8 + Math.random() * 2.2;
          p.riseSpeed = 0.22 + Math.random() * 0.9;
          p.driftSpeed = (Math.random() - 0.5) * 0.18;
          p.phase = Math.random() * Math.PI * 2;
          p.twinkleSpeed = 0.012 + Math.random() * 0.028;
          p.resetAt = Math.random() < 1.08 ? 0.42 + Math.random() * 0.22 : 1.2;
        }
        if (p.x < -16) p.x = w + 16;
        if (p.x > w + 16) p.x = -16;

        const fadeIn = Math.min(1, heightT / 0.22);
        const fadeOut = Math.min(1, (1 - heightT) / 0.14);
        const resetFade =
          p.resetAt > 1
            ? 1
            : Math.max(0, Math.min(1, (p.resetAt - heightT) / 0.1));
        const heightFade = Math.min(fadeIn, fadeOut, resetFade);

        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.phase));
        const alpha = (0.1 + 0.62 * twinkle) * heightFade;

        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 170, 85, ${alpha.toFixed(3)})`;
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      rafRef.current = window.requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-20"
      aria-hidden="true"
    />
  );
}

function StartScreen() {
  return (
    <div
      className={
        "relative min-h-screen w-full overflow-hidden bg-slate-950 text-amber-100 " +
        `${cinzel.variable} ${cormorant.variable}`
      }
    >
      <Image
        src="/yuchimage/yuchisiro.jpg"
        alt="yuchisiro background"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center opacity-90"
      />

      <div className="absolute inset-0 z-10 bg-gradient-to-b from-slate-950/30 via-slate-950/70 to-slate-950/95" />
      <div className="absolute inset-x-0 bottom-0 z-10 h-72 bg-gradient-to-t from-orange-500/20 via-orange-400/10 to-transparent blur-2xl" />
      <MagicParticles />

      <div className="absolute inset-0 z-30">
        <div className="absolute left-6 top-6 h-16 w-16 border-l border-t border-amber-700/70" />
        <div className="absolute right-6 top-6 h-16 w-16 border-r border-t border-amber-700/70" />
        <div className="absolute bottom-6 left-6 h-16 w-16 border-b border-l border-amber-700/70" />
        <div className="absolute bottom-6 right-6 h-16 w-16 border-b border-r border-amber-700/70" />
      </div>

      <main className="relative z-40 flex min-h-screen items-center justify-center px-6">
        <section className="w-full max-w-3xl text-center">
          <p
            className="mag-subtitle mb-4 font-[var(--font-cormorant)] text-lg tracking-[0.35em] text-amber-200/80"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            WELCOME TO THE
          </p>

          <h1
            className="mag-title font-[var(--font-cinzel)] text-5xl font-bold tracking-[0.22em] text-orange-400 sm:text-6xl md:text-7xl"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            MAGIC WAND
          </h1>

          <p
            className="mag-subtitle mt-6 font-[var(--font-cormorant)] text-xl text-amber-100/80 sm:text-2xl"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            Wind & Wave
          </p>

          <div className="mag-enter-wrap mt-12 flex items-center justify-center">
            <button
              type="button"
              className="mag-enter relative overflow-hidden rounded-md border border-amber-700/70 bg-slate-950/40 px-10 py-4 font-[var(--font-cinzel)] text-base tracking-[0.35em] text-amber-100 backdrop-blur-sm transition-colors hover:bg-slate-950/55 focus:outline-none focus:ring-2 focus:ring-amber-300/50"
              style={{ fontFamily: "var(--font-cinzel)" }}
            >
              <span className="relative z-10">ENTER</span>
              <span className="mag-shimmer absolute inset-y-0 left-[-40%] w-[40%] bg-gradient-to-r from-transparent via-amber-200/35 to-transparent" />
            </button>
          </div>

          <p
            className="mag-subtitle mt-10 font-[var(--font-cormorant)] text-base italic text-amber-200/60"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            MADE Hiro Yuchi Rita Lisu
          </p>
        </section>
      </main>

      <style>{`
        @keyframes mag-fade-slide {
          0% {
            opacity: 0;
            transform: translateY(-14px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes mag-fade {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes mag-shimmer {
          0% {
            transform: translateX(-120%) skewX(-18deg);
          }
          100% {
            transform: translateX(340%) skewX(-18deg);
          }
        }

        .mag-title {
          animation: mag-fade-slide 900ms ease-out both;
        }

        .mag-subtitle {
          animation: mag-fade 1200ms ease-out both;
          animation-delay: 220ms;
        }

        .mag-enter:hover .mag-shimmer {
          animation: mag-shimmer 1100ms linear infinite;
        }
      `}</style>
    </div>
  );
}

export default function Home() {
  return <StartScreen />;
}
