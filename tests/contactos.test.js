import assert from "node:assert/strict";
import test from "node:test";
import {
  construirCsvContactos,
  escaparCsv,
  esIdContacto,
  etiquetasOrigenes,
  filtroValido,
  limpiarBusqueda,
  normalizarEmail,
  normalizarNombre,
  normalizarTelefono,
  ordenValido,
  paginaValida,
  validarContactoManual,
  validarContactoPublico,
} from "../lib/contactos/reglas.js";
import { rutaAplicaGatePrelanzamiento } from "../lib/acceso-prelanzamiento.js";

test("los correos se normalizan con trim y minúsculas", () => {
  assert.equal(normalizarEmail("  Flora@Enflora.COM.ar "), "flora@enflora.com.ar");
  assert.equal(normalizarEmail(""), null);
  assert.equal(normalizarEmail("   "), null);
  assert.equal(normalizarEmail(undefined), null);
  assert.equal(normalizarEmail("sin-arroba"), undefined);
  assert.equal(normalizarEmail("a@b"), undefined);
  assert.equal(normalizarEmail("x@y.z"), undefined);
  assert.equal(normalizarEmail(`${"a".repeat(250)}@b.com`), undefined);
});

test("los teléfonos argentinos e internacionales se normalizan a E.164", () => {
  assert.equal(normalizarTelefono("11 2345 6789"), "+5491123456789");
  assert.equal(normalizarTelefono("011 15 2345-6789"), "+5491123456789");
  assert.equal(normalizarTelefono("+54 9 11 2345-6789"), "+5491123456789");
  assert.equal(normalizarTelefono("0054 11 2345 6789"), "+541123456789");
  assert.equal(normalizarTelefono("(351) 456-7890"), "+5493514567890");
  assert.equal(normalizarTelefono("0351 15 456-7890"), "+5493514567890");
  assert.equal(normalizarTelefono("2920 15 42-1234"), "+5492920421234");
  assert.equal(normalizarTelefono("+34 612 34 56 78"), "+34612345678");
  assert.equal(normalizarTelefono("+1 (415) 555-0100"), "+14155550100");
  assert.equal(normalizarTelefono(""), null);
  assert.equal(normalizarTelefono("abc"), undefined);
  assert.equal(normalizarTelefono("123"), undefined);
  assert.equal(normalizarTelefono("+0 123 4567"), undefined);
});

test("el nombre acepta letras reales y rechaza símbolos", () => {
  assert.equal(normalizarNombre("  María   José  "), "María José");
  assert.equal(normalizarNombre("O'Connor-Suárez"), "O'Connor-Suárez");
  assert.equal(normalizarNombre(""), null);
  assert.equal(normalizarNombre("<script>"), undefined);
  assert.equal(normalizarNombre("123"), undefined);
  assert.equal(normalizarNombre("a".repeat(81)), undefined);
});

test("la landing exige correo y el nombre es opcional", () => {
  const sin = validarContactoPublico({ origen: "landing", nombre: "", email: "" });
  assert.equal(sin.ok, false);
  assert.equal(sin.campo, "email");

  const ok = validarContactoPublico({ origen: "landing", nombre: " Flora ", email: "FLORA@enflora.com.ar", consentimiento: true });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.datos, {
    nombre: "Flora",
    email: "flora@enflora.com.ar",
    telefono: null,
    origen: "landing",
    detalle: null,
    consentimiento: true,
  });

  const sinConsentimiento = validarContactoPublico({ origen: "landing", email: "a@b.com", consentimiento: "true" });
  assert.equal(sinConsentimiento.datos.consentimiento, false);
});

test("la ruleta exige nombre y al menos un contacto", () => {
  assert.equal(validarContactoPublico({ origen: "ruleta_420", nombre: "", email: "a@b.com" }).campo, "nombre");
  assert.equal(validarContactoPublico({ origen: "ruleta_420", nombre: "Flora" }).campo, "email");
  const conTelefono = validarContactoPublico({ origen: "ruleta_420", nombre: "Flora", telefono: "11 2345 6789" });
  assert.equal(conTelefono.ok, true);
  assert.equal(conTelefono.datos.telefono, "+5491123456789");
  assert.equal(conTelefono.datos.email, null);
  assert.equal(conTelefono.datos.consentimiento, false);
});

