"use client";

import { useState, useCallback, useEffect } from "react";
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

    speechRecognitionAPI.start({
      onResult: (res) => {
        setResult(res);
        setTranscript(res.transcript);

        if (res.isFinal) {
          const match = matchSpell(res.transcript, spells);
          if (match.matched) {
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
  }, [spells]);

  /**
   * 音声認識の停止
   */
  const stop = useCallback(() => {
    speechRecognitionAPI.stop();
    setStatus("IDLE");
  }, []);

  // コンポーネントのアンマウント時に停止
  useEffect(() => {
    return () => {
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
