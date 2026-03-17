"use client";

import { ChevronLeft, Mic, MicOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FloatingParticles } from "@/components/floating-particles";
import { HeroMagicCircle } from "@/components/hero-magic-circle";
import { useSpeech } from "@/features/voice/api/useSpeech";
import { IntentGate } from "@/features/orchestrator/lib/intent-gate";
import {
  IntentGateResult,
  SpellId,
} from "@/features/orchestrator/types/intent";

export default function PlayPage() {
  const gate = useRef(new IntentGate());
  const { status, finalSpellMatch, start, stop, isSupported } = useSpeech();
  const [gateResult, setGateResult] = useState<IntentGateResult | null>(null);

  // finalSpellMatch が確定したら IntentGate に渡す（直接発動しない）
  useEffect(() => {
    if (!finalSpellMatch?.matched || !finalSpellMatch.spell) return;

    const voiceResult = gate.current.pushVoice({
      spellId: finalSpellMatch.spell.id as SpellId,
      confidence: finalSpellMatch.confidence,
      timestamp: Date.now(),
    });

    setGateResult(voiceResult);
    stop();
  }, [finalSpellMatch, stop]);

  const handleMicToggle = () => {
    if (status === "LISTENING") {
      stop();
      setGateResult(null);
    } else {
      setGateResult(null);
      start();
    }
  };

  const isListening = status === "LISTENING";
  const isWaitingForGesture = gateResult?.status === "waiting_for_gesture";
  const isRejected = gateResult?.status === "rejected";
  const spellName =
    finalSpellMatch?.matched ? finalSpellMatch.spell?.name : null;

  const statusText = (() => {
    if (status === "ERROR") return "エラーが発生しました";
    if (isListening) return "聴いています...";
    if (isWaitingForGesture) return "呪文受付済 - 杖を振ってください";
    if (isRejected) return "信頼度不足 - もう一度試してください";
    return "待機中...";
  })();

  return (
    <main className="relative min-h-svh w-full overflow-hidden bg-background text-foreground">
      {/* Background image layer (match Home's darker ambience) */}
      <div
        className="fixed inset-0 bg-background opacity-30"
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/80"
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 shadow-[inset_0_0_200px_80px_rgba(0,0,0,0.6)]"
        aria-hidden="true"
      />

      <FloatingParticles />

      {/* Center magic circle (same as Home) */}
      <div className="fixed inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div className="w-[460px] h-[460px]">
          <HeroMagicCircle />
        </div>
      </div>

      <div className="relative z-20 min-h-svh px-10">
        {/* Back Link */}
        <Link
          href="/home"
          className="absolute top-10 left-10 group flex items-center gap-2 text-gold-dim transition-colors hover:text-gold-bright"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-xs uppercase tracking-widest text-shadow-glow">
            Back
          </span>
        </Link>

        {/* Title (doesn't affect centering) */}
        <header className="absolute top-10 left-1/2 -translate-x-1/2 text-center">
          <h1 className="text-2xl font-bold tracking-[0.4em] text-gold-bright uppercase">
            Play
          </h1>
          <p className="mt-4 text-sm font-serif tracking-[0.15em] text-gold-dim/60">
            魔法を発動エリア
          </p>
        </header>

        {/* Center content */}
        <div className="min-h-svh flex items-center justify-center">
          <div className="w-full max-w-sm text-center space-y-6">
            {/* 音声認識状態表示 */}
            <div className="px-10 py-6 rounded-full border border-gold-dim/15 bg-stone/20 backdrop-blur-sm shadow-xl">
              <p
                className={`text-lg font-bold tracking-[0.2em] text-gold-bright ${isListening ? "animate-pulse" : ""}`}
              >
                {statusText}
              </p>
              {spellName && isWaitingForGesture && (
                <p className="mt-2 text-sm tracking-widest text-gold-dim/80">
                  「{spellName}」
                </p>
              )}
            </div>

            {/* マイクボタン */}
            {isSupported ? (
              <button
                onClick={handleMicToggle}
                aria-label={isListening ? "音声認識を停止" : "音声認識を開始"}
                className={`mx-auto flex items-center justify-center w-16 h-16 rounded-full border transition-all duration-300 ${
                  isListening
                    ? "border-gold-bright bg-gold-bright/20 shadow-[0_0_20px_rgba(212,175,55,0.4)]"
                    : "border-gold-dim/40 bg-stone/20 hover:border-gold-bright/60 hover:bg-gold-dim/10"
                }`}
              >
                {isListening ? (
                  <MicOff className="w-6 h-6 text-gold-bright" />
                ) : (
                  <Mic className="w-6 h-6 text-gold-dim" />
                )}
              </button>
            ) : (
              <p className="text-xs text-gold-dim/50 tracking-widest">
                音声認識非対応のブラウザです
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
