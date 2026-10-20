const EMAIL_PERMITIDO = "marg.ec256@gmail.com";
const LANZAMIENTO = new Date("2026-11-01T00:00:00-03:00");

const RUTAS_LIBRES = new Set([
  "/",
  "/ingreso",
  "/registro",
  "/partners",
  "/partners-info",
  "/correo-validado",
]);

export function gatePrelanzamientoActivo(ahora = new Date()) {
  return ahora < LANZAMIENTO;
}

export function emailTieneAccesoPrelanzamiento(email) {
  return String(email || "").trim().toLowerCase() === EMAIL_PERMITIDO;
}

export function rutaAplicaGatePrelanzamiento(ruta) {
  if (!ruta) return true;
  if (RUTAS_LIBRES.has(ruta)) return false;
  if (ruta.startsWith("/partners/")) return false;
  if (ruta.startsWith("/correo/")) return false;
  return true;
}

export function usuarioBloqueadoPrelanzamiento(usuario, ruta, ahora = new Date()) {
  if (!gatePrelanzamientoActivo(ahora)) return false;
  if (!usuario) return false;
  if (!rutaAplicaGatePrelanzamiento(ruta)) return false;
  return !emailTieneAccesoPrelanzamiento(usuario.email);
}
