export const RUTA_INICIO = "/inicio";

export const DESTINOS_NAVEGACION = [
  { clave: "inicio", etiqueta: "Inicio", href: RUTA_INICIO },
  { clave: "cultivos", etiqueta: "Cultivos", href: "/cultivos", prefijos: ["/espacios"] },
  {
    clave: "registro",
    etiqueta: "Registrar",
    href: "/registros",
    excluirPrefijos: ["/registros/historial", "/registros/productos"],
  },
  { clave: "flora", etiqueta: "Flora", href: "/flora" },
];

export const DESTINOS_MAS = [
  { clave: "historial", etiqueta: "Historial", href: "/registros/historial" },
  { clave: "galeria", etiqueta: "Galería de Flora", href: "/galeria" },
  { clave: "geneticas", etiqueta: "Mis genéticas", href: "/geneticas" },
  { clave: "mezclas", etiqueta: "Mis mezclas", href: "/mezclas" },
  { clave: "productos", etiqueta: "Mis productos", href: "/registros/productos" },
  { clave: "calendario", etiqueta: "Calendario", href: "/calendario" },
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
  "/admin",
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
  const rutaSinConsulta = ruta.split("?")[0];
  if (destino.exacto) return rutaSinConsulta === destino.href;
  const prefijos = destino.excluirPrefijos || [];
  for (const prefijo of prefijos) {
    if (rutaSinConsulta === prefijo || rutaSinConsulta.startsWith(`${prefijo}/`)) return false;
  }
  const bases = [destino.href, ...(destino.prefijos || [])];
  return bases.some((base) => rutaSinConsulta === base || rutaSinConsulta.startsWith(`${base}/`));
}
