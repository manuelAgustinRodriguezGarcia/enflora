import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { actualizarDashboard } from "../app/admin/dashboard-acciones.js";
import { leerResumenDashboard } from "../lib/admin/dashboard.js";
import {
  RPC_DASHBOARD,
  clasificarErrorDashboard,
  presentarResumen,
} from "../lib/admin/dashboard-reglas.js";
import { ACCESO_DATOS_ADMIN, evaluarSolicitudAdmin } from "../lib/admin/politica.js";
import { evaluarAdmin, variableAdminDeModulo } from "../lib/admin/reglas.js";
import { obtenerAdmin } from "../lib/admin/autorizacion.js";
import { crearClienteRestringido } from "../lib/admin/servicio.js";
import { conSupabaseFalso } from "./ayudas/supabase-falso.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ID_ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORIGEN = "https://proyecto-falso.supabase.test";

function usuario(extra = {}) {
  return { id: ID_ADMIN, email: "persona@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false, ...extra };
}

function serieDesde(inicio) {
  const [anio, mes, dia] = inicio.split("-").map(Number);
  return Array.from({ length: 30 }, (_, indice) => {
    const fecha = new Date(Date.UTC(anio, mes - 1, dia + indice));
    return {
      dia: fecha.toISOString().slice(0, 10),
      usuarios_nuevos: indice === 29 ? 1 : 0,
      registros: indice === 28 ? 2 : 0,
    };
  });
}

function resumenCrudo(extra = {}) {
  return {
    generado_en: "2026-11-01T18:00:00.000Z",
    periodo_corto: 7,
    periodo_largo: 30,
    usuarios_total: 4,
    usuarios_nuevos_7: 1,
    usuarios_nuevos_30: 2,
    espacios: 3,
    unidades: 5,
    plantas: 8,
    registros_total: 10,
    registros_7: 2,
    registros_30: 6,
    usuarios_con_registros_7: 1,
    usuarios_con_registros_30: 3,
    fotos_registros: 2,
    bytes_fotos_originales: 4000,
    serie: serieDesde("2026-10-03"),
    ...extra,
  };
}

function ceros() {
  return resumenCrudo({
    usuarios_total: 0,
    usuarios_nuevos_7: 0,
    usuarios_nuevos_30: 0,
    espacios: 0,
    unidades: 0,
    plantas: 0,
    registros_total: 0,
    registros_7: 0,
    registros_30: 0,
    usuarios_con_registros_7: 0,
    usuarios_con_registros_30: 0,
    fotos_registros: 0,
    bytes_fotos_originales: 0,
    serie: serieDesde("2026-10-03").map((punto) => ({ ...punto, usuarios_nuevos: 0, registros: 0 })),
  });
}

function json(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "content-type": "application/json" },
  });
}

test("auditoría no se abre con el permiso de dashboard y ADMIN_IDS_AUDITORIA no abre el dashboard", () => {
  assert.equal(variableAdminDeModulo("auditoria"), "ADMIN_IDS_AUDITORIA");
  const soloDashboard = { ADMIN_IDS_DASHBOARD: ID_ADMIN };
  const soloAuditoria = { ADMIN_IDS_AUDITORIA: ID_ADMIN };
  assert.equal(evaluarAdmin(usuario(), "dashboard", { env: soloDashboard }).ok, true);
  assert.equal(evaluarAdmin(usuario(), "auditoria", { env: soloDashboard }).ok, false);
  assert.equal(evaluarAdmin(usuario(), "auditoria", { env: soloAuditoria }).ok, true);
  assert.equal(evaluarAdmin(usuario(), "dashboard", { env: soloAuditoria }).ok, false);
  assert.equal(evaluarAdmin(usuario(), "expo", { env: soloDashboard }).ok, false);
});

test("el resumen acepta conteos vacíos y descarta cualquier dato que no sea agregado", () => {
  const vacio = presentarResumen(ceros());
  assert.equal(vacio.ok, true);
  assert.equal(vacio.resumen.usuariosTotal, 0);
  assert.equal(vacio.resumen.registrosTotal, 0);
  assert.equal(vacio.resumen.fotosRegistros, 0);
  assert.equal(vacio.resumen.bytesFotosOriginales, 0);
  assert.equal(vacio.resumen.serie.length, 30);

  const presentado = presentarResumen(resumenCrudo());
  assert.equal(presentado.ok, true);
  assert.equal(presentado.resumen.usuariosNuevos7, 1);
  assert.equal(presentado.resumen.bytesFotosOriginales, 4000);
  assert.equal(JSON.stringify(presentado).includes("@"), false);

  const privado = resumenCrudo({ email: "secreto@example.com", observacion: "nota", ruta: "foto.jpg" });
  assert.equal(presentarResumen(privado).ok, false);
  assert.equal(JSON.stringify(presentarResumen(privado)).includes("secreto@example.com"), false);

  assert.equal(presentarResumen(resumenCrudo({ usuarios_nuevos_7: 9 })).ok, false);
  assert.equal(presentarResumen(resumenCrudo({ fotos_registros: 0, bytes_fotos_originales: 10 })).ok, false);
  assert.equal(presentarResumen(resumenCrudo({ fotos_registros: 3, bytes_fotos_originales: 2 })).ok, false);
  assert.equal(presentarResumen(resumenCrudo({ usuarios_total: "4" })).ok, false);
  assert.equal(presentarResumen(null).ok, false);
});

