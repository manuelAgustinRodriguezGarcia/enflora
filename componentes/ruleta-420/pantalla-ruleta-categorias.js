"use client";

import { AnimatePresence, motion } from "motion/react";
import { BotonRuleta } from "@/componentes/ruleta-420/boton-ruleta";
import { Ruleta } from "@/componentes/ruleta-420/ruleta";
import { SECTORES_CATEGORIAS, buscarCategoria } from "@/lib/ruleta-420/logica";

export function PantallaRuletaCategorias({ fase, ronda, categoriaId, rotacion, duracion, onGirar }) {
  const girando = fase === "spinning-category";
  const detenida = fase === "category-result";
  const categoria = detenida ? buscarCategoria(categoriaId) : null;
  const numeroRonda = fase === "category-wheel" ? ronda + 1 : ronda;

  let mensaje = { clave: "listo", texto: "Girá la ruleta para descubrir tu categoría" };
  if (girando) mensaje = { clave: "girando", texto: "Girando..." };
  if (categoria) mensaje = { clave: "resultado", texto: `¡Te tocó ${categoria.nombre}!` };

  return (
    <div className="ruleta-ronda">
      <span className="ruleta-chip">Ronda {numeroRonda}</span>

      <Ruleta
        sectores={SECTORES_CATEGORIAS}
        rotacion={rotacion}
        duracion={duracion}
        girando={girando}
        ganador={detenida ? categoriaId : null}
        etiqueta={categoria ? `La ruleta se detuvo en ${categoria.nombre}` : "Ruleta de categorías"}
      />

      <div className="ruleta-ronda__mensaje" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={mensaje.clave}
            className={`ruleta-ronda__texto${categoria ? " ruleta-ronda__texto--resultado" : ""}`}
            initial={{ opacity: 0, y: 10, scale: categoria ? 0.8 : 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={categoria ? { type: "spring", stiffness: 420, damping: 18 } : { duration: 0.2 }}
          >
            {mensaje.texto}
          </motion.p>
        </AnimatePresence>
      </div>

      <BotonRuleta onClick={onGirar} disabled={fase !== "category-wheel"}>
        ¡GIRAR RULETA!
      </BotonRuleta>
    </div>
  );
}
