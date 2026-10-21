"use client";

import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
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

function etiquetaAccesible(estado, restante, mobile) {
  if (mobile) return `${textos.pill.llamado}. ${textos.pill.ir}.`;
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

function useZonaOcultaMobile(activo) {
  const [oculta, setOculta] = useState(false);

  useEffect(() => {
    if (!activo) return undefined;

    const seccion = document.getElementById("producto");
    const pie = document.querySelector("footer.pie");
    let raf = 0;

    const medir = () => {
      raf = 0;
      const alto = window.innerHeight || 1;
      let dentro = false;

      if (seccion) {
        const caja = seccion.getBoundingClientRect();
        const visible = Math.max(0, Math.min(caja.bottom, alto) - Math.max(caja.top, 0));
        const ratio = visible / Math.max(caja.height, 1);
        dentro = caja.top < alto * 0.55 && caja.bottom > alto * 0.35 && ratio >= 0.45;
      }

      if (!dentro && pie) {
        const caja = pie.getBoundingClientRect();
        dentro = caja.top < alto - 48 && caja.bottom > alto * 0.7;
      }

      setOculta((actual) => (actual === dentro ? actual : dentro));
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(medir);
    };

    medir();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [activo]);

  return activo && oculta;
}

export function PillExpo() {
  const { estado, pill, restante, listo } = useExpo();
  const [mobile, setMobile] = useState(false);
  const [entro, setEntro] = useState(false);
  const oculta = useZonaOcultaMobile(Boolean(pill) && mobile);

  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_MOBILE);
    const sincronizar = () => setMobile(consulta.matches);
    sincronizar();
    consulta.addEventListener("change", sincronizar);
    return () => consulta.removeEventListener("change", sincronizar);
  }, []);

  if (!pill) return null;

  const irASeccion = (evento) => {
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return;
    evento.preventDefault();
    irASeccionExpo(ids.seccion, { bajoEncabezado: true });
  };

  const mensaje = textoEstado(estado, restante);
  const conContador = estado === ESTADOS_EXPO.proximo;
  const mostrada = listo && !oculta;
  const fuera = mobile ? { x: 0, y: "160%", opacity: 0 } : { x: "115%", y: 0, opacity: 0 };

  return (
    <motion.div
      className={`expo-pill${mostrada ? "" : " expo-pill--oculta"}`}
      initial={fuera}
      animate={mostrada ? { x: 0, y: 0, opacity: 1 } : fuera}
      transition={{
        type: "spring",
        stiffness: 210,
        damping: 26,
        delay: entro ? 0 : configuracionPill.retrasoEntradaMs / 1000,
      }}
      onAnimationComplete={() => {
        if (mostrada && !entro) setEntro(true);
      }}
    >
      <a
        href={`#${ids.seccion}`}
        className="expo-pill__boton"
        aria-label={etiquetaAccesible(estado, restante, mobile)}
        aria-hidden={!mostrada || undefined}
        tabIndex={mostrada ? undefined : -1}
        onClick={irASeccion}
      >
        <span className="expo-pill__llamado" aria-hidden="true">
          {textos.pill.llamado}
        </span>
        <span className="expo-pill__cuerpo" aria-hidden="true">
          <span className="expo-pill__nombre">
            <span className="expo-pill__punto" />
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
