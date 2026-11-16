import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const runs = path.join(dir, "ab-fase8-runs", "2026-11-06T20-47-50");
const chunks = JSON.parse(readFileSync(path.join(runs, "chunks.json"), "utf8"));

function marcas(url) {
  const nombre = url.split("/").pop()?.split("?")[0] ?? "";
  const todas = [...chunks.A, ...chunks.B];
  const hit = todas.find((c) => c.archivo.endsWith(nombre));
  return hit ? hit.marcas.join("+") : "";
}

function red(etiqueta) {
  const j = JSON.parse(readFileSync(path.join(runs, `${etiqueta}.json`), "utf8"));
  const item = j.audits.metrics.details.items[0];
  const fcp = item.observedFirstContentfulPaint;
  const reqs = j.audits["network-requests"].details.items.filter((r) => r.resourceType === "Script");
  const antes = reqs.filter((r) => (r.endTime ?? r.startTime) <= fcp + 50);
  const boot = (j.audits["bootup-time"]?.details?.items ?? [])
    .filter((i) => (i.scripting || 0) > 40)
    .map((i) => ({
      url: (i.url || "").split("/").pop(),
      scripting: Math.round(i.scripting || 0),
      total: Math.round(i.total || 0),
      marcas: marcas(i.url || ""),
    }));
  return {
    etiqueta,
    fcp: Math.round(item.observedFirstContentfulPaint),
    lcp: Math.round(item.observedLargestContentfulPaint),
    scripts: reqs.length,
    scriptsAntesDeFcp: antes.map((r) => ({
      url: r.url.split("/").pop(),
      start: Math.round(r.startTime),
      end: Math.round(r.endTime),
      transfer: r.transferSize,
      marcas: marcas(r.url),
    })),
    boot,
  };
}

const informe = ["a4", "b4", "a1", "b1", "b5"].map(red);
console.log(JSON.stringify(informe, null, 2));

const traza = path.join(runs, "b5-0.trace.json");
const raw = readFileSync(traza, "utf8");
const trace = JSON.parse(raw);
const events = trace.traceEvents ?? trace;
let fcp = null;
let lcp = null;
const evals = [];
for (const e of events) {
  if (e.name === "firstContentfulPaint" && e.ph === "I") fcp = e.ts;
  if (e.name === "largestContentfulPaint::Candidate" && e.ph === "I") lcp = e.ts;
  if (e.name === "EvaluateScript" && e.ph === "X" && /chunks\//.test(e.args?.data?.url || "")) {
    evals.push({
      ts: e.ts,
      dur: e.dur,
      url: (e.args.data.url || "").split("/").pop(),
    });
  }
}
evals.sort((a, b) => a.ts - b.ts);
const origen = evals[0]?.ts ?? fcp;
const relevantes = evals
  .filter((e) => e.dur > 5_000)
  .map((e) => ({
    ms: Math.round((e.ts - origen) / 1000),
    dur: Math.round(e.dur / 1000),
    antesDeFcp: fcp != null && e.ts < fcp,
    url: e.url,
    marcas: marcas(e.url),
  }));
console.log(
  JSON.stringify(
    {
      fcpMs: fcp && origen ? Math.round((fcp - origen) / 1000) : null,
      lcpMs: lcp && origen ? Math.round((lcp - origen) / 1000) : null,
      evals: relevantes,
    },
    null,
    2,
  ),
);
