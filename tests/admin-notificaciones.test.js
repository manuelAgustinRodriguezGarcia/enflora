import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { leerDetalleCampana, leerPanelNotificaciones } from "../lib/admin/notificaciones.js";
import {
  CATEGORIAS_ERROR,
  MOTIVOS_BAJA,
  PLATAFORMAS,
  RPC_DETALLE_CAMPANA,
  RPC_LISTAR_CAMPANAS,
  RPC_RECORDATORIOS_CALENDARIO,
  RPC_RESUMEN_NOTIFICACIONES,
  argumentosDetalleCampana,
  argumentosListarCampanas,
  argumentosResumenNotificaciones,
  clasificarErrorNotificaciones,
  clasificarFalloEnvio,
  enlaceNotificaciones,
  interpretarConsultaNotificaciones,
  presentarCampanasNotificaciones,
  presentarDetalleCampana,
  presentarRecordatoriosCalendario,
  presentarResumenNotificaciones,
  tasaErrorNotificaciones,
} from "../lib/admin/notificaciones-reglas.js";
import { obtenerAdmin } from "../lib/admin/autorizacion.js";
import { ACCESO_DATOS_ADMIN, evaluarSolicitudAdmin } from "../lib/admin/politica.js";
import { destinoAdminPermitido } from "../lib/admin/secciones.js";
import { crearClienteRestringido } from "../lib/admin/servicio.js";
import { afirmarSqlAdministrativo, cuerpoSql } from "./ayudas/sintaxis-sql-admin.js";
import { conSupabaseFalso } from "./ayudas/supabase-falso.js";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ID_ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USUARIO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAMPANA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ORIGEN = "https://proyecto-falso.supabase.test";
const AHORA = new Date("2026-11-03T15:00:00.000Z");

function usuario() {
  return { id: ID_ADMIN, email: "persona@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false };
}

function json(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });
}

function consultaDe(parametros = {}) {
  const interpretado = interpretarConsultaNotificaciones(parametros, AHORA);
  assert.equal(interpretado.ok, true);
  return interpretado.consulta;
}

function grupo(valores, clave, extra) {
  return valores.map((valor) => ({ [clave]: valor, ...extra(valor) }));
}

function resumenDe(consulta, extra = {}) {
  const base = {
    ok: true,
    aperturas_disponibles: false,
    envio_masivo_habilitado: false,
    desde: consulta.desde,
    hasta: consulta.hasta,
    medido_en: "2026-11-03T15:00:00.000Z",
    ultima_actividad: null,
    suscripciones: 0,
    activas: 0,
    inactivas: 0,
    usuarios_activos: 0,
    dispositivos_sin_cuenta: 0,
    invalidadas: 0,
    altas_periodo: 0,
    envios: 0,
    aceptados: 0,
    errores: 0,
    expirados: 0,
    omitidos: 0,
    pendientes: 0,
    envios_prueba: 0,
    envios_campana: 0,
    envios_periodo: 0,
    aceptados_periodo: 0,
    errores_periodo: 0,
    expirados_periodo: 0,
    omitidos_periodo: 0,
    por_plataforma: grupo(PLATAFORMAS, "plataforma", () => ({ suscripciones: 0, activas: 0 })),
    por_baja: grupo(MOTIVOS_BAJA, "motivo", () => ({ suscripciones: 0 })),
    por_error: grupo(CATEGORIAS_ERROR, "categoria", () => ({ envios: 0 })),
    serie: consulta.dias.map((dia) => ({ dia, suscripciones: 0, envios: 0, aceptados: 0 })),
  };
  return { ...base, ...extra, desde: consulta.desde, hasta: consulta.hasta, serie: extra.serie || base.serie };
}

function campanaDe(extra = {}) {
  return {
    id: CAMPANA,
    clave: "lanzamiento-2026-11",
    titulo: "Enflora ya está",
    estado: "borrador",
    creada_en: "2026-11-01T12:00:00.000Z",
    programada_para: "2026-11-01T12:00:00.000Z",
    iniciada_en: null,
    finalizada_en: null,
    habilitada: false,
    dispositivos: 0,
    envios: 0,
    aceptados: 0,
    errores: 0,
    expirados: 0,
    omitidos: 0,
    pendientes: 0,
    ...extra,
  };
}

