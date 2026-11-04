import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { obtenerAdmin } from "../lib/admin/autorizacion.js";
import { ACCESO_DATOS_ADMIN, evaluarSolicitudAdmin } from "../lib/admin/politica.js";
import { destinoAdminPermitido } from "../lib/admin/secciones.js";
import { crearClienteRestringido } from "../lib/admin/servicio.js";
import { leerDetalleUsuario, leerListadoUsuarios } from "../lib/admin/usuarios.js";
import {
  RPC_DETALLE_USUARIO,
  RPC_LISTADO_USUARIOS,
  argumentosDetalleUsuario,
  argumentosListadoUsuarios,
  clasificarErrorUsuarios,
  enlaceDetalleUsuario,
  interpretarConsultaUsuarios,
  presentarDetalleUsuario,
  presentarListadoUsuarios,
} from "../lib/admin/usuarios-reglas.js";
import { afirmarSqlAdministrativo, cuerpoSql } from "./ayudas/sintaxis-sql-admin.js";
import { conSupabaseFalso } from "./ayudas/supabase-falso.js";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ID_ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_USUARIO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORIGEN = "https://proyecto-falso.supabase.test";
const AHORA = new Date("2026-11-03T15:00:00.000Z");

function usuario() {
  return { id: ID_ADMIN, email: "persona@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false };
}

function json(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });
}

function fila(extra = {}) {
  return {
    id: ID_USUARIO,
    nombre: "María",
    nombre_usuario: "maria",
    correo: "m***@example.com",
    alta: "2026-11-01T15:00:00.000Z",
    ultima_conexion: "2026-11-02T15:00:00.000Z",
    confirmado: true,
    plan: "gratuito",
    espacios: 1,
    unidades: 2,
    plantas: 3,
    registros: 4,
    ultima_actividad: "2026-11-03T12:00:00.000Z",
    ...extra,
  };
}

function detalle(extra = {}) {
  return { ...fila(), plantas_activas: 2, plantas_finalizadas: 1, registros_30: 4, ...extra };
}

function listado(filas, extra = {}) {
  return { ok: true, total: filas.length, limite: 25, offset: 0, filas, ...extra };
}

function consultaDe(parametros = {}) {
  const interpretado = interpretarConsultaUsuarios(parametros, AHORA);
  assert.equal(interpretado.ok, true);
  return interpretado.consulta;
}

function solicitud(rpc, cuerpo) {
  return {
    metodo: "POST",
    url: `${ORIGEN}/rest/v1/rpc/${rpc}`,
    cabeceras: new Headers({ accept: "application/json" }),
    cuerpo,
  };
}

test("la migración de usuarios usa sintaxis PostgreSQL real y permisos mínimos", () => {
  const ruta = path.join(RAIZ, "supabase/admin-usuarios.sql");
  const bytes = fs.readFileSync(ruta);
  assert.notEqual(bytes[0], 0xef);
  const sql = bytes.toString("utf8");
  afirmarSqlAdministrativo(sql, "supabase/admin-usuarios.sql");
  const cuerpo = cuerpoSql(sql);
  for (const palabra of ["apellido", "telefono", "observacion", "genetica", "registro_fotos", "flora_chats"]) {
    assert.equal(cuerpo.toLowerCase().includes(palabra), false, palabra);
  }
  assert.match(cuerpo, /security definer/);
  assert.match(cuerpo, /set search_path = ''/);
  assert.match(cuerpo, /grant execute on function public\.listar_usuarios_admin\(uuid, text, text, text, timestamptz, timestamptz, integer, integer\) to service_role/);
  assert.match(cuerpo, /grant execute on function public\.detalle_usuario_admin\(uuid, uuid\) to service_role/);
  assert.match(cuerpo, /revoke all on function public\.usuarios_admin_plan\(uuid\) from public, anon, authenticated, service_role/);
  assert.match(cuerpo, /revoke all on table public\.admin_auditoria_usuarios from public, anon, authenticated, service_role/);
  assert.doesNotMatch(cuerpo, /grant\s+[a-z\s,]*\s+to\s+anon/);
  assert.doesNotMatch(cuerpo, /grant\s+[a-z\s,]*\s+to\s+authenticated/);
  assert.doesNotMatch(cuerpo, /'email'|apellido|observacion/);
  assert.match(cuerpo, /last_sign_in_at/);
  assert.match(cuerpo, /fecha_creacion/);
  assert.match(cuerpo, /'listado', null/);
});

