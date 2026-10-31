import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { correoPayerOrden, leerAmbientePagos, leerRecepcionPagos, urlPublica } from "../lib/pagos/ambiente.js";
import { claveIdempotenciaOrden, cuerpoOrdenLicencia, fechaRegistroPagadorIso8601 } from "../lib/pagos/cuerpo-orden.js";
import { parsearBilleteVendedor, evaluarCotizacion } from "../lib/pagos/cotizacion-bna.js";
import {
  importeLicenciaCentavos,
  mismosImportes,
  textoArAEscala4,
  textoImporteOrden,
} from "../lib/pagos/dinero.js";
import { licenciaHabilita } from "../lib/pagos/cobertura.js";
import { ambienteCompatibleConAviso, eventoOrdenWebhook } from "../lib/pagos/evento-webhook.js";
import {
  aplicacionDuplicadaTerminal,
  estadoSiguiente,
  evaluarOrdenRemota,
  operacionDeOrden,
  resolverEstadoOrden,
} from "../lib/pagos/estados.js";
import { firmaWebhookValida, resumenFirmaWebhook } from "../lib/pagos/firma.js";
import { siguientePermitido } from "../lib/pagos/rutas.js";

const HTML = `
<table>
  <tr><th>21/10/2026</th><th>Compra</th><th>Venta</th></tr>
  <tr><td>Dolar U.S.A</td><td>1.495,00</td><td>1.545,00</td></tr>
  <tr><td>Euro</td><td>1.680,00</td><td>1.780,00</td></tr>
</table>
Hora Actualización: 17:02
<table>
  <tr><td>Dolar U.S.A</td><td>1517.0000</td><td>1526.0000</td></tr>
</table>
`;

test("lee el dólar billete vendedor y no la divisa", () => {
  const cotizacion = parsearBilleteVendedor(HTML);
  assert.equal(cotizacion.venta, textoArAEscala4("1.545,00"));
  assert.equal(cotizacion.compra, textoArAEscala4("1.495,00"));
  assert.equal(cotizacion.tipo, "billete_vendedor");
  assert.equal(cotizacion.publicadaEn, "2026-10-21T20:02:00.000Z");
});

test("rechaza cotización ausente o vieja y advierte antigüedad intermedia", () => {
  assert.equal(evaluarCotizacion(null).codigo, "cotizacion_invalida");
  const cotizacion = parsearBilleteVendedor(HTML);
  const domingo = new Date("2026-10-25T15:00:00.000Z");
  const domingoEval = evaluarCotizacion(cotizacion, domingo);
  assert.equal(domingoEval.ok, true);
  assert.equal(domingoEval.advertenciaAntigua, true);
  const tarde = new Date("2026-10-30T20:03:00.000Z");
  assert.equal(evaluarCotizacion(cotizacion, tarde).codigo, "cotizacion_antigua");
});

test("el importe de la orden sale como texto con dos decimales", () => {
  assert.equal(textoImporteOrden(46350), "46350.00");
  assert.equal(textoImporteOrden("46350.00"), "46350.00");
  assert.equal(textoImporteOrden("46350.5"), "46350.50");
  assert.equal(textoImporteOrden(0), null);
});

test("calcula USD 30 por el vendedor sin perder centavos", () => {
  const escala = textoArAEscala4("1.545,00");
  assert.equal(importeLicenciaCentavos(escala), 4635000);
  assert.equal(mismosImportes("46350.00", "46350.00"), true);
  assert.equal(mismosImportes(46350, "46350.00"), true);
  assert.equal(mismosImportes("46350.00", "46350.01"), false);
});

test("no baja un pago acreditado y sí revoca por reembolso", () => {
  assert.equal(estadoSiguiente("acreditado", "pendiente"), "acreditado");
  assert.equal(estadoSiguiente("acreditado", "rechazado"), "acreditado");
  assert.equal(estadoSiguiente("acreditado", "reembolsado"), "reembolsado");
  assert.equal(estadoSiguiente("reembolsado", "acreditado"), "reembolsado");
  assert.equal(estadoSiguiente("pendiente", "acreditado"), "acreditado");
});

