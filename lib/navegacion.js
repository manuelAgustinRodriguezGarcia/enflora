export const DESTINOS_NAVEGACION = [
  { clave: "espacios", etiqueta: "Espacios", href: "/espacios" },
  { clave: "registro", etiqueta: "Registro", href: "/registros" },
  { clave: "perfil", etiqueta: "Perfil", href: "/perfil" },
];

const RUTAS_PUBLICAS = [
  "/ingreso",
  "/registro",
  "/correo-validado",
  "/partners",
  "/partners-info",
];

const RUTAS_SIN_SHELL_APP = [
  ...RUTAS_PUBLICAS,
  "/correo",
  "/expo-cannabis",
  "/demo",
  "/api",
];

export function esRutaPublica(ruta) {
  if (!ruta) return false;
  return RUTAS_PUBLICAS.some((item) => ruta === item || ruta.startsWith(`${item}/`));
}

export function esRutaApp(ruta) {
  if (!ruta || ruta === "/") return false;
  return !RUTAS_SIN_SHELL_APP.some((item) => ruta === item || ruta.startsWith(`${item}/`));
}

export function destinoActivo(ruta, destino) {
  if (!ruta || !destino?.href) return false;
  if (destino.exacto) return ruta === destino.href;
  return ruta === destino.href || ruta.startsWith(`${destino.href}/`);
}
