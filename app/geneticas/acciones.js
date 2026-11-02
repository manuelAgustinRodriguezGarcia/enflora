"use server";

import { validarBytesImagenGenetica, validarGeneticaPersonalizada } from "@/lib/geneticas/reglas";
import { crearGeneticaPersonalizada as guardar } from "@/lib/geneticas/datos";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export async function crearGeneticaPersonalizada(formulario) {
  const validacion = validarGeneticaPersonalizada({
    nombre: formulario.get("nombre"),
    thc: formulario.get("thc"),
    cbd: formulario.get("cbd"),
    sabor: formulario.get("sabor"),
    aroma: formulario.get("aroma"),
  });
  if (!validacion.ok) return { error: validacion.error, campo: validacion.campo };

  const archivo = formulario.get("imagen");
  let bytes = null;
  if (archivo && typeof archivo === "object" && typeof archivo.arrayBuffer === "function" && archivo.size > 0) {
    if (archivo.size > 2 * 1024 * 1024) {
      return { error: "La imagen supera el máximo de 2 MB.", campo: "imagen" };
    }
    const buffer = new Uint8Array(await archivo.arrayBuffer());
    const firma = validarBytesImagenGenetica(buffer);
    if (firma.error) return { error: firma.error, campo: "imagen" };
    bytes = buffer;
  }

  if (!configuracionLista()) return { error: "Falta la configuración de Supabase." };
  const supabase = await crearClienteServidor();
  const user = await obtenerSesionRapida();
  if (!user?.id) return { error: "Tenés que iniciar sesión." };

  return guardar(supabase, user.id, validacion.datos, bytes);
}
