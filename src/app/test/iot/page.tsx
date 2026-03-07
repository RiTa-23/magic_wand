"use client";

import { useState } from "react";
import {
  castVentus,
  castVentusOff,
  castLumos,
  castLumosOff,
  castIncendio,
  castIncendioOff,
  castAguamenti,
  castAguamentiOff,
  castMaxima,
  castNox,
  getDeviceStatus,
} from "@/features/iot/lib/plugControl";

export default function IotTestPage() {
  const [status, setStatus] = useState<string>(
    "待機中っす！ボタンを押してほしいっす！",
  );
  const [deviceInfo, setDeviceInfo] = useState<any>(null);

  const handleSpell = async (
    spellFn: () => Promise<any>,
    emoji: string,
    name: string,
  ) => {
    setStatus(`${emoji} ${name}詠唱中っす...`);
    const result = await spellFn();
    setStatus(result.message);
  };

  const handleGetStatus = async () => {
    setStatus("🔍 デバイス情報を取得中...");
    const result = await getDeviceStatus();
    setStatus(result.message);
    if (result.success) {
      setDeviceInfo(result);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">🪄 魔法陣（IoT）テスト画面</h1>

      <div className="bg-blue-50 p-4 rounded border border-blue-200">
        <p className="text-gray-700 font-medium">状態: {status}</p>
      </div>

      {/* 個別ポート制御 */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">個別ポート制御</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ポート0: 風 */}
          <div className="border rounded-lg p-4 bg-cyan-50">
            <h3 className="font-semibold mb-2">🌪️ ポート0（風）</h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleSpell(castVentus, "🌪️", "ヴェンタス")}
                className="flex-1 bg-cyan-500 text-white px-4 py-2 rounded shadow hover:bg-cyan-600 transition font-semibold"
              >
                ON
              </button>
              <button
                onClick={() =>
                  handleSpell(castVentusOff, "🌫️", "ヴェンタス解除")
                }
                className="flex-1 bg-gray-400 text-white px-4 py-2 rounded shadow hover:bg-gray-500 transition font-semibold"
              >
                OFF
              </button>
            </div>
          </div>

          {/* ポート1: 光 */}
          <div className="border rounded-lg p-4 bg-yellow-50">
            <h3 className="font-semibold mb-2">💡 ポート1（光）</h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleSpell(castLumos, "💡", "ルーモス")}
                className="flex-1 bg-yellow-500 text-white px-4 py-2 rounded shadow hover:bg-yellow-600 transition font-semibold"
              >
                ON
              </button>
              <button
                onClick={() => handleSpell(castLumosOff, "🌑", "ルーモス解除")}
                className="flex-1 bg-gray-400 text-white px-4 py-2 rounded shadow hover:bg-gray-500 transition font-semibold"
              >
                OFF
              </button>
            </div>
          </div>

          {/* ポート2: 炎 */}
          <div className="border rounded-lg p-4 bg-red-50">
            <h3 className="font-semibold mb-2">🔥 ポート2（炎）</h3>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  handleSpell(castIncendio, "🔥", "インセンディオ")
                }
                className="flex-1 bg-red-500 text-white px-4 py-2 rounded shadow hover:bg-red-600 transition font-semibold"
              >
                ON
              </button>
              <button
                onClick={() =>
                  handleSpell(castIncendioOff, "❄️", "インセンディオ解除")
                }
                className="flex-1 bg-gray-400 text-white px-4 py-2 rounded shadow hover:bg-gray-500 transition font-semibold"
              >
                OFF
              </button>
            </div>
          </div>

          {/* ポート3: 水 */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h3 className="font-semibold mb-2">💧 ポート3（水）</h3>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  handleSpell(castAguamenti, "💧", "アグアメンティ")
                }
                className="flex-1 bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600 transition font-semibold"
              >
                ON
              </button>
              <button
                onClick={() =>
                  handleSpell(castAguamentiOff, "🔥", "アグアメンティ解除")
                }
                className="flex-1 bg-gray-400 text-white px-4 py-2 rounded shadow hover:bg-gray-500 transition font-semibold"
              >
                OFF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 全ポート制御 */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">全ポート制御</h2>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => handleSpell(castMaxima, "✨", "マキシマ")}
            className="bg-purple-500 text-white px-6 py-3 rounded shadow hover:bg-purple-600 transition font-semibold"
          >
            ✨ マキシマ（全ON）
          </button>

          <button
            onClick={() => handleSpell(castNox, "🌑", "ノックス")}
            className="bg-gray-800 text-white px-6 py-3 rounded shadow hover:bg-gray-900 transition font-semibold"
          >
            🌑 ノックス（全OFF）
          </button>
        </div>
      </div>

      {/* デバイス情報 */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">デバッグ</h2>
        <button
          onClick={handleGetStatus}
          className="bg-green-500 text-white px-6 py-3 rounded shadow hover:bg-green-600 transition font-semibold"
        >
          🔍 デバイス情報を取得
        </button>

        {deviceInfo && (
          <div className="bg-gray-50 p-4 rounded border text-sm space-y-2">
            <h3 className="font-semibold">デバイス情報:</h3>
            <pre className="overflow-auto">
              {JSON.stringify(deviceInfo.deviceInfo, null, 2)}
            </pre>
            <h3 className="font-semibold">子デバイス（ポート）:</h3>
            <pre className="overflow-auto">
              {JSON.stringify(deviceInfo.childDevices, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-gray-700">
          💡 <strong>デバッグのヒント:</strong> まず「デバイス情報を取得」で
          ポートの順序を確認してから各魔法をテストしてください。
          ブラウザの開発者ツール（F12）とターミナルのログも確認できます。
        </p>
      </div>
    </div>
  );
}
