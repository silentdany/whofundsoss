import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { markSvg } from "./brand-mark.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));

const HERO_SHA256 = "82ef960f5623f241ef7ba3ff8e38e7673a3bdda21673a2b17d988b32a492959a";

test("hero photograph is unchanged and the title block is no longer the cream stack", () => {
  const hero = readFileSync(join(root, "public/art/hero.jpg"));
  assert.equal(createHash("sha256").update(hero).digest("hex"), HERO_SHA256);
  const home = readFileSync(join(root, "src/routes/index.tsx"), "utf8");
  const headings = [...home.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.equal(headings.length, 1);
  assert.match(headings[0]![1]!, /Who really funds open source\./);
  assert.match(home, /src="\/art\/hero\.jpg"/);
  assert.doesNotMatch(home, /text-\[2\.85rem\]/);
  assert.doesNotMatch(home, /sm:text-7xl/);
});

test("favicon is the flat fund mark and the header uses that file", () => {
  const svg = readFileSync(join(root, "public/favicon.svg"), "utf8");
  assert.equal(svg, markSvg());
  assert.match(svg, /#3d7a6a/);
  assert.match(svg, /#faf9f7/);
  assert.match(svg, /<circle /);
  assert.doesNotMatch(svg, /gradient|<image|feGaussian|y="288"/i);
  const shell = readFileSync(join(root, "src/components/shell.tsx"), "utf8");
  assert.match(shell, /src="\/favicon\.svg"/);
  assert.doesNotMatch(shell, /M12 2\.2v19\.6/);
});

test("png icons are the same drawing as favicon.svg", async () => {
  const svg = readFileSync(join(root, "public/favicon.svg"));
  for (const [name, size] of [
    ["apple-touch-icon.png", 180],
    ["icon-192.png", 192],
    ["icon-512.png", 512],
  ] as const) {
    const expected = await sharp(svg).resize(size, size).png().toBuffer();
    const actual = readFileSync(join(root, "public", name));
    assert.ok(expected.equals(actual), name);
  }
  const ico = readFileSync(join(root, "public/favicon.ico"));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.ok(ico.length > 32);
});
