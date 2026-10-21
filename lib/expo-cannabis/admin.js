import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { productoExpo, productosExpo } from "@/lib/expo-cannabis/productos";

const COOKIE_VISITANTE = "enflora_expo_visitante";
const UN_ANIO = 60 * 60 * 24 * 400;
const CORREO_ADMIN_EXPO = "marg.ec256@gmail.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MENSAJES = [
  ["Inventario sin configurar", "Inventario sin configurar."],
  ["No hay stock suficiente", "No hay stock suficiente."],
  ["No se puede descontar", "No se puede descontar esa cantidad."],
  ["no pueden superar", "Las entregas no pueden superar el stock."],
  ["reservas pendientes", "El stock no alcanza para las reservas pendientes."],
  ["no es válida", "Las cantidades no son válidas."],
  ["no son válidas", "Las cantidades no son válidas."],
  ["No se encontró el producto", "No se encontró el producto."],
];

export function esAdministradorExpo(usuario) {
  const correo = String(usuario?.email || "").trim().toLowerCase();
  if (correo && correosAdministradoresExpo().includes(correo)) return true;
  const id = String(usuario?.id || "").trim().toLowerCase();
  return UUID.test(id) && idsAdministradoresExpo().includes(id);
}

export function presentarProductos(filas) {
  const porSlug = new Map((filas || []).map((fila) => [fila.slug, fila]));
  return productosExpo.map((producto) => presentarProducto(producto, porSlug.get(producto.slug)));
}

export function presentarProducto(producto, fila) {
  const catalogo = producto || productoExpo(fila?.slug);
  const stockTotal = fila?.stock_total === null || fila?.stock_total === undefined ? null : Number(fila.stock_total);
  const entregados = Number(fila?.entregados ?? 0);
  const reservados = Number(fila?.reservados ?? 0);
  const configurado =
    stockTotal !== null &&
    Number.isInteger(stockTotal) &&
    stockTotal >= 0 &&
    Number.isInteger(entregados) &&
    entregados >= 0 &&
    Number.isInteger(reservados) &&
    reservados >= 0 &&
    entregados + reservados <= stockTotal;

  return {
    slug: catalogo.slug,
    nombre: catalogo.nombre,
    ilustracion: catalogo.ilustracion,
    imagen: catalogo.imagen,
    configurado,
    stockTotal: configurado ? stockTotal : null,
    entregados: configurado ? entregados : 0,
    reservados: configurado ? reservados : 0,
    restante: configurado ? stockTotal - entregados - reservados : null,
    updatedAt: configurado ? fila?.updated_at ?? null : null,
  };
}

export async function obtenerPanelExpo() {
  const servicio = crearClienteServicio();
  if (!servicio) {
    return {
      error: "Falta la clave de servicio de Supabase en el servidor.",
      productos: [],
      participantes: 0,
      partidas: 0,
    };
  }

  let inventario = await servicio
    .from("expo_inventario")
    .select("slug, nombre, stock_total, entregados, reservados, updated_at");

  if (inventario.error && String(inventario.error.message || "").includes("reservados")) {
    inventario = await servicio
      .from("expo_inventario")
      .select("slug, nombre, stock_total, entregados, updated_at");
  }

  const resumen = await servicio.rpc("resumen_participantes_expo");

  if (inventario.error || resumen.error) {
    return {
      error: "No se pudo leer el inventario. Ejecutá la migración en Supabase.",
      productos: [],
      participantes: 0,
      partidas: 0,
    };
  }

  const cifras = leerJson(resumen.data) || {};
  return {
    error: null,
    productos: inventario.data || [],
    participantes: Number(cifras.participantes || 0),
    partidas: Number(cifras.partidas || 0),
  };
}

async function aplicarDeltaExpo(servicio, slug, delta) {
  const { data, error } = await servicio.rpc("registrar_entrega_expo", {
    p_slug: slug,
    p_delta: delta,
  });
  if (error) return { ok: false, error };
  const fila = leerJson(data);
  if (!fila?.slug) return { ok: false, error: { message: "No se pudo guardar el cambio." } };
  return { ok: true, fila };
}

export async function mutarEntregaExpo(slug, delta) {
  const servicio = crearClienteServicio();
  if (!servicio) return { ok: false, error: "Falta la clave de servicio de Supabase en el servidor." };

  const directo = await aplicarDeltaExpo(servicio, slug, delta);
  if (directo.ok) return { ok: true, fila: directo.fila };

  const crudo = String(directo.error?.message || "");
  if (delta > 1 && crudo.includes("no es válida")) {
    let fila = null;
    for (let paso = 0; paso < delta; paso += 1) {
      const parcial = await aplicarDeltaExpo(servicio, slug, 1);
      if (!parcial.ok) {
        if (!fila) return { ok: false, error: mensajeExpo(parcial.error) };
        return { ok: false, error: mensajeExpo(parcial.error), fila };
      }
      fila = parcial.fila;
    }
    return { ok: true, fila };
  }

  return { ok: false, error: mensajeExpo(directo.error) };
}

export async function guardarInventarioServicio(slug, stockTotal, entregados) {
  const servicio = crearClienteServicio();
  if (!servicio) return { ok: false, error: "Falta la clave de servicio de Supabase en el servidor." };

  const { data, error } = await servicio.rpc("guardar_inventario_expo", {
    p_slug: slug,
    p_stock: stockTotal,
    p_entregados: entregados,
  });

  if (error) return { ok: false, error: mensajeExpo(error) };
  const fila = leerJson(data);
  if (!fila?.slug) return { ok: false, error: "No se pudo guardar el cambio." };
  return { ok: true, fila };
}

export async function visitanteExpo() {
  const almacen = await cookies();
  const actual = String(almacen.get(COOKIE_VISITANTE)?.value || "").trim().toLowerCase();
  if (UUID.test(actual)) return actual;

  const creado = crypto.randomUUID();
  almacen.set(COOKIE_VISITANTE, creado, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UN_ANIO,
  });
  return creado;
}

export async function registrarPartidaExpo(visitorId) {
  if (!UUID.test(String(visitorId || "").toLowerCase())) return false;
  const servicio = crearClienteServicio();
  if (!servicio) return false;
  const { error } = await servicio.rpc("registrar_partida_expo", {
    p_visitor: visitorId,
  });
  return !error;
}

function correosAdministradoresExpo() {
  const extras = String(process.env.EXPO_ADMIN_EMAILS || "")
    .split(",")
    .map((correo) => correo.trim().toLowerCase())
    .filter((correo) => correo.includes("@"));
  return [CORREO_ADMIN_EXPO, ...extras];
}

function idsAdministradoresExpo() {
  return String(process.env.EXPO_ADMIN_IDS || "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter((id) => UUID.test(id));
}

function crearClienteServicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function leerJson(data) {
  if (!data) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data;
}

function mensajeExpo(error) {
  const texto = String(error?.message || "");
  const conocido = MENSAJES.find(([fragmento]) => texto.includes(fragmento));
  if (conocido) return conocido[1];
  if (texto.includes("expo_inventario") || texto.includes("schema cache") || texto.includes("Could not find")) {
    return "Falta ejecutar la migración en Supabase.";
  }
  return "No se pudo guardar el cambio.";
}
