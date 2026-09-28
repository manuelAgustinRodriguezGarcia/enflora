"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

async function urlConfirmarCorreo() {
  const encabezados = await headers();
  const host = encabezados.get("x-forwarded-host") || encabezados.get("host");
  const protocolo = encabezados.get("x-forwarded-proto") || "http";
  return `${protocolo}://${host}/correo/confirmar`;
}

function leerCredenciales(formulario) {
  return {
    email: String(formulario.get("email") || "").trim(),
    contrasena: String(formulario.get("contrasena") || ""),
    nombre: String(formulario.get("nombre") || "").trim(),
    apellido: String(formulario.get("apellido") || "").trim(),
    telefono: String(formulario.get("telefono") || "").trim(),
  };
}

function validarCredenciales(email, contrasena) {
  if (!email) {
    return "El email es obligatorio.";
  }

  if (!email.includes("@")) {
    return "El email no es válido.";
  }

  if (!contrasena) {
    return "La contraseña es obligatoria.";
  }

  return null;
}

function soloLetras(valor) {
  return /^[\p{L}\s]+$/u.test(valor);
}

function emailConDominio(email) {
  if (/\s/.test(email)) {
    return false;
  }

  const partes = email.split("@");

  if (partes.length !== 2 || !partes[0] || !partes[1]) {
    return false;
  }

  const punto = partes[1].lastIndexOf(".");
  return punto > 0 && punto < partes[1].length - 1;
}

function contrasenaCompleta(contrasena) {
  return /\p{Ll}/u.test(contrasena) && /\p{Lu}/u.test(contrasena) && /\d/.test(contrasena);
}

function mensajeCamposFaltantes(faltantes) {
  if (faltantes.length === 1) {
    return `Porfavor rellená el campo: ${faltantes[0]}`;
  }

  return "Rellená los campos indicados";
}

function estadoCredenciales(error, email, datos = {}) {
  return { error, email, ...datos };
}

export async function entrar(_estado, formulario) {
  const { email, contrasena } = leerCredenciales(formulario);
  const mensaje = validarCredenciales(email, contrasena);

  if (mensaje) {
    return estadoCredenciales(mensaje, email);
  }

  if (!configuracionLista()) {
    return estadoCredenciales(
      "Falta la configuración de Supabase.",
      email
    );
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: contrasena,
  });

  if (error) {
    return estadoCredenciales("No se pudo iniciar sesión.", email);
  }

  redirect("/espacios");
}

export async function registrar(_estado, formulario) {
  const { email, contrasena, nombre, apellido, telefono } = leerCredenciales(formulario);
  const datos = { nombre, apellido, telefono };

  const confirmar = String(formulario.get("confirmar_contrasena") || "");
  const campos = [
    ["nombre", "Nombre", nombre],
    ["email", "Email", email],
    ["contrasena", "Contraseña", contrasena],
    ["confirmar_contrasena", "Confirmar contraseña", confirmar],
  ];
  const faltantes = campos.filter(([, , valor]) => !valor);

  if (faltantes.length > 0) {
    return {
      ...estadoCredenciales(
        mensajeCamposFaltantes(faltantes.map(([, etiqueta]) => etiqueta)),
        email,
        datos
      ),
      faltantes: faltantes.map(([nombreCampo]) => nombreCampo),
    };
  }

  const baseNombre = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (!baseNombre || !soloLetras(nombre)) {
    return estadoCredenciales("El nombre solo puede incluir letras.", email, datos);
  }

  if (apellido && !soloLetras(apellido)) {
    return estadoCredenciales("El apellido solo puede incluir letras.", email, datos);
  }

  if (telefono && !/^\d+$/.test(telefono)) {
    return estadoCredenciales("El teléfono solo puede incluir números.", email, datos);
  }

  if (!emailConDominio(email)) {
    return {
      ...estadoCredenciales("El email no es válido.", email, datos),
      faltantes: ["email"],
    };
  }

  if (contrasena !== confirmar) {
    return estadoCredenciales("Las contraseñas no coinciden.", email, datos);
  }

  if (contrasena.length < 6) {
    return estadoCredenciales("La contraseña es demasiado corta.", email, datos);
  }

  if (!contrasenaCompleta(contrasena)) {
    return {
      ...estadoCredenciales(
        "La contraseña debe incluir minúscula, mayúscula y un número.",
        email,
        datos
      ),
      faltantes: ["contrasena"],
    };
  }

  if (!configuracionLista()) {
    return estadoCredenciales("Falta la configuración de Supabase.", email, datos);
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: contrasena,
    options: {
      emailRedirectTo: await urlConfirmarCorreo(),
      data: {
        nombre,
        apellido,
        telefono,
      },
    },
  });

  if (error) {
    return estadoCredenciales("No se pudo crear la cuenta.", email, datos);
  }

  if (!data.session) {
    redirect("/entrar?correo=pendiente");
  }

  redirect("/espacios");
}

export async function salir() {
  if (configuracionLista()) {
    const supabase = await crearClienteServidor();
    await supabase.auth.signOut();
  }

  redirect("/entrar");
}
