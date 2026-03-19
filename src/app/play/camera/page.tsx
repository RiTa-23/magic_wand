"use client";

import { ChevronLeft, Mic, MicOff, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HeroMagicCircle } from "@/components/hero-magic-circle";
import { useWandDetector } from "@/features/camera/api/useWandDetector";
import { useCameraGesture } from "@/features/camera/api/useCameraGesture";
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
import type { GestureResult } from "@/features/gesture/recognizer";

// ── 定数 ──
const GESTURE_COOLDOWN_MS = 800;
const INTENT_WINDOW_MS = 10000;
const GESTURE_CONFIDENCE_THRESHOLD = 0.45;
const VOICE_CONFIDENCE_THRESHOLD = 0.6;
const DISPATCH_COOLDOWN_MS = 1200;
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const PADDING = 40;
const TRAIL_DURATION = 3000;
const WAVE_GESTURE_RECOVERY_WINDOW_MS = 3000;

type DispatchPhase = "idle" | "running" | "success" | "failed" | "timeout";
type SpeechLatencyMode = "safe" | "fast";

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

export default function CameraPlayPage() {
  // ── カメラ・ジェスチャー ──
  const {
    status: cameraStatus,
    wandPoint,
    videoRef,
    connect: connectCamera,
    disconnect: disconnectCamera,
  } = useWandDetector();
  const { lastGesture, isDrawing, resetGesture } = useCameraGesture(wandPoint);

  // ── 音声認識 ──
  const [speechLatencyMode, setSpeechLatencyMode] =
    useState<SpeechLatencyMode>("safe");
  const {
    status: speechStatus,
    finalSpellMatch,
    start,
    stop,
    isSupported,
  } = useSpeech(
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
    new IntentGate({
      timeWindowMs: INTENT_WINDOW_MS,
      voiceConfidenceThreshold: VOICE_CONFIDENCE_THRESHOLD,
      gestureConfidenceThreshold: GESTURE_CONFIDENCE_THRESHOLD,
    }),
  );

  // ── UI状態 ──
  const [gateResult, setGateResult] = useState<IntentGateResult | null>(null);
  const [persistedSpellName, setPersistedSpellName] = useState<string | null>(
    null,
  );
  const [showCommitFeedback, setShowCommitFeedback] = useState(false);
  const [commitLabel, setCommitLabel] = useState("");
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const [dispatchPhase, setDispatchPhase] = useState<DispatchPhase>("idle");
  const [dispatchMessage, setDispatchMessage] = useState("");
  const [inputDeviceErrorMessage, setInputDeviceErrorMessage] = useState<
    string | null
  >(null);
  const [autoOffEnabled, setAutoOffEnabledState] = useState(
    DEFAULT_AUTO_OFF_ENABLED,
  );

  // ── Refs ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<{ rawX: number; rawY: number; t: number }[]>([]);
  const animFrameRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);
  const wandPointRef = useRef(wandPoint);
  const viewBoundsRef = useRef<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>(null);
  const lastGestureAtRef = useRef(0);
  const isDispatchingRef = useRef(false);
  const lastDispatchAtRef = useRef(0);
  const lastHandledCommitRef = useRef("");
  const recentGestureInputRef = useRef<GestureIntentInput | null>(null);

  // wandPointの最新値をrefに反映
  useEffect(() => {
    wandPointRef.current = wandPoint;
  }, [wandPoint]);

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

  // ── カメラ切断時にリセット ──
  useEffect(() => {
    if (cameraStatus !== "CONNECTED" && cameraStatus !== "INITIALIZING") {
      trailRef.current = [];
      lastTimestampRef.current = 0;
      viewBoundsRef.current = null;
      resetGesture();
    }
  }, [cameraStatus, resetGesture]);

  // ── カメラエラー検知 ──
  useEffect(() => {
    if (cameraStatus === "ERROR") {
      setInputDeviceErrorMessage(
        "カメラ接続に失敗しました。権限設定と他アプリの使用状況を確認してください。",
      );
      return;
    }
    if (cameraStatus === "CONNECTED") {
      setInputDeviceErrorMessage(null);
    }
  }, [cameraStatus]);

  // ── カメラジェスチャー → IntentGate ──
  useEffect(() => {
    if (!lastGesture) return;
    const now = Date.now();
    const inCooldown = now - lastGestureAtRef.current < GESTURE_COOLDOWN_MS;
    if (inCooldown) return;
    handleRecognizedGesture(lastGesture, now);
  }, [lastGesture]);

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

  // ── ジェスチャー待ち → 音声認識自動開始 ──
  useEffect(() => {
    if (
      gateResult?.status === "waiting_for_voice" &&
      speechStatus === "IDLE" &&
      isSupported
    ) {
      start();
    }
  }, [gateResult?.status, isSupported, start, speechStatus]);

  // ── コミットフィードバック表示 ──
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

  // ── キャンバス描画（test/cameraベース） ──
  useEffect(() => {
    if (cameraStatus !== "CONNECTED" && cameraStatus !== "INITIALIZING") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const color = "34, 197, 94"; // green

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

      // 古い軌跡を削除
      while (trail.length > 0 && now - trail[0].t > TRAIL_DURATION) {
        trail.shift();
      }

      // 検出結果をトレイルに追加
      const wp = wandPointRef.current;
      if (wp && wp.detected) {
        if (wp.timestamp !== lastTimestampRef.current) {
          trail.push({ rawX: wp.tipX, rawY: wp.tipY, t: now });
          lastTimestampRef.current = wp.timestamp;
          if (trail.length > 200) trail.shift();
        }
      }

      // ビューポート計算
      const extraPoints: { rawX: number; rawY: number }[] = [];
      if (wp && wp.detected) {
        extraPoints.push({ rawX: wp.tipX, rawY: wp.tipY });
        extraPoints.push({ rawX: wp.gripX, rawY: wp.gripY });
      }

      const { minX, maxX, minY, maxY } = adjustViewBounds(
        trail,
        extraPoints,
        viewBoundsRef,
        100,
        0.1,
      );

      // 座標変換
      const toCanvas = (rawX: number, rawY: number) => {
        const spanX = Math.max(maxX - minX, 1);
        const spanY = Math.max(maxY - minY, 1);
        const drawW = CANVAS_WIDTH - PADDING * 2;
        const drawH = CANVAS_HEIGHT - PADDING * 2;
        const cx = PADDING + ((rawX - minX) / spanX) * drawW;
        const cy = PADDING + ((rawY - minY) / spanY) * drawH;
        return { cx, cy };
      };

      // 軌跡描画
      if (trail.length > 1) {
        for (let i = 1; i < trail.length; i++) {
          const age = (now - trail[i].t) / TRAIL_DURATION;
          const alpha = Math.max(0, 1 - age);
          const p0 = toCanvas(trail[i - 1].rawX, trail[i - 1].rawY);
          const p1 = toCanvas(trail[i].rawX, trail[i].rawY);
          ctx.strokeStyle = `rgba(${color}, ${alpha * 0.7})`;
          ctx.lineWidth = Math.max(1, (1 - age) * 3);
          ctx.beginPath();
          ctx.moveTo(p0.cx, p0.cy);
          ctx.lineTo(p1.cx, p1.cy);
          ctx.stroke();
        }
      }

      // 杖先 + 手元の描画
      if (wp && wp.detected) {
        const tip = toCanvas(wp.tipX, wp.tipY);
        const grip = toCanvas(wp.gripX, wp.gripY);

        // tip-grip 接続線
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tip.cx, tip.cy);
        ctx.lineTo(grip.cx, grip.cy);
        ctx.stroke();

        // grip（手元）: 黄ドット
        drawDot(ctx, grip.cx, grip.cy, "234, 179, 8");
        // tip（杖先）: 緑ドット
        drawDot(ctx, tip.cx, tip.cy, color);

        // 座標ラベル
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "11px monospace";
        ctx.fillText(
          `tip (${Math.round(wp.tipX)}, ${Math.round(wp.tipY)})`,
          tip.cx + 14,
          tip.cy - 8,
        );
      }

      // モードラベル
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("CAMERA モード", PADDING, PADDING - 10);

      // 範囲情報
      if (isFinite(minX)) {
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "10px monospace";
        ctx.fillText(
          `X: ${Math.round(minX)}〜${Math.round(maxX)}  Y: ${Math.round(minY)}〜${Math.round(maxY)}`,
          PADDING,
          CANVAS_HEIGHT - 10,
        );
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    };
  }, [cameraStatus]);

  // ── ハンドラー ──
  const handleMicToggle = () => {
    if (speechStatus === "LISTENING") {
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

  const handleCameraToggle = async () => {
    if (cameraStatus === "CONNECTED" || cameraStatus === "INITIALIZING") {
      try {
        await Promise.resolve(disconnectCamera());
        gate.current.clear();
        setGateResult(null);
        trailRef.current = [];
        viewBoundsRef.current = null;
        resetGesture();
        setInputDeviceErrorMessage(null);
      } catch (error) {
        console.error("Failed to disconnect camera:", error);
        setInputDeviceErrorMessage(
          "カメラ切断に失敗しました。再度お試しください。",
        );
      }
      return;
    }
    try {
      await connectCamera();
      setInputDeviceErrorMessage(null);
    } catch (error) {
      console.error("Failed to connect camera:", error);
      setInputDeviceErrorMessage(
        "カメラ接続に失敗しました。再度お試しください。",
      );
      resetGesture();
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
  const isListening = speechStatus === "LISTENING";
  const isWaitingForGesture = gateResult?.status === "waiting_for_gesture";
  const isWaitingForVoice = gateResult?.status === "waiting_for_voice";
  const isCommitted = gateResult?.status === "committed";
  const isRejected = gateResult?.status === "rejected";
  const spellName = persistedSpellName;
  const isWandDetected = Boolean(wandPoint?.detected);
  const isConnected = cameraStatus === "CONNECTED";

  const statusText = (() => {
    if (speechStatus === "ERROR") return "エラーが発生しました";
    if (isListening) return "聴いています...";
    if (isWaitingForGesture) return "呪文受付済 - 杖を振ってください";
    if (isWaitingForVoice) return "軌道受付済 - 呪文を唱えてください";
    if (isCommitted) return "魔法発動成功！";
    if (isRejected) return "信頼度不足 - もう一度試してください";
    return "待機中...";
  })();

  const cameraStatusText = (() => {
    if (cameraStatus === "INITIALIZING") return "カメラ初期化中...";
    if (cameraStatus === "DISCONNECTED") return "カメラ未接続";
    if (cameraStatus === "ERROR") return "カメラ接続エラー";
    if (isDrawing) return "軌道入力中 (杖の動きを検出中)...";
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
    if (phomemoStatus === "ERROR")
      return phomemoErrorMessage || "Phomemoエラー";
    return "Phomemo接続済み";
  })();

  const isPhomemoConnectedState =
    phomemoStatus === "CONNECTED" || phomemoStatus === "PRINTING";

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

          {/* 音声判定モード */}
          {isSupported ? (
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

          {/* カメラ接続 */}
          <button
            onClick={handleCameraToggle}
            className="w-full rounded-full border border-gold-dim/40 px-4 py-2 text-sm tracking-widest text-gold-bright/90 transition-colors hover:border-gold-bright/60 hover:text-gold-bright"
          >
            {cameraStatus === "CONNECTED" || cameraStatus === "INITIALIZING"
              ? "カメラ切断"
              : "カメラ接続"}
          </button>
          <p className="inline-flex items-center gap-2 text-xs tracking-widest text-gold-bright/85">
            <span
              aria-hidden="true"
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                isConnected
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]"
              }`}
            />
            {cameraStatusText}
          </p>

          {inputDeviceErrorMessage && (
            <div className="rounded-xl border border-red-400/40 bg-red-950/20 px-4 py-3">
              <p className="text-xs leading-relaxed tracking-wide text-red-200">
                {inputDeviceErrorMessage}
              </p>
            </div>
          )}

          {/* ジェスチャー認識状態 */}
          <div className="rounded-xl border border-gold-dim/20 bg-stone/10 p-3">
            <p className="text-[10px] tracking-[0.2em] text-gold-bright/80">
              GESTURE
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  isDrawing ? "bg-green-400 animate-pulse" : "bg-gray-600"
                }`}
              />
              <span className="text-xs text-gold-bright/70">
                {isDrawing ? "描画中..." : "待機中"}
              </span>
            </div>
            {lastGesture && lastGesture.type !== "unknown" && (
              <div className="mt-2 rounded-lg bg-stone/20 p-2 text-center">
                <p className="text-2xl font-bold text-gold-bright">
                  {lastGesture.type}
                </p>
                <p className="text-[10px] text-gold-dim/70">
                  信頼度: {lastGesture.confidence.toFixed(3)}
                </p>
              </div>
            )}
          </div>

          {/* 杖検出情報 */}
          <div className="rounded-xl border border-gold-dim/20 bg-stone/10 p-3">
            <p className="text-[10px] tracking-[0.2em] text-gold-bright/80">
              WAND DETECTION
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="rounded bg-stone/20 p-2">
                <span className="text-gold-dim/60 text-[10px]">Tip X</span>
                <p className="text-green-400 font-bold">
                  {wandPoint?.detected ? Math.round(wandPoint.tipX) : "—"}
                </p>
              </div>
              <div className="rounded bg-stone/20 p-2">
                <span className="text-gold-dim/60 text-[10px]">Tip Y</span>
                <p className="text-green-400 font-bold">
                  {wandPoint?.detected ? Math.round(wandPoint.tipY) : "—"}
                </p>
              </div>
            </div>
            <div className="mt-2 rounded bg-stone/20 p-2 text-xs">
              <span className="text-gold-dim/60 text-[10px]">信頼度</span>
              <p className="text-gold-bright/90 font-mono">
                {wandPoint?.detected ? wandPoint.confidence.toFixed(3) : "—"}
              </p>
            </div>
          </div>

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

      {/* カメラプレビュー（左下固定） */}
      <div className="fixed left-6 bottom-6 z-30 w-48 rounded-xl border border-gold-dim/20 overflow-hidden bg-stone/10 shadow-lg">
        <video
          ref={videoRef}
          className="w-full"
          style={{
            aspectRatio: "640/480",
            transform: "scaleX(-1)",
            display: isConnected ? "block" : "none",
          }}
          playsInline
          muted
        />
        {!isConnected && (
          <div
            className="flex items-center justify-center bg-stone/10"
            style={{ aspectRatio: "640/480" }}
          >
            <p className="text-gold-dim/50 text-[10px] text-center px-2">
              {cameraStatus === "INITIALIZING"
                ? "初期化中..."
                : "カメラ未接続"}
            </p>
          </div>
        )}
        {/* 杖検出インジケーター */}
        <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full border border-gold-dim/35 bg-black/50 px-1.5 py-0.5 text-[9px] tracking-[0.1em] text-gold-dim/85">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              isWandDetected
                ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]"
                : "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.9)]"
            }`}
          />
          {isWandDetected ? "DETECTED" : "SEARCHING"}
        </div>
      </div>

      {/* Center magic circle */}
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

        {/* Title */}
        <header className="absolute top-10 left-1/2 -translate-x-1/2 text-center">
          <h1 className="text-2xl font-bold tracking-[0.4em] text-gold-bright uppercase">
            Play
          </h1>
          <p className="mt-4 text-sm font-serif tracking-[0.15em] text-gold-dim/60">
            カメラモード
          </p>
        </header>

        {/* Center content */}
        <div className="min-h-svh flex items-center justify-center">
          <div className="w-full max-w-2xl text-center space-y-6">
            {/* 軌道キャンバス（中央配置） */}
            <div className="relative w-full max-w-2xl mx-auto rounded-2xl border border-gold-dim/20 bg-stone/10 backdrop-blur-sm overflow-hidden">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="w-full rounded-2xl"
                style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
              />
              {showCommitFeedback && (
                <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(255,244,182,0.25)_0%,_rgba(212,175,55,0.08)_40%,_transparent_75%)] animate-pulse rounded-2xl" />
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
