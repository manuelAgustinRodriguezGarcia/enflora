import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { leerDetalleAuditoria, leerResumenAuditoria } from "../lib/admin/auditoria.js";
import {
  RPC_RESUMEN_AUDITORIA,
  argumentosDetalleAuditoria,
  argumentosResumenAuditoria,
  clasificarErrorAuditoria,
  interpretarAuditoria,
  presentarDetalleAuditoria,
  presentarResumenAuditoria,
} from "../lib/admin/auditoria-reglas.js";
import { obtenerAdmin } from "../lib/admin/autorizacion.js";
import { ACCESO_DATOS_ADMIN, evaluarSolicitudAdmin } from "../lib/admin/politica.js";
import { destinoAdminPermitido } from "../lib/admin/secciones.js";
import { obtenerAdminExpo } from "../lib/expo-cannabis/admin.js";
import { operacionesContactosAdmin } from "../lib/expo-cannabis/contactos-admin.js";
import { deduplicarCampañasBanner, elegirRotacion } from "../lib/publicidad.js";
import { afirmarSqlAdministrativo, cuerpoSql } from "./ayudas/sintaxis-sql-admin.js";
import { conSupabaseFalso } from "./ayudas/supabase-falso.js";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ID_ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_OTRO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ID_EVENTO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ORIGEN = "https://proyecto-falso.supabase.test";
const AHORA = new Date("2026-11-05T15:00:00.000Z");

function usuario() {
  return { id: ID_ADMIN, email: "persona@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false };
}

function json(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });
}

function consultaDe(extra = {}) {
  const interpretado = interpretarAuditoria({ periodo: "7", ...extra }, AHORA);
  assert.equal(interpretado.ok, true);
  return interpretado.consulta;
}

function resumenDe(consulta, extra = {}) {
  return {
    ok: true,
    desde: consulta.desde,
    hasta: consulta.hasta,
    medido_en: "2026-11-05T15:00:00.000Z",
    total_registrado: 0,
    total: 0,
    exitos: 0,
    rechazos: 0,
    errores: 0,
    heredados: 0,
    centrales: 0,
    limite: 20,
    offset: consulta.offset,
    por_modulo: [],
    por_accion: [],
    administradores: [],
    filas: [],
    ...extra,
  };
}

function fila(extra = {}) {
  return {
    id: ID_EVENTO,
    operacion_id: ID_EVENTO,
    administrador_id: ID_ADMIN,
    modulo: "expo",
    accion: "entrega",
    recurso_tipo: "inventario",
    recurso_id: "stickers",
    resultado: "exito",
    motivo: "",
    creada_en: "2026-11-05T15:00:00.000Z",
    cobertura: "central",
    ...extra,
  };
}

test("el SQL de auditoría no copia ni borra los registros existentes", () => {
  const archivo = "supabase/admin-auditoria.sql";
  const texto = fs.readFileSync(path.join(RAIZ, archivo), "utf8");
  afirmarSqlAdministrativo(texto, archivo);
  const cuerpo = cuerpoSql(texto);
  assert.match(cuerpo, /from public\.admin_auditoria_usuarios/);
  assert.match(cuerpo, /from public\.partners_auditoria/);
  assert.equal(/insert into public\.admin_auditoria_usuarios/.test(cuerpo), false);
  assert.equal(/insert into public\.partners_auditoria/.test(cuerpo), false);
  assert.equal(/delete from public\.admin_auditoria/.test(cuerpo), false);
  assert.equal(/update public\.admin_auditoria/.test(cuerpo), false);
  assert.match(cuerpo, /revoke all on function public\.admin_auditoria_anotar\(uuid, uuid, text, text, text, text, text, text\) from public, anon, authenticated, service_role/);
  assert.equal(/grant execute on function public\.admin_auditoria_anotar/.test(cuerpo), false);
  assert.equal(/grant select on public\.admin_auditoria_eventos/.test(cuerpo), false);
  assert.equal(/from public\.flora_/.test(cuerpo), false);
  assert.match(fs.readFileSync(path.join(RAIZ, "supabase/admin-usuarios.sql"), "utf8"), /insert into public\.admin_auditoria_usuarios/);
  assert.match(fs.readFileSync(path.join(RAIZ, "supabase/admin-partners.sql"), "utf8"), /insert into public\.partners_auditoria/);
});

