# YOLOv8-pose キーポイント検出による杖先トラッキング 実装ガイド

Joy-Conでの杖振り検知に加え、ウェブカメラ前で実際の杖を振ることでも杖先を検知できるようにする。YOLOv8-poseでカスタムキーポイント検出モデルを学習し、ONNX Runtime Webでブラウザ上リアルタイム推論する。

---

## 目次

1. [全体アーキテクチャ](#1-全体アーキテクチャ)
2. [使用技術](#2-使用技術)
3. [Phase 1: 学習データ準備](#3-phase-1-学習データ準備)
4. [Phase 2: モデル学習（Python / Google Colab）](#4-phase-2-モデル学習python--google-colab)
5. [Phase 3: Next.js実装（TypeScript / ブラウザ）](#5-phase-3-nextjs実装typescript--ブラウザ)
6. [ファイル一覧](#6-ファイル一覧)
7. [検証方法](#7-検証方法)

---

## 1. 全体アーキテクチャ

```text
┌─────────────────────────────────────────────────────────────┐
│  ブラウザ (Chrome)                                           │
│                                                             │
│  page.tsx ─── useWandDetector.ts ─── wand-detector.ts       │
│  (React UI)   (React Hook)          (ONNX推論コア)           │
│                                          │                  │
│                                  onnxruntime-web            │
│                              (WebGL/WASM バックエンド)        │
│                                          │                  │
│                                   getUserMedia API          │
└──────────────────────────────┬──────────────────────────────┘
                               │ WebRTC / WebGL
                    ┌──────────▼──────────┐
                    │   ウェブカメラ        │
                    │   (USB / 内蔵)       │
                    └─────────────────────┘
```

### なぜキーポイント検出か

物体検出（バウンディングボックス）では杖全体の矩形しか得られず、杖先の正確な座標がわからない。
キーポイント検出なら**杖先 (tip)** と**手元 (grip)** の2点を直接学習するため、杖の角度に関係なく杖先座標が正確に得られる。

```text
物体検出の場合:                   キーポイント検出の場合:
┌─────────────┐
│  ↑ 杖先?    │  ← 上端中央は      ● tip  ← 直接座標が出る
│  │          │    近似にすぎない    │
│  │ 杖       │                    │
│  │          │                    │
│  ↓ 手元     │                    ● grip
└─────────────┘
```

### なぜ YOLOv8-pose + ONNX Runtime か

- **MediaPipe Model Maker** にはキーポイント検出の学習機能がない
- **YOLOv8-pose** はカスタムキーポイント検出の学習をサポート
- **ONNX形式** にエクスポートでき、**onnxruntime-web** でブラウザ上WebGL推論が可能
- YOLOv8n-pose（nano）は軽量で、ブラウザでもリアルタイム推論可能

### 全体の流れ

```
[Phase 1] 画像収集 + キーポイントアノテーション（CVAT / Roboflow）
    ↓
[Phase 2] YOLOv8-pose学習（Python / Google Colab）→ ONNX書き出し
    ↓
[Phase 3] Next.jsでリアルタイム推論実装（TypeScript / ブラウザ）
```

---

## 2. 使用技術

本実装で使用する主要な技術要素を解説する。

### YOLOv8-pose（モデル学習）

**YOLOv8** は Ultralytics が開発するリアルタイム物体検出フレームワーク。その **pose** バリアントはキーポイント検出（姿勢推定）に特化しており、バウンディングボックスとキーポイント座標を同時に出力する。

| 項目 | 内容 |
|------|------|
| 開発元 | Ultralytics |
| ベースタスク | 物体検出 + キーポイント推定 |
| 入力 | RGB画像（640x640にリサイズ） |
| 出力 | バウンディングボックス + N個のキーポイント座標 |
| 本実装の設定 | 1クラス (`wand`)、2キーポイント (`tip`, `grip`) |
| モデルサイズ | YOLOv8n-pose（nano）: ~6MB — ブラウザ推論向き |

**カスタムキーポイント検出の仕組み:**

```text
事前学習済みYOLOv8n-pose（人体17キーポイント）
    ↓ Transfer Learning
カスタムデータセット（杖1クラス・2キーポイント）で再学習
    ↓
杖専用キーポイント検出モデル
```

既存の人体ポーズ推定の重みをベースに転移学習するため、少量のデータ（100〜300枚）でも十分な精度が得られる。

### ONNX / ONNX Runtime Web（ブラウザ推論）

**ONNX (Open Neural Network Exchange)** は、異なる機械学習フレームワーク間でモデルを共有するためのオープンフォーマット。

**ONNX Runtime Web** はそのブラウザ向け実装で、以下のバックエンドで推論を実行できる:

| バックエンド | 速度 | 対応環境 |
|-------------|------|---------|
| **WebGL** | 高速（GPU利用） | 大半のブラウザ |
| **WASM** | 中速（CPU） | 全ブラウザ |
| **WebGPU** | 最速（次世代GPU API） | Chrome 113+ |

本実装では **WebGL** をプライマリ、**WASM** をフォールバックとして使用する。

```typescript
// セッション初期化
const session = await ort.InferenceSession.create("/models/wand_pose.onnx", {
  executionProviders: ["webgl"],  // WebGLで高速推論
});

// 推論実行
const inputTensor = new ort.Tensor("float32", preprocessedData, [1, 3, 640, 640]);
const results = await session.run({ images: inputTensor });
```

**なぜ MediaPipe ではなく ONNX Runtime か:**

MediaPipe Model Maker にはキーポイント検出の学習機能がない。YOLOv8-pose で学習したモデルを `.onnx` にエクスポートし、ONNX Runtime Web で推論するのが最もスムーズなパイプラインとなる。

### getUserMedia API（カメラアクセス）

**getUserMedia** は、Webブラウザからカメラ・マイクにアクセスするための Web 標準 API。

```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: "user",   // フロントカメラ優先
    width: 640,
    height: 480,
  },
});
videoElement.srcObject = stream;
```

| 項目 | 内容 |
|------|------|
| 対応ブラウザ | Chrome, Firefox, Safari, Edge（全メジャーブラウザ） |
| HTTPS | 必須（localhost は例外） |
| 許可 | ユーザーにカメラアクセス許可ダイアログが表示される |

### YOLOv8-pose の入出力フォーマット

#### 入力

| 項目 | 値 |
|------|------|
| 形状 | `[1, 3, 640, 640]` (NCHW) |
| 値域 | `0.0 〜 1.0`（RGB各チャンネルを255で除算） |
| 前処理 | letterbox（アスペクト比保持リサイズ + 黒パディング） |

```text
元映像 (640x480)          letterbox (640x640)
┌──────────────┐          ┌──────────────┐
│              │          │  黒パディング  │
│    映像      │    →     ├──────────────┤
│              │          │    映像       │
└──────────────┘          ├──────────────┤
                          │  黒パディング  │
                          └──────────────┘
```

#### 出力

モデル出力テンソル: `[1, 11, 8400]`

```text
8400個の候補検出に対して、各11個の値:
  [0] cx        - バウンディングボックス中心X
  [1] cy        - バウンディングボックス中心Y
  [2] w         - バウンディングボックス幅
  [3] h         - バウンディングボックス高さ
  [4] conf      - 検出信頼度
  [5] tip_x     - 杖先X座標
  [6] tip_y     - 杖先Y座標
  [7] tip_conf  - 杖先キーポイント信頼度
  [8] grip_x    - 手元X座標
  [9] grip_y    - 手元Y座標
  [10] grip_conf - 手元キーポイント信頼度
```

座標はすべてletterbox座標系（640x640）で出力されるため、元の映像座標に戻す逆変換が必要。

#### 後処理の流れ

```text
[1, 11, 8400] テンソル
    ↓ 8400候補から最高信頼度を選択（conf > 0.5）
    ↓ letterbox座標 → 元映像座標に逆変換
    ↓ フロントカメラのX軸ミラー反転
    ↓ EMAスムージング（α=0.4）
    ↓ WandDetectionResult として出力
```

### EMAスムージング（指数移動平均）

キーポイント座標のフレーム間のブレを抑えるため、**EMA (Exponential Moving Average)** を適用する。

```
smoothed = α × current + (1 - α) × previous
```

| パラメータ | 値 | 効果 |
|-----------|------|------|
| α = 0.4 | 現在値40% + 前回値60% | 滑らかさと応答性のバランス |
| α → 1.0 | 生の値に近い | 応答は速いがブレが大きい |
| α → 0.0 | ほぼ動かない | 滑らかだが遅延が大きい |

tip (杖先) と grip (手元) の両方に独立して適用する。

---

## 3. Phase 1: 学習データ準備

### Step 1-1: 杖の画像収集（100〜300枚推奨）

ウェブカメラ or スマホで杖を様々な条件で撮影する。

| 条件 | バリエーション |
|------|-------------|
| 角度 | 正面、斜め、横、振っている最中 |
| 背景 | 実際に使う環境（部屋）で撮影 |
| 照明 | 明るい / 暗い |
| 持ち方 | 片手、両手、振り上げ、振り下ろし |
| 杖の向き | **縦・横・斜めを均等に**（キーポイント検出では特に重要） |

> **Tips**: 撮影スクリプトをNext.jsのテストページとして作成すると効率的。

### Step 1-2: キーポイントアノテーション

各画像に対して以下を付与する:

1. **バウンディングボックス** — 杖全体を囲む矩形
2. **キーポイント2点** — `tip`（杖先）と `grip`（手元/持ち手）

```text
画像上で:
  ● ← tip (キーポイント0): 杖の先端
  │
  │  杖
  │
  ● ← grip (キーポイント1): 手で持っている部分
```

#### アノテーションツール

**Roboflow** を使用する（無料枠: 10,000枚まで）。

1. 新規プロジェクト作成時に **Keypoint Detection** を選択
2. キーポイント名を定義: `tip`（杖先）、`grip`（手元）
3. 各画像で杖にバウンディングボックスを描き、2点をクリックして打つ
4. エクスポート: **YOLOv8-pose形式** を選択 → `data.yaml` も自動生成される

> **Tips**: Roboflow の Augmentation 機能（回転・明るさ変更等）で学習データを水増しできる。

#### YOLO キーポイント形式

各画像に対応する `.txt` ラベルファイル:

```
# class_id  cx  cy  w  h  tip_x  tip_y  tip_visible  grip_x  grip_y  grip_visible
0  0.5  0.4  0.1  0.6  0.5  0.1  2  0.5  0.7  2
```

- 座標は画像サイズで正規化（0〜1）
- visible: 0=不可視, 1=オクルージョン, 2=可視

#### データセット構成

```
wand_keypoint_dataset/
├── data.yaml
├── train/
│   ├── images/
│   │   ├── 001.jpg
│   │   └── ...
│   └── labels/
│       ├── 001.txt
│       └── ...
└── val/
    ├── images/
    └── labels/
```

#### data.yaml

```yaml
path: ./wand_keypoint_dataset
train: train/images
val: val/images

# キーポイント定義
kpt_shape: [2, 3]  # 2キーポイント、各3値(x, y, visible)

# クラス定義
names:
  0: wand

# キーポイント名（ドキュメント用）
# 0: tip  (杖先)
# 1: grip (手元)
```

---

## 4. Phase 2: モデル学習（Python / Google Colab）

### Step 2-1: Google Colabでモデル学習

```python
# Google Colab notebook
!pip install ultralytics

from ultralytics import YOLO

# YOLOv8n-pose ベースモデル読み込み（nano = 最軽量）
model = YOLO("yolov8n-pose.pt")

# カスタムキーポイント検出の学習
results = model.train(
    data="wand_keypoint_dataset/data.yaml",
    epochs=100,
    imgsz=640,
    batch=16,
    name="wand_tip_detector",
    # キーポイント設定
    pose=True,  # キーポイント検出モード
)

# 評価
metrics = model.val()
print(f"mAP50: {metrics.box.map50}")
print(f"mAP50-95: {metrics.box.map}")

# テスト推論
results = model.predict("test_image.jpg", save=True)
for r in results:
    print(f"Keypoints: {r.keypoints.xy}")  # [[tip_x, tip_y], [grip_x, grip_y]]
```

### Step 2-2: ONNXエクスポート

```python
# ONNX形式でエクスポート（ブラウザ推論用）
model.export(
    format="onnx",
    imgsz=640,
    simplify=True,
    opset=17,
)
# → runs/pose/wand_tip_detector/weights/best.onnx
```

### Step 2-3: モデルファイル配置

エクスポートした `.onnx` をダウンロードし、プロジェクトに配置する。

```
public/models/wand_pose.onnx
```

---

## 5. Phase 3: Next.js実装（TypeScript / ブラウザ）

### Step 3-1: 依存パッケージ追加

```bash
bun add onnxruntime-web
```

> `@mediapipe/tasks-vision` は不要。ONNX Runtime Web で直接推論する。

### Step 3-2: 型定義 — `src/features/camera/types/camera.ts`（新規）

```typescript
/** カメラの接続状態 */
export type CameraStatus = "DISCONNECTED" | "INITIALIZING" | "CONNECTED" | "ERROR";

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
```

### Step 3-3: APIクラス — `src/features/camera/api/wand-detector.ts`（新規, ~200行）

`WandDetector`クラス（`JoyConWebHID`と同パターン）:

```typescript
import * as ort from "onnxruntime-web";
import type { WandDetectionResult } from "../types/camera";

export class WandDetector {
  private session: ort.InferenceSession | null = null;
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private animFrameId: number = 0;

  // 前処理用のオフスクリーンCanvas
  private preprocessCanvas: OffscreenCanvas | null = null;
  private preprocessCtx: OffscreenCanvasRenderingContext2D | null = null;

  // EMAスムージング用
  private smoothTipX: number = 0;
  private smoothTipY: number = 0;
  private smoothGripX: number = 0;
  private smoothGripY: number = 0;
  private isFirstDetection: boolean = true;

  // モデル入力サイズ
  private readonly INPUT_SIZE = 640;

  // コールバック
  onWandDetection: ((result: WandDetectionResult) => void) | null = null;

  /** ONNXモデルとカメラを初期化 */
  async initialize(videoElement: HTMLVideoElement): Promise<boolean> {
    // 1. ONNX Runtime セッション初期化
    ort.env.wasm.wasmPaths = "/onnx/";
    this.session = await ort.InferenceSession.create(
      "/models/wand_pose.onnx",
      {
        executionProviders: ["webgl"],  // WebGLで高速化、フォールバックはWASM
      }
    );

    // 2. 前処理用Canvas
    this.preprocessCanvas = new OffscreenCanvas(this.INPUT_SIZE, this.INPUT_SIZE);
    this.preprocessCtx = this.preprocessCanvas.getContext("2d")!;

    // 3. カメラストリーム取得
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 640, height: 480 },
    });
    videoElement.srcObject = this.stream;
    await videoElement.play();

    this.videoElement = videoElement;
    return true;
  }

  /** ビデオフレームをモデル入力テンソルに変換 */
  private preprocess(): ort.Tensor {
    const ctx = this.preprocessCtx!;
    const video = this.videoElement!;
    const size = this.INPUT_SIZE;

    // letterbox: アスペクト比を保ちつつ640x640にリサイズ
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

    // NCHW形式 [1, 3, 640, 640]、0〜1正規化
    const float32 = new Float32Array(3 * size * size);
    for (let i = 0; i < size * size; i++) {
      float32[i] = data[i * 4] / 255;                    // R
      float32[size * size + i] = data[i * 4 + 1] / 255;  // G
      float32[2 * size * size + i] = data[i * 4 + 2] / 255; // B
    }

    return new ort.Tensor("float32", float32, [1, 3, size, size]);
  }

  /** モデル出力をパースしてキーポイント座標を取得 */
  private postprocess(output: ort.Tensor): WandDetectionResult | null {
    const data = output.data as Float32Array;
    const video = this.videoElement!;
    const size = this.INPUT_SIZE;

    // YOLOv8-pose出力: [1, 11, 8400] → 転置して [8400, 11]
    // 各行: [cx, cy, w, h, conf, tip_x, tip_y, tip_conf, grip_x, grip_y, grip_conf]
    const numDetections = 8400;
    const numValues = 11; // 4(bbox) + 1(conf) + 3(tip) + 3(grip)

    let bestIdx = -1;
    let bestConf = 0;

    for (let i = 0; i < numDetections; i++) {
      const conf = data[4 * numDetections + i]; // conf は5番目の行
      if (conf > bestConf) {
        bestConf = conf;
        bestIdx = i;
      }
    }

    if (bestIdx === -1 || bestConf < 0.5) return null;

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
    // const gripConf = data[10 * numDetections + bestIdx];

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
    const detect = async () => {
      if (!this.session || !this.videoElement) return;

      // 前処理 → 推論 → 後処理
      const inputTensor = this.preprocess();
      const feeds = { images: inputTensor };
      const results = await this.session.run(feeds);
      const outputTensor = Object.values(results)[0];
      const detection = this.postprocess(outputTensor);

      if (detection) {
        // EMAスムージング（α=0.4）
        const alpha = 0.4;
        if (this.isFirstDetection) {
          this.smoothTipX = detection.tipX;
          this.smoothTipY = detection.tipY;
          this.smoothGripX = detection.gripX;
          this.smoothGripY = detection.gripY;
          this.isFirstDetection = false;
        } else {
          this.smoothTipX = alpha * detection.tipX + (1 - alpha) * this.smoothTipX;
          this.smoothTipY = alpha * detection.tipY + (1 - alpha) * this.smoothTipY;
          this.smoothGripX = alpha * detection.gripX + (1 - alpha) * this.smoothGripX;
          this.smoothGripY = alpha * detection.gripY + (1 - alpha) * this.smoothGripY;
        }

        this.onWandDetection?.({
          ...detection,
          tipX: this.smoothTipX,
          tipY: this.smoothTipY,
          gripX: this.smoothGripX,
          gripY: this.smoothGripY,
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
          timestamp: performance.now(),
        });
      }

      this.animFrameId = requestAnimationFrame(detect);
    };

    this.animFrameId = requestAnimationFrame(detect);
  }

  /** 検出ループ停止 */
  stop(): void {
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
    this.isFirstDetection = true;
  }
}
```

#### 推論パイプラインの流れ

```text
カメラフレーム → letterboxリサイズ(640x640) → NCHW正規化
     → ONNX推論 → [1, 11, 8400] 出力パース
     → 最高信頼度の検出を選択 → letterbox→映像座標変換
     → X軸ミラー反転 → EMAスムージング → コールバック発火
```

### Step 3-4: Reactフック — `src/features/camera/api/useWandDetector.ts`（新規, ~80行）

`useJoyCon`と同パターン:

```typescript
import { useState, useCallback, useRef, useEffect } from "react";
import { WandDetector } from "./wand-detector";
import type { CameraStatus, WandDetectionResult } from "../types/camera";

export function useWandDetector() {
  const [status, setStatus] = useState<CameraStatus>("DISCONNECTED");
  const [wandPoint, setWandPoint] = useState<WandDetectionResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<WandDetector | null>(null);

  useEffect(() => {
    if (!detectorRef.current) {
      detectorRef.current = new WandDetector();
      detectorRef.current.onWandDetection = (result) => {
        setWandPoint(result);
      };
    }
    return () => {
      if (detectorRef.current) {
        detectorRef.current.destroy();
        detectorRef.current = null;
      }
    };
  }, []);

  const connect = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current) return;
    setStatus("INITIALIZING");
    try {
      await detectorRef.current.initialize(videoRef.current);
      detectorRef.current.start();
      setStatus("CONNECTED");
    } catch (e) {
      console.error(e);
      setStatus("ERROR");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (!detectorRef.current) return;
    detectorRef.current.destroy();
    detectorRef.current = new WandDetector();
    detectorRef.current.onWandDetection = (result) => {
      setWandPoint(result);
    };
    setWandPoint(null);
    setStatus("DISCONNECTED");
  }, []);

  return { status, wandPoint, videoRef, connect, disconnect };
}
```

### Step 3-5: カメラテストページ — `src/app/test/camera/page.tsx`（新規, ~350行）

カメラ杖検出の**単独テストページ**。`/test/wand` は変更せず、このページで検出・トレイル描画・デバッグ情報を完結させる。

#### 機能一覧

- ウェブカメラプレビュー（video要素、CSSで `scaleX(-1)` による左右反転）
- バウンディングボックス + キーポイント2点のオーバーレイ描画（Canvas）
- Canvas上に杖先のトレイル描画（`adjustViewBounds` + `toCanvasCoords` を流用）
- 杖先(tip)と手元(grip)を結ぶ線を描画
- 接続/切断ボタン + ステータスバッジ
- サイドパネル: 杖先座標、手元座標、検出信頼度、キーポイント信頼度
- 軌跡クリアボタン
- トレイルポイント形式: `{ rawX, rawY, t }`（既存 `test/wand` と同一）

#### ページの主要構成

```text
┌──────────────────────────────────────────────────┐
│  カメラ杖検出テスト                                 │
│  [カメラを接続] [CONNECTED]                        │
│                                                  │
│  ┌─────────────────────┐  ┌────────────────────┐ │
│  │  カメラプレビュー      │  │ 杖先 (tip)         │ │
│  │  (video + Canvas)    │  │  X: 320  Y: 80     │ │
│  │                     │  │  信頼度: 0.92       │ │
│  │  ● tip              │  │                    │ │
│  │  │                  │  │ 手元 (grip)        │ │
│  │  │ bbox: 緑枠       │  │  X: 315  Y: 350    │ │
│  │  │                  │  │                    │ │
│  │  ● grip             │  │ 検出信頼度: 0.85    │ │
│  │                     │  │                    │ │
│  │  トレイル: 緑の軌跡    │  │ [軌跡をクリア]       │ │
│  └─────────────────────┘  └────────────────────┘ │
└──────────────────────────────────────────────────┘
```

#### Canvas描画の要点

- video要素の上にCanvasを重ねて配置（`position: absolute`）
- 検出結果のバウンディングボックスを緑枠で描画
- tip: 緑ドット、grip: 黄ドット、2点間を白線で結ぶ
- 杖先(tip)位置のトレイルを描画（既存の `drawDot` と同パターン）
- トレイルは3秒間フェードアウト
- 色テーマ: `"34, 197, 94"`（green）— IR(blue), IMU(purple) と区別

---

## 6. ファイル一覧

| ファイル | 操作 | 工程 |
|---------|------|------|
| Colabノートブック（外部） | 新規 | Phase 2 |
| `public/models/wand_pose.onnx` | 新規（学習済みモデル配置） | Phase 2 |
| `src/features/camera/types/camera.ts` | 新規 | Phase 3 Step 3-2 |
| `src/features/camera/api/wand-detector.ts` | 新規 | Phase 3 Step 3-3 |
| `src/features/camera/api/useWandDetector.ts` | 新規 | Phase 3 Step 3-4 |
| `src/app/test/camera/page.tsx` | 新規 | Phase 3 Step 3-5 |
| `package.json` | 変更（依存追加） | Phase 3 Step 3-1 |

> **注意**: `src/app/test/wand/page.tsx` は変更しない。カメラ杖検出のテストは `/test/camera` で完結する。

---

## 7. 検証方法

### Phase 2 検証（モデル）

- Colab上で `model.val()` の mAP50 が **0.5以上**であること
- テスト画像でキーポイント2点（tip / grip）が正しい位置に出ること
- `model.predict()` で `r.keypoints.xy` に2点の座標が出力されることを確認

### Phase 3 検証（ブラウザ）

| # | 検証項目 | 確認方法 |
|---|---------|---------|
| 1 | カメラプレビュー + キーポイント表示 | `/test/camera` を開き、杖を映す。tip(緑)とgrip(黄)が正しい位置に出ること |
| 2 | トレイルの滑らかな追従 | 杖をゆっくり振って、杖先の軌跡が滑らかに追従すること |
| 3 | 杖の角度対応 | 縦・横・斜めに持ち替えても tip が杖先を追跡すること |
| 4 | フレームアウト時の安定性 | 杖をフレーム外に出してクラッシュしないこと |
| 5 | パフォーマンス | DevTools Performance タブで **15fps以上**出ていること |

### 実装順序

1. **Phase 1**: 画像収集・キーポイントアノテーション（CVAT / Roboflow）
2. **Phase 2**: Colabで YOLOv8-pose 学習 → `.onnx` を `public/models/` に配置
3. **Phase 3 Step 3-1〜3-2**: パッケージ追加 + 型定義
4. **Phase 3 Step 3-3〜3-4**: WandDetectorクラス + Reactフック
5. **Phase 3 Step 3-5**: カメラテストページ `/test/camera` で動作確認

---

## 参考資料

- [Ultralytics YOLOv8 Pose Estimation](https://docs.ultralytics.com/tasks/pose/)
- [YOLOv8 Custom Keypoint Training](https://docs.ultralytics.com/datasets/pose/)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html)
- [CVAT Annotation Tool](https://www.cvat.ai/)
- 既存実装: `src/features/device/api/joycon-webhid.ts`（同パターンの参考）
