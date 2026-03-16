"use client";

import { useState } from "react";
import { usePhomemo } from "@/features/iot/api/usePhomemo";

const STATUS_EMOJI: Record<string, string> = {
  DISCONNECTED: "🔌",
  CONNECTING: "🔄",
  CONNECTED: "✅",
  PRINTING: "🖨️",
  ERROR: "❌",
};

const STATUS_LABEL: Record<string, string> = {
  DISCONNECTED: "未接続",
  CONNECTING: "接続中...",
  CONNECTED: "接続済み",
  PRINTING: "印刷中...",
  ERROR: "エラー",
};

export default function PhomemoTestPage() {
  const [printMessage, setPrintMessage] = useState("今日の運勢は大吉");
  const {
    status,
    deviceName,
    errorMessage,
    transportInfo,
    connect,
    disconnect,
    printTestPage,
    isConnected,
  } = usePhomemo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🖨️ Phomemo M02S テスト
          </h1>
          <p className="text-blue-200">
            Web Bluetooth APIで接続テスト（物質化の魔法の準備）
          </p>
        </div>

        {/* ステータス表示カード */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-4">📡 接続状態</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">ステータス:</span>
              <span className="text-white font-mono text-lg">
                {STATUS_EMOJI[status]} {STATUS_LABEL[status]}
              </span>
            </div>
            {deviceName && (
              <div className="flex items-center justify-between">
                <span className="text-gray-300">デバイス名:</span>
                <span className="text-white font-mono">{deviceName}</span>
              </div>
            )}
            {transportInfo && (
              <div className="flex items-start justify-between gap-4">
                <span className="text-gray-300">転送先:</span>
                <span className="text-white font-mono text-right text-xs break-all">
                  {transportInfo}
                </span>
              </div>
            )}
            {errorMessage && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-200 text-sm">{errorMessage}</p>
              </div>
            )}
          </div>
        </div>

        {/* 操作ボタン */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-4">
            🎮 操作パネル
          </h2>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={connect}
              disabled={isConnected || status === "CONNECTING"}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 active:scale-95 disabled:transform-none"
            >
              {status === "CONNECTING"
                ? "🔄 接続中..."
                : "📱 デバイスに接続する"}
            </button>
            <button
              onClick={disconnect}
              disabled={!isConnected}
              className="bg-red-500 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 active:scale-95 disabled:transform-none"
            >
              🔌 切断する
            </button>
            <label className="text-sm text-gray-300">
              印刷メッセージ
              <textarea
                value={printMessage}
                onChange={(event) => setPrintMessage(event.target.value)}
                rows={3}
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-gray-500"
                placeholder="印刷したいメッセージを入力"
              />
            </label>
            <button
              onClick={() => printTestPage(printMessage)}
              disabled={!isConnected || status === "PRINTING"}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 active:scale-95 disabled:transform-none"
            >
              {status === "PRINTING" ? "🖨️ 印刷中..." : "✨ テスト印刷する"}
            </button>
          </div>
        </div>

        {/* 使い方ガイド */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 mt-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-3">
            📖 テスト手順
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-300 text-sm">
            <li>Phomemo M02Sプリンターの電源を入れる</li>
            <li>「デバイスに接続する」ボタンをクリック</li>
            <li>ブラウザのダイアログで「M02S」を選択</li>
            <li>接続後にメッセージを入力して「テスト印刷する」を押す</li>
          </ol>
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-200 text-xs">
              ⚠️ このページはHTTPS環境またはlocalhostでのみ動作します
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
