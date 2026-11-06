import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { DESTINOS_NAVEGACION, esRutaApp } from "../lib/navegacion.js";
import {
  aplicarPlantasIniciales,
  conteoPorDia,
  desplazarMes,
  fechaMasDias,
  nombreMes,
  grillaMes,
  hrefCalendario,
  hrefRegistroDesdeTarea,
  normalizarConsulta,
  normalizarTarea,
  rangoMes,
} from "../lib/calendario/modelo.js";
import {
  avisoDeTarea,
  clasificarFalloRecordatorios,
  conservarAvisoEnviado,
  GRACIA_AVISO_MS,
  instanteProgramadoMs,
  mensajeAvisoTarea,
  procesarRecordatorios,
  proximaEjecucionEstimada,
  resumenEjecucion,
  suscripcionesDelUsuario,
  tareaListaParaAviso,
  ZONA_TAREA,
} from "../lib/calendario/recordatorios.js";

const ESPACIO = "11111111-1111-4111-8111-111111111111";
const UNIDAD = "22222222-2222-4222-8222-222222222222";
const PLANTA = "33333333-3333-4333-8333-333333333333";
const AJENA = "44444444-4444-4444-8444-444444444444";
const TAREA = "55555555-5555-4555-8555-555555555555";

const contexto = {
  espacios: [
    {
      id: ESPACIO,
      nombre: "Indoor",
      unidades: [{ id: UNIDAD, nombre: "Carpa", plantas: [{ id: PLANTA, nombre: "OG" }] }],
    },
  ],
};

function tareaValida(extra = {}) {
  return normalizarTarea(
    {
      espacioId: ESPACIO,
      unidadId: UNIDAD,
      tipo: "riego",
      descripcion: "",
      fecha: "2026-11-02",
      hora: "09:30",
      plantaIds: [PLANTA],
      avisoPush: true,
      ...extra,
    },
    contexto,
  );
}

test("la consulta del calendario solo acepta filtros propios y un estado conocido", () => {
  const filtros = normalizarConsulta(
    {
      mes: "2026-11",
      unidad: UNIDAD,
      estado: "completada",
      fecha: "2026-11-02",
      tarea: TAREA,
      unidadAjena: AJENA,
    },
    "2026-11-02",
  );
  assert.equal(filtros.unidad, UNIDAD);
  assert.equal(filtros.estado, "completada");
  assert.equal(normalizarConsulta({ unidad: "no-es-uuid", estado: "ajeno", fecha: "ayer" }, "2026-11-02").unidad, "");
  assert.equal(normalizarConsulta({ estado: "hack" }, "2026-11-02").estado, "pendiente");
  assert.equal(hrefCalendario(filtros).startsWith("/calendario?"), true);
  assert.equal(hrefCalendario(filtros).includes(AJENA), false);
});

test("una tarea no puede colgarse de una unidad o planta de otro cultivo", () => {
  assert.equal(tareaValida().error, undefined);
  assert.equal(tareaValida().descripcion, "Riego");
  assert.equal(tareaValida({ plantaIds: [AJENA] }).error, "Una planta no pertenece a la unidad.");
  assert.equal(
    tareaValida({ espacioId: AJENA, unidadId: AJENA }).error,
    "No se encontró el espacio.",
  );
  assert.equal(tareaValida({ tipo: "inventada" }).error, "Elegí un tipo de tarea.");
  assert.equal(tareaValida({ tipo: "personalizada", descripcion: "   " }).error, "Escribí la tarea.");
  assert.equal(tareaValida({ hora: "25:99" }).error, "La hora no es válida.");
});

test("iniciar un registro precarga el contexto y no guarda nada por su cuenta", () => {
  const href = hrefRegistroDesdeTarea({
    id: TAREA,
    unidadId: UNIDAD,
    tipo: "fertilizacion",
    plantaIds: [PLANTA, "no-es-uuid"],
  });
  assert.equal(
    href,
    `/registros?unidad=${UNIDAD}&accion=fertilizacion&plantas=${PLANTA}&tarea=${TAREA}`,
  );
  assert.equal(href.includes("guardar"), false);
  assert.equal(hrefRegistroDesdeTarea({ id: TAREA, unidadId: UNIDAD, tipo: "revision" }).includes("accion="), false);
});

