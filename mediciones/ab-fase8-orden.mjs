import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const runs = path.join(path.dirname(fileURLToPath(import.meta.url)), "ab-fase8-runs", "2026-11-06T20-47-50");
const events = JSON.parse(readFileSync(path.join(runs, "b5-0.trace.json"), "utf8")).traceEvents;

const interes = events.filter((e) =>
  ["firstContentfulPaint", "firstPaint", "firstImagePaint", "largestContentfulPaint::Candidate", "navigationStart"].includes(e.name),
);
for (const e of interes) {
  console.log(e.name, e.ts, e.cat, e.args?.data?.type || e.args?.frame || "");
}

const plugin = events.filter(
  (e) => e.name === "EvaluateScript" && String(e.args?.data?.url || "").includes("0polnukrgbvxk"),
);
console.log("plugin", plugin.map((e) => ({ ts: e.ts, dur: e.dur })));

const core = events.filter(
  (e) => e.name === "EvaluateScript" && String(e.args?.data?.url || "").includes("23st8uynd9im8"),
);
console.log("core", core.map((e) => ({ ts: e.ts, dur: e.dur })));

const react = "08m0mlft-m_ma.js";
const texto = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "worktrees", "ab-fase8-b", ".next", "static", "chunks", react),
  "utf8",
);
console.log("react-dom", texto.includes("react-dom"), "scheduler", texto.includes("scheduler"), "bytes", texto.length);
