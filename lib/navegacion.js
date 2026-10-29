export const DESTINOS_NAVEGACION = [
  { clave: "cultivos", etiqueta: "Cultivos", href: "/espacios" },
  { clave: "registro", etiqueta: "Registro", href: "/registros", excluirPrefijos: ["/registros/historial"] },
  { clave: "historial", etiqueta: "Historial", href: "/registros/historial" },
  { clave: "flora", etiqueta: "Flora", href: "/flora" },
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
  const rutaSinConsulta = ruta.split("?")[0];
  if (destino.exacto) return rutaSinConsulta === destino.href;
  const prefijos = destino.excluirPrefijos || [];
  for (const prefijo of prefijos) {
    if (rutaSinConsulta === prefijo || rutaSinConsulta.startsWith(`${prefijo}/`)) return false;
  }
  return rutaSinConsulta === destino.href || rutaSinConsulta.startsWith(`${destino.href}/`);
}
