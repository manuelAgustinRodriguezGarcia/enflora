const EMAILS_PERMITIDOS = new Set([
  "marg.ec256@gmail.com",
  "merygarcia1601@hotmail.com",
]);

const RUTAS_LIBRES = new Set([
  "/",
  "/ingreso",
  "/registro",
  "/partners",
  "/partners-info",
  "/correo-validado",
  "/privacidad",
]);

/** El aviso «Estamos trabajando» sigue activo hasta PRELANZAMIENTO_ACTIVO=false. La fecha no lo apaga. */
function avisoTrabajandoApagado(entorno = process.env) {
  return String(entorno?.PRELANZAMIENTO_ACTIVO ?? "").trim().toLowerCase() === "false";
}

export function gatePrelanzamientoActivo(_ahora = new Date(), entorno = process.env) {
  return !avisoTrabajandoApagado(entorno);
}

export function emailTieneAccesoPrelanzamiento(email) {
  return EMAILS_PERMITIDOS.has(String(email || "").trim().toLowerCase());
}

export function esRutaDemo(ruta) {
  return ruta === "/demo" || ruta.startsWith("/demo/");
}

export function rutaAplicaGatePrelanzamiento(ruta) {
  if (!ruta) return true;
  if (RUTAS_LIBRES.has(ruta)) return false;
  if (esRutaDemo(ruta)) return false;
  if (ruta.startsWith("/partners/")) return false;
  if (ruta.startsWith("/correo/")) return false;
  return true;
}

export function usuarioBloqueadoPrelanzamiento(usuario, ruta, ahora = new Date(), entorno = process.env) {
  if (!gatePrelanzamientoActivo(ahora, entorno)) return false;
  if (!usuario) return false;
  if (!rutaAplicaGatePrelanzamiento(ruta)) return false;
  return !emailTieneAccesoPrelanzamiento(usuario.email);
}