function listaDe(consulta, filas = [], total = filas.length) {
  return { ok: true, total, limite: 20, offset: consulta.offset, filas };
}

function solicitud(rpc, cuerpo) {
  return {
    metodo: "POST",
    url: `${ORIGEN}/rest/v1/rpc/${rpc}`,
    cabeceras: new Headers({ accept: "application/json", "content-type": "application/json" }),
    cuerpo,
  };
}

test("el SQL de notificaciones es de solo lectura y no toca el envío existente", () => {
  const archivo = "supabase/admin-notificaciones.sql";
  const texto = fs.readFileSync(path.join(RAIZ, archivo), "utf8");
  afirmarSqlAdministrativo(texto, archivo);
  const cuerpo = cuerpoSql(texto);
  assert.match(cuerpo, /grant execute on function public\.resumen_notificaciones_admin\(timestamptz, timestamptz\) to service_role/);
  assert.equal(/to anon/.test(cuerpo), false);
  assert.equal(/to authenticated/.test(cuerpo), false);
  assert.equal(/drop function public\.push_/.test(cuerpo), false);
  assert.equal(/update public\.push_campanas/.test(cuerpo), false);
  assert.equal(/revoke .* on table public\.push_/.test(cuerpo), false);
  assert.equal(cuerpo.includes("endpoint"), false);
  assert.equal(cuerpo.includes("p256dh"), false);
});

test("varios dispositivos de una misma cuenta no inflan los usuarios y el vacío es válido", () => {
  const consulta = consultaDe({ periodo: "7" });
  const vacio = presentarResumenNotificaciones(resumenDe(consulta), consulta);
  assert.equal(vacio.ok, true);
  assert.equal(vacio.resumen.suscripciones, 0);
  assert.equal(tasaErrorNotificaciones(vacio.resumen), null);
  assert.equal(vacio.resumen.aperturas_disponibles, false);

  const serie = consulta.dias.map((dia, indice) =>
    indice === 0 ? { dia, suscripciones: 4, envios: 6, aceptados: 2 } : { dia, suscripciones: 0, envios: 0, aceptados: 0 },
  );
  const porPlataforma = PLATAFORMAS.map((plataforma) => {
    if (plataforma === "android") return { plataforma, suscripciones: 2, activas: 2 };
    if (plataforma === "ios") return { plataforma, suscripciones: 1, activas: 0 };
    if (plataforma === "escritorio") return { plataforma, suscripciones: 1, activas: 1 };
    return { plataforma, suscripciones: 0, activas: 0 };
  });
  const porBaja = MOTIVOS_BAJA.map((motivo) => ({ motivo, suscripciones: motivo === "expirada" ? 1 : 0 }));
  const porError = CATEGORIAS_ERROR.map((categoria) => ({
    categoria,
    envios: categoria === "temporal" || categoria === "suscripcion_invalida" || categoria === "omitido" ? 1 : 0,
  }));
  const presentado = presentarResumenNotificaciones(
    resumenDe(consulta, {
      suscripciones: 4,
      activas: 3,
      inactivas: 1,
      usuarios_activos: 1,
      dispositivos_sin_cuenta: 1,
      invalidadas: 1,
      altas_periodo: 4,
      envios: 6,
      aceptados: 2,
      errores: 1,
      expirados: 1,
      omitidos: 1,
      pendientes: 1,
      envios_prueba: 1,
      envios_campana: 5,
      envios_periodo: 6,
      aceptados_periodo: 2,
      errores_periodo: 1,
      expirados_periodo: 1,
      omitidos_periodo: 1,
      ultima_actividad: "2026-11-03T15:00:00.000Z",
      por_plataforma: porPlataforma,
      por_baja: porBaja,
      por_error: porError,
      serie,
    }),
    consulta,
  );
  assert.equal(presentado.ok, true);
  assert.equal(presentado.resumen.usuarios_activos, 1);
  assert.equal(presentado.resumen.activas, 3);
  assert.equal(tasaErrorNotificaciones(presentado.resumen), 1 / 5);
});

