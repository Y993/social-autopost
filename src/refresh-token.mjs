// refresh-token.mjs — 長期トークンを更新し、新トークンだけを stdout に出力する。
// ワークフローがこの出力を受け取り、マスクして `gh secret set THREADS_TOKEN` に渡す。
// 進捗・有効期限は stderr に出す（stdout を汚さない）。

import { refreshToken } from './threads.mjs';

const token = process.env.THREADS_TOKEN;
if (!token) { console.error('THREADS_TOKEN が未設定です。'); process.exit(1); }

try {
  const { accessToken, expiresIn } = await refreshToken(token);
  const days = expiresIn ? Math.round(expiresIn / 86400) : '?';
  console.error(`トークンを更新しました（有効期限 約${days}日）。`);
  process.stdout.write(accessToken); // stdout は新トークンのみ
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}
