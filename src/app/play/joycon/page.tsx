"use client";

import { ChevronLeft, Mic, MicOff, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FloatingParticles } from "@/components/floating-particles";
import { HeroMagicCircle } from "@/components/hero-magic-circle";
import { useJoyCon } from "@/features/device/api/useJoyCon";
import {
  recognizeGesture,
  type GestureResult,
} from "@/features/gesture/recognizer";
import { usePhomemo } from "@/features/iot/api/usePhomemo";
import { executeSpell } from "@/features/iot/lib/plugControl";
import { dispatchCommittedIntent } from "@/features/orchestrator/lib/intent-dispatcher";
import { useSpeech } from "@/features/voice/api/useSpeech";
import { toGestureIntentInput } from "@/features/orchestrator/lib/intent-gate-adapter";
import { IntentGate } from "@/features/orchestrator/lib/intent-gate";
import {
  AUTO_OFF_SETTING_KEY,
  DEFAULT_AUTO_OFF_ENABLED,
  getAutoOffEnabled,
} from "@/features/settings/lib/auto-off-setting";
import {
  GestureIntentInput,
  IntentGateResult,
  SpellId,
} from "@/features/orchestrator/types/intent";

// ── 定数 ──
const GESTURE_COOLDOWN_MS = 800;
const GYRO_SENSITIVITY = 0.12;
const GYRO_DEADZONE = 15;
const TRAIL_MIN_POINTS = 20;
const STABLE_INTENT_WINDOW_MS = 10000;
const STABLE_GESTURE_CONFIDENCE_THRESHOLD = 0.45;
const STABLE_VOICE_CONFIDENCE_THRESHOLD = 0.6;
const IMMERSIVE_INTENT_WINDOW_MS = 1800;
const IMMERSIVE_GESTURE_CONFIDENCE_THRESHOLD = 0.55;
const IMMERSIVE_VOICE_CONFIDENCE_THRESHOLD = 0.7;
const TRAIL_MAX_RENDER_POINTS = 90;
const CALIBRATION_DURATION_MS = 3000;
const CALIBRATION_ACCEL_THRESHOLD = 500;
const DISPATCH_COOLDOWN_MS = 1200;
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const PADDING = 40;
const WAVE_GESTURE_RECOVERY_WINDOW_MS = 3000;

type DispatchPhase = "idle" | "running" | "success" | "failed" | "timeout";
type SpeechLatencyMode = "safe" | "fast";
type CastingSyncMode = "stable" | "immersive";

function resolveIntentGateConfig(mode: CastingSyncMode) {
  if (mode === "immersive") {
    return {
      timeWindowMs: IMMERSIVE_INTENT_WINDOW_MS,
      voiceConfidenceThreshold: IMMERSIVE_VOICE_CONFIDENCE_THRESHOLD,
      gestureConfidenceThreshold: IMMERSIVE_GESTURE_CONFIDENCE_THRESHOLD,
    };
  }

  return {
    timeWindowMs: STABLE_INTENT_WINDOW_MS,
    voiceConfidenceThreshold: STABLE_VOICE_CONFIDENCE_THRESHOLD,
    gestureConfidenceThreshold: STABLE_GESTURE_CONFIDENCE_THRESHOLD,
  };
}

// ── ビューポートの計算とスムージングヘルパー ──
function adjustViewBounds(
  trail: { rawX: number; rawY: number }[],
  extraPoints: { rawX: number; rawY: number }[],
  viewBoundsRef: React.MutableRefObject<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>,
  minSpan: number,
  lerp: number,
) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  for (const pt of trail) {
    if (pt.rawX < minX) minX = pt.rawX;
    if (pt.rawX > maxX) maxX = pt.rawX;
    if (pt.rawY < minY) minY = pt.rawY;
    if (pt.rawY > maxY) maxY = pt.rawY;
  }
  for (const pt of extraPoints) {
    if (pt.rawX < minX) minX = pt.rawX;
    if (pt.rawX > maxX) maxX = pt.rawX;
    if (pt.rawY < minY) minY = pt.rawY;
    if (pt.rawY > maxY) maxY = pt.rawY;
  }

  if (isFinite(minX)) {
    if (maxX - minX < minSpan) {
      const c = (minX + maxX) / 2;
      minX = c - minSpan / 2;
      maxX = c + minSpan / 2;
    }
    if (maxY - minY < minSpan) {
      const c = (minY + maxY) / 2;
      minY = c - minSpan / 2;
      maxY = c + minSpan / 2;
    }
    const mx = (maxX - minX) * 0.1,
      my = (maxY - minY) * 0.1;
    minX -= mx;
    maxX += mx;
    minY -= my;
    maxY += my;

    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const drawW = CANVAS_WIDTH - PADDING * 2;
    const drawH = CANVAS_HEIGHT - PADDING * 2;
    const targetRatio = drawW / drawH;
    const currentRatio = spanX / spanY;

    if (currentRatio > targetRatio) {
      const newSpanY = spanX / targetRatio;
      const cy = (minY + maxY) / 2;
      minY = cy - newSpanY / 2;
      maxY = cy + newSpanY / 2;
    } else {
      const newSpanX = spanY * targetRatio;
      const cx = (minX + maxX) / 2;
      minX = cx - newSpanX / 2;
      maxX = cx + newSpanX / 2;
    }

    if (!viewBoundsRef.current) {
      viewBoundsRef.current = { minX, maxX, minY, maxY };
    } else {
      viewBoundsRef.current.minX += (minX - viewBoundsRef.current.minX) * lerp;
      viewBoundsRef.current.maxX += (maxX - viewBoundsRef.current.maxX) * lerp;
      viewBoundsRef.current.minY += (minY - viewBoundsRef.current.minY) * lerp;
      viewBoundsRef.current.maxY += (maxY - viewBoundsRef.current.maxY) * lerp;
    }
    return {
      minX: viewBoundsRef.current.minX,
      maxX: viewBoundsRef.current.maxX,
      minY: viewBoundsRef.current.minY,
      maxY: viewBoundsRef.current.maxY,
    };
  }

  return { minX: 0, maxX: CANVAS_WIDTH, minY: 0, maxY: CANVAS_HEIGHT };
}

