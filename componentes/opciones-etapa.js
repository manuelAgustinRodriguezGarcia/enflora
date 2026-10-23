"use client";

import { useId, useState } from "react";
import { IconoEtapa } from "@/componentes/icono-etapa";
import { IconoChevron } from "@/componentes/iconos-ui";
import { ETAPAS } from "@/lib/etapas";
import { TextoConMarca } from "@/componentes/marca-enflora";

export function OpcionesEtapa({ valor, onChange, nombre, leyenda = "Nueva etapa", plegable = false }) {
  const etiquetaId = useId();
  const [expandido, setExpandido] = useState(false);
  const seleccionada = ETAPAS.find((etapa) => etapa.valor === valor);
  const plegado = plegable && Boolean(seleccionada) && !expandido;

  function elegir(siguiente) {
    onChange(siguiente);
    if (plegable) setExpandido(false);
  }

  return (
    <div className="opciones-etapa">
      <p className="selector__etiqueta" id={etiquetaId}>
        {leyenda}
      </p>
      {plegado ? (
        <>
          {nombre ? <input type="hidden" name={nombre} value={valor} /> : null}
          <button
            type="button"
            className={`etapa-opcion etapa-opcion--${valor} etapa-opcion--activa etapa-opcion--plegada`}
            aria-labelledby={etiquetaId}
            aria-expanded={false}
            onClick={() => setExpandido(true)}
          >
            <IconoEtapa etapa={valor} />
            <span>
              <TextoConMarca texto={seleccionada.etiqueta} />
            </span>
            <IconoChevron className="etapa-opcion__chevron" />
          </button>
        </>
      ) : (
        <div className="opciones-etapa__lista" role="radiogroup" aria-labelledby={etiquetaId}>
          {ETAPAS.map((etapa) => {
            const activa = valor === etapa.valor;
            return (
              <label
                key={etapa.valor}
                className={`etapa-opcion etapa-opcion--${etapa.valor}${activa ? " etapa-opcion--activa" : ""}`}
              >
                <input
                  type="radio"
                  name={nombre}
                  value={etapa.valor}
                  checked={activa}
                  onChange={() => elegir(etapa.valor)}
                  onClick={activa && plegable ? () => setExpandido(false) : undefined}
                />
                <IconoEtapa etapa={etapa.valor} />
                <span>
                  <TextoConMarca texto={etapa.etiqueta} />
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
