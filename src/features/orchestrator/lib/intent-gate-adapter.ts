import { GestureResult } from "@/features/gesture/recognizer";
import { GestureIntentInput } from "../types/intent";

/**
 * Gesture認識結果をIntentGateの入力型へ正規化する
 */
export function toGestureIntentInput(
  result: GestureResult,
  timestamp = Date.now(),
): GestureIntentInput | null {
  if (result.type === "unknown") {
    return null;
  }

  return {
    gestureType: result.type,
    confidence: result.confidence,
    timestamp,
  };
}
