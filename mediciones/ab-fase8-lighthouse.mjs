#!/usr/bin/env node
/**
 * A/B Fase 8. A = HEAD (fase 7). B = copia del árbol de trabajo (ScrollTrigger diferido).
 * Dos builds, cinco Lighthouse Mobile intercalados. No recompila entre corridas.
 */

import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { cpus, totalmem, platform } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const PORT = 3468;
const URL = `http://127.0.0.1:${PORT}/`;
const A_DIR = path.join(__dirname, "worktrees", "ab-fase8-a");
const B_DIR = path.join(__dirname, "worktrees", "ab-fase8-b");
const LH = "C:/Users/VICTUS/AppData/Local/npm-cache/_npx/0f94ee7615faf582/node_modules/lighthouse/cli/index.js";

const ARCHIVOS = [
  "componentes/landing/gsap.js",
  "componentes/landing/scroll-trigger.js",
  "componentes/landing/hero.js",
  "componentes/landing/revelar.js",
  "componentes/landing/desplazar-seccion.js",
  "componentes/landing/con-enflora.js",
  "componentes/landing/cierre.js",
  "componentes/landing/historial.js",
];

const PLAN = [
  ["a1", "A"],
  ["b1", "B"],
  ["a2", "A"],
  ["b2", "B"],
  ["a3", "A"],
  ["b3", "B"],
  ["a4", "A"],
  ["b4", "B"],
  ["a5", "A"],
  ["b5", "B"],
];

function log(mensaje) {
  process.stdout.write(`[fase8] ${mensaje}\n`);
}

function git(args, cwd = REPO) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return (r.stdout || "").trim();
}

