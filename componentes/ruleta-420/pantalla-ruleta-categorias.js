"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BotonRuleta } from "@/componentes/ruleta-420/boton-ruleta";
import { ModalRuleta } from "@/componentes/ruleta-420/modal-ruleta";
import { Ruleta } from "@/componentes/ruleta-420/ruleta";
import { IMAGENES_RULETA, VIDAS_INICIALES } from "@/lib/ruleta-420/configuracion";
import { SECTORES_CATEGORIAS, buscarCategoria } from "@/lib/ruleta-420/logica";

export function PantallaRuletaCategorias({
  fase,
  ronda,
  aciertos,
  vidas,
  categoriaId,
  rotacion,
  duracion,
  onGirar,
  onResponder,
  onReiniciar,
}) {
  const [confirmar, setConfirmar] = useState(false);
  const girando = fase === "spinning-category";
  const detenida = fase === "category-result";
  const categoria = detenida ? buscarCategoria(categoriaId) : null;
  const numeroRonda = fase === "category-wheel" ? ronda + 1 : ronda;
  const huboIntento = ronda > 0 || aciertos > 0 || vidas < VIDAS_INICIALES;

  let mensaje = { clave: "listo", texto: "Girá la ruleta para descubrir tu categoría" };
  if (girando) mensaje = null;
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
        soloTexto
        etiqueta={categoria ? `La ruleta se detuvo en ${categoria.nombre}` : "Ruleta de categorías"}
      />

      <div className="ruleta-ronda__mensaje" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {mensaje ? (
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
          ) : null}
        </AnimatePresence>
      </div>

      <BotonRuleta onClick={onGirar} disabled={fase !== "category-wheel"}>
        ¡GIRAR RULETA!
      </BotonRuleta>
      <BotonRuleta variante="secundario" onClick={() => setConfirmar(true)} disabled={!huboIntento || girando}>
        Reiniciar intento
      </BotonRuleta>

      <ModalRuleta
        abierto={Boolean(categoria)}
        onCerrar={() => {}}
        titulo={categoria ? categoria.nombre : "Categoría"}
        className="ruleta-modal__panel--categoria"
      >
        {categoria?.imagen ? (
          <img
            className="ruleta-modal__categoria"
            src={IMAGENES_RULETA[categoria.imagen]}
            alt={categoria.descripcionImagen || categoria.nombre}
          />
        ) : null}
        <BotonRuleta onClick={onResponder}>Responder pregunta</BotonRuleta>
      </ModalRuleta>

      <ModalRuleta
        abierto={confirmar}
        onCerrar={() => setConfirmar(false)}
        titulo="¿REINICIAR INTENTO?"
        descripcion="Se pierde el progreso de esta partida y empezás de cero."
        className="ruleta-modal__panel--alerta"
      >
        <div className="ruleta-acciones">
          <BotonRuleta
            onClick={() => {
              setConfirmar(false);
              onReiniciar();
            }}
          >
            SÍ, REINICIAR
          </BotonRuleta>
          <BotonRuleta variante="secundario" onClick={() => setConfirmar(false)}>
            SEGUIR JUGANDO
          </BotonRuleta>
        </div>
      </ModalRuleta>
    </div>
  );
}