test("un error de función ausente se distingue de un fallo de lectura", () => {
  assert.equal(clasificarErrorDashboard({ code: "PGRST202", message: "Could not find the function" }), "migracion");
  assert.equal(clasificarErrorDashboard({ code: "XX000", message: "secreto@example.com" }), "error");
});

test("la política del dashboard solo permite la RPC agregada y sin argumentos", () => {
  const politica = ACCESO_DATOS_ADMIN.dashboard;
  assert.deepEqual(politica.rpcs, [RPC_DASHBOARD]);
  assert.equal(Object.keys(politica.tablas).length, 0);
  assert.throws(() => politica.rpcs.push("crear_registro"), TypeError);
  const destino = { origen: ORIGEN };
  const base = {
    metodo: "POST",
    url: `${ORIGEN}/rest/v1/rpc/${RPC_DASHBOARD}`,
    cabeceras: new Headers({ accept: "application/json" }),
  };
  assert.equal(evaluarSolicitudAdmin(politica, { ...base, cuerpo: "{}" }, destino).ok, true);
  assert.equal(
    evaluarSolicitudAdmin(politica, { ...base, cuerpo: JSON.stringify({ email: "secreto@example.com" }) }, destino).motivo,
    "argumentos_no_permitidos",
  );
  assert.equal(
    evaluarSolicitudAdmin(politica, { ...base, url: `${ORIGEN}/rest/v1/registros?select=observacion`, metodo: "GET", cuerpo: undefined }, destino).motivo,
    "tabla_no_permitida",
  );
});

test("sin permiso de dashboard no hay consulta, y la respuesta no reenvía datos privados", async () => {
  await conSupabaseFalso({ usuario: null, entorno: { ADMIN_IDS_DASHBOARD: ID_ADMIN } }, async (entorno) => {
    assert.equal((await actualizarDashboard()).estado, "denegado");
    assert.deepEqual(entorno.rest, []);
  });

  await conSupabaseFalso({ usuario: usuario(), entorno: { ADMIN_IDS_EXPO: ID_ADMIN } }, async (entorno) => {
    const expo = await obtenerAdmin("expo");
    assert.equal(expo.ok, true);
    assert.equal((await leerResumenDashboard(expo.credencial)).estado, "denegado");
    assert.equal(entorno.rest.some((solicitud) => solicitud.url.pathname.includes("resumen_dashboard_admin")), false);
    assert.equal(entorno.rest.some((solicitud) => solicitud.url.pathname.includes("/rest/v1/registros")), false);
  });
});

test("con permiso de dashboard se lee solo la RPC y se presentan los conteos", async () => {
  await conSupabaseFalso({
    usuario: usuario(),
    entorno: { ADMIN_IDS_DASHBOARD: ID_ADMIN },
    rest: ({ url, cuerpo }) => {
      if (url.pathname === `/rest/v1/rpc/${RPC_DASHBOARD}`) {
        assert.equal(cuerpo, "{}");
        return json(resumenCrudo());
      }
      return json({ message: "no debería consultarse" }, 500);
    },
  }, async (entorno) => {
    const autorizacion = await obtenerAdmin("dashboard");
    assert.equal(autorizacion.ok, true);
    const cliente = crearClienteRestringido(autorizacion.credencial, "dashboard");
    assert.throws(() => cliente.from("registros"), /tabla_no_permitida/);
    assert.throws(() => cliente.from("perfiles"), /tabla_no_permitida/);
    assert.throws(() => cliente.from("registro_fotos"), /tabla_no_permitida/);
    assert.throws(() => cliente.rpc("crear_registro"), /rpc_no_permitida/);

    const resultado = await leerResumenDashboard(autorizacion.credencial);
    assert.equal(resultado.estado, "listo");
    assert.equal(resultado.resumen.usuariosTotal, 4);
    assert.equal(resultado.resumen.espacios, 3);
    assert.equal(resultado.resumen.plantas, 8);
    assert.equal(resultado.resumen.registros30, 6);
    assert.equal(resultado.resumen.usuariosConRegistros7, 1);
    assert.equal(resultado.resumen.fotosRegistros, 2);
    assert.equal(resultado.resumen.bytesFotosOriginales, 4000);
    const serializado = JSON.stringify(resultado);
    assert.equal(serializado.includes("@"), false);
    assert.equal(serializado.includes("observacion"), false);
    assert.deepEqual(
      [...new Set(entorno.rest.map((solicitud) => solicitud.url.pathname))],
      [`/rest/v1/rpc/${RPC_DASHBOARD}`],
    );
  });
});

