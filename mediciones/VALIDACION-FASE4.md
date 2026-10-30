# Validación A/B — Fase 4 (viewport) vs Fase 3

Generado: 2026-10-30T00:51:54.917Z  
Carpeta de corridas: `mediciones\ab-fase4-runs\v2-2026-10-30T00-38-26`  
Protocolo: **v2** — two-worktree-builds-interleaved

## 1. Configuración del experimento

| Parámetro | Valor |
|-----------|--------|
| URL | http://127.0.0.1:3005/ |
| Lighthouse | 12.8.2 (`--preset=perf`, solo Performance) |
| Chrome | `--headless=new` |
| Builds | 2 builds en worktrees (`mediciones/worktrees/ab-fase4-{a,b}`), sin rebuild al alternar |
| Verificación | `GET /` + `/_next/static/<BUILD_ID>/_buildManifest.js` |
| Calentamiento | 1 corrida por versión (excluida de estadísticas) |
| Corridas válidas | 5 × A + 5 × B intercaladas (A1→B1→…→B5) |
| Script | `node mediciones/ab-fase4-lighthouse.mjs` |


> Corridas en carpetas sin v2- (p. ej. 2026-10-30T00-25-09) son referencia v1; no mezclar.


### Entorno

- Host: VICTUS-MANU (win32 10.0.26200)
- CPU: 12× 12th Gen Intel(R) Core(TM) i5-12450H
- RAM: ~31.7 GiB
- Node: v22.16.0

## 2. Commits comparados

| Versión | Descripción | buildId | Tiempo build |
|---------|-------------|---------|--------------|
| **A** | Fase 3 (fin) — sin patch viewport Fase 4 | `MWWfHdR8V6_BzXiavU6XJ` | 26 s |
| **B** | Fase 4 — patch viewport | `o-61heo5xQN-7-kQqa_zW` | 27 s |

- **Git:** `2c55c1a-dirty` (2c55c1ad759676287f19181c13689760b98250ff)
- **Patch B:** `mediciones\patches\fase4-viewport-main-thread.patch`
- **Hash fuente A/B:** `2e148f2c9d859cac` / `f0d441c5cc23e13d`

## 3. Resultados individuales (válidos)

### Versión A (Fase 3 — sin patch viewport)

| Run | Perf | FCP | LCP | TBT | SI | CLS | Long task máx | JS eval | Style/layout |
|-----|------|-----|-----|-----|-----|-----|---------------|---------|--------------|
| a1 | 59 | 3225 ms | 3267 ms | 1213 ms | 5036 ms | 0 | 940 ms | 6717 ms | 2685 ms |
| a2 | 44 | 4061 ms | 4145 ms | 2671 ms | 6314 ms | 0 | 1708 ms | 8040 ms | 3747 ms |
| a3 | 45 | 3942 ms | 4011 ms | 2902 ms | 6360 ms | 0 | 1600 ms | 10995 ms | 4725 ms |
| a4 | 43 | 4044 ms | 4113 ms | 3113 ms | 6447 ms | 0 | 1700 ms | 7962 ms | 3458 ms |
| a5 | 42 | 4188 ms | 4279 ms | 2808 ms | 6598 ms | 0 | 1802 ms | 8475 ms | 3847 ms |

### Versión B (Fase 4 — patch viewport)

| Run | Perf | FCP | LCP | TBT | SI | CLS | Long task máx | JS eval | Style/layout |
|-----|------|-----|-----|-----|-----|-----|---------------|---------|--------------|
| b1 | 63 | 3114 ms | 3149 ms | 943 ms | 4936 ms | 0 | 749 ms | 6606 ms | 2749 ms |
| b2 | 45 | 3981 ms | 4037 ms | 2691 ms | 6499 ms | 0 | 1605 ms | 8323 ms | 3644 ms |
| b3 | 43 | 4179 ms | 4255 ms | 3190 ms | 6312 ms | 0 | 1763 ms | 7782 ms | 3787 ms |
| b4 | 43 | 4073 ms | 4157 ms | 2786 ms | 6583 ms | 0 | 1689 ms | 8441 ms | 3806 ms |
| b5 | 64 | 3061 ms | 3096 ms | 968 ms | 4723 ms | 0 | 737 ms | 5824 ms | 2423 ms |

## 4. Medianas y dispersión (5 corridas)

| Métrica | Mediana A | Mediana B | Δ (B−A) | σ A / σ B |
|---------|-----------|-----------|---------|-----------|
| Performance | 44 | 45 | 1 | 6 / 10 |
| FCP | 4044 ms | 3981 ms | -63 ms | 343 / 489 |
| LCP | 4113 ms | 4037 ms | -77 ms | 358 / 508 |
| TBT | 2808 ms | 2691 ms | -117 ms | 680 / 962 |
| Speed Index | 6360 ms | 6312 ms | -48 ms | 566 / 809 |
| CLS | 0 | 0 | 0 | 0 / 0 |
| Long task (máx) | 1700 ms | 1605 ms | -95 ms | 312 / 464 |
| JS evaluation | 8040 ms | 7782 ms | -258 ms | 1406 / 1019 |
| Style + layout | 3747 ms | 3644 ms | -102 ms | 658 / 580 |

Rango TBT A: 1213 ms – 3113 ms  
Rango TBT B: 943 ms – 3190 ms

## 5. Evaluación de animaciones

| Comportamiento | Automatizado | Notas |
|----------------|--------------|-------|
| Magic Bento enter/leave viewport | No | Manual: spotlight al entrar a “¿Por qué cultivar?”; al salir, spotlight detenido (rAF cancelado en B). |
| SideRays al volver al hero | No | Manual: scroll abajo y arriba; rayos WebGL reactivos tras idle inicial. |
| Particles en lanzamiento | No | Manual: sección countdown; partículas animadas al intersectar. |
| Cambio de pestaña | No | Manual: `visibilitychange` — SideRays/particles pausan con pestaña oculta. |
| Scroll rápido móvil/desktop | No | Manual: sin saltos ni errores en consola. |

**Pendiente manual:** recorrer la landing en Chrome DevTools (mobile + desktop) con el checklist anterior en **ambas** versiones (checkout A vs patch B).

## 6. Diagnóstico

- La dispersión de TBT (desvío típico > ~400 ms) es del mismo orden que la diferencia entre medianas; el entorno puede dominar el resultado.
- Las medianas no separan claramente A y B más allá de la dispersión observada → resultado **inconcluso** para atribuir a código vs ruido.

Referencia histórica Fase 3 (3 corridas previas, `lcp-fase3-after-summary.json`): mediana Perf 52, LCP ~3564 ms, TBT ~1957 ms.

## 7. Recomendación

**Investigar / re-medir**: alta variabilidad; no revertir Fase 4 solo por una mediana peor sin repetir el protocolo en condiciones estables.

---

*Protocolo Fase 4.1 — no sustituye QA visual ni traza Performance cruda de Chrome DevTools.*
