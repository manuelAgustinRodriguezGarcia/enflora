"use client";

import { AnimatePresence, motion } from "motion/react";
import { IconoEtapa } from "@/componentes/icono-etapa";
import { IconoPlanta } from "@/componentes/iconos-ui";
import { transicionRapida } from "@/lib/animaciones";
import { esEtapa, etiquetaEtapa } from "@/lib/etapas";
import { TextoConMarca } from "@/componentes/marca-enflora";

function diasVisibles(dias) {
  const lista = Array.isArray(dias) ? dias : [];
  return lista.filter((dia) => Number.isFinite(dia));
}

function etiquetaConConteo(etiqueta, conteo, dias) {
  const partes = [etiqueta];
  if (Number.isInteger(conteo) && conteo >= 1) {
    partes.push(conteo === 1 ? "1 planta" : `${conteo} plantas`);
  }
  const lista = diasVisibles(dias);
  if (lista.length === 1) partes.push(`día ${lista[0]}`);
  else if (lista.length > 1) partes.push(lista.map((dia) => `día ${dia}`).join(", "));
  return partes.join(", ");
}

export function IndicadorEtapa({
  etapa,
  tamano = "compacto",
  animar = false,
  soloIcono = false,
  conteo = null,
  dias = null,
}) {
  const conocida = esEtapa(etapa);
  const clase = [
    "indicador-etapa",
    soloIcono ? "indicador-etapa--icono" : `indicador-etapa--${tamano}`,
    conocida ? `indicador-etapa--${etapa}` : "indicador-etapa--vacia",
  ].join(" ");
  const etiqueta = conocida ? etiquetaEtapa(etapa) : "Sin etapa";
  const cantidad = Number.isInteger(conteo) && conteo > 0 ? conteo : null;
  const listaDias = diasVisibles(dias);
  const cuerpo = (
    <>
      {conocida ? <IconoEtapa etapa={etapa} /> : null}
      {soloIcono ? null : (
        <span>
          <TextoConMarca texto={etiqueta} />
          {cantidad != null ? (
            <span className="indicador-etapa__grupo">
              <span className="indicador-etapa__sep" aria-hidden="true">
                |
              </span>
              <span className="indicador-etapa__conteo">
                <IconoPlanta className="indicador-etapa__conteo-icono" />
                <span>{`x${cantidad}`}</span>
              </span>
            </span>
          ) : null}
          {listaDias.map((dia) => (
            <span key={dia} className="indicador-etapa__grupo">
              <span className="indicador-etapa__sep" aria-hidden="true">
                |
              </span>
              <span className="indicador-etapa__dato">{`Día ${dia}`}</span>
            </span>
          ))}
        </span>
      )}
    </>
  );
  const accesible = etiquetaConConteo(etiqueta, cantidad, listaDias);

  if (!animar) {
    return (
      <span className={clase} aria-label={accesible}>
        {cuerpo}
      </span>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={conocida ? etapa : "vacia"}
        className={clase}
        aria-label={accesible}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={transicionRapida}
      >
        {cuerpo}
      </motion.span>
    </AnimatePresence>
  );
}
