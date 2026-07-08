#!/usr/bin/env node
/**
 * Converts the source running-dog GIF into the assets the LoadingDog component
 * renders:
 *   - public/loading-dog.webp         (looping animated WebP, self-animating)
 *   - public/loading-dog-static.webp  (first frame, used under reduced-motion)
 *
 * The source GIF is large (~4 MB); the animated WebP is a fraction of that.
 *
 * Usage:  node scripts/build-loading-dog.mjs [path-to-gif]
 * Default input: ./same_dog_and_look_feel_illu.gif
 */
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

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

await sharp(input, { animated: true })
  .resize({ width: WIDTH })
  .webp({ quality: 55, effort: 6 })
  .toFile(animatedOut);

await sharp(input, { animated: true, pages: 1 })
  .resize({ width: WIDTH })
  .webp({ quality: 80 })
  .toFile(staticOut);

const kb = (p) => (statSync(p).size / 1024).toFixed(0);
console.log(`Wrote ${animatedOut} (${kb(animatedOut)} KB, animated)`);
console.log(`Wrote ${staticOut} (${kb(staticOut)} KB, static poster)`);
