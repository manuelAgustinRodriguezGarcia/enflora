"use server";

import { revalidatePath } from "next/cache";
import { esUuid, validarBytesImagenGenetica, validarGeneticaPersonalizada } from "@/lib/geneticas/reglas";
import {
  actualizarGeneticaPersonalizada as editar,
  crearGeneticaPersonalizada as guardar,
  eliminarGeneticaPersonalizada as borrar,
  listarGeneticasPropias,
} from "@/lib/geneticas/datos";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

function refrescarGeneticas() {
  revalidatePath("/geneticas");
  revalidatePath("/cultivos");
}

async function leerImagen(formulario) {
  const archivo = formulario.get("imagen");
  if (!archivo || typeof archivo !== "object" || typeof archivo.arrayBuffer !== "function" || archivo.size <= 0) {
    return { bytes: null };
  }
  if (archivo.size > 2 * 1024 * 1024) {
    return { error: "La imagen supera el máximo de 2 MB.", campo: "imagen" };
  }
  const buffer = new Uint8Array(await archivo.arrayBuffer());
  const firma = validarBytesImagenGenetica(buffer);
  if (firma.error) return { error: firma.error, campo: "imagen" };
  return { bytes: buffer };
}

async function sesion() {
  if (!configuracionLista()) return { error: "Falta la configuración de Supabase." };
  const supabase = await crearClienteServidor();
  const user = await obtenerSesionRapida();
  if (!user?.id) return { error: "Tenés que iniciar sesión." };
  return { supabase, usuarioId: user.id };
}

function datosFormulario(formulario) {
  return validarGeneticaPersonalizada({
    nombre: formulario.get("nombre"),
    thc: formulario.get("thc"),
    cbd: formulario.get("cbd"),
    sabor: formulario.get("sabor"),
    aroma: formulario.get("aroma"),
  });
}

export async function crearGeneticaPersonalizada(formulario) {
  const validacion = datosFormulario(formulario);
  if (!validacion.ok) return { error: validacion.error, campo: validacion.campo };

  const imagen = await leerImagen(formulario);
  if (imagen.error) return imagen;

  const acceso = await sesion();
  if (acceso.error) return acceso;

  const resultado = await guardar(acceso.supabase, acceso.usuarioId, validacion.datos, imagen.bytes);
  if (!resultado.error) refrescarGeneticas();
  return resultado;
}

export async function actualizarGeneticaPersonalizada(formulario) {
  const id = String(formulario.get("id") || "");
  if (!esUuid(id)) return { error: "No se encontró la genética." };

  const validacion = datosFormulario(formulario);
  if (!validacion.ok) return { error: validacion.error, campo: validacion.campo };

  const imagen = await leerImagen(formulario);
  if (imagen.error) return imagen;

  const acceso = await sesion();
  if (acceso.error) return acceso;

  const resultado = await editar(acceso.supabase, acceso.usuarioId, id, validacion.datos, imagen.bytes);
  if (!resultado.error) refrescarGeneticas();
  return resultado;
}

export async function eliminarGeneticaPersonalizada(id) {
  if (!esUuid(id)) return { error: "No se encontró la genética." };
  const acceso = await sesion();
  if (acceso.error) return acceso;
  const resultado = await borrar(acceso.supabase, acceso.usuarioId, id);
  if (!resultado.error) refrescarGeneticas();
  return resultado;
}

export async function listarMisGeneticas() {
  if (!configuracionLista()) return { error: "Falta la configuración de Supabase." };
  const supabase = await crearClienteServidor();
  const user = await obtenerSesionRapida();
  if (!user?.id) return { error: "Tenés que iniciar sesión." };
  return listarGeneticasPropias(supabase, user.id);
}
