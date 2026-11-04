const CORREO_ESTADO_NOTIFICACIONES = "marg.ec256@gmail.com";

export function muestraEstadoNotificaciones(email) {
  return String(email || "").trim().toLowerCase() === CORREO_ESTADO_NOTIFICACIONES;
}
