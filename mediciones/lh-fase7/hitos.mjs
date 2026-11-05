import { readFileSync } from "node:fs";

const traza = JSON.parse(readFileSync("mediciones/lh-fase7/lhr-0.trace.json", "utf8"));
const eventos = traza.traceEvents || traza;
const t0 = eventos.find((e) => e.name === "navigationStart" && e.args?.data?.isLoadingMainFrame).ts;
const ms = (ts) => Math.round((ts - t0) / 10) / 100;
const claves = new Set([
  "firstPaint",
  "firstContentfulPaint",
  "firstImagePaint",
  "largestContentfulPaint::Candidate",
  "LargestImagePaint::Candidate",
  "LargestTextPaint::Candidate",
  "GlobalFirstContentfulPaint",
]);

const hitos = [];
const llamadas = [];
for (const e of eventos) {
  if (claves.has(e.name) && e.ts) {
    const d = e.args?.data || {};
    hitos.push({
      n: e.name,
      t: ms(e.ts),
      size: d.size,
      node: d.nodeName,
      url: d.imageUrl || d.url || d.candidateIndex,
      type: d.type,
    });
  }
  if (e.name === "FunctionCall" && e.dur > 8000) {
    const d = e.args?.data || {};
    llamadas.push({
      t: ms(e.ts),
      dur: Math.round(e.dur / 10) / 100,
      fn: d.functionName,
      url: String(d.url || "").replace("https://enflora.com.ar", "").slice(0, 90),
      linea: d.lineNumber,
    });
  }
}

llamadas.sort((a, b) => b.dur - a.dur);
console.log(JSON.stringify({ hitos, llamadas: llamadas.slice(0, 25) }, null, 2));
