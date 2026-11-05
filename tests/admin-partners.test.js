import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { leerResumenPartners } from "../lib/admin/partners.js";
import {
  RPC_ALTA_CAMPANA,
  RPC_RESUMEN_PARTNERS,
  UBICACION_BANNER,
  argumentosAltaCampana,
  argumentosResumenPartners,
  campanaPuedeActivarse,
  clasificarErrorPartners,
  interpretarPeriodoPartners,
  presentarResumenPartners,
  tasaClics,
  transicionCampanaPermitida,
  urlPartners,
  validarAltaComercio,
} from "../lib/admin/partners-reglas.js";
import { obtenerAdmin } from "../lib/admin/autorizacion.js";
import { ACCESO_DATOS_ADMIN, evaluarSolicitudAdmin } from "../lib/admin/politica.js";
import { destinoAdminPermitido } from "../lib/admin/secciones.js";
import { decidirEnvioSolicitud } from "../lib/partners.js";
import { afirmarSqlAdministrativo, cuerpoSql } from "./ayudas/sintaxis-sql-admin.js";
import { conSupabaseFalso } from "./ayudas/supabase-falso.js";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ID_ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_COMERCIO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORIGEN = "https://proyecto-falso.supabase.test";
const AHORA = new Date("2026-11-05T15:00:00.000Z");

function usuario() {
  return { id: ID_ADMIN, email: "persona@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false };
}

function json(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });
}

function consultaDe() {
  const interpretado = interpretarPeriodoPartners({ periodo: "7" }, AHORA);
  assert.equal(interpretado.ok, true);
  return interpretado.consulta;
}

function resumenDe(consulta) {
  return {
    ok: true,
    publicidad_en_flora: false,
    desde: consulta.desde,
    hasta: consulta.hasta,
    medido_en: "2026-11-05T15:00:00.000Z",
    comercios: 0,
    aprobados: 0,
    pendientes: 0,
    rechazados: 0,
    activos: 0,
    solicitudes: 0,
    solicitudes_recibidas: 0,
    campanas_borrador: 0,
    campanas_programadas: 0,
    campanas_activas: 0,
    campanas_pausadas: 0,
    campanas_finalizadas: 0,
    impresiones: 0,
    clics: 0,
    serie: consulta.dias.map((dia) => ({ dia, impresiones: 0, clics: 0 })),
    por_ubicacion: [{ ubicacion: UBICACION_BANNER, impresiones: 0, clics: 0 }],
  };
}

test("el SQL de partners no borra comercios ni abre las solicitudes al público", () => {
  const archivo = "supabase/admin-partners.sql";
  const texto = fs.readFileSync(path.join(RAIZ, archivo), "utf8");
  afirmarSqlAdministrativo(texto, archivo);
  const cuerpo = cuerpoSql(texto);
  assert.equal(/drop table public\.comercios_asociados/.test(cuerpo), false);
  assert.match(cuerpo, /estado', 'borrador'/);
  assert.match(cuerpo, /grant execute on function public\.resumen_partners_admin\(timestamptz, timestamptz\) to service_role/);
  assert.equal(/grant select on public\.partners_solicitudes/.test(cuerpo), false);
  assert.match(cuerpo, /publicidad_en_flora', false/);
  assert.equal(/from public\.flora_/.test(cuerpo), false);
});

test("valida https, no publica una campaña nueva y no duplica el correo", () => {
  assert.equal(urlPartners("javascript:alert(1)"), null);
  assert.equal(urlPartners("https://marca.example/banner.webp"), "https://marca.example/banner.webp");
  assert.equal(urlPartners(""), "");
  assert.equal(validarAltaComercio({ nombre: "Marca", rubro: "", sitio: "http://marca.example", plan: "presencia", inicio: "2026-11-05", fin: "" }).ok, false);
  assert.equal(transicionCampanaPermitida("finalizada", "activa"), false);
  assert.equal(transicionCampanaPermitida("borrador", "activa"), true);
  assert.equal(campanaPuedeActivarse({ plan: "presencia", revision: "aprobado", pieza: "https://marca.example/a.webp", enlace: "https://marca.example", fin: "", hoy: "2026-11-05" }), false);
  const alta = argumentosAltaCampana(ID_ADMIN, {
    comercio: ID_COMERCIO,
    nombre: "Lanzamiento",
    pieza: "",
    ubicacion: UBICACION_BANNER,
    enlace: "",
    inicio: "2026-11-05",
    fin: "",
    prioridad: 0,
  });
  assert.equal("p_estado" in alta, false);
  assert.equal(decidirEnvioSolicitud({ ok: true, repetida: true }).enviar, false);
  assert.equal(decidirEnvioSolicitud({ ok: false, codigo: "limite" }).estado, 429);
  assert.equal(decidirEnvioSolicitud(null).enviar, true);
  assert.equal(tasaClics(0, 0), null);
  assert.equal(tasaClics(4, 1), 0.25);
});

test("partners solo lee y escribe sus RPC, y el resumen vacío no trae contactos", () => {
  const consulta = consultaDe();
  const destino = { origen: ORIGEN };
  const cuerpo = JSON.stringify(argumentosResumenPartners(consulta));
  assert.equal(evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.partners, {
    metodo: "POST",
    url: `${ORIGEN}/rest/v1/rpc/${RPC_RESUMEN_PARTNERS}`,
    cabeceras: new Headers({ accept: "application/json", "content-type": "application/json" }),
    cuerpo,
  }, destino).ok, true);
  assert.equal(evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.partners, {
    metodo: "GET",
    url: `${ORIGEN}/rest/v1/partners_solicitudes?select=correo`,
    cabeceras: new Headers({ accept: "application/json" }),
  }, destino).ok, false);
  assert.equal(evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.flora_ia, {
    metodo: "POST",
    url: `${ORIGEN}/rest/v1/rpc/${RPC_ALTA_CAMPANA}`,
    cabeceras: new Headers({ accept: "application/json", "content-type": "application/json" }),
    cuerpo: "{}",
  }, destino).motivo, "rpc_no_permitida");
  const presentado = presentarResumenPartners(resumenDe(consulta), consulta);
  assert.equal(presentado.ok, true);
  assert.equal(presentado.resumen.publicidad_en_flora, false);
  const conCorreo = resumenDe(consulta);
  conCorreo.correo = "persona@example.com";
  assert.equal(presentarResumenPartners(conCorreo, consulta).ok, false);
  assert.equal(destinoAdminPermitido(`/admin/partners/comercios/${ID_COMERCIO}`), `/admin/partners/comercios/${ID_COMERCIO}`);
  assert.equal(destinoAdminPermitido("/admin/partners/comercios/nuevo"), "/admin/partners/comercios/nuevo");
});

