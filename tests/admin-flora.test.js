import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { obtenerAdmin } from "../lib/admin/autorizacion.js";
import { leerResumenFlora } from "../lib/admin/flora.js";
import {
  RPC_RESUMEN_FLORA,
  argumentosResumenFlora,
  clasificarErrorFlora,
  interpretarConsultaFlora,
  presentarResumenFlora,
} from "../lib/admin/flora-reglas.js";
import { ACCESO_DATOS_ADMIN, evaluarSolicitudAdmin } from "../lib/admin/politica.js";
import { crearClienteRestringido } from "../lib/admin/servicio.js";
import { afirmarSqlAdministrativo, cuerpoSql } from "./ayudas/sintaxis-sql-admin.js";
import { conSupabaseFalso } from "./ayudas/supabase-falso.js";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ID_ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORIGEN = "https://proyecto-falso.supabase.test";
const AHORA = new Date("2026-11-03T15:00:00.000Z");

function usuario() {
  return { id: ID_ADMIN, email: "persona@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false };
}

function json(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });
}

function consultaDe(parametros = {}) {
  const interpretado = interpretarConsultaFlora(parametros, AHORA);
  assert.equal(interpretado.ok, true);
  return interpretado.consulta;
}

function resumenVacio(consulta, extra = {}) {
  return {
    ok: true,
    desde: consulta.desde,
    hasta: consulta.hasta,
    solicitudes: 0,
    usuarios: 0,
    exitos: 0,
    errores: 0,
    cancelaciones: 0,
    muestras_latencia: 0,
    duracion_promedio_ms: null,
    duracion_p50_ms: null,
    duracion_p95_ms: null,
    tokens_entrada: null,
    tokens_salida: null,
    tokens_total: null,
    tokens_pensamiento: null,
    tokens_cache: null,
    tokens_herramientas: null,
    solicitudes_sin_entrada: 0,
    solicitudes_sin_salida: 0,
    solicitudes_sin_total: 0,
    costo_usd: null,
    solicitudes_con_costo: 0,
    solicitudes_sin_costo: 0,
    usuarios_con_costo: 0,
    costo_promedio_usuario_usd: null,
    facturado_disponible: false,
    por_modelo: [],
    por_operacion: [],
    serie: consulta.dias.map((dia) => ({ dia, solicitudes: 0, errores: 0, tokens_total: null, costo_usd: null })),
    ...extra,
  };
}

function solicitud(rpc, cuerpo) {
  return {
    metodo: "POST",
    url: `${ORIGEN}/rest/v1/rpc/${rpc}`,
    cabeceras: new Headers({ accept: "application/json", "content-type": "application/json" }),
    cuerpo,
  };
}

test("el SQL de Flora compila con la sintaxis administrativa permitida y no nombra contenido privado", () => {
  const archivo = "supabase/admin-flora.sql";
  const texto = fs.readFileSync(path.join(RAIZ, archivo), "utf8");
  afirmarSqlAdministrativo(texto, archivo);
  const cuerpo = cuerpoSql(texto);
  for (const palabra of ["prompt", "observacion", "genetica", "email", "apellido", "fotografia", "conversacion"]) {
    assert.equal(cuerpo.includes(palabra), false, palabra);
  }
  assert.equal(/\brespuestas?\b/.test(cuerpo), false);
  assert.match(cuerpo, /grant execute on function public\.registrar_uso_flora\([\s\S]*?\) to service_role/);
  assert.match(cuerpo, /grant execute on function public\.resumen_flora_admin\([\s\S]*?\) to service_role/);
  assert.equal(/to anon/.test(cuerpo), false);
  assert.equal(/to authenticated/.test(cuerpo), false);
  assert.match(cuerpo, /revoke all on function public\.flora_precio_vigente[\s\S]*?from public, anon, authenticated, service_role/);
});

test("un resumen vacío es válido y cualquier dato personal lo invalida", () => {
  const consulta = consultaDe();
  const presentado = presentarResumenFlora(resumenVacio(consulta), consulta);
  assert.equal(presentado.ok, true);
  assert.equal(presentado.resumen.costoUsd, null);
  assert.equal(presentado.resumen.tokensTotal, null);
  assert.equal(presentado.resumen.facturadoDisponible, false);
  assert.equal(presentado.resumen.serie.length, consulta.dias.length);
  assert.ok(presentado.resumen.serieSemana.length > 0);
  assert.ok(presentado.resumen.serieMes.length > 0);

  const conUsuario = resumenVacio(consulta);
  conUsuario.usuario_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  assert.equal(presentarResumenFlora(conUsuario, consulta).ok, false);

  const conMensaje = resumenVacio(consulta);
  conMensaje.serie = conMensaje.serie.map((punto, indice) => (indice === 0 ? { ...punto, mensaje: "mi planta" } : punto));
  assert.equal(presentarResumenFlora(conMensaje, consulta).ok, false);
  assert.equal(JSON.stringify(presentado).includes("persona@"), false);
});

