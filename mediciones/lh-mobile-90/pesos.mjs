import { readFileSync } from "node:fs";

const lhr = JSON.parse(readFileSync(new URL("./lhr.json", import.meta.url), "utf8"));
for (const id of [
  "first-contentful-paint",
  "largest-contentful-paint",
  "total-blocking-time",
  "cumulative-layout-shift",
  "speed-index",
  "server-response-time",
  "interactive",
]) {
  const audit = lhr.audits[id];
  if (!audit) continue;
  console.log(id, "score", audit.score, "value", audit.numericValue, audit.displayValue);
}

const weights = lhr.categories.performance.auditRefs
  .filter((ref) => ref.weight)
  .map((ref) => `${ref.id} weight=${ref.weight} score=${lhr.audits[ref.id]?.score}`);
console.log(weights.join("\n"));
