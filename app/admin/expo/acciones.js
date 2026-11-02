"use server";

import { revalidatePath } from "next/cache";
import {
  guardarInventarioServicio,
  mutarEntregaExpo,
  obtenerAdminExpo,
  obtenerPanelExpo,
  presentarProducto,
  presentarProductos,
  reiniciarParticipantesServicio,
} from "@/lib/expo-cannabis/admin";
import { operacionesContactosAdmin } from "@/lib/expo-cannabis/contactos-admin";
import { deltasEntregaExpo, productoExpo } from "@/lib/expo-cannabis/productos";
import { construirCsvContactos, esIdContacto, validarContactoManual } from "@/lib/contactos/reglas";

const RUTA = "/admin/expo";
const NO_AUTORIZADO = { ok: false, error: "No autorizado." };
const SIN_SERVICIO = { ok: false, error: "El servicio de contactos no está configurado." };
const ERROR_CONTACTOS = { ok: false, error: "No pudimos completar la operación. Probá de nuevo." };

export async function leerContactosExpo(consulta) {
  const admin = await administrador();
  if (!admin) return NO_AUTORIZADO;
  const contactos = operacionesContactosAdmin(admin);
  if (!contactos) return SIN_SERVICIO;
  const [listado, resumen] = await Promise.all([contactos.listar(consulta), contactos.resumen()]);
  if (!listado.ok || !resumen.ok) return ERROR_CONTACTOS;
  return {
    ok: true,
    filas: listado.filas,
    total: listado.total,
    pagina: listado.pagina,
    paginas: listado.paginas,
    tamano: listado.tamano,
    consulta: listado.consulta,
    resumen: resumen.resumen,
  };
}

export async function leerContactoExpo(id) {
  const admin = await administrador();
  if (!admin) return NO_AUTORIZADO;
  if (!esIdContacto(id)) return { ok: false, error: "El contacto no existe." };
  const contactos = operacionesContactosAdmin(admin);
  if (!contactos) return SIN_SERVICIO;
  const lectura = await contactos.leer(id);
  if (!lectura.ok) return ERROR_CONTACTOS;
  if (!lectura.contacto) return { ok: false, error: "El contacto no existe." };
  return { ok: true, contacto: lectura.contacto };
}

export async function crearContactoExpo(datos) {
  const admin = await administrador();
  if (!admin) return NO_AUTORIZADO;
  const validacion = validarContactoManual(datos);
  if (!validacion.ok) return validacion;
  const contactos = operacionesContactosAdmin(admin);
  if (!contactos) return SIN_SERVICIO;
  const registro = await contactos.crear({
    ...validacion.datos,
    origen: "manual",
    detalle: "admin",
    consentimiento: false,
  });
  if (!registro.ok) return ERROR_CONTACTOS;
  revalidatePath(RUTA);
  return {
    ok: true,
    id: registro.id,
    nuevo: registro.nuevo,
    mensaje: registro.nuevo
      ? "Contacto agregado."
      : "Ya existía un contacto con ese correo o teléfono: se le sumó el origen manual sin pisar sus datos.",
  };
}

export async function editarContactoExpo(id, datos) {
  const admin = await administrador();
  if (!admin) return NO_AUTORIZADO;
  if (!esIdContacto(id)) return { ok: false, error: "El contacto no existe." };
  const validacion = validarContactoManual(datos);
  if (!validacion.ok) return validacion;
  const contactos = operacionesContactosAdmin(admin);
  if (!contactos) return SIN_SERVICIO;
  const resultado = await contactos.editar(id, validacion.datos);
  if (!resultado.ok) {
    if (resultado.duplicado) return { ok: false, error: "Otro contacto ya usa ese correo o teléfono." };
    return ERROR_CONTACTOS;
  }
  if (!resultado.contacto) return { ok: false, error: "El contacto no existe." };
  revalidatePath(RUTA);
  return { ok: true, contacto: resultado.contacto };
}

