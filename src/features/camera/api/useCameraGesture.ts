import { useEffect, useRef, useCallback, useState } from "react";
import {
  recognizeGesture,
  type TrailPoint,
  type GestureResult,
} from "@/features/gesture/recognizer";
import type { WandDetectionResult } from "../types/camera";

/** 杖先が静止したとみなすまでの時間（ms） */
const IDLE_TIMEOUT_MS = 400;
/** 杖先の移動速度がこれ以下なら「静止」とみなす（px/frame）
 *  EMAスムージング後でもカメラ検出ノイズで2〜4px程度のジッターがあるため余裕を持たせる */
const VELOCITY_THRESHOLD = 6;
/** ジェスチャー判定に必要な最小ポイント数 */
const MIN_TRAIL_POINTS = 20;
/** 判定後のクールダウン（ms） */
const GESTURE_COOLDOWN_MS = 800;
/** ジェスチャー用トレイルの最大ポイント数 */
const MAX_GESTURE_TRAIL = 500;

export type CameraGestureState = {
  /** 最新のジェスチャー判定結果 */
  lastGesture: GestureResult | null;
  /** 現在ジェスチャーを描画中か（杖が動いている状態） */
  isDrawing: boolean;
  /** ジェスチャー用トレイルをリセット */
  resetGesture: () => void;
};

/**
 * カメラベースのジェスチャー認識フック
 *
 * Joy-Con版との違い:
 * - Rボタンの代わりに、杖先の動き/停止を自動検出してジェスチャーの区切りを判定
 * - 杖先が一定時間静止 or 検出ロスト → 蓄積した軌跡でジェスチャー判定
 * - 判定後はクールダウンを挟んで次のジェスチャーの蓄積を開始
 */
export function useCameraGesture(
  wandPoint: WandDetectionResult | null,
): CameraGestureState {
  const [lastGesture, setLastGesture] = useState<GestureResult | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // ジェスチャー判定用の軌跡バッファ（表示用trailとは独立）
  const gestureTrailRef = useRef<TrailPoint[]>([]);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const idleStartRef = useRef<number | null>(null);
  const lastGestureAtRef = useRef(0);
  const lastTimestampRef = useRef(0);

  const resetGesture = useCallback(() => {
    gestureTrailRef.current = [];
    lastPosRef.current = null;
    idleStartRef.current = null;
    setIsDrawing(false);
    setLastGesture(null);
  }, []);

  // 蓄積された軌跡でジェスチャー判定を実行
  const tryRecognize = useCallback(() => {
    const trail = gestureTrailRef.current;
    if (trail.length < MIN_TRAIL_POINTS) {
      // ポイントが足りない→軌跡をクリアして次へ
      gestureTrailRef.current = [];
      setIsDrawing(false);
      return;
    }

    const result = recognizeGesture(trail);
    if (result.type !== "unknown") {
      setLastGesture(result);
      lastGestureAtRef.current = performance.now();
    }

    // 判定後は軌跡をクリア
    gestureTrailRef.current = [];
    lastPosRef.current = null;
    idleStartRef.current = null;
    setIsDrawing(false);
  }, []);

  useEffect(() => {
    const now = performance.now();

    // クールダウン中はスキップ
    if (now - lastGestureAtRef.current < GESTURE_COOLDOWN_MS) {
      return;
    }

    // 杖が検出されていない場合
    if (!wandPoint || !wandPoint.detected) {
      if (gestureTrailRef.current.length > 0 && idleStartRef.current === null) {
        // 検出ロスト → idle開始
        idleStartRef.current = now;
      }
      if (
        idleStartRef.current !== null &&
        now - idleStartRef.current >= IDLE_TIMEOUT_MS
      ) {
        tryRecognize();
      }
      return;
    }

    // 同じタイムスタンプのフレームは無視
    if (wandPoint.timestamp === lastTimestampRef.current) return;
    lastTimestampRef.current = wandPoint.timestamp;

    const tipX = wandPoint.tipX;
    const tipY = wandPoint.tipY;

    // 前回位置との速度を計算
    const prev = lastPosRef.current;
    let velocity = Infinity; // 初回は「動いている」扱い
    if (prev) {
      const dx = tipX - prev.x;
      const dy = tipY - prev.y;
      velocity = Math.sqrt(dx * dx + dy * dy);
    }
    lastPosRef.current = { x: tipX, y: tipY };

    if (velocity > VELOCITY_THRESHOLD) {
      // 杖が動いている → ポイントを蓄積、idle解除
      gestureTrailRef.current.push({ rawX: tipX, rawY: tipY, t: now });
      if (gestureTrailRef.current.length > MAX_GESTURE_TRAIL) {
        gestureTrailRef.current.shift();
      }
      idleStartRef.current = null;
      setIsDrawing(true);
    } else {
      // 杖が静止している
      if (gestureTrailRef.current.length > 0 && idleStartRef.current === null) {
        idleStartRef.current = now;
      }
      if (
        idleStartRef.current !== null &&
        now - idleStartRef.current >= IDLE_TIMEOUT_MS
      ) {
        tryRecognize();
      }
    }
  }, [wandPoint, tryRecognize]);

  return { lastGesture, isDrawing, resetGesture };
}
