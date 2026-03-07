"use server";

import { getTapoClient } from "../api/tapoClient";

// 魔法: ヴェンタス(ON) - すべてのポートをON
export async function castVentus() {
  try {
    console.log("🌪️ ヴェンタス発動！");
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
      message: `魔法成功！${childDevices.length}個のポートをONにしました🌪️`,
    };
  } catch (error) {
    console.error("❌ 魔法失敗...", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `残念、不発だよ: ${errorMessage}` };
  }
}

// 魔法: ノックス(OFF) - すべてのポートをOFF
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
      message: `魔法を解除しました！${childDevices.length}個のポートをOFFにしました🌑`,
    };
  } catch (error) {
    console.error("❌ 魔法失敗しました:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `解除に失敗: ${errorMessage}` };
  }
}

// デバイス情報を取得する関数（デバッグ用）
export async function getDeviceStatus() {
  try {
    console.log("🔍 デバイス情報を取得中...");
    const p300 = await getTapoClient();

    const deviceInfo = await p300.getDeviceInfo();
    const childDevices = await p300.getChildDevicesInfo();

    console.log("📱 デバイス情報:", JSON.stringify(deviceInfo, null, 2));
    console.log("🔌 子デバイス:", JSON.stringify(childDevices, null, 2));

    return {
      success: true,
      deviceInfo,
      childDevices,
      message: `デバイス: ${deviceInfo.nickname}, ポート数: ${childDevices.length}`,
    };
  } catch (error) {
    console.error("❌ 情報取得失敗:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `情報取得失敗: ${errorMessage}` };
  }
}
