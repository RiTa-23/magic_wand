"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { speechRecognitionAPI } from "./speech-recognition";
import { matchSpell, SPELL_DICTIONARY } from "../lib/spell-matcher";
import {
  SpeechStatus,
  SpeechResult,
  SpellEntry,
  SpellMatchResult,
} from "../types/speech";

/**
 * 音声認識と呪文マッチングを統合するカスタムフック
 */
export function useSpeech(spells: SpellEntry[] = SPELL_DICTIONARY) {
  const [status, setStatus] = useState<SpeechStatus>("IDLE");
  const [result, setResult] = useState<SpeechResult | null>(null);
  const [spellMatch, setSpellMatch] = useState<SpellMatchResult | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [isSupported, setIsSupported] = useState(false);
  const removeListenerRef = useRef<(() => void) | null>(null);
  const hasDispatchedMatchRef = useRef(false);

  /**
   * 音声認識の開始
   */
  const start = useCallback(() => {
    if (!speechRecognitionAPI.isSupported()) {
      setStatus("ERROR");
      return;
    }

    setSpellMatch(null);
    setTranscript("");
    hasDispatchedMatchRef.current = false;
    setStatus("LISTENING");

    // 既存リスナーが残っていれば先に解除（多重登録を防止）
    if (removeListenerRef.current) {
      removeListenerRef.current();
      removeListenerRef.current = null;
    }

    // リスナー登録
    const removeListener = speechRecognitionAPI.addListener({
      onResult: (res) => {
        setResult(res);
        setTranscript(res.transcript);

        // マッチング: final結果での確定を優先、interim結果は高信頼度のみ暫定表示
        const match = matchSpell(res.transcript, spells);
        if (match.matched) {
          if (res.isFinal) {
            // final結果: 信頼度を問わず確定させ、ロック
            setSpellMatch(match);
            hasDispatchedMatchRef.current = true;
          } else if (
            !hasDispatchedMatchRef.current &&
            match.confidence >= 0.8
          ) {
            // interim結果: 高信頼度(0.8以上)のみ表示、finalで上書き可能に保つ
            setSpellMatch(match);
          }
        }
      },
      onError: (err) => {
        console.error("Speech Recognition Error:", err);
        setStatus("ERROR");
      },
      onEnd: () => {
        // 必要に応じてステータス更新
      },
    });

    // エンジン開始
    speechRecognitionAPI.start();
    removeListenerRef.current = removeListener;
  }, [spells]);

  /**
   * 音声認識の停止
   */
  const stop = useCallback(() => {
    speechRecognitionAPI.stop();
    hasDispatchedMatchRef.current = false;
    if (removeListenerRef.current) {
      removeListenerRef.current();
      removeListenerRef.current = null;
    }
    setStatus("IDLE");
  }, []);

  // コンポーネントのアンマウント時に停止
  useEffect(() => {
    setIsSupported(speechRecognitionAPI.isSupported());
    return () => {
      if (removeListenerRef.current) {
        removeListenerRef.current();
        removeListenerRef.current = null;
      }
      speechRecognitionAPI.stop();
    };
  }, []);

  return {
    status,
    result,
    spellMatch,
    transcript,
    start,
    stop,
    isSupported,
  };
}
