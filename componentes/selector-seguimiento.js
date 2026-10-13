"use client";

import { motion } from "motion/react";
import { TextoCambio } from "@/componentes/aparecer";
import { IconoSeguimiento } from "@/componentes/icono-seguimiento";
import { toque, transicionToque } from "@/lib/animaciones";
import { TIPOS_SEGUIMIENTO } from "@/lib/seguimiento";

export function SelectorSeguimiento({ valor, onChange, nombre = "tipo_seguimiento" }) {
  const activo = TIPOS_SEGUIMIENTO.find((tipo) => tipo.valor === valor);

  return (
    <fieldset className="seguimiento">
      <legend>Tipo de seguimiento</legend>
      <div className="seguimiento__opciones" role="presentation">
        {TIPOS_SEGUIMIENTO.map((tipo) => {
          const seleccionado = valor === tipo.valor;
          return (
            <motion.label
              key={tipo.valor}
              className={`seguimiento__opcion${seleccionado ? " seguimiento__opcion--activa" : ""}`}
              whileTap={toque}
              transition={transicionToque}
            >
              <input
                type="radio"
                name={nombre}
                value={tipo.valor}
                checked={seleccionado}
                onChange={() => onChange(tipo.valor)}
              />
              <IconoSeguimiento tipo={tipo.valor} />
              <span className="seguimiento__titulo">{tipo.etiqueta}</span>
            </motion.label>
          );
        })}
      </div>
      <div className="seguimiento__detalle">
        <p className="seguimiento__descripcion">
          <TextoCambio>{activo?.descripcion || ""}</TextoCambio>
        </p>
        <p className="seguimiento__ejemplos">
          <TextoCambio>{activo?.ejemplos || ""}</TextoCambio>
        </p>
      </div>
    </fieldset>
  );
}
