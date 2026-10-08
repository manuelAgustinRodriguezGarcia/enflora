import Link from "next/link";
import { notFound } from "next/navigation";
import { EliminarPlanta } from "@/componentes/eliminar-planta";
import { etiquetaEtapa } from "@/lib/etapas";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

function etiquetaEstado(estado) {
  if (estado === "activa") return "Activa";
  if (estado === "finalizada") return "Finalizada";
  return estado;
}

function formatearFecha(fecha) {
  if (!fecha) return "—";
  const [anio, mes, dia] = fecha.split("-");
  if (!anio || !mes || !dia) return fecha;
  return `${dia}/${mes}/${anio}`;
}

export default async function PaginaPlanta({ params }) {
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
  const { data: unidad, error: errorUnidad } = await supabase
    .from("unidades_cultivo")
    .select("id, nombre, espacio_id, espacios(nombre)")
    .eq("id", unidadId)
    .eq("espacio_id", id)
    .maybeSingle();

  if (errorUnidad || !unidad) notFound();

  const { data: planta, error: errorPlanta } = await supabase
    .from("plantas")
    .select("id, nombre, genetica, metodo, sustrato, etapa, numero, fecha_inicio, estado, unidad_cultivo_id")
    .eq("id", plantaId)
    .eq("unidad_cultivo_id", unidad.id)
    .maybeSingle();

  if (errorPlanta || !planta) notFound();

  const espacioNombre = unidad.espacios?.nombre || "—";

  return (
    <section className="espacio">
      <Link href={`/espacios/${unidad.espacio_id}/unidades/${unidad.id}`}>Volver a la unidad</Link>
      <h1>{planta.nombre}</h1>
      <p>Genética: {planta.genetica || "—"}</p>
      <p>Método: {planta.metodo || "—"}</p>
      {planta.sustrato ? <p>Sustrato: {planta.sustrato}</p> : null}
      <p>Etapa: {etiquetaEtapa(planta.etapa)}</p>
      {planta.numero && planta.nombre !== `Planta ${planta.numero}` ? (
        <p>Planta #{planta.numero}</p>
      ) : null}
      <p>Fecha de inicio: {formatearFecha(planta.fecha_inicio)}</p>
      <p>Estado: {etiquetaEstado(planta.estado)}</p>
      <p>Espacio: {espacioNombre}</p>
      <p>Unidad: {unidad.nombre}</p>
      <div className="acciones">
        <Link href={`/espacios/${unidad.espacio_id}/unidades/${unidad.id}/plantas/${planta.id}/editar`}>
          Editar
        </Link>
        <EliminarPlanta plantaId={planta.id} unidadId={unidad.id} espacioId={unidad.espacio_id} />
      </div>
    </section>
  );
}
