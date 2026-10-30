#!/usr/bin/env node
/**
 * A/B Lighthouse Fase 3 vs Fase 4 — dos builds en worktrees, reanudable.
 *
 * Uso (desde la raíz del repo):
 *   node mediciones/ab-fase4-lighthouse.mjs
 *   node mediciones/ab-fase4-lighthouse.mjs --resume mediciones/ab-fase4-runs/v2-2026-...
 *
 * No modifica el working tree principal.
 */

import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { hostname, platform, release, arch, cpus, totalmem } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const EXPERIMENT_VERSION = 2;
const PORT = Number.parseInt(process.env.AB_LIGHTHOUSE_PORT ?? "3005", 10);
const URL = `http://127.0.0.1:${PORT}/`;
const PATCH = path.join(__dirname, "patches", "fase4-viewport-main-thread.patch");
const WORKTREES_ROOT = path.join(__dirname, "worktrees");
const WORKTREE_A = path.join(WORKTREES_ROOT, "ab-fase4-a");
const WORKTREE_B = path.join(WORKTREES_ROOT, "ab-fase4-b");

const FASE4_FILES = [
  "componentes/landing/magic-bento.js",
  "componentes/landing/particles.js",
  "componentes/landing/side-rays.js",
];

const LH_ARGS = [
  URL,
  "--only-categories=performance",
  "--preset=perf",
  "--output=json",
  "--quiet",
  "--chrome-flags=--headless=new",
];

const RUN_PLAN = [
  { label: "warmup-a", version: "A", scored: false },
  { label: "warmup-b", version: "B", scored: false },
  { label: "a1", version: "A", scored: true },
  { label: "b1", version: "B", scored: true },
  { label: "a2", version: "A", scored: true },
  { label: "b2", version: "B", scored: true },
  { label: "a3", version: "A", scored: true },
  { label: "b3", version: "B", scored: true },
  { label: "a4", version: "A", scored: true },
  { label: "b4", version: "B", scored: true },
  { label: "a5", version: "A", scored: true },
  { label: "b5", version: "B", scored: true },
];

function parseArgs() {
  const i = process.argv.indexOf("--resume");
  if (i >= 0 && process.argv[i + 1]) {
    return { resumeDir: path.resolve(REPO_ROOT, process.argv[i + 1]) };
  }
  return { resumeDir: null };
}

function isoStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function log(msg) {
  process.stdout.write(`[ab-fase4] ${msg}\n`);
}

function git(args, cwd = REPO_ROOT) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${r.stderr || r.stdout}`);
  }
  return (r.stdout ?? "").trim();
}

function runIn(cwd, cmd, args, opts = {}) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    stdio: opts.inherit ? "inherit" : "pipe",
    env: { ...process.env, ...opts.env },
    shell: platform() === "win32",
  });
  const durationMs = Date.now() - t0;
  if (r.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(" ")} @ ${cwd} failed (${r.status}): ${r.stderr || r.stdout}`,
    );
  }
  return { stdout: r.stdout ?? "", durationMs };
}

function lighthouseVersion() {
  return runIn(REPO_ROOT, "npx", ["--yes", "lighthouse", "--version"]).stdout.trim();
}

function chromePath() {
  const r = spawnSync(
    "npx",
    ["--yes", "chrome-launcher", "print", "chrome-path"],
    { cwd: REPO_ROOT, encoding: "utf8", shell: platform() === "win32" },
  );
  return r.status === 0 ? (r.stdout ?? "").trim() : "unknown";
}

function readBuildId(worktreeDir) {
  const p = path.join(worktreeDir, ".next", "BUILD_ID");
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf8").trim();
}

function hashFiles(worktreeDir, relPaths) {
  const h = createHash("sha256");
  for (const rel of relPaths) {
    h.update(readFileSync(path.join(worktreeDir, rel)));
  }
  return h.digest("hex").slice(0, 16);
}

