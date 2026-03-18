# Magic Wand

## 📖 プロダクト概要

**Magic Wand** は、「音声による呪文詠唱」と「杖のジェスチャー」を組み合わせて、スマートホームデバイスを魔法のように操作する体験型Webアプリケーションです。

### コンセプト

ユーザーは魔法使いになりきり、呪文を唱えながら杖を振ることで、部屋の照明や家電を操作できます。音声とジェスチャーの両方が揃った時だけ魔法が発動する仕様により、誤作動を防ぎつつ没入感のある体験を実現しています。

### 入力方式

| 入力 | デバイス | 説明 |
| --- | --- | --- |
| 音声認識 | マイク（Web Speech API） | 日本語の呪文を認識（あいまい一致対応） |
| ジェスチャー（IMU） | Nintendo Joy-Con（WebHID） | ジャイロセンサーで杖の動き（V字/M字）を判定 |
| ジェスチャー（カメラ） | Webカメラ（ONNX/YOLOv8-pose） | 杖先のポーズ推定から軌跡を判定 |

### 魔法発動の仕組み（インテントゲート）

1. **音声認識** — 呪文の詠唱を検出・照合（信頼度 ≥ 0.8）
2. **ジェスチャー認識** — 杖の軌跡からV字/M字を判定（信頼度 ≥ 0.7）
3. **照合** — 呪文に対応するジェスチャーが 7秒以内に揃えば発動
4. **実行** — TP-Link Tapoスマートプラグの制御 or Phomemoプリンターで印刷

### 連携デバイス

| デバイス | 接続方式 | 用途 |
| --- | --- | --- |
| Nintendo Joy-Con | WebHID | ジャイロによるジェスチャー入力 |
| TP-Link Tapo P300 | Wi-Fi（API） | 4ポートスマート電源タップの制御 |
| Phomemo M02S | Web Bluetooth | おみくじの感熱印刷 |

---

## 🛠 使用技術

### フレームワーク・ランタイム

| 技術 | 用途 |
| --- | --- |
| [Next.js](https://nextjs.org/) (App Router) | Reactフレームワーク |
| [TypeScript](https://www.typescriptlang.org/) | 型付き言語 |
| [React](https://react.dev/) 19 | UIライブラリ |
| [Bun](https://bun.sh/) | パッケージマネージャ / ランタイム |
| [Devbox](https://www.jetpack.io/devbox) | 開発環境管理 |

### 開発ツール

| 技術 | 用途 |
| --- | --- |
| [Vitest](https://vitest.dev/) | テストランナー |
| [oxlint](https://oxc.rs/docs/guide/usage/linter.html) | Linter |
| [Prettier](https://prettier.io/) | Formatter |
| [GitHub Actions](https://github.co.jp/features/actions) | CI/CD |
| [CodeRabbit](https://coderabbit.ai/) | AIコードレビュー |
| [Babel React Compiler](https://react.dev/learn/react-compiler) | React最適化コンパイラ |

### UI・スタイリング

| 技術 | 用途 |
| --- | --- |
| [Tailwind CSS](https://tailwindcss.com/) v4 | CSSフレームワーク |
| [Lucide React](https://lucide.dev/) | アイコンライブラリ |
| [next-themes](https://github.com/pacocoursey/next-themes) | テーマ管理 |
| Google Fonts (Cinzel, Cormorant Garamond, MedievalSharp, Geist) | フォント |

### AI/ML・画像認識

| 技術 | 用途 |
| --- | --- |
| [ONNX Runtime Web](https://onnxruntime.ai/) | 杖検出モデル推論 (YOLOv8-pose) |
| 独自実装 | ジェスチャー認識（軌跡の方向転換回数ベース） |

### ブラウザAPI

| 技術 | 用途 |
| --- | --- |
| [Web Speech API](https://developer.mozilla.org/ja/docs/Web/API/Web_Speech_API) | 音声認識（日本語） |
| [WebHID API](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API) | Joy-Con接続 |
| [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) | Phomemo M02Sプリンター接続 |
| [getUserMedia API](https://developer.mozilla.org/ja/docs/Web/API/MediaDevices/getUserMedia) | カメラ映像取得 |

### IoT連携

| 技術 | 用途 |
| --- | --- |
| [tp-link-tapo-connect](https://github.com/dickydoouk/tp-link-tapo-connect) | TP-Link Tapoスマートプラグ制御 |

---

## 🚀 初回セットアップ・環境構築手順

このプロジェクトでは **Devbox** を用いてチーム全員が全く同じバージョンのツール（Bun, oxlint, Prettier など）を使えるようにしています。特別なインストール作業は不要です。

### 1. Devbox の準備

OSに合わせて Devbox をインストールしてください。

#### 🍏 Mac / Linux の場合

ターミナルを開き、以下のコマンドを実行します。

```bash
curl -fsSL https://get.jetpack.io/devbox | bash
```

#### 🪟 Windows の場合

Windowsでは **WSL2 (Windows Subsystem for Linux 2)** 環境が必須になります。

1. WSL2（Ubuntu など）をインストールして起動する
2. **WSL2のターミナル上** で以下のコマンドを実行する

```bash
curl -fsSL https://get.jetpack.io/devbox | bash
```

_(※通常の PowerShell やコマンドプロンプトでは動作しません)_

### 2. リポジトリのクローン

ターミナルで適当な作業ディレクトリへ移動し、本リポジトリをクローンして中に入ります。

```bash
git clone https://github.com/RiTa-23/magic_wand.git
cd magic_wand
```

### 3. プロジェクトの起動

ディレクトリ内で以下のコマンドを実行するだけです。

```bash
devbox shell
```

**✅ これだけで完了です！**
初回起動時に自動で依存パッケージのインストール（`bun install`）が行われます。

---

## 💻 開発で使う主要コマンド

`devbox shell` で入った環境内（または `devbox run` を使って外側から）で以下のコマンドが使用できます。

| コマンド                  | 説明                                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| `devbox run dev`          | ローカル開発サーバーを起動する (`bun run dev`)                        |
| `devbox run check`        | Lint, Format, Test の **全チェックを一括で実行する** (コミット前推奨) |
| `devbox run lint`         | oxlint を使ってコードの静的解析を行う                                 |
| `devbox run format:check` | Prettier でフォーマット違反がないかチェックする                       |
| `devbox run format:fix`   | Prettier でコードを自動整形（修正）する                               |
| `devbox run test`         | Vitest でテストを実行する                                             |
| `devbox run setup`        | パッケージの再インストール (`bun install`) などを手動で行う           |
