export const FECHA_LANZAMIENTO = "2026-11-01T00:00:00-03:00";
export const LANZAMIENTO_MS = Date.parse(FECHA_LANZAMIENTO);

export function lanzamientoPendiente(ahora = Date.now()) {
  const ms = ahora instanceof Date ? ahora.getTime() : Number(ahora);
  if (!Number.isFinite(ms)) return true;
  return ms < LANZAMIENTO_MS;
}

const PLANES_PAGOS = new Set(["plus", "por-cultivo"]);

export const textosModalLanzamiento = {
  titulo: "¡El 1/11 es nuestro lanzamiento!",
  destacado: "¿Querés que Flora te avise cuando esté todo listo?",
  permisos:
    "Para recibir el aviso, vas a tener que permitir las notificaciones de Enflora en tu navegador o dispositivo.",
  volver: "Volver",
  avisar: "Avisame Flora",
  reintentar: "Reintentar",
  exito: "¡Listo! Flora te va a avisar cuando Enflora esté disponible.",
  suscripto: "¡Ya estás en la lista! Flora tiene preparado tu aviso.",
  denegado:
    "Las notificaciones están bloqueadas. Podés habilitarlas desde la configuración de tu navegador.",
  noCompatible:
    "Este navegador no puede recibir notificaciones push, así que desde acá no podemos avisarte. Probá con Chrome, Edge o Firefox actualizados.",
  descartado: "No se activaron las notificaciones. Si querés el aviso, tocá Avisame Flora otra vez.",
  error: "No pudimos guardar tu aviso. Revisá tu conexión y probá de nuevo.",
  iosTitulo: "En iPhone o iPad, primero agregá Enflora a tu inicio",
  iosPasos: [
    "Abrí enflora.com.ar en Safari.",
    "Tocá Compartir y elegí Agregar a Inicio.",
    "Abrí Enflora desde el ícono nuevo y tocá Avisame Flora en Planes.",
  ],
};

export function descripcionModalLanzamiento(planId) {
  if (PLANES_PAGOS.has(planId)) {
    return "Los planes y los pagos todavía no están disponibles. El día del lanzamiento vas a poder elegir el que mejor se adapte a tus cultivos.";
  }
  return "Los planes todavía no están disponibles. El día del lanzamiento vas a poder elegir el que mejor se adapte a tus cultivos.";
}
