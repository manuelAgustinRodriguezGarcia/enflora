import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const runs = path.join(path.dirname(fileURLToPath(import.meta.url)), "ab-fase8-runs", "2026-11-06T20-47-50");
const trace = JSON.parse(readFileSync(path.join(runs, "b5-0.trace.json"), "utf8"));
const events = trace.traceEvents ?? trace;

const nombres = new Map();
for (const e of events) {
  if (!e.name) continue;
  if (/paint|Paint|LCP|largest|contentful|ScrollTrigger|navigationStart/i.test(e.name)) {
    nombres.set(e.name, (nombres.get(e.name) || 0) + 1);
  }
}
console.log("nombres", Object.fromEntries([...nombres.entries()].sort((a, b) => b[1] - a[1])));

const marcas = ["0polnukrgbvxk", "23st8uynd9im8", "2q9agmqdlct5e", "0-4rzs25i0-0o", "3amkgicj9l829", "08m0mlft-m_ma"];
let nav = null;
const hits = [];
for (const e of events) {
  if (e.name === "navigationStart" && nav == null) nav = e.ts;
  const url = e.args?.data?.url || e.args?.url || "";
  if (!url) continue;
  if (!marcas.some((m) => url.includes(m))) continue;
  if (e.ph !== "X" && e.ph !== "B" && e.ph !== "I") continue;
  if ((e.dur || 0) < 1000 && e.ph === "X") continue;
  hits.push({
    name: e.name,
    ph: e.ph,
    ts: e.ts,
    dur: e.dur || 0,
    url: url.split("/").pop(),
  });
}
hits.sort((a, b) => a.ts - b.ts);
const base = nav ?? hits[0]?.ts ?? 0;
const pintados = events.filter(
  (e) => e.name === "Paint" || e.name === "firstContentfulPaint" || e.name === "MarkFirstContentfulPaint" || e.name === "largestContentfulPaint::Candidate",
);
console.log(
  "pintados",
  pintados.slice(0, 12).map((e) => ({
    name: e.name,
    ts: Math.round((e.ts - base) / 1000),
    type: e.args?.data?.type || e.args?.frame,
  })),
);
console.log(
  "hits",
  hits.slice(0, 40).map((h) => ({
    name: h.name,
    ms: Math.round((h.ts - base) / 1000),
    dur: Math.round(h.dur / 1000),
    url: h.url,
  })),
);
