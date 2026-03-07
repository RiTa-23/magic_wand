"use client";

import { useState } from "react";
import {
  castVentus,
  castNox,
  getDeviceStatus,
} from "@/features/iot/lib/plugControl";

export default function IotTestPage() {
  const [status, setStatus] = useState<string>(
    "待機中っす！ボタンを押してほしいっす！",
  );

  const handleVentus = async () => {
    setStatus("🌪️ 詠唱中っす...");
    const result = await castVentus();
    setStatus(result.message);
  };

  const handleNox = async () => {
    setStatus("🌑 詠唱中っす...");
    const result = await castNox();
    setStatus(result.message);
  };

  const handleGetStatus = async () => {
    setStatus("🔍 デバイス情報を取得中...");
    const result = await getDeviceStatus();
    setStatus(result.message);
  };

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">🪄 魔法陣（IoT）テスト画面</h1>
      <div className="bg-blue-50 p-4 rounded border border-blue-200">
        <p className="text-gray-700 font-medium">状態: {status}</p>
      </div>

      <div className="flex gap-4 flex-wrap">
        <button
          onClick={handleVentus}
          className="bg-blue-500 text-white px-6 py-3 rounded shadow hover:bg-blue-600 transition font-semibold"
        >
          🌪️ ヴェンタス（全ON）
        </button>

        <button
          onClick={handleNox}
          className="bg-gray-800 text-white px-6 py-3 rounded shadow hover:bg-gray-900 transition font-semibold"
        >
          🌑 ノックス（全OFF）
        </button>

        <button
          onClick={handleGetStatus}
          className="bg-green-500 text-white px-6 py-3 rounded shadow hover:bg-green-600 transition font-semibold"
        >
          🔍 デバイス情報
        </button>
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-gray-700">
          💡 <strong>デバッグのヒント:</strong>{" "}
          ブラウザの開発者ツール（F12）とターミナルのログを両方確認してください
        </p>
      </div>
    </div>
  );
}