test("con permiso se lee el resumen; otro módulo no llega a la base", async () => {
  const consulta = consultaDe();
  await conSupabaseFalso({
    usuario: usuario(),
    entorno: { ADMIN_IDS_PARTNERS: ID_ADMIN },
    rest: () => json(resumenDe(consulta)),
  }, async (entorno) => {
    const autorizacion = await obtenerAdmin("partners");
    const resultado = await leerResumenPartners(autorizacion.credencial, consulta);
    assert.equal(resultado.estado, "listo");
    assert.equal(resultado.resumen.comercios, 0);
    assert.equal(JSON.stringify(resultado).includes("persona@"), false);
    assert.deepEqual(entorno.rest.map((item) => item.url.pathname), [`/rest/v1/rpc/${RPC_RESUMEN_PARTNERS}`]);
  });

  await conSupabaseFalso({ usuario: usuario(), entorno: { ADMIN_IDS_PLANES: ID_ADMIN } }, async (entorno) => {
    const planes = await obtenerAdmin("planes");
    assert.equal((await leerResumenPartners(planes.credencial, consulta)).estado, "denegado");
    assert.equal(entorno.rest.length, 0);
  });
});

test("una migración pendiente no inventa cifras ni copia el mensaje de la base", async () => {
  const consulta = consultaDe();
  await conSupabaseFalso({
    usuario: usuario(),
    entorno: { ADMIN_IDS_PARTNERS: ID_ADMIN },
    rest: () => json({ code: "PGRST202", message: "Could not find the function public.resumen_partners_admin in the schema cache" }, 404),
  }, async () => {
    const autorizacion = await obtenerAdmin("partners");
    const resultado = await leerResumenPartners(autorizacion.credencial, consulta);
    assert.equal(resultado.estado, "migracion");
    assert.equal(resultado.resumen, undefined);
    assert.equal(String(resultado.error).includes("schema cache"), false);
    assert.match(resultado.error, /admin-partners\.sql/);
    assert.equal(clasificarErrorPartners({ code: "XX000", message: "persona@example.com" }), "error");
  });
});

test("el banner existente sigue identificando la publicidad y Flora no lo importa", () => {
  const banner = fs.readFileSync(path.join(RAIZ, "componentes/banner-publicitario.js"), "utf8");
  assert.match(banner, /Publicidad/);
  assert.match(banner, /sponsored/);
  const flora = fs.readdirSync(path.join(RAIZ, "componentes/flora")).join("\n");
  assert.equal(flora.includes("banner-publicitario"), false);
  const publicidad = fs.readFileSync(path.join(RAIZ, "lib/publicidad.js"), "utf8");
  assert.match(publicidad, /PLANES_BANNER/);
  assert.match(publicidad, /partners_campanas/);
});
