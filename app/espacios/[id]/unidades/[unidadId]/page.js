import Link from "next/link";
import { notFound } from "next/navigation";
import { CabeceraUnidad } from "@/componentes/cabecera-unidad";
import { EnlaceVolver } from "@/componentes/enlace-volver";
import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { PanelAgregarPlanta } from "@/componentes/panel-agregar-planta";
import { TransicionVista } from "@/componentes/transicion-vista";
import { datosEtapaActual, esEtapa, fechaHoy, fechaInicioPlanta } from "@/lib/etapas";
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
        <EnlaceVolver href={`/espacios/${id}`} etiqueta="Volver al espacio" />
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
      .select("id, nombre, genetica, metodo, sustrato, etapa, fecha_inicio, fecha_creacion, estado, numero")
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
  const hoy = fechaHoy();
  let abiertas = [];

  if (lista.length) {
    const historialRespuesta = await supabase
      .from("historial_etapas")
      .select("planta_id, etapa, fecha_inicio, fecha_fin")
      .in(
        "planta_id",
        lista.map((planta) => planta.id)
      )
      .is("fecha_fin", null);
    if (!historialRespuesta.error) abiertas = historialRespuesta.data || [];
  }

  const inicioPorPlanta = new Map(abiertas.map((fila) => [fila.planta_id, fila]));

  return (
    <TransicionVista>
      <section className="espacio">
        <EnlaceVolver href={`/espacios/${unidad.espacio_id}`} etiqueta="Volver al espacio" />
        <CabeceraUnidad
          unidad={unidad}
          espacioId={unidad.espacio_id}
          tipoEspacio={espacioRespuesta.data.tipo}
          cantidadPlantas={lista.length}
        />
        <h2>Plantas</h2>
        {lista.length === 0 ? (
          <div className="vacio">
            <p>Todavía no hay plantas en esta unidad.</p>
          </div>
        ) : (
          <ListaEntrada>
            {lista.map((planta) => {
              const datos = datosEtapaActual(
                planta.etapa,
                inicioPorPlanta.has(planta.id) ? [inicioPorPlanta.get(planta.id)] : [],
                hoy
              );
              const claseTarjeta = esEtapa(planta.etapa)
                ? `tarjeta tarjeta--planta tarjeta--${planta.etapa}`
                : "tarjeta tarjeta--planta";
              return (
                <li key={planta.id}>
                  <Link
                    className={claseTarjeta}
                    href={`/espacios/${unidad.espacio_id}/unidades/${unidad.id}/plantas/${planta.id}`}
                  >
                    <div className="tarjeta__cabecera">
                      <span className="tarjeta__nombre">{planta.nombre}</span>
                      <span className="tarjeta__estado">
                        <IndicadorEtapa etapa={planta.etapa} tamano="compacto" />
                      </span>
                    </div>
                    <div className="tarjeta__metricas">
                      <span className="tarjeta__dato">
                        <span className="tarjeta__etiqueta">Genética</span>
                        <span className="tarjeta__valor">{planta.genetica || "—"}</span>
                      </span>
                      <span className="tarjeta__dato">
                        <span className="tarjeta__etiqueta">Método</span>
                        <span className="tarjeta__valor">{planta.metodo || "—"}</span>
                      </span>
                      <span className="tarjeta__dato">
                        <span className="tarjeta__etiqueta">
                          {datos.dia === null ? "Inicio" : "Día"}
                        </span>
                        <span className="tarjeta__valor">
                          {datos.dia === null ? formatearFecha(fechaInicioPlanta(planta)) : datos.dia}
                        </span>
                      </span>
                      <span className="tarjeta__dato">
                        <span className="tarjeta__etiqueta">Estado</span>
                        <span className="tarjeta__valor">{etiquetaEstado(planta.estado)}</span>
                      </span>
                      {planta.sustrato ? (
                        <span className="tarjeta__dato">
                          <span className="tarjeta__etiqueta">Sustrato</span>
                          <span className="tarjeta__valor">{planta.sustrato}</span>
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ListaEntrada>
        )}
        <PanelAgregarPlanta
          unidadId={unidad.id}
          siguienteNumero={siguienteNumero(lista)}
          metodosPersonalizados={metodosPersonalizados}
        />
      </section>
    </TransicionVista>
  );
}
