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
    id: "kyua_uppu_rapa_pa",
    name: "キュアップラパパ",
    keywords: [
      "キュアップラパパ",
      "きゅあっぷらぱぱ",
      "キュアップラパパ今日のおみくじ",
      "きゅあっぷらぱぱきょうのおみくじ",
      "キュアップラパパ今日のおみくじお願いします",
      "きゅあっぷらぱぱきょうのおみくじおねがいします",
    ],
    action: "print_omikuji",
  },
  {
    id: "incendio",
    name: "インセンディオ",
    keywords: [
      "インセンディオ",
      "インセンデイオ",
      "インセンディオー",
      "インセンディーオ",
      "いんせんでぃお",
      "いんせんでいお",
      "いんせんでぃおー",
      "インセンディョ",
      "いんせんでぃよ",
      "incendio",
      "insendio",
      "炎よ",
    ],
    action: "fire_on",
  },
  {
    id: "raiden",
    name: "ライデイン",
    keywords: [
      "ライデイン",
      "らいでいん",
      "ライデイン",
      "ライデン",
      "らいでん",
      "雷",
      "raiden",
    ],
    action: "lightning_on",
  },
  {
    id: "wave",
    name: "ウェーブ",
    keywords: ["ウェーブ", "うぇーぶ", "うえーぶ", "wave", "ウェイブ"],
    action: "wave_on",
  },
];

function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[.,。、！？!?・\s\n\r]/g, "")
    .replace(/[ーｰ]/g, "")
    .trim()
    .toLowerCase();
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[a.length][b.length];
}

/**
 * 認識されたテキストと辞書を照合し、一致する呪文を返す
 */
export function matchSpell(
  transcript: string,
  dictionary: SpellEntry[] = SPELL_DICTIONARY,
): SpellMatchResult {
  // 1. Unicode正規化 (NFKC) + 記号/空白/長音のゆれ吸収
  const normalized = normalizeForMatch(transcript);

  if (!normalized) {
    return {
      matched: false,
      spell: null,
      confidence: 0,
      rawTranscript: transcript,
    };
  }

  // --- 第一パス: 完全一致を優先 ---
  for (const spell of dictionary) {
    for (const keyword of spell.keywords) {
      const normalizedKeyword = normalizeForMatch(keyword);

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
      const normalizedKeyword = normalizeForMatch(keyword);
      const allowReversePartial = spell.id !== "kyua_uppu_rapa_pa";

      // キーワードが3文字以上、または特定の重要な呪文の場合にのみ部分一致を許容するなどの工夫も可能
      if (
        normalized.includes(normalizedKeyword) ||
        (allowReversePartial && normalizedKeyword.includes(normalized))
      ) {
        return {
          matched: true,
          spell,
          confidence: 0.8, // 部分一致は少し信頼度を下げる
          rawTranscript: transcript,
        };
      }
    }
  }

  // --- 第三パス: 軽いファジー一致（誤認識1-2文字を救済） ---
  if (normalized.length >= 4) {
    for (const spell of dictionary) {
      for (const keyword of spell.keywords) {
        const normalizedKeyword = normalizeForMatch(keyword);
        if (!normalizedKeyword) continue;

        const lengthDiff = Math.abs(
          normalized.length - normalizedKeyword.length,
        );
        if (lengthDiff > 2) continue;

        const distance = levenshteinDistance(normalized, normalizedKeyword);
        if (distance <= 2) {
          return {
            matched: true,
            spell,
            confidence: 0.65,
            rawTranscript: transcript,
          };
        }
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
