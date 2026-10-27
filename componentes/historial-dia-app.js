"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { eliminarRegistro } from "@/app/registros/acciones";
import { Boton, EnlaceBoton } from "@/componentes/boton";
import { MedicionesDia } from "@/componentes/demo/historial-dia";
import { GaleriaDia } from "@/componentes/demo/historial-galeria";
import { IconoBasura } from "@/componentes/iconos-ui";
import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { textoDiaCultivo } from "@/lib/demo/historial/historial-demo";
import { formatearFecha } from "@/lib/etapas";

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

function EventoDia({ evento, fotosMapa, onAbrirFoto, onEliminado }) {
  const fotos = (evento.fotosIds || []).map((id) => fotosMapa.get(id)).filter(Boolean);
  const registro = evento.registro;

  return (
    <div
      className={`historial-evento${evento.ambiente ? " historial-evento--ambiente" : ""}`}
      id={evento.id ? `evento-${evento.id}` : undefined}
    >
      <header className="historial-evento__cabecera">
        <time dateTime={registro?.fecha_evento}>{evento.hora || "Sin hora"}</time>
        <span className={`historial-evento__tipo${evento.ambiente ? " historial-evento__tipo--ambiente" : ""}`}>
          {evento.ambiente ? "Ambiente" : "Plantas"}
        </span>
      </header>

      {evento.acciones.length ? (
        <ul className="historial-acciones" aria-label="Acciones">
          {evento.acciones.map((accion, indice) => (
            <li key={`${evento.id}-accion-${indice}`} className="historial-accion">
              <span className={`historial-accion__chip historial-accion__chip--${accion.tipo}`}>{accion.etiqueta}</span>
              {accion.nota ? <span className="historial-accion__nota">{accion.nota}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <MedicionesDia mediciones={evento.mediciones} compacto />

      {evento.nota ? <blockquote className="historial-dia__nota">{evento.nota}</blockquote> : null}

      <GaleriaDia fotos={fotos} dia={{ dia: evento.dia, fecha: registro?.fecha_evento }} onAbrir={onAbrirFoto} />

      {registro ? (
        <div className="historial-evento__acciones">
          <EnlaceBoton href={`/registros?editar=${registro.id}`} variante="secundario" className="historial-evento__editar">
            Editar
          </EnlaceBoton>
          <EliminarEvento registro={registro} onEliminado={onEliminado} />
        </div>
      ) : null}
    </div>
  );
}

export function HistorialDiaApp({ dia, fotos, onAbrirFoto, onEliminado = () => {} }) {
  const fotosMapa = new Map(fotos.map((foto) => [foto.id, foto]));
  const eventos = Array.isArray(dia.eventos) ? dia.eventos : [];

  return (
    <li className="historial-dia" id={dia.id}>
      <article className="tarjeta historial-dia__tarjeta" aria-labelledby={`${dia.id}-titulo`}>
        <header className="historial-dia__cabecera">
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
          {eventos.map((evento) => (
            <EventoDia
              key={evento.id}
              evento={evento}
              fotosMapa={fotosMapa}
              onAbrirFoto={onAbrirFoto}
              onEliminado={onEliminado}
            />
          ))}
        </div>
      </article>
    </li>
  );
}
