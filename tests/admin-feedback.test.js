import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { guardarGestionFeedback } from "../app/admin/feedback/acciones.js";
import { obtenerAdmin } from "../lib/admin/autorizacion.js";
import { guardarFeedbackAdmin, leerDetalleFeedback, leerListadoFeedback } from "../lib/admin/feedback.js";
import {
  RPC_DETALLE_FEEDBACK,
  RPC_GESTION_FEEDBACK,
  RPC_LISTADO_FEEDBACK,
  TAMANO_PAGINA_FEEDBACK,
  argumentosDetalleFeedback,
  argumentosGestionFeedback,
  argumentosListadoFeedback,
  enlaceDetalleFeedback,
  interpretarConsultaFeedback,
  presentarDetalleFeedback,
  presentarGestionFeedback,
  presentarListadoFeedback,
} from "../lib/admin/feedback-reglas.js";
import { ACCESO_DATOS_ADMIN, evaluarSolicitudAdmin } from "../lib/admin/politica.js";
import { crearClienteRestringido } from "../lib/admin/servicio.js";
import { destinoAdminPermitido } from "../lib/admin/secciones.js";
import { LIMITE_NOTA_FEEDBACK } from "../lib/feedback/reglas.js";
import { afirmarSqlAdministrativo, cuerpoSql } from "./ayudas/sintaxis-sql-admin.js";
import { conSupabaseFalso } from "./ayudas/supabase-falso.js";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ID_ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_FEEDBACK = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORIGEN = "https://proyecto-falso.supabase.test";
const MENSAJE = "La pantalla de perfil tarda en abrir el teclado.";

function usuario() {
  return { id: ID_ADMIN, email: "persona@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false };
}

function json(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });
}

function consultaDe(parametros = {}) {
  const interpretado = interpretarConsultaFeedback(parametros);
  assert.equal(interpretado.ok, true);
  return interpretado.consulta;
}

function fila(extra = {}) {
  return {
    id: ID_FEEDBACK,
    categoria: "error_app",
    resumen: MENSAJE,
    creado_en: "2026-11-04T15:00:00.000Z",
    estado: "nuevo",
    prioridad: "normal",
    nombre: "Ana",
    nombre_usuario: "ana",
    correo: "a***@example.com",
    ...extra,
  };
}

function listado(consulta, filas = [fila()]) {
  return {
    ok: true,
    total: filas.length,
    limite: TAMANO_PAGINA_FEEDBACK,
    offset: consulta.offset,
    contadores: { nuevo: 3, en_revision: 1, resueltos: 2 },
    filas,
  };
}

