import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { leerResumenAlmacenamiento } from "../lib/admin/almacenamiento.js";
import {
  CATEGORIAS_ALMACENAMIENTO,
  RPC_RESUMEN_ALMACENAMIENTO,
  argumentosResumenAlmacenamiento,
  bytesInformados,
  clasificarErrorAlmacenamiento,
  clasificarObjetoAlmacenamiento,
  interpretarConsultaAlmacenamiento,
  presentarResumenAlmacenamiento,
} from "../lib/admin/almacenamiento-reglas.js";
import { obtenerAdmin } from "../lib/admin/autorizacion.js";
import { ACCESO_DATOS_ADMIN, evaluarSolicitudAdmin } from "../lib/admin/politica.js";
import { crearClienteRestringido } from "../lib/admin/servicio.js";
import { afirmarSqlAdministrativo, cuerpoSql } from "./ayudas/sintaxis-sql-admin.js";
import { conSupabaseFalso } from "./ayudas/supabase-falso.js";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ID_ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USUARIO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ARCHIVO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const UNIDAD = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ORIGEN = "https://proyecto-falso.supabase.test";
const AHORA = new Date("2026-11-03T15:00:00.000Z");

function usuario() {
  return { id: ID_ADMIN, email: "persona@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false };
}

function json(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });
}

function consultaDe(parametros = {}) {
  const interpretado = interpretarConsultaAlmacenamiento(parametros, AHORA);
  assert.equal(interpretado.ok, true);
  return interpretado.consulta;
}

function resumenVacio(consulta, extra = {}) {
  return {
    ok: true,
    medido_en: "2026-11-03T15:00:00.000Z",
    desde: consulta.desde,
    hasta: consulta.hasta,
    objetos: 0,
    bytes: 0,
    bytes_completos: true,
    objetos_sin_tamano: 0,
    imagenes: 0,
    objetos_sin_mime: 0,
    promedio_bytes: null,
    ultimo_objeto_en: null,
    ocupacion_historica_disponible: false,
    anadidos_objetos: 0,
    anadidos_bytes: 0,
    anadidos_sin_tamano: 0,
    por_bucket: [],
    por_categoria: CATEGORIAS_ALMACENAMIENTO.map((categoria) => ({
      categoria,
      objetos: 0,
      bytes: 0,
      objetos_sin_tamano: 0,
    })),
    por_mime: [],
    serie: consulta.dias.map((dia) => ({ dia, objetos: 0, bytes: 0 })),
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

test("el SQL de almacenamiento usa sintaxis válida y no lee fotos declaradas ni identidades", () => {
  const archivo = "supabase/admin-almacenamiento.sql";
  const texto = fs.readFileSync(path.join(RAIZ, archivo), "utf8");
  afirmarSqlAdministrativo(texto, archivo);
  const cuerpo = cuerpoSql(texto);
  assert.equal(cuerpo.includes("registro_fotos"), false);
  assert.equal(/\b(createSignedUrl|storage\.from)\b/.test(cuerpo), false);
  assert.match(cuerpo, /grant execute on function public\.resumen_almacenamiento_admin\(timestamptz, timestamptz\) to service_role/);
  assert.equal(/to anon/.test(cuerpo), false);
  assert.equal(/to authenticated/.test(cuerpo), false);
  assert.match(cuerpo, /revoke all on function public\.almacenamiento_admin_bytes\(jsonb\) from public, anon, authenticated, service_role/);
});

test("clasifica cada archivo una sola vez y no inventa el tamaño", () => {
  assert.equal(clasificarObjetoAlmacenamiento("enflora-fotos", `${USUARIO}/registros/${ARCHIVO}.webp`), "registros");
  assert.equal(clasificarObjetoAlmacenamiento("enflora-fotos", `${USUARIO}/registros/${ARCHIVO}_m.webp`), "miniaturas");
  assert.equal(clasificarObjetoAlmacenamiento("enflora-fotos", `${USUARIO}/portadas/${UNIDAD}/${ARCHIVO}.jpg`), "portadas");
  assert.equal(clasificarObjetoAlmacenamiento("enflora-fotos", `${USUARIO}/portadas/${UNIDAD}/${ARCHIVO}_m.png`), "miniaturas");
  assert.equal(clasificarObjetoAlmacenamiento("enflora-fotos", `${USUARIO}/flora/${ARCHIVO}.webp`), "flora");
  assert.equal(clasificarObjetoAlmacenamiento("avatars", `${USUARIO}/${ARCHIVO}.webp`), "otros");
  assert.equal(clasificarObjetoAlmacenamiento("geneticas-imagenes", `${USUARIO}/${ARCHIVO}.jpg`), "otros");
  assert.equal(clasificarObjetoAlmacenamiento("enflora-fotos", `${USUARIO}/otra/cosa.webp`), "sin_clasificar");
  assert.equal(clasificarObjetoAlmacenamiento("bucket-desconocido", "archivo"), "sin_clasificar");
  assert.equal(bytesInformados({ size: 120, contentLength: 999 }), 120);
  assert.equal(bytesInformados({ contentLength: 40 }), 40);
  assert.equal(bytesInformados({}), null);
  assert.equal(bytesInformados({ size: "no-es-un-numero" }), null);
});

test("un almacenamiento vacío es válido y un path o un correo lo invalidan", () => {
  const consulta = consultaDe();
  const presentado = presentarResumenAlmacenamiento(resumenVacio(consulta), consulta);
  assert.equal(presentado.ok, true);
  assert.equal(presentado.resumen.bytes, 0);
  assert.equal(presentado.resumen.ocupacionHistoricaDisponible, false);
  assert.equal(presentado.resumen.porCategoria.length, CATEGORIAS_ALMACENAMIENTO.length);

  const conRuta = resumenVacio(consulta);
  conRuta.ruta = `${USUARIO}/registros/${ARCHIVO}.webp`;
  assert.equal(presentarResumenAlmacenamiento(conRuta, consulta).ok, false);
  const conCorreo = resumenVacio(consulta);
  conCorreo.por_bucket = [{ bucket: "enflora-fotos", objetos: 0, bytes: 0, objetos_sin_tamano: 0, email: "persona@example.com" }];
  assert.equal(presentarResumenAlmacenamiento(conCorreo, consulta).ok, false);
});

test("almacenamiento solo puede leer su resumen agregado", () => {
  const consulta = consultaDe({ periodo: "7" });
  const cuerpo = JSON.stringify(argumentosResumenAlmacenamiento(consulta));
  const destino = { origen: ORIGEN };
  assert.equal(
    evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.almacenamiento, solicitud(RPC_RESUMEN_ALMACENAMIENTO, cuerpo), destino).ok,
    true,
  );
  assert.equal(
    evaluarSolicitudAdmin(
      ACCESO_DATOS_ADMIN.almacenamiento,
      { metodo: "GET", url: `${ORIGEN}/storage/v1/object/enflora-fotos/privado.webp`, cabeceras: new Headers({ accept: "application/json" }) },
      destino,
    ).ok,
    false,
  );
  for (const modulo of ["dashboard", "planes", "flora_ia", "usuarios", "expo"]) {
    assert.equal(
      evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN[modulo], solicitud(RPC_RESUMEN_ALMACENAMIENTO, cuerpo), destino).motivo,
      "rpc_no_permitida",
    );
  }
  assert.equal(Object.keys(ACCESO_DATOS_ADMIN.almacenamiento.tablas).length, 0);
});

