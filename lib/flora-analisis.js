import { etiquetaAccionNativa } from "@/lib/seguimiento";
import { PARAMETROS_SEGUIMIENTO } from "@/lib/seguimiento";
import { diaArgentina } from "@/lib/historial-registros";

function claveParametro(fila) {
  if (!fila) return "";
  if (fila.origen === "nativa" && fila.clave_nativa) {
    return `nativa:${String(fila.clave_nativa).trim().toLowerCase()}`;
  }
  if (fila.opcion_id) return `opcion:${fila.opcion_id}`;
  const nombre = String(fila.nombre || "").trim().toLowerCase();
  return nombre ? `nombre:${nombre}` : "";
}

function valorNumericoParametro(fila) {
  if (!fila || fila.tipo_valor === "texto") return null;
  const valor = Number(fila.valor_numero);
  return Number.isFinite(valor) ? valor : null;
}

export function registroCompacto(registro) {
  if (!registro) return null;
  const fotos = registro.registro_fotos || [];
  return {
    id: registro.id,
    fecha_evento: registro.fecha_evento,
    alcance: registro.alcance,
    aplica_a: registro.aplica_a,
    unidad_cultivo_id: registro.unidad_cultivo_id,
    genetica_clave: registro.genetica_clave || null,
    genetica_etiqueta: registro.genetica_etiqueta || null,
    observacion: String(registro.observacion || "").trim() || null,
    plantas: (registro.registro_plantas || []).map((fila) => ({
      planta_id: fila.planta_id,
      nombre: fila.nombre_planta,
      numero: fila.numero_planta,
      genetica: fila.genetica_planta,
      unidad_cultivo_id: fila.unidad_cultivo_id,
      nombre_unidad: fila.nombre_unidad,
    })),
    acciones: (registro.registro_acciones || []).map((fila) => ({
      origen: fila.origen,
      clave_nativa: fila.clave_nativa || null,
      opcion_id: fila.opcion_id || null,
      nombre: fila.nombre || etiquetaAccionNativa(fila.clave_nativa),
    })),
    parametros: (registro.registro_parametros || []).map((fila) => ({
      origen: fila.origen,
      clave_nativa: fila.clave_nativa || null,
      opcion_id: fila.opcion_id || null,
      nombre: fila.nombre,
      tipo_valor: fila.tipo_valor,
      valor_numero: fila.valor_numero,
      valor_texto: fila.valor_texto,
      unidad: fila.unidad,
    })),
    fotos: {
      cantidad: fotos.length,
      ids: fotos.map((f) => f.id).filter(Boolean),
    },
  };
}

function coincideAccion(fila, filtro) {
  if (!fila) return false;
  if (filtro.claveNativa) {
    return fila.origen === "nativa" && fila.clave_nativa === filtro.claveNativa;
  }
  if (filtro.opcionId) {
    return fila.opcion_id === filtro.opcionId;
  }
  if (filtro.nombre) {
    return String(fila.nombre || "").trim().toLowerCase() === filtro.nombre.toLowerCase();
  }
  return true;
}

export function registrosConAccion(registros, filtroAccion) {
  return (registros || []).filter((registro) =>
    (registro.registro_acciones || []).some((fila) => coincideAccion(fila, filtroAccion))
  );
}

export function buscarEventoAccion(registros, filtroAccion, { orden = "desc" } = {}) {
  const candidatos = registrosConAccion(registros, filtroAccion);
  candidatos.sort((a, b) => {
    const ta = new Date(a.fecha_evento).getTime();
    const tb = new Date(b.fecha_evento).getTime();
    return orden === "asc" ? ta - tb : tb - ta;
  });
  return candidatos[0] ? registroCompacto(candidatos[0]) : null;
}

export function contarAcciones(registros, filtroAccion) {
  let total = 0;
  for (const registro of registros || []) {
    const coinciden = (registro.registro_acciones || []).filter((fila) =>
      coincideAccion(fila, filtroAccion)
    );
    if (coinciden.length) total += 1;
  }
  return total;
}

function coincideParametroFiltro(fila, filtro) {
  if (!fila) return false;
  if (filtro.claveNativa) {
    return fila.origen === "nativa" && fila.clave_nativa === filtro.claveNativa;
  }
  if (filtro.opcionId) return fila.opcion_id === filtro.opcionId;
  if (filtro.nombre) {
    return String(fila.nombre || "").trim().toLowerCase() === filtro.nombre.toLowerCase();
  }
  return true;
}