test("clasifica fallos sin conservar el mensaje y rechaza datos privados", () => {
  assert.equal(clasificarFalloEnvio({ estado: "aceptado", codigo: 201, error: null }), null);
  assert.equal(clasificarFalloEnvio({ estado: "expirado", codigo: 410, error: null }), "suscripcion_invalida");
  assert.equal(clasificarFalloEnvio({ estado: "error", codigo: 404, error: "https://push.example/secreto" }), "suscripcion_invalida");
  assert.equal(clasificarFalloEnvio({ estado: "error", codigo: 401, error: "token" }), "credenciales");
  assert.equal(clasificarFalloEnvio({ estado: "error", codigo: 503, error: "upstream" }), "temporal");
  assert.equal(clasificarFalloEnvio({ estado: "error", codigo: 429, error: null }), "temporal");
  assert.equal(clasificarFalloEnvio({ estado: "error", codigo: null, error: "interrumpido" }), "interrumpido");
  assert.equal(clasificarFalloEnvio({ estado: "omitido", codigo: null, error: "expirada" }), "omitido");
  assert.equal(clasificarFalloEnvio({ estado: "error", codigo: 400, error: "https://push.example/secreto" }), "otro");
  assert.equal(String(clasificarFalloEnvio({ estado: "error", codigo: 400, error: "secreto-endpoint" })).includes("secreto"), false);

  const consulta = consultaDe();
  const conEndpoint = resumenDe(consulta);
  conEndpoint.endpoint = "https://push.example/secreto";
  assert.equal(presentarResumenNotificaciones(conEndpoint, consulta).ok, false);
  const conError = resumenDe(consulta);
  conError.por_error = [...conError.por_error, { categoria: "otro", envios: 0, error: "https://push.example/secreto" }];
  assert.equal(presentarResumenNotificaciones(conError, consulta).ok, false);
  const abierta = resumenDe(consulta, { aperturas_disponibles: true });
  assert.equal(presentarResumenNotificaciones(abierta, consulta).ok, false);

  const lista = presentarCampanasNotificaciones(listaDe(consulta, [campanaDe()]), consulta);
  assert.equal(lista.ok, true);
  const conMensaje = campanaDe();
  conMensaje.mensaje = "texto privado";
  assert.equal(presentarCampanasNotificaciones(listaDe(consulta, [conMensaje]), consulta).ok, false);
  const detalle = presentarDetalleCampana({ ok: true, ...campanaDe({ aceptados: 2, envios: 2, dispositivos: 2 }) });
  assert.equal(detalle.ok, true);
  assert.equal(presentarDetalleCampana({ ok: true, ...campanaDe(), url: "https://enflora.com.ar" }).ok, false);
  assert.equal(presentarDetalleCampana({ ok: false, codigo: "no_encontrada" }).ok, false);
});

test("notificaciones solo puede leer sus tres agregados", () => {
  const consulta = consultaDe({ periodo: "7", estado: "borrador" });
  const destino = { origen: ORIGEN };
  assert.equal(
    evaluarSolicitudAdmin(
      ACCESO_DATOS_ADMIN.notificaciones,
      solicitud(RPC_RESUMEN_NOTIFICACIONES, JSON.stringify(argumentosResumenNotificaciones(consulta))),
      destino,
    ).ok,
    true,
  );
  assert.equal(
    evaluarSolicitudAdmin(
      ACCESO_DATOS_ADMIN.notificaciones,
      solicitud(RPC_LISTAR_CAMPANAS, JSON.stringify(argumentosListarCampanas(consulta))),
      destino,
    ).ok,
    true,
  );
  assert.equal(
    evaluarSolicitudAdmin(
      ACCESO_DATOS_ADMIN.notificaciones,
      solicitud(RPC_DETALLE_CAMPANA, JSON.stringify(argumentosDetalleCampana(CAMPANA))),
      destino,
    ).ok,
    true,
  );
  assert.equal(
    evaluarSolicitudAdmin(
      ACCESO_DATOS_ADMIN.notificaciones,
      solicitud(RPC_RECORDATORIOS_CALENDARIO, "{}"),
      destino,
    ).ok,
    true,
  );
  assert.equal(
    evaluarSolicitudAdmin(
      ACCESO_DATOS_ADMIN.notificaciones,
      solicitud(RPC_RECORDATORIOS_CALENDARIO, JSON.stringify({ p_id: CAMPANA })),
      destino,
    ).ok,
    false,
  );
  assert.equal(
    evaluarSolicitudAdmin(
      ACCESO_DATOS_ADMIN.notificaciones,
      { metodo: "GET", url: `${ORIGEN}/rest/v1/push_suscripciones?select=endpoint`, cabeceras: new Headers({ accept: "application/json" }) },
      destino,
    ).ok,
    false,
  );
  assert.equal(
    evaluarSolicitudAdmin(
      ACCESO_DATOS_ADMIN.notificaciones,
      solicitud("push_lote_pendiente", JSON.stringify({ p_campana: CAMPANA })),
      destino,
    ).ok,
    false,
  );
  for (const modulo of ["dashboard", "planes", "flora_ia", "usuarios", "almacenamiento", "expo"]) {
    assert.equal(
      evaluarSolicitudAdmin(ACCESO_DATOS_ADMIN[modulo], solicitud(RPC_RESUMEN_NOTIFICACIONES, "{}"), destino).motivo,
      "rpc_no_permitida",
    );
  }
  assert.equal(destinoAdminPermitido(`/admin/notificaciones/${CAMPANA}`), `/admin/notificaciones/${CAMPANA}`);
  assert.equal(destinoAdminPermitido("/admin/notificaciones/1"), "");
  assert.equal(enlaceNotificaciones(consulta, { id: CAMPANA, offset: 0 }).startsWith(`/admin/notificaciones/${CAMPANA}`), true);
});

