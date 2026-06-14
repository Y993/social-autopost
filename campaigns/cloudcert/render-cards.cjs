// campaigns/cloudcert/render-cards.cjs
// cards.html の各カード（#q-<id> / #a-<id>）を 1080x1350 のPNGに書き出し、
// images/ に保存して queue.json の該当スレッドに画像参照を反映する。
//
// 実行: NODE_PATH="$(npm root -g)" node campaigns/cloudcert/render-cards.cjs
//   （playwright はグローバルを利用。chromium 未取得なら `npx playwright install chromium`）
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const dir = __dirname;
  const cardsUrl = "file://" + path.join(dir, "cards.html").replace(/\\/g, "/");
  const outDir = path.join(dir, "images");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
  const page = await browser.newPage();
  await page.goto(cardsUrl, { waitUntil: "networkidle" });
  try {
    await page.waitForFunction(() => document.documentElement.classList.contains("fonts-ready"), { timeout: 6000 });
  } catch (_) { /* フォント待ちタイムアウトは許容 */ }
  await page.waitForTimeout(800);

  const ids = await page.$$eval("section.card", els => els.map(e => e.id));
  for (const id of ids) {
    await page.locator("#" + id).screenshot({ path: path.join(outDir, id + ".png") });
    console.log("rendered", id + ".png");
  }
  await browser.close();

  // queue.json に画像参照を反映（q-<id> → posts[0]、a-<id> → posts[1]）
  const qPath = path.join(dir, "queue.json");
  const queue = JSON.parse(fs.readFileSync(qPath, "utf8"));
  const have = new Set(ids);
  let updated = 0;
  for (const t of queue) {
    if (have.has("q-" + t.id) && t.posts[0] && !t.posts[0].image) { t.posts[0].image = `images/q-${t.id}.png`; updated++; }
    if (have.has("a-" + t.id) && t.posts[1] && !t.posts[1].image) { t.posts[1].image = `images/a-${t.id}.png`; updated++; }
  }
  fs.writeFileSync(qPath, JSON.stringify(queue, null, 2) + "\n");
  console.log("queue.json 反映 posts:", updated, " / cards:", ids.length);
})().catch(e => { console.error(e); process.exit(1); });