test("un importe distinto no queda consistente", () => {
  const orden = {
    id: "ord-1",
    external_reference: "pago-1",
    currency: "ARS",
    user_id: "vendedor",
    status: "processed",
    total_amount: "10.00",
    transactions: { payments: [{ status: "approved", status_detail: "accredited" }] },
  };
  const evaluacion = evaluarOrdenRemota(
    { id: "pago-1", order_id: "ord-1", estado: "pendiente", vendedor_mp: "vendedor" },
    orden,
  );
  assert.equal(evaluacion.ok, true);
  assert.equal(evaluacion.estado, "acreditado");
  assert.equal(mismosImportes("46350.00", evaluacion.importe), false);
  assert.equal(resolverEstadoOrden({ transactions: { refunds: [{ status: "approved" }] } }), "reembolsado");
});

function firmar({ secreto, dataId, requestId, ts }) {
  const manifiesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = crypto.createHmac("sha256", secreto).update(manifiesto).digest("hex");
  return `ts=${ts},v1=${hash}`;
}

test("la firma conserva las mayúsculas del id y rechaza los casos inválidos", () => {
  const secreto = "secreto-de-prueba";
  const dataId = "ORDTST01M5H782T0920QWKNWCAZ7D2AG";
  const requestId = "req-1";
  const ts = "1710000000";
  const xSignature = firmar({ secreto, dataId, requestId, ts });
  const original = firmaWebhookValida({ xSignature, xRequestId: requestId, dataId, secret: secreto });
  assert.equal(original.ok, true);
  assert.equal(original.variante, "original");
  assert.equal(original.coincideOriginal, true);
  const documental = firmaWebhookValida({
    xSignature: firmar({ secreto, dataId: dataId.toLowerCase(), requestId, ts }),
    xRequestId: requestId,
    dataId,
    secret: secreto,
  });
  assert.equal(documental.ok, true);
  assert.equal(documental.variante, "minusculas");
  assert.equal(documental.coincideOriginal, false);
  assert.equal(documental.coincideMinusculas, true);
  const ajena = firmaWebhookValida({
    xSignature: firmar({ secreto, dataId: "59af8c96-4b16-441f-8628-dedfd9ae173f", requestId, ts }),
    xRequestId: requestId,
    dataId,
    secret: secreto,
  });
  assert.equal(ajena.ok, false);
  assert.equal(ajena.coincideOriginal, false);
  assert.equal(ajena.coincideMinusculas, false);
  assert.equal(
    firmaWebhookValida({
      xSignature: `ts=${ts},v1=${"0".repeat(64)}`,
      xRequestId: requestId,
      dataId,
      secret: secreto,
    }).codigo,
    "firma_no_coincide",
  );
  assert.equal(
    firmaWebhookValida({ xSignature, xRequestId: requestId, dataId, secret: "otra-clave" }).codigo,
    "firma_no_coincide",
  );
  assert.equal(
    firmaWebhookValida({ xSignature: "", xRequestId: requestId, dataId, secret: secreto }).codigo,
    "firma_ausente",
  );
  assert.equal(
    firmaWebhookValida({ xSignature: "v1=abc", xRequestId: requestId, dataId, secret: secreto }).codigo,
    "ts_ausente",
  );
  assert.equal(
    firmaWebhookValida({ xSignature: "ts=no-numero,v1=abc", xRequestId: requestId, dataId, secret: secreto }).codigo,
    "firma_malformada",
  );
  assert.equal(firmaWebhookValida({ secret: "" }).codigo, "sin_secreto");
  assert.equal(
    firmaWebhookValida({
      xSignature: firmar({ secreto, dataId, requestId, ts: "1000" }),
      xRequestId: requestId,
      dataId,
      secret: secreto,
    }).ok,
    true,
  );
  const resumen = resumenFirmaWebhook({ xSignature, xRequestId: requestId, dataId, secret: secreto });
  assert.equal(resumen.firma, true);
  assert.equal(resumen.requestId, true);
  assert.equal(resumen.dataId, true);
  assert.equal(resumen.ts, true);
  assert.equal(resumen.v1, true);
  assert.equal(resumen.secreto, true);
  assert.equal(resumen.idMayusculas, true);
  assert.equal(JSON.stringify(resumen).includes(secreto), false);
  assert.equal(JSON.stringify(resumen).includes(xSignature), false);
});

