import fs from "node:fs";
import path from "node:path";
import { HISTORIAL_RDWC1 } from "@/lib/demo/historial/rdwc1-dataset";
import { problemasDatasetPublico } from "@/lib/demo/historial/normalizar-historial";
import { CONTEOS_ESPERADOS, FECHA_CORTE } from "@/lib/import/rdwc1-constantes";
import { indiceFotosDemo, rutasArchivoDemoDesdeUrl } from "@/lib/import/rdwc1-mapeo";

function contarMediciones(historial) {
  return historial.dias.reduce((suma, dia) => suma + (dia.mediciones?.length || 0), 0);
}

function contarAcciones(historial) {
  return historial.dias.reduce((suma, dia) => suma + (dia.acciones?.length || 0), 0);
}

export function validarDataset(historial = HISTORIAL_RDWC1, raiz = process.cwd()) {
  const errores = [];
  const avisos = [];

  const problemas = problemasDatasetPublico(historial);
  if (problemas.length) errores.push(...problemas);

  if (historial.fechaCorte !== FECHA_CORTE) {
    errores.push(`fechaCorte esperada ${FECHA_CORTE}, encontrada ${historial.fechaCorte}.`);
  }

  const conteos = {
    dias: historial.dias.length,
    mediciones: contarMediciones(historial),
    acciones: contarAcciones(historial),
    fotosRegistro: historial.fotos.length,
    diasConNota: historial.dias.filter((dia) => dia.nota).length,
    etapas: historial.etapas.length,
  };

  for (const [clave, esperado] of Object.entries(CONTEOS_ESPERADOS)) {
    if (conteos[clave] !== esperado) {
      errores.push(`Conteo ${clave}: esperado ${esperado}, encontrado ${conteos[clave]}.`);
    }
  }

  const fotosPorId = indiceFotosDemo(historial);
  for (const dia of historial.dias) {
    for (const id of dia.fotos || []) {
      if (!fotosPorId.has(id)) errores.push(`El día ${dia.fecha} referencia foto inexistente ${id}.`);
    }
    if (dia.fecha > FECHA_CORTE) errores.push(`Día posterior al corte: ${dia.fecha}.`);
  }

  for (const foto of historial.fotos) {
    for (const url of [foto.url, foto.miniatura]) {
      const archivo = rutasArchivoDemoDesdeUrl(url, raiz);
      if (!fs.existsSync(archivo)) errores.push(`No existe archivo demo: ${url}`);
    }
  }

  if (historial.cultivo?.portada) {
    for (const url of [historial.cultivo.portada.url, historial.cultivo.portada.miniatura]) {
      const archivo = rutasArchivoDemoDesdeUrl(url, raiz);
      if (!fs.existsSync(archivo)) errores.push(`No existe portada demo: ${url}`);
    }
  }

  if (historial.plantas.length !== 2) {
    errores.push(`Se esperaban 2 plantas en el dataset, hay ${historial.plantas.length}.`);
  }

  return { ok: errores.length === 0, errores, avisos, conteos };
}

export function validarConfirmacionImport(importId, env = process.env) {
  return env.ENFLORA_IMPORT_CONFIRM === importId;
}

export function credencialesDisponibles(env = process.env) {
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      env.ENFLORA_IMPORT_EMAIL &&
      env.ENFLORA_IMPORT_PASSWORD
  );
}

export async function detectarConflictosNombres(supabase, userId) {
  const conflictos = [];
  const { data: espacios } = await supabase
    .from("espacios")
    .select("id, nombre")
    .eq("usuario_id", userId);

  const casa = (espacios || []).find(
    (item) => String(item.nombre || "").trim().toLowerCase() === "casa delfi"
  );
  if (casa) {
    conflictos.push(`Ya existe el espacio «Casa delfi» (${casa.id}).`);
    const { data: unidades } = await supabase
      .from("unidades_cultivo")
      .select("id, nombre")
      .eq("espacio_id", casa.id);
    const carpa = (unidades || []).find(
      (item) => String(item.nombre || "").trim().toLowerCase() === "carpa hidro"
    );
    if (carpa) conflictos.push(`Ya existe la unidad «Carpa hidro» (${carpa.id}).`);
  }

  return conflictos;
}
