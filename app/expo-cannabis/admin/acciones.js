"use server";

import { revalidatePath } from "next/cache";
import {
  esAdministradorExpo,
  guardarInventarioServicio,
  mutarEntregaExpo,
  obtenerPanelExpo,
  presentarProducto,
  presentarProductos,
} from "@/lib/expo-cannabis/admin";
import { deltasEntregaExpo, productoExpo } from "@/lib/expo-cannabis/productos";
import { obtenerUsuario } from "@/lib/supabase/servidor";

const RUTA = "/expo-cannabis/admin";

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

async function autorizado() {
  const usuario = await obtenerUsuario();
  return Boolean(usuario && esAdministradorExpo(usuario));
}

function enteroValido(valor) {
  return Number.isInteger(valor) && valor >= 0 && valor <= 9999999;
}
