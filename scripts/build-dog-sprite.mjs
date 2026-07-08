#!/usr/bin/env node
/**
 * Extracts the running-dog sprite sheet (a data:image/png;base64 URI) out of the
 * dog-loader-preview.html file, recolors it to a bold black outline with a
 * transparent fill, and writes it to public/running-dog-sprite.png — the asset
 * the LoadingDog component renders.
 *
 * The source art is a soft pencil sketch (near-white body fill + light charcoal
 * strokes). We threshold luminance: dark strokes -> solid black, the near-white
 * fill -> transparent, with a small ramp for smooth anti-aliased edges.
 *
 * Usage:  node scripts/build-dog-sprite.mjs [path-to-html]
 * Default input: ./dog-loader-preview.html
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const input = resolve(root, process.argv[2] ?? "dog-loader-preview.html");
const output = resolve(root, "public/running-dog-sprite.png");

if (!existsSync(input)) {
  console.error(`Input HTML not found: ${input}`);
  console.error("Save the provided dog-loader-preview.html to the repo root, or");
  console.error("pass its path: node scripts/build-dog-sprite.mjs <path-to-html>");
  process.exit(1);
}

const html = readFileSync(input, "utf8");
const match = html.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
if (!match) {
  console.error("No data:image/png;base64 sprite found in the HTML.");
  process.exit(1);
}

const png = Buffer.from(match[1], "base64");

// Sanity check: PNG signature.
if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
  console.error("Decoded bytes are not a valid PNG.");
  process.exit(1);
}

// Recolor: dark sketch strokes -> solid black ink, near-white fill -> transparent.
const LOW = 180; // luminance <= LOW  -> solid black
const HIGH = 214; // luminance >= HIGH -> transparent
const { data, info } = await sharp(png)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const out = Buffer.alloc(data.length);
for (let i = 0; i < data.length; i += channels) {
  const srcA = data[i + 3];
  const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  let a;
  if (lum <= LOW) a = 1;
  else if (lum >= HIGH) a = 0;
  else a = (HIGH - lum) / (HIGH - LOW);
  a *= srcA / 255;
  out[i] = 0;
  out[i + 1] = 0;
  out[i + 2] = 0;
  out[i + 3] = Math.round(a * 255);
}
await sharp(out, { raw: { width, height, channels } }).png().toFile(output);

console.log(`Wrote ${output} (recolored black outline, ${width}x${height}px)`);
if (width % 12 !== 0) {
  console.warn(
    `Note: sprite width ${width} is not divisible by 12 frames; ` +
      "check the frame math in components/LoadingDog.tsx.",
  );
}
