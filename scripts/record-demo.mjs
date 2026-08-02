/**
 * Records docs/demo.gif by driving the real app in headless Chromium.
 *
 *   npm run dev            # in one terminal
 *   node scripts/record-demo.mjs
 *
 * Scripted rather than hand-recorded so it can be regenerated whenever the UI
 * changes, instead of going stale the moment someone touches the layout.
 *
 * Recording deps are deliberately not in package.json — they are heavy and only
 * needed when regenerating the GIF, so CI does not pay for them on every run:
 *
 *   npm i -D --no-save playwright gif-encoder-2 pngjs && npx playwright install chromium
 *
 * Set VITE_SERVER_URL= (empty) on the dev server so the capture matches the
 * hosted build, which has no DuckDB server behind it.
 */
import { chromium } from 'playwright';
import GIFEncoder from 'gif-encoder-2';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.env.DEMO_URL ?? 'http://localhost:5173/hybrid-query-engine/';
const OUT = path.join(root, 'docs', 'demo.gif');

const WIDTH = 960;
const HEIGHT = 720;
const DELAY_MS = 120; // per frame

const frames = [];

async function capture(page, count = 1) {
  for (let i = 0; i < count; i++) {
    frames.push(await page.screenshot({ type: 'png' }));
    if (count > 1) await page.waitForTimeout(DELAY_MS);
  }
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Hybrid Query Engine');

  // Land on the empty state so the viewer sees where the data comes from.
  await capture(page, 8);

  await page.click('text=Load sample dataset');
  await page.waitForSelector('text=sample-sales.csv');
  await capture(page, 10);

  await page.click('button:has-text("Run")');
  await page.waitForSelector('table', { timeout: 15000 });
  await capture(page, 6);

  // Hold on the result — table, chart, route badge and timing.
  await page.evaluate(() => window.scrollBy({ top: 260, behavior: 'instant' }));
  await capture(page, 20);

  await browser.close();

  // DEMO_DEBUG_FRAMES=/tmp/frames dumps every frame as PNG for eyeballing.
  if (process.env.DEMO_DEBUG_FRAMES) {
    const dir = process.env.DEMO_DEBUG_FRAMES;
    fs.mkdirSync(dir, { recursive: true });
    frames.forEach((b, i) =>
      fs.writeFileSync(path.join(dir, `frame-${String(i).padStart(3, '0')}.png`), b)
    );
    console.log(`dumped ${frames.length} frames to ${dir}`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const encoder = new GIFEncoder(WIDTH, HEIGHT, 'neuquant', true, frames.length);
  encoder.setDelay(DELAY_MS);
  encoder.setRepeat(0);
  encoder.setQuality(10);
  encoder.start();

  for (const buf of frames) {
    const png = PNG.sync.read(buf);
    encoder.addFrame(png.data);
  }
  encoder.finish();

  fs.writeFileSync(OUT, encoder.out.getData());
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`wrote ${path.relative(root, OUT)} — ${frames.length} frames, ${kb} KB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
