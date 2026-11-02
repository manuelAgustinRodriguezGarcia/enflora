import { headers } from "next/headers";
import { EnlacePerfilCliente } from "@/componentes/enlace-perfil-cliente";
import { esRutaApp } from "@/lib/navegacion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

function inicialPerfil(perfil, email) {
  const base = String(perfil?.nombre_usuario || perfil?.nombre || email || "").trim();
  return base.slice(0, 1).toUpperCase();
}

export async function EnlacePerfil({ usuarioId, email }) {
  const ruta = (await headers()).get("x-enflora-ruta") || "";
  if (!usuarioId || !esRutaApp(ruta)) return null;

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("perfiles")
    .select("nombre, nombre_usuario")
    .eq("id", usuarioId)
    .maybeSingle();

  return <EnlacePerfilCliente inicial={inicialPerfil(data, email)} />;
}
