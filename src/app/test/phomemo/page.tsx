"use client";

import { useState, useEffect, useRef } from "react";
import { usePhomemo } from "@/features/iot/api/usePhomemo";
import { useSpeech } from "@/features/voice/api/useSpeech";
import { SPELL_DICTIONARY } from "@/features/voice/lib/spell-matcher";

const OMIKUJI_MESSAGES = [
  {
    fortune: "大吉",
    message: "魔法が最高に冴える日！\n何でも叶う最強の一日。",
  },
  {
    fortune: "中吉",
    message: "良い流れが来ている。\nゆっくり進めば夢に近づく。",
  },
  { fortune: "小吉", message: "小さな幸せが積み重なる日。\n丁寧に過ごそう。" },
  { fortune: "末吉", message: "焦らず待てば好機が来る。\n今日は準備の日。" },
  { fortune: "凶", message: "無理は禁物。\n休息が次の魔法を生む。" },
];

function drawOmikuji(): string {
  const picked =
    OMIKUJI_MESSAGES[Math.floor(Math.random() * OMIKUJI_MESSAGES.length)];
  return `【${picked.fortune}】
${picked.message}`;
}

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
  const [voiceStatus, setVoiceStatus] = useState("待機中");
  const [showConnectModal, setShowConnectModal] = useState(false);
  const lastVoiceKeyRef = useRef<string>("");
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

  // おみくじ呪文のみを対象とする辞書
  const omikujiSpells = SPELL_DICTIONARY.filter(
    (s) => s.id === "kyua_uppu_rapa_pa",
  );
  const { transcript, finalSpellMatch, start, stop, isSupported } =
    useSpeech(omikujiSpells);

  useEffect(() => {
    if (!finalSpellMatch?.matched || !finalSpellMatch.spell) return;
    if (finalSpellMatch.spell.id !== "kyua_uppu_rapa_pa") return;

    const key = `${finalSpellMatch.spell.id}:${finalSpellMatch.rawTranscript}`;
    if (lastVoiceKeyRef.current === key) return;
    lastVoiceKeyRef.current = key;

    stop();
    setVoiceStatus(`✨ 認識: ${finalSpellMatch.spell.name}`);

    if (!isConnected) {
      setVoiceStatus("❌ プリンターが未接続です");
      setShowConnectModal(true);
      return;
    }

    const message = drawOmikuji();
    printTestPage(message)
      .then(() => {
        setVoiceStatus("🎉 おみくじ印刷完了！");
      })
      .catch(() => {
        setVoiceStatus("❌ 印刷に失敗しました");
      });
  }, [finalSpellMatch, isConnected, printTestPage, stop]);

  // 接続完了でモーダルを自動クローズ
  useEffect(() => {
    if (isConnected) setShowConnectModal(false);
  }, [isConnected]);

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

        {/* 音声認識おみくじ */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mt-6 border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-4">
            🎤 音声おみくじ
          </h2>
          <p className="text-blue-200 text-sm mb-4">
            「キュアップラパパ！今日のおみくじ！」と唱えると印刷します
          </p>
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => {
                if (!isConnected) {
                  setShowConnectModal(true);
                  return;
                }
                lastVoiceKeyRef.current = "";
                start();
                setVoiceStatus("🎙️ 認識中...");
              }}
              disabled={!isSupported}
              className="flex-1 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-all transform hover:scale-105 active:scale-95 disabled:transform-none"
            >
              🎤 音声認識開始
            </button>
            <button
              onClick={() => {
                stop();
                setVoiceStatus("停止中");
              }}
              className="flex-1 bg-slate-500 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-xl transition-all transform hover:scale-105 active:scale-95"
            >
              ⏹ 停止
            </button>
          </div>
          <div className="bg-black/20 rounded-xl p-4 space-y-1 text-sm">
            <p className="text-gray-300">
              <strong className="text-white">状態:</strong> {voiceStatus}
            </p>
            <p className="text-gray-300">
              <strong className="text-white">認識テキスト:</strong>{" "}
              {transcript || "（まだ認識なし）"}
            </p>
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
            <li>または「音声認識開始」を押して呪文を唱える</li>
          </ol>
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-200 text-xs">
              ⚠️ このページはHTTPS環境またはlocalhostでのみ動作します
            </p>
          </div>
        </div>
      </div>

      {/* 未接続モーダル */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-purple-900 to-indigo-900 border border-white/20 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <p className="text-5xl mb-4">🖨️</p>
              <h3 className="text-xl font-bold text-white mb-2">
                プリンターが未接続です
              </h3>
              <p className="text-blue-200 text-sm">
                音声認識を使うには、Phomemo M02S に接続してください。
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowConnectModal(false);
                  connect();
                }}
                disabled={status === "CONNECTING"}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all"
              >
                {status === "CONNECTING"
                  ? "🔄 接続中..."
                  : "📱 プリンターに接続する"}
              </button>
              <button
                onClick={() => setShowConnectModal(false)}
                className="w-full bg-white/10 hover:bg-white/20 text-gray-300 font-medium py-3 px-6 rounded-xl transition-all"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
