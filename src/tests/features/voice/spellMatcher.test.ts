import { describe, expect, it } from "vitest";
import {
  matchSpell,
  SPELL_DICTIONARY,
} from "@/features/voice/lib/spell-matcher";

describe("Spell matcher: kyua_uppu_rapa_pa strict matching", () => {
  it("matches full phrase variants intentionally", () => {
    const exact = matchSpell("キュアップラパパ", SPELL_DICTIONARY);
    const withOmikuji = matchSpell(
      "キュアップラパパ 今日のおみくじ",
      SPELL_DICTIONARY,
    );

    expect(exact.matched).toBe(true);
    expect(exact.spell?.id).toBe("kyua_uppu_rapa_pa");
    expect(withOmikuji.matched).toBe(true);
    expect(withOmikuji.spell?.id).toBe("kyua_uppu_rapa_pa");
  });

  it("does not match generic or incomplete utterances", () => {
    const genericOmikuji = matchSpell("おみくじ", SPELL_DICTIONARY);
    const genericKyua = matchSpell("キュアップ", SPELL_DICTIONARY);

    expect(genericOmikuji.matched).toBe(false);
    expect(genericKyua.matched).toBe(false);
  });
});