test("la consulta no acepta el administrador desde otro campo y el resumen vacío no trae contactos", () => {
  const consulta = consultaDe({ administrador: ID_OTRO });
  const argumentos = argumentosResumenAuditoria(ID_ADMIN, consulta);
  assert.equal(argumentos.p_admin, ID_ADMIN);
  assert.equal(argumentos.p_administrador, ID_OTRO);
  assert.equal(argumentosDetalleAuditoria(ID_ADMIN, ID_EVENTO).p_admin, ID_ADMIN);
  assert.equal(interpretarAuditoria({ administrador: "persona@example.com" }, AHORA).ok, false);
  assert.equal(interpretarAuditoria({ offset: "21" }, AHORA).ok, false);
  const destino = { origen: ORIGEN };
  assert.equal(evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.auditoria, {
    metodo: "POST",
    url: `${ORIGEN}/rest/v1/rpc/${RPC_RESUMEN_AUDITORIA}`,
    cabeceras: new Headers({ accept: "application/json" }),
    cuerpo: JSON.stringify(argumentos),
  }, destino).ok, true);
  assert.equal(evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.auditoria, {
    metodo: "POST",
    url: `${ORIGEN}/rest/v1/rpc/admin_auditoria_anotar`,
    cabeceras: new Headers({ accept: "application/json" }),
    cuerpo: "{}",
  }, destino).motivo, "rpc_no_permitida");
  assert.equal(evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.expo, {
    metodo: "POST",
    url: `${ORIGEN}/rest/v1/rpc/${RPC_RESUMEN_AUDITORIA}`,
    cabeceras: new Headers({ accept: "application/json" }),
    cuerpo: JSON.stringify(argumentos),
  }, destino).motivo, "rpc_no_permitida");
  assert.equal(evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.auditoria, {
    metodo: "GET",
    url: `${ORIGEN}/rest/v1/admin_auditoria_eventos?select=motivo`,
    cabeceras: new Headers({ accept: "application/json" }),
  }, destino).ok, false);
  const presentado = presentarResumenAuditoria(resumenDe(consulta), consulta);
  assert.equal(presentado.ok, true);
  assert.equal(presentado.resumen.total, 0);
  const conCorreo = resumenDe(consulta, { correo: "persona@example.com" });
  assert.equal(presentarResumenAuditoria(conCorreo, consulta).ok, false);
  const evento = { ok: true, evento: fila({ email: "persona@example.com" }) };
  assert.equal(presentarDetalleAuditoria(evento).ok, false);
  assert.equal(destinoAdminPermitido(`/admin/auditoria/${ID_EVENTO}`), `/admin/auditoria/${ID_EVENTO}`);
  assert.equal(destinoAdminPermitido("/admin/auditoria?periodo=7"), "");
});

test("con permiso de auditoría se lee el período; otro módulo no llega a la base", async () => {
  const consulta = consultaDe();
  await conSupabaseFalso({
    usuario: usuario(),
    entorno: { ADMIN_IDS_AUDITORIA: ID_ADMIN },
    rest: () => json(resumenDe(consulta)),
  }, async (entorno) => {
    const autorizacion = await obtenerAdmin("auditoria");
    const resultado = await leerResumenAuditoria(autorizacion.credencial, consulta);
    assert.equal(resultado.estado, "listo");
    assert.equal(resultado.resumen.totalRegistrado, 0);
    assert.equal(JSON.stringify(resultado).includes("persona@"), false);
    const cuerpo = JSON.parse(entorno.rest[0].cuerpo);
    assert.equal(cuerpo.p_admin, ID_ADMIN);
    assert.deepEqual(entorno.rest.map((item) => item.url.pathname), [`/rest/v1/rpc/${RPC_RESUMEN_AUDITORIA}`]);
  });

  await conSupabaseFalso({ usuario: usuario(), entorno: { ADMIN_IDS_EXPO: ID_ADMIN } }, async (entorno) => {
    const expo = await obtenerAdmin("expo");
    assert.equal((await leerResumenAuditoria(expo.credencial, consulta)).estado, "denegado");
    assert.equal((await leerDetalleAuditoria(expo.credencial, ID_EVENTO)).estado, "denegado");
    assert.equal(entorno.rest.length, 0);
  });
});