function toCanvasCoords(
  rawX: number,
  rawY: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
) {
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const drawW = CANVAS_WIDTH - PADDING * 2;
  const drawH = CANVAS_HEIGHT - PADDING * 2;
  const cx = PADDING + ((rawX - minX) / spanX) * drawW;
  const cy = PADDING + ((rawY - minY) / spanY) * drawH;
  return { cx, cy };
}

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

// ── ドット描画ヘルパー ──
function drawDot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rgb: string,
) {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
  gradient.addColorStop(0, `rgba(${rgb}, 0.5)`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgb(${rgb})`;
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function AnchoredCircleLayer({
  sizePercent,
  className,
  style,
  children,
}: {
  sizePercent: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${className ?? ""}`}
      style={{ width: `${sizePercent}%`, height: `${sizePercent}%`, ...style }}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

export default function JoyConPlayPage() {
  // ── Joy-Con ──
  const {
    status: joyConStatus,
    joyconState,
    connect,
    disconnect,
  } = useJoyCon();

  // ── 音声認識 ──
  const [speechLatencyMode, setSpeechLatencyMode] =
    useState<SpeechLatencyMode>("safe");
  const [castingSyncMode, setCastingSyncMode] =
    useState<CastingSyncMode>("stable");
  const { status, finalSpellMatch, start, stop, isSupported } = useSpeech(
    undefined,
    speechLatencyMode === "fast"
      ? {
          finalBufferWindowMs: 1200,
          interimMatchThreshold: 0.7,
          interimCommitThreshold: 0.8,
        }
      : {
          finalBufferWindowMs: 1500,
          interimMatchThreshold: 0.8,
          interimCommitThreshold: 1.0,
        },
  );

  // ── IoT ──
  const {
    status: phomemoStatus,
    errorMessage: phomemoErrorMessage,
    connect: connectPhomemo,
    disconnect: disconnectPhomemo,
    printTestPage,
    printOmikujiWithRandomImage,
    isConnected: isPhomemoConnected,
  } = usePhomemo();

  // ── IntentGate ──
  const gate = useRef(
    new IntentGate(resolveIntentGateConfig("stable")),
  );

  // ── UI状態 ──
  const [gateResult, setGateResult] = useState<IntentGateResult | null>(null);
  const [persistedSpellName, setPersistedSpellName] = useState<string | null>(
    null,
  );
  const [trailPathPoints, setTrailPathPoints] = useState("");
  const [showCommitFeedback, setShowCommitFeedback] = useState(false);
  const [commitLabel, setCommitLabel] = useState("");
  const [activeCircleSpell, setActiveCircleSpell] = useState<SpellId | null>(
    null,
  );
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const [isTrailPreviewVisible, setIsTrailPreviewVisible] = useState(false);
  const [isStatusDisplayVisible, setIsStatusDisplayVisible] = useState(false);
  const [enableCircleGlowOnRButton, setEnableCircleGlowOnRButton] = useState(true);
  const [dispatchPhase, setDispatchPhase] = useState<DispatchPhase>("idle");
  const [dispatchMessage, setDispatchMessage] = useState("");
  const [inputDeviceErrorMessage, setInputDeviceErrorMessage] = useState<
    string | null
  >(null);
  const [calibrationState, setCalibrationState] = useState<
    "idle" | "calibrating" | "done"
  >("idle");
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [autoOffEnabled, setAutoOffEnabledState] = useState(
    DEFAULT_AUTO_OFF_ENABLED,
  );

  // ── Refs ──
  const trailRef = useRef<{ rawX: number; rawY: number; t: number }[]>([]);
  const imuPosRef = useRef({ x: 0, y: 0 });
  const gyroBiasRef = useRef({ y: 0, z: 0 });
  const prevRPressedRef = useRef(false);
  const lastGestureAtRef = useRef(0);
  const calibrationStartRef = useRef<number | null>(null);
  const calibrationSamplesRef = useRef<{ y: number; z: number }[]>([]);
  const isDispatchingRef = useRef(false);
  const lastDispatchAtRef = useRef(0);
  const lastHandledCommitRef = useRef("");
  const recentGestureInputRef = useRef<GestureIntentInput | null>(null);
  const speechStartedByRRef = useRef(false);
  const calibrationPrevAccelRef = useRef<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const viewBoundsRef = useRef<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>(null);

  // ── ジェスチャーハンドラー ──
  const handleRecognizedGesture = (recognized: GestureResult, now: number) => {
    if (recognized.type === "unknown") return;
    const gestureInput = toGestureIntentInput(recognized, now);
    if (!gestureInput) return;
    recentGestureInputRef.current = gestureInput;
    const gestureGateResult = gate.current.pushGesture(gestureInput);
    setGateResult(gestureGateResult);
    lastGestureAtRef.current = now;
  };

  // ── auto-off設定読み込み ──
  useEffect(() => {
    setAutoOffEnabledState(getAutoOffEnabled());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === AUTO_OFF_SETTING_KEY) {
        setAutoOffEnabledState(getAutoOffEnabled());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // ── 発動同期モード切替（ゲート構成を再初期化） ──
  useEffect(() => {
    gate.current = new IntentGate(resolveIntentGateConfig(castingSyncMode));
    setGateResult(null);
    setPersistedSpellName(null);
    setShowCommitFeedback(false);
    setActiveCircleSpell(null);
    setCommitLabel("");
    recentGestureInputRef.current = null;
    lastGestureAtRef.current = 0;
  }, [castingSyncMode]);

  // ── Joy-Conエラー検知 ──
  useEffect(() => {
    if (joyConStatus === "ERROR") {
      setInputDeviceErrorMessage(
        "Joy-Con接続に失敗しました。再接続してもう一度お試しください。",
      );
      return;
    }
    if (joyConStatus === "CONNECTED") {
      setInputDeviceErrorMessage(null);
    }
  }, [joyConStatus]);

  // ── キャリブレーション開始 ──
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

  // ── 音声認識結果 → IntentGate ──
  useEffect(() => {
    if (!finalSpellMatch?.matched || !finalSpellMatch.spell) return;
    setPersistedSpellName(finalSpellMatch.spell.name);
    const spellId = finalSpellMatch.spell.id as SpellId;

    const voiceResult = gate.current.pushVoice({
      spellId,
      confidence: finalSpellMatch.confidence,
      timestamp: Date.now(),
    });

    // Wジェスチャー救済
    if (
      spellId === "wave" &&
      voiceResult.status === "waiting_for_gesture" &&
      recentGestureInputRef.current?.gestureType === "W" &&
      Date.now() - recentGestureInputRef.current.timestamp <=
        WAVE_GESTURE_RECOVERY_WINDOW_MS
    ) {
      const recoveredGestureResult = gate.current.pushGesture(
        recentGestureInputRef.current,
      );
      if (recoveredGestureResult.status === "committed") {
        setGateResult(recoveredGestureResult);
        if (castingSyncMode === "stable") {
          stop();
        }
        return;
      }
      const recoveredVoiceResult = gate.current.pushVoice({
        spellId,
        confidence: finalSpellMatch.confidence,
        timestamp: Date.now(),
      });
      setGateResult(recoveredVoiceResult);
      if (castingSyncMode === "stable") {
        stop();
      }
      return;
    }

    setGateResult(voiceResult);
    if (castingSyncMode === "stable" || voiceResult.status === "committed") {
      stop();
    }
  }, [castingSyncMode, finalSpellMatch, stop]);

  // ── 同時詠唱モード: commit したら音声認識を停止 ──
  useEffect(() => {
    if (
      castingSyncMode === "immersive" &&
      gateResult?.status === "committed" &&
      status === "LISTENING"
    ) {
      stop();
    }
  }, [castingSyncMode, gateResult?.status, status, stop]);

  // ── ジェスチャー待ち → 音声認識自動開始 ──
  useEffect(() => {
    if (
      gateResult?.status === "waiting_for_voice" &&
      status === "IDLE" &&
      isSupported
    ) {
      start();
    }
  }, [gateResult?.status, isSupported, start, status]);

  // ── コミットフィードバック表示 ──
  useEffect(() => {
    if (gateResult?.status !== "committed" || !gateResult.commit) return;
    setActiveCircleSpell(gateResult.commit.spellId);
    setCommitLabel(
      `${gateResult.commit.spellId.toUpperCase()} / ${gateResult.commit.gestureType}`,
    );
    setShowCommitFeedback(true);
    const timerId = window.setTimeout(() => {
      setShowCommitFeedback(false);
      setActiveCircleSpell(null);
      setCommitLabel("");
      gate.current.clear();
      setGateResult(null);
      setPersistedSpellName(null);
    }, 2400);
    return () => window.clearTimeout(timerId);
  }, [gateResult]);

  // ── IoTディスパッチ ──
  useEffect(() => {
    if (gateResult?.status !== "committed" || !gateResult.commit) return;
    const commit = gateResult.commit;
    const commitKey = `${commit.spellId}:${commit.gestureType}:${commit.committedAt}`;
    if (lastHandledCommitRef.current === commitKey) return;
    lastHandledCommitRef.current = commitKey;

    const now = Date.now();
    if (
      isDispatchingRef.current ||
      now - lastDispatchAtRef.current < DISPATCH_COOLDOWN_MS
    ) {
      setDispatchPhase("running");
      setDispatchMessage(
        "発動処理が進行中です。少し待ってからもう一度お試しください。",
      );
      return;
    }

    isDispatchingRef.current = true;
    setDispatchPhase("running");
    setDispatchMessage(
      commit.spellId === "kyua_uppu_rapa_pa"
        ? "おみくじを印刷しています..."
        : "Tapo魔法を実行しています...",
    );

    dispatchCommittedIntent(commit, {
      executeTapoSpell: executeSpell,
      isPrinterConnected: () => isPhomemoConnected,
      printOmikuji: printTestPage,
      printOmikujiWithRandomImage,
      autoOffEnabled,
    })
      .then((result) => {
        if (result.ok) {
          setDispatchPhase("success");
          setDispatchMessage(result.message);
          return;
        }
        if (result.errorCode === "dispatch_timeout") {
          setDispatchPhase("timeout");
          setDispatchMessage(result.message);
          return;
        }
        setDispatchPhase("failed");
        setDispatchMessage(result.message);
      })
      .finally(() => {
        isDispatchingRef.current = false;
        lastDispatchAtRef.current = Date.now();
      });
  }, [autoOffEnabled, gateResult, isPhomemoConnected, printTestPage]);

  // ── キャリブレーション & IMU トラッキング ──
  useEffect(() => {
    if (joyConStatus !== "CONNECTED" || !joyconState) {
      trailRef.current = [];
      setTrailPathPoints("");
      imuPosRef.current = { x: 0, y: 0 };
      viewBoundsRef.current = null;
      prevRPressedRef.current = false;
      speechStartedByRRef.current = false;
      return;
    }

    if (joyconState.buttons.plus) {
      setCalibrationState("calibrating");
      setCalibrationProgress(0);
      calibrationStartRef.current = null;
      calibrationSamplesRef.current = [];
      calibrationPrevAccelRef.current = null;
      gyroBiasRef.current = { y: 0, z: 0 };
      imuPosRef.current = { x: 0, y: 0 };
      trailRef.current = [];
      setTrailPathPoints("");
      viewBoundsRef.current = null;
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
        calibrationSamplesRef.current = [];
      }
      return;
    }

    if (calibrationState !== "done") return;

    let yaw = joyconState.imu.gyro.y - gyroBiasRef.current.y;
    let pitch = joyconState.imu.gyro.z - gyroBiasRef.current.z;

    if (Math.abs(yaw) <= GYRO_DEADZONE) yaw = 0;
    if (Math.abs(pitch) <= GYRO_DEADZONE) pitch = 0;

    imuPosRef.current.x -= yaw * GYRO_SENSITIVITY;
    imuPosRef.current.y -= pitch * GYRO_SENSITIVITY;

    const isRPressed = joyconState.buttons.r;
    const startedPress = isRPressed && !prevRPressedRef.current;

    if (startedPress && isSupported && status === "IDLE") {
      start();
      speechStartedByRRef.current = true;
    }

    if (!isRPressed && prevRPressedRef.current && speechStartedByRRef.current) {
      if (status === "LISTENING") {
        stop();
      }
      speechStartedByRRef.current = false;
    }

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
        handleRecognizedGesture(recognized, now);
      }

      trailRef.current = [];
      setTrailPathPoints("");
    }

    prevRPressedRef.current = isRPressed;
  }, [
    calibrationState,
    isSupported,
    joyConStatus,
    joyconState,
    start,
    status,
    stop,
  ]);

  // ── キャンバス描画 ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 背景グリッド
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= CANVAS_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // 描画領域の枠
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        PADDING,
        PADDING,
        CANVAS_WIDTH - PADDING * 2,
        CANVAS_HEIGHT - PADDING * 2,
      );

      // 十字線
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2, PADDING);
      ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT - PADDING);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(PADDING, CANVAS_HEIGHT / 2);
      ctx.lineTo(CANVAS_WIDTH - PADDING, CANVAS_HEIGHT / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const now = performance.now();
      const trail = trailRef.current;
      const color = "168, 85, 247"; // purple for IMU

      const extraPoints = [
        { rawX: imuPosRef.current.x, rawY: imuPosRef.current.y },
      ];
      const { minX, maxX, minY, maxY } = adjustViewBounds(
        trail,
        extraPoints,
        viewBoundsRef,
        200,
        0.15,
      );

      // 軌跡描画
      if (trail.length > 1) {
        for (let i = 1; i < trail.length; i++) {
          const age = (now - trail[i].t) / 5000;
          const alpha = Math.max(0, 1 - age);
          const p0 = toCanvasCoords(
            trail[i - 1].rawX,
            trail[i - 1].rawY,
            minX,
            maxX,
            minY,
            maxY,
          );
          const p1 = toCanvasCoords(
            trail[i].rawX,
            trail[i].rawY,
            minX,
            maxX,
            minY,
            maxY,
          );
          ctx.strokeStyle = `rgba(${color}, ${alpha * 0.7})`;
          ctx.lineWidth = Math.max(1, (1 - age) * 3);
          ctx.beginPath();
          ctx.moveTo(p0.cx, p0.cy);
          ctx.lineTo(p1.cx, p1.cy);
          ctx.stroke();
        }
      }

      // カーソル描画
      const { cx: curX, cy: curY } = toCanvasCoords(
        imuPosRef.current.x,
        imuPosRef.current.y,
        minX,
        maxX,
        minY,
        maxY,
      );
      drawDot(ctx, curX, curY, color);

      // ジャイロ値表示
      if (joyconState) {
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "10px monospace";
        ctx.fillText(
          `Gyro  Y:${joyconState.imu.gyro.y}  Z:${joyconState.imu.gyro.z}`,
          PADDING,
          CANVAS_HEIGHT - 10,
        );
      }

      // モードラベル
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("IMU モード", PADDING, PADDING - 10);

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [joyconState]);

  // ── ハンドラー ──
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
      try {
        await disconnect();
        gate.current.clear();
        setGateResult(null);
        trailRef.current = [];
        setTrailPathPoints("");
        setInputDeviceErrorMessage(null);
      } catch (error) {
        console.error("Failed to disconnect Joy-Con:", error);
        setInputDeviceErrorMessage(
          "Joy-Con切断に失敗しました。再度お試しください。",
        );
      }
      return;
    }
    try {
      await connect();
      setInputDeviceErrorMessage(null);
    } catch (error) {
      console.error("Failed to connect Joy-Con:", error);
      setInputDeviceErrorMessage(
        "Joy-Con接続に失敗しました。再度お試しください。",
      );
    }
  };

  const handlePhomemoToggle = async () => {
    if (
      phomemoStatus === "CONNECTED" ||
      phomemoStatus === "CONNECTING" ||
      phomemoStatus === "PRINTING"
    ) {
      await disconnectPhomemo();
      return;
    }
    await connectPhomemo();
  };

  // ── 表示用変数 ──
  const isListening = status === "LISTENING";
  const isWaitingForGesture = gateResult?.status === "waiting_for_gesture";
  const isWaitingForVoice = gateResult?.status === "waiting_for_voice";
  const isCommitted = gateResult?.status === "committed";
  const isRejected = gateResult?.status === "rejected";
  const spellName = persistedSpellName;
  const isDrawingGesture = joyconState?.buttons.r ?? false;
  const isMagicCircleGlowing = (isListening && enableCircleGlowOnRButton) || showCommitFeedback;
  const isImmersiveCircleGlowing =
    isMagicCircleGlowing && castingSyncMode === "immersive";
  const isVentusCircleActive =
    showCommitFeedback && activeCircleSpell === "ventus";
  const magicCircleGlowClass = isVentusCircleActive
    ? "opacity-100 drop-shadow-[0_0_66px_rgba(163,255,112,0.56)]"
    : isMagicCircleGlowing
      ? "opacity-100 drop-shadow-[0_0_42px_rgba(255,224,130,0.35)]"
      : "opacity-95";

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

  const phomemoStatusText = (() => {
    if (phomemoStatus === "CONNECTING") return "Phomemo接続中...";
    if (phomemoStatus === "DISCONNECTED") return "Phomemo未接続";
    if (phomemoStatus === "PRINTING") return "Phomemo印刷中...";
    if (phomemoStatus === "ERROR")
      return phomemoErrorMessage || "Phomemoエラー";
    return "Phomemo接続済み";
  })();

  const isPhomemoConnectedState =
    phomemoStatus === "CONNECTED" || phomemoStatus === "PRINTING";
  const isJoyConConnected = joyConStatus === "CONNECTED";

  return (
    <main className="relative min-h-svh w-full overflow-hidden bg-background text-foreground">
      {/* Background layers */}
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

      {/* INFO パネルトグル */}
      <button
        type="button"
        onClick={() => setIsInfoPanelOpen((prev) => !prev)}
        aria-expanded={isInfoPanelOpen}
        aria-controls="play-info-panel"
        className="fixed right-6 top-10 z-40 inline-flex items-center gap-2 rounded-full border border-gold-dim/40 bg-stone/35 px-4 py-2 text-xs tracking-[0.18em] text-gold-bright/85 backdrop-blur-sm transition-all hover:border-gold-bright/70 hover:text-gold-bright"
      >
        <SlidersHorizontal className="h-4 w-4" />
        {isInfoPanelOpen ? "CLOSE" : "INFO"}
      </button>

      {/* サイドパネル */}
      <aside
        id="play-info-panel"
        aria-hidden={!isInfoPanelOpen}
        inert={!isInfoPanelOpen}
        className={`fixed right-0 top-0 z-30 h-svh w-[min(88vw,360px)] border-l border-gold-dim/20 bg-[linear-gradient(180deg,rgba(10,19,30,0.88)_0%,rgba(6,12,22,0.95)_100%)] p-6 pt-24 backdrop-blur-md transition-all duration-300 ease-out ${
          isInfoPanelOpen
            ? "translate-x-0 opacity-100"
            : "translate-x-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="space-y-4">
          <p className="text-[11px] tracking-[0.22em] text-gold-bright/85">
            CONNECTION & STATUS
          </p>

          <div className="rounded-xl border border-gold-dim/20 bg-stone/10 p-3">
            <p className="text-[10px] tracking-[0.2em] text-gold-bright/80">
              DISPLAY
            </p>
            <div className="mt-2 space-y-2">
              <button
                type="button"
                onClick={() => setIsTrailPreviewVisible((prev) => !prev)}
                className="inline-flex w-full items-center justify-between rounded-lg border border-gold-dim/25 px-3 py-2 text-xs tracking-[0.12em] text-gold-bright/90 transition-colors hover:border-gold-bright/60 hover:text-gold-bright"
              >
                <span>軌道プレビュー</span>
                <span>{isTrailPreviewVisible ? "表示" : "非表示"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsStatusDisplayVisible((prev) => !prev)}
                className="inline-flex w-full items-center justify-between rounded-lg border border-gold-dim/25 px-3 py-2 text-xs tracking-[0.12em] text-gold-bright/90 transition-colors hover:border-gold-bright/60 hover:text-gold-bright"
              >
                <span>メイン状態表示</span>
                <span>{isStatusDisplayVisible ? "表示" : "非表示"}</span>
              </button>
              <button
                type="button"
                onClick={() => setEnableCircleGlowOnRButton((prev) => !prev)}
                className="inline-flex w-full items-center justify-between rounded-lg border border-gold-dim/25 px-3 py-2 text-xs tracking-[0.12em] text-gold-bright/90 transition-colors hover:border-gold-bright/60 hover:text-gold-bright"
              >
                <span>Rボタン時の魔法陣発光</span>
                <span>{enableCircleGlowOnRButton ? "有効" : "無効"}</span>
              </button>
            </div>
          </div>

          {/* 音声判定モード */}
          {isSupported ? (
            <>
              <button
                onClick={() =>
                  setSpeechLatencyMode((prev) =>
                    prev === "safe" ? "fast" : "safe",
                  )
                }
                className="w-full rounded-full border border-gold-dim/30 px-4 py-2 text-[11px] tracking-[0.18em] uppercase text-gold-bright/90 transition-colors hover:border-gold-bright/60 hover:text-gold-bright"
              >
                音声判定モード: {speechLatencyMode === "safe" ? "安全" : "高速"}
              </button>

              <button
                onClick={() =>
                  setCastingSyncMode((prev) =>
                    prev === "stable" ? "immersive" : "stable",
                  )
                }
                className="w-full rounded-full border border-gold-dim/30 px-4 py-2 text-[11px] tracking-[0.18em] uppercase text-gold-bright/90 transition-colors hover:border-gold-bright/60 hover:text-gold-bright"
              >
                発動同期モード: {castingSyncMode === "stable" ? "安定" : "同時詠唱"}
              </button>
            </>
          ) : (
            <p className="text-xs leading-relaxed tracking-wide text-gold-bright/75">
              音声認識非対応のブラウザです
            </p>
          )}

          {/* Phomemo */}
          <button
            onClick={handlePhomemoToggle}
            className="w-full rounded-full border border-gold-dim/40 px-4 py-2 text-sm tracking-widest text-gold-bright/90 transition-colors hover:border-gold-bright/60 hover:text-gold-bright"
          >
            {phomemoStatus === "CONNECTED" ||
            phomemoStatus === "CONNECTING" ||
            phomemoStatus === "PRINTING"
              ? "Phomemo切断"
              : "Phomemo接続"}
          </button>
          <p className="inline-flex items-center gap-2 text-xs tracking-widest text-gold-bright/85">
            <span
              aria-hidden="true"
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                isPhomemoConnectedState
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]"
              }`}
            />
            {phomemoStatusText}
          </p>

          {/* Joy-Con接続 */}
          <button
            onClick={handleJoyConToggle}
            className="w-full rounded-full border border-gold-dim/40 px-4 py-2 text-sm tracking-widest text-gold-bright/90 transition-colors hover:border-gold-bright/60 hover:text-gold-bright"
          >
            {joyConStatus === "CONNECTED" || joyConStatus === "CONNECTING"
              ? "Joy-Con切断"
              : "Joy-Con接続"}
          </button>
          <p className="inline-flex items-center gap-2 text-xs tracking-widest text-gold-bright/85">
            <span
              aria-hidden="true"
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                isJoyConConnected
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]"
              }`}
            />
            {joyConStatusText}
          </p>

          {inputDeviceErrorMessage && (
            <div className="rounded-xl border border-red-400/40 bg-red-950/20 px-4 py-3">
              <p className="text-xs leading-relaxed tracking-wide text-red-200">
                {inputDeviceErrorMessage}
              </p>
            </div>
          )}

          {/* ディスパッチステータス */}
          {dispatchPhase !== "idle" && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-xl border px-4 py-3 ${
                dispatchPhase === "success"
                  ? "border-emerald-400/40 bg-emerald-950/20"
                  : dispatchPhase === "failed" || dispatchPhase === "timeout"
                    ? "border-rose-400/40 bg-rose-950/20"
                    : "border-gold-dim/30 bg-stone/20"
              }`}
            >
              <p className="text-[10px] tracking-[0.2em] text-gold-bright/80">
                DISPATCH STATUS
              </p>
              <p className="mt-1 text-xs leading-relaxed tracking-wide text-gold-bright/90">
                {dispatchMessage}
              </p>
            </div>
          )}
        </div>
      </aside>

      <FloatingParticles />

      {/* Center magic circle */}
      <div className="fixed inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div
          className={`relative h-[460px] w-[460px] transition-[filter,opacity] duration-500 ease-out ${magicCircleGlowClass}`}
        >
          <AnchoredCircleLayer
            sizePercent={100}
            className={`transition-all duration-700 ease-out ${
              isVentusCircleActive
                ? "opacity-100 scale-100 blur-0"
                : "opacity-0 scale-[0.94] blur-[1.6px]"
            }`}
          >
            <AnchoredCircleLayer
              sizePercent={160}
              className="rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(153,255,103,0.28) 0%, rgba(88,235,116,0.2) 32%, rgba(29,80,42,0.08) 56%, rgba(8,22,36,0) 78%)",
                filter: "blur(24px)",
              }}
            >
              <></>
            </AnchoredCircleLayer>

            <AnchoredCircleLayer sizePercent={120}>
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <g className="origin-center animate-[spin_9s_linear_infinite]">
                  <ellipse
                    cx="50"
                    cy="50"
                    rx="45"
                    ry="16"
                    fill="none"
                    stroke="rgba(173,255,128,0.8)"
                    strokeWidth="1.2"
                    strokeDasharray="5 5"
                  />
                  <ellipse
                    cx="50"
                    cy="50"
                    rx="40"
                    ry="13"
                    fill="none"
                    stroke="rgba(124,255,144,0.72)"
                    strokeWidth="1"
                    transform="rotate(42 50 50)"
                  />
                  <ellipse
                    cx="50"
                    cy="50"
                    rx="34"
                    ry="11"
                    fill="none"
                    stroke="rgba(196,255,173,0.66)"
                    strokeWidth="0.9"
                    transform="rotate(118 50 50)"
                  />
                </g>

                <g className="origin-center animate-[spin_5.5s_linear_infinite_reverse]">
                  {Array.from({ length: 18 }, (_, i) => {
                    const angle = (i * 20 * Math.PI) / 180;
                    const x = Number((50 + 47 * Math.cos(angle)).toFixed(3));
                    const y = Number((50 + 47 * Math.sin(angle)).toFixed(3));
                    return (
                      <ellipse
                        key={`ventus-leaf-${i}`}
                        cx={x}
                        cy={y}
                        rx="1.15"
                        ry="2.7"
                        fill="rgba(178,255,137,0.88)"
                        transform={`rotate(${i * 20 + 90} ${x} ${y})`}
                      />
                    );
                  })}
                </g>

                <g className="origin-center animate-[spin_4.2s_linear_infinite]">
                  <path
                    d="M 22 50 C 31 25, 69 25, 78 50 C 69 75, 31 75, 22 50"
                    fill="none"
                    stroke="rgba(141,255,154,0.58)"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 50 22 C 75 31, 75 69, 50 78 C 25 69, 25 31, 50 22"
                    fill="none"
                    stroke="rgba(141,255,154,0.5)"
                    strokeWidth="0.95"
                    strokeLinecap="round"
                  />
                </g>

                <circle cx="50" cy="50" r="8.3" fill="rgba(223,255,198,0.85)" />
                <circle cx="50" cy="50" r="4.5" fill="rgba(255,255,235,0.95)" />
              </svg>
            </AnchoredCircleLayer>
          </AnchoredCircleLayer>

          {isImmersiveCircleGlowing && (
            <>
              <div
                className="absolute inset-[-24%] rounded-full"
                style={{
                  background:
                    isVentusCircleActive
                      ? "conic-gradient(from 0deg, rgba(167,255,123,0.23), rgba(81,240,125,0.16), rgba(167,255,123,0.23))"
                      : "conic-gradient(from 0deg, rgba(255,214,120,0.18), rgba(92,255,229,0.12), rgba(255,214,120,0.18))",
                  animation: "spin 6s linear infinite",
                  filter: "blur(18px)",
                }}
                aria-hidden="true"
              />
              <div
                className={`absolute inset-[-12%] rounded-full border ${
                  isVentusCircleActive ? "border-[#a9ff84]/65" : "border-[#ffd87f]/55"
                }`}
                style={{
                  animation: "spin 8s linear infinite reverse, pulse 1.8s ease-in-out infinite",
                }}
                aria-hidden="true"
              />
            </>
          )}

          {isMagicCircleGlowing && (
            <>
              <div
                className="absolute inset-[-18%] rounded-full animate-pulse"
                style={{
                  background:
                    isVentusCircleActive
                      ? "radial-gradient(circle, rgba(164,255,121,0.28) 0%, rgba(95,235,120,0.16) 40%, rgba(13,30,46,0) 74%)"
                      : "radial-gradient(circle, rgba(255,226,138,0.22) 0%, rgba(84,255,238,0.12) 38%, rgba(13,30,46,0) 72%)",
                }}
                aria-hidden="true"
              />
              <div
                className={`absolute inset-[-6%] rounded-full border animate-ping ${
                  isVentusCircleActive ? "border-[#b8ff9e]/65" : "border-[#f5d77a]/55"
                }`}
                style={{ animationDuration: "2.4s" }}
                aria-hidden="true"
              />
            </>
          )}

          <div className="h-full w-full">
            <HeroMagicCircle />
          </div>
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

        {/* Title */}
        <header className="absolute top-10 left-1/2 -translate-x-1/2 text-center">
          <h1 className="text-2xl font-bold tracking-[0.4em] text-gold-bright uppercase">
            Play
          </h1>
          <p className="mt-4 text-sm font-serif tracking-[0.15em] text-gold-dim/60">
            Joy-Conモード
          </p>
        </header>

        {/* Center content */}
        <div className="min-h-svh flex items-center justify-center">
          <div className="w-full max-w-sm text-center space-y-6">
            {/* Hidden canvas for IMU tracking */}
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="hidden"
              aria-hidden="true"
            />

            {/* WAND TRAIL PREVIEW */}
            {isTrailPreviewVisible && (
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
            )}

            {/* 音声認識状態表示 */}
            {isStatusDisplayVisible && (
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
            )}

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
                className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 backdrop-blur-sm transition-all duration-300 ${
                  isListening
                    ? "border-gold-bright bg-gold-bright/25 shadow-[0_0_26px_rgba(212,175,55,0.5)]"
                    : "border-gold-dim/70 bg-stone/45 shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:border-gold-bright/75 hover:bg-stone/65 hover:shadow-[0_0_20px_rgba(212,175,55,0.25)]"
                }`}
              >
                {isListening ? (
                  <MicOff
                    className="h-8 w-8 text-gold-bright"
                    strokeWidth={2.25}
                  />
                ) : (
                  <Mic
                    className="h-8 w-8 text-gold-bright/95"
                    strokeWidth={2.25}
                  />
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
