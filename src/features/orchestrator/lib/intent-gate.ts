import {
  DEFAULT_SPELL_GESTURE_MAP,
  GestureIntentInput,
  GestureType,
  IntentCommit,
  IntentGateConfig,
  IntentGateReasonCode,
  IntentGateResult,
  VoiceIntentInput,
} from "../types/intent";

const DEFAULT_TIME_WINDOW_MS = 2500;
const DEFAULT_VOICE_CONFIDENCE_THRESHOLD = 0.8;
const DEFAULT_GESTURE_CONFIDENCE_THRESHOLD = 0.7;

export class IntentGate {
  private readonly timeWindowMs: number;
  private readonly voiceConfidenceThreshold: number;
  private readonly gestureConfidenceThreshold: number;
  private readonly gestureBySpell: typeof DEFAULT_SPELL_GESTURE_MAP;

  private pendingVoice: VoiceIntentInput | null = null;
  private pendingGesture: GestureIntentInput | null = null;

  constructor(config: IntentGateConfig = {}) {
    this.timeWindowMs = config.timeWindowMs ?? DEFAULT_TIME_WINDOW_MS;
    this.voiceConfidenceThreshold =
      config.voiceConfidenceThreshold ?? DEFAULT_VOICE_CONFIDENCE_THRESHOLD;
    this.gestureConfidenceThreshold =
      config.gestureConfidenceThreshold ?? DEFAULT_GESTURE_CONFIDENCE_THRESHOLD;
    this.gestureBySpell = {
      ...DEFAULT_SPELL_GESTURE_MAP,
      ...config.gestureBySpell,
    };
  }

  pushVoice(input: VoiceIntentInput): IntentGateResult {
    const timeoutReason = this.purgeExpired(input.timestamp);

    if (input.confidence < this.voiceConfidenceThreshold) {
      return {
        status: "rejected",
        reasonCode: "voice_confidence_too_low",
      };
    }

    if (!this.pendingGesture) {
      this.pendingVoice = input;
      return {
        status: "waiting_for_gesture",
        reasonCode: timeoutReason ?? undefined,
      };
    }

    const expectedGesture = this.gestureBySpell[input.spellId];
    if (this.pendingGesture.gestureType !== expectedGesture) {
      this.pendingGesture = null;
      this.pendingVoice = input;
      return {
        status: "waiting_for_gesture",
        reasonCode: "spell_gesture_mismatch",
      };
    }

    const commit: IntentCommit = {
      spellId: input.spellId,
      gestureType: this.pendingGesture.gestureType,
      committedAt: Math.max(input.timestamp, this.pendingGesture.timestamp),
      voice: input,
      gesture: this.pendingGesture,
    };

    this.clear();

    return {
      status: "committed",
      commit,
    };
  }

  pushGesture(input: GestureIntentInput): IntentGateResult {
    const timeoutReason = this.purgeExpired(input.timestamp);

    if (input.confidence < this.gestureConfidenceThreshold) {
      return {
        status: "rejected",
        reasonCode: "gesture_confidence_too_low",
      };
    }

    if (!this.pendingVoice) {
      this.pendingGesture = input;
      return {
        status: "waiting_for_voice",
        reasonCode: timeoutReason ?? undefined,
      };
    }

    const expectedGesture = this.gestureBySpell[this.pendingVoice.spellId];
    if (input.gestureType !== expectedGesture) {
      this.pendingVoice = null;
      this.pendingGesture = input;
      return {
        status: "waiting_for_voice",
        reasonCode: "spell_gesture_mismatch",
      };
    }

    const commit: IntentCommit = {
      spellId: this.pendingVoice.spellId,
      gestureType: input.gestureType,
      committedAt: Math.max(this.pendingVoice.timestamp, input.timestamp),
      voice: this.pendingVoice,
      gesture: input,
    };

    this.clear();

    return {
      status: "committed",
      commit,
    };
  }

  getState(now = Date.now()): IntentGateResult {
    this.purgeExpired(now);

    if (this.pendingVoice) {
      return { status: "waiting_for_gesture" };
    }

    if (this.pendingGesture) {
      return { status: "waiting_for_voice" };
    }

    return { status: "idle" };
  }

  clear() {
    this.pendingVoice = null;
    this.pendingGesture = null;
  }

  private purgeExpired(now: number): IntentGateReasonCode | null {
    let didExpire = false;

    if (
      this.pendingVoice &&
      now - this.pendingVoice.timestamp > this.timeWindowMs
    ) {
      this.pendingVoice = null;
      didExpire = true;
    }

    if (
      this.pendingGesture &&
      now - this.pendingGesture.timestamp > this.timeWindowMs
    ) {
      this.pendingGesture = null;
      didExpire = true;
    }

    return didExpire ? "window_timeout" : null;
  }
}

export type { GestureType, IntentGateResult, VoiceIntentInput };
