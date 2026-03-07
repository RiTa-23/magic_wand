"use server";

import { getTapoClient } from "../api/tapoClient";

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
// 個別ポート制御の魔法
// ========================================

/**
 * 魔法: ヴェンタス - ポート0（風）をON
 */
export async function castVentus() {
  return togglePort(0, true, "ヴェンタス", "🌪️");
}

/**
 * 魔法: ルーモス - ポート1（光）をON
 */
export async function castLumos() {
  return togglePort(1, true, "ルーモス", "💡");
}

/**
 * 魔法: インセンディオ - ポート2（炎）をON
 */
export async function castIncendio() {
  return togglePort(2, true, "インセンディオ", "🔥");
}

/**
 * 魔法: アグアメンティ - ポート3（水）をON
 */
export async function castAguamenti() {
  return togglePort(3, true, "アグアメンティ", "💧");
}

/**
 * 魔法: ヴェンタスOFF - ポート0（風）をOFF
 */
export async function castVentusOff() {
  return togglePort(0, false, "ヴェンタス解除", "🌫️");
}

/**
 * 魔法: ルーモスOFF - ポート1（光）をOFF
 */
export async function castLumosOff() {
  return togglePort(1, false, "ルーモス解除", "🌑");
}

/**
 * 魔法: インセンディオOFF - ポート2（炎）をOFF
 */
export async function castIncendioOff() {
  return togglePort(2, false, "インセンディオ解除", "❄️");
}

/**
 * 魔法: アグアメンティOFF - ポート3（水）をOFF
 */
export async function castAguamentiOff() {
  return togglePort(3, false, "アグアメンティ解除", "🔥");
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
