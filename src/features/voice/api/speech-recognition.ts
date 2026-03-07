import { SpeechResult } from "../types/speech";

/**
 * Web Speech API (SpeechRecognition) のラッパークラス
 */
export class SpeechRecognitionAPI {
  private recognition: any | null = null;
  private onResultCallback: (result: SpeechResult) => void = () => {};
  private onErrorCallback: (error: any) => void = () => {};
  private onEndCallback: () => void = () => {};
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
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech Recognition API is not supported in this browser.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true; // 連続認識
    this.recognition.interimResults = true; // 中間結果を取得
    this.recognition.lang = "ja-JP"; // 日本語設定

    this.recognition.onresult = (event: any) => {
      const lastIndex = event.results.length - 1;
      const result = event.results[lastIndex];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;
      const isFinal = result.isFinal;

      this.onResultCallback({
        transcript,
        confidence,
        isFinal,
        timestamp: Date.now(),
      });
    };

    this.recognition.onerror = (event: any) => {
      this.onErrorCallback(event);
    };

    this.recognition.onend = () => {
      // 意図的に止めた場合以外は、自動再開を試みる（ブラウザによる自動停止対策）
      if (this.isStarted) {
        try {
          this.recognition.start();
        } catch (e) {
          // すでに開始されている場合は無視
          console.debug("Silent restart ignored:", e);
        }
      }
      this.onEndCallback();
    };
  }

  /**
   * 音声認識を開始する
   */
  public start(callbacks: {
    onResult: (result: SpeechResult) => void;
    onError?: (error: any) => void;
    onEnd?: () => void;
  }) {
    if (!this.recognition) return;

    this.onResultCallback = callbacks.onResult;
    if (callbacks.onError) this.onErrorCallback = callbacks.onError;
    if (callbacks.onEnd) this.onEndCallback = callbacks.onEnd;

    try {
      this.isStarted = true;
      this.recognition.start();
    } catch (e) {
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
}

// シングルトンとしてエクスポート
export const speechRecognitionAPI = new SpeechRecognitionAPI();
