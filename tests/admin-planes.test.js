import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { leerDetalleOperacionPlanes, leerResumenPlanes } from "../lib/admin/planes.js";
import { calcularResumenPlanes, evaluarLicencia, evaluarSuscripcion, listarOperaciones } from "../lib/admin/planes-calculo.js";
import {
  RPC_RESUMEN_PLANES,
  TAMANO_PAGINA_PLANES,
  argumentosResumen,
  clasificarErrorPlanes,
  interpretarConsultaPlanes,
  presentarDetalleOperacion,
  presentarOperacionesPlanes,
  presentarResumenPlanes,
} from "../lib/admin/planes-reglas.js";
import { ACCESO_DATOS_ADMIN, evaluarSolicitudAdmin } from "../lib/admin/politica.js";
import { obtenerAdmin } from "../lib/admin/autorizacion.js";
import { crearClienteRestringido } from "../lib/admin/servicio.js";
import { conSupabaseFalso } from "./ayudas/supabase-falso.js";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ID_ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORIGEN = "https://proyecto-falso.supabase.test";
const AHORA = new Date("2026-11-02T15:00:00.000Z");
const DENTRO = "2026-11-02T18:00:00.000Z";
const ANTES = "2026-10-01T15:00:00.000Z";
const FUTURO = "2026-12-02T15:00:00.000Z";

