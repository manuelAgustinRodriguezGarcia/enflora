"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { esUuidMezcla, mensajeErrorMezcla, validarProducto, validarReceta } from "@/lib/mezclas/reglas";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

async function sesion() {
  if (!configuracionLista()) {
    return { error: "Falta la configuración de Supabase." };
  }
  const user = await obtenerSesionRapida();
  if (!user) redirect("/ingreso");
  const supabase = await crearClienteServidor();
  return { supabase, user };
}

function mensajeDe(error, reserva) {
  return mensajeErrorMezcla(error) || reserva;
}

function revalidarCatalogo() {
  revalidatePath("/registros");
  revalidatePath("/registros/productos");
  revalidatePath("/registros/recetas");
}

export async function guardarProductoCultivo(entrada) {
  const validado = validarProducto(entrada);
  if (validado.error) return { error: validado.error };

  const id = String(entrada?.id || "").trim();
  if (id && !esUuidMezcla(id)) return { error: "No se encontró el producto." };

  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error };

  const { data, error } = await acceso.supabase.rpc("guardar_producto_cultivo", {
    p_id: id || null,
    p_nombre: validado.producto.nombre,
    p_fabricante: validado.producto.fabricante,
    p_tipo: validado.producto.tipo,
    p_caracteristicas: validado.producto.caracteristicas,
  });

  if (error) return { error: mensajeDe(error, "No se pudo guardar el producto.") };
  revalidarCatalogo();
  return { ok: true, producto: data };
}

export async function establecerProductoActivo(id, activo) {
  if (!esUuidMezcla(id)) return { error: "No se encontró el producto." };
  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error };

  const { error } = await acceso.supabase.rpc("establecer_producto_cultivo_activo", {
    p_id: id,
    p_activo: Boolean(activo),
  });
  if (error) return { error: mensajeDe(error, "No se pudo actualizar el producto.") };
  revalidarCatalogo();
  return { ok: true };
}

export async function guardarRecetaMezcla(entrada) {
  const id = String(entrada?.id || "").trim();
  if (id && !esUuidMezcla(id)) return { error: "No se encontró la receta." };

  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error };

  const { data: productos, error: errorProductos } = await acceso.supabase
    .from("productos_cultivo")
    .select("id, usuario_id, activo")
    .eq("usuario_id", acceso.user.id);

  if (errorProductos) {
    return { error: mensajeDe(errorProductos, "No se pudieron leer los productos.") };
  }

  const validado = validarReceta({ ...entrada, usuarioId: acceso.user.id }, productos || []);
  if (validado.error) return { error: validado.error };

  const { data, error } = await acceso.supabase.rpc("guardar_receta_mezcla", {
    p_id: id || null,
    p_datos: validado.receta,
  });
  if (error) return { error: mensajeDe(error, "No se pudo guardar la receta.") };
  revalidarCatalogo();
  return { ok: true, id: data };
}

export async function duplicarRecetaMezcla(id) {
  if (!esUuidMezcla(id)) return { error: "No se encontró la receta." };
  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error };

  const { data, error } = await acceso.supabase.rpc("duplicar_receta_mezcla", { p_id: id });
  if (error) return { error: mensajeDe(error, "No se pudo duplicar la receta.") };
  revalidarCatalogo();
  return { ok: true, id: data };
}

export async function establecerRecetaActiva(id, activa) {
  if (!esUuidMezcla(id)) return { error: "No se encontró la receta." };
  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error };

  const { error } = await acceso.supabase.rpc("establecer_receta_mezcla_activa", {
    p_id: id,
    p_activa: Boolean(activa),
  });
  if (error) return { error: mensajeDe(error, "No se pudo actualizar la receta.") };
  revalidarCatalogo();
  return { ok: true };
}
