import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { MODULOS_ADMIN } from "../lib/admin/reglas.js";
import {
  RUTA_ADMIN,
  RUTA_ADMIN_EXPO,
  RUTA_ADMIN_EXPO_LEGADO,
  SECCIONES_ADMIN,
  destinoAdminPermitido,
  esRutaPanelAdmin,
  navegacionAdmin,
  primerDestino,
  seccionesVisibles,
} from "../lib/admin/secciones.js";
import { siguientePermitido } from "../lib/pagos/rutas.js";

const RAIZ = path.resolve(import.meta.dirname, "..");

test("cada módulo administrativo tiene una sección y auditoría es independiente", () => {
  for (const modulo of MODULOS_ADMIN) {
    assert.ok(SECCIONES_ADMIN.some((seccion) => seccion.modulo === modulo), modulo);
  }
  assert.equal(MODULOS_ADMIN.includes("auditoria"), true);
  const auditoria = SECCIONES_ADMIN.find((seccion) => seccion.id === "auditoria");
  assert.equal(auditoria.modulo, "auditoria");
  assert.equal(auditoria.href, "/admin/auditoria");
  assert.equal(seccionesVisibles(["dashboard"]).some((seccion) => seccion.id === "auditoria"), false);
  assert.deepEqual(seccionesVisibles(["auditoria"]).map((seccion) => seccion.id), ["auditoria"]);
});

test("un permiso exclusivo de Expo no abre otros módulos", () => {
  const visibles = seccionesVisibles(["expo"]);
  assert.deepEqual(visibles.map((seccion) => seccion.id), ["expo"]);
  assert.deepEqual(navegacionAdmin(["expo"]).map((seccion) => seccion.href), [RUTA_ADMIN_EXPO]);
  assert.equal(primerDestino(["expo"]), RUTA_ADMIN_EXPO);
  for (const href of navegacionAdmin(["expo"]).map((seccion) => seccion.href)) {
    assert.equal(href, RUTA_ADMIN_EXPO);
  }
});

test("dashboard no abre auditoría ni el resto de los módulos", () => {
  assert.deepEqual(seccionesVisibles(["dashboard"]).map((seccion) => seccion.id), ["dashboard"]);
});

test("la navegación que cruza al cliente no incluye el módulo ni el resumen", () => {
  const [primera] = navegacionAdmin(["usuarios", "expo"]);
  assert.deepEqual(Object.keys(primera).sort(), ["exacto", "href", "id", "titulo"]);
});

test("el destino posterior al ingreso solo acepta rutas del panel", () => {
  assert.equal(destinoAdminPermitido(RUTA_ADMIN_EXPO_LEGADO), RUTA_ADMIN_EXPO);
  assert.equal(destinoAdminPermitido("/admin/usuarios"), "/admin/usuarios");
  assert.equal(destinoAdminPermitido("/admin"), RUTA_ADMIN);
  assert.equal(destinoAdminPermitido("/admin/usuarios/1"), "");
  assert.equal(destinoAdminPermitido("/admin/../espacios"), "");
  assert.equal(destinoAdminPermitido("/admin/%2e%2e/espacios"), "");
  assert.equal(destinoAdminPermitido("https://malicioso.example/admin"), "");
  assert.equal(destinoAdminPermitido("//malicioso.example/admin"), "");
  assert.equal(destinoAdminPermitido("/admin/expo?siguiente=https://malicioso.example"), "");
  assert.equal(destinoAdminPermitido("/pagos/licencia"), "");
  assert.equal(esRutaPanelAdmin("/admin"), true);
  assert.equal(esRutaPanelAdmin("/admin/expo"), true);
  assert.equal(esRutaPanelAdmin("/administracion"), false);
  assert.equal(esRutaPanelAdmin("/espacios"), false);
});

test("el ingreso sigue permitiendo pagos y normaliza la ruta vieja de Expo", () => {
  assert.equal(siguientePermitido("/pagos/licencia"), "/pagos/licencia");
  assert.equal(siguientePermitido("https://malicioso"), "");
  assert.equal(siguientePermitido(RUTA_ADMIN_EXPO_LEGADO), RUTA_ADMIN_EXPO);
  assert.equal(siguientePermitido("/admin/expo"), RUTA_ADMIN_EXPO);
  assert.equal(siguientePermitido("//evil.com/admin"), "");
});

test("la redirección legada es fija y las pantallas nuevas no leen datos privados", () => {
  const proxy = fs.readFileSync(path.join(RAIZ, "proxy.js"), "utf8");
  assert.match(proxy, /pathname\.replace\(\/\\\/\+\$\/, ""\) === RUTA_ADMIN_EXPO_LEGADO/);
  assert.match(proxy, /url\.pathname = RUTA_ADMIN_EXPO/);
  assert.match(proxy, /url\.search = ""/);
  assert.match(proxy, /NextResponse\.redirect\(url, 308\)/);

  const legado = fs.readFileSync(path.join(RAIZ, "app/expo-cannabis/admin/page.js"), "utf8");
  assert.match(legado, /permanentRedirect\(RUTA_ADMIN_EXPO\)/);
  assert.doesNotMatch(legado, /obtenerPanelExpo|obtenerAdminExpo|contactos/);

  const prohibido = /crearClienteRestringido|SUPABASE_SERVICE_ROLE_KEY|contactos_enflora|expo_inventario|from\("plantas|flora_chats|registro_fotos/;
  const informativas = [
    "lib/admin/secciones.js",
    "lib/admin/acceso-panel.js",
    "app/admin/layout.js",
    "app/admin/page.js",
    "app/admin/vista-informativa.js",
    "app/admin/usuarios/page.js",
    "app/admin/planes/page.js",
    "app/admin/flora/page.js",
    "app/admin/almacenamiento/page.js",
    "app/admin/notificaciones/page.js",
    "app/admin/partners/page.js",
    "app/admin/auditoria/page.js",
    "componentes/admin/cascaron-admin.js",
    "componentes/admin/navegacion-admin.js",
    "componentes/admin/estado-seccion.js",
  ];
  for (const archivo of informativas) {
    const fuente = fs.readFileSync(path.join(RAIZ, archivo), "utf8");
    assert.doesNotMatch(fuente, prohibido, archivo);
  }

  const vista = fs.readFileSync(path.join(RAIZ, "app/admin/vista-informativa.js"), "utf8");
  assert.match(vista, /obtenerAdmin\(seccion\.modulo\)/);
  assert.match(vista, /notFound\(\)/);

  const expo = fs.readFileSync(path.join(RAIZ, "app/admin/expo/page.js"), "utf8");
  assert.match(expo, /obtenerAdminExpo\(\)/);
  assert.match(expo, /RUTA_ADMIN_EXPO/);
});
