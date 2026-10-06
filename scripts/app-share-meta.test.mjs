import { test } from "node:test";
import assert from "node:assert/strict";
import { appOwnsShareMeta, hasLinkRel, injectGrokPwaHead } from "./grok-pwa-shared.mjs";

const APP_HEAD =
  '<html><head><title>Ranking · WhoFundsOSS</title>' +
  '<meta property="og:title" content="Ranking · WhoFundsOSS">' +
  '<meta property="og:image" content="https://whofundsoss.vercel.app/og.jpg">' +
  '<meta name="twitter:card" content="summary_large_image">' +
  '<link rel="manifest" href="/manifest.webmanifest">' +
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">' +
  "</head><body></body></html>";

test("appShareMeta keeps the app's own og/twitter tags", () => {
  const out = injectGrokPwaHead(APP_HEAD, {
    host: "whofundsoss.vercel.app",
    site: { title: "WhoFundsOSS", appShareMeta: true },
  });
  assert.equal((out.match(/property="og:title"/g) ?? []).length, 1);
  assert.match(out, /og:title" content="Ranking · WhoFundsOSS"/);
  assert.match(out, /og:image" content="https:\/\/whofundsoss\.vercel\.app\/og\.jpg"/);
});

test("without appShareMeta the platform still overwrites share metas", () => {
  const out = injectGrokPwaHead(APP_HEAD, { host: "x.vercel.app", site: { title: "Platform" } });
  assert.match(out, /og:title" content="Platform"/);
  assert.doesNotMatch(out, /og:title" content="Ranking/);
});

test("an app-owned manifest / touch icon is not duplicated by the platform", () => {
  const out = injectGrokPwaHead(APP_HEAD, { host: "", site: { appShareMeta: true } });
  assert.equal((out.match(/rel="manifest"/g) ?? []).length, 1);
  assert.equal((out.match(/rel="apple-touch-icon"/g) ?? []).length, 1);
  assert.doesNotMatch(out, /__grok\/manifest\.webmanifest/);
});

test("helpers", () => {
  assert.equal(hasLinkRel('<link rel="manifest" href="/m">', "manifest"), true);
  assert.equal(hasLinkRel('<link rel="icon" href="/m">', "manifest"), false);
  assert.equal(appOwnsShareMeta('<meta property="og:title" content="x">', { appShareMeta: true }), true);
  assert.equal(appOwnsShareMeta('<meta property="og:title" content="x">', {}), false);
  assert.equal(appOwnsShareMeta("<title>x</title>", { appShareMeta: true }), false);
});