test("búsqueda, filtros y paginación se resuelven antes de llamar a la base", () => {
  const consulta = consultaDe({
    q: " María Gómez ",
    periodo: "30",
    confirmacion: "confirmado",
    plan: "plus",
    pagina: "2",
  });
  assert.equal(consulta.busqueda, "María Gómez");
  assert.equal(consulta.confirmacion, "confirmado");
  assert.equal(consulta.plan, "plus");
  assert.equal(consulta.offset, 25);
  assert.equal(consulta.pagina, 2);
  const argumentos = argumentosListadoUsuarios(ID_ADMIN, consulta);
  assert.equal(argumentos.p_limite, 25);
  assert.equal(argumentos.p_offset, 25);
  assert.equal(argumentos.p_busqueda, "María Gómez");
  assert.equal(interpretarConsultaUsuarios({ q: "maria@example.com" }, AHORA).ok, true);
  assert.equal(interpretarConsultaUsuarios({ q: "a".repeat(81) }, AHORA).ok, false);
  assert.equal(interpretarConsultaUsuarios({ q: "maria%" }, AHORA).ok, false);
  assert.equal(interpretarConsultaUsuarios({ q: "maria_gomez" }, AHORA).ok, true);
  assert.equal(interpretarConsultaUsuarios({ confirmacion: "otro" }, AHORA).ok, false);
  assert.equal(interpretarConsultaUsuarios({ plan: "plus_y_licencia" }, AHORA).ok, false);
  assert.equal(interpretarConsultaUsuarios({ pagina: "0" }, AHORA).ok, false);
  assert.equal(interpretarConsultaUsuarios({ periodo: "personalizado", desde: "2026-01-01", hasta: "2026-06-01" }, AHORA).ok, true);
  assert.equal(interpretarConsultaUsuarios({ periodo: "personalizado", desde: "2024-01-01", hasta: "2026-06-01" }, AHORA).ok, false);
  assert.equal(enlaceDetalleUsuario(consulta, ID_USUARIO).startsWith(`/admin/usuarios/${ID_USUARIO}?`), true);
});

test("el presentador rechaza correos completos, claves privadas y acepta un listado vacío", () => {
  const consulta = consultaDe();
  const presentado = presentarListadoUsuarios(listado([fila()]), consulta);
  assert.equal(presentado.ok, true);
  assert.equal(presentado.filas[0].correo, "m***@example.com");
  assert.equal(presentado.filas[0].ultimaConexion.startsWith("2026-11-02"), true);
  assert.equal(presentado.filas[0].ultimaActividad.startsWith("2026-11-03"), true);
  assert.equal(JSON.stringify(presentado).includes("example.com") && JSON.stringify(presentado).includes("maria@"), false);
  assert.equal(presentarListadoUsuarios(listado([]), consulta).ok, true);
  assert.equal(presentarListadoUsuarios(listado([]), consulta).filas.length, 0);
  assert.equal(presentarListadoUsuarios(listado([fila({ correo: "maria@example.com" })]), consulta).ok, false);
  assert.equal(presentarListadoUsuarios(listado([fila({ apellido: "Pérez" })]), consulta).ok, false);
  assert.equal(presentarListadoUsuarios(listado([fila({ observacion: "nota" })]), consulta).ok, false);
  assert.equal(presentarListadoUsuarios(listado([fila({ email: "maria@example.com" })]), consulta).ok, false);
  assert.equal(presentarDetalleUsuario({ ok: true, usuario: detalle() }).ok, true);
  assert.equal(presentarDetalleUsuario({ ok: true, usuario: detalle({ genetica: "critica" }) }).ok, false);
  assert.equal(presentarDetalleUsuario({ ok: true, usuario: detalle(), foto: "ruta" }).ok, false);
  assert.equal(presentarListadoUsuarios(listado([fila()], { total: 40, offset: 25 }), consulta).ok, false);
});

