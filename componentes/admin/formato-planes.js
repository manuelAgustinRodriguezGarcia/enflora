import { textoDia, textoEntero, textoInstante } from "@/componentes/admin/formato-dashboard";

const PESOS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export { textoDia, textoEntero, textoInstante };

export function textoPesosCentavos(centavos) {
  if (centavos === null || centavos === undefined) return "Sin importe cobrado";
  return PESOS.format(centavos / 100);
}

export function etiquetaAmbiente(ambiente) {
  if (ambiente === "prueba") return "Prueba";
  if (ambiente === "produccion") return "Producción";
  return "Sin ambiente";
}

export function etiquetaProducto(producto) {
  if (producto === "plus") return "Plus";
  if (producto === "pago_unico") return "Pago único";
  return "Todos";
}

const ESTADOS = Object.freeze({
  creada: "Creada",
  pendiente: "Pendiente",
  acreditado: "Acreditado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  reembolsado: "Reembolsado",
  contracargo: "Contracargo",
  borrador: "Borrador",
  pendiente_checkout: "Pendiente de checkout",
  activa: "Activa",
  pausada: "Pausada",
  cancelada: "Cancelada",
  vencida: "Vencida",
  past_due: "Pago vencido",
  revocada: "Revocada",
  todos: "Todos",
});

const INCIDENCIAS = Object.freeze({
  sin_pago_acreditado: "Activa sin pago acreditado",
  periodo_vencido: "Período vencido",
  sin_pago: "Sin pago asociado",
  pago_no_acreditado: "El pago no está acreditado",
  identidad_distinta: "El pago no coincide con la licencia",
  ciclo_finalizado: "El ciclo ya está finalizado",
});

export function etiquetaEstado(estado) {
  return ESTADOS[estado] || estado;
}

export function etiquetaIncidencia(incidencia) {
  if (!incidencia) return "Ninguna";
  return INCIDENCIAS[incidencia] || incidencia;
}

export function textoPeriodo(desdeDia, hastaDia) {
  return `${textoDia(desdeDia)} – ${textoDia(hastaDia)}`;
}
