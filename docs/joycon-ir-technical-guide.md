# Joy-Con (R) IRカメラ テスト実装 技術解説

本ドキュメントでは、Joy-Con (R) の赤外線（IR）カメラをWebブラウザから制御するテスト実装について、使用した技術・プロトコル・コードの構造を解説します。

---

## 目次

1. [全体アーキテクチャ](#1-全体アーキテクチャ)
2. [使用技術: WebHID API](#2-使用技術-webhid-api)
3. [Joy-Con の HID 通信プロトコル](#3-joy-con-の-hid-通信プロトコル)
4. [MCU（マイクロコントローラユニット）とIRカメラ](#4-mcuマイクロコントローラユニットとirカメラ)
5. [IRカメラの3つのモード](#5-irカメラの3つのモード)
6. [各ファイルの役割と構造](#6-各ファイルの役割と構造)
7. [初期化シーケンスの詳細](#7-初期化シーケンスの詳細)
8. [参考資料](#8-参考資料)

---

## 1. 全体アーキテクチャ

```text
┌──────────────────────────────────────────────────────┐
│  ブラウザ (Chrome)                                    │
│                                                      │
│  page.tsx ─── useJoyCon.ts ─── joycon-webhid.ts      │
│  (React UI)   (React Hook)     (WebHID通信コア)       │
│                                     │                │
│                              WebHID API              │
└──────────────────────────────┬───────────────────────┘
                               │ Bluetooth HID
                    ┌──────────▼──────────┐
                    │   Joy-Con (R)        │
                    │  ┌────────────────┐  │
                    │  │  MCU (STM32)   │  │
                    │  │  └─ IR Camera  │  │
                    │  │  └─ IMU Sensor │  │
                    │  └────────────────┘  │
                    └─────────────────────┘
```

ブラウザのWebHID APIを使ってJoy-Conに直接HIDレポートを送受信し、MCU内蔵のIRカメラからデータを取得します。

---

## 2. 使用技術: WebHID API

### WebHID APIとは

WebHID は、Webブラウザから **USB/Bluetooth HID（Human Interface Device）** に直接アクセスするためのWeb標準APIです。従来はネイティブアプリやドライバが必要だったHIDデバイスとの通信をJavaScriptから行えます。

### 本プロジェクトでの使い方

```typescript
// 1. デバイスの検索と選択（ユーザーにダイアログを表示）
const devices = await navigator.hid.requestDevice({
  filters: [{ vendorId: 0x057e }], // Nintendo のベンダーID
});

// 2. デバイスを開く
await device.open();

// 3. データの送信（Output Report）
await device.sendReport(reportId, data);
//   - reportId 0x01: サブコマンド付きレポート
//   - reportId 0x11: MCUデータ要求レポート

// 4. データの受信（Input Report）
device.addEventListener("inputreport", (event) => {
  const { reportId, data } = event; // reportIdはdataに含まれない！
  // reportId 0x31: 標準入力 + IMU + MCUデータ
});

// 5. 切断
await device.close();
```

> **重要:** WebHIDの `data` プロパティには `reportId` バイトが**含まれない**ため、各種ドキュメントに記載されているバイトオフセットから**1を引く**必要があります。

### 対応ブラウザ

- Chrome 89+ / Edge 89+ （デスクトップのみ）
- Safari, Firefox は未対応

---

## 3. Joy-Con の HID 通信プロトコル

### Output Report（ホスト → Joy-Con）

| Report ID | 用途             | 構造                                               |
| :-------: | ---------------- | -------------------------------------------------- |
|  `0x01`   | サブコマンド送信 | カウンター + Rumble(8B) + サブコマンドID + データ  |
|  `0x11`   | MCUデータ要求    | カウンター + Rumble(8B) + MCUコマンド + 引数 + CRC |

**Output Report `0x01` の構造:**

```text
Byte 0     : パケットカウンター (0x0~0xF、送信ごとにインクリメント)
Byte 1-8   : Rumble データ（振動制御、今回は使用しないのでダミー値）
Byte 9     : サブコマンドID
Byte 10+   : サブコマンド引数
```

主なサブコマンド:

|   ID   | 機能                   | 本実装での用途                      |
| :----: | ---------------------- | ----------------------------------- |
| `0x03` | Input Report Mode 設定 | 引数`0x31`でMCU/IR付きモードに変更  |
| `0x21` | MCU Config 書き込み    | MCUコマンドを送信するラッパー       |
| `0x22` | MCU Resume             | MCUをStandbyに復帰                  |
| `0x40` | IMU有効化              | `0x01`でジャイロ/加速度を有効にする |

### Input Report（Joy-Con → ホスト）

| Report ID | 内容                       | サイズ    |
| :-------: | -------------------------- | --------- |
|  `0x31`   | 標準入力 + IMU + MCUデータ | 361 bytes |

**Input Report `0x31` の構造（WebHIDオフセット）:**

```text
Byte 0     : タイマー
Byte 1     : デバイス状態
Byte 2     : ボタン（右）─ Y, X, B, A, SR, SL, R, ZR
Byte 3     : ボタン（共有）─ Plus, RStick, Home 等
Byte 4     : ボタン（左）
Byte 5-10  : スティックデータ
Byte 11    : バイブレータ
Byte 12-47 : IMUデータ（3フレーム × 12バイト）
Byte 48    : MCU Report ID
Byte 49+   : MCUデータ本体
```

---

## 4. MCU（マイクロコントローラユニット）とIRカメラ

Joy-Con (R) には **STM32系のMCU** が内蔵されており、IRカメラとNFCリーダーを制御します。MCUは独自の**状態マシン**を持ち、ホストからのコマンドで状態を遷移させます。

### MCU状態マシン

```text
[Off] ──(Resume 0x22)──► [Standby] ──(Set Mode 0x21)──► [IR Mode]
                              │                              │
                              │                    (Configure IR 0x23)
                              │                              │
                              │                    [IR Sensor Reset]
                              │                              │
                              │                    [Waiting for Config]
                              │                              │
                              │                    (Write Registers)
                              │                              │
                              │                    (Set IR Mode)
                              │                              ▼
                              │                    [Active Mode]
                              │                    (Clustering / Moment / ImageTransfer)
```

> **重要:** 各状態遷移はMCUからの確認レポートを**ポーリング**で待つ必要があります。固定時間のスリープだけでは不十分で、MCUが遷移を完了する前に次のコマンドを送ると無視されます。

### MCU コマンドフォーマット

MCUコマンドはサブコマンド `0x21` 経由で送信されます。

```text
Byte 0     : MCU cmd ID    (例: 0x21=SetMode, 0x23=ConfigureIR)
Byte 1     : MCU subcmd ID (例: 0x00=SetMCUMode, 0x01=SetIRMode, 0x04=WriteRegisters)
Byte 2-36  : データ
Byte 37    : CRC-8-CCITT  (Byte 1-36 の36バイトに対して計算)
```

### CRC-8-CCITT

MCUコマンドの整合性検証には **CRC-8-CCITT (多項式 0x07)** が使われます。`lib/crc8.ts` に実装があります。

---

## 5. IRカメラの3つのモード

### Clustering Mode (`0x06`)

**光点のクラスタ（塊）を検出**するモード。最大16個の光点について重心座標、面積、輝度等を返します。

**用途:** 杖の先端に付けたIR LEDやリモコンのIR信号を検出。低データ量・高フレームレート。

**データ構造** （offset 60から、各クラスタ16バイト）:

| オフセット | サイズ | フィールド             |
| :--------: | :----: | ---------------------- |
|   +0, +1   | u16 LE | 平均輝度               |
|   +2, +3   | u16 LE | ピクセル数（面積）     |
|   +4, +5   | u16 LE | 重心X座標              |
|   +6, +7   | u16 LE | 重心Y座標              |
|  +8〜+15   | u16×4  | バウンディングボックス |

### Moment Mode (`0x03`)

**フレーム全体の統計情報**を返すモード。画像の平均輝度、白ピクセル数、環境ノイズ量などの概要データを取得します。

**用途:** 赤外線の有無の簡易検出、環境光の測定。

**データ構造** （offset 51から）:

| オフセット | サイズ | フィールド       |
| :--------: | :----: | ---------------- |
|     51     |   u8   | フラグメント番号 |
|     52     |   u8   | 平均輝度         |
|   54-55    | u16 LE | 白ピクセル数     |
|   56-57    | u16 LE | 環境ノイズ数     |

### Image Transfer Mode (`0x07`)

**生のIR画像データ**をフラグメント（断片）に分割して転送するモード。160×120ピクセルの解像度でグレースケール画像を取得できます。

**用途:** IR映像のリアルタイム表示、画像解析。

**仕組み:**

- 1フレーム = 19,200バイト（160×120ピクセル）
- 1フラグメント = 300バイト（画像データ部分）
- 全64フラグメント（#0〜#63）で1フレームが完成
- Output Report `0x11` でデータを定期的にリクエストする必要がある

---

## 6. 各ファイルの役割と構造

### `types/joycon.ts` — 型定義

すべてのデータ構造の型を定義するファイル。

| 型名             | 内容                                                              |
| ---------------- | ----------------------------------------------------------------- |
| `JoyConStatus`   | 接続状態（`DISCONNECTED` / `CONNECTING` / `CONNECTED` / `ERROR`） |
| `IRCameraMode`   | IRモード（`CLUSTERING` / `MOMENT` / `IMAGE_TRANSFER`）            |
| `IRCluster`      | 1つの光点データ（座標、面積、輝度等）                             |
| `IRClusterFrame` | Clusteringモードの1フレーム                                       |
| `IRMomentFrame`  | Momentモードの1フレーム                                           |
| `IRImageFrame`   | Image Transferモードの1フレーム（画像バイト配列）                 |
| `IRFrame`        | 上記3種のユニオン型（`type`フィールドで判別）                     |
| `JoyConButtons`  | ボタン押下状態（A/B/X/Y/R/ZR等）                                  |
| `JoyConIMU`      | 加速度・ジャイロの3軸データ                                       |
| `JoyConState`    | ボタン + IMUの統合状態                                            |

### `lib/crc8.ts` — CRC-8-CCITT計算

MCUコマンドの整合性検証に使うCRC-8計算関数。多項式 `0x07` を使ったテーブルベース実装。

```typescript
calculateCRC8CCITT(data: Uint8Array, start: number, length: number): number
```

### `lib/ir-registers.ts` — IRレジスタ定義

IRカメラの設定レジスタのアドレスと値を定義。各レジスタは `{page, offset, value}` の3バイト構造。

| レジスタ   | ページ:オフセット | 機能                                       |
| ---------- | :---------------: | ------------------------------------------ |
| Resolution |      0:0x2E       | 解像度（160x120: `0x50`, 320x240: `0x00`） |
| IR LEDs    |      0:0x10       | IR LED有効化                               |
| Exposure   |     1:0x30-31     | 露光時間（LSB/MSB）                        |
| Finish     |      0:0x07       | 設定完了フラグ（最後に`1`を書く）          |

### `api/joycon-webhid.ts` — WebHID通信コア

Joy-Conとの通信を行うメインクラス `JoyConWebHID`。全てのHID送受信処理を担当。

**主なメソッド:**

| メソッド                            | 機能                                                 |
| ----------------------------------- | ---------------------------------------------------- |
| `connect()`                         | WebHIDでデバイスを検索・接続                         |
| `disconnect()`                      | 切断・リソース解放                                   |
| `sendSubcommand(id, data)`          | Output Report `0x01` を送信                          |
| `sendMCUCommand(cmd, subcmd, data)` | MCUコマンド（CRC付き）を`0x21`経由で送信             |
| `sendIRDataRequest()`               | Output Report `0x11` でIRデータをリクエスト          |
| `enableIRCamera(mode)`              | MCU初期化→レジスタ書き込み→モード設定→ポーリング開始 |
| `switchIRMode(mode)`                | 動作中にIRモードを切り替え                           |
| `configureIRMode(mode)`             | リセット→レジスタ→モード設定の共通処理               |
| `waitForMCUState(predicate)`        | MCU状態遷移の確認をポーリングで待つ                  |
| `handleInputReport(event)`          | 入力レポート受信時のハンドラ（ボタン/IMU/IRパース）  |

**モード別パーサー:**

| メソッド                   | 対象モード     | 処理                                                       |
| -------------------------- | -------------- | ---------------------------------------------------------- |
| `parseClusteringData()`    | Clustering     | 16バイト×最大16クラスタを走査、pixelCount > 0でフィルタ    |
| `parseMomentData()`        | Moment         | ヘッダーから平均輝度・白ピクセル数・ノイズ数を抽出         |
| `parseImageTransferData()` | Image Transfer | 300バイトフラグメントをバッファに蓄積→全64フラグ完成で発火 |

### `api/useJoyCon.ts` — React Hook

`JoyConWebHID` をReactコンポーネントから使いやすくラップするカスタムフック。

```typescript
const {
  status, // 接続状態
  irFrame, // IRデータ（ユニオン型: type で判別）
  irMode, // 現在のIRモード
  joyconState, // ボタン・IMU状態
  connect, // 接続関数
  disconnect, // 切断関数
  switchMode, // IRモード切り替え関数
} = useJoyCon();
```

`useRef` で `JoyConWebHID` インスタンスを保持し、コールバックで受信データを `useState` に反映させます。

### `app/test/device/page.tsx` および `app/test/wand/page.tsx` — テストUI / トラッキングUI

3つのモードを切り替えてテストできるサンドボックス画面や、杖の軌跡を描画するトラッキング画面です。

- **接続セクション:** WebHIDデバイス選択ダイアログを表示
- **ボタン/IMUセクション:** リアルタイムでボタン押下・センサー値を表示
- **IRカメラセクション:** モード切り替えタブ + モード別表示
  - Clustering: 光点リスト（テキスト）およびCanvas上の軌跡描画
  - Moment: 輝度・ノイズ（数値テーブル）
  - Image Transfer: Canvas描画（グレースケール画像）

**フロントエンド描画の工夫点（UX向上）:**

- **動的スケーリングとアスペクト比の固定:**
  取得した軌跡の最小・最大座標(`minX, maxX, minY, maxY`)から描画範囲を動的に決定します。その際、キャンバスの縦横比（アスペクト比）と描画範囲の比率が一致するように短い辺を拡張することで、描画される図形（円など）が歪まないようにしています。
- **LERP（線形補間）によるスムージング:**
  算出した描画範囲を毎フレーム即座に適用するのではなく、前フレームの表示範囲から目標とする表示範囲へ10%〜15%ずつ近づける（LERP）処理を行っています。これにより、ポインタが画面端に到達した際のカメラ移動（ズームやスクロール）が滑らかになり、画面のカクつきを防いでいます。

---

## 7. 初期化シーケンスの詳細

以下の順序でMCUを初期化し、IRカメラを有効化します。

```text
(1) IMU有効化              sendSubcommand(0x40, [0x01])
          ↓
(2) 入力レポートモード設定   sendSubcommand(0x03, [0x31])
          ↓
(3) MCU Resume (Standby)   sendSubcommand(0x22, [0x01])
          ↓ ← Standby状態を確認 (MCU Report ID 0x01, state==1)
(4) MCU → IR Mode          sendMCUCommand(0x21, 0x00, [0x05])
          ↓ ← IR状態を確認 (MCU Report ID 0x01, state==5)
(5) IR Sensor Reset         sendMCUCommand(0x23, 0x01, [0x00, ...])
          ↓ ← IR Status Report (MCU Report ID 0x13) を待つ
(6) レジスタ書き込み        sendMCUCommand(0x23, 0x04, regData)
     - Resolution, IR LEDs, Exposure, Finish 等
          ↓
(7) IRモード設定            sendMCUCommand(0x23, 0x01, [modeId, frags, ...])
          ↓ ← IR Status Report (MCU Report ID 0x13) を待つ
(8) データポーリング開始    sendIRDataRequest() を50ms間隔で繰り返し
```

各ステップでMCUからの確認レポートをポーリングで待ちます。タイムアウト時は警告を出しつつ続行します。

---

## 8. 参考資料

| 資料                           | URL                                                              |
| ------------------------------ | ---------------------------------------------------------------- |
| dekuNukem - Nintendo Switch RE | https://github.com/dekuNukem/Nintendo_Switch_Reverse_Engineering |
| joycon-sys (Rust実装)          | プロジェクト内 `.devbox/joy/`                                    |
| WebHID API 仕様                | https://wicg.github.io/webhid/                                   |
| Chrome WebHID ドキュメント     | https://developer.chrome.com/docs/capabilities/hid               |