export async function retirarConsentimientoExpo(id) {
  const admin = await administrador();
  if (!admin) return NO_AUTORIZADO;
  if (!esIdContacto(id)) return { ok: false, error: "El contacto no existe." };
  const contactos = operacionesContactosAdmin(admin);
  if (!contactos) return SIN_SERVICIO;
  const resultado = await contactos.cambiarConsentimiento(id, false);
  if (!resultado.ok) return ERROR_CONTACTOS;
  revalidatePath(RUTA);
  return { ok: true };
}

export async function eliminarContactoExpo(id) {
  const admin = await administrador();
  if (!admin) return NO_AUTORIZADO;
  if (!esIdContacto(id)) return { ok: false, error: "El contacto no existe." };
  const contactos = operacionesContactosAdmin(admin);
  if (!contactos) return SIN_SERVICIO;
  const resultado = await contactos.eliminar(id);
  if (!resultado.ok) return ERROR_CONTACTOS;
  if (!resultado.eliminado) return { ok: false, error: "El contacto ya no existe." };
  revalidatePath(RUTA);
  return { ok: true };
}

export async function exportarContactosExpo(consulta) {
  const admin = await administrador();
  if (!admin) return NO_AUTORIZADO;
  const contactos = operacionesContactosAdmin(admin);
  if (!contactos) return SIN_SERVICIO;
  const resultado = await contactos.exportar(consulta);
  if (!resultado.ok) return ERROR_CONTACTOS;
  return {
    ok: true,
    csv: construirCsvContactos(resultado.filas),
    cantidad: resultado.filas.length,
    truncado: resultado.truncado,
  };
}

export async function leerPanelExpo() {
  const admin = await administrador();
  if (!admin) return NO_AUTORIZADO;
  const panel = await obtenerPanelExpo(admin);
  if (panel.error) return { ok: false, error: panel.error };
  return {
    ok: true,
    productos: presentarProductos(panel.productos),
    participantes: panel.participantes,
    partidas: panel.partidas,
  };
}

export async function registrarEntregaExpo(slug, delta) {
  const admin = await administrador();
  if (!admin) return NO_AUTORIZADO;
  if (!productoExpo(slug) || !deltasEntregaExpo(slug).includes(delta)) {
    return { ok: false, error: "La operación no es válida." };
  }

  const resultado = await mutarEntregaExpo(admin, slug, delta);
  const producto = resultado.fila ? presentarProducto(productoExpo(slug), resultado.fila) : null;
  if (!resultado.ok) return producto ? { ...resultado, producto } : resultado;

  revalidatePath(RUTA);
  return {
    ok: true,
    producto,
  };
}

export async function guardarInventarioExpo(slug, stockTotal, entregados) {
  const admin = await administrador();
  if (!admin) return NO_AUTORIZADO;
  if (!productoExpo(slug) || !enteroValido(stockTotal) || !enteroValido(entregados)) {
    return { ok: false, error: "Las cantidades no son válidas." };
  }
  if (entregados > stockTotal) {
    return { ok: false, error: "Las entregas no pueden superar el stock." };
  }

  const resultado = await guardarInventarioServicio(admin, slug, stockTotal, entregados);
  if (!resultado.ok) return resultado;

  revalidatePath(RUTA);
  return {
    ok: true,
    producto: presentarProducto(productoExpo(slug), resultado.fila),
  };
}

export async function reiniciarParticipantesExpo() {
  const admin = await administrador();
  if (!admin) return NO_AUTORIZADO;

  const resultado = await reiniciarParticipantesServicio(admin);
  if (!resultado.ok) return resultado;

  revalidatePath(RUTA);
  return resultado;
}

async function administrador() {
  const resultado = await obtenerAdminExpo();
  return resultado.ok ? resultado.credencial : null;
}

function enteroValido(valor) {
  return Number.isInteger(valor) && valor >= 0 && valor <= 9999999;
}
