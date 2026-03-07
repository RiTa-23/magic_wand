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
    id: "reducto",
    name: "リダクト",
    keywords: ["リダクト", "りだくと", "爆発", "reducto"],
    action: "fan_off",
  },
];

/**
 * 認識されたテキストと辞書を照合し、一致する呪文を返す
 */
export function matchSpell(
  transcript: string,
  dictionary: SpellEntry[] = SPELL_DICTIONARY
): SpellMatchResult {
  const normalized = transcript.trim().toLowerCase();

  for (const spell of dictionary) {
    for (const keyword of spell.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        return {
          matched: true,
          spell,
          confidence: 1.0, 
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