test("el payload cobra el total del ítem y no restringe el medio de pago", () => {
  const pagoId = "11111111-1111-4111-8111-111111111111";
  const cuerpo = cuerpoOrdenLicencia({ pagoId, importeDecimal: 46350, email: "" });
  assert.equal(cuerpo.type, "online");
  assert.equal(cuerpo.processing_mode, "manual");
  assert.equal(cuerpo.currency, "ARS");
  assert.equal(cuerpo.total_amount, "46350.00");
  assert.equal(cuerpo.items.length, 1);
  assert.equal(cuerpo.items[0].unit_price, cuerpo.total_amount);
  assert.equal(cuerpo.items[0].quantity, 1);
  assert.equal(
    cuerpo.items[0].description,
    "Licencia de seguimiento ENFLORA para un ciclo de cultivo",
  );
  assert.equal(cuerpo.items[0].category_id, "services");
  assert.equal(cuerpo.config.statement_descriptor, "ENFLORA");
  assert.equal(cuerpo.payer, undefined);
  assert.equal(cuerpo.additional_info, undefined);
  assert.equal(cuerpo.config.payment_method, undefined);
  assert.equal(cuerpo.config.online.allowed_user_type, undefined);
  assert.equal(cuerpo.config.online.auto_return, "all");
  assert.match(cuerpo.config.online.callback_url, /\/api\/mercadopago\/webhook$/);
  assert.match(cuerpo.config.online.success_url, new RegExp(`/pagos/resultado/${pagoId}$`));
  assert.equal(cuerpo.expiration_time, undefined);
  assert.equal(cuerpo.capture_mode, undefined);
  const conCorreo = cuerpoOrdenLicencia({
    pagoId,
    importeDecimal: "46350.00",
    email: "comprador@testuser.com",
  });
  assert.deepEqual(conCorreo.payer, { email: "comprador@testuser.com" });
  assert.equal(conCorreo.external_reference, pagoId);
  assert.equal(claveIdempotenciaOrden(pagoId, ""), pagoId);
  assert.notEqual(claveIdempotenciaOrden(pagoId, "comprador@testuser.com"), pagoId);
});

test("el payload incluye nombre del perfil y fecha real de registro sin documento", () => {
  const pagoId = "22222222-2222-4222-8222-222222222222";
  const cuerpo = cuerpoOrdenLicencia({
    pagoId,
    importeDecimal: 100,
    email: "dueno@enflora.com",
    nombre: "  Ana  ",
    apellido: "García",
    fechaRegistro: "2024-05-10T14:22:11.123Z",
  });
  assert.deepEqual(cuerpo.payer, {
    email: "dueno@enflora.com",
    first_name: "Ana",
    last_name: "García",
  });
  assert.equal(
    cuerpo.additional_info["payer.registration_date"],
    "2024-05-10T14:22:11.123Z",
  );
  assert.equal(cuerpo.payer.identification, undefined);
  assert.equal(fechaRegistroPagadorIso8601("fecha-invalida"), null);
  assert.equal(fechaRegistroPagadorIso8601(null), null);
  const sinApellido = cuerpoOrdenLicencia({
    pagoId,
    importeDecimal: 100,
    email: "dueno@enflora.com",
    nombre: "Ana",
    apellido: "   ",
  });
  assert.deepEqual(sinApellido.payer, { email: "dueno@enflora.com", first_name: "Ana" });
});