test("con permiso se consulta el agregado; otro módulo no llega a la base", async () => {
  const consulta = consultaDe();
  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_ALMACENAMIENTO: ID_ADMIN },
      rest: ({ url, cuerpo }) => {
        assert.equal(url.pathname, `/rest/v1/rpc/${RPC_RESUMEN_ALMACENAMIENTO}`);
        assert.equal(cuerpo, JSON.stringify(argumentosResumenAlmacenamiento(consulta)));
        return json(resumenVacio(consulta));
      },
    },
    async (entorno) => {
      const autorizacion = await obtenerAdmin("almacenamiento");
      const cliente = crearClienteRestringido(autorizacion.credencial, "almacenamiento");
      assert.throws(() => cliente.from("registro_fotos"), /tabla_no_permitida/);
      const resultado = await leerResumenAlmacenamiento(autorizacion.credencial, consulta);
      assert.equal(resultado.estado, "listo");
      assert.equal(resultado.resumen.objetos, 0);
      assert.equal(JSON.stringify(resultado).includes(USUARIO), false);
      assert.deepEqual([...new Set(entorno.rest.map((item) => item.url.pathname))], [`/rest/v1/rpc/${RPC_RESUMEN_ALMACENAMIENTO}`]);
    },
  );

  await conSupabaseFalso(
    { usuario: usuario(), entorno: { ADMIN_IDS_PLANES: ID_ADMIN } },
    async (entorno) => {
      const planes = await obtenerAdmin("planes");
      assert.equal((await leerResumenAlmacenamiento(planes.credencial, consulta)).estado, "denegado");
      assert.equal(entorno.rest.length, 0);
    },
  );
});

test("una migración pendiente o un error de la base no inventan cifras ni copian el mensaje", async () => {
  const consulta = consultaDe();
  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_ALMACENAMIENTO: ID_ADMIN },
      rest: () => json({ code: "PGRST202", message: "Could not find the function public.resumen_almacenamiento_admin in the schema cache" }, 404),
    },
    async () => {
      const autorizacion = await obtenerAdmin("almacenamiento");
      const resultado = await leerResumenAlmacenamiento(autorizacion.credencial, consulta);
      assert.equal(resultado.estado, "migracion");
      assert.equal(resultado.resumen, undefined);
      assert.equal(String(resultado.error).includes("schema cache"), false);
      assert.match(resultado.error, /admin-almacenamiento\.sql/);
    },
  );

  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_ALMACENAMIENTO: ID_ADMIN },
      rest: () => json({ message: "fallo interno persona@example.com" }, 500),
    },
    async () => {
      const autorizacion = await obtenerAdmin("almacenamiento");
      const resultado = await leerResumenAlmacenamiento(autorizacion.credencial, consulta);
      assert.equal(resultado.estado, "error");
      assert.equal(String(resultado.error).includes("persona@"), false);
      assert.equal(clasificarErrorAlmacenamiento({ code: "PGRST202", message: "schema cache" }), "migracion");
    },
  );
});
