"use client";

import { motion } from "motion/react";
import { IconoPlanta } from "@/componentes/iconos-ui";
import { toque, transicionToque } from "@/lib/animaciones";

function normalizar(texto, minimo, maximo) {
  const limpio = String(texto || "").replace(/\D/g, "");
  if (!limpio) return null;
  const numero = Number(limpio);
  if (!Number.isFinite(numero)) return null;
  return Math.min(maximo, Math.max(minimo, numero));
}

export function ContadorCantidad({
  valor,
  onChange,
  minimo = 1,
  maximo = 100,
  contexto = "",
  contextoExtra = null,
  ariaLabel = "Cantidad",
  deshabilitado = false,
  icono: Icono = IconoPlanta,
}) {
  function aplicar(siguiente) {
    if (siguiente < minimo || siguiente > maximo) return;
    onChange(siguiente);
  }

  const encabezado = contexto ? (
    contextoExtra ? (
      <div className="contador-cantidad__contexto-fila">
        <p className="contador-cantidad__contexto">{contexto}</p>
        {contextoExtra}
      </div>
    ) : (
      <p className="contador-cantidad__contexto">{contexto}</p>
    )
  ) : null;

  return (
    <div className="contador-cantidad">
      {encabezado}
      <div className="contador-cantidad__controles">
        <motion.button
          type="button"
          className="contador-cantidad__boton"
          aria-label="Restar"
          disabled={deshabilitado || valor <= minimo}
          whileTap={toque}
          transition={transicionToque}
          onClick={() => aplicar(valor - 1)}
        >
          −
        </motion.button>
        <div className="contador-cantidad__centro">
          <Icono className="contador-cantidad__icono" />
          <span className="contador-cantidad__multiplicador" aria-hidden="true">
            ×
          </span>
          <input
            className="contador-cantidad__input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={ariaLabel}
            value={String(valor)}
            disabled={deshabilitado}
            onChange={(evento) => {
              const siguiente = normalizar(evento.target.value, minimo, maximo);
              if (siguiente === null) return;
              onChange(siguiente);
            }}
            onBlur={(evento) => {
              const siguiente = normalizar(evento.target.value, minimo, maximo);
              onChange(siguiente === null ? minimo : siguiente);
            }}
          />
        </div>
        <motion.button
          type="button"
          className="contador-cantidad__boton"
          aria-label="Sumar"
          disabled={deshabilitado || valor >= maximo}
          whileTap={toque}
          transition={transicionToque}
          onClick={() => aplicar(valor + 1)}
        >
          +
        </motion.button>
      </div>
    </div>
  );
}
