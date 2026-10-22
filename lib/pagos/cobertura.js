export function licenciaHabilita({ licencia, pago, ambiente }) {
  if (!licencia || licencia.estado !== "activa") return false;
  if (!pago || pago.estado !== "acreditado") return false;
  if (!pago.id || pago.id !== licencia.pago_id) return false;
  if (!pago.ciclo_cultivo_id || pago.ciclo_cultivo_id !== licencia.ciclo_cultivo_id) return false;
  if (pago.usuario_id && licencia.usuario_id && pago.usuario_id !== licencia.usuario_id) return false;
  return pago.ambiente === ambiente && (ambiente === "prueba" || ambiente === "produccion");
}
