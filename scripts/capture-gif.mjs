// Record a short demo of the running dev server, then encode as an
// optimized GIF for the README.
//
// The recording animates the separator handles so the GIF shows off the
// drag interactions in addition to the plasma evolution.
//
//   t = 0.0 .. 1.5 s   plasma evolution at default (0, 0) split
//   t = 1.5 .. 3.0 s   slide vertical separator to the right (+25 r_g)
//   t = 3.0 .. 4.5 s   slide it back left to -25 r_g
//   t = 4.5 .. 6.0 s   pull horizontal separator up to +12 r_g
//   t = 6.0 .. 7.5 s   push it back down through 0 to -12 r_g
//   t = 7.5 .. 9.0 s   recenter both, hold for a beat
//
// Driven via window.__setSplits, a small test hook in Simulation.tsx.
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
const DURATION_S = parseFloat(args.duration ?? "9");
const FPS = parseInt(args.fps ?? "10", 10);
const N_FRAMES = Math.round(DURATION_S * FPS);
const WIDTH = 720;
const HEIGHT = 405;

// Plot-space split position as a function of recording time.
function splitsAt(t) {
  const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
  const ease = (k) => {
    const c = Math.max(0, Math.min(1, k));
    return c * c * (3 - 2 * c); // smoothstep
  };
  if (t < 1.5) return { x: 0, y: 0 };
  if (t < 3.0) return { x: lerp(0, 25, ease((t - 1.5) / 1.5)), y: 0 };
  if (t < 4.5) return { x: lerp(25, -25, ease((t - 3.0) / 1.5)), y: 0 };
  if (t < 6.0) return { x: -25, y: lerp(0, 12, ease((t - 4.5) / 1.5)) };
  if (t < 7.5) return { x: -25, y: lerp(12, -12, ease((t - 6.0) / 1.5)) };
  return {
    x: lerp(-25, 0, ease((t - 7.5) / 1.5)),
    y: lerp(-12, 0, ease((t - 7.5) / 1.5)),
  };
}

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

// Seek to a time near a bright phase of the MAD pulsation.
await page.evaluate(() => {
  const r = document.querySelector('input[type="range"]');
  const ns = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  ns.call(r, 80);
  r.dispatchEvent(new Event("input", { bubbles: true }));
  r.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(500);

// Sanity: confirm the test hook landed.
const hookReady = await page.evaluate(() => typeof window.__setSplits === "function");
if (!hookReady) {
  console.warn(
    "window.__setSplits not exposed — separators will stay centered. " +
      "Make sure Simulation.tsx still ships the test hook.",
  );
}

const start = Date.now();
for (let i = 0; i < N_FRAMES; i++) {
  const tFrame = i / FPS;
  const { x, y } = splitsAt(tFrame);
  if (hookReady) {
    await page.evaluate(({ x, y }) => window.__setSplits(x, y), { x, y });
  }
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

fs.rmSync(tmpDir, { recursive: true, force: true });
