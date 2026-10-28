import {
  ESPACIO_NOMBRE,
  ESPACIO_TIPO,
  FECHA_CORTE,
  FECHA_ENFLORA,
  FECHA_INICIO,
  GENETICA,
  IMPORT_ID,
  METODO_CULTIVO,
  UNIDAD_NOMBRE,
  UNIDAD_TIPO,
} from "@/lib/import/rdwc1-constantes";

export function resumirDryRun(resultado) {
  const v = resultado.validacion?.conteos || {};
  const plan = resultado.plan?.resumen || {};
  const infra = resultado.infraestructura || {};
  const listo =
    resultado.validacion?.ok &&
    !resultado.plan?.error &&
    (resultado.conflictos?.length || 0) === 0 &&
    infra.registro_fotos?.ok !== false &&
    infra.bucket_fotos?.ok !== false &&
    !resultado.sesion?.error;

  const lineas = [
    "── ENFLORA · import RDWC #1 (dry-run) ──",
    `Import ID: ${resultado.import_id || IMPORT_ID}`,
    "",
    "Destino planificado",
    `  Espacio: ${ESPACIO_NOMBRE} (${ESPACIO_TIPO})`,
    `  Unidad: ${UNIDAD_NOMBRE} (${UNIDAD_TIPO})`,
    `  Cultivo: ${METODO_CULTIVO} · ${GENETICA} · 2 plantas (Planta 1, Planta 2)`,
    `  Inicio: ${FECHA_INICIO} · Enflora: ${FECHA_ENFLORA} · Corte dataset: ${FECHA_CORTE}`,
    "",
    "Dataset",
    `  Días: ${v.dias ?? "—"} · Mediciones: ${v.mediciones ?? "—"} · Acciones: ${v.acciones ?? "—"}`,
    `  Fotos registro: ${v.fotosRegistro ?? "—"} · Notas: ${v.diasConNota ?? "—"} · Etapas: ${v.etapas ?? "—"}`,
    `  Validación: ${resultado.validacion?.ok ? "OK" : "FALLA"}`,
    ...(resultado.validacion?.errores?.length
      ? resultado.validacion.errores.map((e) => `    · ${e}`)
      : []),
    "",
    "Plan de registros",
    `  Registros totales: ${resultado.registros_esperados ?? plan.registros ?? "—"} (ambiente: ${plan.ambiente ?? "—"}, plantas: ${plan.plantas ?? "—"})`,
    `  Planificación: ${resultado.plan?.error ? `FALLA — ${resultado.plan.error}` : "OK"}`,
    "",
    "Cuenta",
    resultado.sesion?.error
      ? `  Sesión: no verificada (${resultado.sesion.error})`
      : resultado.sesion?.usuario_id
        ? `  Usuario: ${resultado.sesion.usuario_id}${resultado.sesion.email ? ` · ${resultado.sesion.email}` : ""}`
        : "  Sesión: no comprobada (usá --con-sesion o definí ENFLORA_IMPORT_*)",
    "",
    "Conflictos",
    ...(resultado.conflictos?.length
      ? resultado.conflictos.map((c) => `  · ${c}`)
      : ["  (ninguno detectado)"]),
    "",
    "Infraestructura (solo lectura)",
    `  Tabla registro_fotos: ${etiquetaInfra(infra.registro_fotos)}`,
    `  Bucket enflora-fotos: ${etiquetaInfra(infra.bucket_fotos)}`,
    `  Tabla importaciones_cultivo: ${etiquetaInfra(infra.importaciones_cultivo, true)}`,
    "",
    "Importación real",
    `  Confirmación: ENFLORA_IMPORT_CONFIRM=${IMPORT_ID}`,
    `  importaciones-cultivo.sql: opcional (estado remoto); el JSON en private/importaciones/ alcanza para import y rollback.`,
    "",
    `Estado: ${listo ? "LISTO para --import (con confirmación)" : "NO listo — revisá validación, conflictos o infra"}`,
    "",
    "Salida detallada: --json o --verbose",
  ];

  return lineas.join("\n");
}

function etiquetaInfra(check, opcional = false) {
  if (!check) return opcional ? "no comprobado (sin sesión)" : "no comprobado (sin sesión)";
  if (check.ok) return `OK${check.detalle ? ` — ${check.detalle}` : ""}`;
  if (check.opcional) return `opcional / ausente — ${check.detalle || check.error || ""}`;
  return `FALLA — ${check.error || check.detalle || "revisar supabase/registro-fotos.sql"}`;
}

export function imprimirResultado(resultado, { json = false, verbose = false } = {}) {
  if (json || verbose) {
    const copia = verbose ? resultado : resumirDryRunPayload(resultado);
    console.log(JSON.stringify(copia, null, 2));
    return;
  }
  console.log(resumirDryRun(resultado));
}

/** JSON compacto (sin payloads de cada registro). */
export function resumirDryRunPayload(resultado) {
  return {
    modo: resultado.modo,
    import_id: resultado.import_id,
    validacion: {
      ok: resultado.validacion?.ok,
      errores: resultado.validacion?.errores,
      conteos: resultado.validacion?.conteos,
    },
    plan: {
      error: resultado.plan?.error || "",
      resumen: resultado.plan?.resumen,
      registros_esperados: resultado.registros_esperados,
    },
    sesion: resultado.sesion,
    conflictos: resultado.conflictos,
    infraestructura: resultado.infraestructura,
    importacion_previa: resultado.importacionPrev
      ? {
          estado: resultado.importacionPrev.estado,
          espacio_id: resultado.importacionPrev.espacio_id,
          unidad_id: resultado.importacionPrev.unidad_id,
        }
      : null,
    confirmacionRequerida: resultado.confirmacionRequerida,
    listo_para_import: undefined,
  };
}
