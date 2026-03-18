import { describe, expect, it, vi } from "vitest";
import {
  createDefaultOmikujiMessage,
  dispatchCommittedIntent,
} from "@/features/orchestrator/lib/intent-dispatcher";
import { IntentCommit } from "@/features/orchestrator/types/intent";

function createCommit(spellId: IntentCommit["spellId"]): IntentCommit {
  return {
    spellId,
    gestureType: spellId === "nox" ? "M" : "V",
    committedAt: 1000,
    voice: {
      spellId,
      confidence: 0.95,
      timestamp: 900,
    },
    gesture: {
      gestureType: spellId === "nox" ? "M" : "V",
      confidence: 0.9,
      timestamp: 1000,
    },
  };
}

describe("dispatchCommittedIntent", () => {
  it("Tapo対象の呪文を executeTapoSpell にディスパッチする", async () => {
    const executeTapoSpell = vi
      .fn()
      .mockResolvedValue({ success: true, message: "Ventus success" });

    const result = await dispatchCommittedIntent(createCommit("ventus"), {
      executeTapoSpell,
      isPrinterConnected: () => true,
      printOmikuji: vi.fn(),
      timeoutMs: 100,
    });

    expect(executeTapoSpell).toHaveBeenCalledWith("Ventus");
    expect(result.ok).toBe(true);
    expect(result.target).toBe("tapo");
  });

  it("おみくじ呪文でプリンター未接続なら失敗を返す", async () => {
    const printOmikuji = vi.fn();

    const result = await dispatchCommittedIntent(
      createCommit("kyua_uppu_rapa_pa"),
      {
        executeTapoSpell: vi.fn(),
        isPrinterConnected: () => false,
        printOmikuji,
      },
    );

    expect(printOmikuji).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("printer_disconnected");
  });

  it("タイムアウト時は dispatch_timeout を返す", async () => {
    const executeTapoSpell = vi.fn(
      () => new Promise<{ success: boolean; message: string }>(() => {}),
    );

    const result = await dispatchCommittedIntent(createCommit("lumos"), {
      executeTapoSpell,
      isPrinterConnected: () => true,
      printOmikuji: vi.fn(),
      timeoutMs: 5,
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("dispatch_timeout");
  });

  it("デフォルトおみくじ文面を生成できる", () => {
    const message = createDefaultOmikujiMessage();
    expect(message).toContain("Mofurun Omikuji");
    expect(message.length).toBeGreaterThan(10);
  });

  it("wave呪文を Wave としてディスパッチする", async () => {
    const executeTapoSpell = vi
      .fn()
      .mockResolvedValue({ success: true, message: "Wave success" });

    const result = await dispatchCommittedIntent(createCommit("wave"), {
      executeTapoSpell,
      isPrinterConnected: () => true,
      printOmikuji: vi.fn(),
      timeoutMs: 100,
    });

    expect(executeTapoSpell).toHaveBeenCalledWith("Wave");
    expect(result.ok).toBe(true);
    expect(result.target).toBe("tapo");
  });
});
