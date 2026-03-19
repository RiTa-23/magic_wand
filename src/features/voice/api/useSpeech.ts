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

export interface UseSpeechOptions {
  finalBufferWindowMs?: number;
  interimMatchThreshold?: number;
  interimCommitThreshold?: number;
}

/**
 * 音声認識と呪文マッチングを統合するカスタムフック
 */
export function useSpeech(
  spells: SpellEntry[] = SPELL_DICTIONARY,
  options: UseSpeechOptions = {},
) {
  const FINAL_BUFFER_WINDOW_MS = options.finalBufferWindowMs ?? 1500;
  const INTERIM_MATCH_THRESHOLD = options.interimMatchThreshold ?? 0.8;
  const INTERIM_COMMIT_THRESHOLD = options.interimCommitThreshold ?? 1.0;
  const FATAL_SPEECH_ERRORS = new Set([
    "not-allowed",
    "service-not-allowed",
    "audio-capture",
    "language-not-supported",
  ]);

  const [status, setStatus] = useState<SpeechStatus>("IDLE");
  const [result, setResult] = useState<SpeechResult | null>(null);
  const [spellMatch, setSpellMatch] = useState<SpellMatchResult | null>(null);
  const [finalSpellMatch, setFinalSpellMatch] =
    useState<SpellMatchResult | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [isSupported, setIsSupported] = useState(false);
  const removeListenerRef = useRef<(() => void) | null>(null);
  const hasDispatchedMatchRef = useRef(false);
  const recentFinalTranscriptRef = useRef("");
  const recentFinalTimestampRef = useRef(0);

  const collectCandidates = useCallback(
    (res: SpeechResult) => {
      const now = Date.now();
      const candidateSet = new Set<string>();
      const alternatives = [res.transcript, ...(res.alternatives ?? [])].filter(
        (t) => t && t.trim().length > 0,
      );

      alternatives.forEach((t) => candidateSet.add(t.trim()));

      const hasRecentFinal =
        recentFinalTranscriptRef.current &&
        now - recentFinalTimestampRef.current <= FINAL_BUFFER_WINDOW_MS;

      if (hasRecentFinal) {
        const prefix = recentFinalTranscriptRef.current.trim();
        alternatives.forEach((t) => {
          const current = t.trim();
          candidateSet.add(`${prefix}${current}`);
          candidateSet.add(`${prefix} ${current}`);
        });
      }

      return [...candidateSet];
    },
    [FINAL_BUFFER_WINDOW_MS],
  );

  const pickBestMatch = useCallback(
    (candidates: string[]) => {
      let best: SpellMatchResult | null = null;
      for (const candidate of candidates) {
        const match = matchSpell(candidate, spells);
        if (!match.matched) continue;
        if (!best || match.confidence > best.confidence) {
          best = match;
        }
      }
      return best;
    },
    [spells],
  );

  /**
   * 音声認識の開始
   */
  const start = useCallback(() => {
    if (!speechRecognitionAPI.isSupported()) {
      setStatus("ERROR");
      return;
    }

    setSpellMatch(null);
    setFinalSpellMatch(null);
    setTranscript("");
    hasDispatchedMatchRef.current = false;
    recentFinalTranscriptRef.current = "";
    recentFinalTimestampRef.current = 0;
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

        const candidates = collectCandidates(res);
        const match = pickBestMatch(candidates);

        // マッチング: final結果での確定を優先、interim結果は高信頼度のみ暫定表示
        if (match?.matched) {
          if (res.isFinal) {
            // final結果: 信頼度を問わず確定させ、ロック
            setSpellMatch(match);
            setFinalSpellMatch(match);
            hasDispatchedMatchRef.current = true;
          } else if (
            !hasDispatchedMatchRef.current &&
            match.confidence >= INTERIM_COMMIT_THRESHOLD
          ) {
            // interimでも完全一致なら先行確定して待ち時間を短縮
            setSpellMatch(match);
            setFinalSpellMatch(match);
            hasDispatchedMatchRef.current = true;
          } else if (
            !hasDispatchedMatchRef.current &&
            match.confidence >= INTERIM_MATCH_THRESHOLD
          ) {
            // interim結果: 高信頼度(0.8以上)のみ表示、finalで上書き可能に保つ
            setSpellMatch(match);
          }
        }

        if (res.isFinal) {
          const current = res.transcript.trim();
          if (current) {
            const now = Date.now();
            const canAppend =
              recentFinalTranscriptRef.current &&
              now - recentFinalTimestampRef.current <= FINAL_BUFFER_WINDOW_MS;
            recentFinalTranscriptRef.current = canAppend
              ? `${recentFinalTranscriptRef.current} ${current}`.trim()
              : current;
            recentFinalTimestampRef.current = now;
          }
        }
      },
      onError: (err) => {
        if (FATAL_SPEECH_ERRORS.has(err?.error)) {
          console.error("Speech Recognition Fatal Error:", err?.error, err?.message);
          setStatus("ERROR");
        } else {
          console.warn("Speech Recognition Error (non-fatal):", err?.error, err?.message);
        }
      },
      onEnd: () => {
        // 必要に応じてステータス更新
      },
    });

    // エンジン開始
    speechRecognitionAPI.start();
    removeListenerRef.current = removeListener;
  }, [
    FINAL_BUFFER_WINDOW_MS,
    INTERIM_COMMIT_THRESHOLD,
    INTERIM_MATCH_THRESHOLD,
    spells,
    collectCandidates,
    pickBestMatch,
  ]);

  /**
   * 音声認識の停止
   */
  const stop = useCallback(() => {
    speechRecognitionAPI.stop();
    hasDispatchedMatchRef.current = false;
    recentFinalTranscriptRef.current = "";
    recentFinalTimestampRef.current = 0;
    setFinalSpellMatch(null);
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
    finalSpellMatch,
    transcript,
    start,
    stop,
    isSupported,
  };
}
