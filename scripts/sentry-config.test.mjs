// Sentry sends error reports only: no default PII, no Session Replay.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const files = ["../src/instrument.client.ts", "../instrument.server.mjs"].map((f) => [
  f,
  readFileSync(new URL(f, import.meta.url), "utf8"),
]);

test("Sentry collects no default PII (SDK v11 dataCollection)", () => {
  for (const [name, src] of files) {
    for (const key of ["userInfo", "cookies", "httpHeaders", "urlQueryParams"]) {
      assert.match(src, new RegExp(`${key}: false`), `${name}: ${key}`);
    }
    assert.match(src, /httpBodies: \[\]/, name);
    assert.doesNotMatch(src, /sendDefaultPii: true|userInfo: true/, name);
  }
});

test("no Session Replay and no tracing in the browser SDK setup", () => {
  const [, client] = files[0];
  assert.doesNotMatch(client, /replayIntegration|replaysSessionSampleRate|replaysOnErrorSampleRate/);
  assert.doesNotMatch(client, /tracesSampleRate|browserTracingIntegration/);
});
