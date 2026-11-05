import { readFileSync, writeFileSync } from "node:fs";

const lhr = JSON.parse(readFileSync(new URL("./lhr.json", import.meta.url), "utf8"));

function audit(id) {
  return lhr.audits?.[id] ?? null;
}

function num(id) {
  const value = audit(id)?.numericValue;
  return typeof value === "number" ? value : null;
}

function items(id) {
  return audit(id)?.details?.items ?? [];
}

function shortUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

const metrics = audit("metrics")?.details?.items?.[0] ?? {};
const categories = {};
for (const [key, category] of Object.entries(lhr.categories ?? {})) {
  categories[key] = Math.round((category.score ?? 0) * 100);
}

const insightIds = Object.keys(lhr.audits).filter(
  (id) =>
    id.includes("insight") ||
    [
      "legacy-javascript",
      "render-blocking-resources",
      "unused-javascript",
      "unused-css-rules",
      "dom-size",
      "bootup-time",
      "mainthread-work-breakdown",
      "long-tasks",
      "network-requests",
      "largest-contentful-paint-element",
      "lcp-lazy-loaded",
      "prioritize-lcp-image",
      "total-byte-weight",
      "uses-responsive-images",
      "uses-optimized-images",
      "modern-image-formats",
      "offscreen-images",
      "unsized-images",
      "critical-request-chains",
    ].includes(id),
);

const insights = {};
for (const id of insightIds) {
  const entry = audit(id);
  insights[id] = {
    title: entry.title,
    score: entry.score,
    display: entry.displayValue ?? null,
    numeric: entry.numericValue ?? null,
    description: entry.description?.slice(0, 240) ?? "",
    metricSavings: entry.metricSavings ?? null,
    detailsType: entry.details?.type ?? null,
    headings: entry.details?.headings ?? null,
    items: entry.details?.items ?? null,
  };
}

const summary = {
  requestedUrl: lhr.requestedUrl,
  finalUrl: lhr.finalDisplayedUrl ?? lhr.finalUrl,
  fetchTime: lhr.fetchTime,
  lighthouseVersion: lhr.lighthouseVersion,
  warnings: lhr.runWarnings ?? [],
  runtimeError: lhr.runtimeError ?? null,
  formFactor: lhr.configSettings?.formFactor,
  throttlingMethod: lhr.configSettings?.throttlingMethod,
  throttling: lhr.configSettings?.throttling,
  screenEmulation: lhr.configSettings?.screenEmulation,
  categories,
  metrics: {
    fcp: num("first-contentful-paint"),
    lcp: num("largest-contentful-paint"),
    tbt: num("total-blocking-time"),
    cls: num("cumulative-layout-shift"),
    si: num("speed-index"),
    ttfb: metrics.timeToFirstByte ?? null,
    interactive: num("interactive"),
    observed: {
      fcp: metrics.observedFirstContentfulPaint ?? null,
      lcp: metrics.observedLargestContentfulPaint ?? null,
      si: metrics.observedSpeedIndex ?? null,
      tbt: metrics.observedTotalBlockingTime ?? null,
      cls: metrics.observedCumulativeLayoutShift ?? null,
    },
  },
  lcpElement: audit("largest-contentful-paint-element")?.details ?? null,
  longTasks: items("long-tasks").map((item) => ({
    url: shortUrl(item.url),
    start: item.startTime,
    duration: item.duration,
  })),
  bootup: items("bootup-time").slice(0, 15).map((item) => ({
    url: shortUrl(item.url),
    total: item.total,
    scripting: item.scripting,
    parse: item.scriptParseCompile,
  })),
  mainThread: items("mainthread-work-breakdown"),
  renderBlocking: items("render-blocking-resources"),
  legacy: items("legacy-javascript"),
  dom: audit("dom-size")?.details ?? null,
  chains: audit("critical-request-chains")?.details ?? null,
};

writeFileSync(new URL("./resumen.json", import.meta.url), JSON.stringify(summary, null, 2));
writeFileSync(new URL("./insights.json", import.meta.url), JSON.stringify(insights, null, 2));

console.log(
  JSON.stringify(
    {
      categories,
      metrics: summary.metrics,
      warnings: summary.warnings,
      runtimeError: summary.runtimeError,
      insightTitles: Object.fromEntries(
        Object.entries(insights).map(([id, value]) => [id, { score: value.score, display: value.display, savings: value.metricSavings }]),
      ),
    },
    null,
    2,
  ),
);
