"use client";

import { motion } from "motion/react";
import { IconoSeguimiento } from "@/componentes/icono-seguimiento";
import { toque, transicionToque } from "@/lib/animaciones";
import { TIPOS_SEGUIMIENTO } from "@/lib/seguimiento";

export function SelectorSeguimiento({ valor, onChange, nombre = "tipo_seguimiento" }) {
  return (
    <fieldset className="seguimiento">
      <legend>Tipo de seguimiento</legend>
      <div className="seguimiento__opciones" role="presentation">
        {TIPOS_SEGUIMIENTO.map((tipo) => {
          const activo = valor === tipo.valor;
          return (
            <motion.label
              key={tipo.valor}
              className={`seguimiento__opcion${activo ? " seguimiento__opcion--activa" : ""}`}
              whileTap={toque}
              transition={transicionToque}
            >
              <input
                type="radio"
                name={nombre}
                value={tipo.valor}
                checked={activo}
                onChange={() => onChange(tipo.valor)}
              />
              <IconoSeguimiento tipo={tipo.valor} />
              <span className="seguimiento__titulo">{tipo.etiqueta}</span>
              <span className="seguimiento__descripcion">{tipo.descripcion}</span>
              <span className="seguimiento__ejemplos">{tipo.ejemplos}</span>
            </motion.label>
          );
        })}
      </div>
    </fieldset>
  );
}