test("los orígenes públicos no aceptan manual ni valores inventados", () => {
  assert.equal(validarContactoPublico({ origen: "manual", nombre: "Flora", email: "a@b.com" }).ok, false);
  assert.equal(validarContactoPublico({ origen: "otro", nombre: "Flora", email: "a@b.com" }).ok, false);
  assert.equal(validarContactoPublico(null).ok, false);
  assert.equal(validarContactoPublico([]).ok, false);
});

test("el honeypot corta sin error visible", () => {
  const resultado = validarContactoPublico({ origen: "landing", email: "a@b.com", empresa: "bot" });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.honeypot, true);
});

test("el alta manual exige algún contacto y valida formato", () => {
  assert.equal(validarContactoManual({ nombre: "Flora" }).campo, "email");
  assert.equal(validarContactoManual({ nombre: "Flora", email: "mal" }).campo, "email");
  assert.equal(validarContactoManual({ nombre: "Flora", telefono: "zzz" }).campo, "telefono");
  const ok = validarContactoManual({ nombre: "", email: " A@B.com ", telefono: "" });
  assert.deepEqual(ok, { ok: true, datos: { nombre: null, email: "a@b.com", telefono: null } });
});

test("las consultas del ABM se sanean", () => {
  assert.equal(filtroValido("ruleta_420"), "ruleta_420");
  assert.equal(filtroValido("drop table"), "todos");
  assert.equal(ordenValido("nombre"), "nombre");
  assert.equal(ordenValido("x"), "recientes");
  assert.equal(paginaValida("3"), 3);
  assert.equal(paginaValida(0), 1);
  assert.equal(paginaValida("abc"), 1);
  assert.equal(limpiarBusqueda("  flo%ra_(1),*\\ "), "flo ra 1");
  assert.equal(limpiarBusqueda("a".repeat(100)).length, 60);
  assert.equal(esIdContacto("33333333-3333-4333-8333-333333333333"), true);
  assert.equal(esIdContacto("no"), false);
});

test("las etiquetas de origen muestran todos los orígenes sin repetir", () => {
  assert.deepEqual(etiquetasOrigenes({ origen_inicial: "landing", origenes: ["landing", "ruleta_420", "landing"] }), [
    "Landing",
    "Ruleta",
  ]);
  assert.deepEqual(etiquetasOrigenes({ origen_inicial: "manual", origenes: [] }), ["Manual"]);
  assert.deepEqual(etiquetasOrigenes({ origen_inicial: "landing", origenes: ["raro"] }), []);
  assert.deepEqual(etiquetasOrigenes({ origen_inicial: "registro", origenes: ["registro"] }), ["Registro"]);
});

test("el origen registro existe en el ABM pero no es público", () => {
  assert.equal(filtroValido("registro"), "registro");
  assert.equal(validarContactoPublico({ origen: "registro", nombre: "Flora", email: "a@b.com" }).ok, false);
});

test("el CSV escapa fórmulas, comillas y separadores", () => {
  assert.equal(escaparCsv("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(escaparCsv("+54 11"), "'+54 11");
  assert.equal(escaparCsv("-1"), "'-1");
  assert.equal(escaparCsv("@cmd"), "'@cmd");
  assert.equal(escaparCsv('Flo "Ra", ok'), '"Flo ""Ra"", ok"');
  assert.equal(escaparCsv(null), "");
  assert.equal(escaparCsv("texto"), "texto");
});

test("el CSV incluye cabecera, BOM y una fila por contacto", () => {
  const csv = construirCsvContactos([
    {
      nombre: "=Flora",
      email: "flora@enflora.com.ar",
      telefono: "+5491123456789",
      origen_inicial: "landing",
      origenes: ["landing", "ruleta_420"],
      consentimiento_marketing: true,
      created_at: "2026-10-23T12:00:00.000Z",
    },
    { nombre: null, email: null, telefono: "+5491100000000", origen_inicial: "manual", origenes: ["manual"], consentimiento_marketing: false, created_at: null },
  ]);
  const lineas = csv.split("\r\n");
  assert.equal(lineas[0], "\uFEFFNombre,Email,Teléfono,Origen,Consentimiento publicitario,Fecha de registro");
  assert.equal(lineas[1], "'=Flora,flora@enflora.com.ar,'+5491123456789,Landing / Ruleta,Aceptó,2026-10-23T12:00:00.000Z");
  assert.equal(lineas[2], ",,'+5491100000000,Manual,No aceptó,");
  assert.equal(lineas[3], "");
});

test("la política de privacidad queda fuera del gate de prelanzamiento", () => {
  assert.equal(rutaAplicaGatePrelanzamiento("/privacidad"), false);
});
