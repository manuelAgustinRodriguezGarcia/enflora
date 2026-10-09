import Link from "next/link";
import { notFound } from "next/navigation";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { EliminarUnidad } from "@/componentes/eliminar-unidad";
import { TransicionVista } from "@/componentes/transicion-vista";
import { FormularioPlanta } from "@/componentes/formulario-planta";
import { FormularioUnidad } from "@/componentes/formulario-unidad";
import { etiquetaEtapa } from "@/lib/etapas";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { etiquetaTipoUnidad, textoCantidad } from "@/lib/unidades";

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

function siguienteNumero(plantas) {
  let maximo = 0;
  for (const planta of plantas) {
    if (planta.numero > maximo) maximo = planta.numero;
  }
  return maximo + 1;
}

export default async function PaginaUnidad({ params }) {
  const { id, unidadId } = await params;

  if (!configuracionLista()) {
    return (
      <section className="espacio">
        <Link href={`/espacios/${id}`}>Volver al espacio</Link>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const supabase = await crearClienteServidor();
  const { data: unidad, error: errorUnidad } = await supabase
    .from("unidades_cultivo")
    .select("id, nombre, tipo, tipo_personalizado, numero, espacio_id")
    .eq("id", unidadId)
    .eq("espacio_id", id)
    .maybeSingle();

  if (errorUnidad || !unidad) notFound();

  const [plantasRespuesta, metodosRespuesta, espacioRespuesta] = await Promise.all([
    supabase
      .from("plantas")
      .select("id, nombre, genetica, metodo, sustrato, etapa, fecha_inicio, estado, numero")
      .eq("unidad_cultivo_id", unidad.id)
      .order("numero", { ascending: true }),
    supabase.from("metodos_personalizados").select("nombre").order("nombre", { ascending: true }),
    supabase.from("espacios").select("tipo").eq("id", id).maybeSingle(),
  ]);

  if (plantasRespuesta.error) return <p>No se pudieron cargar las plantas.</p>;
  if (metodosRespuesta.error) return <p>No se pudieron cargar los métodos.</p>;
  if (espacioRespuesta.error || !espacioRespuesta.data) notFound();

  const lista = plantasRespuesta.data || [];
  const metodosPersonalizados = (metodosRespuesta.data || []).map((metodo) => metodo.nombre);

  return (
    <TransicionVista>
    <section className="espacio">
      <Link href={`/espacios/${unidad.espacio_id}`}>Volver al espacio</Link>
      <h1>{unidad.nombre}</h1>
      <p>{etiquetaTipoUnidad(unidad.tipo, unidad.tipo_personalizado)}</p>
      <p>{textoCantidad(lista.length)}</p>
      <div className="acciones">
        <EliminarUnidad unidadId={unidad.id} espacioId={unidad.espacio_id} />
      </div>
      <FormularioUnidad
        unidad={unidad}
        espacioId={unidad.espacio_id}
        tipoEspacio={espacioRespuesta.data.tipo}
      />
      <FormularioPlanta
        unidadId={unidad.id}
        siguienteNumero={siguienteNumero(lista)}
        metodosPersonalizados={metodosPersonalizados}
      />
      <h2>Plantas</h2>
      {lista.length === 0 ? (
        <p>No hay plantas en esta unidad.</p>
      ) : (
        <ListaEntrada>
          {lista.map((planta) => (
            <li key={planta.id}>
              <Link
                className="tarjeta"
                href={`/espacios/${unidad.espacio_id}/unidades/${unidad.id}/plantas/${planta.id}`}
              >
                <span className="tarjeta__nombre">{planta.nombre}</span>
                <span className="tarjeta__meta">Genética: {planta.genetica || "—"}</span>
                <span className="tarjeta__meta">Método: {planta.metodo || "—"}</span>
                {planta.sustrato ? (
                  <span className="tarjeta__meta">Sustrato: {planta.sustrato}</span>
                ) : null}
                <span className="tarjeta__meta">Etapa: {etiquetaEtapa(planta.etapa)}</span>
                {planta.numero && planta.nombre !== `Planta ${planta.numero}` ? (
                  <span className="tarjeta__meta">Planta #{planta.numero}</span>
                ) : null}
                <span className="tarjeta__meta">Inicio: {formatearFecha(planta.fecha_inicio)}</span>
                <span className="tarjeta__meta">{etiquetaEstado(planta.estado)}</span>
              </Link>
            </li>
          ))}
        </ListaEntrada>
      )}
    </section>
    </TransicionVista>
  );
}
