import { redirect } from "next/navigation";
import { EditorSeguimiento } from "@/componentes/editor-seguimiento";
import { TransicionVista } from "@/componentes/transicion-vista";
import { cargarSeguimiento } from "@/lib/cargar-seguimiento";
import { esTipoSeguimiento } from "@/lib/seguimiento";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export default async function PaginaOnboarding() {
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
    .select("tipo_seguimiento")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return <p>No se pudo cargar el perfil.</p>;
  }

  if (!perfil) {
    return <p>No se encontró el perfil.</p>;
  }

  if (esTipoSeguimiento(perfil.tipo_seguimiento)) {
    redirect("/espacios");
  }

  const { data: espacio, error: errorEspacio } = await supabase
    .from("espacios")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (errorEspacio) {
    return <p>No se pudo comprobar el espacio.</p>;
  }

  if (!espacio) {
    redirect("/espacios");
  }

  const seguimiento = await cargarSeguimiento(supabase, user.id, perfil.tipo_seguimiento);

  if (seguimiento.error) {
    return <p>No se pudieron cargar las preferencias.</p>;
  }

  return (
    <TransicionVista>
      <section className="seguimiento-pagina">
        <h1>¿Cómo querés llevar el seguimiento?</h1>
        <p>
          Elegí una configuración inicial y ajustá los registros que querés tener más a mano. Podés cambiarlo cuando
          quieras.
        </p>
        <EditorSeguimiento
          modo="inicial"
          tipoInicial=""
          acciones={seguimiento.acciones}
          parametros={seguimiento.parametros}
          opcionesIniciales={seguimiento.opciones}
          textoGuardar="Guardar y continuar"
          continuarEn="/espacios"
        />
      </section>
    </TransicionVista>
  );
}
