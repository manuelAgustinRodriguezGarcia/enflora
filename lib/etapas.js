export const ETAPAS = [
  { valor: "germinacion", etiqueta: "Germinación", icono: "germinacion" },
  { valor: "plantula", etiqueta: "Plántula", icono: "plantula" },
  { valor: "vegetativo", etiqueta: "Vegetativo", icono: "vegetativo" },
  { valor: "enflora", etiqueta: "Enflora", icono: "enflora" },
  { valor: "secado", etiqueta: "Secado", icono: "secado" },
  { valor: "finalizado", etiqueta: "Finalizado", icono: "finalizado" },
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

export function fechaInicioPlanta(planta) {
  if (planta?.fecha_inicio) return planta.fecha_inicio;
  if (!planta?.fecha_creacion) return "";
  const fecha = new Date(planta.fecha_creacion);
  if (Number.isNaN(fecha.getTime())) return "";
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
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

export function diaDeEtapa(fechaInicio, hoy) {
  if (!fechaInicio || !hoy) return null;
  const dias = diasEntre(fechaInicio, hoy);
  if (!Number.isFinite(dias)) return null;
  return dias;
}

export function datosEtapaActual(etapa, historial, hoy) {
  const abierta = (historial || []).find((item) => !item.fecha_fin && item.fecha_inicio);
  const inicio = abierta && abierta.etapa === etapa ? abierta.fecha_inicio : "";
  return {
    etapa: etapa || "",
    inicio,
    dia: inicio ? diaDeEtapa(inicio, hoy) : null,
  };
}

export function estadoEnCiclo(valor, etapaActual, historial) {
  if (valor && valor === etapaActual) return "actual";
  if ((historial || []).some((item) => item.etapa === valor)) return "registrada";
  return "pendiente";
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
