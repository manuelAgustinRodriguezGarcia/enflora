export const ETAPAS = [
  { valor: "germinacion", etiqueta: "Germinación" },
  { valor: "plantula", etiqueta: "Plántula" },
  { valor: "vegetativo", etiqueta: "Vegetativo" },
  { valor: "enflora", etiqueta: "Enflora" },
  { valor: "secado", etiqueta: "Secado" },
  { valor: "finalizado", etiqueta: "Finalizado" },
];

export function esEtapa(valor) {
  return ETAPAS.some((etapa) => etapa.valor === valor);
}

export function etiquetaEtapa(valor) {
  if (!valor) return "—";
  const etapa = ETAPAS.find((item) => item.valor === valor);
  return etapa ? etapa.etiqueta : valor;
}

export function estadoPorEtapa(etapa) {
  return etapa === "finalizado" ? "finalizada" : "activa";
}

export function fechaHoy() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

export function fechaValida(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ""))) return false;
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

export function validarEtapaInicial(etapa, fecha) {
  if (!esEtapa(etapa)) return "Seleccioná una etapa.";
  if (!fecha) return "Seleccioná la fecha de inicio de la etapa.";
  if (!fechaValida(fecha)) return "La fecha de inicio no es válida.";
  return "";
}

export function formatearFecha(fecha) {
  if (!fecha) return "—";
  const [anio, mes, dia] = String(fecha).split("-");
  if (!anio || !mes || !dia) return fecha;
  return `${dia}/${mes}/${anio}`;
}

export function diasEntre(inicio, fin) {
  const [anioInicio, mesInicio, diaInicio] = String(inicio).split("-").map(Number);
  const [anioFin, mesFin, diaFin] = String(fin).split("-").map(Number);
  const desde = Date.UTC(anioInicio, mesInicio - 1, diaInicio);
  const hasta = Date.UTC(anioFin, mesFin - 1, diaFin);
  return Math.round((hasta - desde) / 86400000);
}

export function textoDias(dias) {
  return dias === 1 ? "1 día" : `${dias} días`;
}

export function filasDeHistorial(creadas, origenes) {
  return creadas.map((creada) => {
    const origen = origenes.find(
      (item) => item.unidad_cultivo_id === creada.unidad_cultivo_id && item.numero === creada.numero
    );
    if (!origen) return null;
    return {
      planta_id: creada.id,
      etapa: origen.etapa,
      fecha_inicio: origen.fechaInicioEtapa,
    };
  });
}
