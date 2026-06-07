// queue.mjs — 投稿キューの純粋ロジック（ネットワーク・I/Oなし＝テスト可能）

/** state.posted に未掲載の最初のスレッドを返す。無ければ null。 */
export function nextUnposted(queue, state) {
  const posted = new Set(state?.posted ?? []);
  return queue.find((t) => !posted.has(t.id)) ?? null;
}

/** state に id を追記した新しい state を返す（重複は追加しない）。 */
export function markPosted(state, id) {
  const posted = state?.posted ?? [];
  if (posted.includes(id)) return { ...state, posted };
  return { ...state, posted: [...posted, id] };
}

/** campaign 相対の画像パスを公開URLに変換する。 */
export function imageUrlFor(imageBaseUrl, campaign, relPath) {
  const base = String(imageBaseUrl).replace(/\/+$/, '');
  const rel = String(relPath).replace(/^\/+/, '');
  return `${base}/campaigns/${campaign}/${rel}`;
}

/**
 * スレッドの posts を、投稿可能な形（text と任意の imageUrl）に解決する。
 * image フィールドがあれば公開URLへ変換する。
 */
export function resolvePosts(thread, { imageBaseUrl, campaign }) {
  return (thread.posts ?? []).map((p) => ({
    text: p.text ?? '',
    imageUrl: p.image ? imageUrlFor(imageBaseUrl, campaign, p.image) : undefined,
  }));
}

/** Threads のテキスト上限(500字)を超える post が無いか検証。問題があれば配列で返す。 */
export function validateThread(thread, limit = 500) {
  const errors = [];
  const posts = thread.posts ?? [];
  if (posts.length === 0) errors.push(`${thread.id}: posts が空`);
  posts.forEach((p, i) => {
    const len = [...(p.text ?? '')].length;
    if (len > limit) errors.push(`${thread.id} post${i + 1}: text ${len}字 > ${limit}字`);
    if (!p.text && !p.image) errors.push(`${thread.id} post${i + 1}: text も image も無い`);
  });
  return errors;
}
