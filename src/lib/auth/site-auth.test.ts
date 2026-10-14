import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { resolveAuthEnabled, SITE_HAS_SIGN_IN } from "./site-auth.ts";

test("auth is off unless the site has sign-in, whatever the deploy env says", () => {
  for (const env of [undefined, "", "true", "false"]) assert.equal(resolveAuthEnabled(false, env), false, String(env));
  assert.equal(resolveAuthEnabled(true, undefined), true);
  assert.equal(resolveAuthEnabled(true, "true"), true);
  assert.equal(resolveAuthEnabled(true, "false"), false);
});

test("SITE_HAS_SIGN_IN matches the routes: no /api/auth route means no sign-in", () => {
  const route = new URL("../../routes/api/auth/$.ts", import.meta.url);
  assert.equal(existsSync(route), SITE_HAS_SIGN_IN);
});

test("the client never decides auth from VITE_AUTH_ENABLED alone", () => {
  const src = readFileSync(new URL("./client.ts", import.meta.url), "utf8");
  assert.match(src, /authEnabled = resolveAuthEnabled\(SITE_HAS_SIGN_IN,/);
});

test("analytics never identify the dev fallback user", () => {
  const src = readFileSync(new URL("./provider.tsx", import.meta.url), "utf8");
  assert.match(src, /!user \|\| user\.isDevFallback/);
});
