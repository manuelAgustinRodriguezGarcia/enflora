import { redirect } from "next/navigation";
import { PerfilVista } from "@/componentes/perfil-vista";
import { cargarSeguimiento } from "@/lib/cargar-seguimiento";
import { cargarClimaPerfil } from "@/lib/clima/cargar";
import { leerPersonalidadFloraUsuario } from "@/lib/flora-personalidad";
import { AVATAR_VACIO, leerIdentidadPerfil } from "@/lib/perfil/identidad";
import { esTipoSeguimiento } from "@/lib/seguimiento";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export default async function PaginaPerfil() {
  if (!configuracionLista()) {
    return <p>Falta la configuración de Supabase.</p>;
  }

  const identidad = await leerIdentidadPerfil();
  const user = identidad?.user;

  if (!user) {
    redirect("/ingreso");
  }

  if (identidad.error) {
    return <p>No se pudo cargar el perfil.</p>;
  }

  const perfil = identidad.perfil;
  const supabase = await crearClienteServidor();

  const seguimiento =
    perfil && esTipoSeguimiento(perfil.tipo_seguimiento)
      ? await cargarSeguimiento(supabase, user.id, perfil.tipo_seguimiento)
      : null;

  const [personalidadFlora, clima] = await Promise.all([
    leerPersonalidadFloraUsuario(supabase),
    cargarClimaPerfil(supabase, user.id),
  ]);

  return (
    <PerfilVista
      perfil={perfil}
      email={user.email || ""}
      avatar={identidad.avatar || AVATAR_VACIO}
      seguimiento={seguimiento}
      personalidadFlora={personalidadFlora}
      clima={clima}
    />
  );
}