test("el correo de prueba no se usa en producción ni reemplaza al dueño de Enflora", () => {
  const env = { MERCADOPAGO_TEST_BUYER_EMAIL: "comprador@testuser.com" };
  assert.deepEqual(
    correoPayerOrden({ ambiente: "produccion", emailUsuario: "dueno@enflora.com", env }),
    { email: "dueno@enflora.com" },
  );
  assert.deepEqual(
    correoPayerOrden({ ambiente: "prueba", emailUsuario: "dueno@enflora.com", env }),
    { email: "comprador@testuser.com" },
  );
  assert.deepEqual(
    correoPayerOrden({ ambiente: "prueba", emailUsuario: "dueno@enflora.com", env: {} }),
    { email: "" },
  );
  assert.equal(
    correoPayerOrden({
      ambiente: "prueba",
      emailUsuario: "dueno@enflora.com",
      env: { MERCADOPAGO_TEST_BUYER_EMAIL: "sin-arroba" },
    }).codigo,
    "comprador_prueba_invalido",
  );
});

test("processed y accredited acredita, y un reembolso parcial revoca", () => {
  const base = {
    id: "ord-1",
    external_reference: "pago-1",
    currency: "ARS",
    status: "processed",
    status_detail: "accredited",
    total_amount: "46350.00",
    transactions: {
      payments: [
        {
          status: "processed",
          status_detail: "accredited",
          reference_id: "184447243907",
        },
      ],
    },
  };
  assert.equal(resolverEstadoOrden(base), "acreditado");
  assert.equal(operacionDeOrden(base), "184447243907");
  assert.equal(operacionDeOrden({ transactions: { payments: [{ reference: { id: "183961436800" } }] } }), "183961436800");
  assert.equal(resolverEstadoOrden({ status: "processed", status_detail: "pending" }), "pendiente");
  assert.equal(resolverEstadoOrden({ status: "created" }), "pendiente");
  assert.equal(resolverEstadoOrden({ status: "action_required" }), "pendiente");
  const parcial = {
    ...base,
    transactions: {
      payments: base.transactions.payments,
      refunds: [{ status: "approved", amount: "10.00" }],
    },
  };
  assert.equal(resolverEstadoOrden(parcial), "reembolsado");
  assert.equal(
    estadoSiguiente("acreditado", resolverEstadoOrden(parcial)),
    "reembolsado",
  );
});

test("el webhook de orders acepta el evento oficial y separa el aviso en vivo", () => {
  assert.equal(eventoOrdenWebhook({ type: "order" }), true);
  assert.equal(eventoOrdenWebhook({ topic: "orders_v2" }), true);
  assert.equal(eventoOrdenWebhook({ type: "payment" }), false);
  assert.equal(ambienteCompatibleConAviso("prueba", false), true);
  assert.equal(ambienteCompatibleConAviso("prueba", true), false);
  assert.equal(ambienteCompatibleConAviso("produccion", true), true);
  assert.equal(ambienteCompatibleConAviso("produccion", false), false);
});

test("apagar cobros nuevos no apaga la recepción de pagos ya iniciados", () => {
  const env = {
    NODE_ENV: "production",
    MERCADOPAGO_ENV: "produccion",
    PAYMENTS_LIVE_ENABLED: "false",
  };
  assert.equal(leerAmbientePagos(env).codigo, "cobros_reales_desactivados");
  assert.equal(leerRecepcionPagos(env).ok, true);
  assert.equal(leerRecepcionPagos(env).ambiente, "produccion");
  assert.equal(leerRecepcionPagos(env).cobrosReales, false);
});