export function medicionesParametro(registros, filtro, { registroAplicaA: leerAplicaA } = {}) {
  const puntos = [];
  for (const registro of registros || []) {
    const aplicaA = leerAplicaA ? leerAplicaA(registro) : registro.aplica_a;
    for (const fila of registro.registro_parametros || []) {
      if (filtro.aplicaA && aplicaA !== filtro.aplicaA) continue;
      if (!coincideParametroFiltro(fila, filtro)) continue;
      const numero = valorNumericoParametro(fila);
      puntos.push({
        registro_id: registro.id,
        fecha_evento: registro.fecha_evento,
        dia: diaArgentina(registro.fecha_evento),
        aplica_a: aplicaA,
        clave: claveParametro(fila),
        nombre: fila.nombre,
        origen: fila.origen,
        tipo_valor: fila.tipo_valor,
        valor_numero: numero,
        valor_texto: fila.tipo_valor === "texto" ? String(fila.valor_texto || "").trim() : null,
        unidad: fila.unidad || "",
      });
    }
  }
  puntos.sort((a, b) => new Date(b.fecha_evento).getTime() - new Date(a.fecha_evento).getTime());
  return puntos;
}

export function estadisticasMediciones(puntos) {
  const numericos = (puntos || []).filter((p) => p.valor_numero !== null);
  if (!numericos.length) {
    return {
      cantidad: puntos?.length || 0,
      medicionesNumericas: 0,
      minimo: null,
      maximo: null,
      promedio: null,
      ultimo: puntos?.[0] || null,
      unidades: [],
      comparable: false,
    };
  }

  const unidades = [...new Set(numericos.map((p) => String(p.unidad || "").trim()))];
  const comparable = unidades.length <= 1;
  const valores = numericos.map((p) => p.valor_numero);
  const suma = valores.reduce((a, b) => a + b, 0);

  return {
    cantidad: puntos.length,
    medicionesNumericas: numericos.length,
    minimo: comparable ? Math.min(...valores) : null,
    maximo: comparable ? Math.max(...valores) : null,
    promedio: comparable ? suma / valores.length : null,
    ultimo: numericos[0],
    unidades,
    comparable,
  };
}

export function resumirActividadDesdeRegistros(registros, { etapas = [], periodo } = {}) {
  const dias = new Set();
  let acciones = 0;
  let mediciones = 0;
  let observaciones = 0;
  let fotos = 0;
  const frecuenciaAcciones = new Map();

  for (const registro of registros || []) {
    const dia = diaArgentina(registro.fecha_evento);
    if (dia) dias.add(dia);
    const listaAcciones = registro.registro_acciones || [];
    acciones += listaAcciones.length;
    for (const fila of listaAcciones) {
      const clave =
        fila.origen === "nativa"
          ? fila.clave_nativa
          : fila.opcion_id || String(fila.nombre || "").trim();
      frecuenciaAcciones.set(clave, (frecuenciaAcciones.get(clave) || 0) + 1);
    }
    mediciones += (registro.registro_parametros || []).length;
    if (String(registro.observacion || "").trim()) observaciones += 1;
    fotos += (registro.registro_fotos || []).length;
  }

  const riegos = contarAcciones(registros, { claveNativa: "riego" });

  return {
    periodo: periodo || null,
    registros: (registros || []).length,
    diasConActividad: dias.size,
    acciones,
    mediciones,
    observaciones,
    fotos,
    riegos,
    frecuenciaAcciones: Object.fromEntries(frecuenciaAcciones),
    cambiosEtapa: (etapas || []).length,
  };
}

export function clasificarParametroNativo(clave) {
  const nativo = PARAMETROS_SEGUIMIENTO.find((p) => p.valor === clave);
  if (!nativo) return { tipo: "personalizado", clave };
  const esAmbiente = ["temperatura", "humedad", "vpd"].includes(clave);
  return {
    tipo: esAmbiente ? "ambiente" : "planta",
    clave,
    etiqueta: nativo.etiqueta,
    unidad: nativo.unidad,
  };
}

export function agruparRegistrosPorDiaEvento(registros) {
  const mapa = new Map();
  for (const registro of registros || []) {
    const dia = diaArgentina(registro.fecha_evento);
    if (!dia) continue;
    const lista = mapa.get(dia) || [];
    lista.push(registroCompacto(registro));
    mapa.set(dia, lista);
  }
  return [...mapa.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([dia, eventos]) => ({ dia, cantidad: eventos.length, eventos }));
}