test("otro permiso no consulta usuarios y usuarios no lee tablas", () => {
  const consulta = consultaDe({ q: "maria@example.com", plan: "licencia" });
  const cuerpo = JSON.stringify(argumentosListadoUsuarios(ID_ADMIN, consulta));
  const destino = { origen: ORIGEN };
  assert.equal(evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.usuarios, solicitud(RPC_LISTADO_USUARIOS, cuerpo), destino).ok, true);
  assert.equal(
    evaluarSolicitudAdmin(
      ACCESO_DATOS_ADMIN.usuarios,
      solicitud(RPC_LISTADO_USUARIOS, JSON.stringify({ ...argumentosListadoUsuarios(ID_ADMIN, consulta), p_busqueda: "" })),
      destino,
    ).ok,
    true,
  );
  assert.equal(
    evaluarSolicitudAdmin(
      ACCESO_DATOS_ADMIN.usuarios,
      solicitud(RPC_LISTADO_USUARIOS, JSON.stringify({ ...argumentosListadoUsuarios(ID_ADMIN, consulta), email: "maria@example.com" })),
      destino,
    ).motivo,
    "argumentos_no_permitidos",
  );
  assert.equal(
    evaluarSolicitudAdmin(
      ACCESO_DATOS_ADMIN.usuarios,
      solicitud(RPC_LISTADO_USUARIOS, JSON.stringify({ ...argumentosListadoUsuarios(ID_ADMIN, consulta), p_busqueda: "maria%" })),
      destino,
    ).motivo,
    "argumentos_no_permitidos",
  );
  assert.equal(
    evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.dashboard, solicitud(RPC_LISTADO_USUARIOS, cuerpo), destino).motivo,
    "rpc_no_permitida",
  );
  assert.equal(
    evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.planes, solicitud(RPC_DETALLE_USUARIO, "{}"), destino).motivo,
    "rpc_no_permitida",
  );
  assert.equal(
    evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.expo, solicitud(RPC_LISTADO_USUARIOS, cuerpo), destino).motivo,
    "rpc_no_permitida",
  );
  assert.equal(
    evaluarSolicitudAdmin(
      ACCESO_DATOS_ADMIN.usuarios,
      { metodo: "GET", url: `${ORIGEN}/rest/v1/perfiles?select=apellido,telefono`, cabeceras: new Headers({ accept: "application/json" }) },
      destino,
    ).motivo,
    "tabla_no_permitida",
  );
  assert.equal(Object.keys(ACCESO_DATOS_ADMIN.usuarios.tablas).length, 0);
  assert.equal(ACCESO_DATOS_ADMIN.dashboard.rpcs.includes(RPC_LISTADO_USUARIOS), false);
  assert.equal(ACCESO_DATOS_ADMIN.planes.rpcs.includes(RPC_DETALLE_USUARIO), false);
  assert.equal(destinoAdminPermitido(`/admin/usuarios/${ID_USUARIO}`), `/admin/usuarios/${ID_USUARIO}`);
  assert.equal(destinoAdminPermitido("/admin/usuarios/1"), "");
});

