# ダイエット Threads 自動投稿システム

AIでダイエット系の **Threads** 投稿（テキスト中心・連投対応）を生成し、
**人が確認・承認してから予約投稿**するワークフロー型のシステムです。

```
[フォーマット選択 + お題]
   ↓ Claude API で本文・連投・タグを自動生成
   ↓ 管理画面で下書きを確認・編集
   ↓ 承認 / 予約 / 却下
   ↓ 予約時刻にワーカーが Threads API で自動投稿
```

## 特徴

- **ダイエット特化**の生成プロンプト（痩せる習慣・NG食品・食事例・ビフォーアフター等）
- **テキスト中心** + 連投（スレッド）チェーンに対応
- **生成 → 承認 → 予約投稿** の安全なワークフロー（勝手に投稿しない）
- Threads 1投稿500字の上限チェック付きエディタ
- SQLite（Prisma）でローカル完結、追加インフラ不要

## 技術構成

| レイヤー | 技術 |
|---|---|
| フロント/API | Next.js 15 (App Router) + React 19 |
| 生成 | Claude API (`@anthropic-ai/sdk`) |
| 投稿 | Threads Graph API |
| DB | SQLite + Prisma |
| 予約実行 | 常駐ワーカー (`npm run worker`) |

## セットアップ

### 1. 依存インストール

```bash
npm install
```

### 2. 環境変数

```bash
cp .env.example .env
```

`.env` を編集して以下を設定します。

- `ANTHROPIC_API_KEY` … [Anthropic Console](https://console.anthropic.com/) で取得
- `THREADS_USER_ID` / `THREADS_ACCESS_TOKEN` … 下記「Threads API の準備」参照

### 3. データベース初期化

```bash
npm run db:push
```

### 4. 起動

```bash
# 管理画面 (http://localhost:3000)
npm run dev

# 別ターミナルで予約投稿ワーカー
npm run worker
```

## Threads API の準備

Threads への自動投稿には Meta の公式 Threads API を使います。

1. [Meta for Developers](https://developers.facebook.com/) でアプリを作成
2. **Threads API** のユースケースを追加し、権限
   `threads_basic`, `threads_content_publish` をリクエスト
3. Threads アカウントで認可し、**長期アクセストークン**（60日有効）を取得
4. 自分の Threads ユーザーID（数字）を取得
5. `.env` の `THREADS_USER_ID` / `THREADS_ACCESS_TOKEN` に設定

> 参考: https://developers.facebook.com/docs/threads/get-started
>
> - 投稿上限: 24時間あたり250件
> - アクセストークンは60日で失効するため定期的な更新（refresh）が必要です

`http://localhost:3000/settings` で接続状態を確認できます。

## 使い方

1. トップ画面でフォーマットとお題を選び「AIで下書きを生成」
2. 生成された下書きをクリックして本文・連投・タグを確認・編集
3. 問題なければ
   - **承認 (投稿待ち)** … 承認だけしておく
   - **今すぐ投稿** … その場で Threads に公開
   - **予約** … 日時を指定してワーカーに任せる
4. ワーカーが予約時刻を過ぎた投稿を自動で公開します

## フォーマットのカスタマイズ

生成スタイルや投稿の「型」は `src/lib/prompts/diet.ts` で定義しています。
`DIET_FORMATS` に型を追加・編集し、`DIET_SYSTEM_PROMPT` でトーンを調整できます。
「やりたい型」の投稿例があれば、ここに落とし込めます。

## 注意事項

- 健康・ダイエットに関する誇大・断定表現を避ける方針をプロンプトに組み込んでいますが、
  **公開前に必ず人が内容を確認**してください。
- Threads/Meta の利用規約・API規約・レート制限を遵守してください。
- アクセストークンなどの秘密情報は `.env` に置き、コミットしないでください（`.gitignore` 済み）。
