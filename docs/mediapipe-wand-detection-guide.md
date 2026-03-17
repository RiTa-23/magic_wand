# MediaPipe カスタムモデルによる杖検知 実装ガイド

Joy-Conでの杖振り検知に加え、ウェブカメラ前で実際の杖を振ることでも杖振りを検知できるようにする。MediaPipe Model Makerでカスタム物体検出モデルを学習し、ブラウザ上でリアルタイム推論する。

---

## 目次

1. [全体アーキテクチャ](#1-全体アーキテクチャ)
2. [Phase 1: 学習データ準備](#2-phase-1-学習データ準備)
3. [Phase 2: モデル学習（Python / Google Colab）](#3-phase-2-モデル学習python--google-colab)
4. [Phase 3: Next.js実装（TypeScript / ブラウザ）](#4-phase-3-nextjs実装typescript--ブラウザ)
5. [ファイル一覧](#5-ファイル一覧)
6. [検証方法](#6-検証方法)

---

## 1. 全体アーキテクチャ

```text
┌─────────────────────────────────────────────────────────────┐
│  ブラウザ (Chrome)                                           │
│                                                             │
│  page.tsx ─── useWandDetector.ts ─── wand-detector.ts       │
│  (React UI)   (React Hook)          (MediaPipe推論コア)      │
│                                          │                  │
│                               @mediapipe/tasks-vision       │
│                               (ObjectDetector API)          │
│                                          │                  │
│                                   getUserMedia API          │
└──────────────────────────────┬──────────────────────────────┘
                               │ WebRTC / WebGL
                    ┌──────────▼──────────┐
                    │   ウェブカメラ        │
                    │   (USB / 内蔵)       │
                    └─────────────────────┘
```

### 全体の流れ

```
[Phase 1] 画像収集・アノテーション（Roboflow / ブラウザ）
    ↓
[Phase 2] モデル学習（Python / Google Colab）
    ↓
[Phase 3] Next.jsでリアルタイム検出実装（TypeScript / ブラウザ）
```

---

## 2. Phase 1: 学習データ準備

### Step 1-1: 杖の画像収集（50〜200枚）

ウェブカメラ or スマホで杖を様々な条件で撮影する。

| 条件 | バリエーション |
|------|-------------|
| 角度 | 正面、斜め、横、振っている最中 |
| 背景 | 実際に使う環境（部屋）で撮影 |
| 照明 | 明るい / 暗い |
| 持ち方 | 片手、両手、振り上げ、振り下ろし |

> **Tips**: 撮影スクリプトをNext.jsのテストページとして作成すると効率的。

### Step 1-2: アノテーション（バウンディングボックス付け）

**Roboflow**（無料枠あり）を使用する。

1. 画像をアップロード
2. 杖の周りにバウンディングボックスを描く
3. ラベル: `wand`（1クラス）
4. **COCO JSON形式**でエクスポート

データセット構成:

```
wand_dataset/
├── train/
│   ├── images/
│   └── labels.json   # COCO形式
└── validation/
    ├── images/
    └── labels.json
```

---

## 3. Phase 2: モデル学習（Python / Google Colab）

### Step 2-1: Google Colabでモデル学習

```python
# Google Colab notebook
!pip install mediapipe-model-maker

from mediapipe_model_maker import object_detector

# データセット読み込み（Roboflowからエクスポートしたもの）
train_data = object_detector.Dataset.from_coco_folder("wand_dataset/train/")
val_data = object_detector.Dataset.from_coco_folder("wand_dataset/validation/")

# ハイパーパラメータ設定
hparams = object_detector.HParams(
    batch_size=8,
    learning_rate=0.01,
    epochs=50,
    export_dir="exported_model/"
)
options = object_detector.ObjectDetectorOptions(
    supported_model=object_detector.SupportedModels.MOBILENET_V2,
    hparams=hparams
)

# 学習実行
model = object_detector.ObjectDetector.create(
    train_data=train_data,
    validation_data=val_data,
    options=options
)

# 評価
metrics = model.evaluate(val_data)
print(metrics)

# TFLiteモデル書き出し
model.export_model()  # → exported_model/model.tflite
```

### Step 2-2: モデルファイル配置

学習済みモデルをダウンロードし、プロジェクトに配置する。

```
public/models/wand_detector.tflite
```

---

## 4. Phase 3: Next.js実装（TypeScript / ブラウザ）

### Step 3-1: 依存パッケージ追加

```bash
bun add @mediapipe/tasks-vision
```

### Step 3-2: 型定義 — `src/features/camera/types/camera.ts`（新規）

```typescript
export type CameraStatus = "DISCONNECTED" | "INITIALIZING" | "CONNECTED" | "ERROR";

export type WandDetectionResult = {
  tipX: number;          // 杖先のX座標（ピクセル）
  tipY: number;          // 杖先のY座標（ピクセル）
  confidence: number;    // 検出信頼度 0〜1
  detected: boolean;     // 杖が検出されたか
  boundingBox: {         // バウンディングボックス
    x: number;
    y: number;
    width: number;
    height: number;
  };
  timestamp: number;
};
```

### Step 3-3: APIクラス — `src/features/camera/api/wand-detector.ts`（新規, ~180行）

`WandDetector`クラス（`JoyConWebHID`と同パターン）:

```typescript
import { ObjectDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import type { WandDetectionResult } from "../types/camera";

export class WandDetector {
  private detector: ObjectDetector | null = null;
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private animFrameId: number = 0;
  private lastTimestamp: number = -1;

  // EMAスムージング用
  private smoothX: number = 0;
  private smoothY: number = 0;
  private isFirstDetection: boolean = true;

  // コールバック
  onWandDetection: ((result: WandDetectionResult) => void) | null = null;

  /** MediaPipeモデルとカメラを初期化 */
  async initialize(videoElement: HTMLVideoElement): Promise<boolean> {
    // 1. MediaPipe ObjectDetector初期化
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    this.detector = await ObjectDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/models/wand_detector.tflite",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      maxResults: 1,
      scoreThreshold: 0.5,
    });

    // 2. カメラストリーム取得
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 640, height: 480 },
    });
    videoElement.srcObject = this.stream;
    await videoElement.play();

    this.videoElement = videoElement;
    return true;
  }

  /** 検出ループ開始 */
  start(): void {
    const detect = () => {
      if (!this.detector || !this.videoElement) return;

      const now = performance.now();
      if (now === this.lastTimestamp) {
        this.animFrameId = requestAnimationFrame(detect);
        return;
      }
      this.lastTimestamp = now;

      const results = this.detector.detectForVideo(this.videoElement, now);
      const videoWidth = this.videoElement.videoWidth;

      if (results.detections.length > 0) {
        const det = results.detections[0];
        const bbox = det.boundingBox!;
        const confidence = det.categories[0]?.score ?? 0;

        // 杖先 = バウンディングボックスの上端中央
        let rawTipX = bbox.originX + bbox.width / 2;
        let rawTipY = bbox.originY; // 上端

        // フロントカメラのX軸ミラー反転
        rawTipX = videoWidth - rawTipX;

        // EMAスムージング（α=0.4）
        const alpha = 0.4;
        if (this.isFirstDetection) {
          this.smoothX = rawTipX;
          this.smoothY = rawTipY;
          this.isFirstDetection = false;
        } else {
          this.smoothX = alpha * rawTipX + (1 - alpha) * this.smoothX;
          this.smoothY = alpha * rawTipY + (1 - alpha) * this.smoothY;
        }

        this.onWandDetection?.({
          tipX: this.smoothX,
          tipY: this.smoothY,
          confidence,
          detected: true,
          boundingBox: {
            x: videoWidth - (bbox.originX + bbox.width), // ミラー反転
            y: bbox.originY,
            width: bbox.width,
            height: bbox.height,
          },
          timestamp: now,
        });
      } else {
        this.onWandDetection?.({
          tipX: this.smoothX,
          tipY: this.smoothY,
          confidence: 0,
          detected: false,
          boundingBox: { x: 0, y: 0, width: 0, height: 0 },
          timestamp: now,
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
    if (this.detector) {
      this.detector.close();
      this.detector = null;
    }
    this.videoElement = null;
    this.isFirstDetection = true;
  }
}
```

#### 杖先の推定ロジック

```text
バウンディングボックスの上端中央 = 杖先
tipX = bbox.x + bbox.width / 2
tipY = bbox.y  （上端 = 杖先と仮定）
```

> **注意**: アノテーション時に杖先が上に来るように統一すると精度向上。

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

独立したカメラ検出テストページ。以下の機能を持つ:

- ウェブカメラプレビュー（video要素、CSSで左右反転）
- バウンディングボックスのオーバーレイ描画（Canvas）
- Canvas上に杖先のトレイル描画
- 接続/切断ボタン
- 検出信頼度・座標・バウンディングボックスの表示パネル
- トレイルポイント形式: `{ rawX, rawY, t }`（既存と同一）

#### ページの主要構成

```text
┌──────────────────────────────────────────────┐
│  カメラ杖検出テスト                             │
│  [接続ボタン] [CONNECTED] ステータスバッジ        │
│                                              │
│  ┌───────────────────┐  ┌──────────────────┐ │
│  │                   │  │ 杖先の座標        │ │
│  │  カメラプレビュー    │  │  X: 320          │ │
│  │  + BBox描画        │  │  Y: 120          │ │
│  │  + トレイル描画     │  │ 信頼度: 0.85     │ │
│  │                   │  │ BBox情報          │ │
│  │                   │  │ [軌跡クリア]       │ │
│  └───────────────────┘  └──────────────────┘ │
└──────────────────────────────────────────────┘
```

#### Canvas描画の要点

- video要素の上にCanvasを重ねて配置（`position: absolute`）
- 検出結果のバウンディングボックスを緑枠で描画
- 杖先位置にドットを描画（既存の`drawDot`と同パターン）
- トレイルは3秒間フェードアウト

### Step 3-6: 既存杖テストページへの統合 — `src/app/test/wand/page.tsx`（変更）

#### 変更内容

1. `TrackingMode` に `"CAMERA"` を追加

```typescript
// 変更前
type TrackingMode = "IR" | "IMU";

// 変更後
type TrackingMode = "IR" | "IMU" | "CAMERA";
```

2. `useWandDetector` フックを追加使用

```typescript
const { status: cameraStatus, wandPoint, videoRef, connect: cameraConnect, disconnect: cameraDisconnect } =
  useWandDetector();
```

3. モード切替タブに「CAMERA（カメラ）」を追加（3つ目のタブ、緑色テーマ）

4. CAMERA選択時の動作:
   - 接続ボタン: `cameraConnect()` を呼ぶ
   - video要素を小さくプレビュー表示（右下に160x120程度）
   - `wandPoint` から `tipX`, `tipY` を取得し、トレイルに追加
   - Canvas描画は既存の `adjustViewBounds` + `toCanvasCoords` をそのまま流用
   - 色テーマ: `"34, 197, 94"`（green）

5. サイドパネルに CAMERA モード用情報を表示:
   - 杖先座標（tipX, tipY）
   - 検出信頼度（confidence）
   - バウンディングボックス情報
   - 検出状態（detected / 未検出）

---

## 5. ファイル一覧

| ファイル | 操作 | 工程 |
|---------|------|------|
| Colabノートブック（外部） | 新規 | Phase 2 |
| `public/models/wand_detector.tflite` | 新規（学習済みモデル配置） | Phase 2 |
| `src/features/camera/types/camera.ts` | 新規 | Phase 3 Step 3-2 |
| `src/features/camera/api/wand-detector.ts` | 新規 | Phase 3 Step 3-3 |
| `src/features/camera/api/useWandDetector.ts` | 新規 | Phase 3 Step 3-4 |
| `src/app/test/camera/page.tsx` | 新規 | Phase 3 Step 3-5 |
| `src/app/test/wand/page.tsx` | 変更 | Phase 3 Step 3-6 |
| `package.json` | 変更（依存追加） | Phase 3 Step 3-1 |

---

## 6. 検証方法

### Phase 2 検証（モデル）

- Colab上で `model.evaluate()` の mAP（平均適合率）が **0.5以上**であること
- テスト画像で杖のバウンディングボックスが正しく出ること

### Phase 3 検証（ブラウザ）

| # | 検証項目 | 確認方法 |
|---|---------|---------|
| 1 | カメラプレビュー + BBox表示 | `/test/camera` を開き、杖を映す |
| 2 | トレイルの滑らかな追従 | 杖をゆっくり振って軌跡を確認 |
| 3 | フレームアウト時の安定性 | 杖をフレーム外に出してクラッシュしないことを確認 |
| 4 | 3モード切替 | `/test/wand` で IR / IMU / CAMERA の切替が動作すること |
| 5 | パフォーマンス | DevTools Performance タブで **15fps以上**出ていること |

### 実装順序

1. **Phase 1**: 画像収集・アノテーション（Roboflow）
2. **Phase 2**: Colabでモデル学習 → `.tflite` を `public/models/` に配置
3. **Phase 3 Step 3-1〜3-2**: パッケージ追加 + 型定義
4. **Phase 3 Step 3-3〜3-4**: WandDetectorクラス + Reactフック
5. **Phase 3 Step 3-5**: カメラテストページで動作確認
6. **Phase 3 Step 3-6**: 既存杖テストページにCAMERAモード追加

---

## 参考資料

- [MediaPipe Object Detection (Web)](https://developers.google.com/mediapipe/solutions/vision/object_detector/web_js)
- [MediaPipe Model Maker](https://developers.google.com/mediapipe/solutions/model_maker)
- [Roboflow Annotate](https://roboflow.com/)
- 既存実装: `src/features/device/api/joycon-webhid.ts`（同パターンの参考）
