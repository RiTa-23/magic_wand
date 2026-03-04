# Magic Wand

## 🛠 使用技術

このプロジェクトは以下のツールを使用してモダンで高速な開発環境を構築しています。

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Package Manager / Runtime**: [Bun](https://bun.sh/)
- **Environment Management**: [Devbox](https://www.jetpack.io/devbox)
- **Linter**: [oxlint](https://oxc.rs/docs/guide/usage/linter.html)
- **Formatter**: [Prettier](https://prettier.io/)
- **Test Runner**: [Vitest](https://vitest.dev/)
- **AI Code Review**: [CodeRabbit](https://coderabbit.ai/)

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
