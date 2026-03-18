"use client";

import { SpeechResult } from "../types/speech";

export interface SpeechListeners {
  onResult: (result: SpeechResult) => void;
  onError?: (error: any) => void;
  onEnd?: () => void;
}

/**
 * Web Speech API (SpeechRecognition) のラッパークラス
 */
export class SpeechRecognitionAPI {
  private recognition: any | null = null;
  private listeners = new Set<SpeechListeners>();
  private isStarted = false;

  constructor() {
    this.initRecognition();
  }

  /**
   * ブラウザが SpeechRecognition をサポートしているかチェックし、初期化する
   */
  private initRecognition() {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech Recognition API is not supported in this browser.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true; // 連続認識
    this.recognition.interimResults = true; // 中間結果を取得
    this.recognition.maxAlternatives = 5; // 候補を広く取り、後段で最適マッチを選ぶ
    this.recognition.lang = "ja-JP"; // 日本語設定

    this.recognition.onresult = (event: any) => {
      const lastIndex = event.results.length - 1;
      const result = event.results[lastIndex];
      const alternatives = Array.from(result)
        .map((alt: any) => String(alt?.transcript ?? "").trim())
        .filter((t: string) => t.length > 0);
      const speechResult: SpeechResult = {
        transcript: result[0].transcript,
        confidence: result[0].confidence,
        isFinal: result.isFinal,
        timestamp: Date.now(),
        alternatives,
      };

      this.listeners.forEach((l) => l.onResult(speechResult));
    };

    this.recognition.onerror = (event: any) => {
      const fatalErrors = [
        "not-allowed",
        "service-not-allowed",
        "audio-capture",
        "language-not-supported",
      ];
      if (fatalErrors.includes(event.error)) {
        this.isStarted = false;
      }

      const errorData = {
        error: event.error,
        message: event.message,
      };

      this.listeners.forEach((l) => l.onError?.(errorData));
    };

    this.recognition.onend = () => {
      if (this.isStarted) {
        setTimeout(() => {
          if (this.isStarted) {
            try {
              this.recognition.start();
            } catch (e) {
              console.debug("Auto-restart skipped:", e);
            }
          }
        }, 100);
      }
      this.listeners.forEach((l) => l.onEnd?.());
    };
  }

  /**
   * イベントリスナーを追加する
   * @returns リスナーを削除する関数
   */
  public addListener(listener: SpeechListeners): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 音声認識を開始する
   */
  public start() {
    if (!this.recognition) return;

    if (this.isStarted) {
      console.warn("Speech recognition is already running.");
      return;
    }

    try {
      this.isStarted = true;
      this.recognition.start();
    } catch (e) {
      this.isStarted = false;
      console.error("Failed to start speech recognition:", e);
    }
  }

  /**
   * 音声認識を停止する
   */
  public stop() {
    if (!this.recognition) return;
    this.isStarted = false;
    this.recognition.stop();
  }

  /**
   * ブラウザの対応状況を確認
   */
  public isSupported(): boolean {
    return !!this.recognition;
  }

  /**
   * 現在稼働中か
   */
  public isActive(): boolean {
    return this.isStarted;
  }
}

// シングルトンとしてエクスポート
export const speechRecognitionAPI = new SpeechRecognitionAPI();
