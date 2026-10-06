import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { companyTitle, pageHead } from "../seo.ts";
import { OG_IMAGE_HEIGHT, OG_IMAGE_TYPE, OG_IMAGE_WIDTH, PAGE_TITLES } from "../site.ts";
import type { CompanyRow } from "../types.ts";
import { photoBytes, renderOgCard } from "./card.ts";

const catalog = JSON.parse(
  readFileSync(new URL("../../data/catalog.json", import.meta.url), "utf8"),
) as {
  index: CompanyRow[];
};

function row(slug: string): CompanyRow {
  const found = catalog.index.find((item) => item.slug === slug);
  assert.ok(found, slug);
  return found;
}

function metaContent(
  head: ReturnType<typeof pageHead>,
  key: string,
  field: "property" | "name",
): string {
  const tag = head.meta.find((item) => item[field] === key);
  assert.ok(tag, key);
  return String(tag.content);
}

const PAGES = [
  { path: "/", title: PAGE_TITLES.home, needle: "Who really funds open source" },
  { path: "/ranking", title: PAGE_TITLES.ranking, needle: "Open source funding ranking" },
  {
    path: "/company/posit-dev",
    title: companyTitle(row("posit-dev")),
    needle: row("posit-dev").name,
  },
  {
    path: "/company/getsentry",
    title: companyTitle(row("getsentry")),
    needle: row("getsentry").name,
  },
];

test("pageHead points each page at its own absolute share card", () => {
  const images = PAGES.map((page) => {
    const head = pageHead({ path: page.path, title: page.title });
    const og = metaContent(head, "og:image", "property");
    const twitter = metaContent(head, "twitter:image", "name");
    assert.equal(og, twitter);
    assert.match(og, /^https:\/\//);
    assert.equal(metaContent(head, "og:image:width", "property"), String(OG_IMAGE_WIDTH));
    assert.equal(metaContent(head, "og:image:height", "property"), String(OG_IMAGE_HEIGHT));
    assert.equal(metaContent(head, "og:image:type", "property"), OG_IMAGE_TYPE);
    assert.match(OG_IMAGE_TYPE, /^image\//);
    return og;
  });
  assert.equal(new Set(images).size, images.length);
});

test("rendered cards are distinct images that carry the page title and the mark", async () => {
  const first = [];
  const second = [];
  for (const page of PAGES) {
    const card = await renderOgCard(page.path);
    const again = await renderOgCard(page.path);
    assert.ok(card && again);
    assert.equal(card.contentType, OG_IMAGE_TYPE);
    assert.match(card.contentType, /^image\//);
    assert.ok(card.body.length < 300_000, `${page.path} ${card.body.length}`);
    const pixels = await sharp(card.body).metadata();
    assert.equal(pixels.width, OG_IMAGE_WIDTH);
    assert.equal(pixels.height, OG_IMAGE_HEIGHT);
    assert.ok(card.body.equals(again.body));
    assert.match(card.svg, /id="brand-mark"/);
    assert.match(card.svg, /cx="256" cy="206"/);
    assert.ok(card.svg.includes(page.needle), page.path);
    assert.ok(card.body.includes(Buffer.from(page.needle)), page.path);
    assert.ok(card.body.includes(Buffer.from("brand-mark")));
    first.push(card.body);
    second.push(again.body);
  }
  for (let i = 0; i < first.length; i++) {
    for (let j = i + 1; j < first.length; j++) assert.equal(first[i]!.equals(first[j]!), false);
  }
  assert.deepEqual(
    first.map((body) => body.length),
    second.map((body) => body.length),
  );
});

test("a missing public/art file is loaded from the site origin", async () => {
  const hero = readFileSync(
    join(fileURLToPath(new URL("../../..", import.meta.url)), "public/art/hero.jpg"),
  );
  const server = createServer((request, response) => {
    if (request.url === "/art/hero.jpg") {
      response.writeHead(200, { "content-type": "image/jpeg" });
      response.end(hero);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  try {
    const bytes = await photoBytes("hero", {
      root: "/tmp/whofundsoss-og-no-public",
      origin: `http://127.0.0.1:${address.port}`,
    });
    assert.ok(bytes.equals(hero));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
