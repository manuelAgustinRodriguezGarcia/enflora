import { readFileSync } from "node:fs";

const lhr = JSON.parse(readFileSync("mediciones/lh-fase7/lhr.json", "utf8"));
const m = lhr.audits.metrics.details.items[0];
const obs = lhr.audits["largest-contentful-paint"].numericValue;
const breakdown = lhr.audits["lcp-breakdown-insight"]?.details?.items?.[0]?.items;
const metric = lhr.audits["largest-contentful-paint-element"];
console.log(JSON.stringify({
  performance: lhr.categories.performance.score,
  fcp: m.firstContentfulPaint,
  lcp: m.largestContentfulPaint,
  tbt: m.totalBlockingTime,
  cls: m.cumulativeLayoutShift,
  si: m.speedIndex,
  ttfb: m.timeToFirstByte,
  observed: {
    fcp: m.observedFirstContentfulPaint,
    lcp: m.observedLargestContentfulPaint,
    si: m.observedSpeedIndex,
    ttfb: m.observedTimeToFirstByte,
    load: m.observedLoad,
    traceEnd: m.observedTraceEnd,
  },
  breakdown,
  lcpAudit: lhr.audits["largest-contentful-paint"].numericValue,
  server: lhr.audits["server-response-time"]?.numericValue,
  longTasks: lhr.audits["long-tasks"]?.details?.items?.map((t) => ({
    dur: t.duration,
    start: t.startTime,
    url: t.url?.replace("https://enflora.com.ar", ""),
  })),
  boot: lhr.audits["bootup-time"]?.details?.items?.slice(0, 8).map((i) => ({
    url: i.url.replace("https://enflora.com.ar", "").slice(0, 80),
    total: i.total,
    script: i.scripting,
  })),
}, null, 2));
