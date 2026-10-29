"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Cloud, Sprout } from "lucide-react";
import { eliminarRegistro, urlFotoOriginal } from "@/app/registros/acciones";
import { Boton, EnlaceBoton } from "@/componentes/boton";
import { MedicionesDia } from "@/componentes/demo/historial-dia";
import { IconoBasura } from "@/componentes/iconos-ui";
import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { VisorFotos } from "@/componentes/visor-fotos";
import { textoDiaCultivo } from "@/lib/demo/historial/historial-demo";
import { formatearFecha } from "@/lib/etapas";
import { etiquetaAlcanceHistorico, horaArgentina } from "@/lib/historial-registros";

const MINIATURAS = 4;

function EliminarEvento({ registro, onEliminado }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(eliminarRegistro, null);
  const avisado = useRef(false);

  useEffect(() => {
    if (!estado?.ok || avisado.current) return;
    avisado.current = true;
    onEliminado(registro.id);
  }, [estado, onEliminado, registro.id]);

  return (
    <>
      <Boton
        type="button"
        className="boton boton--destructivo boton--icono historial-evento__eliminar"
        aria-label="Eliminar registro"
        onClick={() => setAbierto(true)}
      >
        <IconoBasura />
      </Boton>
      <ModalConfirmacion
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="¿Eliminar este registro?"
        descripcion="Se elimina este registro con sus acciones, parámetros y plantas asociadas."
        textoConfirmar="Eliminar"
        textoCancelar="Cancelar"
        pendiente={pendiente}
        error={estado?.error || ""}
        accion={accion}
        icono={<IconoBasura />}
        varianteIcono="eliminar"
        varianteConfirmar="destructivo"
      >
        <input type="hidden" name="registro_id" value={registro.id} />
        <input type="hidden" name="espacio_id" value={registro.espacio_id || ""} />
        <input type="hidden" name="unidad_id" value={registro.unidad_cultivo_id || ""} />
      </ModalConfirmacion>
    </>
  );
}

function resumenPlantas(filas) {
  const plantas = filas || [];
  if (!plantas.length) return "";
  const nombres = plantas.map((fila) => fila.nombre_planta || "Planta").filter(Boolean);
  if (nombres.length <= 2) return nombres.join(" · ");
  return `${nombres.slice(0, 2).join(" · ")} +${nombres.length - 2}`;
}

