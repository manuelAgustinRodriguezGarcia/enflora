import path from "node:path";
import { pathToFileURL } from "node:url";

const raiz = path.resolve(import.meta.dirname, "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return nextResolve(pathToFileURL(path.join(raiz, "tests/stubs/server-only.js")).href, context);
  }
  if (specifier === "next/headers") {
    return nextResolve(pathToFileURL(path.join(raiz, "tests/stubs/next-headers.js")).href, context);
  }
  if (specifier === "next/cache") {
    return nextResolve(pathToFileURL(path.join(raiz, "tests/stubs/next-cache.js")).href, context);
  }
  if (specifier.startsWith("@/")) {
    let relativo = specifier.slice(2);
    if (!path.extname(relativo)) relativo += ".js";
    return nextResolve(pathToFileURL(path.join(raiz, relativo)).href, context);
  }
  return nextResolve(specifier, context);
}
