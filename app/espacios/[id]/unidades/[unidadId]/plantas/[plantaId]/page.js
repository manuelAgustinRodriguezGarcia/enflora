import { notFound } from "next/navigation";
import { TextoCambio } from "@/componentes/aparecer";
import { EnlaceBoton } from "@/componentes/boton";
import { CambiarEtapa } from "@/componentes/cambiar-etapa";
import { EliminarPlanta } from "@/componentes/eliminar-planta";
import { EnlaceVolver } from "@/componentes/enlace-volver";
import { EtapaProgreso } from "@/componentes/etapa-progreso";
import { IconoLapiz } from "@/componentes/iconos-ui";
import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { TransicionVista } from "@/componentes/transicion-vista";
import {
  datosEtapaActual,
  diasEntre,
  esEtapa,
  fechaHoy,
  fechaInicioPlanta,
  formatearFecha,
  textoDias,
} from "@/lib/etapas";
import { hrefHistorial } from "@/lib/historial-registros";
import { GaleriaFotos } from "@/componentes/galeria-fotos";
import { cargarFotosDePlanta } from "@/lib/cargar-fotos";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

function etiquetaEstado(estado) {
  if (estado === "activa") return "Activa";
  if (estado === "finalizada") return "Finalizada";
  return estado;
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
        <EnlaceVolver href={`/espacios/${id}/unidades/${unidadId}`} etiqueta="Volver a la unidad" />
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
    .select(
      "id, nombre, genetica, metodo, sustrato, etapa, numero, fecha_inicio, fecha_creacion, estado, unidad_cultivo_id"
    )
    .eq("id", plantaId)
    .eq("unidad_cultivo_id", unidad.id)
    .maybeSingle();

  if (errorPlanta || !planta) notFound();

  const [historialRespuesta, fotosRespuesta] = await Promise.all([
    supabase
      .from("historial_etapas")
      .select("id, etapa, fecha_inicio, fecha_fin")
      .eq("planta_id", planta.id)
      .order("fecha_inicio", { ascending: true })
      .order("fecha_creacion", { ascending: true }),
    cargarFotosDePlanta(supabase, planta.id),
  ]);

  const historial = historialRespuesta.data;
  const errorHistorial = historialRespuesta.error;

  const espacioNombre = unidad.espacios?.nombre || "—";
  const hoy = fechaHoy();
  const datos = datosEtapaActual(planta.etapa, errorHistorial ? [] : historial, hoy);

  return (
    <TransicionVista>
      <section className="espacio">
        <EnlaceVolver
          href={`/espacios/${unidad.espacio_id}/unidades/${unidad.id}`}
          etiqueta="Volver a la unidad"
        />
        <header className="detalle-cabecera">
          <div className="detalle-cabecera__superior">
            <h1 className="detalle-cabecera__titulo">{planta.nombre}</h1>
            <div className="detalle-cabecera__acciones">
              <EnlaceBoton
                className="boton boton--secundario boton--icono"
                href={`/espacios/${unidad.espacio_id}/unidades/${unidad.id}/plantas/${planta.id}/editar`}
                aria-label="Editar planta"
              >
                <IconoLapiz />
              </EnlaceBoton>
              <EliminarPlanta plantaId={planta.id} unidadId={unidad.id} espacioId={unidad.espacio_id} />
            </div>
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
            {planta.sustrato ? (
              <span className="tarjeta__dato">
                <span className="tarjeta__etiqueta">Sustrato</span>
                <span className="tarjeta__valor">{planta.sustrato}</span>
              </span>
            ) : null}
            <span className="tarjeta__dato">
              <span className="tarjeta__etiqueta">Estado</span>
              <span className="tarjeta__valor">
                <TextoCambio>{etiquetaEstado(planta.estado)}</TextoCambio>
              </span>
            </span>
            <span className="tarjeta__dato">
              <span className="tarjeta__etiqueta">Inicio</span>
              <span className="tarjeta__valor">{formatearFecha(fechaInicioPlanta(planta))}</span>
            </span>
            <span className="tarjeta__dato">
              <span className="tarjeta__etiqueta">Ubicación</span>
              <span className="tarjeta__valor">
                {espacioNombre} · {unidad.nombre}
              </span>
            </span>
          </div>
        </header>
        <EtapaProgreso
          etapa={datos.etapa}
          dia={datos.dia}
          inicio={datos.inicio ? formatearFecha(datos.inicio) : ""}
          plantaId={planta.id}
          unidadId={unidad.id}
          espacioId={unidad.espacio_id}
        />
        <EnlaceBoton
          href={hrefHistorial({ unidadId: unidad.id, plantaId: planta.id })}
          variante="secundario"
          className="registros__historial"
        >
          Ver historial
        </EnlaceBoton>
        <GaleriaFotos
          fotos={fotosRespuesta.fotos}
          titulo="Fotos de la planta"
          vacio="Todavía no hay fotos en los registros de esta planta."
        />
        {fotosRespuesta.error ? (
          <p className="galeria-fotos__vacio" role="alert">
            No se pudieron cargar las fotos de la planta.
          </p>
        ) : null}
        <h2>Historial de etapas</h2>
        {errorHistorial ? <p>No se pudo cargar el historial de etapas.</p> : null}
        {!errorHistorial && (historial || []).length === 0 ? (
          <p>Esta planta no tiene historial de etapas.</p>
        ) : null}
        {!errorHistorial && historial?.length ? (
          <ListaEntrada>
            {historial.map((registro) => {
              const fin = registro.fecha_fin || hoy;
              const clase = esEtapa(registro.etapa)
                ? `tarjeta tarjeta--historial tarjeta--${registro.etapa}`
                : "tarjeta tarjeta--historial";
              return (
                <li className={clase} key={registro.id}>
                  <IndicadorEtapa etapa={registro.etapa} tamano="compacto" />
                  <div className="tarjeta__historial-derecha">
                    <span className="tarjeta__dias">{textoDias(diasEntre(registro.fecha_inicio, fin))}</span>
                    <span className="tarjeta__meta">{periodoHistorial(registro)}</span>
                  </div>
                </li>
              );
            })}
          </ListaEntrada>
        ) : null}
        <CambiarEtapa plantaId={planta.id} unidadId={unidad.id} espacioId={unidad.espacio_id} />
      </section>
    </TransicionVista>
  );
}
