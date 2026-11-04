import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import manifest from "../app/manifest.js";

const RAIZ = new URL("..", import.meta.url);

test("el manifest de la PWA es instalable y conserva el isotipo", () => {
  const datos = manifest();
  assert.equal(datos.name, "Enflora");
  assert.equal(datos.short_name, "Enflora");
  assert.equal(datos.id, "/");
  assert.equal(datos.start_url, "/");
  assert.equal(datos.scope, "/");
  assert.equal(datos.display, "standalone");
  assert.equal(datos.background_color, "#F4F8EE");
  assert.equal(datos.theme_color, "#0B3D2A");
  const any192 = datos.icons.find((icono) => icono.sizes === "192x192" && icono.purpose === "any");
  const any512 = datos.icons.find((icono) => icono.sizes === "512x512" && icono.purpose === "any");
  const maskable = datos.icons.filter((icono) => icono.purpose === "maskable");
  assert.ok(any192);
  assert.ok(any512);
  assert.equal(maskable.length, 2);
  for (const icono of datos.icons) {
    assert.equal(existsSync(new URL(`public${icono.src}`, RAIZ)), true);
  }
  assert.equal(existsSync(new URL("public/apple-icon.png", RAIZ)), true);
});

test("la pantalla offline no guarda datos de cultivo y el worker no cachea respuestas autenticadas", () => {
  const offline = readFileSync(new URL("../public/offline.html", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(offline, /Sin conexión/);
  assert.match(offline, /Reintentar/);
  assert.doesNotMatch(offline, /supabase|endpoint|token/i);
  assert.match(worker, /mode !== "navigate"/);
  assert.match(worker, /offline\.html/);
  assert.doesNotMatch(worker, /cache\.put\(/);
  assert.match(worker, /enflora-activar/);
  assert.doesNotMatch(worker.slice(0, worker.indexOf("activate")), /skipWaiting/);
});
