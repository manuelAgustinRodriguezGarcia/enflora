import "server-only";
import { crearClienteRestringido } from "@/lib/admin/servicio";
import {
  actualizarConsentimiento,
  actualizarContacto,
  eliminarContacto,
  exportarContactos,
  leerContacto,
  listarContactos,
  registrarContacto,
  resumenContactos,
} from "@/lib/contactos/datos";
import { verificarAdminExpo } from "@/lib/expo-cannabis/admin";

/**
 * Operaciones de contactos para el admin de Expo.
 *
 * Devuelve funciones específicas: el cliente de Supabase queda dentro de las clausuras y nunca
 * llega a páginas ni acciones. Exige una credencial vigente del módulo expo y, debajo, el
 * transporte restringido (lib/admin/servicio.js) limita tabla, método, columnas y relaciones.
 * La lógica de las consultas sigue en lib/contactos/datos.js, sin cambios.
 *
 * Devuelve null si falta la configuración del servicio (clave de servicio o URL).
 */
export function operacionesContactosAdmin(admin) {
  verificarAdminExpo(admin);
  const db = crearClienteRestringido(admin, "expo");
  if (!db) return null;

  return Object.freeze({
    listar: (consulta) => listarContactos(db, consulta),
    resumen: () => resumenContactos(db),
    exportar: (consulta) => exportarContactos(db, consulta),
    leer: (id) => leerContacto(db, id),
    crear: (datos) => registrarContacto(db, datos),
    editar: (id, datos) => actualizarContacto(db, id, datos),
    cambiarConsentimiento: (id, acepta) => actualizarConsentimiento(db, id, acepta),
    eliminar: (id) => eliminarContacto(db, id),
  });
}
