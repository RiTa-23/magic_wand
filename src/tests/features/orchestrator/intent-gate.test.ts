import { describe, expect, it } from "vitest";
import { IntentGate } from "@/features/orchestrator/lib/intent-gate";

describe("IntentGate", () => {
  it("一致した音声と軌道で commit する", () => {
    const gate = new IntentGate();

    const voiceResult = gate.pushVoice({
      spellId: "ventus",
      confidence: 0.95,
      timestamp: 1000,
    });
    const gestureResult = gate.pushGesture({
      gestureType: "V",
      confidence: 0.9,
      timestamp: 2000,
    });

    expect(voiceResult.status).toBe("waiting_for_gesture");
    expect(gestureResult.status).toBe("committed");
    expect(gestureResult.commit?.spellId).toBe("ventus");
    expect(gestureResult.commit?.gestureType).toBe("V");
    expect(gate.getState(2000).status).toBe("idle");
  });

  it("呪文と軌道が不一致なら commit しない", () => {
    const gate = new IntentGate();

    gate.pushVoice({
      spellId: "nox",
      confidence: 0.95,
      timestamp: 1000,
    });
    const result = gate.pushGesture({
      gestureType: "V",
      confidence: 0.9,
      timestamp: 1500,
    });

    expect(result.status).toBe("waiting_for_voice");
    expect(result.reasonCode).toBe("spell_gesture_mismatch");
    expect(result.commit).toBeUndefined();
  });

  it("タイムウィンドウ外では commit しない", () => {
    const gate = new IntentGate();

    gate.pushVoice({
      spellId: "lumos",
      confidence: 0.95,
      timestamp: 1000,
    });
    const result = gate.pushGesture({
      gestureType: "V",
      confidence: 0.9,
      timestamp: 4000,
    });

    expect(result.status).toBe("waiting_for_voice");
    expect(result.reasonCode).toBe("window_timeout");
    expect(result.commit).toBeUndefined();
  });

  it("逆順到着で絶対時間差が大きい場合も commit しない", () => {
    const gate = new IntentGate();

    gate.pushGesture({
      gestureType: "V",
      confidence: 0.9,
      timestamp: 5000,
    });
    const result = gate.pushVoice({
      spellId: "ventus",
      confidence: 0.95,
      timestamp: 1000,
    });

    expect(result.status).toBe("waiting_for_voice");
    expect(result.reasonCode).toBe("window_timeout");
    expect(result.commit).toBeUndefined();
    expect(gate.getState(5000).status).toBe("waiting_for_voice");
  });

  it("逆順到着で新しい入力を保持して継続待機できる", () => {
    const gate = new IntentGate();

    gate.pushVoice({
      spellId: "ventus",
      confidence: 0.95,
      timestamp: 1000,
    });
    const result = gate.pushGesture({
      gestureType: "V",
      confidence: 0.9,
      timestamp: 5000,
    });

    expect(result.status).toBe("waiting_for_voice");
    expect(result.reasonCode).toBe("window_timeout");
    expect(result.commit).toBeUndefined();
    expect(gate.getState(5000).status).toBe("waiting_for_voice");
  });

  it("音声 confidence が不足している場合は reject する", () => {
    const gate = new IntentGate();

    const result = gate.pushVoice({
      spellId: "incendio",
      confidence: 0.79,
      timestamp: 1000,
    });

    expect(result.status).toBe("rejected");
    expect(result.reasonCode).toBe("voice_confidence_too_low");
    expect(gate.getState(1000).status).toBe("idle");
  });

  it("軌道 confidence が不足している場合は reject する", () => {
    const gate = new IntentGate();

    gate.pushVoice({
      spellId: "aguamenti",
      confidence: 0.95,
      timestamp: 1000,
    });
    const result = gate.pushGesture({
      gestureType: "V",
      confidence: 0.69,
      timestamp: 1500,
    });

    expect(result.status).toBe("rejected");
    expect(result.reasonCode).toBe("gesture_confidence_too_low");
    expect(gate.getState(1500).status).toBe("waiting_for_gesture");
  });

  it("pending はタイムアウト時にクリアされる", () => {
    const gate = new IntentGate();

    gate.pushVoice({
      spellId: "kyua_uppu_rapa_pa",
      confidence: 0.99,
      timestamp: 1000,
    });

    expect(gate.getState(1000).status).toBe("waiting_for_gesture");
    expect(gate.getState(4000).status).toBe("idle");
  });

  it("コンストラクタで閾値と時間窓を上書きできる", () => {
    const gate = new IntentGate({
      timeWindowMs: 1000,
      voiceConfidenceThreshold: 0.6,
      gestureConfidenceThreshold: 0.5,
    });

    gate.pushVoice({
      spellId: "ventus",
      confidence: 0.61,
      timestamp: 1000,
    });
    const result = gate.pushGesture({
      gestureType: "V",
      confidence: 0.51,
      timestamp: 1800,
    });

    expect(result.status).toBe("committed");
  });

  it("不正な timeWindowMs では RangeError を投げる", () => {
    expect(() => new IntentGate({ timeWindowMs: 0 })).toThrow(RangeError);
    expect(() => new IntentGate({ timeWindowMs: -1 })).toThrow(
      /DEFAULT_TIME_WINDOW_MS/,
    );
  });

  it("不正な confidence 閾値では RangeError を投げる", () => {
    expect(() => new IntentGate({ voiceConfidenceThreshold: -0.1 })).toThrow(
      /DEFAULT_VOICE_CONFIDENCE_THRESHOLD/,
    );
    expect(() => new IntentGate({ voiceConfidenceThreshold: 1.1 })).toThrow(
      RangeError,
    );
    expect(() => new IntentGate({ gestureConfidenceThreshold: -0.1 })).toThrow(
      /DEFAULT_GESTURE_CONFIDENCE_THRESHOLD/,
    );
    expect(() => new IntentGate({ gestureConfidenceThreshold: 1.1 })).toThrow(
      RangeError,
    );
  });
});
