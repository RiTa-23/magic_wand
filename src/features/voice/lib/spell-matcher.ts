import { SpellEntry, SpellMatchResult } from "../types/speech";

/**
 * 呪文辞書の定義
 */
export const SPELL_DICTIONARY: SpellEntry[] = [
  {
    id: "lumos",
    name: "ルーモス",
    keywords: ["ルーモス", "るーもす", "ルモス", "るもす", "lumos"],
    action: "light_on",
  },
  {
    id: "nox",
    name: "ノックス",
    keywords: ["ノックス", "のっくす", "ノクス", "nox"],
    action: "light_off",
  },
  {
    id: "aguamenti",
    name: "アグアメンティ",
    keywords: ["アグアメンティ", "あぐあめんてぃ", "水よ", "aguamenti"],
    action: "fan_on",
  },
  {
    id: "ventus",
    name: "ヴェンタス",
    keywords: [
      "ヴェンタス",
      "べんたす",
      "ベントス",
      "ベンタス",
      "ペンタス",
      "ventus",
      "風よ",
    ],
    action: "fan_on",
  },
  {
    id: "arresto_momentum",
    name: "アレスト モメンタム",
    keywords: [
      "アレストモメンタム",
      "アレスト モメンタム",
      "あれすと めんたむ",
      "あれすとめめんたむ",
      "arresto momentum",
      "arrest momentum",
      "止まれ",
      "減速",
    ],
    action: "fan_stop",
  },
];

/**
 * 認識されたテキストと辞書を照合し、一致する呪文を返す
 */
export function matchSpell(
  transcript: string,
  dictionary: SpellEntry[] = SPELL_DICTIONARY,
): SpellMatchResult {
  // 1. Unicode正規化 (NFKC) と記号・空白の削除
  const normalized = transcript
    .normalize("NFKC")
    .replace(/[.,。、！？！？\s\n\r]/g, "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return { matched: false, spell: null, confidence: 0, rawTranscript: transcript };
  }

  // --- 第一パス: 完全一致を優先 ---
  for (const spell of dictionary) {
    for (const keyword of spell.keywords) {
      const normalizedKeyword = keyword
        .normalize("NFKC")
        .replace(/[.,。、！？！？\s\n\r]/g, "")
        .toLowerCase();

      if (normalized === normalizedKeyword) {
        return {
          matched: true,
          spell,
          confidence: 1.0, // 完全一致は信頼度1.0
          rawTranscript: transcript,
        };
      }
    }
  }

  // --- 第二パス: 部分一致（日常会話での誤爆リスクがあるが、呪文の前後になにか入った場合を救済） ---
  for (const spell of dictionary) {
    for (const keyword of spell.keywords) {
      const normalizedKeyword = keyword
        .normalize("NFKC")
        .replace(/[.,。、！？！？\s\n\r]/g, "")
        .toLowerCase();

      // キーワードが3文字以上、または特定の重要な呪文の場合にのみ部分一致を許容するなどの工夫も可能
      if (normalized.includes(normalizedKeyword)) {
        return {
          matched: true,
          spell,
          confidence: 0.8, // 部分一致は少し信頼度を下げる
          rawTranscript: transcript,
        };
      }
    }
  }

  return {
    matched: false,
    spell: null,
    confidence: 0,
    rawTranscript: transcript,
  };
}