function syncEnvFiles(worktreeDir) {
  for (const name of [".env", ".env.local"]) {
    const src = path.join(REPO_ROOT, name);
    const dest = path.join(worktreeDir, name);
    if (existsSync(src)) copyFileSync(src, dest);
  }
}

function ensureNodeModules(worktreeDir) {
  const nm = path.join(worktreeDir, "node_modules");
  if (existsSync(nm)) return;
  log(`pnpm install en ${path.relative(REPO_ROOT, worktreeDir)}…`);
  runIn(worktreeDir, "pnpm", ["install"], { inherit: true });
}

function worktreePath(version) {
  return version === "A" ? WORKTREE_A : WORKTREE_B;
}

function ensureWorktrees(manifest) {
  mkdirSync(WORKTREES_ROOT, { recursive: true });
  const commit = git(["rev-parse", "HEAD"]);
  manifest.baseCommit = commit;

  for (const [version, dir] of [
    ["A", WORKTREE_A],
    ["B", WORKTREE_B],
  ]) {
    if (!existsSync(path.join(dir, ".git"))) {
      log(`Creando worktree ${version}: ${path.relative(REPO_ROOT, dir)}`);
      runIn(REPO_ROOT, "git", [
        "worktree",
        "add",
        dir,
        commit,
        "--detach",
      ]);
    }
    syncEnvFiles(dir);
    ensureNodeModules(dir);

    runIn(dir, "git", ["checkout", "HEAD", "--", ...FASE4_FILES]);
    if (version === "B") {
      const check = spawnSync("git", ["apply", "--check", PATCH], {
        cwd: dir,
        encoding: "utf8",
      });
      if (check.status === 0) {
        runIn(dir, "git", ["apply", PATCH]);
      }
    }

    manifest.worktrees[version] = {
      path: path.relative(REPO_ROOT, dir),
      commit,
      sourceHash: hashFiles(dir, FASE4_FILES),
    };
  }

  if (manifest.worktrees.A.sourceHash === manifest.worktrees.B.sourceHash) {
    throw new Error("A y B tienen el mismo hash de fuente; el patch no se aplicó en B.");
  }
}

