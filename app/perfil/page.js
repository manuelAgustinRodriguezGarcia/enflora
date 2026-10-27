import { redirect } from "next/navigation";
import { PerfilVista } from "@/componentes/perfil-vista";
import { cargarSeguimiento } from "@/lib/cargar-seguimiento";
import { esTipoSeguimiento } from "@/lib/seguimiento";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export default async function PaginaPerfil() {
  if (!configuracionLista()) {
    return <p>Falta la configuración de Supabase.</p>;
  }

  const supabase = await crearClienteServidor();
  const user = await obtenerSesionRapida();

  if (!user) {
    redirect("/ingreso");
  }

  const { data: perfil, error } = await supabase
    .from("perfiles")
    .select("nombre, apellido, telefono, nombre_usuario, cambios_nombre_usuario, tipo_seguimiento")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return <p>No se pudo cargar el perfil.</p>;
  }

  const seguimiento =
    perfil && esTipoSeguimiento(perfil.tipo_seguimiento)
      ? await cargarSeguimiento(supabase, user.id, perfil.tipo_seguimiento)
      : null;

  return (
    <PerfilVista
      perfil={perfil}
      email={user.email || ""}
      seguimiento={seguimiento}
    />
  );
}