test("una licencia de prueba no habilita producción ni otro ciclo", () => {
  const licencia = {
    estado: "activa",
    pago_id: "pago-1",
    ciclo_cultivo_id: "ciclo-1",
    usuario_id: "usuario-1",
  };
  const pago = {
    id: "pago-1",
    estado: "acreditado",
    ambiente: "prueba",
    ciclo_cultivo_id: "ciclo-1",
    usuario_id: "usuario-1",
  };
  assert.equal(licenciaHabilita({ licencia, pago, ambiente: "produccion" }), false);
  assert.equal(licenciaHabilita({ licencia, pago, ambiente: "prueba" }), true);
  assert.equal(
    licenciaHabilita({
      licencia,
      pago: { ...pago, ambiente: "produccion" },
      ambiente: "produccion",
    }),
    true,
  );
  assert.equal(
    licenciaHabilita({
      licencia: { ...licencia, ciclo_cultivo_id: "ciclo-2" },
      pago,
      ambiente: "prueba",
    }),
    false,
  );
});

test("licenciaHabilita exige titular y pago acreditado", () => {
  const licencia = {
    estado: "activa",
    pago_id: "pago-1",
    ciclo_cultivo_id: "ciclo-1",
    usuario_id: "usuario-1",
  };
  const pagoAcreditado = {
    id: "pago-1",
    estado: "acreditado",
    ambiente: "produccion",
    ciclo_cultivo_id: "ciclo-1",
    usuario_id: "usuario-1",
  };
  assert.equal(
    licenciaHabilita({ licencia, pago: pagoAcreditado, ambiente: "produccion", usuarioId: "usuario-2" }),
    false,
  );
  assert.equal(
    licenciaHabilita({ licencia, pago: { ...pagoAcreditado, estado: "pendiente" }, ambiente: "produccion" }),
    false,
  );
  assert.equal(
    licenciaHabilita({ licencia, pago: pagoAcreditado, ambiente: "produccion", usuarioId: "usuario-1" }),
    true,
  );
});

test("una orden creada no acredita la licencia", () => {
  const orden = {
    id: "ord-1",
    external_reference: "pago-1",
    currency: "ARS",
    status: "created",
    total_amount: "46350.00",
  };
  const evaluacion = evaluarOrdenRemota(
    { id: "pago-1", order_id: "ord-1", estado: "pendiente" },
    orden,
  );
  assert.equal(evaluacion.ok, true);
  assert.equal(evaluacion.estado, "pendiente");
  assert.notEqual(evaluacion.estado, "acreditado");
});

test("reintentos con otro x-request-id no repiten acreditación terminal", () => {
  const pago = { id: "pago-1", estado: "acreditado", order_id: "ord-1" };
  const orden = {
    id: "ord-1",
    external_reference: "pago-1",
    currency: "ARS",
    status: "processed",
    status_detail: "accredited",
    total_amount: "46350.00",
    transactions: {
      payments: [{ status: "processed", status_detail: "accredited", reference_id: "1" }],
    },
  };
  const evaluacion = evaluarOrdenRemota(pago, orden);
  assert.equal(
    aplicacionDuplicadaTerminal(pago, evaluacion, true),
    true,
  );
});

test("sin PAYMENTS_LIVE_ENABLED no hay cobro real y desarrollo exige prueba", () => {
  assert.equal(leerAmbientePagos({ NODE_ENV: "production" }).codigo, "ambiente_no_declarado");
  assert.equal(
    leerAmbientePagos({ NODE_ENV: "production", MERCADOPAGO_ENV: "produccion" }).codigo,
    "cobros_reales_desactivados",
  );
  assert.equal(
    leerAmbientePagos({
      NODE_ENV: "production",
      MERCADOPAGO_ENV: "produccion",
      PAYMENTS_LIVE_ENABLED: "true",
    }).ambiente,
    "produccion",
  );
  assert.equal(
    leerAmbientePagos({
      NODE_ENV: "development",
      MERCADOPAGO_ENV: "prueba",
      MERCADOPAGO_PRUEBAS_CONFIRMADAS: "true",
      PAYMENTS_LIVE_ENABLED: "true",
    }).codigo,
    "cobros_reales_bloqueados",
  );
  assert.equal(urlPublica({ NODE_ENV: "production" }), "https://enflora.com.ar");
  assert.equal(siguientePermitido("https://malicioso"), "");
  assert.equal(siguientePermitido("/pagos/licencia"), "/pagos/licencia");
});
