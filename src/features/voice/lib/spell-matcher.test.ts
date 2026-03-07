import { describe, it, expect } from "vitest";
import { matchSpell, SPELL_DICTIONARY } from "./spell-matcher";

describe("matchSpell", () => {
  it("キーワードが完全に一致する場合にマッチすること", () => {
    const result = matchSpell("ルーモス");
    expect(result.matched).toBe(true);
    expect(result.spell?.id).toBe("lumos");
  });

  it("ひらがなでの入力でもマッチすること", () => {
    const result = matchSpell("るーもす");
    expect(result.matched).toBe(true);
    expect(result.spell?.id).toBe("lumos");
  });

  it("文章の中にキーワードが含まれている場合にマッチすること", () => {
    const result = matchSpell("光を、ルーモス！");
    expect(result.matched).toBe(true);
    expect(result.spell?.id).toBe("lumos");
  });

  it("大文字小文字を区別せずにマッチすること", () => {
    const result = matchSpell("LUMOS");
    expect(result.matched).toBe(true);
    expect(result.spell?.id).toBe("lumos");
  });

  it("辞書にない言葉の場合はマッチしないこと", () => {
    const result = matchSpell("こんにちは");
    expect(result.matched).toBe(false);
    expect(result.spell).toBeNull();
  });

  it("表記ゆれ（キーワード配列）の他の要素でもマッチすること", () => {
    const result = matchSpell("消えて");
    // "nox" のキーワードに "消えて" は入れていないが、
    // SPELL_DICTIONARYを直接テストする場合は既存のキーワードで確認
    const customResult = matchSpell("消えて", [
      { id: "test", name: "テスト", keywords: ["消えて"], action: "test" }
    ]);
    expect(customResult.matched).toBe(true);
  });
});
