import Link from "next/link";
import { notFound } from "next/navigation";
import { FormularioEditarPlanta } from "@/componentes/formulario-editar-planta";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export default async function PaginaEditarPlanta({ params }) {
  const { id, unidadId, plantaId } = await params;

  if (!configuracionLista()) {
    return (
      <section className="espacio">
        <Link href={`/espacios/${id}/unidades/${unidadId}`}>Volver a la unidad</Link>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const supabase = await crearClienteServidor();
  const { data: planta, error: errorPlanta } = await supabase
    .from("plantas")
    .select("id, nombre, genetica, metodo, sustrato, etapa, fecha_inicio, estado, unidad_cultivo_id")
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

  const [unidadesRespuesta, metodosRespuesta] = await Promise.all([
    supabase
      .from("unidades_cultivo")
      .select("id, nombre, espacios(nombre)")
      .order("fecha_creacion", { ascending: true }),
    supabase.from("metodos_personalizados").select("nombre").order("nombre", { ascending: true }),
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
    <section className="espacio">
      <Link href={`/espacios/${id}/unidades/${unidadId}/plantas/${planta.id}`}>Volver a la planta</Link>
      <h1>Editar planta</h1>
      <FormularioEditarPlanta
        planta={planta}
        unidades={unidades}
        metodosPersonalizados={metodosPersonalizados}
      />
    </section>
  );
}