function usuario() {
  return { id: ID_ADMIN, email: "persona@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false };
}

function json(cuerpo, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json" } });
}

function consulta7(ambiente = "produccion") {
  const interpretado = interpretarConsultaPlanes({ periodo: "7", ambiente }, AHORA);
  assert.equal(interpretado.ok, true);
  return interpretado.consulta;
}

function movimiento(parcial) {
  return {
    origen: "cultivo",
    ambiente: "produccion",
    estado: "acreditado",
    importeCentavos: 0,
    acreditadoEn: DENTRO,
    creadoEn: DENTRO,
    claveMp: null,
    suscripcionId: null,
    periodoHasta: null,
    usuarioId: "usuario-a",
    ...parcial,
  };
}

function resumenVacio(consulta) {
  return {
    ok: true,
    generado_en: AHORA.toISOString(),
    ambiente: consulta.ambiente,
    desde: consulta.desde,
    hasta: consulta.hasta,
    moneda: "ARS",
    ingresos_acreditados_centavos: 0,
    ingresos_plus_centavos: 0,
    ingresos_cultivo_centavos: 0,
    sin_importe: 0,
    cruces_importe: 0,
    acreditados_sin_fecha: 0,
    suscripciones_activas: 0,
    suscripciones_habilitadas: 0,
    suscripciones_canceladas: 0,
    suscripciones_activas_sin_pago: 0,
    licencias_cobertura: 0,
    licencias_habilitan_pago: 0,
    licencias_sin_cobro: 0,
    licencias_sin_pago: 0,
    pagos_pendientes: 0,
    pagos_rechazados: 0,
    pagos_acreditados: 0,
    pagos_reembolsados: 0,
    pagos_contracargos: 0,
    pagos_creados: 0,
    pagos_cancelados: 0,
    clientes_pago_nuevos: 0,
    ingresos_netos_disponibles: false,
    mrr_disponible: false,
    reembolsos_importe_disponible: false,
    serie_dia: consulta.dias.map((dia) => ({ dia, centavos: 0 })),
    serie_mes: consulta.meses.map((mes) => ({ mes, centavos: 0 })),
  };
}

test("el período de 7 días usa días de Argentina y rechaza ambiente, rango y página inválidos", () => {
  const consulta = consulta7();
  assert.equal(consulta.desdeDia, "2026-10-27");
  assert.equal(consulta.hastaDia, "2026-11-02");
  assert.equal(consulta.desde, "2026-10-27T03:00:00.000Z");
  assert.equal(consulta.hasta, "2026-11-03T03:00:00.000Z");
  assert.equal(consulta.dias.length, 7);
  assert.equal(interpretarConsultaPlanes({ periodo: "90" }, AHORA).consulta.dias.length, 90);
  assert.equal(interpretarConsultaPlanes({ ambiente: "sandbox" }, AHORA).ok, false);
  assert.equal(interpretarConsultaPlanes({ periodo: "personalizado", desde: "2026-11-02", hasta: "2026-10-01" }, AHORA).ok, false);
  assert.equal(interpretarConsultaPlanes({ periodo: "personalizado", desde: "2026-01-01", hasta: "2027-02-01" }, AHORA).ok, false);
  assert.equal(interpretarConsultaPlanes({ pagina: "0" }, AHORA).ok, false);
  assert.equal(interpretarConsultaPlanes({ pagina: "2" }, AHORA).consulta.offset, TAMANO_PAGINA_PLANES);
  assert.equal(interpretarConsultaPlanes({ producto: "regalo" }, AHORA).ok, false);
  assert.equal(interpretarConsultaPlanes({ estado: "devuelto" }, AHORA).ok, false);
});

test("los ingresos separan producción de prueba, no cuentan pendientes ni el mismo pago dos veces", () => {
  const consulta = consulta7();
  const movimientos = [
    movimiento({ id: "c1", usuarioId: "a", claveMp: "MP-1", importeCentavos: 300000, precioUsd: 30 }),
    movimiento({ id: "p1", origen: "plus", usuarioId: "a", claveMp: "MP-1", importeCentavos: 300000, precioUsd: 4.2 }),
    movimiento({ id: "p2", origen: "plus", usuarioId: "b", estado: "pendiente", importeCentavos: null, importeListaCentavos: 50000, claveMp: null }),
    movimiento({ id: "c2", usuarioId: "c", ambiente: "prueba", claveMp: "MP-S", importeCentavos: 999999 }),
    movimiento({ id: "p3", origen: "plus", usuarioId: "d", claveMp: "MP-5", importeCentavos: null, precioUsd: 4.2 }),
    movimiento({ id: "c3", usuarioId: "h", claveMp: "MP-6", estado: "reembolsado", importeCentavos: 10000 }),
    movimiento({ id: "c4", usuarioId: "e", claveMp: "MP-7", importeCentavos: 42000, acreditadoEn: ANTES, creadoEn: ANTES }),
    movimiento({ id: "p4", origen: "plus", usuarioId: "e", claveMp: "MP-8", importeCentavos: 1000 }),
    movimiento({ id: "c5", usuarioId: "f", claveMp: "MP-4", importeCentavos: 2000 }),
    movimiento({
      id: "p5",
      origen: "plus",
      usuarioId: "g",
      claveMp: "MP-9",
      importeCentavos: 1500,
      suscripcionId: "s2",
      periodoHasta: FUTURO,
    }),
    movimiento({ id: "x1", origen: "plus", usuarioId: "z", claveMp: "MP-X", importeCentavos: 100 }),
    movimiento({ id: "x2", usuarioId: "z", claveMp: "MP-X", importeCentavos: 200 }),
  ];
  const suscripciones = [
    { id: "s1", usuarioId: "a", ambiente: "produccion", estadoInterno: "activa", periodoVigenteHasta: FUTURO, vigenteHastaFinPeriodo: false },
    { id: "s2", usuarioId: "g", ambiente: "produccion", estadoInterno: "activa", periodoVigenteHasta: FUTURO, vigenteHastaFinPeriodo: false },
    { id: "s3", usuarioId: "h", ambiente: "produccion", estadoInterno: "cancelada", periodoVigenteHasta: null, vigenteHastaFinPeriodo: false },
  ];
  const pagoBase = { usuarioId: "a", cicloId: "ciclo-1", ambiente: "produccion" };
  const licencias = [
    { id: "l1", usuarioId: "a", cicloId: "ciclo-1", pagoId: "pago-1", estado: "activa", cicloEstado: "activo", cicloUsuarioId: "a", pago: { ...pagoBase, id: "pago-1", estado: "acreditado" } },
    { id: "l2", usuarioId: "a", cicloId: "ciclo-2", pagoId: "pago-2", estado: "activa", cicloEstado: "activo", cicloUsuarioId: "a", pago: { id: "pago-2", usuarioId: "a", cicloId: "ciclo-2", ambiente: "produccion", estado: "pendiente" } },
    { id: "l3", usuarioId: "a", cicloId: "ciclo-3", pagoId: "pago-3", estado: "activa", cicloEstado: "finalizado", cicloUsuarioId: "a", pago: { id: "pago-3", usuarioId: "a", cicloId: "ciclo-3", ambiente: "produccion", estado: "acreditado" } },
    { id: "l4", usuarioId: "a", cicloId: "ciclo-4", pagoId: null, estado: "activa", cicloEstado: "activo", cicloUsuarioId: "a", pago: null },
  ];
  const resumen = calcularResumenPlanes({ ...consulta, movimientos, suscripciones, licencias, ahora: AHORA });
  assert.equal(resumen.ingresosAcreditadosCentavos, 304500);
  assert.equal(resumen.ingresosPlusCentavos, 302500);
  assert.equal(resumen.ingresosCultivoCentavos, 2000);
  assert.equal(resumen.sinImporte, 1);
  assert.equal(resumen.crucesImporte, 1);
  assert.equal(resumen.pagosPendientes, 1);
  assert.equal(resumen.pagosReembolsados, 1);
  assert.equal(resumen.pagosAcreditados, 6);
  assert.equal(resumen.clientesPagoNuevos, 3);
  assert.equal(resumen.suscripcionesActivas, 2);
  assert.equal(resumen.suscripcionesHabilitadas, 1);
  assert.equal(resumen.suscripcionesActivasSinPago, 1);
  assert.equal(resumen.suscripcionesCanceladas, 1);
  assert.equal(resumen.licenciasCobertura, 1);
  assert.equal(resumen.licenciasHabilitanPago, 2);
  assert.equal(resumen.licenciasSinCobro, 1);
  assert.equal(resumen.licenciasSinPago, 1);
  assert.equal(resumen.ingresosNetosDisponibles, false);
  assert.equal(resumen.mrrDisponible, false);
  assert.equal(resumen.reembolsosImporteDisponible, false);
  assert.equal(resumen.serieDia.reduce((total, punto) => total + punto.centavos, 0), 304500);
  assert.equal(JSON.stringify(resumen).includes("4.2"), false);

  const prueba = calcularResumenPlanes({ ...consulta7("prueba"), movimientos, suscripciones, licencias, ahora: AHORA });
  assert.equal(prueba.ingresosAcreditadosCentavos, 999999);
  assert.equal(prueba.ingresosPlusCentavos, 0);
  assert.equal(prueba.suscripcionesActivas, 0);
});

test("la cobertura de Plus y de licencia sigue la regla comercial y una activa no es un cobro", () => {
  const suelta = evaluarSuscripcion(
    { id: "s1", usuarioId: "a", ambiente: "produccion", estadoInterno: "activa", periodoVigenteHasta: FUTURO, vigenteHastaFinPeriodo: false },
    [],
    AHORA,
  );
  assert.equal(suelta.habilitada, false);
  assert.equal(suelta.incidencia, "sin_pago_acreditado");
  assert.equal(suelta.renovaciones, 0);

  const vencida = evaluarSuscripcion(
    { id: "s2", usuarioId: "a", ambiente: "produccion", estadoInterno: "past_due", periodoVigenteHasta: FUTURO, vigenteHastaFinPeriodo: false },
    [movimiento({ id: "p", origen: "plus", suscripcionId: "s2", periodoHasta: FUTURO, importeCentavos: 1000 })],
    AHORA,
  );
  assert.equal(vencida.habilitada, false);

  const conRenovacion = evaluarSuscripcion(
    { id: "s3", usuarioId: "a", ambiente: "produccion", estadoInterno: "activa", periodoVigenteHasta: FUTURO, vigenteHastaFinPeriodo: false },
    [
      movimiento({ id: "p1", origen: "plus", suscripcionId: "s3", acreditadoEn: ANTES, periodoHasta: ANTES, importeCentavos: 1000 }),
      movimiento({ id: "p2", origen: "plus", suscripcionId: "s3", periodoHasta: FUTURO, importeCentavos: 1100 }),
    ],
    AHORA,
  );
  assert.equal(conRenovacion.habilitada, true);
  assert.equal(conRenovacion.pagosAcreditados, 2);
  assert.equal(conRenovacion.renovaciones, 1);

  const finalizada = evaluarLicencia(
    {
      usuarioId: "a",
      cicloId: "ciclo",
      pagoId: "pago",
      estado: "activa",
      cicloEstado: "finalizado",
      cicloUsuarioId: "a",
      pago: { id: "pago", estado: "acreditado", ambiente: "produccion", usuarioId: "a", cicloId: "ciclo" },
    },
    "produccion",
  );
  assert.equal(finalizada.habilita, true);
  assert.equal(finalizada.cobertura, false);
  assert.equal(finalizada.incidencia, "ciclo_finalizado");
});

test("la paginación y los filtros de producto y estado recortan en el servidor lógico", () => {
  const consulta = { ...consulta7(), producto: "todos", estado: "todos", pagina: 2, offset: 25, limite: 25 };
  const movimientos = Array.from({ length: 30 }, (_, indice) =>
    movimiento({
      id: `c${String(indice).padStart(2, "0")}`,
      claveMp: `MP-${indice}`,
      estado: indice === 0 ? "acreditado" : "pendiente",
      importeCentavos: 1000,
      origen: indice < 3 ? "plus" : "cultivo",
      creadoEn: new Date(Date.parse(DENTRO) - indice * 1000).toISOString(),
      acreditadoEn: indice === 0 ? DENTRO : null,
    }),
  );
  const pagina = listarOperaciones(movimientos, consulta);
  assert.equal(pagina.total, 30);
  assert.equal(pagina.filas.length, 5);
  const soloPlus = listarOperaciones(movimientos, { ...consulta, producto: "plus", pagina: 1, offset: 0 });
  assert.equal(soloPlus.total, 3);
  assert.equal(soloPlus.filas.every((fila) => fila.origen === "plus"), true);
  const acreditados = listarOperaciones(movimientos, { ...consulta, estado: "acreditado", pagina: 1, offset: 0 });
  assert.equal(acreditados.total, 1);
  assert.equal(acreditados.filas[0].estado, "acreditado");
});

test("la respuesta agregada rechaza correos, netos inventados y series que no cierran", () => {
  const consulta = consulta7();
  const vacio = presentarResumenPlanes(resumenVacio(consulta), consulta);
  assert.equal(vacio.ok, true);
  assert.equal(vacio.resumen.ingresosAcreditadosCentavos, 0);
  assert.equal(vacio.resumen.ingresosNetosDisponibles, false);
  assert.equal(vacio.resumen.mrrDisponible, false);
  assert.match(vacio.resumen.textoMrr, /No disponible/);
  assert.equal(JSON.stringify(vacio).includes("@"), false);

  const conCorreo = resumenVacio(consulta);
  conCorreo.email = "secreto@example.com";
  assert.equal(presentarResumenPlanes(conCorreo, consulta).ok, false);
  assert.equal(presentarResumenPlanes({ ...resumenVacio(consulta), mrr_disponible: true }, consulta).ok, false);
  assert.equal(presentarResumenPlanes({ ...resumenVacio(consulta), ingresos_plus_centavos: 10 }, consulta).ok, false);
  const otraSerie = resumenVacio(consulta);
  otraSerie.serie_dia = otraSerie.serie_dia.map((punto, indice) => ({ ...punto, centavos: indice === 0 ? 10 : 0 }));
  assert.equal(presentarResumenPlanes(otraSerie, consulta).ok, false);

  const fila = {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    origen: "plus",
    fecha: DENTRO,
    producto: "plus",
    estado: "acreditado",
    importe_centavos: 1500,
    moneda: "ARS",
    ambiente: "produccion",
    usuario_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    referencia_mp: "12345",
  };
  const listado = presentarOperacionesPlanes({ ok: true, total: 1, limite: 25, offset: 0, filas: [fila] }, consulta);
  assert.equal(listado.ok, true);
  assert.equal(JSON.stringify(listado).includes("@"), false);
  assert.equal(presentarOperacionesPlanes({ ok: true, total: 1, limite: 25, offset: 0, filas: [{ ...fila, referencia_mp: "secreto@example.com" }] }, consulta).ok, false);
  assert.equal(presentarDetalleOperacion({ ok: true, operacion: { ...fila, checkout_url: "https://pago" } }).ok, false);
});

test("un permiso de Expo o de dashboard no consulta planes, y planes no lee tablas crudas", async () => {
  await conSupabaseFalso({ usuario: usuario(), entorno: { ADMIN_IDS_EXPO: ID_ADMIN } }, async (entorno) => {
    const expo = await obtenerAdmin("expo");
    assert.equal(expo.ok, true);
    assert.equal((await leerResumenPlanes(expo.credencial, consulta7())).estado, "denegado");
    assert.equal(entorno.rest.some((solicitud) => solicitud.url.pathname.includes("planes_admin")), false);
  });

  await conSupabaseFalso({ usuario: usuario(), entorno: { ADMIN_IDS_DASHBOARD: ID_ADMIN } }, async (entorno) => {
    const dashboard = await obtenerAdmin("dashboard");
    assert.equal((await leerDetalleOperacionPlanes(dashboard.credencial, "plus", "cccccccc-cccc-4ccc-8ccc-cccccccccccc")).estado, "denegado");
    assert.equal(entorno.rest.length, 0);
  });

  const politica = ACCESO_DATOS_ADMIN.planes;
  assert.equal(Object.keys(politica.tablas).length, 0);
  assert.equal(politica.rpcs.includes(RPC_RESUMEN_PLANES), true);
  assert.equal(Object.hasOwn(ACCESO_DATOS_ADMIN, "usuarios"), false);
  const destino = { origen: ORIGEN };
  const cuerpo = JSON.stringify(argumentosResumen(consulta7()));
  assert.equal(
    evaluarSolicitudAdmin(
      politica,
      { metodo: "POST", url: `${ORIGEN}/rest/v1/rpc/${RPC_RESUMEN_PLANES}`, cabeceras: new Headers({ accept: "application/json" }), cuerpo },
      destino,
    ).ok,
    true,
  );
  assert.equal(
    evaluarSolicitudAdmin(
      politica,
      {
        metodo: "POST",
        url: `${ORIGEN}/rest/v1/rpc/${RPC_RESUMEN_PLANES}`,
        cabeceras: new Headers({ accept: "application/json" }),
        cuerpo: JSON.stringify({ ...argumentosResumen(consulta7()), email: "secreto@example.com" }),
      },
      destino,
    ).motivo,
    "argumentos_no_permitidos",
  );
  assert.equal(
    evaluarSolicitudAdmin(
      ACCESO_DATOS_ADMIN.dashboard,
      { metodo: "POST", url: `${ORIGEN}/rest/v1/rpc/${RPC_RESUMEN_PLANES}`, cabeceras: new Headers({ accept: "application/json" }), cuerpo: "{}" },
      destino,
    ).motivo,
    "rpc_no_permitida",
  );
  assert.equal(
    evaluarSolicitudAdmin(
      politica,
      { metodo: "GET", url: `${ORIGEN}/rest/v1/pagos?select=importe_ars`, cabeceras: new Headers({ accept: "application/json" }) },
      destino,
    ).motivo,
    "tabla_no_permitida",
  );
});

test("con permiso de planes solo se llama la RPC y una función ausente no inventa cifras", async () => {
  const consulta = consulta7();
  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_PLANES: ID_ADMIN },
      rest: ({ url, cuerpo }) => {
        assert.equal(url.pathname, `/rest/v1/rpc/${RPC_RESUMEN_PLANES}`);
        assert.equal(cuerpo, JSON.stringify(argumentosResumen(consulta)));
        return json(resumenVacio(consulta));
      },
    },
    async (entorno) => {
      const autorizacion = await obtenerAdmin("planes");
      const cliente = crearClienteRestringido(autorizacion.credencial, "planes");
      assert.throws(() => cliente.from("pagos"), /tabla_no_permitida/);
      assert.throws(() => cliente.from("plus_suscripciones"), /tabla_no_permitida/);
      assert.throws(() => cliente.from("perfiles"), /tabla_no_permitida/);
      const resultado = await leerResumenPlanes(autorizacion.credencial, consulta);
      assert.equal(resultado.estado, "listo");
      assert.equal(resultado.resumen.ingresosAcreditadosCentavos, 0);
      assert.equal(JSON.stringify(resultado).includes("@"), false);
      assert.deepEqual(
        [...new Set(entorno.rest.map((solicitud) => solicitud.url.pathname))],
        [`/rest/v1/rpc/${RPC_RESUMEN_PLANES}`],
      );
    },
  );

  await conSupabaseFalso(
    {
      usuario: usuario(),
      entorno: { ADMIN_IDS_PLANES: ID_ADMIN },
      rest: () => json({ code: "PGRST202", message: "Could not find the function public.resumen_planes_admin" }, 404),
    },
    async () => {
      const autorizacion = await obtenerAdmin("planes");
      const resultado = await leerResumenPlanes(autorizacion.credencial, consulta7());
      assert.equal(resultado.estado, "migracion");
      assert.equal(Object.hasOwn(resultado, "resumen"), false);
      assert.match(resultado.error, /admin-planes\.sql/);
      assert.equal(resultado.error.includes("schema cache"), false);
    },
  );
  assert.equal(clasificarErrorPlanes({ code: "XX000", message: "secreto@example.com" }), "error");
});