test("con permiso de usuarios solo se llama la RPC; sin ella no se inventan cuentas", async () => {
  const consulta = consultaDe({ q: "María", confirmacion: "sin_confirmar", periodo: "7" });
  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_USUARIOS: ID_ADMIN },
      rest: ({ url, cuerpo }) => {
        assert.equal(url.pathname, `/rest/v1/rpc/${RPC_LISTADO_USUARIOS}`);
        assert.equal(cuerpo, JSON.stringify(argumentosListadoUsuarios(ID_ADMIN, consulta)));
        return json(listado([]));
      },
    },
    async (entorno) => {
      const autorizacion = await obtenerAdmin("usuarios");
      const cliente = crearClienteRestringido(autorizacion.credencial, "usuarios");
      assert.throws(() => cliente.from("perfiles"), /tabla_no_permitida/);
      assert.throws(() => cliente.from("plantas"), /tabla_no_permitida/);
      const resultado = await leerListadoUsuarios(autorizacion.credencial, consulta);
      assert.equal(resultado.estado, "listo");
      assert.equal(resultado.total, 0);
      assert.deepEqual(resultado.filas, []);
      assert.equal(JSON.stringify(resultado).includes("@"), false);
      assert.deepEqual(
        [...new Set(entorno.rest.map((solicitud) => solicitud.url.pathname))],
        [`/rest/v1/rpc/${RPC_LISTADO_USUARIOS}`],
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
      assert.equal((await leerListadoUsuarios(planes.credencial, consultaDe())).estado, "denegado");
      assert.equal((await leerDetalleUsuario(planes.credencial, ID_USUARIO)).estado, "denegado");
      assert.equal(entorno.rest.length, 0);
    },
  );

  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_DASHBOARD: ID_ADMIN },
      rest: () => json(listado([fila()])),
    },
    async (entorno) => {
      const dashboard = await obtenerAdmin("dashboard");
      assert.equal((await leerDetalleUsuario(dashboard.credencial, ID_USUARIO)).estado, "denegado");
      assert.equal(entorno.rest.length, 0);
    },
  );

  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_USUARIOS: ID_ADMIN },
      rest: () => json({ code: "PGRST202", message: "Could not find the function public.listar_usuarios_admin in the schema cache" }, 404),
    },
    async () => {
      const autorizacion = await obtenerAdmin("usuarios");
      const resultado = await leerListadoUsuarios(autorizacion.credencial, consultaDe());
      assert.equal(resultado.estado, "migracion");
      assert.equal(Object.hasOwn(resultado, "filas"), false);
      assert.match(resultado.error, /admin-usuarios\.sql/);
      assert.equal(resultado.error.includes("schema cache"), false);
    },
  );

  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_USUARIOS: ID_ADMIN },
      rest: () => json({ code: "XX000", message: "falla maria@example.com", details: "observacion privada" }, 500),
    },
    async () => {
      const autorizacion = await obtenerAdmin("usuarios");
      const resultado = await leerDetalleUsuario(autorizacion.credencial, ID_USUARIO);
      assert.equal(resultado.estado, "error");
      assert.equal(resultado.error.includes("maria@example.com"), false);
      assert.equal(resultado.error.includes("observacion"), false);
      assert.equal(Object.hasOwn(resultado, "usuario"), false);
    },
  );
});

test("la ficha y el listado no quedan en páginas que importen el cliente de servicio", () => {
  const prohibido = /crearClienteRestringido|SUPABASE_SERVICE_ROLE_KEY|from\("perfiles|from\("plantas|flora_chats/;
  for (const archivo of ["app/admin/usuarios/page.js", "app/admin/usuarios/[id]/page.js", "componentes/admin/usuarios-marco.js"]) {
    const fuente = fs.readFileSync(path.join(RAIZ, archivo), "utf8");
    assert.doesNotMatch(fuente, prohibido, archivo);
  }
  assert.equal(fs.readFileSync(path.join(RAIZ, "componentes/admin/usuarios-marco.js"), "utf8").includes("lib/admin"), false);
  assert.equal(clasificarErrorUsuarios({ code: "PGRST202", message: "schema cache" }), "migracion");
});
