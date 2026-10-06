import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Resolve `@/` to `src/` so node:test can import the shipped modules. */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    let rel = specifier.slice(2);
    if (!/\.(ts|tsx|js|mjs|json)$/.test(rel)) rel += ".ts";
    return nextResolve(pathToFileURL(join(root, "src", rel)).href, context);
  }
  return nextResolve(specifier, context);
}