function FotosEvento({ registro, fotosMapa }) {
  const [indice, setIndice] = useState(null);
  const fotos = useMemo(
    () =>
      (registro.registro_fotos || [])
        .map((foto) => fotosMapa.get(foto.id))
        .filter(Boolean)
        .map((foto) => ({
          id: foto.id,
          url_miniatura: foto.miniatura || foto.url_miniatura,
          registro_id: registro.id,
          fecha_evento: registro.fecha_evento,
          aplica_a: registro.aplica_a,
          compartida: (registro.registro_plantas || []).length > 1,
          cantidad_plantas: (registro.registro_plantas || []).length,
        })),
    [registro, fotosMapa]
  );

  if (!fotos.length) return null;

  const visibles = fotos.slice(0, MINIATURAS);
  const restantes = fotos.length - visibles.length;

  return (
    <>
      <ul className="historial__fotos historial-evento__fotos" aria-label="Fotos del registro">
        {visibles.map((foto, posicion) => (
          <li key={foto.id}>
            <button
              type="button"
              className="historial__foto"
              onClick={() => setIndice(posicion)}
              aria-label={`Ver foto ${posicion + 1} de ${fotos.length}`}
            >
              {foto.url_miniatura ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto.url_miniatura} alt="" loading="lazy" decoding="async" />
              ) : null}
              {restantes > 0 && posicion === visibles.length - 1 ? (
                <span className="historial__foto-mas">+{restantes}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      <VisorFotos
        fotos={fotos}
        obtenerUrl={urlFotoOriginal}
        indice={indice}
        onCambiar={setIndice}
        onCerrar={() => setIndice(null)}
      />
    </>
  );
}

function PlantasEvento({ filas, ambiente }) {
  if (ambiente) {
    return <p className="historial__vacio-inline">Medición de la unidad, sin plantas asociadas.</p>;
  }
  const plantas = filas || [];
  if (!plantas.length) return <p className="historial__vacio-inline">Sin plantas asociadas.</p>;
  return (
    <ul className="historial__plantas">
      {plantas.map((fila) => (
        <li key={fila.id || `${fila.nombre_planta}-${fila.numero_planta}`}>
          <span>{fila.nombre_planta}</span>
          {fila.numero_planta ? <span> #{fila.numero_planta}</span> : null}
          {fila.genetica_planta ? <span> · {fila.genetica_planta}</span> : null}
          {!fila.planta_id ? <span> · ya no está en el cultivo</span> : null}
        </li>
      ))}
    </ul>
  );
}

function EventoDia({ evento, fotosMapa, onEliminado }) {
  const registro = evento.registro;
  const ambiente = evento.ambiente;
  const acciones = evento.acciones || [];
  const plantas = registro?.registro_plantas || [];
  const alcance = registro ? etiquetaAlcanceHistorico(registro) : "";
  const resumenAcciones = acciones.map((item) => item.etiqueta).join(" · ");
  const resumenPlantasTexto = ambiente ? "Ambiente" : resumenPlantas(plantas);

  return (
    <article
      className={`historial-evento historial-evento--compacto${ambiente ? " historial-evento--ambiente" : ""}`}
      id={evento.id ? `evento-${evento.id}` : undefined}
    >
      <details className="historial-evento__desplegable">
        <summary className="historial-evento__resumen">
          <span className="historial-evento__icono" aria-hidden="true">
            {ambiente ? <Cloud strokeWidth={1.75} /> : <Sprout strokeWidth={1.75} />}
          </span>
          <span className="historial-evento__meta">
            <time dateTime={registro?.fecha_evento}>{evento.hora || "Sin hora"}</time>
            <span className={`historial-evento__tipo${ambiente ? " historial-evento__tipo--ambiente" : ""}`}>
              {ambiente ? "Ambiente" : "Plantas"}
            </span>
          </span>
          <span className="historial-evento__vista-previa">
            {resumenAcciones || evento.nota || (evento.mediciones?.length ? "Parámetros" : "Registro")}
          </span>
          {resumenPlantasTexto ? (
            <span className="historial-evento__alcance">{resumenPlantasTexto}</span>
          ) : null}
        </summary>

        <div className="historial-evento__cuerpo">
          {acciones.length ? (
            <ul className="historial-acciones" aria-label="Acciones">
              {acciones.map((accion, indice) => (
                <li key={`${evento.id}-accion-${indice}`} className="historial-accion">
                  <span className={`historial-accion__chip historial-accion__chip--${accion.tipo}`}>
                    {accion.etiqueta}
                  </span>
                  {accion.nota ? <span className="historial-accion__nota">{accion.nota}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}

          <MedicionesDia mediciones={evento.mediciones} compacto />

          {evento.nota ? <blockquote className="historial-dia__nota">{evento.nota}</blockquote> : null}

          <FotosEvento registro={registro} fotosMapa={fotosMapa} />

          {registro ? (
            <>
              <dl className="historial-evento__datos">
                <div>
                  <dt>Alcance</dt>
                  <dd>{alcance}</dd>
                </div>
                <div>
                  <dt>Hora</dt>
                  <dd>{horaArgentina(registro.fecha_evento) || "—"}</dd>
                </div>
              </dl>
              <div className="historial-evento__plantas">
                <h4>Plantas o unidad afectadas</h4>
                <PlantasEvento filas={plantas} ambiente={ambiente} />
              </div>
              <div className="historial-evento__acciones">
                <EnlaceBoton
                  href={`/registros?editar=${registro.id}`}
                  variante="secundario"
                  className="historial-evento__editar"
                >
                  Editar
                </EnlaceBoton>
                <EliminarEvento registro={registro} onEliminado={onEliminado} />
              </div>
            </>
          ) : null}
        </div>
      </details>
    </article>
  );
}

function CambioEtapaDia({ cambio }) {
  return (
    <article className="historial-evento historial-evento--etapa">
      <div className="historial-evento__resumen historial-evento__resumen--etapa">
        <IndicadorEtapa etapa={cambio.etapa} tamano="compacto" />
        <div className="historial-evento__etapa-textos">
          <span className="historial-evento__tipo historial-evento__tipo--etapa">Cambio de etapa</span>
          {cambio.plantaNombre ? (
            <span className="historial-evento__alcance">{cambio.plantaNombre}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function HistorialDiaApp({ dia, fotos, onEliminado = () => {}, cambiosEtapa = [] }) {
  const fotosMapa = new Map(fotos.map((foto) => [foto.id, foto]));
  const eventos = Array.isArray(dia.eventos) ? dia.eventos : [];

  return (
    <li className="historial-dia" id={dia.id}>
      <div className="historial-dia__ancla" aria-hidden="true" />
      <header className="historial-dia__cabecera historial-dia__cabecera--linea">
        <div className="historial-dia__fecha">
          <h3 className="historial-dia__dia" id={`${dia.id}-titulo`}>
            {textoDiaCultivo(dia.dia)}
          </h3>
          <time className="historial-dia__cuando" dateTime={dia.fecha}>
            {formatearFecha(dia.fecha)}
          </time>
        </div>
        {dia.etapa ? <IndicadorEtapa etapa={dia.etapa} tamano="compacto" /> : null}
      </header>

      <div className="historial-dia__eventos">
        {cambiosEtapa.map((cambio) => (
          <CambioEtapaDia key={`${cambio.id}-${cambio.plantaNombre || "u"}`} cambio={cambio} />
        ))}
        {eventos.map((evento) => (
          <EventoDia
            key={evento.id}
            evento={evento}
            fotosMapa={fotosMapa}
            onEliminado={onEliminado}
          />
        ))}
      </div>
    </li>
  );
}
