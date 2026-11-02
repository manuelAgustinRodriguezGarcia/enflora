import { notFound } from "next/navigation";
import { EnlaceVolver } from "@/componentes/enlace-volver";
import { FormularioEditarPlanta } from "@/componentes/formulario-editar-planta";
import { TransicionVista } from "@/componentes/transicion-vista";
import { leerDetallePlanta } from "@/lib/geneticas/datos";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export default async function PaginaEditarPlanta({ params }) {
  const { id, unidadId, plantaId } = await params;

  if (!configuracionLista()) {
    return (
      <section className="espacio">
        <EnlaceVolver href={`/espacios/${id}/unidades/${unidadId}`} etiqueta="Volver a la unidad" />
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const supabase = await crearClienteServidor();
  const { data: planta, error: errorPlanta } = await supabase
    .from("plantas")
    .select(
      "id, nombre, genetica, metodo, sustrato, etapa, fecha_inicio, fecha_creacion, estado, unidad_cultivo_id"
    )
    .eq("id", plantaId)
    .eq("unidad_cultivo_id", unidadId)
    .maybeSingle();

  if (errorPlanta || !planta) notFound();

  const { data: unidadActual } = await supabase
    .from("unidades_cultivo")
    .select("id, espacio_id")
    .eq("id", planta.unidad_cultivo_id)
    .eq("espacio_id", id)
    .maybeSingle();

  if (!unidadActual) notFound();

  const [unidadesRespuesta, metodosRespuesta, detalleGenetica] = await Promise.all([
    supabase
      .from("unidades_cultivo")
      .select("id, nombre, espacios(nombre)")
      .order("fecha_creacion", { ascending: true }),
    supabase.from("metodos_personalizados").select("nombre").order("nombre", { ascending: true }),
    obtenerSesionRapida().then((user) =>
      user?.id ? leerDetallePlanta(supabase, user.id, planta.id) : null
    ),
  ]);

  if (unidadesRespuesta.error) return <p>No se pudieron cargar las unidades.</p>;
  if (metodosRespuesta.error) return <p>No se pudieron cargar los métodos.</p>;

  const unidades = (unidadesRespuesta.data || []).map((unidad) => ({
    id: unidad.id,
    nombre: unidad.nombre,
    espacioNombre: unidad.espacios?.nombre || "Espacio",
  }));
  const metodosPersonalizados = (metodosRespuesta.data || []).map((metodo) => metodo.nombre);

  return (
    <TransicionVista>
      <section className="espacio">
        <EnlaceVolver
          href={`/espacios/${id}/unidades/${unidadId}/plantas/${planta.id}`}
          etiqueta="Volver a la planta"
        />
        <h1>Editar planta</h1>
        <FormularioEditarPlanta
          planta={planta}
          unidades={unidades}
          metodosPersonalizados={metodosPersonalizados}
          detalleGenetica={detalleGenetica}
        />
      </section>
    </TransicionVista>
  );
}