test("con permiso se leen resumen y campañas; otro módulo no llega a la base", async () => {
  const consulta = consultaDe({ estado: "completada" });
  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_NOTIFICACIONES: ID_ADMIN },
      rest: ({ url }) => {
        if (url.pathname.endsWith(RPC_RESUMEN_NOTIFICACIONES)) return json(resumenDe(consulta));
        if (url.pathname.endsWith(RPC_LISTAR_CAMPANAS)) return json(listaDe(consulta));
        return json({ message: "inesperado" }, 404);
      },
    },
    async (entorno) => {
      const autorizacion = await obtenerAdmin("notificaciones");
      const cliente = crearClienteRestringido(autorizacion.credencial, "notificaciones");
      assert.throws(() => cliente.from("push_suscripciones"), /tabla_no_permitida/);
      const resultado = await leerPanelNotificaciones(autorizacion.credencial, consulta);
      assert.equal(resultado.estado, "listo");
      assert.equal(resultado.resumen.envios, 0);
      assert.equal(resultado.lista.total, 0);
      assert.equal(JSON.stringify(resultado).includes(USUARIO), false);
      assert.equal(JSON.stringify(resultado).includes("endpoint"), false);
      assert.deepEqual(
        entorno.rest.map((item) => item.url.pathname),
        [`/rest/v1/rpc/${RPC_RESUMEN_NOTIFICACIONES}`, `/rest/v1/rpc/${RPC_LISTAR_CAMPANAS}`],
      );
    },
  );

  await conSupabaseFalso({ usuario: usuario(), entorno: { ADMIN_IDS_PLANES: ID_ADMIN } }, async (entorno) => {
    const planes = await obtenerAdmin("planes");
    assert.equal((await leerPanelNotificaciones(planes.credencial, consulta)).estado, "denegado");
    assert.equal((await leerDetalleCampana(planes.credencial, CAMPANA)).estado, "denegado");
    assert.equal(entorno.rest.length, 0);
  });
});

test("una migración pendiente o un fallo de la base no inventan cifras ni copian el mensaje", async () => {
  const consulta = consultaDe();
  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_NOTIFICACIONES: ID_ADMIN },
      rest: () => json({ code: "PGRST202", message: "Could not find the function public.resumen_notificaciones_admin in the schema cache" }, 404),
    },
    async () => {
      const autorizacion = await obtenerAdmin("notificaciones");
      const resultado = await leerPanelNotificaciones(autorizacion.credencial, consulta);
      assert.equal(resultado.estado, "migracion");
      assert.equal(resultado.resumen, undefined);
      assert.equal(String(resultado.error).includes("schema cache"), false);
      assert.match(resultado.error, /admin-notificaciones\.sql/);
    },
  );

  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_NOTIFICACIONES: ID_ADMIN },
      rest: ({ url }) => {
        if (url.pathname.endsWith(RPC_RESUMEN_NOTIFICACIONES)) return json(resumenDe(consulta));
        return json({ message: "fallo interno persona@example.com https://push.example/secreto" }, 500);
      },
    },
    async () => {
      const autorizacion = await obtenerAdmin("notificaciones");
      const resultado = await leerPanelNotificaciones(autorizacion.credencial, consulta);
      assert.equal(resultado.estado, "error");
      assert.equal(resultado.resumen, undefined);
      assert.equal(String(resultado.error).includes("persona@"), false);
      assert.equal(String(resultado.error).includes("push.example"), false);
      assert.equal(clasificarErrorNotificaciones({ code: "PGRST202", message: "schema cache" }), "migracion");
    },
  );

  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_NOTIFICACIONES: ID_ADMIN },
      rest: () => json({ ok: false, codigo: "no_encontrada" }),
    },
    async () => {
      const autorizacion = await obtenerAdmin("notificaciones");
      const resultado = await leerDetalleCampana(autorizacion.credencial, CAMPANA);
      assert.equal(resultado.estado, "no_encontrada");
      assert.equal(resultado.campana, undefined);
    },
  );
});

