#!/usr/bin/env node
/**
 * Converts the source running-dog GIF into the assets the LoadingDog component
 * renders, with the flat background keyed out to transparent:
 *   - public/loading-dog.webp         (looping animated WebP, transparent bg)
 *   - public/loading-dog-static.webp  (first frame, used under reduced-motion)
 *
 * The illustration's background (and faint shadow) is bright + neutral, while
 * the dog body is warm cream (high chroma) and the outline is dark. So we drop
 * pixels that are bright AND neutral, and keep colored or dark pixels. sharp
 * flattens animation when going through raw pixels, so we key each frame and
 * reassemble the animation with node-webpmux.
 *
 * Usage:  node scripts/build-loading-dog.mjs [path-to-gif]
 * Default input: ./same_dog_and_look_feel_illu.gif
 */
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import WebP from "node-webpmux";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const input = resolve(root, process.argv[2] ?? "same_dog_and_look_feel_illu.gif");
const animatedOut = resolve(root, "public/loading-dog.webp");
const staticOut = resolve(root, "public/loading-dog-static.webp");

if (!existsSync(input)) {
  console.error(`Source GIF not found: ${input}`);
  console.error("Pass its path: node scripts/build-loading-dog.mjs <path-to-gif>");
  process.exit(1);
}

const WIDTH = 350; // display width in the loader
const STEP = 2; // keep every Nth frame (delays are combined to keep timing)

// Keying thresholds (see color sampling in the header comment).
const C_LO = 10,
  C_HI = 22; // chroma ramp: <=C_LO neutral, >=C_HI colored (kept)
const B_LO = 214,
  B_HI = 228; // min-brightness ramp for neutral pixels: >=B_HI dropped

/** Bright + neutral -> transparent; colored or dark -> kept (smooth ramps). */
function keyBackground(data, channels) {
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const mn = Math.min(r, g, b);
    const chroma = Math.max(r, g, b) - mn;
    const colorness = Math.max(0, Math.min(1, (chroma - C_LO) / (C_HI - C_LO)));
    const darkNeutral = Math.max(0, Math.min(1, (B_HI - mn) / (B_HI - B_LO)));
    const opacity = Math.max(colorness, darkNeutral);
    data[i + 3] = Math.round((data[i + 3] / 255) * opacity * 255);
  }
}

const meta = await sharp(input, { animated: true }).metadata();
const pages = meta.pages ?? 1;
const delays = Array.isArray(meta.delay) ? meta.delay : new Array(pages).fill(100);

const { data, info } = await sharp(input, { animated: true })
  .resize({ width: WIDTH })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, channels } = info;
const pageHeight = info.height / pages;
const frameBytes = width * pageHeight * channels;

const frames = [];
for (let i = 0; i < pages; i += STEP) {
  const raw = data.subarray(i * frameBytes, (i + 1) * frameBytes);
  const keyed = Buffer.from(raw); // copy so we don't clobber the shared buffer
  keyBackground(keyed, channels);
  const webpBuf = await sharp(keyed, { raw: { width, height: pageHeight, channels } })
    .webp({ quality: 70, alphaQuality: 100, effort: 4 })
    .toBuffer();
  let delay = 0;
  for (let j = i; j < Math.min(i + STEP, pages); j++) delay += delays[j] ?? 40;
  frames.push(
    await WebP.Image.generateFrame({ buffer: webpBuf, delay, blend: false, dispose: true }),
  );
}

await WebP.Image.save(animatedOut, {
  frames,
  loops: 0,
  bgColor: [0, 0, 0, 0],
  width,
  height: pageHeight,
});

// Static poster (first frame, keyed) for reduced-motion.
{
  const raw = Buffer.from(data.subarray(0, frameBytes));
  keyBackground(raw, channels);
  await sharp(raw, { raw: { width, height: pageHeight, channels } })
    .webp({ quality: 85, alphaQuality: 100 })
    .toFile(staticOut);
}

const kb = (p) => (statSync(p).size / 1024).toFixed(0);
console.log(`Wrote ${animatedOut} (${kb(animatedOut)} KB, ${frames.length} frames, transparent bg)`);
console.log(`Wrote ${staticOut} (${kb(staticOut)} KB, static poster)`);
