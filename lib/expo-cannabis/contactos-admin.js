import "server-only";
import { crearClienteRestringido } from "@/lib/admin/servicio";
import { exportarContactos, leerContacto, listarContactos, resumenContactos } from "@/lib/contactos/datos";
import { VERSION_CONSENTIMIENTO, filtroValido, limpiarBusqueda } from "@/lib/contactos/reglas";
import { verificarAdminExpo } from "@/lib/expo-cannabis/admin";

/**
 * Operaciones de contactos para el admin de Expo.
 *
 * Devuelve funciones específicas: el cliente de Supabase queda dentro de las clausuras y nunca
 * llega a páginas ni acciones. Exige una credencial vigente del módulo expo y, debajo, el
 * transporte restringido (lib/admin/servicio.js) limita tabla, método, columnas y relaciones.
 * Las lecturas siguen en lib/contactos/datos.js. Las mutaciones y la exportación pasan por
 * funciones que escriben la auditoría en la misma operación. Si la exportación no queda
 * registrada, el archivo no se devuelve.
 *
 * Devuelve null si falta la configuración del servicio (clave de servicio o URL).
 */
export function operacionesContactosAdmin(admin) {
  const identidad = verificarAdminExpo(admin);
  const db = crearClienteRestringido(admin, "expo");
  if (!db) return null;

  return Object.freeze({
    listar: (consulta) => listarContactos(db, consulta),
    resumen: () => resumenContactos(db),
    exportar: (consulta) => exportarAuditado(db, identidad.id, consulta),
    leer: (id) => leerContacto(db, id),
    crear: (datos) => crearAuditado(db, identidad.id, datos),
    editar: (id, datos) => editarAuditado(db, identidad.id, id, datos),
    cambiarConsentimiento: (id, acepta) => consentimientoAuditado(db, identidad.id, id, acepta),
    eliminar: (id) => eliminarAuditado(db, identidad.id, id),
  });
}

function falloContacto(error, codigo) {
  console.error(`[contactos] ${codigo}`, error?.code || "sin_codigo");
  return { ok: false };
}

async function crearAuditado(db, adminId, datos) {
  const { data, error } = await db.rpc("contacto_expo_auditado", {
    p_admin: adminId,
    p_nombre: datos.nombre,
    p_email: datos.email,
    p_telefono: datos.telefono,
    p_origen: datos.origen,
    p_detalle: datos.detalle ?? "",
    p_consentimiento: datos.consentimiento === true,
    p_version: VERSION_CONSENTIMIENTO,
  });
  if (error) return falloContacto(error, "registro_fallido");
  if (!data || data.ok === false || !data.id_contacto) return { ok: false };
  return { ok: true, id: data.id_contacto, nuevo: data.es_nuevo === true };
}

async function editarAuditado(db, adminId, id, datos) {
  const { data, error } = await db.rpc("edicion_contacto_expo_auditada", {
    p_admin: adminId,
    p_id: id,
    p_nombre: datos.nombre,
    p_email: datos.email,
    p_telefono: datos.telefono,
  });
  if (error) return falloContacto(error, "edicion_fallida");
  if (data?.codigo === "duplicado") return { ok: false, duplicado: true };
  if (!data || data.ok === false) return { ok: false };
  return { ok: true, contacto: data.contacto || null };
}

async function consentimientoAuditado(db, adminId, id, acepta) {
  const { data, error } = await db.rpc("consentimiento_expo_auditado", {
    p_admin: adminId,
    p_contacto: id,
    p_acepta: acepta === true,
    p_version: VERSION_CONSENTIMIENTO,
  });
  if (error) return falloContacto(error, "consentimiento_fallido");
  return { ok: data?.ok === true };
}

async function eliminarAuditado(db, adminId, id) {
  const { data, error } = await db.rpc("eliminacion_contacto_expo_auditada", {
    p_admin: adminId,
    p_id: id,
  });
  if (error) return falloContacto(error, "eliminacion_fallida");
  if (!data || data.ok === false) return { ok: false };
  return { ok: true, eliminado: data.eliminado === true };
}

async function exportarAuditado(db, adminId, consulta) {
  const resultado = await exportarContactos(db, consulta);
  if (!resultado.ok) return resultado;
  const { error, data } = await db.rpc("exportacion_expo_auditada", {
    p_admin: adminId,
    p_filtro: filtroValido(consulta?.filtro),
    p_con_busqueda: limpiarBusqueda(consulta?.busqueda) ? "si" : "no",
  });
  if (error) return falloContacto(error, "exportacion_fallida");
  if (data?.ok !== true) return { ok: false };
  return resultado;
}
