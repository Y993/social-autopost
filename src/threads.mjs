// threads.mjs — Threads Graph API クライアント（Node 18+ の global fetch を使用、依存なし）
// 公式: https://developers.facebook.com/docs/threads/posts
//   作成 POST /me/threads → 公開 POST /me/threads_publish の2段階。
//   画像は image_url（公開URL）必須。返信は reply_to_id。テキスト上限500字。

const GRAPH = 'https://graph.threads.net/v1.0';
const ROOT = 'https://graph.threads.net'; // token系はバージョンなし

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readBody(res) {
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
}

async function apiPost(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const body = await readBody(res);
  if (!res.ok) throw new Error(`POST ${url.split('?')[0]} -> ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function apiGet(url) {
  const res = await fetch(url);
  const body = await readBody(res);
  if (!res.ok) throw new Error(`GET ${url.split('?')[0]} -> ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

/** 投稿コンテナを作成し creation id を返す。 */
export async function createContainer(token, { text = '', imageUrl, replyToId } = {}) {
  const params = { access_token: token, text };
  if (imageUrl) { params.media_type = 'IMAGE'; params.image_url = imageUrl; }
  else { params.media_type = 'TEXT'; }
  if (replyToId) params.reply_to_id = replyToId;
  const body = await apiPost(`${GRAPH}/me/threads`, params);
  if (!body.id) throw new Error(`createContainer: id が返らない: ${JSON.stringify(body)}`);
  return body.id;
}

/** コンテナの status を取得（IN_PROGRESS / FINISHED / ERROR / EXPIRED / PUBLISHED）。 */
export async function getStatus(token, containerId) {
  const url = `${GRAPH}/${containerId}?fields=status,error_message&access_token=${encodeURIComponent(token)}`;
  return apiGet(url);
}

/** FINISHED になるまで待ってから公開し、公開された media id を返す。 */
export async function publish(token, creationId, { pollMs = 6000, maxPolls = 12, log = () => {} } = {}) {
  for (let i = 0; i < maxPolls; i++) {
    const st = await getStatus(token, creationId);
    if (st.status === 'FINISHED') break;
    if (st.status === 'ERROR' || st.status === 'EXPIRED') {
      throw new Error(`container ${creationId} status=${st.status}: ${st.error_message ?? ''}`);
    }
    log(`  container ${creationId} status=${st.status} … wait ${pollMs}ms (${i + 1}/${maxPolls})`);
    await sleep(pollMs);
  }
  const body = await apiPost(`${GRAPH}/me/threads_publish`, { access_token: token, creation_id: creationId });
  if (!body.id) throw new Error(`publish: id が返らない: ${JSON.stringify(body)}`);
  return body.id;
}

/**
 * posts（[{text, imageUrl?}, ...]）を上から順に投稿する。
 * 2件目以降は直前に公開した投稿への返信（reply_to_id）として連投する。
 * 公開された media id の配列を返す。
 */
export async function postThread(token, posts, { initialWaitMs = 0, log = () => {} } = {}) {
  const ids = [];
  let replyToId;
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    log(`post ${i + 1}/${posts.length}${replyToId ? ` (reply to ${replyToId})` : ''}${p.imageUrl ? ' [image]' : ''}`);
    const containerId = await createContainer(token, { text: p.text, imageUrl: p.imageUrl, replyToId });
    if (initialWaitMs) await sleep(initialWaitMs);
    const mediaId = await publish(token, containerId, { log });
    ids.push(mediaId);
    replyToId = mediaId;
  }
  return ids;
}

/** 長期トークンを更新し、新トークンと有効期限(秒)を返す。 */
export async function refreshToken(token) {
  const url = `${ROOT}/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(token)}`;
  const body = await apiGet(url);
  if (!body.access_token) throw new Error(`refreshToken: access_token が返らない: ${JSON.stringify(body)}`);
  return { accessToken: body.access_token, expiresIn: body.expires_in };
}
