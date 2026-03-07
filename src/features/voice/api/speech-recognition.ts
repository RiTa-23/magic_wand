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
      // エラーオブジェクトそのものではなく、エラーコードを渡す
      this.onErrorCallback({
        error: event.error,
        message: event.message
      });
    };

    this.recognition.onend = () => {
      // 意図的に止めた場合以外は、自動再開を試みる
      if (this.isStarted) {
        // 少し時間を置いてから再開（連続呼び出しによるエラー防止）
        setTimeout(() => {
          if (this.isStarted) {
            try {
              this.recognition.start();
            } catch (e) {
              // 「既に開始されている」エラーは無視して良い
              console.debug("Auto-restart skipped:", e);
            }
          }
        }, 100);
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

    if (this.isStarted) {
      console.warn("Speech recognition is already running.");
      return;
    }

    try {
      this.isStarted = true;
      this.recognition.start();
    } catch (e) {
      // 万が一エラーが出ても、内部状態はリセットしておく
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
}

// シングルトンとしてエクスポート
export const speechRecognitionAPI = new SpeechRecognitionAPI();
