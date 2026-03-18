/** カメラの接続状態 */
export type CameraStatus =
  | "DISCONNECTED"
  | "INITIALIZING"
  | "CONNECTED"
  | "ERROR";

/** 杖のキーポイント検出結果 */
export type WandDetectionResult = {
  /** 杖先のX座標（ピクセル、ミラー反転済み） */
  tipX: number;
  /** 杖先のY座標（ピクセル） */
  tipY: number;
  /** 手元のX座標（ピクセル、ミラー反転済み） */
  gripX: number;
  /** 手元のY座標（ピクセル） */
  gripY: number;
  /** 検出信頼度 0〜1 */
  confidence: number;
  /** 杖先キーポイントの信頼度 0〜1 */
  tipConfidence: number;
  /** 手元キーポイントの信頼度 0〜1 */
  gripConfidence: number;
  /** 杖が検出されたか */
  detected: boolean;
  /** バウンディングボックス */
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** タイムスタンプ */
  timestamp: number;
};