function detalle(extra = {}) {
  return {
    ok: true,
    feedback: {
      id: ID_FEEDBACK,
      categoria: "error_app",
      mensaje: MENSAJE,
      creado_en: "2026-11-04T15:00:00.000Z",
      actualizado_en: "2026-11-04T15:10:00.000Z",
      estado: "nuevo",
      prioridad: "normal",
      nota_admin: null,
      nombre: "Ana",
      nombre_usuario: "ana",
      correo: "a***@example.com",
      revisado_en: null,
      ...extra,
    },
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

function formularioGestion(extra = {}) {
  const datos = new FormData();
  datos.set("id", ID_FEEDBACK);
  datos.set("estado", "en_revision");
  datos.set("prioridad", "alta");
  datos.set("nota_admin", "Revisar en el próximo corte.");
  for (const [clave, valor] of Object.entries(extra)) datos.set(clave, valor);
  return datos;
}

test("el SQL administrativo no se ejecuta como usuario y audita la gestión", () => {
  const texto = fs.readFileSync(path.join(RAIZ, "supabase/feedback-usuarios.sql"), "utf8");
  afirmarSqlAdministrativo(texto, "supabase/feedback-usuarios.sql");
  const cuerpo = cuerpoSql(texto);
  for (const nombre of ["listar_feedback_admin", "detalle_feedback_admin", "gestionar_feedback_admin"]) {
    assert.match(cuerpo, new RegExp(`grant execute on function public\\.${nombre}\\([\\s\\S]*?\\) to service_role`));
    assert.match(cuerpo, new RegExp(`revoke all on function public\\.${nombre}\\([\\s\\S]*?\\) from public, anon, authenticated`));
  }
  assert.match(cuerpo, /revoke all on table public\.admin_auditoria_feedback from public, anon, authenticated, service_role/);
  const gestion = cuerpo.split("function public.gestionar_feedback_admin")[1];
  assert.match(gestion, /insert into public\.admin_auditoria_feedback/);
  assert.match(gestion, /estado_anterior/);
  assert.match(gestion, /nota_modificada/);
  assert.match(gestion, /for update/);
  const listadoSql = cuerpo.split("function public.listar_feedback_admin")[1].split("function public.detalle_feedback_admin")[0];
  assert.equal(/'mensaje'/.test(listadoSql), false);
  assert.equal(listadoSql.includes("nota_admin"), false);
  assert.match(listadoSql, /'resumen'/);
  assert.match(listadoSql, /implementado', 'descartado'/);
  const detalleSql = cuerpo.split("function public.detalle_feedback_admin")[1].split("function public.gestionar_feedback_admin")[0];
  assert.match(detalleSql, /'mensaje'/);
  assert.match(detalleSql, /'nota_admin'/);
  assert.equal(/'usuario_id'/.test(detalleSql), false);
});

test("el listado rechaza correos completos, notas y mensajes ajenos al contrato", () => {
  const consulta = consultaDe({ categoria: "error_app", estado: "nuevo", prioridad: "alta", pagina: "2" });
  assert.equal(consulta.offset, 20);
  const presentado = presentarListadoFeedback(listado(consulta), consulta);
  assert.equal(presentado.ok, true);
  assert.equal(presentado.pagina, 2);
  assert.equal(presentado.contadores.resueltos, 2);
  assert.equal(presentado.filas[0].correo, "a***@example.com");
  assert.equal(Object.hasOwn(presentado.filas[0], "mensaje"), false);
  assert.equal(Object.hasOwn(presentado.filas[0], "nota"), false);

  const conCorreo = listado(consulta, [fila({ correo: "persona@example.com" })]);
  assert.equal(presentarListadoFeedback(conCorreo, consulta).ok, false);
  const conNota = listado(consulta, [fila({ nota_admin: "interna" })]);
  assert.equal(presentarListadoFeedback(conNota, consulta).ok, false);
  const conUsuario = listado(consulta);
  conUsuario.filas[0].usuario_id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  assert.equal(presentarListadoFeedback(conUsuario, consulta).ok, false);
  const conMensaje = listado(consulta, [fila({ mensaje: MENSAJE })]);
  assert.equal(presentarListadoFeedback(conMensaje, consulta).ok, false);

  const ficha = presentarDetalleFeedback(detalle({ mensaje: "Uso <b>negrita</b> y sigue siendo texto." }));
  assert.equal(ficha.ok, true);
  assert.equal(ficha.feedback.mensaje, "Uso <b>negrita</b> y sigue siendo texto.");
  const ajeno = detalle();
  ajeno.feedback.usuario_id = ID_ADMIN;
  assert.equal(presentarDetalleFeedback(ajeno).ok, false);
  const correoEntero = detalle({ correo: "persona@example.com" });
  assert.equal(presentarDetalleFeedback(correoEntero).ok, false);
  assert.equal(presentarGestionFeedback({ ok: true, cambio: true, nota_admin: "secreta" }).ok, false);
  assert.deepEqual(presentarGestionFeedback({ ok: true, cambio: true }), { ok: true, cambio: true });
  assert.equal(interpretarConsultaFeedback({ categoria: "cultivo" }).ok, false);
  assert.equal(interpretarConsultaFeedback({ pagina: "0" }).ok, false);
});

test("solo el módulo feedback puede llamar sus funciones", () => {
  const consulta = consultaDe();
  const cuerpo = JSON.stringify(argumentosListadoFeedback(ID_ADMIN, consulta));
  const destino = { origen: ORIGEN };
  assert.equal(evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.feedback, solicitud(RPC_LISTADO_FEEDBACK, cuerpo), destino).ok, true);
  assert.equal(
    evaluarSolicitudAdmin(
      ACCESO_DATOS_ADMIN.feedback,
      solicitud(RPC_GESTION_FEEDBACK, JSON.stringify(argumentosGestionFeedback(ID_ADMIN, {
        id: ID_FEEDBACK,
        estado: "en_revision",
        prioridad: "alta",
        nota: "Nota con acento y segunda línea.",
      }))),
      destino,
    ).ok,
    true,
  );
  const notaLarga = "a".repeat(LIMITE_NOTA_FEEDBACK + 1);
  assert.equal(
    evaluarSolicitudAdmin(
      ACCESO_DATOS_ADMIN.feedback,
      solicitud(RPC_GESTION_FEEDBACK, JSON.stringify({ ...argumentosGestionFeedback(ID_ADMIN, {
        id: ID_FEEDBACK,
        estado: "nuevo",
        prioridad: "baja",
        nota: "ok",
      }), p_nota: notaLarga })),
      destino,
    ).motivo,
    "argumentos_no_permitidos",
  );
  const conUsuario = JSON.parse(cuerpo);
  conUsuario.usuario_id = ID_FEEDBACK;
  assert.equal(
    evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN.feedback, solicitud(RPC_LISTADO_FEEDBACK, JSON.stringify(conUsuario)), destino).motivo,
    "argumentos_no_permitidos",
  );
  for (const modulo of ["dashboard", "usuarios", "planes", "flora_ia"]) {
    assert.equal(
      evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN[modulo], solicitud(RPC_DETALLE_FEEDBACK, JSON.stringify(argumentosDetalleFeedback(ID_ADMIN, ID_FEEDBACK))), destino).motivo,
      "rpc_no_permitida",
    );
  }
  assert.equal(Object.keys(ACCESO_DATOS_ADMIN.feedback.tablas).length, 0);
  assert.equal(destinoAdminPermitido("/admin/feedback"), "/admin/feedback");
  assert.equal(destinoAdminPermitido(`/admin/feedback/${ID_FEEDBACK}`), `/admin/feedback/${ID_FEEDBACK}`);
  assert.equal(destinoAdminPermitido("/admin/feedback?categoria=otro"), "");
  assert.equal(enlaceDetalleFeedback(consulta, ID_FEEDBACK), `/admin/feedback/${ID_FEEDBACK}`);
});

