import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { markSvg } from "../src/lib/brand-mark.ts";
import { renderOgCard } from "../src/lib/og/card.ts";

const publicDir = join(fileURLToPath(new URL("..", import.meta.url)), "public");
const svg = markSvg();
writeFileSync(join(publicDir, "favicon.svg"), svg);

async function png(size: number, name: string) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(publicDir, name));
}

await png(180, "apple-touch-icon.png");
await png(192, "icon-192.png");
await png(512, "icon-512.png");
const icon32 = await sharp(Buffer.from(svg)).resize(32, 32).png().toBuffer();
writeFileSync(join(publicDir, "favicon.ico"), icoFromPng(icon32, 32));

const home = await renderOgCard("/");
if (!home) throw new Error("home card missing");
writeFileSync(join(publicDir, "og.jpg"), home.body);
console.log(`rasterized mark + home og.jpg (${home.body.length} bytes)`);

function icoFromPng(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}
