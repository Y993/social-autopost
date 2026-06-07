// post.mjs — キャンペーンのキューから次の未投稿スレッドを1件投稿する。
// 環境変数:
//   THREADS_TOKEN   必須（DRY_RUN時は不要）
//   CAMPAIGN        既定 "aws-saa"
//   IMAGE_BASE_URL  既定 "https://y993.github.io/social-autopost"（Pages公開ベース）
//   DRY_RUN         "true"/"1" で実投稿せず計画のみ表示
//   INITIAL_WAIT_MS コンテナ作成→公開の追加待機(ms)。既定0（publish側でstatusポーリング）

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { nextUnposted, markPosted, resolvePosts, validateThread } from './queue.mjs';
import { postThread } from './threads.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAMPAIGN = process.env.CAMPAIGN || 'aws-saa';
const IMAGE_BASE_URL = process.env.IMAGE_BASE_URL || 'https://y993.github.io/social-autopost';
const DRY_RUN = ['1', 'true', 'yes'].includes(String(process.env.DRY_RUN).toLowerCase());
const INITIAL_WAIT_MS = Number(process.env.INITIAL_WAIT_MS || 0);

const campDir = join(ROOT, 'campaigns', CAMPAIGN);
const queuePath = join(campDir, 'queue.json');
const statePath = join(campDir, 'state.json');

async function readJson(p, fallback) {
  try { return JSON.parse(await readFile(p, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT' && fallback !== undefined) return fallback; throw e; }
}

async function main() {
  const queue = await readJson(queuePath);
  const state = await readJson(statePath, { posted: [] });

  const thread = nextUnposted(queue, state);
  if (!thread) { console.log(`[${CAMPAIGN}] キューに未投稿なし。終了。`); return; }

  const errs = validateThread(thread);
  if (errs.length) throw new Error(`スレッド検証エラー:\n- ${errs.join('\n- ')}`);

  const posts = resolvePosts(thread, { imageBaseUrl: IMAGE_BASE_URL, campaign: CAMPAIGN });
  console.log(`[${CAMPAIGN}] 投稿対象: ${thread.id}（${posts.length}投稿）`);
  posts.forEach((p, i) => {
    console.log(`  [${i + 1}] ${p.imageUrl ? `IMAGE ${p.imageUrl}\n      ` : 'TEXT '}${p.text.replace(/\n/g, ' / ')}`);
  });

  if (DRY_RUN) { console.log('DRY_RUN: 実投稿はスキップしました。'); return; }

  const token = process.env.THREADS_TOKEN;
  if (!token) throw new Error('THREADS_TOKEN が未設定です。');

  const ids = await postThread(token, posts, { initialWaitMs: INITIAL_WAIT_MS, log: (m) => console.log(m) });
  console.log(`投稿成功: media ids = ${ids.join(', ')}`);

  const next = markPosted(state, thread.id);
  await writeFile(statePath, JSON.stringify(next, null, 2) + '\n', 'utf8');
  console.log(`state 更新: posted = [${next.posted.join(', ')}]`);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
