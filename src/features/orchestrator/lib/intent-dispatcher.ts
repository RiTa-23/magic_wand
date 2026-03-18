import { IntentCommit, SpellId } from "../types/intent";

const DEFAULT_DISPATCH_TIMEOUT_MS = 9000;

const TAPO_SPELL_NAME_BY_ID: Record<Exclude<SpellId, "kyua_uppu_rapa_pa">, string> =
  {
    ventus: "Ventus",
    lumos: "Lumos",
    incendio: "Incendio",
    aguamenti: "Aguamenti",
    nox: "Nox",
  };

const OMIKUJI_MESSAGES = [
  "【大吉】\n魔法が最高に冴える日。新しい挑戦がうまくいきます。",
  "【中吉】\n良い流れです。焦らず丁寧に進めれば成果が出ます。",
  "【小吉】\n小さな幸運が積み重なる日。基本を大切に。",
  "【末吉】\n準備に向いた日。整えるほど後半が楽になります。",
  "【凶】\n無理せず休息を。体力温存が次の好機を呼びます。",
];

export type DispatchErrorCode =
  | "printer_disconnected"
  | "dispatch_failed"
  | "dispatch_timeout";

export interface IntentDispatchResult {
  ok: boolean;
  target: "tapo" | "omikuji";
  message: string;
  errorCode?: DispatchErrorCode;
}

export interface IntentDispatchDeps {
  executeTapoSpell: (
    spellName: string,
  ) => Promise<{ success: boolean; message: string }>;
  isPrinterConnected: () => boolean;
  printOmikuji: (message: string) => Promise<void>;
  createOmikujiMessage?: () => string;
  timeoutMs?: number;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timerId = setTimeout(() => {
      reject(new Error("dispatch_timeout"));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timerId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timerId);
        reject(error);
      });
  });
}

export function createDefaultOmikujiMessage(): string {
  const picked =
    OMIKUJI_MESSAGES[Math.floor(Math.random() * OMIKUJI_MESSAGES.length)];
  return `${picked}\n\nMofurun Omikuji`;
}

export async function dispatchCommittedIntent(
  commit: IntentCommit,
  deps: IntentDispatchDeps,
): Promise<IntentDispatchResult> {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_DISPATCH_TIMEOUT_MS;

  try {
    if (commit.spellId === "kyua_uppu_rapa_pa") {
      if (!deps.isPrinterConnected()) {
        return {
          ok: false,
          target: "omikuji",
          errorCode: "printer_disconnected",
          message:
            "おみくじプリンターが未接続です。接続してからもう一度発動してください。",
        };
      }

      const message = deps.createOmikujiMessage
        ? deps.createOmikujiMessage()
        : createDefaultOmikujiMessage();

      await withTimeout(deps.printOmikuji(message), timeoutMs);
      return {
        ok: true,
        target: "omikuji",
        message: "おみくじ印刷が完了しました。",
      };
    }

    const tapoSpellName = TAPO_SPELL_NAME_BY_ID[commit.spellId];
    const tapoResult = await withTimeout(
      deps.executeTapoSpell(tapoSpellName),
      timeoutMs,
    );

    if (!tapoResult.success) {
      return {
        ok: false,
        target: "tapo",
        errorCode: "dispatch_failed",
        message: tapoResult.message || "Tapo実行に失敗しました。",
      };
    }

    return {
      ok: true,
      target: "tapo",
      message: tapoResult.message,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "dispatch_timeout") {
      return {
        ok: false,
        target: commit.spellId === "kyua_uppu_rapa_pa" ? "omikuji" : "tapo",
        errorCode: "dispatch_timeout",
        message: "発動処理がタイムアウトしました。もう一度お試しください。",
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      target: commit.spellId === "kyua_uppu_rapa_pa" ? "omikuji" : "tapo",
      errorCode: "dispatch_failed",
      message: `発動に失敗しました: ${message}`,
    };
  }
}
