"use client";

import { ChevronLeft, Mic, MicOff } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FloatingParticles } from "@/components/floating-particles";
import { HeroMagicCircle } from "@/components/hero-magic-circle";
import { useCameraGesture } from "@/features/camera/api/useCameraGesture";
import { useWandDetector } from "@/features/camera/api/useWandDetector";
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
  DEFAULT_SPELL_GESTURE_MAP,
  GestureIntentInput,
  GestureType,
  IntentGateResult,
  SpellId,
} from "@/features/orchestrator/types/intent";

const GESTURE_COOLDOWN_MS = 800;
const GYRO_SENSITIVITY = 0.12;
const GYRO_DEADZONE = 15;
const TRAIL_MIN_POINTS = 20;
const INTENT_WINDOW_MS = 10000; // 音声・ジェスチャーのマッチングウィンドウ: 10秒
const GESTURE_CONFIDENCE_THRESHOLD = 0.45; // ジェスチャー信頼度: 45%以上で判定
const VOICE_CONFIDENCE_THRESHOLD = 0.6; // 音声信頼度: 60%以上で判定
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
type PlayInputMode = "joycon" | "camera";
type GestureDebugInfo = {
  gestureType: GestureType | "unknown";
  confidence: number | null;
  recognizedAt: number;
  mappedSpells: SpellId[];
};

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

    // アスペクト比をキャンバスの描画領域に固定
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

