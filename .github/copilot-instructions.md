# Copilot Instructions — office-to-md-mcp

---

## 1. 前提条件

- 回答は必ず **日本語** で行ってください。
- 大規模な変更（目安: 200 行以上）を行う前には、まず変更計画を提案してレビューを受けてください。
- 既存のコードスタイル・命名規則に従ってください。既存パターンと異なるコードを生成しないでください。
- コミットメッセージは英語で、簡潔に書いてください（例: `fix: handle empty sheet in excelExtractor`）。

---

## 2. アプリの概要

**office-to-md-mcp** は、Office ドキュメント（Excel / Word）および PDF を画像や Markdown に変換するための **MCP（Model Context Protocol）サーバー** です。

### 主な目的

- LLM アプリケーション（Claude Desktop、GitHub Copilot など）がドキュメントの内容を読み取れるようにする。
- Office / PDF ファイルをページ単位の PNG 画像に変換する。
- テキスト抽出や、GitHub Copilot SDK を利用した画像→Markdown 変換を提供する。

### 提供する MCP ツール（6 つ）

| ツール名 | 機能 |
|---|---|
| `convert_excel_to_images` | Excel → PDF → PNG 画像に変換 |
| `convert_word_to_images` | Word → PDF → PNG 画像に変換 |
| `convert_pdf_to_images` | PDF → PNG 画像に変換 |
| `extract_excel_text` | Excel → 画像 → Copilot SDK で Markdown 化 |
| `extract_word_text` | Word (.docx) → テキスト / Markdown 抽出 |
| `get_capabilities` | ランタイム依存ツールの検出状況を返す |

---

## 3. 技術スタック

| カテゴリ | 技術 | バージョン |
|---|---|---|
| ランタイム | Node.js | >= 18 |
| 言語 | TypeScript（strict モード） | ^5.3 |
| モジュール方式 | CommonJS | — |
| MCP フレームワーク | `@modelcontextprotocol/sdk` | ^1.0.0 |
| AI 連携 | `@github/copilot-sdk` | ^0.2.0 |
| Excel 読み取り | `exceljs` | ^4.4.0 |
| Word 読み取り | `mammoth` | ^1.7.0 |
| バリデーション | `zod` | ^3.22.4 |
| テスト | Jest + ts-jest | ^29.7 / ^29.1 |
| リンター | ESLint + @typescript-eslint | ^8.0 / ^7.0 |
| システム依存 | LibreOffice (`soffice`)、poppler-utils (`pdftoppm`)、ImageMagick (`convert`)、Python 3 + UNO | — |

> **注意**: プロジェクトで使用していないライブラリを `import` しないでください。上記の依存関係のみを使用してください。

---

## 4. ディレクトリ構成

```
.
├── src/
│   ├── server.ts              # MCP サーバーのエントリポイント（ツール登録・stdio 接続）
│   ├── services/              # ビジネスロジック層
│   │   ├── capabilityDetector.ts   # ランタイム依存ツール検出
│   │   ├── copilotCli.ts          # Copilot SDK による画像→Markdown 変換
│   │   ├── excelExtractor.ts      # ExcelJS によるデータ抽出・Markdown テーブル生成
│   │   ├── fileType.ts            # ファイル拡張子による種別判定
│   │   ├── libreOfficeCli.ts      # LibreOffice CLI による PDF 変換
│   │   ├── officePythonBridge.ts  # Python UNO ヘルパー経由の Excel→PDF 変換
│   │   ├── pdfRenderer.ts         # PDF→PNG レンダリング（pdftoppm / convert）
│   │   ├── tempFiles.ts           # 一時ファイル管理・自動クリーンアップ
│   │   └── wordExtractor.ts       # mammoth による Word テキスト抽出
│   ├── tools/                 # MCP ツール実装（services を組み合わせるオーケストレーション層）
│   │   ├── convertExcelToImages.ts
│   │   ├── convertPdfToImages.ts
│   │   ├── convertWordToImages.ts
│   │   └── extractExcelText.ts
│   ├── types/                 # 型定義・スキーマ
│   │   ├── errors.ts              # AppError クラス・ErrorCode enum
│   │   └── toolSchemas.ts         # Zod バリデーションスキーマ
│   └── utils/                 # 汎用ユーティリティ
│       ├── exec.ts                # 子プロセス実行ラッパー（タイムアウト付き）
│       ├── fs.ts                  # ファイルシステムヘルパー
│       └── logger.ts              # ログユーティリティ（stderr 出力）
├── test/                      # テストスイート
│   ├── integration/               # 統合テスト（実ツール必要、なければスキップ）
│   └── *.test.ts                  # ユニットテスト（モック使用）
├── python/                    # Python UNO ヘルパースクリプト
├── dist/                      # ビルド出力（git 管理外）
├── package.json
├── tsconfig.json
└── jest.config.js
```

