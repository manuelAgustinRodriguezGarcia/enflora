import Link from "next/link";
import { notFound } from "next/navigation";
import { TextoCambio } from "@/componentes/aparecer";
import { CambiarEtapa } from "@/componentes/cambiar-etapa";
import { EliminarPlanta } from "@/componentes/eliminar-planta";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { TransicionVista } from "@/componentes/transicion-vista";
import { diasEntre, etiquetaEtapa, fechaHoy, formatearFecha, textoDias } from "@/lib/etapas";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

function etiquetaEstado(estado) {
  if (estado === "activa") return "Activa";
  if (estado === "finalizada") return "Finalizada";
  return estado;
}

function textoEtapaActual(etapa, historial, hoy) {
  const abierta = (historial || []).find((item) => !item.fecha_fin && item.fecha_inicio);
  if (!abierta) return etiquetaEtapa(etapa);
  const dias = diasEntre(abierta.fecha_inicio, hoy);
  return `${etiquetaEtapa(abierta.etapa)} · Día ${dias}`;
}

function periodoHistorial(registro) {
  const inicio = formatearFecha(registro.fecha_inicio);
  if (!registro.fecha_fin) return `Desde ${inicio}`;
  return `${inicio} → ${formatearFecha(registro.fecha_fin)}`;
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

  const { data: historial, error: errorHistorial } = await supabase
    .from("historial_etapas")
    .select("id, etapa, fecha_inicio, fecha_fin")
    .eq("planta_id", planta.id)
    .order("fecha_inicio", { ascending: true })
    .order("fecha_creacion", { ascending: true });

  const espacioNombre = unidad.espacios?.nombre || "—";
  const hoy = fechaHoy();

  return (
    <TransicionVista>
    <section className="espacio">
      <Link href={`/espacios/${unidad.espacio_id}/unidades/${unidad.id}`}>Volver a la unidad</Link>
      <h1>{planta.nombre}</h1>
      <p>Genética: {planta.genetica || "—"}</p>
      <p>Método: {planta.metodo || "—"}</p>
      {planta.sustrato ? <p>Sustrato: {planta.sustrato}</p> : null}
      <p>
        Etapa: <TextoCambio>{textoEtapaActual(planta.etapa, historial, hoy)}</TextoCambio>
      </p>
      {planta.numero && planta.nombre !== `Planta ${planta.numero}` ? (
        <p>Planta #{planta.numero}</p>
      ) : null}
      <p>Fecha de inicio: {formatearFecha(planta.fecha_inicio)}</p>
      <p>
        Estado: <TextoCambio>{etiquetaEstado(planta.estado)}</TextoCambio>
      </p>
      <p>Espacio: {espacioNombre}</p>
      <p>Unidad: {unidad.nombre}</p>
      <h2>Historial de etapas</h2>
      {errorHistorial ? <p>No se pudo cargar el historial de etapas.</p> : null}
      {!errorHistorial && (historial || []).length === 0 ? (
        <p>Esta planta no tiene historial de etapas.</p>
      ) : null}
      {!errorHistorial && historial?.length ? (
        <ListaEntrada>
          {historial.map((registro) => {
            const fin = registro.fecha_fin || hoy;
            return (
              <li className="tarjeta" key={registro.id}>
                <span className="tarjeta__nombre">{etiquetaEtapa(registro.etapa)}</span>
                <span className="tarjeta__meta">{periodoHistorial(registro)}</span>
                <span className="tarjeta__meta">{textoDias(diasEntre(registro.fecha_inicio, fin))}</span>
              </li>
            );
          })}
        </ListaEntrada>
      ) : null}
      <CambiarEtapa plantaId={planta.id} unidadId={unidad.id} espacioId={unidad.espacio_id}>
        <Link href={`/espacios/${unidad.espacio_id}/unidades/${unidad.id}/plantas/${planta.id}/editar`}>
          Editar
        </Link>
        <EliminarPlanta plantaId={planta.id} unidadId={unidad.id} espacioId={unidad.espacio_id} />
      </CambiarEtapa>
    </section>
    </TransicionVista>
  );
}
