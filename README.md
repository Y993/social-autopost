# social-autopost

資格・アフィリエイト発信の **Threads 自動投稿** システム。
GitHub Actions の cron で、キャンペーンごとの投稿キューから **未投稿の1スレッドを毎日自動投稿**する。
1スレッド＝「問題画像 → 解答画像（返信）→ 任意の導線（返信）」の連投。長期トークンは別 cron で自動更新。

> 初回だけ手動セットアップが必要です → **[SETUP.md](SETUP.md)** を参照。

## 仕組み

```
campaigns/<name>/queue.json   投稿キュー（スレッドの配列）
campaigns/<name>/state.json   投稿済み管理（posted: [...]）
campaigns/<name>/images/*.png カード画像（GitHub Pages で公開配信）
src/threads.mjs               Threads Graph API クライアント（作成→公開、返信、トークン更新）
src/queue.mjs                 純ロジック（次の未投稿選択・URL生成・検証）＋ queue.test.mjs
src/post.mjs                  毎日の投稿エントリポイント
src/refresh-token.mjs         トークン更新エントリポイント
.github/workflows/post.yml          毎日 03:00 UTC(=12:00 JST) に1スレッド投稿
.github/workflows/refresh-token.yml 毎週 月曜にトークン更新
```

- **画像ホスティング**: 本リポジトリの GitHub Pages。例 `https://y993.github.io/social-autopost/campaigns/aws-saa/images/q1.png`。Threads API は `image_url` に公開URLを要求するためこれで満たす。
- **トークン**: 長期トークン(60日)を `THREADS_TOKEN` シークレットに保管。`refresh-token.yml` が毎週更新し `gh secret set` で書き戻す（`GH_PAT` 使用）。
- **投稿の進行**: `post.mjs` が `state.json` を見て次の1件を投稿し、成功したら state を更新して push。次回はその次の1件。

## Threads API（要点）
- ベース `https://graph.threads.net/v1.0`。2段階：`POST /me/threads`（コンテナ作成）→ `POST /me/threads_publish`（公開）。
- テキスト上限 **500字**。画像は `image_url`（公開URL）必須。返信は `reply_to_id`。レート上限 250投稿/24h。
- 長期トークン更新：`GET /refresh_access_token?grant_type=th_refresh_token`。

## 新しいキャンペーン（別アフィ発信）を足す
1. `campaigns/<新名>/` を作り、`images/` に画像、`queue.json` にスレッド、`state.json` に `{"posted":[]}` を置く。
2. 投稿時に `CAMPAIGN=<新名>` を指定（`post.yml` の `workflow_dispatch` 入力 or 既定値を変更／別ワークフロー複製）。
3. コードは触らず、データ追加だけで増やせる。

## ローカル開発
```bash
npm test                 # 純ロジックのユニットテスト（node --test）
DRY_RUN=true node src/post.mjs   # 実投稿せず次の投稿計画を表示（PowerShell: $env:DRY_RUN='true'; node src/post.mjs）
```

## キュー（queue.json）の形
```json
[
  { "id": "saa-001",
    "posts": [
      { "text": "問題本文…", "image": "images/q1.png" },
      { "text": "解答本文…", "image": "images/a1.png" }
    ] }
]
```
先頭が親投稿、以降は直前への返信として連投される。`image` は `campaigns/<name>/` 相対。
3つ目に `{ "text": "…導線… 🔗 https://…" }` を足せば note/サイト誘導の返信になる（任意）。
