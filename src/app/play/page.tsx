"use client";

import { ChevronLeft, Mic, MicOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FloatingParticles } from "@/components/floating-particles";
import { HeroMagicCircle } from "@/components/hero-magic-circle";
import { useJoyCon } from "@/features/device/api/useJoyCon";
import { recognizeGesture } from "@/features/gesture/recognizer";
import { useSpeech } from "@/features/voice/api/useSpeech";
import { toGestureIntentInput } from "@/features/orchestrator/lib/intent-gate-adapter";
import { IntentGate } from "@/features/orchestrator/lib/intent-gate";
import {
  IntentGateResult,
  SpellId,
} from "@/features/orchestrator/types/intent";

const GESTURE_COOLDOWN_MS = 800;
const GYRO_SENSITIVITY = 0.12;
const GYRO_DEADZONE = 15;
const TRAIL_MIN_POINTS = 20;
const INTENT_WINDOW_MS = 7000;
const GESTURE_CONFIDENCE_THRESHOLD = 0.55;
const TRAIL_MAX_RENDER_POINTS = 90;
const CALIBRATION_DURATION_MS = 2500;
const CALIBRATION_ACCEL_THRESHOLD = 500;

function toTrailPathPoints(trail: { rawX: number; rawY: number }[]): string {
  if (trail.length < 2) return "";

  const minX = Math.min(...trail.map((p) => p.rawX));
  const maxX = Math.max(...trail.map((p) => p.rawX));
  const minY = Math.min(...trail.map((p) => p.rawY));
  const maxY = Math.max(...trail.map((p) => p.rawY));

  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);

  return trail
    .map((p) => {
      const x = 10 + ((p.rawX - minX) / spanX) * 80;
      const y = 12 + ((p.rawY - minY) / spanY) * 76;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function PlayPage() {
  const gate = useRef(
    new IntentGate({
      timeWindowMs: INTENT_WINDOW_MS,
      gestureConfidenceThreshold: GESTURE_CONFIDENCE_THRESHOLD,
    }),
  );
  const { status, finalSpellMatch, start, stop, isSupported } = useSpeech();
  const {
    status: joyConStatus,
    joyconState,
    connect,
    disconnect,
  } = useJoyCon();
  const [gateResult, setGateResult] = useState<IntentGateResult | null>(null);
  const [persistedSpellName, setPersistedSpellName] = useState<string | null>(
    null,
  );
  const [trailPathPoints, setTrailPathPoints] = useState("");
  const [showCommitFeedback, setShowCommitFeedback] = useState(false);
  const [commitLabel, setCommitLabel] = useState("");
  const [calibrationState, setCalibrationState] = useState<
    "idle" | "calibrating" | "done"
  >("idle");
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const trailRef = useRef<{ rawX: number; rawY: number; t: number }[]>([]);
  const imuPosRef = useRef({ x: 0, y: 0 });
  const gyroBiasRef = useRef({ y: 0, z: 0 });
  const prevRPressedRef = useRef(false);
  const lastGestureAtRef = useRef(0);
  const calibrationStartRef = useRef<number | null>(null);
  const calibrationSamplesRef = useRef<{ y: number; z: number }[]>([]);
  const calibrationPrevAccelRef = useRef<{
    x: number;
    y: number;
    z: number;
  } | null>(null);

  useEffect(() => {
    if (joyConStatus === "CONNECTED") {
      setCalibrationState("calibrating");
      setCalibrationProgress(0);
      calibrationStartRef.current = null;
      calibrationSamplesRef.current = [];
      calibrationPrevAccelRef.current = null;
      gyroBiasRef.current = { y: 0, z: 0 };
      return;
    }

    setCalibrationState("idle");
    setCalibrationProgress(0);
    calibrationStartRef.current = null;
    calibrationSamplesRef.current = [];
    calibrationPrevAccelRef.current = null;
    gyroBiasRef.current = { y: 0, z: 0 };
  }, [joyConStatus]);

  // finalSpellMatch が確定したら IntentGate に渡す（直接発動しない）
  useEffect(() => {
    if (!finalSpellMatch?.matched || !finalSpellMatch.spell) return;

    setPersistedSpellName(finalSpellMatch.spell.name);

    const voiceResult = gate.current.pushVoice({
      spellId: finalSpellMatch.spell.id as SpellId,
      confidence: finalSpellMatch.confidence,
      timestamp: Date.now(),
    });

    setGateResult(voiceResult);
    stop();
  }, [finalSpellMatch, stop]);

  useEffect(() => {
    if (
      gateResult?.status === "waiting_for_voice" &&
      status === "IDLE" &&
      isSupported
    ) {
      start();
    }
  }, [gateResult?.status, isSupported, start, status]);

  useEffect(() => {
    if (gateResult?.status !== "committed" || !gateResult.commit) return;

    setCommitLabel(
      `${gateResult.commit.spellId.toUpperCase()} / ${gateResult.commit.gestureType}`,
    );
    setShowCommitFeedback(true);

    const timerId = window.setTimeout(() => {
      setShowCommitFeedback(false);
      setCommitLabel("");
      gate.current.clear();
      setGateResult(null);
      setPersistedSpellName(null);
    }, 1800);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [gateResult]);

  useEffect(() => {
    if (joyConStatus !== "CONNECTED" || !joyconState) {
      trailRef.current = [];
      setTrailPathPoints("");
      imuPosRef.current = { x: 0, y: 0 };
      prevRPressedRef.current = false;
      return;
    }

    if (joyconState.buttons.plus) {
      setCalibrationState("calibrating");
      setCalibrationProgress(0);
      calibrationStartRef.current = null;
      calibrationSamplesRef.current = [];
      calibrationPrevAccelRef.current = null;
      gyroBiasRef.current = { y: 0, z: 0 };
      trailRef.current = [];
      setTrailPathPoints("");
      return;
    }

    if (calibrationState === "calibrating") {
      const accel = joyconState.imu.accel;
      const gyro = joyconState.imu.gyro;

      if (calibrationPrevAccelRef.current) {
        const prev = calibrationPrevAccelRef.current;
        const moved =
          Math.abs(accel.x - prev.x) > CALIBRATION_ACCEL_THRESHOLD ||
          Math.abs(accel.y - prev.y) > CALIBRATION_ACCEL_THRESHOLD ||
          Math.abs(accel.z - prev.z) > CALIBRATION_ACCEL_THRESHOLD;

        if (moved) {
          calibrationStartRef.current = null;
          calibrationSamplesRef.current = [];
          setCalibrationProgress(0);
          calibrationPrevAccelRef.current = { ...accel };
          return;
        }
      }

      calibrationPrevAccelRef.current = { ...accel };

      if (calibrationStartRef.current === null) {
        calibrationStartRef.current = Date.now();
      }

      calibrationSamplesRef.current.push({ y: gyro.y, z: gyro.z });

      const elapsed = Date.now() - calibrationStartRef.current;
      setCalibrationProgress(Math.min(1, elapsed / CALIBRATION_DURATION_MS));

      if (elapsed >= CALIBRATION_DURATION_MS) {
        const samples = calibrationSamplesRef.current;
        const sum = samples.reduce(
          (acc, s) => ({ y: acc.y + s.y, z: acc.z + s.z }),
          { y: 0, z: 0 },
        );

        gyroBiasRef.current = {
          y: sum.y / samples.length,
          z: sum.z / samples.length,
        };
        setCalibrationState("done");
      }

      return;
    }

    if (calibrationState !== "done") {
      return;
    }

    let yaw = joyconState.imu.gyro.y - gyroBiasRef.current.y;
    let pitch = joyconState.imu.gyro.z - gyroBiasRef.current.z;

    if (Math.abs(yaw) <= GYRO_DEADZONE) yaw = 0;
    if (Math.abs(pitch) <= GYRO_DEADZONE) pitch = 0;

    imuPosRef.current.x -= yaw * GYRO_SENSITIVITY;
    imuPosRef.current.y -= pitch * GYRO_SENSITIVITY;

    const isRPressed = joyconState.buttons.r;
    if (isRPressed) {
      const now = performance.now();
      trailRef.current.push({
        rawX: imuPosRef.current.x,
        rawY: imuPosRef.current.y,
        t: now,
      });
      if (trailRef.current.length > 1000) trailRef.current.shift();

      setTrailPathPoints(
        toTrailPathPoints(trailRef.current.slice(-TRAIL_MAX_RENDER_POINTS)),
      );
    } else if (prevRPressedRef.current) {
      const now = Date.now();
      const inCooldown = now - lastGestureAtRef.current < GESTURE_COOLDOWN_MS;

      if (!inCooldown && trailRef.current.length >= TRAIL_MIN_POINTS) {
        const recognized = recognizeGesture(trailRef.current);
        const gestureInput = toGestureIntentInput(recognized, now);

        if (gestureInput) {
          const gestureGateResult = gate.current.pushGesture(gestureInput);
          setGateResult(gestureGateResult);
          lastGestureAtRef.current = now;
        }
      }

      trailRef.current = [];
      setTrailPathPoints("");
    }

    prevRPressedRef.current = isRPressed;
  }, [calibrationState, joyConStatus, joyconState]);

  const handleMicToggle = () => {
    if (status === "LISTENING") {
      stop();
      gate.current.clear();
      setGateResult(null);
      setPersistedSpellName(null);
    } else {
      if (gateResult?.status !== "waiting_for_voice") {
        gate.current.clear();
        setGateResult(null);
        setPersistedSpellName(null);
      }
      start();
    }
  };

  const handleJoyConToggle = async () => {
    if (joyConStatus === "CONNECTED" || joyConStatus === "CONNECTING") {
      await disconnect();
      gate.current.clear();
      setGateResult(null);
      trailRef.current = [];
      setTrailPathPoints("");
      return;
    }

    await connect();
  };

  const isListening = status === "LISTENING";
  const isWaitingForGesture = gateResult?.status === "waiting_for_gesture";
  const isWaitingForVoice = gateResult?.status === "waiting_for_voice";
  const isCommitted = gateResult?.status === "committed";
  const isRejected = gateResult?.status === "rejected";
  const spellName = persistedSpellName;
  const isDrawingGesture = joyconState?.buttons.r ?? false;

  const statusText = (() => {
    if (status === "ERROR") return "エラーが発生しました";
    if (isListening) return "聴いています...";
    if (isWaitingForGesture) return "呪文受付済 - 杖を振ってください";
    if (isWaitingForVoice) return "軌道受付済 - 呪文を唱えてください";
    if (isCommitted) return "魔法発動成功！";
    if (isRejected) return "信頼度不足 - もう一度試してください";
    return "待機中...";
  })();

  const joyConStatusText = (() => {
    if (joyConStatus === "CONNECTING") return "Joy-Con接続中...";
    if (joyConStatus === "DISCONNECTED") return "Joy-Con未接続";
    if (joyConStatus === "ERROR") return "Joy-Con接続エラー";
    if (calibrationState === "calibrating") {
      const percent = Math.round(calibrationProgress * 100);
      return `キャリブレーション中 ${percent}% (レール側を下にして静止)`;
    }
    if (isDrawingGesture) return "軌道入力中 (R長押し)...";
    if (isWaitingForVoice) return "軌道受付済";
    if (isRejected && gateResult?.reasonCode === "window_timeout") {
      return "受付時間切れ - 先に呪文か軌道のどちらかをやり直してください";
    }
    if (isRejected && gateResult?.reasonCode === "gesture_confidence_too_low") {
      return "軌道信頼度不足";
    }
    return "接続済み (R長押しで軌道入力)";
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
            <div className="mx-auto w-full max-w-[340px] h-[220px] rounded-2xl border border-gold-dim/20 bg-stone/10 backdrop-blur-sm relative overflow-hidden">
              {showCommitFeedback && (
                <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(255,244,182,0.25)_0%,_rgba(212,175,55,0.08)_40%,_transparent_75%)] animate-pulse" />
              )}
              <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 h-full w-full"
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
              >
                <defs>
                  <filter
                    id="trailGlow"
                    x="-40%"
                    y="-40%"
                    width="180%"
                    height="180%"
                  >
                    <feGaussianBlur stdDeviation="1.8" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {trailPathPoints && (
                  <>
                    <polyline
                      points={trailPathPoints}
                      fill="none"
                      stroke="rgba(212,175,55,0.35)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#trailGlow)"
                    />
                    <polyline
                      points={trailPathPoints}
                      fill="none"
                      stroke="rgba(255,244,182,0.9)"
                      strokeWidth="0.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                )}
              </svg>
              <div className="absolute inset-x-0 bottom-2 text-center">
                <p className="text-[10px] tracking-[0.2em] text-gold-dim/70">
                  WAND TRAIL PREVIEW
                </p>
              </div>
            </div>

            {/* 音声認識状態表示 */}
            <div
              className={`px-10 py-6 rounded-full border bg-stone/20 backdrop-blur-sm shadow-xl transition-all ${
                showCommitFeedback
                  ? "border-gold-bright/60 shadow-[0_0_26px_rgba(212,175,55,0.45)]"
                  : "border-gold-dim/15"
              }`}
            >
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

            {showCommitFeedback && (
              <p className="text-sm tracking-widest text-gold-bright animate-pulse">
                COMMITTED: {commitLabel}
              </p>
            )}

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

            <button
              onClick={handleJoyConToggle}
              className="mx-auto px-6 py-2 rounded-full border border-gold-dim/40 text-sm tracking-widest text-gold-dim hover:border-gold-bright/60 hover:text-gold-bright transition-colors"
            >
              {joyConStatus === "CONNECTED" || joyConStatus === "CONNECTING"
                ? "Joy-Con切断"
                : "Joy-Con接続"}
            </button>

            <p className="text-xs tracking-widest text-gold-dim/70">
              {joyConStatusText}
            </p>

            <p className="text-[11px] leading-relaxed tracking-wide text-gold-dim/60">
              コツ:
              接続直後はレール側を下にして2.5秒静止すると安定します。呪文の後7秒以内に、R長押しで0.8〜1.5秒ほどV/Mを1回しっかり描いて離すと通りやすいです。
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
