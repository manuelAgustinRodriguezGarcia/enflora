"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export async function crearEspacio(_estado, formulario) {
  const nombre = String(formulario.get("nombre") || "").trim();
  const tipo = String(formulario.get("tipo") || "").trim();

  if (!nombre) {
    return { error: "El nombre es obligatorio.", nombre, tipo };
  }

  if (tipo !== "interior" && tipo !== "exterior") {
    return { error: "El tipo es obligatorio.", nombre, tipo };
  }

  if (!configuracionLista()) {
    return { error: "Falta la configuración de Supabase.", nombre, tipo };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar");
  }

  const { error } = await supabase.from("espacios").insert({
    usuario_id: user.id,
    nombre,
    tipo,
  });

  if (error) {
    return { error: "No se pudo crear el espacio.", nombre, tipo };
  }

  revalidatePath("/espacios");
  redirect("/espacios");
}
