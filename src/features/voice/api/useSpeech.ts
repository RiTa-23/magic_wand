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
  const removeListenerRef = useRef<(() => void) | null>(null);

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
        if (res.isFinal) {
          setTranscript(res.transcript);
        }

        if (res.isFinal) {
          const match = matchSpell(res.transcript, spells);
          setSpellMatch(match);
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
    if (removeListenerRef.current) {
      removeListenerRef.current();
      removeListenerRef.current = null;
    }
    setStatus("IDLE");
  }, []);

  // コンポーネントのアンマウント時に停止
  useEffect(() => {
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
    isSupported: speechRecognitionAPI.isSupported(),
  };
}