test("una migración pendiente no inventa eventos ni copia el mensaje de la base", async () => {
  const consulta = consultaDe();
  await conSupabaseFalso({
    usuario: usuario(),
    entorno: { ADMIN_IDS_AUDITORIA: ID_ADMIN },
    rest: () => json({ code: "PGRST202", message: "Could not find the function public.resumen_auditoria_admin in the schema cache" }, 404),
  }, async () => {
    const autorizacion = await obtenerAdmin("auditoria");
    const resultado = await leerResumenAuditoria(autorizacion.credencial, consulta);
    assert.equal(resultado.estado, "migracion");
    assert.equal(resultado.resumen, undefined);
    assert.equal(String(resultado.error).includes("schema cache"), false);
    assert.match(resultado.error, /admin-auditoria\.sql/);
    assert.equal(clasificarErrorAuditoria({ code: "XX000", message: "persona@example.com" }), "error");
  });
});

test("la página y el conteo rechazan una página incoherente", () => {
  const consulta = consultaDe();
  const roto = resumenDe(consulta, {
    total_registrado: 1,
    total: 1,
    exitos: 1,
    heredados: 1,
    filas: Array.from({ length: 21 }, () => fila()),
    por_modulo: [{ modulo: "expo", total: 1 }],
    por_accion: [{ accion: "entrega", total: 1 }],
  });
  assert.equal(presentarResumenAuditoria(roto, consulta).ok, false);
  const pagina = fs.readFileSync(path.join(RAIZ, "app/admin/auditoria/page.js"), "utf8");
  assert.equal(pagina.includes("Eliminar"), false);
  assert.equal(pagina.includes("crearClienteRestringido"), false);
});

test("un comercio con banner y campaña aparece una sola vez y se mide la campaña", () => {
  const banner = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    nombre: "Marca",
    bannerUrl: "https://marca.example/banner.webp",
    enlace: "https://marca.example",
  };
  const baja = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    campanaId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    comercioId: banner.id,
    nombre: "Marca",
    bannerUrl: "https://marca.example/baja.webp",
    enlace: "https://marca.example/baja",
    prioridad: 1,
  };
  const alta = {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    campanaId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    comercioId: banner.id,
    nombre: "Marca",
    bannerUrl: "https://marca.example/alta.webp",
    enlace: "https://marca.example/alta",
    prioridad: 5,
  };
  const otro = {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    nombre: "Otra",
    bannerUrl: "https://otra.example/banner.webp",
    enlace: "https://otra.example",
  };
  const visible = deduplicarCampañasBanner([banner, otro], [baja, alta]);
  assert.equal(visible.length, 2);
  assert.equal(visible[0].campanaId, alta.campanaId);
  assert.equal(visible[0].comercioId, banner.id);
  assert.equal(visible[1].id, otro.id);
  assert.equal(visible[1].campanaId, undefined);
  assert.equal(elegirRotacion(visible, 0).campanaId, alta.campanaId);
  assert.deepEqual(deduplicarCampañasBanner([banner], []), [banner]);
  const pieza = fs.readFileSync(path.join(RAIZ, "componentes/banner-publicitario.js"), "utf8");
  assert.match(pieza, /Publicidad/);
  assert.match(pieza, /sponsored/);
});

test("si la exportación no queda auditada, no se entrega el archivo", async () => {
  await conSupabaseFalso({
    usuario: usuario(),
    entorno: { ADMIN_IDS_EXPO: ID_ADMIN },
    rest: ({ url }) => {
      if (url.pathname.endsWith("exportacion_expo_auditada")) return json({ ok: false, codigo: "operacion_fallida" });
      if (url.pathname === "/rest/v1/contactos_enflora") {
        return json([{ id: ID_EVENTO, nombre: "Ana", email: "ana@example.com" }]);
      }
      return json([]);
    },
  }, async (entorno) => {
    const { credencial } = await obtenerAdminExpo();
    const operaciones = operacionesContactosAdmin(credencial);
    const resultado = await operaciones.exportar({ filtro: "manual", busqueda: "ana" });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.csv, undefined);
    assert.equal(JSON.stringify(resultado).includes("ana@"), false);
    const auditoria = entorno.rest.find((item) => item.url.pathname.endsWith("exportacion_expo_auditada"));
    assert.ok(auditoria, entorno.rest.map((item) => item.url.pathname).join(" "));
    const cuerpo = JSON.parse(auditoria.cuerpo);
    assert.equal(cuerpo.p_con_busqueda, "si");
    assert.equal(cuerpo.p_filtro, "manual");
    assert.equal(JSON.stringify(cuerpo).includes("ana"), false);
  });
});
