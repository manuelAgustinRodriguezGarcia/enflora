import { redirect } from "next/navigation";
import { salir } from "@/app/acciones/sesion";
import { EditorSeguimiento } from "@/componentes/editor-seguimiento";
import { FormularioPerfil } from "@/componentes/formulario-perfil";
import { cargarSeguimiento } from "@/lib/cargar-seguimiento";
import { esTipoSeguimiento } from "@/lib/seguimiento";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export default async function PaginaPerfil() {
  if (!configuracionLista()) {
    return <p>Falta la configuración de Supabase.</p>;
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    <section className="auth">
      <h1>Perfil</h1>
      <FormularioPerfil perfil={perfil} email={user.email || ""} />
      {seguimiento?.error ? <p>No se pudieron cargar las preferencias.</p> : null}
      {seguimiento && !seguimiento.error ? (
        <EditorSeguimiento
          modo="edicion"
          encabezado="Seguimiento"
          tipoInicial={perfil.tipo_seguimiento}
          acciones={seguimiento.acciones}
          parametros={seguimiento.parametros}
          opcionesIniciales={seguimiento.opciones}
          textoGuardar="Guardar preferencias"
        />
      ) : null}
      <form className="perfil__salir" action={salir}>
        <button type="submit">Salir</button>
      </form>
    </section>
  );
}