test("la grilla mensual empieza en lunes y cuenta las tareas del mes", () => {
  const celdas = grillaMes("2026-11");
  assert.equal(celdas[0].fecha, "2026-10-26");
  assert.equal(celdas[0].enMes, false);
  assert.equal(celdas[6].fecha, "2026-11-01");
  assert.equal(celdas[6].enMes, true);
  assert.equal(celdas.length, 42);
  const febrero = grillaMes("2026-02");
  assert.equal(febrero.length, 42);
  assert.equal(febrero[0].fecha, "2026-01-26");
  assert.equal(febrero[0].enMes, false);
  assert.equal(febrero[6].fecha, "2026-02-01");
  assert.equal(febrero.at(-1).fecha, "2026-03-08");
  assert.equal(febrero.at(-1).enMes, false);
  assert.deepEqual(rangoMes("2026-11"), { desde: "2026-11-01", hasta: "2026-11-30" });
  assert.equal(desplazarMes("2026-11", 1), "2026-12");
  assert.equal(fechaMasDias("2026-11-02", -14), "2026-10-19");
  assert.equal(desplazarMes("2026-01", -1), "2025-12");
  assert.equal(nombreMes("2026-11"), "Noviembre");
  assert.equal(nombreMes(desplazarMes("2026-11", -1)), "Octubre");
  assert.equal(nombreMes(desplazarMes("2026-11", 1)), "Diciembre");
  assert.equal(nombreMes("2026-01"), "Enero");
  const conteo = conteoPorDia([
    { fecha: "2026-11-02" },
    { fecha: "2026-11-02" },
    { fecha: "no" },
  ]);
  assert.equal(conteo.get("2026-11-02"), 2);
});

test("las plantas precargadas tienen que pertenecer a la unidad elegida", () => {
  const base = { unidadId: UNIDAD, modo: "unidad", ids: new Set([PLANTA]) };
  const manual = aplicarPlantasIniciales(base, [PLANTA, AJENA], [{ id: PLANTA }, { id: "otra" }]);
  assert.equal(manual.modo, "manual");
  assert.deepEqual([...manual.ids], [PLANTA]);
  const todas = aplicarPlantasIniciales(base, [PLANTA], [{ id: PLANTA }]);
  assert.equal(todas.modo, "unidad");
});

test("el calendario no suma un destino a la navegación inferior", () => {
  assert.equal(DESTINOS_NAVEGACION.length, 4);
  assert.equal(DESTINOS_NAVEGACION.some((item) => item.href === "/calendario"), false);
  assert.equal(esRutaApp("/calendario"), true);
  const panel = fs.readFileSync("componentes/inicio/panel-inicio.js", "utf8");
  assert.doesNotMatch(panel, /inicio-tareas|Próximas tareas/);
});

