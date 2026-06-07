import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextUnposted,
  markPosted,
  imageUrlFor,
  resolvePosts,
  validateThread,
} from './queue.mjs';

const queue = [
  { id: 'a', posts: [{ text: 'qa', image: 'images/q1.png' }, { text: 'aa', image: 'images/a1.png' }] },
  { id: 'b', posts: [{ text: 'qb' }] },
  { id: 'c', posts: [{ text: 'qc' }] },
];

test('nextUnposted は posted に無い最初の項目を返す', () => {
  assert.equal(nextUnposted(queue, { posted: [] }).id, 'a');
  assert.equal(nextUnposted(queue, { posted: ['a'] }).id, 'b');
  assert.equal(nextUnposted(queue, { posted: ['a', 'b'] }).id, 'c');
});

test('nextUnposted は全消化済みなら null', () => {
  assert.equal(nextUnposted(queue, { posted: ['a', 'b', 'c'] }), null);
});

test('nextUnposted は state 欠損でも先頭を返す', () => {
  assert.equal(nextUnposted(queue, undefined).id, 'a');
  assert.equal(nextUnposted(queue, {}).id, 'a');
});

test('markPosted は id を追記し、重複は足さない', () => {
  assert.deepEqual(markPosted({ posted: [] }, 'a').posted, ['a']);
  assert.deepEqual(markPosted({ posted: ['a'] }, 'b').posted, ['a', 'b']);
  assert.deepEqual(markPosted({ posted: ['a'] }, 'a').posted, ['a']);
});

test('markPosted は元の state を破壊しない', () => {
  const s = { posted: ['a'] };
  markPosted(s, 'b');
  assert.deepEqual(s.posted, ['a']);
});

test('imageUrlFor は二重スラッシュを避けて公開URLを作る', () => {
  assert.equal(
    imageUrlFor('https://y993.github.io/social-autopost/', 'aws-saa', 'images/q1.png'),
    'https://y993.github.io/social-autopost/campaigns/aws-saa/images/q1.png',
  );
  assert.equal(
    imageUrlFor('https://y993.github.io/social-autopost', 'aws-saa', '/images/q1.png'),
    'https://y993.github.io/social-autopost/campaigns/aws-saa/images/q1.png',
  );
});

test('resolvePosts は image を URL 化し、text のみはそのまま', () => {
  const out = resolvePosts(queue[0], { imageBaseUrl: 'https://h/social-autopost', campaign: 'aws-saa' });
  assert.equal(out[0].imageUrl, 'https://h/social-autopost/campaigns/aws-saa/images/q1.png');
  assert.equal(out[0].text, 'qa');
  const out2 = resolvePosts(queue[1], { imageBaseUrl: 'https://h/social-autopost', campaign: 'aws-saa' });
  assert.equal(out2[0].imageUrl, undefined);
});

test('validateThread は500字超とからの投稿を検出', () => {
  assert.deepEqual(validateThread(queue[0]), []);
  const long = { id: 'x', posts: [{ text: 'あ'.repeat(501) }] };
  assert.equal(validateThread(long).length, 1);
  const empty = { id: 'y', posts: [{}] };
  assert.equal(validateThread(empty).length, 1);
  assert.equal(validateThread({ id: 'z', posts: [] }).length, 1);
});
