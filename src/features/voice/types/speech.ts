/** 音声認識の状態 */
export type SpeechStatus =
  | "IDLE" // 未開始
  | "LISTENING" // 認識中
  | "ERROR"; // エラー

/** 認識結果の1件 */
export interface SpeechResult {
  transcript: string; // 認識テキスト
  confidence: number; // 信頼度 (0.0〜1.0)
  isFinal: boolean; // 確定結果かどうか
  timestamp: number; // タイムスタンプ
}

/** 呪文定義 */
export interface SpellEntry {
  id: string; // 呪文の一意ID
  name: string; // 呪文名（例: "ルーモス"）
  keywords: string[]; // マッチ対象のキーワード群（表記ゆれ対応）
  action: string; // 発動するアクション（例: "light_on"）
}

/** 呪文マッチング結果 */
export interface SpellMatchResult {
  matched: boolean; // マッチしたかどうか
  spell: SpellEntry | null; // マッチした呪文
  confidence: number; // 一致度
  rawTranscript: string; // 元の認識テキスト
}