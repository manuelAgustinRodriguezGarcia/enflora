"use client";

import { motion } from "motion/react";
import { IconoPreferencia } from "@/componentes/icono-preferencia";
import { toque, transicionToque } from "@/lib/animaciones";

export function OpcionPreferencia({
  nombre,
  valor,
  etiqueta,
  detalle = "",
  icono = valor,
  activo,
  onChange,
  disabled,
  onEditar,
}) {
  return (
    <div className={`preferencia${activo ? " preferencia--activa" : ""}`}>
      <motion.label
        className="preferencia__cuerpo"
        whileTap={disabled ? undefined : toque}
        transition={transicionToque}
      >
        <input
          type="checkbox"
          name={nombre}
          value={valor}
          checked={activo}
          disabled={disabled}
          onChange={(evento) => onChange(valor, evento.target.checked)}
        />
        <IconoPreferencia clave={icono} />
        <span className="preferencia__texto">
          <span className="preferencia__nombre">{etiqueta}</span>
          {detalle ? <span className="preferencia__detalle">{detalle}</span> : null}
        </span>
      </motion.label>
      {onEditar ? (
        <button
          className="preferencia__editar"
          type="button"
          aria-label={`Editar ${etiqueta}`}
          disabled={disabled}
          onClick={onEditar}
        >
          <IconoPreferencia clave="editar" />
        </button>
      ) : null}
    </div>
  );
}
