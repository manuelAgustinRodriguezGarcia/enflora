import assert from "node:assert/strict";
import test from "node:test";
import { HISTORIAL_RDWC1 } from "@/lib/demo/historial/rdwc1-dataset";
import {
  IMPORT_ID,
  OPCIONES_ACCION_IMPORT,
} from "@/lib/import/rdwc1-constantes";
import {
  cargarEstadoLocal,
  crearEstadoVacío,
  importacionCompleta,
  registroYaImportado,
} from "@/lib/import/rdwc1-estado";
import { contarRegistrosEsperados } from "@/lib/import/rdwc1-ejecutor";
import {
  accionesDesdeDemo,
  fechaEventoTecnica,
  indiceFotosDemo,
  nombresPlantasImport,
  NOTA_NOMBRES_PLANTAS,
  parametrosDesdeMediciones,
  planificarImportacion,
  planificarRegistrosDelDia,
} from "@/lib/import/rdwc1-mapeo";
import { validarConfirmacionImport, validarDataset } from "@/lib/import/rdwc1-validacion";

const USUARIO_SIM = "00000000-0000-4000-8000-000000000001";
const mapaOpciones = Object.fromEntries(
  OPCIONES_ACCION_IMPORT.map((nombre, indice) => [
    nombre,
    `00000000-0000-4000-8000-${String(indice + 1).padStart(12, "0")}`,
  ])
);

const contextoBase = {
  espacioId: "00000000-0000-4000-8000-000000000002",
  unidad: { id: "00000000-0000-4000-8000-000000000003", nombre: "Carpa hidro" },
  plantas: [
    {
      id: "00000000-0000-4000-8000-000000000004",
      nombre: "Planta 1",
      numero: 1,
      genetica: "Gorila glue #4",
    },
    {
      id: "00000000-0000-4000-8000-000000000005",
      nombre: "Planta 2",
      numero: 2,
      genetica: "Gorila glue #4",
    },
  ],
  mapaOpciones,
  fotosPorId: indiceFotosDemo(HISTORIAL_RDWC1),
  fotosSubidasPorDemoId: {},
  simularFotos: true,
  usuarioSimulado: USUARIO_SIM,
};

test("validarDataset confirma conteos del rdwc1", () => {
  const r = validarDataset(HISTORIAL_RDWC1);
  assert.equal(r.ok, true, r.errores.join("; "));
  assert.equal(r.conteos.dias, 63);
  assert.equal(r.conteos.mediciones, 310);
  assert.equal(r.conteos.acciones, 12);
  assert.equal(r.conteos.fotosRegistro, 100);
});

test("fechaEventoTecnica usa 12:00 ART", () => {
  const iso = fechaEventoTecnica("2026-08-13", 0);
  assert.equal(iso, "2026-08-13T15:00:00.000Z");
  assert.equal(fechaEventoTecnica("2026-08-13", 1), "2026-08-13T15:00:01.000Z");
});

test("parametrosDesdeMediciones mapea cinco claves nativas", () => {
  const dia = HISTORIAL_RDWC1.dias[0];
  const params = parametrosDesdeMediciones(dia.mediciones);
  assert.equal(params.length, 5);
  assert.ok(params.some((item) => item.clave_nativa === "ec" && item.unidad === "µS/cm"));
});

test("accionesDesdeDemo usa opciones personalizadas", () => {
  const diaConAccion = HISTORIAL_RDWC1.dias.find((item) => item.acciones.length);
  const r = accionesDesdeDemo(diaConAccion.acciones, mapaOpciones);
  assert.equal(r.error, "");
  assert.equal(r.acciones[0].origen, "personalizada");
  assert.ok(r.acciones[0].opcion_id);
});

test("planificarImportacion produce registros ambiente y plantas", () => {
  const plan = planificarImportacion(HISTORIAL_RDWC1, contextoBase);
  assert.equal(plan.error, "");
  assert.equal(plan.resumen.dias, 63);
  assert.ok(plan.resumen.registros >= 120);
  assert.equal(contarRegistrosEsperados(), plan.resumen.registros);
});

test("día solo con fotos genera registro de plantas", () => {
  const dia = HISTORIAL_RDWC1.dias.find((item) => item.fecha === "2026-08-19");
  const plan = planificarRegistrosDelDia(dia, contextoBase);
  assert.equal(plan.error, "");
  assert.equal(plan.payloads.length, 1);
  assert.equal(plan.payloads[0].tipo, "plantas");
});

test("nombres de plantas del dataset", () => {
  assert.deepEqual(nombresPlantasImport(HISTORIAL_RDWC1), ["Planta 1", "Planta 2"]);
  assert.match(NOTA_NOMBRES_PLANTAS, /técnicas de importación/);
});

test("idempotencia local de registros", () => {
  const estado = crearEstadoVacío(USUARIO_SIM);
  estado.import_id = IMPORT_ID;
  assert.equal(importacionCompleta(estado), false);
  estado.estado = "complete";
  assert.equal(importacionCompleta(estado), true);
  assert.equal(registroYaImportado(estado, "2026-08-13:ambiente"), false);
  estado.registros.push({ clave: "2026-08-13:ambiente", id: "x" });
  assert.equal(registroYaImportado(estado, "2026-08-13:ambiente"), true);
});

test("confirmación de importación", () => {
  assert.equal(validarConfirmacionImport(IMPORT_ID, {}), false);
  assert.equal(
    validarConfirmacionImport(IMPORT_ID, { ENFLORA_IMPORT_CONFIRM: IMPORT_ID }),
    true
  );
});

test("estado local ausente no rompe carga", () => {
  assert.equal(cargarEstadoLocal("C:/no/existe/enflora"), null);
});
