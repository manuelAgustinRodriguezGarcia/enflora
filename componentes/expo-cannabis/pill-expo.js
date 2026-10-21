"use client";

import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { irASeccionExpo } from "@/componentes/expo-cannabis/enlace-desplazar";
import { useExpo } from "@/componentes/expo-cannabis/proveedor-expo";
import { expoCannabis, ESTADOS_EXPO } from "@/lib/expo-cannabis/configuracion";
import { describirRestante, formatearRestante } from "@/lib/expo-cannabis/tiempo";

const CONSULTA_MOBILE = "(max-width: 63.99rem)";
const { pill: configuracionPill, textos, ids } = expoCannabis;

function textoEstado(estado, restante) {
  if (estado === ESTADOS_EXPO.enCurso) return textos.pill.enCurso;
  if (estado === ESTADOS_EXPO.finalizado) return textos.pill.finalizado;
  return restante ? formatearRestante(restante) : "00d 00h 00m";
}

function etiquetaAccesible(estado, restante) {
  const detalle =
    estado === ESTADOS_EXPO.proximo
      ? restante
        ? describirRestante(restante)
        : ""
      : textoEstado(estado, restante);
  return [expoCannabis.nombre, detalle, textos.pill.ir]
    .filter(Boolean)
    .map((frase) => (/[.!?]$/.test(frase) ? frase : `${frase}.`))
    .join(" ");
}

export function PillExpo() {
  const { estado, pill, restante, listo } = useExpo();
  const [retraida, setRetraida] = useState(false);
  const interactuo = useRef(false);
  const temporizador = useRef(0);

  useEffect(() => {
    if (!pill) return undefined;
    const consulta = window.matchMedia(CONSULTA_MOBILE);

    const programar = () => {
      window.clearTimeout(temporizador.current);
      if (!consulta.matches || interactuo.current) return;
      temporizador.current = window.setTimeout(() => {
        if (!interactuo.current) setRetraida(true);
      }, configuracionPill.retrasoEntradaMs + configuracionPill.retraccionMobileMs);
    };

    programar();
    consulta.addEventListener("change", programar);
    return () => {
      window.clearTimeout(temporizador.current);
      consulta.removeEventListener("change", programar);
    };
  }, [pill]);

  if (!pill) return null;

  const marcarInteraccion = () => {
    interactuo.current = true;
    window.clearTimeout(temporizador.current);
  };

  const irASeccion = (evento) => {
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return;
    evento.preventDefault();
    marcarInteraccion();
    if (window.matchMedia(CONSULTA_MOBILE).matches) setRetraida(true);
    irASeccionExpo(ids.seccion, { bajoEncabezado: true });
  };

  const mensaje = textoEstado(estado, restante);
  const conContador = estado === ESTADOS_EXPO.proximo;

  return (
    <motion.div
      className="expo-pill"
      initial={{ x: "115%", opacity: 0 }}
      animate={listo ? { x: 0, opacity: 1 } : { x: "115%", opacity: 0 }}
      transition={{
        type: "spring",
        stiffness: 210,
        damping: 26,
        delay: configuracionPill.retrasoEntradaMs / 1000,
      }}
    >
      <a
        href={`#${ids.seccion}`}
        className={`expo-pill__boton${retraida ? " expo-pill__boton--retraida" : ""}`}
        aria-label={etiquetaAccesible(estado, restante)}
        onPointerEnter={marcarInteraccion}
        onPointerDown={marcarInteraccion}
        onFocus={marcarInteraccion}
        onClick={irASeccion}
      >
        <span className="expo-pill__insignia" aria-hidden="true">
          <span className="expo-pill__punto" />
          {textos.pill.insignia}
        </span>
        <span className="expo-pill__cuerpo" aria-hidden="true">
          <span className="expo-pill__nombre">
            <span className="expo-pill__punto expo-pill__punto--escritorio" />
            {textos.pill.nombre}
          </span>
          <span className="expo-pill__separador" />
          <span
            className={`expo-pill__tiempo${conContador ? " expo-pill__tiempo--contador" : ""}${
              conContador && !restante ? " expo-pill__tiempo--pendiente" : ""
            }`}
          >
            {mensaje}
          </span>
        </span>
        <ArrowUpRight className="expo-pill__flecha" size={18} strokeWidth={2.4} aria-hidden="true" />
      </a>
    </motion.div>
  );
}
