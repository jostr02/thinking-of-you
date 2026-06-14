#!/usr/bin/env node
// build-images.js — scan the images/ folder and write images.json.
//
// Name each photo by when it happened:
//
//   YYYY-MM-DD_HHMM_optional-caption.ext      (24-hour time)
//
//   2026-03-14_1532_first-date.jpg   -> Mar 14 2026 15:32, caption "first date"
//   2026-04-02_2110.png              -> Apr  2 2026 21:10, no caption
//
// The caption is whatever follows the time; '-' and '_' become spaces.
// Run from the project root:  node tools/build-images.js
//
// render.js loads the resulting images.json and drops a yellow (image) dot at
// each photo's timestamp — no need to touch times.txt.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const IMG_DIR = path.join(ROOT, "images");
const OUT = path.join(ROOT, "images.json");

const IMG_EXT = /\.(jpe?g|png|gif|webp|avif)$/i;
// YYYY-MM-DD_HHMM  then optional _caption
const NAME_RE = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(?:[_-](.*))?$/;

function main() {
  if (!fs.existsSync(IMG_DIR)) {
    console.error("no images/ folder at " + IMG_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(IMG_DIR).filter((f) => IMG_EXT.test(f));
  const items = [];
  const skipped = [];

  for (const file of files) {
    const base = file.replace(IMG_EXT, "");
    const m = base.match(NAME_RE);
    if (!m) { skipped.push(file); continue; }

    const y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5];
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) {
      skipped.push(file);
      continue;
    }
    const caption = (m[6] || "").replace(/[-_]+/g, " ").trim();

    items.push({ file, y, mo, d, h, mi, caption });
  }

  // sort chronologically
  items.sort((a, b) =>
    a.y - b.y || a.mo - b.mo || a.d - b.d || a.h - b.h || a.mi - b.mi);

  fs.writeFileSync(OUT, JSON.stringify(items, null, 2) + "\n");

  console.log("wrote " + path.relative(ROOT, OUT) + " with " + items.length + " photo(s)");
  if (skipped.length) {
    console.log("\nskipped (name them YYYY-MM-DD_HHMM_caption.ext):");
    skipped.forEach((f) => console.log("  " + f));
  }
}

main();
