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
    resumen: "Cuentas, plan comercial y conteos de cultivo. El correo se muestra enmascarado.",
  }),
  Object.freeze({
    id: "planes",
    modulo: "planes",
    href: "/admin/planes",
    titulo: "Planes e ingresos",
    resumen: "Ingresos acreditados, suscripciones Plus y licencias de cultivo. Solo lectura.",
  }),
  Object.freeze({
    id: "flora_ia",
    modulo: "flora_ia",
    href: "/admin/flora",
    titulo: "Flora IA",
    resumen: "Uso, tokens y costo estimado de Flora. Sin conversaciones ni contenido del cultivo.",
  }),
  Object.freeze({
    id: "almacenamiento",
    modulo: "almacenamiento",
    href: "/admin/almacenamiento",
    titulo: "Almacenamiento",
    resumen: "Ocupación real de Storage, por bucket y tipo de archivo. Sin fotos, rutas ni descargas.",
  }),
  Object.freeze({
    id: "notificaciones",
    modulo: "notificaciones",
    href: "/admin/notificaciones",
    titulo: "Notificaciones",
    resumen: "Suscripciones, envíos y campañas, en solo lectura. La prueba sigue limitada a tus dispositivos.",
  }),
  Object.freeze({
    id: "feedback",
    modulo: "feedback",
    href: "/admin/feedback",
    titulo: "Feedback",
    resumen: "Sugerencias y reportes de la aplicación. Sin datos de cultivo, chats ni fotografías.",
  }),
  Object.freeze({
    id: "partners",
    modulo: "partners",
    href: "/admin/partners",
    titulo: "Partners y publicidad",
    resumen: "Comercios, solicitudes y campañas. La publicidad visible sigue identificada como contenido patrocinado.",
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
    resumen: "Operaciones de Usuarios, Partners y Expo. Sin correos, mensajes ni datos de cultivo.",
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
 * Destino interno permitido tras el ingreso. Solo rutas del catálogo y la ficha
 * de un usuario, un feedback o una campaña identificada por UUID. La ruta anterior de Expo se normaliza a
 * /admin/expo. No autoriza el módulo: la página vuelve a comprobar el permiso.
 */
const DETALLE_USUARIO =
  /^\/admin\/usuarios\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DETALLE_FEEDBACK =
  /^\/admin\/feedback\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DETALLE_CAMPANA =
  /^\/admin\/notificaciones\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RUTA_PARTNERS =
  /^\/admin\/partners(?:\/(?:comercios(?:\/nuevo)?|solicitudes|campanas(?:\/nueva)?)(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?)?$/i;
const DETALLE_AUDITORIA =
  /^\/admin\/auditoria\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function destinoAdminPermitido(valor) {
  if (typeof valor !== "string" || valor.length === 0 || valor.length > 80) return "";
  if (valor.includes("?") || valor.includes("#") || valor.includes("%") || valor.includes("..")) return "";
  if (valor.includes("://") || valor.includes("\\") || valor.includes("//")) return "";
  if (valor === RUTA_ADMIN_EXPO_LEGADO) return RUTA_ADMIN_EXPO;
  if (HREFS_ADMIN.has(valor) || DETALLE_USUARIO.test(valor) || DETALLE_FEEDBACK.test(valor) || DETALLE_CAMPANA.test(valor) || DETALLE_AUDITORIA.test(valor) || RUTA_PARTNERS.test(valor)) return valor;
  return "";
}
