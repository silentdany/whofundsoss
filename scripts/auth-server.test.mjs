// Proves the auth server still works after a better-auth upgrade: loads the
// shipped src/lib/auth/server.ts through Vite (import.meta.glob, aliases) with
// the embedded PGLite and the opt-in auth schema, then drives real requests.
// The broker client below is fake and never contacted.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const ORIGIN = "http://localhost:8080";

Object.assign(process.env, {
  GROK_AUTH_ISSUER: "https://broker.test",
  GROK_AUTH_CLIENT_ID: "test-client",
  GROK_AUTH_CLIENT_SECRET: "test-only-not-a-secret",
  BETTER_AUTH_URL: ORIGIN,
  BETTER_AUTH_SECRET: "test-only-better-auth-secret-0123456789",
});
delete process.env.DATABASE_URL;
delete process.env.VITE_AUTH_ENABLED;

let vite;
let mod;

before(async () => {
  vite = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { "@": `${root}src` } },
    ssr: { external: ["@electric-sql/pglite", "pg", "better-auth", "kysely"] },
  });
  const db = await vite.ssrLoadModule("/src/lib/db.ts");
  const pg = await db.getPglite();
  await pg.exec(readFileSync(new URL("../migrations/auth/0001_auth.sql", import.meta.url), "utf8"));
  mod = await vite.ssrLoadModule("/src/lib/auth/server.ts");
});

after(async () => {
  await vite?.close();
});

const post = (path, body) =>
  mod.auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify(body),
    }),
  );

test("auth server builds with the broker client configured", () => {
  assert.equal(mod.authConfigured, true);
  assert.ok(mod.GROK_PROVIDERS.length > 0);
});

test("anonymous get-session answers 200 with no session", async () => {
  const res = await mod.auth.handler(new Request(`${ORIGIN}/api/auth/get-session`));
  assert.equal(res.status, 200);
  assert.equal(await res.json(), null);
});

test("each broker provider starts an OAuth redirect to the broker", async () => {
  for (const { providerId, idp } of mod.GROK_PROVIDERS) {
    const res = await post("/sign-in/social", { provider: providerId, callbackURL: "/", disableRedirect: true });
    assert.equal(res.status, 200, providerId);
    const url = new URL((await res.json()).url);
    assert.equal(url.origin + url.pathname, "https://broker.test/api/auth/oauth2/authorize");
    assert.equal(url.searchParams.get("client_id"), "test-client");
    assert.equal(url.searchParams.get("idp"), idp);
    assert.equal(url.searchParams.get("redirect_uri"), `${ORIGIN}/api/auth/callback/${providerId}`);
    assert.ok(url.searchParams.get("state"));
  }
});

test("an unknown provider is refused", async () => {
  const res = await post("/sign-in/social", { provider: "nope", callbackURL: "/" });
  assert.ok(res.status >= 400 && res.status < 500, String(res.status));
});

test("a callback with a forged state creates no session", async () => {
  const id = mod.GROK_PROVIDERS[0].providerId;
  const res = await mod.auth.handler(new Request(`${ORIGIN}/api/auth/callback/${id}?code=x&state=forged`));
  assert.ok(res.status === 302 || res.status >= 400, String(res.status));
  if (res.status === 302) assert.match(res.headers.get("location") ?? "", /error/);
  const setsSession = res.headers.getSetCookie().some((c) => /session_token=[^;]+/.test(c) && !/Max-Age=0/i.test(c));
  assert.equal(setsSession, false);
});
