"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const MENSAJES = [
  "El nombre es obligatorio.",
  "El nombre de usuario es obligatorio.",
  "Alcanzaste el límite de cambios de nombre de usuario.",
  "Ese nombre de usuario no está disponible.",
  "No se encontró el perfil.",
  "El perfil ya existe.",
  "No hay sesión.",
];

function normalizarNombreUsuario(valor) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function leerPerfil(formulario) {
  return {
    nombre: String(formulario.get("nombre") || "").trim(),
    apellido: String(formulario.get("apellido") || "").trim(),
    telefono: String(formulario.get("telefono") || "").trim(),
    nombreUsuario: String(formulario.get("nombre_usuario") || "").trim(),
    perfilExiste: formulario.get("perfil_existe") === "si",
  };
}

function estadoPerfil(error, datos) {
  return { error, ...datos };
}

function mensajeDe(error) {
  const texto = error?.message || "";
  return MENSAJES.find((mensaje) => texto.includes(mensaje)) || "No se pudo guardar el perfil.";
}

export async function guardarPerfil(_estado, formulario) {
  const datos = leerPerfil(formulario);

  if (!datos.nombre) {
    return estadoPerfil("El nombre es obligatorio.", datos);
  }

  if (!configuracionLista()) {
    return estadoPerfil("Falta la configuración de Supabase.", datos);
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar");
  }

  if (!datos.perfilExiste) {
    const { error } = await supabase.rpc("crear_perfil", {
      nombre: datos.nombre,
      apellido: datos.apellido,
      telefono: datos.telefono,
    });

    if (error) {
      return estadoPerfil(mensajeDe(error), datos);
    }

    revalidatePath("/perfil");
    redirect("/perfil");
  }

  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("nombre_usuario, cambios_nombre_usuario")
    .eq("id", user.id)
    .maybeSingle();

  if (errorPerfil || !perfil) {
    return estadoPerfil("No se encontró el perfil.", datos);
  }

  const nombreUsuario = normalizarNombreUsuario(datos.nombreUsuario);

  if (!nombreUsuario) {
    return estadoPerfil("El nombre de usuario es obligatorio.", datos);
  }

  if (nombreUsuario !== perfil.nombre_usuario) {
    if (perfil.cambios_nombre_usuario >= 2) {
      return estadoPerfil("Alcanzaste el límite de cambios de nombre de usuario.", datos);
    }

    const { data: disponible, error: errorDisponible } = await supabase.rpc(
      "nombre_usuario_disponible",
      { candidato: nombreUsuario }
    );

    if (errorDisponible) {
      return estadoPerfil("No se pudo guardar el perfil.", datos);
    }

    if (!disponible) {
      return estadoPerfil("Ese nombre de usuario no está disponible.", datos);
    }
  }

  const { error } = await supabase.rpc("guardar_perfil", {
    nombre: datos.nombre,
    apellido: datos.apellido,
    telefono: datos.telefono,
    nombre_usuario: nombreUsuario,
  });

  if (error) {
    return estadoPerfil(mensajeDe(error), datos);
  }

  revalidatePath("/perfil");
  redirect("/perfil");
}
