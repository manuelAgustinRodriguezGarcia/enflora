"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { transicionVista } from "@/lib/animaciones";

export function PerfilGuardarFlotante({ visible, onGuardar }) {
  const reducido = useReducedMotion();
  const [fase, setFase] = useState("oculto");

  useEffect(() => {
    if (visible && fase === "oculto") setFase("visible");
  }, [visible, fase]);

  const mostrar = fase === "visible" || fase === "guardando" || fase === "exito" || fase === "salida";
  const mostrarCheck = fase === "exito" || fase === "salida";

  return (
    <AnimatePresence>
      {mostrar ? (
        <motion.button
          key="perfil-guardar"
          type="button"
          className="perfil__guardar"
          aria-label={mostrarCheck ? "Guardado" : fase === "guardando" ? "Guardando" : "Guardar cambios"}
          aria-busy={fase === "guardando" || undefined}
          disabled={fase === "guardando" || fase === "exito" || fase === "salida"}
          initial={reducido ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
          animate={
            fase === "salida"
              ? { opacity: 0, y: -32 }
              : { opacity: 1, y: 0 }
          }
          exit={reducido ? { opacity: 0 } : { opacity: 0, y: -32 }}
          transition={reducido ? { duration: 0 } : transicionVista}
          onAnimationComplete={() => {
            if (fase === "salida") setFase("oculto");
          }}
          onClick={async () => {
            if (fase !== "visible") return;
            setFase("guardando");
            const ok = await onGuardar?.();
            if (!ok) {
              setFase("visible");
              return;
            }
            setFase("exito");
            window.setTimeout(() => setFase("salida"), reducido ? 0 : 320);
          }}
        >
          {mostrarCheck ? (
            <Check size={22} strokeWidth={2.25} aria-hidden="true" />
          ) : (
            <Save size={22} strokeWidth={2.25} aria-hidden="true" />
          )}
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