test("Flora solo puede leer su resumen agregado", () => {
  const consulta = consultaDe({ modelo: "gemini-3.8-flash", operacion: "chat_imagen" });
  const cuerpo = JSON.stringify(argumentosResumenFlora(consulta));
  const destino = { origen: ORIGEN };
  assert.equal(evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.flora_ia, solicitud(RPC_RESUMEN_FLORA, cuerpo), destino).ok, true);
  assert.equal(
    evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.flora_ia, solicitud("registrar_uso_flora", "{}"), destino).motivo,
    "rpc_no_permitida",
  );
  for (const modulo of ["dashboard", "planes", "expo", "usuarios"]) {
    assert.equal(
      evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN[modulo], solicitud(RPC_RESUMEN_FLORA, cuerpo), destino).motivo,
      "rpc_no_permitida",
    );
  }
  assert.equal(
    evaluarSolicitudAdmin(
      ACCESO_DATOS_ADMIN.flora_ia,
      { metodo: "GET", url: `${ORIGEN}/rest/v1/flora_chats?select=*`, cabeceras: new Headers({ accept: "application/json" }) },
      destino,
    ).motivo,
    "tabla_no_permitida",
  );
  assert.equal(Object.keys(ACCESO_DATOS_ADMIN.flora_ia.tablas).length, 0);
});

test("con permiso de Flora se consulta el agregado; otro módulo no llega a la base", async () => {
  const consulta = consultaDe();
  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_FLORA_IA: ID_ADMIN },
      rest: ({ url, cuerpo }) => {
        assert.equal(url.pathname, `/rest/v1/rpc/${RPC_RESUMEN_FLORA}`);
        assert.equal(cuerpo, JSON.stringify(argumentosResumenFlora(consulta)));
        return json(resumenVacio(consulta));
      },
    },
    async (entorno) => {
      const autorizacion = await obtenerAdmin("flora_ia");
      const cliente = crearClienteRestringido(autorizacion.credencial, "flora_ia");
      assert.throws(() => cliente.from("flora_uso_solicitudes"), /tabla_no_permitida/);
      assert.throws(() => cliente.from("flora_chats"), /tabla_no_permitida/);
      const resultado = await leerResumenFlora(autorizacion.credencial, consulta);
      assert.equal(resultado.estado, "listo");
      assert.equal(resultado.resumen.solicitudes, 0);
      assert.equal(JSON.stringify(resultado).includes(ID_ADMIN), false);
      assert.deepEqual(
        [...new Set(entorno.rest.map((item) => item.url.pathname))],
        [`/rest/v1/rpc/${RPC_RESUMEN_FLORA}`],
      );
    },
  );

  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_PLANES: ID_ADMIN },
    },
    async (entorno) => {
      const planes = await obtenerAdmin("planes");
      assert.equal(planes.ok, true);
      assert.equal((await leerResumenFlora(planes.credencial, consulta)).estado, "denegado");
      assert.equal(entorno.rest.length, 0);
    },
  );
});

test("una migración pendiente no inventa métricas ni copia el error de la base", async () => {
  const consulta = consultaDe();
  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_FLORA_IA: ID_ADMIN },
      rest: () => json({ code: "PGRST202", message: "Could not find the function public.resumen_flora_admin in the schema cache" }, 404),
    },
    async () => {
      const autorizacion = await obtenerAdmin("flora_ia");
      const resultado = await leerResumenFlora(autorizacion.credencial, consulta);
      assert.equal(resultado.estado, "migracion");
      assert.equal(resultado.resumen, undefined);
      assert.equal(String(resultado.error).includes("schema cache"), false);
      assert.match(resultado.error, /admin-flora\.sql/);
    },
  );

  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_FLORA_IA: ID_ADMIN },
      rest: () => json({ message: "fallo interno persona@example.com" }, 500),
    },
    async () => {
      const autorizacion = await obtenerAdmin("flora_ia");
      const resultado = await leerResumenFlora(autorizacion.credencial, consulta);
      assert.equal(resultado.estado, "error");
      assert.equal(String(resultado.error).includes("persona@"), false);
      assert.equal(clasificarErrorFlora({ code: "PGRST202", message: "schema cache" }), "migracion");
    },
  );
});
