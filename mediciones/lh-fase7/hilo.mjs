import { readFileSync } from "node:fs";

const traza = JSON.parse(readFileSync("mediciones/lh-fase7/lhr-0.trace.json", "utf8"));
const eventos = traza.traceEvents || traza;
const t0 = eventos.find((e) => e.name === "navigationStart" && e.args?.data?.isLoadingMainFrame).ts;
const ms = (ts) => (ts - t0) / 1000;
const desde = 528;
const hasta = 2506;

const tareas = eventos
  .filter((e) => e.name === "RunTask" && e.dur)
  .map((e) => ({ i: ms(e.ts), f: ms(e.ts + e.dur) }))
  .filter((t) => t.f > desde && t.i < hasta)
  .sort((a, b) => a.i - b.i);

const top = [];
for (const t of tareas) {
  const padre = top.findLast((p) => t.i >= p.i && t.f <= p.f + 0.05);
  if (!padre) top.push(t);
}
let cursor = desde;
let huecoMax = 0;
let ocupado = 0;
for (const t of top) {
  const ini = Math.max(t.i, desde);
  const fin = Math.min(t.f, hasta);
  if (ini > cursor) huecoMax = Math.max(huecoMax, ini - cursor);
  ocupado += Math.max(0, fin - ini);
  cursor = Math.max(cursor, fin);
}
if (hasta > cursor) huecoMax = Math.max(huecoMax, hasta - cursor);

const porUrl = new Map();
for (const e of eventos) {
  if (e.name !== "FunctionCall" && e.name !== "EvaluateScript" && e.name !== "v8.compile") continue;
  const t = ms(e.ts);
  if (t < desde || t > hasta || !e.dur) continue;
  const url = String(e.args?.data?.url || "(sin url)").replace("https://enflora.com.ar", "");
  const prev = porUrl.get(url) || 0;
  porUrl.set(url, prev + e.dur / 1000);
}

const orden = [...porUrl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
const pilas = [];
for (const e of eventos) {
  if (e.name !== "Layout" && e.name !== "UpdateLayoutTree") continue;
  const t = ms(e.ts);
  if (t < desde || t > hasta || !e.dur || e.dur < 3000) continue;
  const pila = e.args?.data?.stackTrace || e.args?.beginData?.stackTrace || [];
  if (!pila.length) continue;
  pilas.push({
    tipo: e.name,
    t: Math.round(t),
    dur: Math.round(e.dur / 1000),
    pila: pila.slice(0, 5).map((f) => `${f.functionName || "?"} ${(f.url || "").split("/").pop()}:${f.lineNumber}`),
  });
}

console.log(JSON.stringify({
  tareasHijo: tareas.length,
  tareasTope: top.length,
  ocupadoMs: Math.round(ocupado),
  huecoMaxMs: Math.round(huecoMax),
  cpuPorUrl: orden.map(([url, dur]) => ({ url: url.slice(0, 100), ms: Math.round(dur) })),
  layoutsConPila: pilas.slice(0, 8),
}, null, 2));
