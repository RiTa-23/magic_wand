"use client";

import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FloatingParticles } from "@/components/floating-particles";

type TutorialSlide = {
  imageSrc: string;
  imageAlt: string;
  description: string;
};

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
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mq.matches);
    update();

    // Safari fallback: addListener/removeListener
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }

    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  const isAnimating = phase !== "idle";
  const canPrev = index > 0 && !isAnimating;
  const canNext = index < total - 1 && !isAnimating;

  const startTransition = useCallback(
    (nextIndex: number, nextDirection: "next" | "prev") => {
      if (nextIndex === index) return;
      if (nextIndex < 0 || nextIndex >= total) return;

      // Accessibility: if the user prefers reduced motion, switch immediately.
      if (prefersReducedMotion) {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        setDirection(nextDirection);
        setPendingIndex(null);
        setPhase("idle");
        setIndex(nextIndex);
        return;
      }

      if (isAnimating) return;

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
    [index, isAnimating, prefersReducedMotion, total],
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

  const shouldAnimate = !prefersReducedMotion && phase === "animating";
  const currentX = shouldAnimate ? currentToX : currentFromX;
  const incomingX = shouldAnimate ? incomingToX : incomingFromX;

  const enableTransition = shouldAnimate;

  useEffect(() => {
    if (phase !== "reset") return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setPhase("idle");
    });
  }, [phase]);

  return (
    <main className="relative h-svh w-full overflow-hidden overscroll-none bg-[color:var(--background)] text-[color:var(--foreground)]">
      {/* Background layers (match Home ambience) */}
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

      <div className="relative z-20 h-full overflow-hidden px-10">
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

        {/* Title (top center) */}
        <header className="absolute top-10 left-1/2 -translate-x-1/2 text-center">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-[color:var(--gold)] opacity-80" />
          <h1 className="text-2xl font-bold tracking-[0.4em] text-[color:var(--gold-bright)] uppercase">
            Tutorial
          </h1>
        </header>

        {/* Center area (carousel) */}
        <div className="h-full flex items-start justify-center pt-32 pb-36">
          <div className="w-full max-w-4xl">
            <div className="relative h-[min(520px,62svh)] overflow-hidden">
              {/* Current slide */}
              <div
                key={index}
                className={`absolute inset-0 ${enableTransition ? "transition-transform duration-500 ease-in-out" : ""}`}
                style={{ transform: `translateX(${currentX}%)` }}
              >
                <SlideContent slide={activeSlide} />
              </div>

              {/* Incoming slide (only during transition) */}
              {nextSlide && pendingIndex !== null && (
                <div
                  key={pendingIndex}
                  className={`absolute inset-0 ${enableTransition ? "transition-transform duration-500 ease-in-out" : ""}`}
                  style={{ transform: `translateX(${incomingX}%)` }}
                  onTransitionEnd={(e) => {
                    if (e.target !== e.currentTarget) return;
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

        {/* Bottom controls */}
        <div className="absolute left-0 right-0 bottom-14 flex items-center justify-center gap-6">
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
            {slides.map((_, i) => {
              const isActive = i === index;
              return (
                <div
                  // indicator only (no click per spec)
                  key={i}
                  className={
                    isActive ? "h-2 w-8 rounded-full" : "h-2 w-2 rounded-full"
                  }
                  style={{
                    backgroundColor: isActive
                      ? "var(--gold-bright)"
                      : "var(--gold-dim)",
                    opacity: isActive ? 1 : 0.35,
                  }}
                />
              );
            })}
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

        <div className="absolute left-0 right-0 bottom-6 text-center text-xs tracking-[0.22em] text-[color:var(--gold-dim)]/80">
          ←→キーでもページ移動できます
        </div>
      </div>
    </main>
  );
}

function SlideContent({ slide }: { slide: TutorialSlide }) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="h-full w-full px-6 flex flex-col items-center justify-start gap-7">
      <div className="relative w-full max-w-3xl aspect-[16/9] overflow-hidden rounded-2xl border border-[color:var(--gold)]/18 bg-black/10">
        <Image
          src={slide.imageSrc}
          alt={slide.imageAlt}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 92vw, 960px"
          priority
          onError={() => setImageError(true)}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.55))",
          }}
          aria-hidden="true"
        />

        {(!slide.imageSrc || imageError) && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-sm tracking-[0.25em] text-[color:var(--gold-dim)]/80">
              画像がここに表示されます
            </span>
          </div>
        )}
      </div>

      <p className="text-center text-base leading-relaxed tracking-wide text-[color:var(--foreground)]/90">
        {slide.description}
      </p>
    </div>
  );
}
