/**
 * Catálogo del panel /admin. Puro: sin Next, sin Supabase y sin datos.
 *
 * Cada sección exige un módulo de MODULOS_ADMIN. Auditoría usa el módulo `auditoria`
 * (`ADMIN_IDS_AUDITORIA`): no alcanza con el permiso de dashboard.
 */

export const RUTA_ADMIN = "/admin";
export const RUTA_ADMIN_EXPO = "/admin/expo";
export const RUTA_ADMIN_EXPO_LEGADO = "/expo-cannabis/admin";

export const SECCIONES_ADMIN = Object.freeze([
  Object.freeze({
    id: "dashboard",
    modulo: "dashboard",
    href: RUTA_ADMIN,
    titulo: "Dashboard",
    resumen: "Cifras agregadas de la aplicación. Sin datos de cultivos ni de personas.",
    exacto: true,
  }),
  Object.freeze({
    id: "usuarios",
    modulo: "usuarios",
    href: "/admin/usuarios",
    titulo: "Usuarios",
    resumen: "La gestión de cuentas todavía no está disponible. Esta vista no lista personas ni datos de cultivos.",
  }),
  Object.freeze({
    id: "planes",
    modulo: "planes",
    href: "/admin/planes",
    titulo: "Planes e ingresos",
    resumen: "El seguimiento de planes e ingresos todavía no está disponible. Esta vista no consulta pagos ni licencias.",
  }),
  Object.freeze({
    id: "flora_ia",
    modulo: "flora_ia",
    href: "/admin/flora",
    titulo: "Flora IA",
    resumen: "La administración de Flora todavía no está disponible. Esta vista no muestra conversaciones ni contenidos privados.",
  }),
  Object.freeze({
    id: "almacenamiento",
    modulo: "almacenamiento",
    href: "/admin/almacenamiento",
    titulo: "Almacenamiento",
    resumen: "El control de almacenamiento todavía no está disponible. Esta vista no lista archivos ni fotografías de cultivos.",
  }),
  Object.freeze({
    id: "notificaciones",
    modulo: "notificaciones",
    href: "/admin/notificaciones",
    titulo: "Notificaciones",
    resumen: "La administración de notificaciones todavía no está disponible. Esta vista no envía avisos ni muestra dispositivos.",
  }),
  Object.freeze({
    id: "partners",
    modulo: "partners",
    href: "/admin/partners",
    titulo: "Partners y publicidad",
    resumen: "La gestión de comercios y publicidad todavía no está disponible.",
  }),
  Object.freeze({
    id: "expo",
    modulo: "expo",
    href: RUTA_ADMIN_EXPO,
    titulo: "Expo Cannabis",
    resumen: "Inventario, participantes y contactos de Expo Cannabis.",
  }),
  Object.freeze({
    id: "auditoria",
    modulo: "auditoria",
    href: "/admin/auditoria",
    titulo: "Auditoría",
    resumen: "El registro de auditoría todavía no está disponible. Esta vista no muestra acciones, cultivos ni conversaciones.",
  }),
]);

const HREFS_ADMIN = new Set(SECCIONES_ADMIN.map((seccion) => seccion.href));

export function esRutaPanelAdmin(ruta) {
  return ruta === RUTA_ADMIN || (typeof ruta === "string" && ruta.startsWith(`${RUTA_ADMIN}/`));
}

export function seccionAdmin(id) {
  const seccion = SECCIONES_ADMIN.find((item) => item.id === id);
  if (!seccion) throw new Error("Sección administrativa desconocida.");
  return seccion;
}

export function seccionesVisibles(modulos) {
  const permitidos = new Set(Array.isArray(modulos) ? modulos : []);
  return SECCIONES_ADMIN.filter((seccion) => permitidos.has(seccion.modulo));
}

/** Datos planos para la navegación del cliente. Sin módulos ni textos internos de más. */
export function navegacionAdmin(modulos) {
  return seccionesVisibles(modulos).map((seccion) => ({
    id: seccion.id,
    href: seccion.href,
    titulo: seccion.titulo,
    exacto: seccion.exacto === true,
  }));
}

/** Primera sección operativa distinta del índice, o cadena vacía. */
export function primerDestino(modulos) {
  const seccion = seccionesVisibles(modulos).find((item) => item.href !== RUTA_ADMIN);
  return seccion?.href ?? "";
}

/**
 * Destino interno permitido tras el ingreso. Solo rutas del catálogo.
 * La ruta anterior de Expo se normaliza a /admin/expo. No autoriza el módulo:
 * la página vuelve a comprobar el permiso en el servidor.
 */
export function destinoAdminPermitido(valor) {
  if (typeof valor !== "string" || valor.length === 0 || valor.length > 80) return "";
  if (valor.includes("?") || valor.includes("#") || valor.includes("%") || valor.includes("..")) return "";
  if (valor.includes("://") || valor.includes("\\") || valor.includes("//")) return "";
  if (valor === RUTA_ADMIN_EXPO_LEGADO) return RUTA_ADMIN_EXPO;
  if (HREFS_ADMIN.has(valor)) return valor;
  return "";
}
