"use server";

import { revalidatePath } from "next/cache";
import {
  esAdministradorExpo,
  guardarInventarioServicio,
  mutarEntregaExpo,
  obtenerPanelExpo,
  presentarProducto,
  presentarProductos,
  reiniciarParticipantesServicio,
} from "@/lib/expo-cannabis/admin";
import { deltasEntregaExpo, productoExpo } from "@/lib/expo-cannabis/productos";
import {
  actualizarConsentimiento,
  actualizarContacto,
  clienteContactos,
  eliminarContacto,
  exportarContactos,
  leerContacto,
  listarContactos,
  registrarContacto,
  resumenContactos,
} from "@/lib/contactos/datos";
import { construirCsvContactos, esIdContacto, validarContactoManual } from "@/lib/contactos/reglas";
import { obtenerUsuario } from "@/lib/supabase/servidor";

const RUTA = "/expo-cannabis/admin";
const SIN_SERVICIO = { ok: false, error: "El servicio de contactos no está configurado." };
const ERROR_CONTACTOS = { ok: false, error: "No pudimos completar la operación. Probá de nuevo." };

export async function leerContactosExpo(consulta) {
  if (!(await autorizado())) return { ok: false, error: "No autorizado." };
  const supabase = clienteContactos();
  if (!supabase) return SIN_SERVICIO;
  const [listado, resumen] = await Promise.all([listarContactos(supabase, consulta), resumenContactos(supabase)]);
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
  if (!(await autorizado())) return { ok: false, error: "No autorizado." };
  if (!esIdContacto(id)) return { ok: false, error: "El contacto no existe." };
  const supabase = clienteContactos();
  if (!supabase) return SIN_SERVICIO;
  const lectura = await leerContacto(supabase, id);
  if (!lectura.ok) return ERROR_CONTACTOS;
  if (!lectura.contacto) return { ok: false, error: "El contacto no existe." };
  return { ok: true, contacto: lectura.contacto };
}

export async function crearContactoExpo(datos) {
  if (!(await autorizado())) return { ok: false, error: "No autorizado." };
  const validacion = validarContactoManual(datos);
  if (!validacion.ok) return validacion;
  const supabase = clienteContactos();
  if (!supabase) return SIN_SERVICIO;
  const registro = await registrarContacto(supabase, {
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
  if (!(await autorizado())) return { ok: false, error: "No autorizado." };
  if (!esIdContacto(id)) return { ok: false, error: "El contacto no existe." };
  const validacion = validarContactoManual(datos);
  if (!validacion.ok) return validacion;
  const supabase = clienteContactos();
  if (!supabase) return SIN_SERVICIO;
  const resultado = await actualizarContacto(supabase, id, validacion.datos);
  if (!resultado.ok) {
    if (resultado.duplicado) return { ok: false, error: "Otro contacto ya usa ese correo o teléfono." };
    return ERROR_CONTACTOS;
  }
  if (!resultado.contacto) return { ok: false, error: "El contacto no existe." };
  revalidatePath(RUTA);
  return { ok: true, contacto: resultado.contacto };
}

export async function retirarConsentimientoExpo(id) {
  if (!(await autorizado())) return { ok: false, error: "No autorizado." };
  if (!esIdContacto(id)) return { ok: false, error: "El contacto no existe." };
  const supabase = clienteContactos();
  if (!supabase) return SIN_SERVICIO;
  const resultado = await actualizarConsentimiento(supabase, id, false);
  if (!resultado.ok) return ERROR_CONTACTOS;
  revalidatePath(RUTA);
  return { ok: true };
}

export async function eliminarContactoExpo(id) {
  if (!(await autorizado())) return { ok: false, error: "No autorizado." };
  if (!esIdContacto(id)) return { ok: false, error: "El contacto no existe." };
  const supabase = clienteContactos();
  if (!supabase) return SIN_SERVICIO;
  const resultado = await eliminarContacto(supabase, id);
  if (!resultado.ok) return ERROR_CONTACTOS;
  if (!resultado.eliminado) return { ok: false, error: "El contacto ya no existe." };
  revalidatePath(RUTA);
  return { ok: true };
}

export async function exportarContactosExpo(consulta) {
  if (!(await autorizado())) return { ok: false, error: "No autorizado." };
  const supabase = clienteContactos();
  if (!supabase) return SIN_SERVICIO;
  const resultado = await exportarContactos(supabase, consulta);
  if (!resultado.ok) return ERROR_CONTACTOS;
  return {
    ok: true,
    csv: construirCsvContactos(resultado.filas),
    cantidad: resultado.filas.length,
    truncado: resultado.truncado,
  };
}

export async function leerPanelExpo() {
  if (!(await autorizado())) return { ok: false, error: "No autorizado." };
  const panel = await obtenerPanelExpo();
  if (panel.error) return { ok: false, error: panel.error };
  return {
    ok: true,
    productos: presentarProductos(panel.productos),
    participantes: panel.participantes,
    partidas: panel.partidas,
  };
}

export async function registrarEntregaExpo(slug, delta) {
  if (!(await autorizado())) return { ok: false, error: "No autorizado." };
  if (!productoExpo(slug) || !deltasEntregaExpo(slug).includes(delta)) {
    return { ok: false, error: "La operación no es válida." };
  }

  const resultado = await mutarEntregaExpo(slug, delta);
  const producto = resultado.fila ? presentarProducto(productoExpo(slug), resultado.fila) : null;
  if (!resultado.ok) return producto ? { ...resultado, producto } : resultado;

  revalidatePath(RUTA);
  return {
    ok: true,
    producto,
  };
}

export async function guardarInventarioExpo(slug, stockTotal, entregados) {
  if (!(await autorizado())) return { ok: false, error: "No autorizado." };
  if (!productoExpo(slug) || !enteroValido(stockTotal) || !enteroValido(entregados)) {
    return { ok: false, error: "Las cantidades no son válidas." };
  }
  if (entregados > stockTotal) {
    return { ok: false, error: "Las entregas no pueden superar el stock." };
  }

  const resultado = await guardarInventarioServicio(slug, stockTotal, entregados);
  if (!resultado.ok) return resultado;

  revalidatePath(RUTA);
  return {
    ok: true,
    producto: presentarProducto(productoExpo(slug), resultado.fila),
  };
}

export async function reiniciarParticipantesExpo() {
  if (!(await autorizado())) return { ok: false, error: "No autorizado." };

  const resultado = await reiniciarParticipantesServicio();
  if (!resultado.ok) return resultado;

  revalidatePath(RUTA);
  return resultado;
}

async function autorizado() {
  const usuario = await obtenerUsuario();
  return Boolean(usuario && esAdministradorExpo(usuario));
}

function enteroValido(valor) {
  return Number.isInteger(valor) && valor >= 0 && valor <= 9999999;
}
