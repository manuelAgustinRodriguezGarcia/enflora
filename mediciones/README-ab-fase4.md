# Medición A/B Fase 4.1 (v2 — worktrees)

## Requisitos

- Node, `pnpm`, Chrome
- Puerto **3005** libre (`AB_LIGHTHOUSE_PORT` opcional)
- Cerrar `pnpm dev` si usa el mismo puerto

## Ejecutar

```bash
node mediciones/ab-fase4-lighthouse.mjs
```

- Crea worktrees en `mediciones/worktrees/ab-fase4-{a,b}` (no toca el repo principal)
- **2 builds** (A y B), cada uno con su `.next`
- Warmup A/B + 10 corridas intercaladas → `mediciones/ab-fase4-runs/v2-<fecha>/`
- Al terminar ejecuta el analizador y genera `mediciones/VALIDACION-FASE4.md`

## Reanudar

```bash
node mediciones/ab-fase4-lighthouse.mjs --resume mediciones/ab-fase4-runs/v2-2026-...
```

Omite corridas ya marcadas `complete` en `manifest.json`.

## Análisis manual

```bash
node mediciones/ab-fase4-analizar.mjs mediciones/ab-fase4-runs/v2-...
```

## Referencia v1 (exploratoria)

Carpetas **sin** prefijo `v2-` (p. ej. `2026-10-30T00-25-09`, 6 corridas) usaron rebuild por alternancia; **no mezclar** con v2.

## Limpiar worktrees (opcional)

```bash
git worktree remove mediciones/worktrees/ab-fase4-a
git worktree remove mediciones/worktrees/ab-fase4-b
```
