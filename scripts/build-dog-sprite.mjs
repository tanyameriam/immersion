#!/usr/bin/env node
/**
 * Extracts the running-dog sprite sheet (a data:image/png;base64 URI) out of the
 * dog-loader-preview.html file and writes it to public/running-dog-sprite.png,
 * the asset the LoadingDog component renders.
 *
 * Usage:  node scripts/build-dog-sprite.mjs [path-to-html]
 * Default input: ./dog-loader-preview.html
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

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

// Sanity check: PNG signature + IHDR dimensions (expect 2640 x 107).
const sig = png.subarray(0, 8).toString("hex");
if (sig !== "89504e470d0a1a0a") {
  console.error("Decoded bytes are not a valid PNG.");
  process.exit(1);
}
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);

writeFileSync(output, png);
console.log(`Wrote ${output} (${png.length} bytes, ${width}x${height}px)`);
if (width !== 2640 || height !== 107) {
  console.warn(
    `Note: expected 2640x107 sprite; got ${width}x${height}. ` +
      "If this differs, update the size in components/LoadingDog.tsx.",
  );
}
