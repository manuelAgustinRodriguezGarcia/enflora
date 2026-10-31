import assert from "node:assert/strict";
import test from "node:test";
import { convertirUsdAArs, mapearCotizacionComercial } from "../lib/pagos/cotizacion-comercial.js";
import { parsearBilleteVendedor, evaluarCotizacion } from "../lib/pagos/cotizacion-bna.js";
import { importeLicenciaCentavos, importeUsdEnArsCentavos, textoArAEscala4 } from "../lib/pagos/dinero.js";

const HTML = `
<table>
  <tr><th>21/10/2026</th><th>Compra</th><th>Venta</th></tr>
  <tr><td>Dolar U.S.A</td><td>1.495,00</td><td>1.545,00</td></tr>
</table>
Hora Actualización: 17:02
`;

test("landing y checkout comparten escala BNA vendedor", () => {
  const cotizacion = parsearBilleteVendedor(HTML);
  const evaluada = evaluarCotizacion(cotizacion, new Date("2026-10-22T12:00:00.000Z"));
  const comercial = mapearCotizacionComercial(evaluada);
  assert.equal(comercial.ok, true);
  assert.equal(importeLicenciaCentavos(comercial.ventaEscala4), importeUsdEnArsCentavos(3000, comercial.ventaEscala4));
  assert.equal(convertirUsdAArs(30, comercial), importeLicenciaCentavos(comercial.ventaEscala4) / 100);
  assert.equal(convertirUsdAArs(4.2, comercial), importeUsdEnArsCentavos(420, comercial.ventaEscala4) / 100);
});

test("marca advertencia sin bloquear antes del límite de siete días", () => {
  const cotizacion = parsearBilleteVendedor(HTML);
  const cuatroDias = new Date("2026-10-25T12:00:00.000Z");
  const evaluada = evaluarCotizacion(cotizacion, cuatroDias);
  assert.equal(evaluada.ok, true);
  assert.equal(evaluada.advertenciaAntigua, true);
  const comercial = mapearCotizacionComercial(evaluada);
  assert.equal(convertirUsdAArs(30, comercial) != null, true);
});

test("rechaza cotización silenciosa después de siete días", () => {
  const cotizacion = parsearBilleteVendedor(HTML);
  const tarde = new Date("2026-10-30T20:03:00.000Z");
  assert.equal(evaluarCotizacion(cotizacion, tarde).codigo, "cotizacion_antigua");
  assert.equal(convertirUsdAArs(30, mapearCotizacionComercial({ ok: false, codigo: "cotizacion_antigua" })), null);
});

test("centavos USD 4,20 alineados con half-up", () => {
  const escala = textoArAEscala4("1.545,00");
  assert.equal(importeUsdEnArsCentavos(420, escala), 648900);
  assert.equal(importeLicenciaCentavos(escala), 4635000);
});