test("un admin con permiso lista y gestiona; otro módulo no llega a la base", async () => {
  const consulta = consultaDe();
  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_FEEDBACK: ID_ADMIN },
      rest: ({ url, cuerpo }) => {
        if (url.pathname.endsWith(RPC_LISTADO_FEEDBACK)) {
          assert.equal(JSON.parse(cuerpo).p_admin, ID_ADMIN);
          return json(listado(consulta));
        }
        if (url.pathname.endsWith(RPC_DETALLE_FEEDBACK)) return json(detalle());
        if (url.pathname.endsWith(RPC_GESTION_FEEDBACK)) {
          const datos = JSON.parse(cuerpo);
          assert.equal(datos.p_admin, ID_ADMIN);
          assert.equal(datos.p_id, ID_FEEDBACK);
          assert.equal(Object.hasOwn(datos, "usuario_id"), false);
          assert.equal(Object.hasOwn(datos, "nota_admin"), false);
          return json({ ok: true, cambio: true });
        }
        return json({ ok: false, codigo: "consulta_invalida" });
      },
    },
    async (entorno) => {
      const autorizacion = await obtenerAdmin("feedback");
      assert.equal(autorizacion.ok, true);
      const cliente = crearClienteRestringido(autorizacion.credencial, "feedback");
      assert.throws(() => cliente.from("feedback_usuarios"), /tabla_no_permitida/);
      const lista = await leerListadoFeedback(autorizacion.credencial, consulta);
      assert.equal(lista.estado, "listo");
      assert.equal(lista.filas[0].nombre, "Ana");
      const ficha = await leerDetalleFeedback(autorizacion.credencial, ID_FEEDBACK);
      assert.equal(ficha.feedback.mensaje, MENSAJE);
      const guardado = await guardarFeedbackAdmin(autorizacion.credencial, {
        id: ID_FEEDBACK,
        estado: "en_revision",
        prioridad: "alta",
        nota: "Revisar en el próximo corte.",
        usuario_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      });
      assert.equal(guardado.estado, "listo");
      assert.equal(guardado.cambio, true);
      assert.deepEqual(
        entorno.rest.map((item) => item.url.pathname),
        [
          `/rest/v1/rpc/${RPC_LISTADO_FEEDBACK}`,
          `/rest/v1/rpc/${RPC_DETALLE_FEEDBACK}`,
          `/rest/v1/rpc/${RPC_GESTION_FEEDBACK}`,
        ],
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
      assert.equal((await leerListadoFeedback(planes.credencial, consulta)).estado, "denegado");
      assert.equal((await leerDetalleFeedback(planes.credencial, ID_FEEDBACK)).estado, "denegado");
      assert.equal((await guardarFeedbackAdmin(planes.credencial, {
        id: ID_FEEDBACK,
        estado: "descartado",
        prioridad: "baja",
        nota: "",
      })).estado, "denegado");
      const directo = await guardarGestionFeedback(null, formularioGestion({ usuario_id: ID_ADMIN }));
      assert.equal(directo.ok, false);
      assert.match(directo.error, /permiso/);
      assert.equal(entorno.rest.length, 0);
    },
  );
});

test("un error de guardado no confirma el cambio y la migración ausente no inventa filas", async () => {
  const consulta = consultaDe();
  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_FEEDBACK: ID_ADMIN },
      rest: () => json({ code: "PGRST202", message: "Could not find the function public.listar_feedback_admin" }, 404),
    },
    async () => {
      const autorizacion = await obtenerAdmin("feedback");
      const resultado = await leerListadoFeedback(autorizacion.credencial, consulta);
      assert.equal(resultado.estado, "migracion");
      assert.equal(resultado.filas, undefined);
      assert.match(resultado.error, /feedback-usuarios\.sql/);
      const gestion = await guardarGestionFeedback(null, formularioGestion());
      assert.equal(gestion.ok, false);
      assert.equal(gestion.cambio, undefined);
      assert.equal(String(gestion.error).includes("schema cache"), false);
    },
  );

  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_FEEDBACK: ID_ADMIN },
      rest: ({ url }) => {
        if (url.pathname.endsWith(RPC_GESTION_FEEDBACK)) return json({ message: "fallo persona@example.com" }, 500);
        return json(detalle());
      },
    },
    async () => {
      const gestion = await guardarGestionFeedback(null, formularioGestion());
      assert.equal(gestion.ok, false);
      assert.equal(String(gestion.error).includes("persona@"), false);
      assert.match(gestion.error, /siguen acá/);
    },
  );
});