### 配置ルール

- **新しいサービス** → `src/services/` に配置
- **新しい MCP ツール** → `src/tools/` に配置し、`src/server.ts` に登録
- **型定義・スキーマ** → `src/types/` に配置
- **汎用ヘルパー** → `src/utils/` に配置
- **テスト** → `test/` 直下にユニットテスト、`test/integration/` に統合テスト

---

## 5. アーキテクチャ・設計指針

### レイヤー構成

```
server.ts（エントリポイント）
  └─ tools/（オーケストレーション層）
       └─ services/（ビジネスロジック層）
            └─ utils/（汎用ユーティリティ層）
```

- **上位レイヤーは下位レイヤーのみを呼び出す**。逆方向の依存は禁止。
- `tools/` は `services/` を組み合わせてワークフローを実装する薄い層。ビジネスロジックを直接書かない。
- `services/` は単一責務。1 つのサービスが 1 つの外部ツールまたは機能を担当する。

### エラーハンドリング

- すべてのドメインエラーは `AppError`（`src/types/errors.ts`）を使用する。
- `ErrorCode` enum でエラー種別を分類する。
- 外部ツールの `ENOENT` エラーは対応する `*_NOT_FOUND` コードにマッピングする。
- ツール層（`tools/`）で一時ファイルのクリーンアップを `finally` ブロックで確実に行う。

### 非同期処理

- すべての I/O 操作は `async/await` を使用する。
- 外部プロセス呼び出しにはタイムアウトを設定する（デフォルト: 120 秒〜300 秒）。
- タイムアウト時は `SIGKILL` でプロセスを強制終了する。

### バリデーション

- MCP ツールの入力は `zod` スキーマ（`src/types/toolSchemas.ts`）で検証する。
- 新しいツールを追加する場合は、必ず対応する Zod スキーマを定義する。

### グレースフルデグラデーション

- `capabilityDetector.ts` が実行時にシステムツールの有無を検出する。
- Python UNO が使えなければ LibreOffice CLI にフォールバックする。
- `pdftoppm` が使えなければ ImageMagick `convert` にフォールバックする。
- 依存ツールが見つからない場合はエラーコード付きの `AppError` を返す。

---

## 6. テスト方針

### フレームワーク・設定

- **Jest** + **ts-jest** を使用。
- テストファイルは `test/**/*.test.ts` に配置（`jest.config.js` で設定済み）。
- ローカル `.js` インポートは `moduleNameMapper` で `.ts` ソースに解決される。

### 実行コマンド

```bash
npm test          # 全テスト実行
npm run typecheck # 型チェック（tsc --noEmit）
npm run build     # ビルド（tsc）
```

### テストの書き方

- **ユニットテスト**: `test/` 直下に `<モジュール名>.test.ts` として配置。
  - 命名規則: `services.capabilityDetector.test.ts`、`tools.convertExcelToImages.test.ts` など。
  - 外部依存（ファイルシステム、子プロセス、外部ライブラリ）はすべて `jest.mock()` でモックする。
  - テストは独立して実行可能であること。グローバル状態に依存しない。
- **統合テスト**: `test/integration/` に配置。
  - 実際のシステムツール（LibreOffice、pdftoppm 等）が必要。
  - ツールがインストールされていない環境ではスキップされる（`commandExists()` でチェック）。

### 新しいコードを追加する際のルール

- 新しいサービスやツールには対応するユニットテストを必ず作成する。
- 既存テストのパターン（モック手法、アサーション形式）に合わせる。

---

## 7. アンチパターン（禁止事項）

### コーディング全般

- **`any` 型の使用禁止**: TypeScript strict モードを有効にしており、`any` は原則使用しない。やむを得ない場合は `unknown` を使い、型ガードで絞り込む。
- **`default export` の禁止**: すべてのモジュールは named export を使用する。
- **`console.log` / `console.error` の直接使用禁止**: ログ出力は `src/utils/logger.ts` の `logger` を使用する。
- **同期的なファイル I/O の禁止**: `fs.readFileSync` 等は使わず、必ず非同期版を使用する。

### アーキテクチャ

- **レイヤーの逆転禁止**: `services/` が `tools/` を呼び出してはならない。`utils/` が `services/` を呼び出してはならない。
- **ツール層にビジネスロジックを書かない**: `tools/` はサービスの呼び出しとエラーハンドリング・クリーンアップのみ。
- **未使用のライブラリを `import` しない**: `package.json` に記載されていない外部ライブラリを勝手に追加しない。

### テスト

- **テストなしのコード追加禁止**: 新しい機能を追加する場合は、必ず対応するテストを作成する。
- **統合テストでモックを使わない**: 統合テストは実際のシステムツールで検証する。ツールが無い環境ではスキップする。
- **既存テストの削除・無効化禁止**: 不要になった場合を除き、既存テストを削除したりスキップしたりしない。
