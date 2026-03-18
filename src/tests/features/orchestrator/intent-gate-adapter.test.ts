import { describe, expect, it } from "vitest";
import { toGestureIntentInput } from "@/features/orchestrator/lib/intent-gate-adapter";

describe("toGestureIntentInput", () => {
  it("VジェスチャーをGestureIntentInputへ変換する", () => {
    const input = toGestureIntentInput(
      {
        type: "V",
        confidence: 0.86,
      },
      1234,
    );

    expect(input).toEqual({
      gestureType: "V",
      confidence: 0.86,
      timestamp: 1234,
    });
  });

  it("LジェスチャーをGestureIntentInputへ変換する", () => {
    const input = toGestureIntentInput(
      {
        type: "L",
        confidence: 0.91,
      },
      3333,
    );

    expect(input).toEqual({
      gestureType: "L",
      confidence: 0.91,
      timestamp: 3333,
    });
  });

  it("unknownジェスチャーは変換しない", () => {
    const input = toGestureIntentInput(
      {
        type: "unknown",
      },
      5678,
    );

    expect(input).toBeNull();
  });
});
