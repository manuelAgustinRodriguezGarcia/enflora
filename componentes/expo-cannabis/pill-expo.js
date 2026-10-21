"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { irASeccionExpo } from "@/componentes/expo-cannabis/enlace-desplazar";
import { ContenidoModalExpo } from "@/componentes/expo-cannabis/modal-expo";
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
  return [expoCannabis.nombre, detalle, textos.pill.abrir]
    .filter(Boolean)
    .map((frase) => (/[.!?]$/.test(frase) ? frase : `${frase}.`))
    .join(" ");
}

export function PillExpo() {
  const { estado, pill, restante, listo } = useExpo();
  const [abierto, setAbierto] = useState(false);
  const [retraida, setRetraida] = useState(false);
  const interactuo = useRef(false);
  const temporizador = useRef(0);
  const desplazamiento = useRef(0);
  const acciones = useRef(null);

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

  useEffect(() => () => window.clearTimeout(desplazamiento.current), []);

  if (!pill) return null;

  const marcarInteraccion = () => {
    interactuo.current = true;
    window.clearTimeout(temporizador.current);
  };

  const cambiar = (siguiente, detalles) => {
    if (siguiente) {
      marcarInteraccion();
      setAbierto(true);
      return;
    }
    detalles?.preventUnmountOnClose?.();
    setAbierto(false);
    if (window.matchMedia(CONSULTA_MOBILE).matches) setRetraida(true);
  };

  const irARegalos = () => {
    cambiar(false);
    window.clearTimeout(desplazamiento.current);
    desplazamiento.current = window.setTimeout(() => irASeccionExpo(ids.premios), 90);
  };

  const mensaje = textoEstado(estado, restante);
  const conContador = estado === ESTADOS_EXPO.proximo;

  return (
    <Dialog.Root open={abierto} onOpenChange={cambiar} actionsRef={acciones}>
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
        <Dialog.Trigger
          className={`expo-pill__boton${retraida ? " expo-pill__boton--retraida" : ""}`}
          aria-label={etiquetaAccesible(estado, restante)}
          onPointerEnter={marcarInteraccion}
          onPointerDown={marcarInteraccion}
          onFocus={marcarInteraccion}
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
        </Dialog.Trigger>
      </motion.div>
      <ContenidoModalExpo abierto={abierto} acciones={acciones} onIrARegalos={irARegalos} />
    </Dialog.Root>
  );
}