test("los recordatorios del calendario no inventan entregas ni muestran tareas ajenas", () => {
  const ahora = Date.parse("2026-11-06T17:03:40.000Z");
  const base = {
    ok: true,
    cron_declarado: "* * * * *",
    zona_cron: "UTC",
    vercel_confirmado: false,
    entregas_disponibles: false,
    medido_en: "2026-11-06T17:03:40.000Z",
    hay_ejecucion: false,
    ultima: null,
  };
  const vacio = presentarRecordatoriosCalendario(base, ahora);
  assert.equal(vacio.ok, true);
  assert.equal(vacio.recordatorios.hayEjecucion, false);
  assert.equal(vacio.recordatorios.proxima.fiable, false);
  assert.equal(vacio.recordatorios.entregasDisponibles, false);
  assert.equal(vacio.recordatorios.vercelConfirmado, false);

  const conDatos = presentarRecordatoriosCalendario(
    {
      ...base,
      hay_ejecucion: true,
      ultima: {
        aceptadas: 1,
        elegibles: 1,
        errores: 0,
        estado: "ok",
        examinadas: 2,
        expiradas: 0,
        iniciada_en: "2026-11-06T17:03:10.000Z",
        motivo: null,
        omitidas: 0,
        procesadas: 1,
        sin_dispositivo: 0,
        terminada_en: "2026-11-06T17:03:11.000Z",
      },
    },
    ahora,
  );
  assert.equal(conDatos.ok, true);
  assert.equal(conDatos.recordatorios.proxima.fiable, true);
  assert.equal(conDatos.recordatorios.ultima.aceptadas, 1);

  const privada = presentarRecordatoriosCalendario(
    {
      ...base,
      hay_ejecucion: true,
      ultima: {
        aceptadas: 1,
        elegibles: 1,
        errores: 0,
        estado: "ok",
        examinadas: 2,
        expiradas: 0,
        iniciada_en: "2026-11-06T17:03:10.000Z",
        motivo: null,
        omitidas: 0,
        procesadas: 1,
        sin_dispositivo: 0,
        terminada_en: "2026-11-06T17:03:11.000Z",
        descripcion: "Medir pH",
      },
    },
    ahora,
  );
  assert.equal(privada.ok, false);
  assert.equal(presentarRecordatoriosCalendario({ ...base, vercel_confirmado: true }, ahora).ok, false);
  assert.equal(presentarRecordatoriosCalendario({ ...base, entregas_disponibles: true }, ahora).ok, false);
  const sql = fs.readFileSync(path.join(RAIZ, "supabase/calendario-recordatorios.sql"), "utf8");
  assert.equal(/endpoint|p256dh|user_agent/.test(cuerpoSql(sql)), false);
});

test("la página conserva la prueba actual y no arma un envío masivo", () => {
  const pagina = fs.readFileSync(path.join(RAIZ, "app/admin/notificaciones/page.js"), "utf8");
  assert.match(pagina, /PruebaNotificacionesAdmin/);
  assert.match(pagina, /RecordatoriosCalendario/);
  assert.equal(pagina.includes("masivo: true"), false);
  const sql = cuerpoSql(fs.readFileSync(path.join(RAIZ, "supabase/admin-notificaciones.sql"), "utf8"));
  assert.equal(/insert into public\.push_/.test(sql), false);
  assert.match(sql, /envio_masivo_habilitado', false/);
});
