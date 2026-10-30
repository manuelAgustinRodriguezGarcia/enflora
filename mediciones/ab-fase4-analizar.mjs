#!/usr/bin/env node
/**
 * Agrega corridas A/B y genera mediciones/VALIDACION-FASE4.md
 *
 * Uso:
 *   node mediciones/ab-fase4-analizar.mjs mediciones/ab-fase4-runs/<carpeta>
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const METRIC_KEYS = [
  "performance",
  "fcpMs",
  "lcpMs",
  "tbtMs",
  "speedIndexMs",
  "cls",
  "scriptEvaluationMs",
  "styleLayoutMs",
  "longTaskMaxMs",
  "longTaskSumMs",
];

function resolveRunDir(arg) {
  if (arg) return path.resolve(REPO_ROOT, arg);
  const base = path.join(__dirname, "ab-fase4-runs");
  const dirs = readdirSync(base)
    .map((d) => path.join(base, d))
    .filter((p) => statSync(p).isDirectory())
    .filter((p) => {
      const mf = path.join(p, "manifest.json");
      if (!existsSync(mf)) return p.includes("v2-");
      try {
        const m = JSON.parse(readFileSync(mf, "utf8"));
        return m.experimentVersion === 2 || m.status === "complete";
      } catch {
        return false;
      }
    })
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!dirs.length) throw new Error("No hay carpetas v2 en mediciones/ab-fase4-runs/");
  return dirs[0];
}

function median(nums) {
  const v = nums.filter((n) => typeof n === "number" && !Number.isNaN(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function stats(values) {
  const v = values.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (!v.length) return { median: null, min: null, max: null, stdev: null, n: 0 };
  const med = median(v);
  const min = Math.min(...v);
  const max = Math.max(...v);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const variance = v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length;
  return {
    median: med,
    min,
    max,
    stdev: Math.sqrt(variance),
    n: v.length,
  };
}

function fmtMs(n) {
  if (n == null) return "—";
  return `${Math.round(n)} ms`;
}

function fmtScore(n) {
  if (n == null) return "—";
  return String(Math.round(n));
}

function deltaMed(a, b) {
  if (a == null || b == null) return null;
  return b - a;
}

function diagnose(manifest, statsA, statsB) {
  const dPerf = deltaMed(statsA.performance.median, statsB.performance.median);
  const dTbt = deltaMed(statsA.tbtMs.median, statsB.tbtMs.median);
  const dLcp = deltaMed(statsA.lcpMs.median, statsB.lcpMs.median);
  const spreadA = statsA.tbtMs.stdev ?? 0;
  const spreadB = statsB.tbtMs.stdev ?? 0;
  const maxSpread = Math.max(spreadA, spreadB);

  const lines = [];

  if (maxSpread > 400 && Math.abs(dTbt ?? 0) < maxSpread * 1.2) {
    lines.push(
      "La dispersión de TBT (desvío típico > ~400 ms) es del mismo orden que la diferencia entre medianas; el entorno puede dominar el resultado.",
    );
  }

  if (dTbt != null && dTbt < -200 && dLcp != null && dLcp <= 100) {
    lines.push(
      "Fase 4 muestra mediana de TBT más baja sin empeorar LCP de forma consistente → compatible con beneficio real de pausa off-viewport.",
    );
  } else if (dTbt != null && dTbt > 200 && dPerf != null && dPerf < -3) {
    lines.push(
      "Fase 4 empeora mediana de TBT y Performance de forma material → sospecha de regresión reproducible o de sesgo de medición; conviene repetir en CPU idle.",
    );
  } else {
    lines.push(
      "Las medianas no separan claramente A y B más allá de la dispersión observada → resultado **inconcluso** para atribuir a código vs ruido.",
    );
  }

  return lines;
}

function recommend(manifest, statsA, statsB) {
  const dTbt = deltaMed(statsA.tbtMs.median, statsB.tbtMs.median);
  const dPerf = deltaMed(statsA.performance.median, statsB.performance.median);
  const spread = Math.max(statsA.tbtMs.stdev ?? 0, statsB.tbtMs.stdev ?? 0);

  if (spread > 500 && Math.abs(dTbt ?? 0) < spread) {
    return "**Investigar / re-medir**: alta variabilidad; no revertir Fase 4 solo por una mediana peor sin repetir el protocolo en condiciones estables.";
  }
  if (dTbt != null && dTbt > 250 && dPerf != null && dPerf <= -5) {
    return "**Revertir** optimizaciones viewport (patch Fase 4 en magic-bento, particles, side-rays) y conservar Fase 3.";
  }
  if (dTbt != null && dTbt < -150 && (dPerf ?? 0) >= 0) {
    return "**Mantener** Fase 4: mejora consistente en métricas de bloqueo sin penalizar el score.";
  }
  return "**Mantener Fase 4** por beneficio esperado off-viewport (fluidez/recursos), pero **no** usar Lighthouse como única prueba hasta repetir A/B; no iniciar Fase 5.";
}

function main() {
  const runDir = resolveRunDir(process.argv[2]);
  const manifest = JSON.parse(
    readFileSync(path.join(runDir, "manifest.json"), "utf8"),
  );

  const scored = manifest.runs.filter((r) => r.scored && r.status === "complete");
  const byVersion = (v) =>
    scored.filter((r) => r.version === v).map((r) => r.metrics);

  const rowsA = byVersion("A");
  const rowsB = byVersion("B");

  const statsA = Object.fromEntries(
    METRIC_KEYS.map((k) => [k, stats(rowsA.map((m) => m[k]))]),
  );
  const statsB = Object.fromEntries(
    METRIC_KEYS.map((k) => [k, stats(rowsB.map((m) => m[k]))]),
  );

  const diag = diagnose(manifest, statsA, statsB);
  const rec = recommend(manifest, statsA, statsB);

  const tableRow = (label, key, unit = "") => {
    const a = statsA[key];
    const b = statsB[key];
    const d = deltaMed(a.median, b.median);
    const fmt = unit === "score" ? fmtScore : (n) => (unit === "cls" ? (n ?? "—") : fmtMs(n));
    return `| ${label} | ${fmt(a.median)} | ${fmt(b.median)} | ${d == null ? "—" : fmt(d)} | ${Math.round(a.stdev ?? 0)} / ${Math.round(b.stdev ?? 0)} |`;
  };

  const individualTable = (version, runs) => {
    const list = manifest.runs.filter((r) => r.version === version && r.scored);
    return list
      .map(
        (r) =>
          `| ${r.label} | ${r.metrics.performance} | ${fmtMs(r.metrics.fcpMs)} | ${fmtMs(r.metrics.lcpMs)} | ${fmtMs(r.metrics.tbtMs)} | ${fmtMs(r.metrics.speedIndexMs)} | ${r.metrics.cls} | ${fmtMs(r.metrics.longTaskMaxMs)} | ${fmtMs(r.metrics.scriptEvaluationMs)} | ${fmtMs(r.metrics.styleLayoutMs)} |`,
      )
      .join("\n");
  };

  const buildA = manifest.builds?.A?.buildId ?? manifest.buildIdA ?? "—";
  const buildB = manifest.builds?.B?.buildId ?? manifest.buildIdB ?? "—";
  const hashA = manifest.worktrees?.A?.sourceHash ?? manifest.sourceHashA ?? "—";
  const hashB = manifest.worktrees?.B?.sourceHash ?? manifest.sourceHashB ?? "—";
  const buildNote =
    manifest.experimentVersion === 2
      ? "2 builds en worktrees (`mediciones/worktrees/ab-fase4-{a,b}`), sin rebuild al alternar"
      : "`pnpm build` por cada cambio de versión (protocolo v1)";

  const md = `# Validación A/B — Fase 4 (viewport) vs Fase 3

Generado: ${new Date().toISOString()}  
Carpeta de corridas: \`${path.relative(REPO_ROOT, runDir)}\`  
Protocolo: **v${manifest.experimentVersion ?? 1}** — ${manifest.protocol ?? "legacy"}

## 1. Configuración del experimento

| Parámetro | Valor |
|-----------|--------|
| URL | ${manifest.lighthouse?.url ?? "http://127.0.0.1:3005/"} |
| Lighthouse | ${manifest.lighthouse?.lighthouseVersion ?? "—"} (\`--preset=perf\`, solo Performance) |
| Chrome | \`${manifest.lighthouse?.chromeFlags ?? "--headless=new"}\` |
| Builds | ${buildNote} |
| Verificación | \`GET /\` + \`/_next/static/<BUILD_ID>/_buildManifest.js\` |
| Calentamiento | 1 corrida por versión (excluida de estadísticas) |
| Corridas válidas | 5 × A + 5 × B intercaladas (A1→B1→…→B5) |
| Script | \`node mediciones/ab-fase4-lighthouse.mjs\` |

${manifest.priorExploratoryNote ? `\n> ${manifest.priorExploratoryNote}\n` : ""}

### Entorno

- Host: ${manifest.environment?.hostname ?? "—"} (${manifest.environment?.platform ?? ""} ${manifest.environment?.osRelease ?? ""})
- CPU: ${manifest.environment?.cpuCount ?? "—"}× ${manifest.environment?.cpuModel ?? "—"}
- RAM: ~${manifest.environment?.totalMemGiB ?? "—"} GiB
- Node: ${manifest.environment?.node ?? process.version}

## 2. Commits comparados

| Versión | Descripción | buildId | Tiempo build |
|---------|-------------|---------|--------------|
| **A** | ${manifest.versionA?.label ?? "HEAD sin patch"} | \`${buildA}\` | ${manifest.builds?.A?.durationMs ? `${Math.round(manifest.builds.A.durationMs / 1000)} s` : "—"} |
| **B** | ${manifest.versionB?.label ?? "HEAD + patch Fase 4"} | \`${buildB}\` | ${manifest.builds?.B?.durationMs ? `${Math.round(manifest.builds.B.durationMs / 1000)} s` : "—"} |

- **Git:** \`${manifest.gitDescribe ?? manifest.gitCommit}\` (${manifest.gitCommit})
- **Patch B:** \`${manifest.versionB?.patch ?? "mediciones/patches/fase4-viewport-main-thread.patch"}\`
- **Hash fuente A/B:** \`${hashA}\` / \`${hashB}\`

## 3. Resultados individuales (válidos)

### Versión A (Fase 3 — sin patch viewport)

| Run | Perf | FCP | LCP | TBT | SI | CLS | Long task máx | JS eval | Style/layout |
|-----|------|-----|-----|-----|-----|-----|---------------|---------|--------------|
${individualTable("A", rowsA)}

### Versión B (Fase 4 — patch viewport)

| Run | Perf | FCP | LCP | TBT | SI | CLS | Long task máx | JS eval | Style/layout |
|-----|------|-----|-----|-----|-----|-----|---------------|---------|--------------|
${individualTable("B", rowsB)}

## 4. Medianas y dispersión (5 corridas)

| Métrica | Mediana A | Mediana B | Δ (B−A) | σ A / σ B |
|---------|-----------|-----------|---------|-----------|
${tableRow("Performance", "performance", "score")}
${tableRow("FCP", "fcpMs")}
${tableRow("LCP", "lcpMs")}
${tableRow("TBT", "tbtMs")}
${tableRow("Speed Index", "speedIndexMs")}
${tableRow("CLS", "cls", "cls")}
${tableRow("Long task (máx)", "longTaskMaxMs")}
${tableRow("JS evaluation", "scriptEvaluationMs")}
${tableRow("Style + layout", "styleLayoutMs")}

Rango TBT A: ${fmtMs(statsA.tbtMs.min)} – ${fmtMs(statsA.tbtMs.max)}  
Rango TBT B: ${fmtMs(statsB.tbtMs.min)} – ${fmtMs(statsB.tbtMs.max)}

## 5. Evaluación de animaciones

| Comportamiento | Automatizado | Notas |
|----------------|--------------|-------|
| Magic Bento enter/leave viewport | No | Manual: spotlight al entrar a “¿Por qué cultivar?”; al salir, spotlight detenido (rAF cancelado en B). |
| SideRays al volver al hero | No | Manual: scroll abajo y arriba; rayos WebGL reactivos tras idle inicial. |
| Particles en lanzamiento | No | Manual: sección countdown; partículas animadas al intersectar. |
| Cambio de pestaña | No | Manual: \`visibilitychange\` — SideRays/particles pausan con pestaña oculta. |
| Scroll rápido móvil/desktop | No | Manual: sin saltos ni errores en consola. |

**Pendiente manual:** recorrer la landing en Chrome DevTools (mobile + desktop) con el checklist anterior en **ambas** versiones (checkout A vs patch B).

## 6. Diagnóstico

${diag.map((l) => `- ${l}`).join("\n")}

Referencia histórica Fase 3 (3 corridas previas, \`lcp-fase3-after-summary.json\`): mediana Perf 52, LCP ~3564 ms, TBT ~1957 ms.

## 7. Recomendación

${rec}

---

*Protocolo Fase 4.1 — no sustituye QA visual ni traza Performance cruda de Chrome DevTools.*
`;

  const outMd = path.join(__dirname, "VALIDACION-FASE4.md");
  writeFileSync(outMd, md, "utf8");

  const summaryJson = path.join(runDir, "resumen-estadistico.json");
  writeFileSync(
    summaryJson,
    JSON.stringify(
      {
        runDir: path.relative(REPO_ROOT, runDir),
        statsA,
        statsB,
        deltas: Object.fromEntries(
          METRIC_KEYS.map((k) => [k, deltaMed(statsA[k].median, statsB[k].median)]),
        ),
        diagnosis: diag,
        recommendation: rec,
      },
      null,
      2,
    ),
  );

  console.log(`Escrito ${path.relative(REPO_ROOT, outMd)}`);
  console.log(`Escrito ${path.relative(REPO_ROOT, summaryJson)}`);
}

main();
