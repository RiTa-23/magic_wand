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
  {
    id: "ventus",
    name: "ヴェンタス",
    keywords: ["ヴェンタス", "べんたす", "ベントス","ベンタス", "ventus", "風よ"],
    action: "fan_on",
  },
];

/**
 * 認識されたテキストと辞書を照合し、一致する呪文を返す
 */
export function matchSpell(
  transcript: string,
  dictionary: SpellEntry[] = SPELL_DICTIONARY
): SpellMatchResult {
  // 1. Unicode正規化 (NFKC): 見た目が同じでコードが異なる文字（濁点など）を統一
  // 2. 句読点、記号、スペースをすべて削除
  const normalized = transcript
    .normalize("NFKC") // 濁点などの文字コードを統一
    .replace(/[.,。、！？！？\s\n\r]/g, "") 
    .trim()
    .toLowerCase();

  console.log(`マッチング中: 原文="${transcript}", 正規化後="${normalized}"`);

  for (const spell of dictionary) {
    for (const keyword of spell.keywords) {
      // 辞書側のキーワードも同じ方法で正規化して比較
      const normalizedKeyword = keyword
        .normalize("NFKC")
        .replace(/[.,。、！？！？\s\n\r]/g, "")
        .toLowerCase();
      
      if (normalized.includes(normalizedKeyword)) {
        console.log(`✅ マッチ成功: ${spell.name} (正規化一致: ${normalizedKeyword})`);
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