test("completar una tarea no crea un registro de cultivo", () => {
  const acciones = fs.readFileSync("app/calendario/acciones.js", "utf8");
  assert.equal(/from\(["']registros["']\)|guardarRegistro|crear_registro/.test(acciones), false);
  const sql = fs.readFileSync("supabase/calendario-tareas.sql", "utf8");
  const cambiar = sql.slice(
    sql.indexOf("function public.cambiar_estado_tarea_calendario"),
    sql.indexOf("function public.eliminar_tarea_calendario"),
  );
  assert.equal(/insert\s+into\s+public\.registros/i.test(cambiar), false);
  assert.match(cambiar, /set estado = p_estado/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /espacio\.usuario_id = auth\.uid\(\)/);
  assert.match(sql, /tarea\.usuario_id = auth\.uid\(\)/);
  assert.match(sql, /revoke all on function public\.reclamar_avisos_tareas\(integer\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.reclamar_avisos_tareas\(integer\) to service_role/);
  assert.equal(
    /grant execute on function public\.reclamar_avisos_tareas\(integer\) to authenticated/.test(sql),
    false,
  );
  assert.match(sql, /auth\.role\(\), ''\) <> 'service_role'/);
});

test("el recordatorio usa el mismo aviso push y no sale sin configuración", async () => {
  const cuando = instanteProgramadoMs("2026-11-02", "09:00");
  assert.equal(cuando, Date.UTC(2026, 10, 2, 12, 0, 0));
  const base = {
    id: TAREA,
    tipo: "riego",
    descripcion: "Riego",
    unidadNombre: "Carpa",
    estado: "pendiente",
    fecha: "2026-11-02",
    hora: "09:00",
    avisoPush: true,
  };
  assert.equal(tareaListaParaAviso(base, cuando - 1000), false);
  assert.equal(tareaListaParaAviso(base, cuando + 60 * 1000), true);
  assert.equal(tareaListaParaAviso(base, cuando + 13 * 60 * 60 * 1000), false);
  assert.equal(tareaListaParaAviso({ ...base, estado: "completada" }, cuando + 1000), false);
  assert.equal(tareaListaParaAviso({ ...base, estado: "cancelada" }, cuando + 1000), false);
  assert.equal(tareaListaParaAviso({ ...base, avisoEnviadoEn: "2026-11-02T12:00:00.000Z" }, cuando + 1000), false);
  assert.equal(tareaListaParaAviso({ ...base, avisoPush: false }, cuando + 1000), false);

  const aviso = avisoDeTarea(base);
  assert.equal(aviso.titulo, "Flora te recuerda una tarea");
  assert.equal(aviso.mensaje, "Es momento de realizar: Riego. Unidad: Carpa.");
  assert.equal(aviso.url, `/calendario?tarea=${TAREA}`);
  assert.equal(aviso.etiqueta, TAREA.replace(/-/g, ""));

  let reclamos = 0;
  let envios = 0;
  const quieto = await procesarRecordatorios({
    configurado: false,
    reclamar: async () => {
      reclamos += 1;
      return { examinadas: 0, tareas: [] };
    },
    despachar: async () => {
      envios += 1;
    },
  });
  assert.equal(quieto.omitido, "configuracion");
  assert.equal(reclamos, 0);
  assert.equal(envios, 0);

  const cerradas = [];
  const fallo = await procesarRecordatorios({
    configurado: true,
    reclamar: async () => ({
      examinadas: 1,
      tareas: [{ ...base, reclamadoEn: "2026-11-02T12:00:00.000Z", suscripciones: [{ endpoint: "https://fcm.googleapis.com/fcm/send/a" }] }],
    }),
    despachar: async () => {
      throw new Error("vapid");
    },
    cerrar: async (id, reclamadoEn, resultado) => {
      cerradas.push([id, resultado]);
    },
  });
  assert.equal(fallo.errores, 1);
  assert.equal(fallo.aceptadas, 0);
  assert.deepEqual(cerradas, [[TAREA, "reintentar"]]);

  const sinEquipo = await procesarRecordatorios({
    configurado: true,
    reclamar: async () => ({
      examinadas: 1,
      tareas: [{ ...base, reclamadoEn: "2026-11-02T12:00:00.000Z", suscripciones: [] }],
    }),
    despachar: async () => {
      envios += 1;
    },
    cerrar: async (id, reclamadoEn, resultado) => {
      cerradas.push([id, resultado]);
    },
  });
  assert.equal(sinEquipo.sinDispositivo, 1);
  assert.equal(envios, 0);
  assert.deepEqual(cerradas, [
    [TAREA, "reintentar"],
    [TAREA, "sin_dispositivo"],
  ]);
});

test("la hora de la tarea es hora de Argentina, también en los bordes del día", () => {
  assert.equal(ZONA_TAREA, "America/Argentina/Buenos_Aires");
  assert.equal(instanteProgramadoMs("2026-11-02", "09:00:00"), Date.UTC(2026, 10, 2, 12, 0, 0));
  assert.equal(instanteProgramadoMs("2026-01-15", "22:30"), Date.UTC(2026, 0, 16, 1, 30, 0));
  assert.equal(instanteProgramadoMs("2026-07-01", "00:00"), Date.UTC(2026, 6, 1, 3, 0, 0));
  assert.equal(instanteProgramadoMs("2026-11-02", "09:00", "UTC"), Date.UTC(2026, 10, 2, 9, 0, 0));
  assert.equal(Number.isNaN(instanteProgramadoMs("2026-11-02", "25:00")), true);

  const cuando = instanteProgramadoMs("2026-11-02", "09:00");
  const base = { estado: "pendiente", fecha: "2026-11-02", hora: "09:00", avisoPush: true };
  assert.equal(tareaListaParaAviso(base, cuando + GRACIA_AVISO_MS), true);
  assert.equal(tareaListaParaAviso(base, cuando + GRACIA_AVISO_MS + 1), false);
  assert.equal(tareaListaParaAviso({ ...base, aviso_push: false }, cuando + 1000), false);
  assert.equal(tareaListaParaAviso({ ...base, aviso_enviado_en: "2026-11-02T12:00:00.000Z" }, cuando + 1000), false);
});

test("cambiar la hora reprograma el aviso y cancelar o completar no lo deja listo", () => {
  const previa = { fecha: "2026-11-02", hora: "09:00", avisoEnviadoEn: "2026-11-02T12:00:00.000Z" };
  assert.equal(conservarAvisoEnviado(previa, { fecha: "2026-11-02", hora: "09:00:00" }), previa.avisoEnviadoEn);
  assert.equal(conservarAvisoEnviado(previa, { fecha: "2026-11-03", hora: "09:00" }), null);
  assert.equal(conservarAvisoEnviado(previa, { fecha: "2026-11-02", hora: "10:00" }), null);
  assert.equal(tareaListaParaAviso({ estado: "cancelada", fecha: "2026-11-02", hora: "09:00", avisoPush: true }, Date.now()), false);
  assert.equal(tareaListaParaAviso({ estado: "completada", fecha: "2026-11-02", hora: "09:00", avisoPush: true }, Date.now()), false);

  const sql = fs.readFileSync("supabase/calendario-tareas.sql", "utf8");
  assert.match(sql, /previa\.fecha_programada is distinct from p_fecha/);
  assert.match(sql, /previa\.hora_programada is distinct from p_hora/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /tarea\.estado = 'pendiente'/);
  assert.match(sql, /tarea\.aviso_push/);
  assert.match(sql, /America\/Argentina\/Buenos_Aires/);
});

test("un envío fallido se reintenta, un token vencido no se da por entregado y un duplicado sale una vez", async () => {
  const desactivadas = [];
  const cerradas = [];
  let envios = 0;
  const reclamadoEn = "2026-11-02T12:00:00.000Z";
  const parcial = await procesarRecordatorios({
    configurado: true,
    reclamar: async () => ({
      examinadas: 1,
      tareas: [
        {
          id: TAREA,
          tipo: "riego",
          descripcion: "Riego",
          unidadNombre: "Carpa",
          reclamadoEn,
          suscripciones: [
            { id: "equipo-ok", endpoint: "https://fcm.googleapis.com/fcm/send/a" },
            { id: "equipo-viejo", endpoint: "https://fcm.googleapis.com/fcm/send/b" },
          ],
        },
      ],
    }),
    despachar: async (suscripcion) => {
      envios += 1;
      if (suscripcion.id === "equipo-viejo") {
        const error = new Error("gone");
        error.statusCode = 410;
        throw error;
      }
      return { statusCode: 201 };
    },
    desactivar: async (id) => {
      desactivadas.push(id);
    },
    cerrar: async (id, marca, resultado) => {
      cerradas.push([id, marca, resultado]);
    },
  });
  assert.equal(parcial.enviados, 1);
  assert.equal(parcial.aceptadas, 1);
  assert.equal(parcial.errores, 0);
  assert.equal(envios, 2);
  assert.deepEqual(desactivadas, ["equipo-viejo"]);
  assert.deepEqual(cerradas, [[TAREA, reclamadoEn, "aceptado"]]);

  const vencidos = await procesarRecordatorios({
    configurado: true,
    reclamar: async () => ({
      examinadas: 1,
      tareas: [
        {
          id: TAREA,
          tipo: "riego",
          descripcion: "Riego",
          unidadNombre: "Carpa",
          reclamadoEn,
          suscripciones: [{ id: "equipo-viejo", endpoint: "https://fcm.googleapis.com/fcm/send/b" }],
        },
      ],
    }),
    despachar: async () => {
      const error = new Error("gone");
      error.statusCode = 410;
      throw error;
    },
    desactivar: async (id) => {
      desactivadas.push(id);
    },
    cerrar: async (id, marca, resultado) => {
      cerradas.push([id, marca, resultado]);
    },
  });
  assert.equal(vencidos.enviados, 0);
  assert.equal(vencidos.aceptadas, 0);
  assert.equal(vencidos.errores, 1);
  assert.deepEqual(cerradas.at(-1), [TAREA, reclamadoEn, "sin_dispositivo"]);

  envios = 0;
  const duplicado = await procesarRecordatorios({
    configurado: true,
    reclamar: async () => ({
      examinadas: 1,
      tareas: [
        { id: TAREA, tipo: "riego", descripcion: "Riego", unidadNombre: "Carpa", reclamadoEn, suscripciones: [{ endpoint: "https://fcm.googleapis.com/fcm/send/a" }] },
        { id: TAREA, tipo: "riego", descripcion: "Riego", unidadNombre: "Carpa", reclamadoEn, suscripciones: [{ endpoint: "https://fcm.googleapis.com/fcm/send/b" }] },
      ],
    }),
    despachar: async () => {
      envios += 1;
      return { statusCode: 201 };
    },
    cerrar: async () => {},
  });
  assert.equal(duplicado.enviados, 1);
  assert.equal(envios, 1);

  const cancelada = await procesarRecordatorios({
    configurado: true,
    reclamar: async () => ({
      examinadas: 1,
      tareas: [
        { id: TAREA, tipo: "riego", descripcion: "Riego", unidadNombre: "Carpa", reclamadoEn, fecha: "2026-11-02", hora: "09:00", suscripciones: [{ endpoint: "https://fcm.googleapis.com/fcm/send/a" }] },
      ],
    }),
    vigente: async () => ({ estado: "completada", aviso_push: true, fecha_programada: "2026-11-02", hora_programada: "09:00", aviso_reclamado_en: reclamadoEn }),
    despachar: async () => {
      envios += 1;
      return { statusCode: 201 };
    },
    cerrar: async (id, marca, resultado) => {
      cerradas.push([id, marca, resultado]);
    },
  });
  assert.equal(cancelada.omitidos, 1);
  assert.equal(envios, 1);
  assert.deepEqual(cerradas.at(-1), [TAREA, reclamadoEn, "liberar"]);
});

test("reprogramar durante el envío no usa el horario anterior y un fallo temporal se puede retomar", async () => {
  const reclamadoEn = "2026-11-06T17:00:00.000Z";
  const cerradas = [];
  let envios = 0;
  const reprogramada = await procesarRecordatorios({
    configurado: true,
    reclamar: async () => ({
      examinadas: 1,
      tareas: [
        {
          id: TAREA,
          descripcion: "Regar",
          unidadNombre: "Carpa",
          fecha: "2026-11-06",
          hora: "14:00",
          reclamadoEn,
          suscripciones: [{ endpoint: "https://fcm.googleapis.com/fcm/send/a" }],
        },
      ],
    }),
    vigente: async () => ({
      estado: "pendiente",
      aviso_push: true,
      fecha_programada: "2026-11-06",
      hora_programada: "16:20",
      aviso_reclamado_en: null,
    }),
    despachar: async () => {
      envios += 1;
      return { statusCode: 201 };
    },
    cerrar: async (id, marca, resultado) => {
      cerradas.push([id, marca, resultado]);
    },
  });
  assert.equal(envios, 0);
  assert.equal(reprogramada.omitidos, 1);
  assert.deepEqual(cerradas, [[TAREA, reclamadoEn, "liberar"]]);

  envios = 0;
  const recuperada = await procesarRecordatorios({
    configurado: true,
    reclamar: async () => ({
      examinadas: 1,
      tareas: [
        {
          id: TAREA,
          descripcion: "Regar",
          unidadNombre: "Carpa",
          reclamadoEn,
          suscripciones: [
            { endpoint: "https://fcm.googleapis.com/fcm/send/a" },
            { endpoint: "https://fcm.googleapis.com/fcm/send/b" },
          ],
        },
      ],
    }),
    despachar: async () => {
      envios += 1;
      if (envios === 1) {
        const error = new Error("ocupado");
        error.statusCode = 503;
        throw error;
      }
      return { statusCode: 201 };
    },
    cerrar: async (id, marca, resultado) => {
      cerradas.push([id, marca, resultado]);
    },
  });
  assert.equal(recuperada.enviados, 1);
  assert.equal(recuperada.aceptadas, 1);
  assert.equal(envios, 2);
  assert.deepEqual(cerradas.at(-1), [TAREA, reclamadoEn, "aceptado"]);
});

test("una tarea a los 3 minutos en Buenos Aires no se corre 3 horas", () => {
  const cuando = instanteProgramadoMs("2026-11-06", "14:03");
  assert.equal(cuando, Date.UTC(2026, 10, 6, 17, 3, 0));
  const pendiente = { estado: "pendiente", fecha: "2026-11-06", hora: "14:03", avisoPush: true };
  assert.equal(tareaListaParaAviso(pendiente, cuando - 3 * 60 * 1000), false);
  assert.equal(tareaListaParaAviso(pendiente, cuando + 60 * 1000), true);
  assert.equal(tareaListaParaAviso(pendiente, cuando + 3 * 60 * 60 * 1000), false);
  assert.equal(tareaListaParaAviso({ ...pendiente, estado: "completada" }, cuando + 1000), false);
  assert.equal(tareaListaParaAviso({ ...pendiente, estado: "cancelada" }, cuando + 1000), false);
  assert.equal(mensajeAvisoTarea({ descripcion: "Medir pH" }), "Es momento de realizar: Medir pH.");
  assert.deepEqual(
    suscripcionesDelUsuario(
      [
        { usuario_id: "dueno", endpoint: "propia" },
        { usuario_id: "otra", endpoint: "ajena" },
      ],
      "dueno",
    ).map((item) => item.endpoint),
    ["propia"],
  );
  assert.deepEqual(suscripcionesDelUsuario([{ usuario_id: "dueño", endpoint: "propia" }], ""), []);

  const reciente = proximaEjecucionEstimada("2026-11-06T17:03:10.000Z", Date.parse("2026-11-06T17:03:40.000Z"));
  assert.equal(reciente.fiable, true);
  assert.equal(proximaEjecucionEstimada(null, Date.parse("2026-11-06T17:03:40.000Z")).fiable, false);
  assert.equal(
    proximaEjecucionEstimada("2026-11-06T16:00:00.000Z", Date.parse("2026-11-06T17:03:40.000Z")).fiable,
    false,
  );
  const resumen = resumenEjecucion({
    estado: "ok",
    examinadas: 2,
    elegibles: 1,
    procesadas: 1,
    aceptadas: 1,
    descripcion: "Medir pH",
    endpoint: "https://fcm.googleapis.com/secreto",
  });
  assert.equal(Object.hasOwn(resumen, "descripcion"), false);
  assert.equal(Object.hasOwn(resumen, "endpoint"), false);
  assert.equal(resumen.aceptadas, 1);
  assert.equal(clasificarFalloRecordatorios({ code: "PGRST202", message: "schema cache y endpoint secreto" }), "migracion");
  assert.equal(clasificarFalloRecordatorios({ message: "otro" }), "excepcion");
});

test("el cron de recordatorios se suma sin tocar los crons que ya estaban", () => {
  const { crons } = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
  assert.deepEqual(
    crons.map((cron) => `${cron.path} ${cron.schedule}`),
    [
      "/api/cotizacion/actualizar 20 7,19 * * *",
      "/api/pagos/reconciliar 15 * * * *",
      "/api/pagos/plus/renovar-importe 45 * * * *",
      "/api/push/lanzamiento 7,22,37,52 * * * *",
      "/api/calendario/recordatorios * * * * *",
    ],
  );
  const ruta = fs.readFileSync("app/api/calendario/recordatorios/route.js", "utf8");
  assert.match(ruta, /cronAutorizado/);
  assert.match(ruta, /clasificarFalloRecordatorios/);
  assert.equal(ruta.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.equal(ruta.includes("error.message"), false);
  const sql = fs.readFileSync("supabase/calendario-recordatorios.sql", "utf8");
  assert.match(sql, /interval '30 minutes'/);
  assert.match(sql, /America\/Argentina\/Buenos_Aires/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /aviso_intentos < 5/);
  assert.equal(/delete from public\.tareas_programadas/i.test(sql), false);
  assert.match(sql, /grant execute on function public\.reclamar_avisos_calendario\(integer\) to service_role/);
  assert.equal(/grant execute on function public\.reclamar_avisos_calendario\(integer\) to authenticated/.test(sql), false);
  assert.match(sql, /set aviso_enviado_en = clock_timestamp\(\)/);
  const reclamo = sql.slice(sql.indexOf("function public.reclamar_avisos_calendario"), sql.indexOf("function public.cerrar_intento_aviso_calendario"));
  assert.equal(/aviso_enviado_en =/.test(reclamo), false);
});
