// Record a short demo of the running dev server, then encode as an
// optimized GIF for the README.
//
// Steps:
//   1. Launch headless Chromium, open localhost:3010.
//   2. Wait for the loading overlay to clear, seek to a moment of bright
//      plasma activity so the GIF doesn't open on a quiet frame.
//   3. Take N screenshots at a fixed interval (sim time evolves in
//      between because the rAF loop drives uTime continuously).
//   4. Run ffmpeg twice — once to extract a palette from the frame set,
//      once to encode the GIF using that palette (smaller + cleaner).
//
// Usage: node scripts/capture-gif.mjs [--out path] [--duration s] [--fps n]
//
// Requires: ffmpeg in PATH, playwright-core, dev server running on :3010.

import { chromium } from "playwright-core";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((acc, cur, i, arr) => {
      if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
      return acc;
    }, []),
);
const OUT = args.out ?? "public/grmhd/demo.gif";
const DURATION_S = parseFloat(args.duration ?? "8");
const FPS = parseInt(args.fps ?? "12", 10);
const N_FRAMES = Math.round(DURATION_S * FPS);
const WIDTH = 720;
const HEIGHT = 405;

const tmpDir = fs.mkdtempSync("/tmp/sgr-gif-");
console.log(`Capturing ${N_FRAMES} frames @ ${FPS} fps into ${tmpDir}`);

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } });
const page = await ctx.newPage();

await page.goto("http://localhost:3010/", { waitUntil: "networkidle", timeout: 30000 });
await page
  .waitForSelector("div.bg-black\\/55", { state: "detached", timeout: 20000 })
  .catch(() => null);
await page.waitForTimeout(1500);

// Seek to a time near a bright phase of the MAD pulsation (~t=80 in the
// 180s loop corresponds roughly to a peak in totFnu).
await page.evaluate(() => {
  const r = document.querySelector('input[type="range"]');
  const ns = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  ns.call(r, 80);
  r.dispatchEvent(new Event("input", { bubbles: true }));
  r.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(500);

const start = Date.now();
for (let i = 0; i < N_FRAMES; i++) {
  const tFrame = i / FPS;
  const target = start + tFrame * 1000;
  const wait = target - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const file = path.join(tmpDir, `f_${String(i).padStart(4, "0")}.png`);
  await page.screenshot({ path: file, omitBackground: false });
}
console.log(`Captured ${N_FRAMES} frames`);
await browser.close();

// Convert to GIF via ffmpeg's palette pipeline (best quality at small size).
const palette = path.join(tmpDir, "palette.png");
console.log("Generating palette…");
execSync(
  `ffmpeg -y -framerate ${FPS} -i ${tmpDir}/f_%04d.png ` +
    `-vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,palettegen=max_colors=64" ${palette}`,
  { stdio: "inherit" },
);
console.log("Encoding GIF…");
fs.mkdirSync(path.dirname(OUT), { recursive: true });
execSync(
  `ffmpeg -y -framerate ${FPS} -i ${tmpDir}/f_%04d.png -i ${palette} ` +
    `-lavfi "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=4" ` +
    `-loop 0 ${OUT}`,
  { stdio: "inherit" },
);
const size = fs.statSync(OUT).size;
console.log(`Wrote ${OUT} — ${(size / 1024 / 1024).toFixed(2)} MB`);

// Clean up frames
fs.rmSync(tmpDir, { recursive: true, force: true });
