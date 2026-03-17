"use server";

import { getTapoClient } from "../api/tapoClient";

// ========================================
// ポートマッピング定数
// ========================================

/**
 * Tapo P300 の差し込み口と魔法の対応マップ
 * ポート番号（0-index）は P300 の物理的な差し込み順に対応する
 */
const SPELL_PORT = {
  VENTUS: 0, // ポート1: 風
  LUMOS: 1, // ポート2: 光
  INCENDIO: 2, // ポート3: 炎
  AGUAMENTI: 3, // ポート4: 水
} as const;

/** オートOFFのデフォルト待機時間（ミリ秒） */
const DEFAULT_AUTO_OFF_MS = 5000;

// ========================================
// 内部ヘルパー関数
// ========================================

/**
 * 指定したポート番号（インデックス）のポートをON/OFFする
 * @param portIndex - ポート番号（0-3）
 * @param turnOn - trueでON、falseでOFF
 * @param spellName - 魔法の名前（ログ用）
 * @param emoji - 絵文字（ログ用）
 */
async function togglePort(
  portIndex: number,
  turnOn: boolean,
  spellName: string,
  emoji: string,
) {
  try {
    console.log(
      `${emoji} ${spellName}発動！ポート${portIndex}を${turnOn ? "ON" : "OFF"}にします`,
    );
    const p300 = await getTapoClient();

    // P300の子デバイス（各ポート）を取得
    const childDevices = await p300.getChildDevicesInfo();
    console.log(`📡 子デバイス数: ${childDevices.length}`);

    if (childDevices.length === 0) {
      console.warn("⚠️ 子デバイスが見つかりません");
      return { success: false, message: "子デバイスが見つかりません" };
    }

    // 指定されたポートが存在するか確認
    if (portIndex < 0 || portIndex >= childDevices.length) {
      console.error(
        `❌ ポート${portIndex}は存在しません（利用可能: 0-${childDevices.length - 1}）`,
      );
      return {
        success: false,
        message: `ポート${portIndex}が見つかりません`,
      };
    }

    const targetPort = childDevices[portIndex];
    console.log(
      `🔌 ポート${portIndex} (${targetPort.nickname || targetPort.device_id}) を${turnOn ? "ON" : "OFF"}`,
    );

    // ポートをON/OFF
    if (turnOn) {
      await p300.turnOn(targetPort.device_id);
    } else {
      await p300.turnOff(targetPort.device_id);
    }

    return {
      success: true,
      message: `${spellName}成功！ポート${portIndex}を${turnOn ? "ON" : "OFF"}にしました${emoji}`,
    };
  } catch (error) {
    console.error(`❌ ${spellName}失敗:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `${spellName}失敗: ${errorMessage}` };
  }
}

// ========================================
// オートOFF内部ヘルパー
// ========================================

/**
 * ポートをONにし、指定時間後に自動でOFFにする
 * @param portIndex - ポート番号（SPELL_PORT定数を使うこと）
 * @param spellName - 魔法の名前（ログ用）
 * @param emoji - 絵文字（ログ用）
 * @param durationMs - ONのままにする時間（ミリ秒）
 */
async function castPortWithAutoOff(
  portIndex: number,
  spellName: string,
  emoji: string,
  durationMs: number,
) {
  const result = await togglePort(portIndex, true, spellName, emoji);
  if (result.success) {
    setTimeout(() => {
      togglePort(portIndex, false, `${spellName}自動解除`, "⏱️").catch(
        (err) => {
          console.error(`❌ ${spellName}自動解除失敗:`, err);
        },
      );
    }, durationMs);
    return {
      ...result,
      message: `${result.message}（${durationMs / 1000}秒後に自動解除）`,
    };
  }
  return result;
}

// ========================================
// 個別ポート制御の魔法
// ========================================

/**
 * 魔法: ヴェンタス - ポート0（風）をON
 */
export async function castVentus() {
  return togglePort(SPELL_PORT.VENTUS, true, "ヴェンタス", "🌪️");
}

/**
 * 魔法: ルーモス - ポート1（光）をON
 */
export async function castLumos() {
  return togglePort(SPELL_PORT.LUMOS, true, "ルーモス", "💡");
}

/**
 * 魔法: インセンディオ - ポート2（炎）をON
 */
export async function castIncendio() {
  return togglePort(SPELL_PORT.INCENDIO, true, "インセンディオ", "🔥");
}

/**
 * 魔法: アグアメンティ - ポート3（水）をON
 */
export async function castAguamenti() {
  return togglePort(SPELL_PORT.AGUAMENTI, true, "アグアメンティ", "💧");
}

/**
 * 魔法: ヴェンタスOFF - ポート0（風）をOFF
 */
export async function castVentusOff() {
  return togglePort(SPELL_PORT.VENTUS, false, "ヴェンタス解除", "🌫️");
}

/**
 * 魔法: ルーモスOFF - ポート1（光）をOFF
 */
export async function castLumosOff() {
  return togglePort(SPELL_PORT.LUMOS, false, "ルーモス解除", "🌑");
}

/**
 * 魔法: インセンディオOFF - ポート2（炎）をOFF
 */
export async function castIncendioOff() {
  return togglePort(SPELL_PORT.INCENDIO, false, "インセンディオ解除", "❄️");
}

/**
 * 魔法: アグアメンティOFF - ポート3（水）をOFF
 */
export async function castAguamentiOff() {
  return togglePort(SPELL_PORT.AGUAMENTI, false, "アグアメンティ解除", "🔥");
}

// ========================================
// オートOFF付き魔法（指定時間後に自動解除）
// ========================================

/**
 * 魔法: ヴェンタス（オートOFF）- ポート0をONにし、指定秒後にOFF
 * @param durationMs - ONのままにする時間（デフォルト: 5秒）
 */
export async function castVentusAuto(durationMs = DEFAULT_AUTO_OFF_MS) {
  return castPortWithAutoOff(SPELL_PORT.VENTUS, "ヴェンタス", "🌪️", durationMs);
}

/**
 * 魔法: ルーモス（オートOFF）- ポート1をONにし、指定秒後にOFF
 * @param durationMs - ONのままにする時間（デフォルト: 5秒）
 */
export async function castLumosAuto(durationMs = DEFAULT_AUTO_OFF_MS) {
  return castPortWithAutoOff(SPELL_PORT.LUMOS, "ルーモス", "💡", durationMs);
}

/**
 * 魔法: インセンディオ（オートOFF）- ポート2をONにし、指定秒後にOFF
 * @param durationMs - ONのままにする時間（デフォルト: 5秒）
 */
export async function castIncendioAuto(durationMs = DEFAULT_AUTO_OFF_MS) {
  return castPortWithAutoOff(
    SPELL_PORT.INCENDIO,
    "インセンディオ",
    "🔥",
    durationMs,
  );
}

/**
 * 魔法: アグアメンティ（オートOFF）- ポート3をONにし、指定秒後にOFF
 * @param durationMs - ONのままにする時間（デフォルト: 5秒）
 */
export async function castAguamentiAuto(durationMs = DEFAULT_AUTO_OFF_MS) {
  return castPortWithAutoOff(
    SPELL_PORT.AGUAMENTI,
    "アグアメンティ",
    "💧",
    durationMs,
  );
}

// ========================================
// 全ポート制御の魔法
// ========================================

/**
 * 魔法: マキシマ - すべてのポートをON
 */
export async function castMaxima() {
  try {
    console.log("✨ マキシマ発動！すべてのポートをONにします");
    const p300 = await getTapoClient();

    console.log("✅ デバイス接続成功");

    // P300の子デバイス（各ポート）を取得
    const childDevices = await p300.getChildDevicesInfo();
    console.log(`📡 子デバイス数: ${childDevices.length}`);
    console.log("子デバイスリスト:", JSON.stringify(childDevices, null, 2));

    if (childDevices.length === 0) {
      console.warn("⚠️ 子デバイスが見つかりません");
      return { success: false, message: "子デバイスが見つかりません" };
    }

    // すべての子デバイスをON
    for (const child of childDevices) {
      console.log(`🔌 ポート ${child.nickname || child.device_id} をON`);
      await p300.turnOn(child.device_id);
    }

    return {
      success: true,
      message: `マキシマ成功！${childDevices.length}個のポートをONにしました✨`,
    };
  } catch (error) {
    console.error("❌ マキシマ失敗:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `マキシマ失敗: ${errorMessage}` };
  }
}

/**
 * 魔法: ノックス - すべてのポートをOFF
 */
export async function castNox() {
  try {
    console.log("🌑 ノックス発動！すべてOFFにします");
    const p300 = await getTapoClient();

    console.log("✅ デバイス接続成功");

    // P300の子デバイス（各ポート）を取得
    const childDevices = await p300.getChildDevicesInfo();
    console.log(`📡 子デバイス数: ${childDevices.length}`);

    if (childDevices.length === 0) {
      console.warn("⚠️ 子デバイスが見つかりません");
      return { success: false, message: "子デバイスが見つかりません" };
    }

    // すべての子デバイスをOFF
    for (const child of childDevices) {
      console.log(`🔌 ポート ${child.nickname || child.device_id} をOFF`);
      await p300.turnOff(child.device_id);
    }

    return {
      success: true,
      message: `ノックス成功！${childDevices.length}個のポートをOFFにしました🌑`,
    };
  } catch (error) {
    console.error("❌ ノックス失敗:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `ノックス失敗: ${errorMessage}` };
  }
}

// ========================================
// デバッグ・情報取得
// ========================================

/**
 * デバイス情報を取得する関数（デバッグ・初期設定用）
 * ポートの順序とdevice_idを確認するために使用
 */
export async function getDeviceStatus() {
  try {
    console.log("🔍 デバイス情報を取得中...");
    const p300 = await getTapoClient();

    const deviceInfo = await p300.getDeviceInfo();
    const childDevices = await p300.getChildDevicesInfo();

    console.log("📱 デバイス情報:", JSON.stringify(deviceInfo, null, 2));
    console.log("🔌 子デバイス:", JSON.stringify(childDevices, null, 2));

    // Server Actionで安全にシリアライズできるプレーンオブジェクトに変換
    const sanitizedDeviceInfo = {
      device_id: deviceInfo.device_id,
      nickname: deviceInfo.nickname,
      model: deviceInfo.model,
      device_on: deviceInfo.device_on,
      ip: deviceInfo.ip,
      mac: deviceInfo.mac,
      fw_ver: deviceInfo.fw_ver,
      signal_level: deviceInfo.signal_level,
    };

    const sanitizedChildDevices = childDevices.map((child) => ({
      device_id: child.device_id,
      nickname: child.nickname,
      device_on: child.device_on,
      on_time: child.on_time,
    }));

    return {
      success: true,
      deviceInfo: sanitizedDeviceInfo,
      childDevices: sanitizedChildDevices,
      message: `デバイス: ${deviceInfo.nickname}, ポート数: ${childDevices.length}`,
    };
  } catch (error) {
    console.error("❌ 情報取得失敗:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `情報取得失敗: ${errorMessage}` };
  }
}

// ========================================
// マスター関数（他チーム用）
// ========================================

/**
 * 🎯 マスター関数: 魔法名を指定して実行
 *
 * 画像認識や音声認識を担当するメンバーが、この関数に魔法名を渡すだけで
 * Tapo制御を簡単に実行できるようにするための統一インターフェース。
 *
 * @param spellName - 魔法名（大文字始まり）
 * - `"Ventus"` - 風ON（ポート0）
 * - `"VentusOff"` - 風OFF
 * - `"Lumos"` - 光ON（ポート1）
 * - `"LumosOff"` - 光OFF
 * - `"Incendio"` - 炎ON（ポート2）
 * - `"IncendioOff"` - 炎OFF
 * - `"Aguamenti"` - 水ON（ポート3）
 * - `"AguamentiOff"` - 水OFF
 * - `"Maxima"` - 全ポートON
 * - `"Nox"` - 全ポートOFF
 *
 * @returns 実行結果 `{ success: boolean, message: string }`
 *
 * @example
 * // 音声認識から呼び出す場合
 * const result = await executeSpell("Ventus");
 * console.log(result.message); // "ヴェンタス成功！ポート0をONにしました🌪️"
 *
 * @example
 * // 画像認識から呼び出す場合
 * const result = await executeSpell("Lumos");
 * if (result.success) {
 *   console.log("魔法成功！");
 * }
 */
export async function executeSpell(spellName: string) {
  switch (spellName) {
    case "Ventus":
      return await castVentus();
    case "VentusOff":
      return await castVentusOff();
    case "Lumos":
      return await castLumos();
    case "LumosOff":
      return await castLumosOff();
    case "Incendio":
      return await castIncendio();
    case "IncendioOff":
      return await castIncendioOff();
    case "Aguamenti":
      return await castAguamenti();
    case "AguamentiOff":
      return await castAguamentiOff();
    case "Maxima":
      return await castMaxima();
    case "Nox":
      return await castNox();
    case "VentusAuto":
      return await castVentusAuto();
    case "LumosAuto":
      return await castLumosAuto();
    case "IncendioAuto":
      return await castIncendioAuto();
    case "AguamentiAuto":
      return await castAguamentiAuto();
    default:
      console.log("未知の魔法っす…！");
      return { success: false, message: "未知の魔法っす" };
  }
}