function correr(cwd, cmd, args, heredado = false) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    stdio: heredado ? "inherit" : "pipe",
    shell: platform() === "win32",
    env: process.env,
  });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} falló (${r.status})\n${r.stderr || r.stdout || ""}`);
  }
}

function hashArchivos(dir) {
  const h = createHash("sha256");
  for (const rel of ARCHIVOS) {
    const p = path.join(dir, rel);
    h.update(existsSync(p) ? readFileSync(p) : "AUSENTE");
  }
  return h.digest("hex").slice(0, 16);
}

function asegurarModulos(dir) {
  const destino = path.join(dir, "node_modules");
  if (existsSync(destino)) {
    const st = statSync(destino);
    if (!st.isSymbolicLink()) return;
    rmSync(destino, { recursive: true, force: true });
  }
  log(`pnpm install en ${path.basename(dir)}`);
  correr(dir, "pnpm", ["install"], true);
}

function asegurarArboles() {
  const commit = git(["rev-parse", "HEAD"]);
  for (const [version, dir] of [["A", A_DIR], ["B", B_DIR]]) {
    if (!existsSync(path.join(dir, ".git"))) {
      log(`worktree ${version}`);
      correr(REPO, "git", ["worktree", "add", "--detach", dir, commit]);
    }
    for (const nombre of [".env", ".env.local"]) {
      const origen = path.join(REPO, nombre);
      if (existsSync(origen)) copyFileSync(origen, path.join(dir, nombre));
    }
    asegurarModulos(dir);
    if (version === "B") {
      for (const rel of ARCHIVOS) {
        const origen = path.join(REPO, rel);
        if (!existsSync(origen)) continue;
        const destino = path.join(dir, rel);
        mkdirSync(path.dirname(destino), { recursive: true });
        copyFileSync(origen, destino);
      }
    }
  }
  if (hashArchivos(A_DIR) === hashArchivos(B_DIR)) {
    throw new Error("A y B quedaron iguales");
  }
}

function buildId(dir) {
  return readFileSync(path.join(dir, ".next", "BUILD_ID"), "utf8").trim();
}

function compilar(dir, version) {
  if (existsSync(path.join(dir, ".next", "BUILD_ID")) && process.env.FASE8_REBUILD !== "1") {
    log(`build ${version} ya existe (${buildId(dir)})`);
    return;
  }
  log(`compilando ${version}`);
  correr(dir, "pnpm", ["build"], true);
}

function chunksDe(dir) {
  const raiz = path.join(dir, ".next", "static", "chunks");
  const hallados = [];
  const visitar = (actual) => {
    for (const nombre of readdirSync(actual)) {
      const p = path.join(actual, nombre);
      if (statSync(p).isDirectory()) {
        visitar(p);
        continue;
      }
      if (!nombre.endsWith(".js")) continue;
      const texto = readFileSync(p, "utf8");
      const marcas = ["ScrollTrigger", "registerPlugin", "motion/react", "framer"].filter((m) => texto.includes(m));
      if (marcas.length) {
        hallados.push({
          archivo: path.relative(path.join(dir, ".next"), p).replaceAll("\\", "/"),
          bytes: statSync(p).size,
          marcas,
        });
      }
    }
  };
  if (existsSync(raiz)) visitar(raiz);
  return hallados.sort((a, b) => b.bytes - a.bytes);
}

function matarPuerto() {
  spawnSync(
    "powershell",
    ["-NoProfile", "-Command", `$c=Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue; if($c){$c|ForEach-Object{Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue}}`],
    { stdio: "ignore" },
  );
}

let servidor = null;

function frenar() {
  if (servidor?.pid) spawnSync("taskkill", ["/PID", String(servidor.pid), "/T", "/F"], { stdio: "ignore" });
  servidor = null;
  matarPuerto();
}

async function esperar(id) {
  const manifiesto = `${URL}_next/static/${id}/_buildManifest.js`;
  const limite = Date.now() + 180000;
  while (Date.now() < limite) {
    try {
      const pagina = await fetch(URL);
      const estatico = await fetch(manifiesto);
      if (pagina.ok && estatico.ok) return;
    } catch {
      /* todavía no */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`el servidor no publicó ${id}`);
}

async function servir(dir) {
  frenar();
  await new Promise((r) => setTimeout(r, 400));
  const id = buildId(dir);
  servidor = spawn("pnpm", ["exec", "next", "start", "-p", String(PORT)], {
    cwd: dir,
    stdio: "ignore",
    shell: platform() === "win32",
    env: process.env,
  });
  await esperar(id);
  return id;
}

function metricas(archivo) {
  const j = JSON.parse(readFileSync(archivo, "utf8"));
  const item = j.audits.metrics.details.items[0];
  const partes = j.audits["lcp-breakdown-insight"]?.details?.items?.[0]?.items ?? [];
  const fase = Object.fromEntries(partes.map((p) => [p.subpart, p.duration]));
  const fcpObs = item.observedFirstContentfulPaint;
  const largas = (j.audits["long-tasks"]?.details?.items ?? []).filter((t) => t.startTime < fcpObs);
  const boot = j.audits["bootup-time"]?.details?.items ?? [];
  const scripts = (j.audits["network-requests"]?.details?.items ?? []).filter((r) =>
    (r.resourceType === "Script" || String(r.url).includes("/_next/static/")) && r.resourceType === "Script",
  );
  return {
    performance: Math.round((j.categories.performance.score ?? 0) * 100),
    fcp: Math.round(item.firstContentfulPaint),
    lcpSimulado: Math.round(item.largestContentfulPaint),
    lcpObservado: Math.round(item.observedLargestContentfulPaint),
    fcpObservado: Math.round(fcpObs),
    renderDelay: Math.round(fase.elementRenderDelay ?? 0),
    loadDelay: Math.round(fase.resourceLoadDelay ?? 0),
    tbt: Math.round(item.totalBlockingTime),
    si: Math.round(item.speedIndex),
    cls: item.cumulativeLayoutShift,
    scriptEvaluation: Math.round(
      (j.audits["mainthread-work-breakdown"]?.details?.items ?? []).find((i) => i.group === "scriptEvaluation")?.duration ?? 0,
    ),
    tareasAntesDelPaint: largas.length,
    tareasAntesDelPaintMs: Math.round(largas.reduce((s, t) => s + t.duration, 0)),
    bootScriptMs: Math.round(boot.reduce((s, i) => s + (i.scripting || 0), 0)),
    scripts: scripts.length,
  };
}

function mediana(valores) {
  const lista = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(lista.length / 2);
  if (lista.length % 2) return lista[medio];
  return Math.round((lista[medio - 1] + lista[medio]) / 2);
}

async function main() {
  const salida = path.join(__dirname, "ab-fase8-runs", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19));
  mkdirSync(salida, { recursive: true });
  asegurarArboles();
  compilar(A_DIR, "A");
  compilar(B_DIR, "B");
  const chunks = { A: chunksDe(A_DIR), B: chunksDe(B_DIR) };
  writeFileSync(path.join(salida, "chunks.json"), JSON.stringify(chunks, null, 2));
  const corridas = [];
  for (const [etiqueta, version] of PLAN) {
    const dir = version === "A" ? A_DIR : B_DIR;
    log(`${etiqueta} build ${buildId(dir)}`);
    await servir(dir);
    const json = path.join(salida, `${etiqueta}.json`);
    const args = [
      LH,
      URL,
      "--form-factor=mobile",
      "--only-categories=performance",
      "--output=json",
      `--output-path=${json}`,
      "--chrome-flags=--headless=new",
      "--quiet",
    ];
    if (etiqueta === "b5") args.push("--save-assets");
    const r = spawnSync(process.execPath, args, { cwd: REPO, encoding: "utf8", shell: false });
    if (r.status !== 0) throw new Error(r.stderr || r.stdout || `lighthouse ${etiqueta}`);
    const m = metricas(json);
    corridas.push({ etiqueta, version, buildId: buildId(dir), ...m });
    writeFileSync(path.join(salida, "corridas.json"), JSON.stringify(corridas, null, 2));
    log(`${etiqueta} perf ${m.performance} LCP obs ${m.lcpObservado} sim ${m.lcpSimulado} render ${m.renderDelay}`);
  }
  frenar();
  const resumen = {};
  for (const version of ["A", "B"]) {
    const filas = corridas.filter((c) => c.version === version);
    const campo = (nombre) => filas.map((c) => c[nombre]);
    resumen[version] = {
      n: filas.length,
      performance: mediana(campo("performance")),
      lcpObservado: mediana(campo("lcpObservado")),
      lcpSimulado: mediana(campo("lcpSimulado")),
      renderDelay: mediana(campo("renderDelay")),
      fcp: mediana(campo("fcp")),
      tbt: mediana(campo("tbt")),
      si: mediana(campo("si")),
      cls: mediana(campo("cls")),
      scriptEvaluation: mediana(campo("scriptEvaluation")),
    };
  }
  writeFileSync(
    path.join(salida, "resumen.json"),
    JSON.stringify({ host: { cpus: cpus().length, ram: totalmem() }, hashA: hashArchivos(A_DIR), hashB: hashArchivos(B_DIR), resumen, corridas }, null, 2),
  );
  log(`listo ${salida}`);
}

process.on("SIGINT", () => {
  frenar();
  process.exit(1);
});

main().catch((error) => {
  frenar();
  console.error(error);
  process.exit(1);
});
