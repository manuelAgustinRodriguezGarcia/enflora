import path from "node:path";
import { pathToFileURL } from "node:url";

const raiz = path.resolve(import.meta.dirname, "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    let relativo = specifier.slice(2);
    if (!path.extname(relativo)) relativo += ".js";
    return nextResolve(pathToFileURL(path.join(raiz, relativo)).href, context);
  }
  return nextResolve(specifier, context);
}