test("los ceros, la migración ausente y un error de Supabase no inventan cifras ni filtran el mensaje", async () => {
  await conSupabaseFalso({
    usuario: usuario(),
    entorno: { ADMIN_IDS: ID_ADMIN },
    rest: () => json(ceros()),
  }, async () => {
    const autorizacion = await obtenerAdmin("dashboard");
    const resultado = await leerResumenDashboard(autorizacion.credencial);
    assert.equal(resultado.estado, "listo");
    assert.equal(resultado.resumen.usuariosTotal, 0);
    assert.equal(resultado.resumen.bytesFotosOriginales, 0);
  });

  await conSupabaseFalso({
    usuario: usuario(),
    entorno: { ADMIN_IDS: ID_ADMIN },
    rest: () => json({ code: "PGRST202", message: "Could not find the function public.resumen_dashboard_admin in the schema cache" }, 404),
  }, async () => {
    const autorizacion = await obtenerAdmin("dashboard");
    const resultado = await leerResumenDashboard(autorizacion.credencial);
    assert.equal(resultado.estado, "migracion");
    assert.equal(Object.hasOwn(resultado, "resumen"), false);
    assert.match(resultado.error, /no está operativo/);
    assert.equal(resultado.error.includes("schema cache"), false);
  });

  await conSupabaseFalso({
    usuario: usuario(),
    entorno: { ADMIN_IDS: ID_ADMIN },
    rest: () => json({ code: "XX000", message: "falla secreto@example.com", details: "observacion privada" }, 500),
  }, async () => {
    const autorizacion = await obtenerAdmin("dashboard");
    const resultado = await leerResumenDashboard(autorizacion.credencial);
    assert.equal(resultado.estado, "error");
    const serializado = JSON.stringify(resultado);
    assert.equal(serializado.includes("secreto@example.com"), false);
    assert.equal(serializado.includes("observacion"), false);
    assert.equal(Object.hasOwn(resultado, "resumen"), false);
  });
});

test("la migración y el módulo de lectura no exponen columnas privadas ni otro cliente", () => {
  const sql = fs.readFileSync(path.join(RAIZ, "supabase/admin-dashboard.sql"), "utf8");
  const cuerpo = sql.replace(/--.*$/gm, "");
  assert.match(sql, /security definer/);
  assert.match(sql, /language sql/);
  assert.match(sql, /set search_path = ''/);
  assert.doesNotMatch(sql, /set search_path = public/);
  assert.match(sql, /auth\.users/);
  assert.match(sql, /deleted_at/);
  assert.match(sql, /is_anonymous/);
  assert.match(sql, /tamano_bytes/);
  assert.match(sql, /grant execute on function public\.resumen_dashboard_admin\(\) to service_role/);
  assert.match(sql, /revoke all on function public\.resumen_dashboard_admin\(\) from public, anon, authenticated/);
  assert.doesNotMatch(cuerpo, /storage\.objects|observacion|ruta_miniatura|nombre_planta|genetica_etiqueta|\b(insert|update|delete|truncate|drop|alter)\b/i);
  assert.doesNotMatch(sql, /grant execute on function public\.resumen_dashboard_admin\(\) to authenticated/);

  const lectura = fs.readFileSync(path.join(RAIZ, "lib/admin/dashboard.js"), "utf8");
  assert.match(lectura, /crearClienteRestringido\(credencial, MODULO\)/);
  assert.doesNotMatch(lectura, /SUPABASE_SERVICE_ROLE_KEY|from\(|select\(/);
  const pagina = fs.readFileSync(path.join(RAIZ, "app/admin/page.js"), "utf8");
  assert.match(pagina, /leerResumenDashboard/);
  assert.doesNotMatch(pagina, /lib\/admin\/servicio|supabase-js|registro_fotos|observacion/);
  const acciones = fs.readFileSync(path.join(RAIZ, "app/admin/dashboard-acciones.js"), "utf8");
  assert.match(acciones, /^"use server";/);
  assert.match(acciones, /obtenerAdmin\("dashboard"\)/);
});
