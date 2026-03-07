# 音声認識（呪文認識）開発マニュアル

本ドキュメントは、Magic Wandプロジェクトの **音声認識（Voice）担当者向け** の技術解説・開発ガイドです。
ブラウザの Web Speech API を使い、ユーザーが唱えた「呪文」をリアルタイムに認識し、ジェスチャー認識（杖の振り）と組み合わせて魔法を発動させる機能を実装します。

---

## 目次

1. [全体アーキテクチャ](#1-全体アーキテクチャ)
2. [使用技術: Web Speech API](#2-使用技術-web-speech-api)
3. [Web Speech API の基本的な使い方](#3-web-speech-api-の基本的な使い方)
4. [ディレクトリ構造と各ファイルの役割](#4-ディレクトリ構造と各ファイルの役割)
5. [実装ステップ](#5-実装ステップ)
6. [呪文マッチングの設計指針](#6-呪文マッチングの設計指針)
7. [Device連携（杖の振り＋呪文）](#7-device連携杖の振り呪文)
8. [テスト画面の作り方](#8-テスト画面の作り方)
9. [参考資料](#9-参考資料)

---

## 1. 全体アーキテクチャ

```
┌──────────────────────────────────────────────────────────┐
│  ブラウザ (Chrome)                                        │
│                                                          │
│  page.tsx ─── useSpeech.ts ─── speech-recognition.ts     │
│  (React UI)   (React Hook)    (Web Speech API ラッパー)   │
│                                     │                    │
│                           Web Speech API                 │
│                           (SpeechRecognition)            │
└──────────────────────────────┬───────────────────────────┘
                               │ マイク音声
                    ┌──────────▼──────────┐
                    │   PCマイク / 外部     │
                    │   マイクデバイス      │
                    └─────────────────────┘

※ 音声データは Chrome 経由で Google の音声認識サーバーに送信され、
   テキストに変換された結果がブラウザに返されます。
```

### データフロー

```
マイク音声入力
    ↓
Web Speech API (SpeechRecognition)
    ↓
認識テキスト（中間結果 / 確定結果）
    ↓
呪文マッチングロジック (lib/spell-matcher.ts)
    ↓
SpellResult { spell: "ルーモス", action: "light_on", confidence: 0.92 }
    ↓
UI担当の統合レイヤーへ（Device担当のジェスチャー結果と合流）
```

---

## 2. 使用技術: Web Speech API

### Web Speech API とは

Web Speech API は、ブラウザに組み込まれた音声認識・音声合成のためのWeb標準APIです。本プロジェクトでは **SpeechRecognition**（音声認識）インターフェースを使用します。

### なぜ Web Speech API を選んだのか

| 選定理由                   | 詳細                                                            |
| -------------------------- | --------------------------------------------------------------- |
| **リアルタイム性**         | ストリーミング認識対応。唱えた瞬間にテキスト化できる            |
| **セットアップの簡単さ**   | npmパッケージ追加不要。ブラウザネイティブAPI                    |
| **日本語対応**             | `lang: "ja-JP"` を指定するだけで即利用可                        |
| **プロジェクトとの一貫性** | WebHID APIと同様、ブラウザネイティブAPIを活用する設計方針に合致 |
| **学習コスト**             | シンプルなAPIで短時間で実装開始できる                           |

### 対応ブラウザ

| ブラウザ   | 対応状況                                                   |
| ---------- | ---------------------------------------------------------- |
| Chrome 33+ | ✅ 完全対応（`webkitSpeechRecognition`）                   |
| Edge 79+   | ✅ 完全対応                                                |
| Safari     | ⚠️ 部分対応（`webkitSpeechRecognition`、Siri有効化が必要） |
| Firefox    | ❌ 未対応                                                  |

> **注意:** 本プロジェクトは WebHID API を使用しており、すでに Chrome/Edge 前提です。Web Speech API も同じブラウザで動作するため、対応範囲に問題はありません。

### 制約事項

- **インターネット接続が必要**: Chrome の場合、音声データは Google のサーバーに送信されて処理されます
- **プライバシー**: 音声データがクラウドに送信される点に留意してください
- **マイク許可**: ユーザーにブラウザのマイク許可ダイアログが表示されます（初回のみ）

---

## 3. Web Speech API の基本的な使い方

### 最小限の音声認識コード

```typescript
// SpeechRecognition のインスタンスを作成
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const recognition = new SpeechRecognition();

// ── 基本設定 ──
recognition.lang = "ja-JP"; // 日本語
recognition.continuous = true; // 連続認識（停止するまで認識し続ける）
recognition.interimResults = true; // 中間結果も受け取る

// ── イベントハンドラ ──
recognition.onresult = (event: SpeechRecognitionEvent) => {
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    const transcript = result[0].transcript; // 認識テキスト
    const confidence = result[0].confidence; // 信頼度 (0.0〜1.0)
    const isFinal = result.isFinal; // 確定結果かどうか

    if (isFinal) {
      console.log(`確定: "${transcript}" (信頼度: ${confidence})`);
    } else {
      console.log(`中間: "${transcript}"`);
    }
  }
};

recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
  console.error("音声認識エラー:", event.error, event.message);
};

recognition.onend = () => {
  console.log("音声認識が終了しました");
  // continuous=true でも何らかの理由で止まることがある → 再開処理
};

// ── 開始・停止 ──
recognition.start(); // 認識開始（マイク許可ダイアログが表示される）
// recognition.stop();   // 認識停止
// recognition.abort();  // 認識中断（結果を破棄）
```

### 主要なプロパティ

| プロパティ        | 型        | 説明                                         |
| ----------------- | --------- | -------------------------------------------- |
| `lang`            | `string`  | 認識言語。`"ja-JP"` で日本語                 |
| `continuous`      | `boolean` | `true` で連続認識。`false` だと1文で自動停止 |
| `interimResults`  | `boolean` | `true` で認識途中の中間結果も受け取る        |
| `maxAlternatives` | `number`  | 各結果の候補数（デフォルト: 1）              |

### 主要なイベント

| イベント      | 発火タイミング                       |
| ------------- | ------------------------------------ |
| `result`      | 認識結果が得られたとき（中間・確定） |
| `error`       | エラー発生時                         |
| `end`         | 認識セッション終了時                 |
| `start`       | 認識開始時                           |
| `speechstart` | 音声入力検出時                       |
| `speechend`   | 音声入力終了検出時                   |
| `nomatch`     | 認識できなかったとき                 |

---

## 4. ディレクトリ構造と各ファイルの役割

```
src/features/voice/
├── api/
│   ├── speech-recognition.ts   # Web Speech API のラッパークラス
│   └── useSpeech.ts            # React Hook（UIから使うためのインターフェース）
├── lib/
│   └── spell-matcher.ts        # 呪文マッチングロジック
└── types/
    └── speech.ts               # 型定義
```

### `types/speech.ts` — 型定義

音声認識に関するすべてのデータ構造を定義します。

```typescript
/** 音声認識の状態 */
export type SpeechStatus =
  | "IDLE" // 未開始
  | "LISTENING" // 認識中
  | "ERROR"; // エラー

/** 認識結果の1件 */
export interface SpeechResult {
  transcript: string; // 認識テキスト
  confidence: number; // 信頼度 (0.0〜1.0)
  isFinal: boolean; // 確定結果かどうか
  timestamp: number; // タイムスタンプ
}

/** 呪文定義 */
export interface SpellEntry {
  id: string; // 呪文の一意ID
  name: string; // 呪文名（例: "ルーモス"）
  keywords: string[]; // マッチ対象のキーワード群（表記ゆれ対応）
  action: string; // 発動するアクション（例: "light_on"）
}

/** 呪文マッチング結果 */
export interface SpellMatchResult {
  matched: boolean; // マッチしたかどうか
  spell: SpellEntry | null; // マッチした呪文
  confidence: number; // 一致度
  rawTranscript: string; // 元の認識テキスト
}
```

### `api/speech-recognition.ts` — Web Speech API ラッパー

Web Speech API の `SpeechRecognition` をラップし、型安全な操作を提供するクラスです。Device担当の `joycon-webhid.ts` と同じ設計思想です。

**想定するメソッド:**

| メソッド        | 機能                                                 |
| --------------- | ---------------------------------------------------- |
| `start()`       | 音声認識を開始（マイク許可を要求）                   |
| `stop()`        | 音声認識を停止                                       |
| `isSupported()` | 現在のブラウザが Web Speech API に対応しているか判定 |

**コールバック:**

| コールバック                           | 発火タイミング                       |
| -------------------------------------- | ------------------------------------ |
| `onResult(result: SpeechResult)`       | 認識結果（中間・確定）が得られたとき |
| `onStatusChange(status: SpeechStatus)` | 状態が変化したとき                   |
| `onError(error: string)`               | エラー発生時                         |

### `api/useSpeech.ts` — React Hook

`speech-recognition.ts` をReactコンポーネントから使いやすくラップするカスタムフックです。Device担当の `useJoyCon.ts` と同じパターンです。

```typescript
const {
  status, // SpeechStatus: 現在の状態
  result, // SpeechResult | null: 最新の認識結果
  spellMatch, // SpellMatchResult | null: 最新の呪文マッチング結果
  transcript, // string: 現在の認識テキスト（表示用）
  start, // () => void: 認識開始
  stop, // () => void: 認識停止
} = useSpeech();
```

### `lib/spell-matcher.ts` — 呪文マッチングロジック

認識テキストと呪文辞書を照合し、対応するアクションを決定する純粋関数です。UIに依存しないため、`vitest` で単体テスト可能です。

---

## 5. 実装ステップ

以下の順番で段階的に実装を進めることを推奨します。

### Step 1: 型定義を作る

`src/features/voice/types/speech.ts` に型を定義します。最初にインターフェースを決めることで、他の担当者とのデータ連携がスムーズになります。

### Step 2: Web Speech API ラッパーを実装する

`src/features/voice/api/speech-recognition.ts` に、Web Speech API をラップするクラスを作ります。

**ポイント:**

- `webkitSpeechRecognition` の存在チェック（ブラウザ対応判定）
- `continuous = true` で連続認識
- `interimResults = true` で中間結果も取得
- `onend` イベントで自動再開（ブラウザが勝手に止めることがある）
- エラーハンドリング（`no-speech`, `audio-capture`, `not-allowed` 等）

### Step 3: テスト画面を作る

`src/app/test/voice/page.tsx` にサンドボックスを作り、マイク入力→リアルタイム認識テキスト表示が動くことを確認します（後述の [テスト画面の作り方](#8-テスト画面の作り方) を参照）。

### Step 4: 呪文マッチングロジックを実装する

`src/features/voice/lib/spell-matcher.ts` に呪文辞書と照合ロジックを実装します。`vitest` で単体テストも書きましょう。

### Step 5: React Hook を作る

`src/features/voice/api/useSpeech.ts` に、ラッパーとマッチングロジックを統合するReact Hookを作ります。

### Step 6: テスト画面に呪文認識表示を追加する

テスト画面を拡張し、認識テキストだけでなく呪文マッチング結果（どの呪文にマッチしたか）も表示するようにします。

---

## 6. 呪文マッチングの設計指針

### 呪文辞書の定義

呪文辞書は配列で管理し、`keywords` に表記ゆれ（カタカナ・ひらがな・漢字）を含めます。

```typescript
const SPELL_DICTIONARY: SpellEntry[] = [
  {
    id: "lumos",
    name: "ルーモス",
    keywords: ["ルーモス", "るーもす", "ルモス", "るもす"],
    action: "light_on",
  },
  {
    id: "nox",
    name: "ノックス",
    keywords: ["ノックス", "のっくす", "ノクス"],
    action: "light_off",
  },
  // ... 必要に応じて追加
];
```

### マッチング方法

最も基本的な方法は **部分一致** です:

```typescript
export function matchSpell(
  transcript: string,
  dictionary: SpellEntry[],
): SpellMatchResult {
  const normalized = transcript.trim();

  for (const spell of dictionary) {
    for (const keyword of spell.keywords) {
      if (normalized.includes(keyword)) {
        return {
          matched: true,
          spell,
          confidence: 1.0, // 完全一致
          rawTranscript: transcript,
        };
      }
    }
  }

  return {
    matched: false,
    spell: null,
    confidence: 0,
    rawTranscript: transcript,
  };
}
```

> **発展:** 将来的にはレーベンシュタイン距離や類似度スコアを使ったあいまい一致も検討できます。まずは部分一致で十分に動作します。

### 中間結果 vs 確定結果

- **中間結果 (`isFinal: false`)**: 即時反応が必要な場合に使用。ただし誤認識も多い
- **確定結果 (`isFinal: true`)**: 精度が高い。呪文の発動トリガーには確定結果を使うことを推奨

---

## 7. Device連携（杖の振り＋呪文）

### 統合の考え方

最終的には **「杖の振り（ジェスチャー）＋ 呪文（音声認識）」** の両方が揃って初めて魔法が発動します。ただし、Voice担当とDevice担当が並行開発できるよう、各モジュールは独立して動作するように作ります。

```
[Device: ジェスチャー認識]        [Voice: 呪文認識]
        │                              │
        ▼                              ▼
  GestureResult                  SpellMatchResult
        │                              │
        └──────────┬───────────────────┘
                   ▼
        [統合レイヤー（UI担当 or game担当）]
                   │
                   ▼
        両方が揃ったら → アクション実行
```

### Voice担当がやること

- `useSpeech` フックから `SpellMatchResult` を返すまでの実装
- Device担当やUI担当との型の取り決め（`SpellMatchResult` の形式）

### Voice担当がやらなくて良いこと

- ジェスチャーとの統合ロジック（UI担当 or game担当が実装）
- スマートプラグの操作（IoT担当が実装）

---

## 8. テスト画面の作り方

`src/app/test/voice/page.tsx` にサンドボックス画面を作ります。Device担当の `src/app/test/device/page.tsx` を参考にしてください。

### 最低限含めるべき要素

```
┌─────────────────────────────────────────┐
│  🎙 音声認識テスト                       │
│                                         │
│  [🎤 認識開始] [⏹ 認識停止]              │
│                                         │
│  状態: 🟢 LISTENING                      │
│                                         │
│  ── リアルタイム認識テキスト ──           │
│  「ルーモス」                             │
│                                         │
│  ── 呪文マッチング結果 ──                │
│  ✅ マッチ: ルーモス                     │
│  アクション: light_on                    │
│  信頼度: 0.92                            │
│                                         │
│  ── 認識ログ（履歴） ──                  │
│  15:30:01 [確定] ルーモス (0.92)         │
│  15:29:58 [中間] るーも                  │
│  15:29:55 [中間] る                      │
└─────────────────────────────────────────┘
```

### 重要なポイント

- `"use client"` ディレクティブを忘れずに（ブラウザAPIを使うため）
- マイク許可の状態をUIに表示する
- エラー時のメッセージを分かりやすく表示する（非対応ブラウザ、マイク拒否など）
- `continuous = true` による長時間認識時、ブラウザが自動停止した場合の再開処理

---

## 9. 参考資料

| 資料                           | URL                                                                     |
| ------------------------------ | ----------------------------------------------------------------------- |
| MDN - Web Speech API           | https://developer.mozilla.org/ja/docs/Web/API/Web_Speech_API            |
| MDN - SpeechRecognition        | https://developer.mozilla.org/ja/docs/Web/API/SpeechRecognition         |
| MDN - SpeechRecognitionEvent   | https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionEvent |
| Chrome - Web Speech API デモ   | https://www.google.com/intl/en/chrome/demos/speech.html                 |
| Can I use - Speech Recognition | https://caniuse.com/speech-recognition                                  |
| Device担当の実装（参考）       | `src/features/device/` 配下のコード                                     |
| Joy-Con IR技術解説（参考）     | `docs/joycon-ir-technical-guide.md`                                     |
