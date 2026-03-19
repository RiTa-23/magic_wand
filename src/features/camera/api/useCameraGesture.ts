import { useEffect, useRef, useCallback, useState } from "react";
import {
  recognizeGesture,
  type TrailPoint,
  type GestureResult,
} from "@/features/gesture/recognizer";
import type { WandDetectionResult } from "../types/camera";

/** ジェスチャー判定に必要な最小ポイント数 */
const MIN_TRAIL_POINTS = 20;
/** ジェスチャー用トレイルの最大ポイント数 */
const MAX_GESTURE_TRAIL = 500;

/** フォーカス中のインタラクティブ要素ではSpaceをジェスチャーに使わない */
const INTERACTIVE_SELECTOR =
  "button, input, textarea, select, [role='button'], [contenteditable]";

function isInteractiveElementFocused(): boolean {
  const el = document.activeElement;
  if (!el || el === document.body) return false;
  return el.matches(INTERACTIVE_SELECTOR);
}

export type CameraGestureCallbacks = {
  /** スペースキー押下時（録画開始時）に呼ばれる */
  onRecordStart?: () => void;
  /** スペースキー離し時（録画終了時）に呼ばれる */
  onRecordEnd?: () => void;
};

export type CameraGestureState = {
  /** 最新のジェスチャー判定結果 */
  lastGesture: GestureResult | null;
  /** 現在ジェスチャーを描画中か（スペースキー長押し中） */
  isDrawing: boolean;
  /** ジェスチャー用トレイルをリセット */
  resetGesture: () => void;
};

/**
 * カメラベースのジェスチャー認識フック
 *
 * スペースキー長押しで軌跡を蓄積し、離したタイミングでジェスチャー判定を行う。
 * Joy-ConのRボタンと同じ明示的な開始/終了方式。
 * onRecordStart/onRecordEndで音声認識の同時開始/停止を連動できる。
 */
export function useCameraGesture(
  wandPoint: WandDetectionResult | null,
  callbacks?: CameraGestureCallbacks,
): CameraGestureState {
  const [lastGesture, setLastGesture] = useState<GestureResult | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const gestureTrailRef = useRef<TrailPoint[]>([]);
  const lastTimestampRef = useRef(0);
  const isRecordingRef = useRef(false);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const resetGesture = useCallback(() => {
    gestureTrailRef.current = [];
    isRecordingRef.current = false;
    setIsDrawing(false);
    setLastGesture(null);
  }, []);

  // スペースキー長押し → 蓄積開始、離す → 判定
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (isInteractiveElementFocused()) return;
      e.preventDefault();
      isRecordingRef.current = true;
      gestureTrailRef.current = [];
      lastTimestampRef.current = 0;
      setLastGesture(null);
      setIsDrawing(true);
      callbacksRef.current?.onRecordStart?.();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (!isRecordingRef.current) return;
      if (isInteractiveElementFocused()) return;
      e.preventDefault();
      isRecordingRef.current = false;
      setIsDrawing(false);
      callbacksRef.current?.onRecordEnd?.();

      const trail = gestureTrailRef.current;
      if (trail.length < MIN_TRAIL_POINTS) {
        gestureTrailRef.current = [];
        setLastGesture(null);
        return;
      }

      const result = recognizeGesture(trail);
      if (result.type !== "unknown") {
        setLastGesture(result);
      } else {
        setLastGesture(null);
      }
      gestureTrailRef.current = [];
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // 録画中のみ杖先座標を蓄積
  useEffect(() => {
    if (!isRecordingRef.current) return;
    if (!wandPoint || !wandPoint.detected) return;
    if (wandPoint.timestamp === lastTimestampRef.current) return;
    lastTimestampRef.current = wandPoint.timestamp;

    const now = performance.now();
    gestureTrailRef.current.push({
      rawX: wandPoint.tipX,
      rawY: wandPoint.tipY,
      t: now,
    });
    if (gestureTrailRef.current.length > MAX_GESTURE_TRAIL) {
      gestureTrailRef.current.shift();
    }
  }, [wandPoint]);

  return { lastGesture, isDrawing, resetGesture };
}
