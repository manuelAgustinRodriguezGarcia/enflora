"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RUTA_INICIO } from "@/lib/navegacion";
import {
  MENSAJE_USUARIO_OCUPADO,
  armarSugerenciasNombreUsuario,
  normalizarNombreUsuario,
} from "@/lib/perfil/nombre-usuario";
import { esTipoSeguimiento } from "@/lib/seguimiento";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

const MENSAJES = [
  "El nombre es obligatorio.",
  "El nombre de usuario es obligatorio.",
  "Alcanzaste el límite de cambios de nombre de usuario.",
  MENSAJE_USUARIO_OCUPADO,
  "No se encontró el perfil.",
  "El perfil ya existe.",
  "No hay sesión.",
];

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
  if (texto.includes("Ese nombre de usuario no está disponible.")) return MENSAJE_USUARIO_OCUPADO;
  return MENSAJES.find((mensaje) => texto.includes(mensaje)) || "No se pudo guardar el perfil.";
}

async function nombreLibre(supabase, candidato) {
  const { data, error } = await supabase.rpc("nombre_usuario_disponible", { candidato });
  if (error) return null;
  return Boolean(data);
}

async function sugerirNombreLibre(supabase, base) {
  for (const candidato of armarSugerenciasNombreUsuario(base)) {
    const libre = await nombreLibre(supabase, candidato);
    if (libre) return candidato;
  }
  return "";
}

export async function revisarNombreUsuario(candidato) {
  const consultado = normalizarNombreUsuario(candidato);
  if (!consultado) return { ok: true, disponible: true, sugerencia: "", consultado };

  if (!configuracionLista()) {
    return { ok: false, disponible: true, sugerencia: "", consultado };
  }

  const supabase = await crearClienteServidor();
  const user = await obtenerSesionRapida();
  if (!user) return { ok: false, disponible: true, sugerencia: "", consultado };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_usuario")
    .eq("id", user.id)
    .maybeSingle();

  if (perfil?.nombre_usuario === consultado) {
    return { ok: true, disponible: true, sugerencia: "", consultado };
  }

  const libre = await nombreLibre(supabase, consultado);
  if (libre === null) return { ok: false, disponible: true, sugerencia: "", consultado };
  if (libre) return { ok: true, disponible: true, sugerencia: "", consultado };

  const sugerencia = await sugerirNombreLibre(supabase, consultado);
  return { ok: true, disponible: false, sugerencia, consultado };
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
  const user = await obtenerSesionRapida();

  if (!user) {
    redirect("/ingreso");
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
      const sugerencia = await sugerirNombreLibre(supabase, nombreUsuario);
      return { ...estadoPerfil(MENSAJE_USUARIO_OCUPADO, datos), sugerencia };
    }
  }

  const { error } = await supabase.rpc("guardar_perfil", {
    nombre: datos.nombre,
    apellido: datos.apellido,
    telefono: datos.telefono,
    nombre_usuario: nombreUsuario,
  });

  if (error) {
    console.error("guardar_perfil", error.code, error.message, error.details, error.hint);
    const mensaje = mensajeDe(error);
    if (mensaje === MENSAJE_USUARIO_OCUPADO) {
      const sugerencia = await sugerirNombreLibre(supabase, nombreUsuario);
      return { ...estadoPerfil(mensaje, datos), sugerencia };
    }
    return estadoPerfil(mensaje, datos);
  }

  revalidatePath("/perfil");
  redirect("/perfil");
}

export async function guardarTipoSeguimiento(_estado, formulario) {
  const tipo = String(formulario.get("tipo_seguimiento") || "");
  const volver = formulario.get("destino") === "onboarding" ? RUTA_INICIO : "/perfil";

  if (!esTipoSeguimiento(tipo)) {
    return { error: "Seleccioná un tipo de seguimiento.", tipo };
  }

  if (!configuracionLista()) {
    return { error: "Falta la configuración de Supabase.", tipo };
  }

  const supabase = await crearClienteServidor();
  const user = await obtenerSesionRapida();

  if (!user) {
    redirect("/ingreso");
  }

  const { error } = await supabase.rpc("guardar_tipo_seguimiento", { tipo });

  if (error) {
    return { error: "No se pudo guardar la configuración.", tipo };
  }

  revalidatePath("/perfil");
  revalidatePath("/onboarding");
  redirect(volver);
}
