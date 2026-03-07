"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Mic, MicOff, Play, Square, CheckCircle2, AlertCircle, History } from "lucide-react";
import { speechRecognitionAPI } from "@/features/voice/api/speech-recognition";
import { SpeechStatus, SpeechResult, SpellEntry, SpellMatchResult } from "@/features/voice/types/speech";

// テスト用の呪文データ
const SAMPLE_SPELLS: SpellEntry[] = [
  { id: "1", name: "ルーモス", keywords: ["ルーモス", "るーもす", "lumos", "光よ"], action: "light_on" },
  { id: "2", name: "ノックス", keywords: ["ノックス", "のっくす", "nox", "消えて"], action: "light_off" },
  { id: "3", name: "アグアメンティ", keywords: ["アグアメンティ", "あぐあめんてぃ", "水よ"], action: "fan_on" },
];

export default function VoiceTestPage() {
  const [status, setStatus] = useState<SpeechStatus>("IDLE");
  const [currentResult, setCurrentResult] = useState<SpeechResult | null>(null);
  const [matchResult, setMatchResult] = useState<SpellMatchResult | null>(null);
  const [history, setHistory] = useState<SpeechResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ログを自動スクロール
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, currentResult]);

  // 呪文のマッチングロジック
  const checkSpell = useCallback((transcript: string, confidence: number): SpellMatchResult => {
    const normalized = transcript.toLowerCase().trim();
    
    for (const spell of SAMPLE_SPELLS) {
      if (spell.keywords.some(keyword => normalized.includes(keyword.toLowerCase()))) {
        return { matched: true, spell, confidence, rawTranscript: transcript };
      }
    }
    
    return { matched: false, spell: null, confidence: 0, rawTranscript: transcript };
  }, []);

  // 音声認識の開始
  const handleStart = () => {
    if (!speechRecognitionAPI.isSupported()) {
      setErrorMessage("お使いのブラウザは音声認識をサポートしていません。Chromeなどの主要なブラウザをお試しください。");
      setStatus("ERROR");
      return;
    }

    setErrorMessage(null);
    setStatus("LISTENING");

    speechRecognitionAPI.start({
      onResult: (result) => {
        setCurrentResult(result);
        
        if (result.isFinal) {
          // 履歴に追加
          setHistory(prev => [...prev, result]);
          // 呪文チェック
          const match = checkSpell(result.transcript, result.confidence);
          setMatchResult(match);
          // 確定したので現在の表示をクリア
          setCurrentResult(null);
        }
      },
      onError: (error) => {
        console.error("Speech Error:", error);
        if (error.error === "not-allowed") {
          setErrorMessage("マイクの使用が許可されていません。設定を確認してください。");
        } else {
          setErrorMessage(`エラーが発生しました: ${error.error}`);
        }
        setStatus("ERROR");
      },
      onEnd: () => {
        // API側で自動再開するが、ステータス同期のため
        console.log("Speech recognition ended session");
      }
    });
  };

  // 音声認識の停止
  const handleStop = () => {
    speechRecognitionAPI.stop();
    setStatus("IDLE");
    setCurrentResult(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gold-dim/20 pb-4">
          <Mic className="w-8 h-8 text-gold" />
          <h1 className="text-2xl font-bold tracking-widest text-gold-bright uppercase">
            🎙 音声認識テスト
          </h1>
        </div>

        {/* Controls */}
        <div className="flex gap-4">
          <button
            onClick={handleStart}
            disabled={status === "LISTENING"}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gold/50 bg-gold/10 text-gold-bright font-bold hover:bg-gold/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Play className="w-5 h-5" /> 認識開始
          </button>
          <button
            onClick={handleStop}
            disabled={status !== "LISTENING" && status !== "ERROR"}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive-foreground font-bold hover:bg-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Square className="w-5 h-5" /> 認識停止
          </button>
        </div>

        {/* Status Display */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-stone/40 border border-gold-dim/10">
          <div className={`w-3 h-3 rounded-full animate-pulse ${
            status === "LISTENING" ? "bg-magic-glow shadow-[0_0_8px_var(--magic-glow)]" : 
            status === "ERROR" ? "bg-destructive" : "bg-stone-light"
          }`} />
          <span className="text-sm font-semibold tracking-wider font-mono uppercase">
            状態: {status}
          </span>
          {errorMessage && (
            <div className="flex items-center gap-1 ml-auto text-destructive text-xs animate-in fade-in slide-in-from-right-2">
              <AlertCircle className="w-4 h-4" />
              {errorMessage}
            </div>
          )}
        </div>

        {/* Real-time Result */}
        <div className="p-6 rounded-xl border border-gold-dim/20 bg-stone/20 backdrop-blur-sm">
          <h2 className="text-xs uppercase tracking-[0.2em] text-gold-dim mb-3">
            ── リアルタイム認識テキスト ──
          </h2>
          <div className="min-h-[3rem] flex items-center justify-center text-xl font-medium text-white/90">
            {currentResult ? (
              <span className="animate-in fade-in zoom-in-95 duration-300">
                「{currentResult.transcript}」
              </span>
            ) : (
              <span className="text-foreground/20 italic">待機中...</span>
            )}
          </div>
        </div>

        {/* Match Result */}
        <div className={`p-6 rounded-xl border transition-all duration-500 ${
          matchResult?.matched 
            ? "border-magic-glow/50 bg-magic-glow/10 shadow-[inner_0_0_20px_rgba(96,180,160,0.1)]" 
            : "border-gold-dim/10 bg-stone/10"
        }`}>
          <h2 className="text-xs uppercase tracking-[0.2em] text-gold-dim mb-4">
            ── 呪文マッチング結果 ──
          </h2>
          {matchResult?.matched ? (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-magic-glow font-bold text-lg">
                <CheckCircle2 className="w-6 h-6" />
                マッチ: {matchResult.spell?.name}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                <div className="bg-background/40 p-2 rounded">
                  <span className="text-gold-dim/60 block text-[10px] uppercase">アクション</span>
                  <span className="font-mono text-gold-bright">{matchResult.spell?.action}</span>
                </div>
                <div className="bg-background/40 p-2 rounded">
                  <span className="text-gold-dim/60 block text-[10px] uppercase">信頼度</span>
                  <span className="font-mono text-gold-bright">{matchResult.confidence.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-foreground/30 text-center py-4 italic text-sm">
              呪文を唱えてください
            </div>
          )}
        </div>

        {/* History Log */}
        <div className="p-6 rounded-xl border border-gold-dim/10 bg-black/20 flex flex-col h-64 overflow-hidden">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <History className="w-4 h-4 text-gold-dim" />
            <h2 className="text-xs uppercase tracking-[0.2em] text-gold-dim">
              認識ログ（履歴）
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 font-mono text-[13px]">
            {history.length === 0 && (
              <div className="text-center py-10 text-foreground/10 uppercase tracking-widest text-[10px]">
                No Logs
              </div>
            )}
            {history.map((item, i) => (
              <div key={i} className="flex gap-3 text-foreground/60 border-b border-white/5 pb-1 hover:bg-white/5 transition-colors">
                <span className="text-gold-dim/40 shrink-0">
                  {new Date(item.timestamp).toLocaleTimeString("ja-JP", { hour12: false })}
                </span>
                <span className="text-magic-glow/70 shrink-0">[確定]</span>
                <span className="flex-1 truncate">
                  {item.transcript}
                </span>
                <span className="text-gold-dim/50 font-mono text-[11px]">
                  ({item.confidence.toFixed(2)})
                </span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