test("la migración es de solo lectura, con permisos mínimos, y la página no usa la clave de servicio", () => {
  const sql = fs.readFileSync(path.join(RAIZ, "supabase/admin-planes.sql"), "utf8");
  const cuerpo = sql.replace(/--.*$/gm, "");
  assert.match(sql, /security definer/);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /importe_cobrado_ars/);
  assert.match(sql, /estado = 'acreditado'/);
  assert.match(sql, /revoke all on function public\.planes_admin_movimientos\(text\) from public, anon, authenticated, service_role/);
  assert.match(sql, /grant execute on function public\.resumen_planes_admin\(timestamptz, timestamptz, text\) to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.planes_admin_movimientos/);
  assert.doesNotMatch(sql, /precio_usd|checkout_url|init_point|auth\.users|perfiles|\bemail\b/i);
  assert.doesNotMatch(cuerpo, /\b(insert|update|delete|truncate|drop|alter)\b/i);

  const lectura = fs.readFileSync(path.join(RAIZ, "lib/admin/planes.js"), "utf8");
  assert.match(lectura, /crearClienteRestringido\(credencial, MODULO\)/);
  assert.doesNotMatch(lectura, /SUPABASE_SERVICE_ROLE_KEY|from\(/);
  for (const archivo of [
    "app/admin/planes/page.js",
    "app/admin/planes/operaciones/page.js",
    "app/admin/planes/suscripciones/page.js",
    "app/admin/planes/licencias/page.js",
  ]) {
    const fuente = fs.readFileSync(path.join(RAIZ, archivo), "utf8");
    assert.match(fuente, /obtenerAdmin|credencialPlanes/);
    assert.doesNotMatch(fuente, /crearClienteRestringido|SUPABASE_SERVICE_ROLE_KEY|checkout_url|email/);
  }
});