export default function PlayPage() {
  const searchParams = useSearchParams();
  const playInputMode: PlayInputMode =
    searchParams.get("input") === "camera" ? "camera" : "joycon";
  const isJoyConMode = playInputMode === "joycon";
  const isCameraMode = playInputMode === "camera";

  const gate = useRef(
    new IntentGate({
      timeWindowMs: INTENT_WINDOW_MS,
      voiceConfidenceThreshold: VOICE_CONFIDENCE_THRESHOLD,
      gestureConfidenceThreshold: GESTURE_CONFIDENCE_THRESHOLD,
    }),
  );
  const [speechLatencyMode, setSpeechLatencyMode] =
    useState<SpeechLatencyMode>("safe");
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
  const {
    status: joyConStatus,
    joyconState,
    connect,
    disconnect,
  } = useJoyCon();
  const {
    status: cameraStatus,
    wandPoint,
    videoRef,
    connect: connectCamera,
    disconnect: disconnectCamera,
  } = useWandDetector();
  const {
    lastGesture: lastCameraGesture,
    isDrawing: isCameraDrawing,
    resetGesture: resetCameraGesture,
  } = useCameraGesture(wandPoint);
  const {
    status: phomemoStatus,
    errorMessage: phomemoErrorMessage,
    connect: connectPhomemo,
    disconnect: disconnectPhomemo,
    printTestPage,
    printOmikujiWithRandomImage,
    isConnected: isPhomemoConnected,
  } = usePhomemo();
  const [gateResult, setGateResult] = useState<IntentGateResult | null>(null);
  const [persistedSpellName, setPersistedSpellName] = useState<string | null>(
    null,
  );
  const [lastGestureDebug, setLastGestureDebug] =
    useState<GestureDebugInfo | null>(null);
  const [trailPathPoints, setTrailPathPoints] = useState("");
  const [showCommitFeedback, setShowCommitFeedback] = useState(false);
  const [commitLabel, setCommitLabel] = useState("");
  const [dispatchPhase, setDispatchPhase] = useState<DispatchPhase>("idle");
  const [dispatchMessage, setDispatchMessage] = useState("");
  const [calibrationState, setCalibrationState] = useState<
    "idle" | "calibrating" | "done"
  >("idle");
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [autoOffEnabled, setAutoOffEnabledState] = useState(
    DEFAULT_AUTO_OFF_ENABLED,
  );
  const trailRef = useRef<{ rawX: number; rawY: number; t: number }[]>([]);
  const cameraTrailRef = useRef<{ rawX: number; rawY: number; t: number }[]>(
    [],
  );
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
  const calibrationPrevAccelRef = useRef<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastCameraTimestampRef = useRef(0);
  const viewBoundsRef = useRef<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>(null);

  const handleRecognizedGesture = (recognized: GestureResult, now: number) => {
    if (recognized.type === "unknown") {
      setLastGestureDebug({
        gestureType: "unknown",
        confidence: null,
        recognizedAt: now,
        mappedSpells: [],
      });
      return;
    }

    const mappedSpells = (
      Object.entries(DEFAULT_SPELL_GESTURE_MAP) as [SpellId, GestureType][]
    )
      .filter(([, gestureType]) => gestureType === recognized.type)
      .map(([spellId]) => spellId);

    setLastGestureDebug({
      gestureType: recognized.type,
      confidence: recognized.confidence,
      recognizedAt: now,
      mappedSpells,
    });

    const gestureInput = toGestureIntentInput(recognized, now);
    if (!gestureInput) return;

    recentGestureInputRef.current = gestureInput;
    const gestureGateResult = gate.current.pushGesture(gestureInput);
    setGateResult(gestureGateResult);
    lastGestureAtRef.current = now;
  };

  useEffect(() => {
    setAutoOffEnabledState(getAutoOffEnabled());

    const handleStorage = (event: StorageEvent) => {
      if (event.key === AUTO_OFF_SETTING_KEY) {
        setAutoOffEnabledState(getAutoOffEnabled());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    gate.current.clear();
    setGateResult(null);
    setPersistedSpellName(null);
    setShowCommitFeedback(false);
    setCommitLabel("");
    setLastGestureDebug(null);
    recentGestureInputRef.current = null;
    lastGestureAtRef.current = 0;
    trailRef.current = [];
    cameraTrailRef.current = [];
    setTrailPathPoints("");
    prevRPressedRef.current = false;
    viewBoundsRef.current = null;
    imuPosRef.current = { x: 0, y: 0 };

    if (isCameraMode) {
      if (joyConStatus === "CONNECTED" || joyConStatus === "CONNECTING") {
        disconnect().catch((error) => {
          console.error(
            "Failed to disconnect Joy-Con while switching mode:",
            error,
          );
        });
      }
      return;
    }

    Promise.resolve(disconnectCamera())
      .catch((error) => {
        console.error(
          "Failed to disconnect camera while switching mode:",
          error,
        );
      })
      .finally(() => {
        resetCameraGesture();
      });
  }, [
    disconnect,
    disconnectCamera,
    isCameraMode,
    joyConStatus,
    resetCameraGesture,
  ]);

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

    const spellId = finalSpellMatch.spell.id as SpellId;

    const voiceResult = gate.current.pushVoice({
      spellId,
      confidence: finalSpellMatch.confidence,
      timestamp: Date.now(),
    });

    // Wジェスチャーは「認識表示は出たがGateに残らなかった」ケースを救済する
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
        stop();
        return;
      }

      const recoveredVoiceResult = gate.current.pushVoice({
        spellId,
        confidence: finalSpellMatch.confidence,
        timestamp: Date.now(),
      });
      setGateResult(recoveredVoiceResult);
      stop();
      return;
    }

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
    if (gateResult?.status !== "committed" || !gateResult.commit) return;

    const commit = gateResult.commit;
    const commitKey = `${commit.spellId}:${commit.gestureType}:${commit.committedAt}`;
    if (lastHandledCommitRef.current === commitKey) return;
    lastHandledCommitRef.current = commitKey;

    const now = Date.now();
    const inCooldown = now - lastDispatchAtRef.current < DISPATCH_COOLDOWN_MS;

    if (isDispatchingRef.current || inCooldown) {
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
    if (!isCameraMode || !lastCameraGesture) return;

    const now = Date.now();
    const inCooldown = now - lastGestureAtRef.current < GESTURE_COOLDOWN_MS;
    if (inCooldown) return;

    handleRecognizedGesture(lastCameraGesture, now);
    cameraTrailRef.current = [];
    setTrailPathPoints("");
  }, [isCameraMode, lastCameraGesture]);

  useEffect(() => {
    if (!isCameraMode) {
      cameraTrailRef.current = [];
      lastCameraTimestampRef.current = 0;
      return;
    }

    if (!wandPoint || !wandPoint.detected) {
      return;
    }

    if (wandPoint.timestamp === lastCameraTimestampRef.current) {
      return;
    }
    lastCameraTimestampRef.current = wandPoint.timestamp;

    const now = performance.now();
    const trail = cameraTrailRef.current;
    trail.push({ rawX: wandPoint.tipX, rawY: wandPoint.tipY, t: now });
    if (trail.length > 1000) trail.shift();

    while (trail.length > 0 && now - trail[0].t > 3000) {
      trail.shift();
    }

    setTrailPathPoints(
      toTrailPathPoints(trail.slice(-TRAIL_MAX_RENDER_POINTS)),
    );
  }, [isCameraMode, wandPoint]);

  useEffect(() => {
    if (!isJoyConMode) {
      trailRef.current = [];
      setTrailPathPoints("");
      imuPosRef.current = { x: 0, y: 0 };
      viewBoundsRef.current = null;
      prevRPressedRef.current = false;
      return;
    }

    if (joyConStatus !== "CONNECTED" || !joyconState) {
      trailRef.current = [];
      setTrailPathPoints("");
      imuPosRef.current = { x: 0, y: 0 };
      viewBoundsRef.current = null;
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
        handleRecognizedGesture(recognized, now);
      }

      trailRef.current = [];
      setTrailPathPoints("");
    }

    prevRPressedRef.current = isRPressed;
  }, [calibrationState, isJoyConMode, joyConStatus, joyconState]);

  // ── キャンバス描画 ──
  useEffect(() => {
    if (!isJoyConMode) return;

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

      // IMU トラッキングビジュアル
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
  }, [isJoyConMode, joyconState]);

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

  const handleSpeechLatencyModeToggle = () => {
    setSpeechLatencyMode((prev) => (prev === "safe" ? "fast" : "safe"));
  };

  const handleInputDeviceToggle = async () => {
    if (isJoyConMode) {
      if (joyConStatus === "CONNECTED" || joyConStatus === "CONNECTING") {
        await disconnect();
        gate.current.clear();
        setGateResult(null);
        trailRef.current = [];
        setTrailPathPoints("");
        return;
      }

      await connect();
      return;
    }

    if (cameraStatus === "CONNECTED" || cameraStatus === "INITIALIZING") {
      disconnectCamera();
      gate.current.clear();
      setGateResult(null);
      cameraTrailRef.current = [];
      setTrailPathPoints("");
      resetCameraGesture();
      return;
    }

    await connectCamera();
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

  const isListening = status === "LISTENING";
  const isWaitingForGesture = gateResult?.status === "waiting_for_gesture";
  const isWaitingForVoice = gateResult?.status === "waiting_for_voice";
  const isCommitted = gateResult?.status === "committed";
  const isRejected = gateResult?.status === "rejected";
  const spellName = persistedSpellName;
  const isDrawingGesture = isJoyConMode
    ? (joyconState?.buttons.r ?? false)
    : isCameraDrawing;
  const isCameraConnected = cameraStatus === "CONNECTED";
  const isWandDetected = Boolean(wandPoint?.detected);
  const cameraConfidenceText = wandPoint
    ? `${Math.round(wandPoint.confidence * 100)}%`
    : "-";
  const tipCoordinateText = wandPoint
    ? `(${Math.round(wandPoint.tipX)}, ${Math.round(wandPoint.tipY)})`
    : "-";

  const dispatchStatusText = (() => {
    if (dispatchPhase === "running") return dispatchMessage || "発動処理中...";
    if (dispatchPhase === "success") return dispatchMessage || "発動成功";
    if (dispatchPhase === "failed") return dispatchMessage || "発動失敗";
    if (dispatchPhase === "timeout") {
      return dispatchMessage || "発動タイムアウト";
    }
    return "待機中";
  })();

  const statusText = (() => {
    if (status === "ERROR") return "エラーが発生しました";
    if (isListening) return "聴いています...";
    if (isWaitingForGesture) return "呪文受付済 - 杖を振ってください";
    if (isWaitingForVoice) return "軌道受付済 - 呪文を唱えてください";
    if (isCommitted) return "魔法発動成功！";
    if (isRejected) return "信頼度不足 - もう一度試してください";
    return "待機中...";
  })();

  const inputModeLabel = isJoyConMode ? "Joy-Con慣性検知" : "杖の物体検出";

  const inputDeviceButtonLabel = (() => {
    if (isJoyConMode) {
      return joyConStatus === "CONNECTED" || joyConStatus === "CONNECTING"
        ? "Joy-Con切断"
        : "Joy-Con接続";
    }

    return cameraStatus === "CONNECTED" || cameraStatus === "INITIALIZING"
      ? "カメラ切断"
      : "カメラ接続";
  })();

  const inputDeviceStatusText = (() => {
    if (isJoyConMode) {
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
      if (
        isRejected &&
        gateResult?.reasonCode === "gesture_confidence_too_low"
      ) {
        return "軌道信頼度不足";
      }
      return "接続済み (R長押しで軌道入力)";
    }

    if (cameraStatus === "INITIALIZING") return "カメラ初期化中...";
    if (cameraStatus === "DISCONNECTED") return "カメラ未接続";
    if (cameraStatus === "ERROR") return "カメラ接続エラー";
    if (isDrawingGesture) return "軌道入力中 (杖の動きを検出中)...";
    if (isWaitingForVoice) return "軌道受付済";
    if (isRejected && gateResult?.reasonCode === "window_timeout") {
      return "受付時間切れ - 先に呪文か軌道のどちらかをやり直してください";
    }
    if (isRejected && gateResult?.reasonCode === "gesture_confidence_too_low") {
      return "軌道信頼度不足";
    }
    return "接続済み (杖を振って軌道入力)";
  })();

  const phomemoStatusText = (() => {
    if (phomemoStatus === "CONNECTING") return "Phomemo接続中...";
    if (phomemoStatus === "DISCONNECTED") return "Phomemo未接続";
    if (phomemoStatus === "PRINTING") return "Phomemo印刷中...";
    if (phomemoStatus === "ERROR") {
      return phomemoErrorMessage || "Phomemoエラー";
    }
    return "Phomemo接続済み";
  })();

  const gestureDebugText = (() => {
    if (!lastGestureDebug) {
      return {
        recognized: "まだ軌道認識はありません",
        mapped: "対応魔法: -",
      };
    }

    const confidenceText =
      lastGestureDebug.confidence === null
        ? "-"
        : `${Math.round(lastGestureDebug.confidence * 100)}%`;
    const recognized = `認識: ${lastGestureDebug.gestureType} (信頼度 ${confidenceText})`;
    const mapped =
      lastGestureDebug.mappedSpells.length > 0
        ? `対応魔法: ${lastGestureDebug.mappedSpells.join(" / ")}`
        : "対応魔法: なし";

    return { recognized, mapped };
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
            {/* WAND TRAIL PREVIEW - Hidden canvas for tracking visualization */}
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="hidden"
              aria-hidden="true"
            />

            <div className="mx-auto w-full max-w-[340px] h-[220px] rounded-2xl border border-gold-dim/20 bg-stone/10 backdrop-blur-sm relative overflow-hidden">
              <video
                ref={videoRef}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity ${
                  isCameraMode ? "opacity-45" : "opacity-0"
                }`}
                playsInline
                muted
                autoPlay
              />
              {isCameraMode && (
                <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/30 to-black/45" />
              )}
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
                  {isCameraMode ? "CAMERA + WAND TRAIL" : "WAND TRAIL PREVIEW"}
                </p>
              </div>

              {isCameraMode && (
                <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-gold-dim/35 bg-black/40 px-2 py-1 text-[10px] tracking-[0.15em] text-gold-dim/85">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      isWandDetected
                        ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                        : "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]"
                    }`}
                  />
                  {isWandDetected ? "WAND DETECTED" : "SEARCHING WAND"}
                </div>
              )}
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
              <>
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
                <button
                  onClick={handleSpeechLatencyModeToggle}
                  className="mx-auto px-4 py-1.5 rounded-full border border-gold-dim/30 text-[11px] tracking-[0.18em] uppercase text-gold-dim hover:border-gold-bright/60 hover:text-gold-bright transition-colors"
                >
                  音声判定モード:{" "}
                  {speechLatencyMode === "safe" ? "安全" : "高速"}
                </button>
              </>
            ) : (
              <p className="text-xs text-gold-dim/50 tracking-widest">
                音声認識非対応のブラウザです
              </p>
            )}

            <button
              onClick={handlePhomemoToggle}
              className="mx-auto px-6 py-2 rounded-full border border-gold-dim/40 text-sm tracking-widest text-gold-dim hover:border-gold-bright/60 hover:text-gold-bright transition-colors"
            >
              {phomemoStatus === "CONNECTED" ||
              phomemoStatus === "CONNECTING" ||
              phomemoStatus === "PRINTING"
                ? "Phomemo切断"
                : "Phomemo接続"}
            </button>

            <p className="text-xs tracking-widest text-gold-dim/70">
              {phomemoStatusText}
            </p>

            <div className="rounded-xl border border-gold-dim/20 bg-stone/10 px-4 py-3">
              <p className="text-[10px] tracking-[0.2em] text-gold-dim/70">
                INPUT MODE
              </p>
              <p className="mt-1 text-xs leading-relaxed tracking-wide text-gold-dim/85">
                {inputModeLabel}
              </p>
            </div>

            <button
              onClick={handleInputDeviceToggle}
              className="mx-auto px-6 py-2 rounded-full border border-gold-dim/40 text-sm tracking-widest text-gold-dim hover:border-gold-bright/60 hover:text-gold-bright transition-colors"
            >
              {inputDeviceButtonLabel}
            </button>

            <p className="text-xs tracking-widest text-gold-dim/70">
              {inputDeviceStatusText}
            </p>

            {isCameraMode && (
              <div className="rounded-xl border border-gold-dim/20 bg-stone/10 px-4 py-3 text-left">
                <p className="text-[10px] tracking-[0.2em] text-gold-dim/70">
                  CAMERA DEBUG
                </p>
                <p className="mt-1 text-xs leading-relaxed tracking-wide text-gold-dim/85">
                  接続: {isCameraConnected ? "CONNECTED" : cameraStatus}
                </p>
                <p className="text-xs leading-relaxed tracking-wide text-gold-dim/85">
                  検出: {isWandDetected ? "DETECTED" : "NOT DETECTED"}
                </p>
                <p className="text-xs leading-relaxed tracking-wide text-gold-dim/80">
                  信頼度: {cameraConfidenceText}
                </p>
                <p className="text-xs leading-relaxed tracking-wide text-gold-dim/75">
                  杖先座標: {tipCoordinateText}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-gold-dim/20 bg-stone/10 px-4 py-3">
              <p className="text-[10px] tracking-[0.2em] text-gold-dim/70">
                DISPATCH STATE
              </p>
              <p className="mt-1 text-xs leading-relaxed tracking-wide text-gold-dim/85">
                {dispatchStatusText}
              </p>
            </div>

            <div className="rounded-xl border border-gold-dim/20 bg-stone/10 px-4 py-3">
              <p className="text-[10px] tracking-[0.2em] text-gold-dim/70">
                GESTURE DEBUG
              </p>
              <p className="mt-1 text-xs leading-relaxed tracking-wide text-gold-dim/85">
                {gestureDebugText.recognized}
              </p>
              <p className="text-xs leading-relaxed tracking-wide text-gold-dim/75">
                {gestureDebugText.mapped}
              </p>
            </div>

            <p className="text-[11px] leading-relaxed tracking-wide text-gold-dim/60">
              コツ:{" "}
              {isJoyConMode
                ? "接続直後はレール側を下にして3秒静止すると安定します。呪文の後10秒以内に、R長押しで0.8〜1.5秒ほどV/M/L/Z/InvV/W（横一直線）を1回しっかり描いて離すと通りやすいです。"
                : "カメラ接続後は杖先が見える位置で、0.8〜1.5秒ほどV/M/L/Z/InvV/W（横一直線）をはっきり描いて一瞬静止すると認識されやすいです。"}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
