import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import manifest from "../app/manifest.js";
import { RUTA_INICIO } from "../lib/navegacion.js";
import {
  aplicacionWebInstalada,
  SCRIPT_ENTRADA_PWA,
} from "../lib/pwa-entrada.js";

const RAIZ = new URL("..", import.meta.url);

test("el manifest de la PWA es instalable y conserva el isotipo", () => {
  const datos = manifest();
  assert.equal(datos.name, "Enflora");
  assert.equal(datos.short_name, "Enflora");
  assert.equal(datos.id, "/");
  assert.equal(datos.start_url, RUTA_INICIO);
  assert.equal(datos.start_url, "/inicio");
  assert.notEqual(datos.start_url, "/");
  assert.equal(datos.scope, "/");
  assert.equal(datos.start_url.startsWith("/"), true);
  assert.equal(datos.display, "standalone");
  assert.equal(datos.prefer_related_applications, false);
  assert.deepEqual(datos.related_applications, [
    { platform: "webapp", url: "https://enflora.com.ar/manifest.webmanifest" },
  ]);
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

function simularEntrada({ pathname, search = "", standalone = false, minimal = false, ios = false }) {
  let destino = null;
  const location = {
    pathname,
    search,
    replace(url) {
      destino = url;
    },
  };
  const window = {
    navigator: { standalone: ios },
    matchMedia(consulta) {
      const modo = consulta.includes("minimal-ui")
        ? minimal
        : consulta.includes("standalone")
          ? standalone
          : false;
      return { matches: modo };
    },
  };
  vm.runInNewContext(SCRIPT_ENTRADA_PWA, { location, window });
  return destino;
}

test("la PWA instalada entra a la aplicación y el navegador sigue viendo la landing", () => {
  assert.equal(simularEntrada({ pathname: "/", standalone: true }), "/inicio");
  assert.equal(simularEntrada({ pathname: "/", ios: true }), "/inicio");
  assert.equal(simularEntrada({ pathname: "/", minimal: true }), "/inicio");
  assert.equal(simularEntrada({ pathname: "/" }), null);
  assert.equal(simularEntrada({ pathname: "/cultivos/abc", standalone: true }), null);
  assert.equal(simularEntrada({ pathname: "/inicio", standalone: true }), null);
  assert.equal(simularEntrada({ pathname: "/", search: "?code=abc", standalone: true }), null);
  assert.equal(
    simularEntrada({ pathname: "/", search: "?token_hash=abc&type=signup", ios: true }),
    null,
  );
});

test("la instalación duplicada solo se reconoce para el manifiesto de este sitio", () => {
  const propia = [{ platform: "webapp", url: "https://enflora.com.ar/manifest.webmanifest" }];
  assert.equal(aplicacionWebInstalada(propia, "https://enflora.com.ar"), true);
  assert.equal(aplicacionWebInstalada(propia, "http://localhost:3000"), false);
  assert.equal(
    aplicacionWebInstalada([{ platform: "play", url: "https://enflora.com.ar/manifest.webmanifest" }], "https://enflora.com.ar"),
    false,
  );
  assert.equal(aplicacionWebInstalada([], "https://enflora.com.ar"), false);
});

test("la pantalla offline no guarda datos de cultivo y el worker no cachea respuestas autenticadas", () => {
  const offline = readFileSync(new URL("../public/offline.html", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(offline, /Sin conexión/);
  assert.match(offline, /Reintentar/);
  assert.doesNotMatch(offline, /<img/);
  assert.match(offline, /class="aviso"/);
  assert.doesNotMatch(offline, /supabase|endpoint|token/i);
  assert.match(worker, /mode !== "navigate"/);
  assert.match(worker, /offline\.html/);
  assert.doesNotMatch(worker, /cache\.put\(/);
  assert.match(worker, /enflora-activar/);
  assert.doesNotMatch(worker.slice(0, worker.indexOf("activate")), /skipWaiting/);
});
