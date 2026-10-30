/**
 * Fase 5 — Lighthouse de producción (sin modificar la app).
 *
 * Móvil: preset perf (throttling devtools, Slow 4G, CPU 4x, Moto G Power).
 * Desktop: preset oficial (Lantern simulate, Dense 4G, 1350×940).
 * Control: mismo viewport móvil, CPU 1x y red sin emular.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { cpus, hostname, platform, release, totalmem } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "fase5-prod");
const LOG = path.join(OUT, "runner.log");
const URL = "https://enflora.com.ar/";

const LH_ROOT = "C:/Users/VICTUS/AppData/Local/npm-cache/_npx/0f94ee7615faf582/node_modules/lighthouse";
const CHROME_LAUNCHER = pathToFileURL(
  "C:/Users/VICTUS/AppData/Local/npm-cache/_npx/0f94ee7615faf582/node_modules/chrome-launcher/dist/index.js",
).href;

const NEEDLES = [
  "443KPnf0kH9Fd6Om0573Cq",
  "flora-DJ",
  "Unite a nuestra playlist",
  "FF00AA",
  "requestIdleCallback",
  "flora-landing.png",
  "fetchpriority",
  "gsap",
  "ScrollTrigger",
  "motion/react",
  "@supabase/supabase-js",
  "WebGLRenderingContext",
  "componentes/landing/",
  "componentes/proveedor-motion",
  "side-rays",
  "magic-bento",
  "con-enflora",
];

function log(msg) {
  const line = `[fase5] ${new Date().toISOString()} ${msg}\n`;
  appendFileSync(LOG, line);
  process.stdout.write(line);
}

/** Node no usa el almacén de Windows; curl sí (inspección TLS local). */
function curlText(url) {
  const result = spawnSync("curl.exe", ["-fsSL", "--compressed", "--max-time", "90", url], {
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`curl ${result.status} ${url} ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function curlHeaders(url) {
  const result = spawnSync("curl.exe", ["-sI", "--max-time", "30", url], {
    encoding: "utf8",
    windowsHide: true,
  });
  const headers = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    headers[match[1].toLowerCase()] = match[2].trim();
  }
  const status = Number(result.stdout.match(/HTTP\/\S+\s+(\d+)/)?.[1] ?? 0);
  return { status, headers };
}

function audit(lhr, id) {
  return lhr.audits?.[id] ?? null;
}

function num(auditRef) {
  return typeof auditRef?.numericValue === "number" ? auditRef.numericValue : null;
}

function tableItems(auditRef) {
  return auditRef?.details?.items ?? [];
}

function lcpBreakdown(lhr) {
  const insight = audit(lhr, "lcp-breakdown-insight");
  const table = insight?.details?.items?.find((item) => item.type === "table");
  const node = insight?.details?.items?.find((item) => item.type === "node");
  const parts = {};
  for (const row of table?.items ?? []) {
    parts[row.subpart] = row.duration;
  }
  return {
    parts,
    selector: node?.selector ?? null,
    snippet: node?.snippet ?? null,
    nodeLabel: node?.nodeLabel ?? null,
    boundingRect: node?.boundingRect ?? null,
  };
}

function lcpDiscovery(lhr) {
  const insight = audit(lhr, "lcp-discovery-insight");
  const checklist = insight?.details?.items?.find((item) => item.type === "checklist");
  return checklist?.items ?? null;
}

function workBreakdown(lhr) {
  const rows = {};
  for (const row of tableItems(audit(lhr, "mainthread-work-breakdown"))) {
    rows[row.group] = row.duration;
  }
  return rows;
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

function extract(lhr) {
  const metrics = audit(lhr, "metrics")?.details?.items?.[0] ?? {};
  const lcpMs = num(audit(lhr, "largest-contentful-paint"));
  const fcpMs = num(audit(lhr, "first-contentful-paint"));
  const fpMs = metrics.observedFirstPaint ?? fcpMs;
  const requests = tableItems(audit(lhr, "network-requests")).map((item) => ({
    url: shortUrl(item.url),
    fullUrl: item.url,
    type: item.resourceType,
    mime: item.mimeType,
    start: item.networkRequestTime,
    end: item.networkEndTime,
    transfer: item.transferSize,
    size: item.resourceSize,
    status: item.statusCode,
    priority: item.priority,
  }));
  const beforePaint = requests.filter((item) => typeof item.end === "number" && item.end <= fpMs);
  const flora = requests.filter((item) => /flora-landing/i.test(item.url));
  const longTasks = tableItems(audit(lhr, "long-tasks"))
    .map((item) => ({
      url: shortUrl(item.url),
      fullUrl: item.url,
      start: item.startTime,
      duration: item.duration,
      beforeLcp: typeof lcpMs === "number" && item.startTime < lcpMs,
    }))
    .sort((a, b) => b.duration - a.duration);

  const reflows = [];
  for (const block of audit(lhr, "forced-reflow-insight")?.details?.items ?? []) {
    if (block.type !== "table") continue;
    for (const row of block.items ?? []) {
      if (!row.source) continue;
      reflows.push({
        url: shortUrl(row.source.url),
        fullUrl: row.source.url,
        line: row.source.line,
        column: row.source.column,
        reflowTime: row.reflowTime,
      });
    }
  }
  reflows.sort((a, b) => (b.reflowTime ?? 0) - (a.reflowTime ?? 0));

  return {
    requestedUrl: lhr.requestedUrl,
    fetchTime: lhr.fetchTime,
    lighthouseVersion: lhr.lighthouseVersion,
    benchmarkIndex: lhr.environment?.benchmarkIndex ?? null,
    warnings: lhr.runWarnings ?? [],
    formFactor: lhr.configSettings?.formFactor ?? null,
    throttlingMethod: lhr.configSettings?.throttlingMethod ?? null,
    throttling: lhr.configSettings?.throttling ?? null,
    screenEmulation: lhr.configSettings?.screenEmulation ?? null,
    performance: Math.round((lhr.categories?.performance?.score ?? 0) * 100),
    fcpMs,
    lcpMs,
    tbtMs: num(audit(lhr, "total-blocking-time")),
    siMs: num(audit(lhr, "speed-index")),
    cls: num(audit(lhr, "cumulative-layout-shift")),
    ttfbMs: metrics.timeToFirstByte ?? null,
    observed: {
      fp: metrics.observedFirstPaint ?? null,
      fcp: metrics.observedFirstContentfulPaint ?? null,
      lcp: metrics.observedLargestContentfulPaint ?? null,
      si: metrics.observedSpeedIndex ?? null,
      dcl: metrics.observedDomContentLoaded ?? null,
      load: metrics.observedLoad ?? null,
      lcpLoadStart: metrics.lcpLoadStart ?? null,
      lcpLoadEnd: metrics.lcpLoadEnd ?? null,
    },
    lcp: lcpBreakdown(lhr),
    lcpDiscovery: lcpDiscovery(lhr),
    mainThread: workBreakdown(lhr),
    bootup: tableItems(audit(lhr, "bootup-time")).slice(0, 12).map((item) => ({
      url: shortUrl(item.url),
      fullUrl: item.url,
      total: item.total,
      scripting: item.scripting,
      parse: item.scriptParseCompile,
    })),
    longTasks: longTasks.slice(0, 12),
    longTaskCount: tableItems(audit(lhr, "long-tasks")).length,
    renderBlocking: tableItems(audit(lhr, "render-blocking-resources")).map((item) => ({
      url: shortUrl(item.url),
      bytes: item.totalBytes,
      wastedMs: item.wastedMs,
    })),
    reflows: reflows.slice(0, 8),
    resourceSummary: tableItems(audit(lhr, "resource-summary")),
    flora,
    beforePaint: beforePaint.map((item) => ({
      url: item.url,
      type: item.type,
      end: item.end,
      transfer: item.transfer,
      priority: item.priority,
    })),
    requestCount: requests.length,
    requests,
  };
}

function traceOrigin(events) {
  for (const event of events) {
    if (event.name === "navigationStart" && typeof event.ts === "number") return event.ts;
  }
  for (const event of events) {
    if (event.name === "ResourceSendRequest" && typeof event.ts === "number") return event.ts;
  }
  return null;
}

function traceStacks(trace, longTasks) {
  const events = trace?.traceEvents ?? [];
  const origin = traceOrigin(events);
  if (origin == null) return { originFound: false, lcpCandidateMs: null, tasks: [] };

  let lcpCandidateMs = null;
  for (const event of events) {
    if (typeof event.ts !== "number") continue;
    if (!String(event.name).toLowerCase().includes("largestcontentfulpaint")) continue;
    const rel = (event.ts - origin) / 1000;
    if (lcpCandidateMs == null || rel > lcpCandidateMs) lcpCandidateMs = rel;
  }

  const interesting = new Set([
    "FunctionCall",
    "EvaluateScript",
    "v8.compile",
    "Layout",
    "UpdateLayoutTree",
    "RecalculateStyles",
    "ParseHTML",
    "Paint",
    "FireAnimationFrame",
    "TimerFire",
    "EventDispatch",
    "RunMicrotasks",
    "GPUTask",
    "CompositeLayers",
  ]);

  const tasks = [];
  for (const task of longTasks.slice(0, 5)) {
    const start = origin + task.start * 1000;
    const end = start + task.duration * 1000;
    const children = [];
    for (const event of events) {
      if (event.ph !== "X" || !event.dur || event.dur < 20000) continue;
      if (!interesting.has(event.name)) continue;
      if (event.ts < start || event.ts > end) continue;
      const data = event.args?.data ?? {};
      children.push({
        name: event.name,
        durMs: Math.round(event.dur / 10) / 100,
        url: data.url ? shortUrl(data.url) : "",
        functionName: data.functionName || data.scriptName || "",
        line: data.lineNumber ?? null,
        column: data.columnNumber ?? null,
      });
    }
    children.sort((a, b) => b.durMs - a.durMs);
    tasks.push({
      url: task.url,
      start: task.start,
      duration: task.duration,
      beforeLcp: task.beforeLcp,
      children: children.slice(0, 6),
    });
  }

  return { originFound: true, lcpCandidateMs, tasks };
}

function median(values) {
  const sorted = [...values].filter((value) => typeof value === "number").sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function verifyDeploy() {
  const response = curlHeaders(URL);
  const html = curlText(URL);
  const headers = response.headers;
  const linkHeader = headers.link ?? "";
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const floraImgs = imgs.filter((tag) => /flora-landing/i.test(tag));
  const needles = {};
  for (const needle of NEEDLES) needles[needle] = html.includes(needle);
  const buildPaths = [...html.matchAll(/\/_next\/static\/[^"'\\\s]+/g)].map((match) => match[0]);
  const uniqueBuild = [...new Set(buildPaths)].slice(0, 40);
  const report = {
    status: response.status,
    finalUrl: URL,
    headers,
    linkHeaderHasFlora: /flora-landing/i.test(linkHeader),
    preloadLinks: links.filter((tag) => /rel="preload"|rel='preload'/i.test(tag)).slice(0, 30),
    floraImgs,
    needlesInHtml: needles,
    sampleStaticPaths: uniqueBuild,
    htmlBytes: Buffer.byteLength(html),
  };
  writeFileSync(path.join(OUT, "verificacion-html.json"), JSON.stringify(report, null, 2));
  writeFileSync(path.join(OUT, "home.html"), html);
  log(`HTML ${response.status} ${report.htmlBytes} bytes cache=${headers["x-vercel-cache"]} floraImgs=${floraImgs.length}`);
  return report;
}

async function fingerprintScripts(extractData) {
  const urls = new Map();
  for (const row of extractData.bootup ?? []) {
    if (row.fullUrl?.startsWith("http")) urls.set(row.fullUrl, row.url);
  }
  for (const row of extractData.longTasks ?? []) {
    if (row.fullUrl?.startsWith("http")) urls.set(row.fullUrl, row.url);
  }
  const scripts = [];
  for (const [fullUrl, short] of urls) {
    if (scripts.length >= 14) break;
    try {
      const text = curlText(fullUrl);
      const response = { status: 200 };
      const hits = {};
      for (const needle of NEEDLES) hits[needle] = text.includes(needle);
      const modules = [
        ...new Set([...text.matchAll(/componentes\/[A-Za-z0-9_./-]+\.js/g)].map((match) => match[0])),
      ].slice(0, 40);
      const libs = [
        ...new Set(
          [...text.matchAll(/node_modules\/(?:\.pnpm\/)?(@?[^/"'\\]+)(?:\/[^/"'\\]+)?/g)].map((match) => match[0]),
        ),
      ].slice(0, 30);
      scripts.push({
        url: short,
        status: response.status,
        bytes: Buffer.byteLength(text),
        hits,
        modules,
        libs,
        hasSourceMapping: /sourceMappingURL/.test(text),
      });
      log(`chunk ${short} ${response.status} modules=${modules.length}`);
    } catch (error) {
      scripts.push({ url: short, error: String(error) });
    }
  }
  writeFileSync(path.join(OUT, "chunks-fingerprint.json"), JSON.stringify(scripts, null, 2));
  return scripts;
}

async function snippetAt(fullUrl, column) {
  if (!fullUrl || !fullUrl.startsWith("http") || typeof column !== "number") return null;
  const text = curlText(fullUrl);
  const col = Math.max(0, column);
  const start = Math.max(0, col - 180);
  const slice = text.slice(start, col + 180).replace(/\s+/g, " ");
  return slice;
}

async function runOnce(lighthouse, launch, label, config) {
  const chrome = await launch({
    chromeFlags: ["--headless=new", "--disable-gpu", "--no-first-run"],
  });
  try {
    log(`inicio ${label} puerto ${chrome.port}`);
    const result = await lighthouse(
      URL,
      {
        port: chrome.port,
        logLevel: "error",
        output: "json",
        onlyCategories: ["performance"],
      },
      config,
    );
    const summary = extract(result.lhr);
    const trace = result.artifacts?.Trace;
    summary.trace = traceStacks(trace, summary.longTasks);
    writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify(result.lhr));
    writeFileSync(path.join(OUT, `${label}.extract.json`), JSON.stringify(summary, null, 2));
    log(
      `fin ${label} perf=${summary.performance} FCP=${Math.round(summary.fcpMs)} LCP=${Math.round(summary.lcpMs)} TBT=${Math.round(summary.tbtMs)} SI=${Math.round(summary.siMs)} CLS=${summary.cls} method=${summary.throttlingMethod}`,
    );
    return summary;
  } finally {
    await chrome.kill();
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(LOG, "");
  log(`host ${hostname()} ${platform()} ${release()} cpus=${cpus().length} ramGiB=${(totalmem() / 1024 ** 3).toFixed(1)}`);
  log(`git esperado en el informe; URL ${URL}`);

  const htmlReport = await verifyDeploy();

  const lighthouseModule = await import(pathToFileURL(path.join(LH_ROOT, "core/index.js")).href);
  const perfConfig = (await import(pathToFileURL(path.join(LH_ROOT, "core/config/perf-config.js")).href)).default;
  const desktopConfig = (await import(pathToFileURL(path.join(LH_ROOT, "core/config/desktop-config.js")).href)).default;
  const crossover = require(path.join(__dirname, "fase5-mobile-viewport-rapido.config.cjs"));
  const { launch } = await import(CHROME_LAUNCHER);

  const plan = [
    { label: "warmup-mobile", config: perfConfig, scored: false, group: "mobile" },
    { label: "mobile-1", config: perfConfig, scored: true, group: "mobile" },
    { label: "mobile-2", config: perfConfig, scored: true, group: "mobile" },
    { label: "mobile-3", config: perfConfig, scored: true, group: "mobile" },
    { label: "desktop-1", config: desktopConfig, scored: true, group: "desktop" },
    { label: "desktop-2", config: desktopConfig, scored: true, group: "desktop" },
    { label: "desktop-3", config: desktopConfig, scored: true, group: "desktop" },
    { label: "mobile-sin-throttling", config: crossover, scored: true, group: "control" },
  ];

  const summaries = [];
  for (const step of plan) {
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const summary = await runOnce(lighthouseModule.default, launch, step.label, step.config);
        summaries.push({ ...step, summary });
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        log(`error ${step.label} intento ${attempt}: ${error?.stack || error}`);
      }
    }
    if (lastError) throw lastError;
  }

  const mobile = summaries.filter((item) => item.group === "mobile" && item.scored).map((item) => item.summary);
  const medianPerf = median(mobile.map((item) => item.performance));
  const representative = mobile.find((item) => item.performance === medianPerf) ?? mobile[1];
  log(`fingerprint sobre corrida representativa perf=${representative?.performance}`);
  const chunks = representative ? await fingerprintScripts(representative) : [];

  const reflowSnippets = [];
  for (const row of (representative?.reflows ?? []).slice(0, 4)) {
    try {
      reflowSnippets.push({
        ...row,
        snippet: await snippetAt(row.fullUrl, row.column),
      });
    } catch (error) {
      reflowSnippets.push({ ...row, error: String(error) });
    }
  }
  writeFileSync(path.join(OUT, "reflow-snippets.json"), JSON.stringify(reflowSnippets, null, 2));

  const groups = ["mobile", "desktop", "control"];
  const stats = {};
  for (const group of groups) {
    const rows = summaries.filter((item) => item.group === group && item.scored).map((item) => item.summary);
    stats[group] = {
      n: rows.length,
      performance: median(rows.map((row) => row.performance)),
      fcpMs: median(rows.map((row) => row.fcpMs)),
      lcpMs: median(rows.map((row) => row.lcpMs)),
      tbtMs: median(rows.map((row) => row.tbtMs)),
      siMs: median(rows.map((row) => row.siMs)),
      cls: median(rows.map((row) => row.cls)),
      jsEval: median(rows.map((row) => row.mainThread.scriptEvaluation)),
      styleLayout: median(rows.map((row) => row.mainThread.styleLayout)),
    };
  }

  const manifest = {
    url: URL,
    when: new Date().toISOString(),
    protocol: {
      mobile: "lighthouse perf-config: throttlingMethod=devtools, Slow 4G, CPU 4x, 412x823 DPR 1.75",
      desktop: "lighthouse desktop-config: throttlingMethod=simulate, Dense 4G, CPU 1x, 1350x940 DPR 1",
      control: "viewport móvil, throttlingMethod=devtools, CPU 1x, red sin emular",
      warmupExcluded: true,
      runs: 3,
    },
    htmlMarkers: {
      floraImgs: htmlReport.floraImgs.length,
      linkHeaderHasFlora: htmlReport.linkHeaderHasFlora,
      needlesInHtml: htmlReport.needlesInHtml,
    },
    stats,
    chunksHitSummary: chunks.map((chunk) => ({
      url: chunk.url,
      bytes: chunk.bytes,
      modules: chunk.modules,
      hits: chunk.hits,
    })),
    labels: summaries.map((item) => ({
      label: item.label,
      group: item.group,
      scored: item.scored,
      performance: item.summary.performance,
      lcpMs: item.summary.lcpMs,
      tbtMs: item.summary.tbtMs,
    })),
  };
  writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  log("listo");
}

main().catch((error) => {
  log(`FATAL ${error?.stack || error}`);
  process.exitCode = 1;
});
