# セットアップ手順（初回のみ）

これを一度やれば、以降は GitHub Actions が毎日自動投稿し、トークンも毎週自動更新します。
所要 15〜30分。**自分のThreadsアカウントへ自分で投稿するだけなら、Metaのアプリ審査(App Review)は不要**です。

---

## 0. 前提
- 投稿先の **Threads アカウント**（無ければ threads.net で作成）。
- このコードを push した **GitHub リポジトリ**（既定 `Y993/social-autopost`、public）。

## 1. Meta 開発者アプリを作る
1. https://developers.facebook.com/ にThreadsと同じMetaアカウントでログイン → 右上 **My Apps** → **Create App**。
2. ユースケースで **「Access the Threads API」** を選んで作成（無ければ App 作成後に製品/ユースケースから Threads を追加）。
3. アプリの **Threads ユースケース設定**を開く：
   - **権限(permissions)** に `threads_basic` と `threads_content_publish` を追加。
   - **Threads アカウントを接続**（自分のアカウントをテスター/所有者として連携）。
4. アプリ設定 → **App secret（アプリシークレット）** を控える（後で長期トークン交換に使用）。

## 2. アクセストークンを取得して「長期トークン」に交換
1. Threads ユースケース設定の画面で、接続した Threads ユーザーの **短期トークンを生成（Generate token）**。
   （`threads_basic` と `threads_content_publish` にチェックが入った状態で発行すること）
2. その短期トークンを **長期トークン(60日)** に交換する。ローカルのターミナルで（`<...>` を置換）：
   ```bash
   curl -s "https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=<APP_SECRET>&access_token=<SHORT_LIVED_TOKEN>"
   ```
   返ってくる JSON の `access_token` が **長期トークン**。これを次で登録します。
   - 動作確認（任意）：`curl -s "https://graph.threads.net/v1.0/me?fields=id,username&access_token=<LONG_TOKEN>"` で自分のユーザー名が返ればOK。

## 3. GitHub に Secrets を2つ登録
リポジトリ → **Settings → Secrets and variables → Actions → New repository secret**。

| Name | 値 |
|---|---|
| `THREADS_TOKEN` | 手順2で得た**長期トークン** |
| `GH_PAT` | 下記のPAT（トークン自動更新の書き戻し用） |

**GH_PAT の作り方**（Fine-grained token）：
GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token
- Repository access: **Only select repositories → `social-autopost`**
- Repository permissions: **Secrets = Read and write**（他は既定でOK）
- 生成された値を `GH_PAT` として登録。

## 4. GitHub Pages を有効化（画像配信用）
リポジトリ → **Settings → Pages** → Build and deployment：
- Source: **Deploy from a branch**、Branch: **main** / **/(root)** → Save。
- 数分後、`https://y993.github.io/social-autopost/campaigns/aws-saa/images/q1.png` が開ければOK。
  （`post.yml` の `IMAGE_BASE_URL` はこのドメイン前提。リポジトリ名/ユーザー名を変えたら合わせて修正）

## 5. テスト投稿 → 本番
リポジトリ → **Actions → 「Post to Threads」 → Run workflow**：
1. まず **dry_run = true** で実行 → ログに「投稿対象 saa-001（2投稿）」と画像URLが出れば配線OK（実投稿なし）。
2. 次に **dry_run = false** で実行 → 実際に Threads へ問題→解答が連投される。アプリで確認。
3. 以降は毎日 12:00(JST) に1スレッドずつ自動投稿。`state.json` が進む。

## 6. トークン更新（自動）
- `refresh-token.yml` が毎週 月曜に長期トークンを更新し `THREADS_TOKEN` を書き戻します（手動実行も可）。
- **60日に一度も更新が走らないと失効**するので、週次cronは止めないこと。失効したら手順2をやり直し。

---

## トラブルシュート
- `(#10) Application does not have permission` → 権限 `threads_content_publish` 未付与。手順1-3を確認。
- 画像が反映されない / `image_url` エラー → Pages が未公開、URLが間違い、または非公開。手順4のURLをブラウザで確認。
- `gh secret set` が失敗 → `GH_PAT` の Secrets 権限不足。手順3のPAT権限を確認。
- レート上限 → 250投稿/24h。通常運用では到達しない。
