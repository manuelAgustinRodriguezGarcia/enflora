import { readFileSync } from "node:fs";

const lhr = JSON.parse(readFileSync(new URL("./lhr.json", import.meta.url), "utf8"));
const fails = lhr.categories.accessibility.auditRefs
  .map((ref) => lhr.audits[ref.id])
  .filter((audit) => audit && audit.score !== null && audit.score < 1)
  .map((audit) => ({ id: audit.id, title: audit.title, score: audit.score, display: audit.displayValue ?? null }));
console.log(JSON.stringify(fails, null, 2));

const img = lhr.audits["network-requests"].details.items.find((item) => item.url.includes("flora-landing.png"));
console.log("image keys sample", Object.keys(img));
console.log(JSON.stringify({
  start: img.networkRequestTime,
  end: img.networkEndTime,
  transfer: img.transferSize,
  priority: img.priority,
  status: img.statusCode,
  protocol: img.protocol,
  mime: img.mimeType,
}, null, 2));
