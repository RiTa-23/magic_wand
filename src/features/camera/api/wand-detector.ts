import * as ort from "onnxruntime-web";
import type { WandDetectionResult } from "../types/camera";

export class WandDetector {
  private session: ort.InferenceSession | null = null;
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private animFrameId: number = 0;
  private running: boolean = false;

  // 前処理用のオフスクリーンCanvas
  private preprocessCanvas: OffscreenCanvas | null = null;
  private preprocessCtx: OffscreenCanvasRenderingContext2D | null = null;

  // 前処理バッファ（使い回してGC負荷軽減）
  private inputBuffer: Float32Array | null = null;

  // EMAスムージング用
  private smoothTipX: number = 0;
  private smoothTipY: number = 0;
  private smoothGripX: number = 0;
  private smoothGripY: number = 0;
  private isFirstDetection: boolean = true;

  // モデル入力サイズ（モデルの学習時サイズに合わせる）
  private readonly INPUT_SIZE = 320;
  // EMAスムージング係数
  private readonly EMA_ALPHA = 0.4;
  // 検出信頼度しきい値
  private readonly SCORE_THRESHOLD = 0.5;

  // コールバック
  onWandDetection: ((result: WandDetectionResult) => void) | null = null;

  /** ONNXモデルとカメラを初期化 */
  async initialize(videoElement: HTMLVideoElement): Promise<boolean> {
    // 1. ONNX Runtime セッション初期化（webgpu → webgl → wasm の順でフォールバック）
    this.session = await ort.InferenceSession.create(
      "/models/wand_pose_v4.onnx",
      {
        executionProviders: ["webgpu", "webgl", "wasm"],
      },
    );

    // 2. 前処理用Canvas + バッファ
    const size = this.INPUT_SIZE;
    this.preprocessCanvas = new OffscreenCanvas(size, size);
    this.preprocessCtx = this.preprocessCanvas.getContext("2d")!;
    this.inputBuffer = new Float32Array(3 * size * size);

    // 3. カメラストリーム取得（解像度を下げて前処理を軽くする）
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 320, height: 240 },
    });
    videoElement.srcObject = this.stream;
    await videoElement.play();

    this.videoElement = videoElement;
    return true;
  }

  /** ビデオフレームをモデル入力テンソルに変換（letterbox + NCHW正規化） */
  private preprocess(): ort.Tensor {
    const ctx = this.preprocessCtx!;
    const video = this.videoElement!;
    const size = this.INPUT_SIZE;
    const float32 = this.inputBuffer!;

    // letterbox: アスペクト比を保ちつつINPUT_SIZExINPUT_SIZEにリサイズ
    const scale = Math.min(size / video.videoWidth, size / video.videoHeight);
    const newW = Math.round(video.videoWidth * scale);
    const newH = Math.round(video.videoHeight * scale);
    const padX = (size - newW) / 2;
    const padY = (size - newH) / 2;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(video, padX, padY, newW, newH);

    const imageData = ctx.getImageData(0, 0, size, size);
    const { data } = imageData;

    // NCHW形式 [1, 3, size, size]、0〜1正規化
    const pixelCount = size * size;
    for (let i = 0; i < pixelCount; i++) {
      const offset = i * 4;
      float32[i] = data[offset] / 255; // R
      float32[pixelCount + i] = data[offset + 1] / 255; // G
      float32[2 * pixelCount + i] = data[offset + 2] / 255; // B
    }

    return new ort.Tensor("float32", float32, [1, 3, size, size]);
  }

  /** モデル出力をパースしてキーポイント座標を取得 */
  private postprocess(output: ort.Tensor): WandDetectionResult | null {
    const data = output.data as Float32Array;
    const video = this.videoElement!;
    const size = this.INPUT_SIZE;

    // YOLOv8-pose出力: [1, 11, N]
    // N は入力サイズに依存（320→2100, 640→8400）
    const numDetections = output.dims[2];

    // 最高信頼度の検出を選択
    let bestIdx = -1;
    let bestConf = 0;

    for (let i = 0; i < numDetections; i++) {
      const conf = data[4 * numDetections + i];
      if (conf > bestConf) {
        bestConf = conf;
        bestIdx = i;
      }
    }

    if (bestIdx === -1 || bestConf < this.SCORE_THRESHOLD) return null;

    // bbox (letterbox座標系)
    const cx = data[0 * numDetections + bestIdx];
    const cy = data[1 * numDetections + bestIdx];
    const w = data[2 * numDetections + bestIdx];
    const h = data[3 * numDetections + bestIdx];

    // キーポイント (letterbox座標系)
    const tipX = data[5 * numDetections + bestIdx];
    const tipY = data[6 * numDetections + bestIdx];
    const tipConf = data[7 * numDetections + bestIdx];
    const gripX = data[8 * numDetections + bestIdx];
    const gripY = data[9 * numDetections + bestIdx];

    // letterbox座標 → 元の映像座標に変換
    const scale = Math.min(size / video.videoWidth, size / video.videoHeight);
    const padX = (size - video.videoWidth * scale) / 2;
    const padY = (size - video.videoHeight * scale) / 2;

    const toVideoX = (x: number) => (x - padX) / scale;
    const toVideoY = (y: number) => (y - padY) / scale;

    // フロントカメラのX軸ミラー反転
    const mirrorX = (x: number) => video.videoWidth - x;

    return {
      tipX: mirrorX(toVideoX(tipX)),
      tipY: toVideoY(tipY),
      gripX: mirrorX(toVideoX(gripX)),
      gripY: toVideoY(gripY),
      confidence: bestConf,
      tipConfidence: tipConf,
      detected: true,
      boundingBox: {
        x: mirrorX(toVideoX(cx + w / 2)),
        y: toVideoY(cy - h / 2),
        width: w / scale,
        height: h / scale,
      },
      timestamp: performance.now(),
    };
  }

  /** 検出ループ開始 */
  start(): void {
    this.running = true;

    const detect = async () => {
      if (!this.running || !this.session || !this.videoElement) return;

      // 前処理 → 推論 → 後処理
      const inputTensor = this.preprocess();
      const feeds: Record<string, ort.Tensor> = { images: inputTensor };
      const results = await this.session.run(feeds);
      const outputTensor = Object.values(results)[0];
      const detection = this.postprocess(outputTensor);

      const now = performance.now();

      if (detection) {
        // EMAスムージング
        if (this.isFirstDetection) {
          this.smoothTipX = detection.tipX;
          this.smoothTipY = detection.tipY;
          this.smoothGripX = detection.gripX;
          this.smoothGripY = detection.gripY;
          this.isFirstDetection = false;
        } else {
          const a = this.EMA_ALPHA;
          this.smoothTipX = a * detection.tipX + (1 - a) * this.smoothTipX;
          this.smoothTipY = a * detection.tipY + (1 - a) * this.smoothTipY;
          this.smoothGripX =
            a * detection.gripX + (1 - a) * this.smoothGripX;
          this.smoothGripY =
            a * detection.gripY + (1 - a) * this.smoothGripY;
        }

        this.onWandDetection?.({
          ...detection,
          tipX: this.smoothTipX,
          tipY: this.smoothTipY,
          gripX: this.smoothGripX,
          gripY: this.smoothGripY,
          timestamp: now,
        });
      } else {
        this.onWandDetection?.({
          tipX: this.smoothTipX,
          tipY: this.smoothTipY,
          gripX: this.smoothGripX,
          gripY: this.smoothGripY,
          confidence: 0,
          tipConfidence: 0,
          detected: false,
          boundingBox: { x: 0, y: 0, width: 0, height: 0 },
          timestamp: now,
        });
      }

      // 次フレームをスケジュール（推論完了後に次を開始）
      if (this.running) {
        this.animFrameId = requestAnimationFrame(detect);
      }
    };

    this.animFrameId = requestAnimationFrame(detect);
  }

  /** 検出ループ停止 */
  stop(): void {
    this.running = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  /** リソース解放 */
  destroy(): void {
    this.stop();
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.session) {
      this.session.release();
      this.session = null;
    }
    this.videoElement = null;
    this.preprocessCanvas = null;
    this.preprocessCtx = null;
    this.inputBuffer = null;
    this.isFirstDetection = true;
  }
}
