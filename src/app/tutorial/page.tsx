"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FloatingParticles } from "@/components/floating-particles";

type TutorialSlide = {
  imageSrc: string;
  imageAlt: string;
  description: string;
};

function formatPageNumber(n: number) {
  return String(n).padStart(2, "0");
}

export default function TutorialPage() {
  const slides = useMemo<TutorialSlide[]>(
    () => [
      {
        imageSrc: "/yuchimage/yuchisiro.jpg",
        imageAlt: "杖の準備",
        description: "杖を手に取り、姿勢を整えましょう。",
      },
      {
        imageSrc: "/yuchimage/yuchisiro.jpg",
        imageAlt: "接続の確認",
        description: "デバイスが接続できているか確認します。",
      },
      {
        imageSrc: "/yuchimage/yuchisiro.jpg",
        imageAlt: "魔力の集中",
        description: "深呼吸して、魔力を一点に集めます。",
      },
      {
        imageSrc: "/yuchimage/yuchisiro.jpg",
        imageAlt: "呪文の詠唱",
        description: "呪文をはっきり唱えてください。",
      },
      {
        imageSrc: "/yuchimage/yuchisiro.jpg",
        imageAlt: "ジェスチャー",
        description: "杖で合図の動きを描きます。",
      },
      {
        imageSrc: "/yuchimage/yuchisiro.jpg",
        imageAlt: "発動の合図",
        description: "光が集まったら、発動のタイミングです。",
      },
      {
        imageSrc: "/yuchimage/yuchisiro.jpg",
        imageAlt: "結果の確認",
        description: "反応が出たか、目と耳で確かめます。",
      },
      {
        imageSrc: "/yuchimage/yuchisiro.jpg",
        imageAlt: "再調整",
        description: "うまくいかない時は、距離と向きを調整します。",
      },
      {
        imageSrc: "/yuchimage/yuchisiro.jpg",
        imageAlt: "連携",
        description: "魔法は道具と連携して強くなります。",
      },
      {
        imageSrc: "/yuchimage/yuchisiro.jpg",
        imageAlt: "準備完了",
        description: "準備完了。次はプレイ画面で実際に試しましょう。",
      },
    ],
    [],
  );

  const total = slides.length;
  const [index, setIndex] = useState(0);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [phase, setPhase] = useState<"idle" | "prep" | "animating" | "reset">(
    "idle",
  );
  const rafRef = useRef<number | null>(null);

  const isAnimating = phase !== "idle";
  const canPrev = index > 0 && !isAnimating;
  const canNext = index < total - 1 && !isAnimating;

  const startTransition = useCallback(
    (nextIndex: number, nextDirection: "next" | "prev") => {
      if (isAnimating) return;
      if (nextIndex === index) return;
      if (nextIndex < 0 || nextIndex >= total) return;

      setDirection(nextDirection);
      setPendingIndex(nextIndex);
      setPhase("prep");

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        // 次フレームで「移動後」のtransformに切り替えてトランジションを確実に発火させる
        setPhase("animating");
      });
    },
    [index, isAnimating, total],
  );

  const goPrev = useCallback(() => {
    if (!canPrev) return;
    startTransition(index - 1, "prev");
  }, [canPrev, index, startTransition]);

  const goNext = useCallback(() => {
    if (!canNext) return;
    startTransition(index + 1, "next");
  }, [canNext, index, startTransition]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isAnimating) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, isAnimating]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const activeSlide = slides[index];
  const nextSlide = pendingIndex !== null ? slides[pendingIndex] : null;

  const currentFromX = 0;
  const currentToX = direction === "next" ? -100 : 100;
  const incomingFromX = direction === "next" ? 100 : -100;
  const incomingToX = 0;

  const currentX = phase === "animating" ? currentToX : currentFromX;
  const incomingX = phase === "animating" ? incomingToX : incomingFromX;

  const enableTransition = phase === "animating";

  useEffect(() => {
    if (phase !== "reset") return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setPhase("idle");
    });
  }, [phase]);

  return (
    <main className="relative min-h-svh w-full overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)]">
      <FloatingParticles />

      <div className="relative z-20 min-h-svh px-6 py-8">
        {/* Back link (match Play/Settings style) */}
        <Link
          href="/home"
          className="absolute top-10 left-10 group flex items-center gap-2 text-[color:var(--gold-dim)] transition-colors hover:text-[color:var(--gold-bright)]"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-xs uppercase tracking-widest text-shadow-glow">
            Back
          </span>
        </Link>

        {/* Center area (carousel) */}
        <div className="min-h-svh flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="relative overflow-hidden rounded-2xl border border-[color:var(--gold)]/15 bg-black/20 backdrop-blur-sm">
              <div className="relative h-[420px]">
                {/* Current slide */}
                <div
                  key={index}
                  className={`absolute inset-0 ${enableTransition ? "transition-transform duration-500 ease-in-out" : ""}`}
                  style={{ transform: `translateX(${currentX}%)` }}
                >
                  <SlideContent slide={activeSlide} />
                </div>

                {/* Incoming slide (only during transition) */}
                {nextSlide && (
                  <div
                    key={pendingIndex}
                    className={`absolute inset-0 ${enableTransition ? "transition-transform duration-500 ease-in-out" : ""}`}
                    style={{ transform: `translateX(${incomingX}%)` }}
                    onTransitionEnd={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (pendingIndex === null) return;
                      setIndex(pendingIndex);
                      setPendingIndex(null);
                      setPhase("reset");
                    }}
                  >
                    <SlideContent slide={nextSlide} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        {/* Page number (bottom center, slightly above controls) */}
        <div className="absolute left-0 right-0 bottom-24 flex items-center justify-center text-sm font-semibold tracking-[0.2em]">
          <span className="text-[color:var(--gold-bright)]">
            {formatPageNumber(index + 1)}
          </span>
          <span className="text-[color:var(--gold-dim)]"> / </span>
          <span className="text-[color:var(--gold-dim)]">
            {formatPageNumber(total)}
          </span>
        </div>

        <div className="absolute left-0 right-0 bottom-10 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={goPrev}
            disabled={!canPrev}
            className="h-10 w-10 rounded-full border border-[color:var(--gold)]/25 bg-black/20 backdrop-blur-sm transition-opacity disabled:opacity-30"
            aria-label="前のページ"
          >
            <ChevronLeft className="mx-auto h-5 w-5 text-[color:var(--gold-bright)]" />
          </button>

          <div
            className="flex items-center gap-2"
            aria-label="ページインジケーター"
          >
            {slides.map((_, i) => (
              <div
                // indicator only (no click per spec)
                key={i}
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    i === index ? "var(--gold-bright)" : "var(--gold-dim)",
                  opacity: i === index ? 1 : 0.35,
                }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={!canNext}
            className="h-10 w-10 rounded-full border border-[color:var(--gold)]/25 bg-black/20 backdrop-blur-sm transition-opacity disabled:opacity-30"
            aria-label="次のページ"
          >
            <ChevronRight className="mx-auto h-5 w-5 text-[color:var(--gold-bright)]" />
          </button>
        </div>
      </div>
    </main>
  );
}

function SlideContent({ slide }: { slide: TutorialSlide }) {
  return (
    <div className="h-full w-full p-6 flex flex-col items-center justify-center gap-6">
      <div className="relative w-full max-w-sm aspect-[4/3] overflow-hidden rounded-xl border border-[color:var(--gold)]/15">
        <Image
          src={slide.imageSrc}
          alt={slide.imageAlt}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 80vw, 420px"
          priority
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.55))",
          }}
          aria-hidden="true"
        />
      </div>

      <p className="text-center text-base leading-relaxed tracking-wide text-[color:var(--foreground)]/90">
        {slide.description}
      </p>
    </div>
  );
}
