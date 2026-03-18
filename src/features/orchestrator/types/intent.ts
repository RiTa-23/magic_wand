export type SpellId =
  | "ventus"
  | "lumos"
  | "incendio"
  | "aguamenti"
  | "nox"
  | "kyua_uppu_rapa_pa"
  | "raiden"
  | "wave";

export type GestureType = "V" | "M" | "L" | "Z" | "InvV" | "Wave";

export interface VoiceIntentInput {
  spellId: SpellId;
  confidence: number;
  timestamp: number;
}

export interface GestureIntentInput {
  gestureType: GestureType;
  confidence: number;
  timestamp: number;
}

export type IntentGateReasonCode =
  | "voice_confidence_too_low"
  | "gesture_confidence_too_low"
  | "spell_gesture_mismatch"
  | "window_timeout";

export type IntentGateStatus =
  | "idle"
  | "waiting_for_gesture"
  | "waiting_for_voice"
  | "committed"
  | "rejected";

export interface IntentCommit {
  spellId: SpellId;
  gestureType: GestureType;
  committedAt: number;
  voice: VoiceIntentInput;
  gesture: GestureIntentInput;
}

export interface IntentGateResult {
  status: IntentGateStatus;
  reasonCode?: IntentGateReasonCode;
  commit?: IntentCommit;
}

export interface IntentGateConfig {
  timeWindowMs?: number;
  voiceConfidenceThreshold?: number;
  gestureConfidenceThreshold?: number;
  gestureBySpell?: Partial<Record<SpellId, GestureType>>;
}

export const DEFAULT_SPELL_GESTURE_MAP: Record<SpellId, GestureType> = {
  ventus: "V",
  lumos: "L",
  incendio: "InvV",
  aguamenti: "V",
  nox: "M",
  kyua_uppu_rapa_pa: "M",
  raiden: "Z",
  wave: "Wave",
};