function killPort(port) {
  if (platform() === "win32") {
    spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `$c=Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue; if($c){$c|ForEach-Object{Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue}}`,
      ],
      { stdio: "ignore" },
    );
    return;
  }
  spawnSync("bash", ["-lc", `fuser -k ${port}/tcp 2>/dev/null || true`], {
    stdio: "ignore",
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(expectedBuildId, timeoutMs = 180_000) {
  const origin = URL.replace(/\/$/, "");
  const manifestUrl = `${origin}/_next/static/${expectedBuildId}/_buildManifest.js`;
  const start = Date.now();
  let delay = 150;
  while (Date.now() - start < timeoutMs) {
    try {
      const home = await fetch(URL, { redirect: "follow" });
      if (!home.ok) throw new Error(`HTTP ${home.status}`);
      const manifest = await fetch(manifestUrl, { redirect: "follow" });
      if (manifest.ok) return;
    } catch {
      /* retry */
    }
    await sleep(delay);
    delay = Math.min(delay * 1.25, 2000);
  }
  throw new Error(
    `Servidor no sirve buildId ${expectedBuildId} (${manifestUrl}) tras ${timeoutMs}ms`,
  );
}

let serverProc = null;
let serverWorktree = null;

function stopServer() {
  if (serverProc?.pid) {
    if (platform() === "win32") {
      spawnSync("taskkill", ["/PID", String(serverProc.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      try {
        serverProc.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    }
  }
  serverProc = null;
  serverWorktree = null;
  killPort(PORT);
}

async function startServer(worktreeDir, expectedBuildId) {
  if (serverWorktree === worktreeDir && serverProc) {
    await waitForServer(expectedBuildId, 30_000);
    return;
  }
  stopServer();
  await sleep(400);
  serverProc = spawn("pnpm", ["start"], {
    cwd: worktreeDir,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
    shell: platform() === "win32",
  });
  serverWorktree = worktreeDir;
  await waitForServer(expectedBuildId);
}

function buildVariant(version, manifest) {
  const dir = worktreePath(version);
  if (manifest.builds?.[version]?.buildId && existsSync(path.join(dir, ".next", "BUILD_ID"))) {
    const onDisk = readBuildId(dir);
    if (onDisk === manifest.builds[version].buildId) {
      log(`Build ${version} reutilizado (${onDisk})`);
      return manifest.builds[version];
    }
  }
  log(`pnpm build versión ${version}…`);
  const { durationMs } = runIn(dir, "pnpm", ["build"], { inherit: true });
  const buildId = readBuildId(dir);
  if (!buildId) throw new Error(`Sin BUILD_ID tras build ${version}`);
  const meta = {
    buildId,
    durationMs,
    builtAt: new Date().toISOString(),
    sourceHash: hashFiles(dir, FASE4_FILES),
    worktree: path.relative(REPO_ROOT, dir),
  };
  manifest.builds = manifest.builds ?? {};
  manifest.builds[version] = meta;
  writeFileSync(
    path.join(manifest._outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  log(`Build ${version} listo: ${buildId} (${Math.round(durationMs / 1000)}s)`);
  return meta;
}

function extractMetrics(lighthouseJsonPath) {
  const j = JSON.parse(readFileSync(lighthouseJsonPath, "utf8"));
  if (!j.categories?.performance) {
    throw new Error(`JSON incompleto: ${lighthouseJsonPath}`);
  }
  const a = j.audits ?? {};
  const mt = a["mainthread-work-breakdown"]?.details?.items ?? [];
  const mtMap = Object.fromEntries(mt.map((i) => [i.group, i.duration]));
  const longTasks = a["long-tasks"]?.details?.items ?? [];
  const longDurations = longTasks.map((t) => t.duration ?? 0);
  return {
    lighthouseVersion: j.lighthouseVersion,
    performance: Math.round((j.categories.performance.score ?? 0) * 100),
    fcpMs: a["first-contentful-paint"]?.numericValue ?? null,
    lcpMs: a["largest-contentful-paint"]?.numericValue ?? null,
    tbtMs: a["total-blocking-time"]?.numericValue ?? null,
    speedIndexMs: a["speed-index"]?.numericValue ?? null,
    cls: a["cumulative-layout-shift"]?.numericValue ?? null,
    scriptEvaluationMs: mtMap.scriptEvaluation ?? null,
    styleLayoutMs: mtMap.styleLayout ?? null,
    longTaskMaxMs: longDurations.length ? Math.max(...longDurations) : 0,
    longTaskSumMs: longDurations.reduce((s, d) => s + d, 0),
    longTaskCount: longTasks.length,
  };
}

function runLighthouse(outJson) {
  const args = [...LH_ARGS, `--output-path=${outJson}`];
  const t0 = Date.now();
  runIn(REPO_ROOT, "npx", ["--yes", "lighthouse", ...args], { inherit: true });
  const durationMs = Date.now() - t0;
  const metrics = extractMetrics(outJson);
  return { metrics, durationMs };
}

function findRunInManifest(manifest, label) {
  return manifest.runs?.find((r) => r.label === label && r.status === "complete");
}

function isRunComplete(outDir, label, manifest) {
  const entry = findRunInManifest(manifest, label);
  const jsonPath = path.join(outDir, `${label}.json`);
  if (!entry || !existsSync(jsonPath)) return false;
  try {
    extractMetrics(jsonPath);
    return true;
  } catch {
    return false;
  }
}

function createManifest(outDir) {
  return {
    experimentVersion: EXPERIMENT_VERSION,
    protocol: "two-worktree-builds-interleaved",
    priorExploratoryNote:
      "Corridas en carpetas sin v2- (p. ej. 2026-10-30T00-25-09) son referencia v1; no mezclar.",
    startedAt: new Date().toISOString(),
    repoRoot: REPO_ROOT,
    gitCommit: git(["rev-parse", "HEAD"]),
    gitDescribe: git(["describe", "--always", "--dirty"]),
    versionA: {
      label: "Fase 3 (fin) — sin patch viewport Fase 4",
      files: FASE4_FILES,
    },
    versionB: {
      label: "Fase 4 — patch viewport",
      patch: path.relative(REPO_ROOT, PATCH),
      files: FASE4_FILES,
    },
    lighthouse: {
      preset: "perf",
      onlyCategories: ["performance"],
      url: URL,
      port: PORT,
      chromeFlags: "--headless=new",
      lighthouseVersion: lighthouseVersion(),
      chromePathNote: chromePath(),
    },
    environment: {
      hostname: hostname(),
      platform: platform(),
      osRelease: release(),
      arch,
      cpuModel: cpus()[0]?.model,
      cpuCount: cpus().length,
      totalMemGiB: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
      node: process.version,
    },
    worktrees: {},
    builds: {},
    runs: [],
    _outDir: outDir,
  };
}

async function main() {
  if (!existsSync(PATCH)) throw new Error(`Falta patch: ${PATCH}`);

  const { resumeDir } = parseArgs();
  let outDir;
  let manifest;

  if (resumeDir) {
    outDir = resumeDir;
    manifest = JSON.parse(readFileSync(path.join(outDir, "manifest.json"), "utf8"));
    manifest._outDir = outDir;
    if (manifest.experimentVersion !== EXPERIMENT_VERSION) {
      throw new Error("Carpeta de resume no es experimento v2");
    }
    log(`Reanudando ${path.relative(REPO_ROOT, outDir)}`);
  } else {
    outDir = path.join(__dirname, "ab-fase4-runs", `v2-${isoStamp()}`);
    mkdirSync(outDir, { recursive: true });
    manifest = createManifest(outDir);
    writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  }

  ensureWorktrees(manifest);
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  buildVariant("A", manifest);
  buildVariant("B", manifest);

  let activeVersion = null;
  const total = RUN_PLAN.length;
  let index = 0;

  try {
    for (const step of RUN_PLAN) {
      index += 1;
      if (isRunComplete(outDir, step.label, manifest)) {
        log(`[${index}/${total}] ${step.label} — omitida (ya completa)`);
        continue;
      }

      if (step.version !== activeVersion) {
        const wt = worktreePath(step.version);
        const buildId = manifest.builds[step.version].buildId;
        log(`[${index}/${total}] Servidor versión ${step.version} (build ${buildId})…`);
        await startServer(wt, buildId);
        activeVersion = step.version;
      }

      const outJson = path.join(outDir, `${step.label}.json`);
      log(`[${index}/${total}] Lighthouse ${step.label}…`);
      const { metrics, durationMs: lhMs } = runLighthouse(outJson);

      manifest.runs = manifest.runs.filter((r) => r.label !== step.label);
      manifest.runs.push({
        label: step.label,
        version: step.version,
        scored: step.scored,
        buildId: manifest.builds[step.version].buildId,
        sourceHash: manifest.worktrees[step.version].sourceHash,
        outputJson: path.relative(REPO_ROOT, outJson),
        lighthouseDurationMs: lhMs,
        finishedAt: new Date().toISOString(),
        status: "complete",
        metrics,
      });
      writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
      log(
        `[${index}/${total}] ${step.label} OK — Perf ${metrics.performance}, TBT ${Math.round(metrics.tbtMs)} ms (LH ${Math.round(lhMs / 1000)}s)`,
      );
    }
  } finally {
    stopServer();
  }

  manifest.finishedAt = new Date().toISOString();
  manifest.status = "complete";
  delete manifest._outDir;
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  log(`Experimento completo: ${path.relative(REPO_ROOT, outDir)}`);
  log("Analizando…");
  runIn(REPO_ROOT, "node", [
    path.join(__dirname, "ab-fase4-analizar.mjs"),
    path.relative(REPO_ROOT, outDir),
  ], { inherit: true });
}

main().catch((err) => {
  console.error(err);
  stopServer();
  process.exitCode = 1;
});
