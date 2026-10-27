"use client";

import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { GaleriaDia } from "@/componentes/demo/historial-galeria";
import { textoDiaCultivo, textoMedicion } from "@/lib/demo/historial/historial-demo";
import { formatearFecha } from "@/lib/etapas";

export function MedicionesDia({ mediciones, compacto = false }) {
  if (!mediciones.length) return null;
  return (
    <ul className={`historial-mediciones${compacto ? " historial-mediciones--compacto" : ""}`} aria-label="Mediciones">
      {mediciones.map((medicion, indice) => {
        const { etiqueta, corto, valor, unidad } = textoMedicion(medicion);
        return (
          <li key={`${medicion.parametro}-${indice}`} className="historial-medicion">
            <span className="historial-medicion__etiqueta" title={etiqueta}>
              <span aria-hidden="true">{corto}</span>
              <span className="demo__sr">{etiqueta}</span>
            </span>
            <span className="historial-medicion__valor">
              {valor}
              {unidad ? <span className="historial-medicion__unidad"> {unidad}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function HistorialDia({ dia, fotos, onAbrirFoto }) {
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

        {dia.nota ? <blockquote className="historial-dia__nota">{dia.nota}</blockquote> : null}

        {dia.acciones.length ? (
          <ul className="historial-acciones" aria-label="Acciones del día">
            {dia.acciones.map((accion, indice) => (
              <li key={`${accion.tipo}-${indice}`} className="historial-accion">
                <span className={`historial-accion__chip historial-accion__chip--${accion.tipo}`}>{accion.etiqueta}</span>
                {accion.nota ? <span className="historial-accion__nota">{accion.nota}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}

        <MedicionesDia mediciones={dia.mediciones} />

        <GaleriaDia fotos={fotos} dia={dia} onAbrir={onAbrirFoto} />
      </article>
    </li>
  );
}
