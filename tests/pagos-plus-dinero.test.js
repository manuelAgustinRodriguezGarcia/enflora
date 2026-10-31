import assert from "node:assert/strict";
import test from "node:test";
import {
  importePlusCentavos,
  importePlusDecimalOrden,
  validarCoherenciaImportePlus,
} from "../lib/pagos/plus/dinero.js";
import {
  importeLicenciaCentavos,
  textoArAEscala4,
  centavosADecimal,
} from "../lib/pagos/dinero.js";

test("Plus US$4,20 a ARS con billete vendedor $1.560", () => {
  const escala = textoArAEscala4("1.560,00");
  assert.equal(importePlusCentavos(escala), 655200);
  assert.equal(importePlusDecimalOrden(escala), "6552.00");
  assert.notEqual(importePlusDecimalOrden(escala), "655200.00");
  const ok = validarCoherenciaImportePlus({
    importeDecimal: "6552.00",
    escalaVenta: escala,
  });
  assert.equal(ok.ok, true);
});

test("licencia US$30 comparte regla de centavos con Plus", () => {
  const escala = textoArAEscala4("1.560,00");
  assert.equal(centavosADecimal(importeLicenciaCentavos(escala)), "46800.00");
});

test("cotización con decimales y formato regional", () => {
  const escala = textoArAEscala4("1.545,50");
  assert.ok(escala > 0);
  const decimal = importePlusDecimalOrden(escala);
  assert.match(decimal, /^\d+\.\d{2}$/);
  assert.equal(validarCoherenciaImportePlus({ importeDecimal: decimal, escalaVenta: escala }).ok, true);
  assert.equal(
    validarCoherenciaImportePlus({ importeDecimal: "999999.00", escalaVenta: escala }).codigo,
    "importe_incoherente",
  );
});

test("cuerpo PreApproval usa el mismo importe ARS que el checkout", async () => {
  const { cuerpoPreapprovalPlusPendiente } = await import("../lib/pagos/plus/cuerpo-preapproval.js");
  const escala = textoArAEscala4("1.560,00");
  const importe = importePlusDecimalOrden(escala);
  const cuerpo = cuerpoPreapprovalPlusPendiente({
    externalReference: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    payerEmail: "test@example.com",
    importeDecimalArs: importe,
    backUrl: "https://example.com/pagos/plus/resultado",
  });
  assert.equal(cuerpo.ok, true);
  assert.equal(cuerpo.body.auto_recurring.transaction_amount, Number(importe));
  assert.equal(cuerpo.body.auto_recurring.transaction_amount, 6552);
});
