"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/componentes/landing/gsap";
import { OptionWheel } from "@/componentes/landing/option-wheel";
import { textos } from "@/lib/landing";

const EXPANDIR_HASTA = 0.2;
const RUEDA_HASTA = 0.72;
const PIN_PROPS =
  "position,top,left,right,bottom,width,height,maxWidth,maxHeight,margin,padding,transform,inset,zIndex";

function leerInsets(nodo) {
  const sonda = document.createElement("div");
  sonda.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;top:var(--con-enflora-inset-y);left:var(--con-enflora-inset-x);";
  nodo.appendChild(sonda);
  const estilos = getComputedStyle(sonda);
  const x = Number.parseFloat(estilos.left) || 20;
  const y = Number.parseFloat(estilos.top) || 48;
  sonda.remove();
  return { top: y, right: x, bottom: y, left: x };
}

function progresoAIndice(progreso, ultimo) {
  if (progreso <= EXPANDIR_HASTA) return 0;
  if (progreso >= RUEDA_HASTA) return ultimo;
  const tramo = (progreso - EXPANDIR_HASTA) / (RUEDA_HASTA - EXPANDIR_HASTA);
  return Math.min(ultimo, Math.max(0, Math.round(tramo * ultimo)));
}

function indiceAProgreso(indice, ultimo) {
  if (indice <= 0) return EXPANDIR_HASTA;
  return EXPANDIR_HASTA + (indice / ultimo) * (RUEDA_HASTA - EXPANDIR_HASTA);
}

export function ConEnflora() {
  const reducido = useReducedMotion();
  const { conEnflora } = textos;
  const frases = conEnflora.frases;
  const ref = useRef(null);
  const fondoRef = useRef(null);
  const triggerRef = useRef(null);
  const [compacto, setCompacto] = useState(false);
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 63.99rem)");
    const actualizar = () => setCompacto(media.matches);
    actualizar();
    media.addEventListener("change", actualizar);
    return () => media.removeEventListener("change", actualizar);
  }, []);

  useGSAP(
    () => {
      const nodo = ref.current;
      const fondo = fondoRef.current;
      if (!nodo || !fondo) return undefined;

      const limpiar = () => {
        gsap.set(fondo, { clearProps: "top,right,bottom,left,borderRadius" });
        gsap.set(nodo, { clearProps: PIN_PROPS });
        triggerRef.current = null;
      };

      if (reducido) {
        gsap.set(fondo, {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          borderRadius: 0,
        });
        return limpiar;
      }

      const ultimo = Math.max(frases.length - 1, 1);
      const radio = () => (window.matchMedia("(max-width: 63.99rem)").matches ? 28 : 40);

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: nodo,
          start: "top top",
          end: () => `+=${Math.round(window.innerHeight * (compacto ? 2.8 : 3.5))}`,
          pin: true,
          pinType: "fixed",
          scrub: 0.55,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            triggerRef.current = self;
            const siguiente = progresoAIndice(self.progress, ultimo);
            setIndice((actual) => (actual === siguiente ? actual : siguiente));
          },
        },
      });

      tl.fromTo(
        fondo,
        {
          top: () => leerInsets(nodo).top,
          right: () => leerInsets(nodo).right,
          bottom: () => leerInsets(nodo).bottom,
          left: () => leerInsets(nodo).left,
          borderRadius: () => radio(),
        },
        {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          borderRadius: 0,
          duration: EXPANDIR_HASTA,
          ease: "none",
          immediateRender: false,
        },
        0,
      );

      tl.to({}, { duration: 1 - EXPANDIR_HASTA }, EXPANDIR_HASTA);

      requestAnimationFrame(() => ScrollTrigger.refresh());

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
        limpiar();
      };
    },
    { scope: ref, dependencies: [reducido, frases.length, compacto] },
  );

  const irAIndice = (idx) => {
    setIndice(idx);
    const trigger = triggerRef.current;
    if (!trigger || reducido) return;
    const ultimo = Math.max(frases.length - 1, 1);
    const progreso = indiceAProgreso(idx, ultimo);
    const destino = trigger.start + (trigger.end - trigger.start) * progreso;
    window.scrollTo(0, destino);
  };

  const entrada = reducido
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="con-enflora" ref={ref}>
      <div className="con-enflora__fondo" ref={fondoRef} aria-hidden="true" />
      <div className="con-enflora__escena">
        <div className="con-enflora__mancha con-enflora__mancha--uno" aria-hidden="true" />
        <div className="con-enflora__mancha con-enflora__mancha--dos" aria-hidden="true" />
        <motion.div
          className="con-enflora__titulo"
          initial={entrada.initial}
          whileInView={entrada.animate}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="con-enflora__con">Con</span>
          <Image
            className="con-enflora__marca"
            src="/logos/enflora-logo-apaisado-light.svg"
            alt="ENFLORA"
            width={420}
            height={78}
            unoptimized
            priority={false}
          />
        </motion.div>
        <motion.div
          className="con-enflora__rueda"
          initial={entrada.initial}
          whileInView={entrada.animate}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.5, delay: reducido ? 0 : 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="con-enflora__centro" aria-hidden="true" />
          <OptionWheel
            items={frases}
            defaultSelected={0}
            indice={indice}
            onChange={irAIndice}
            textColor="#8aab56"
            activeColor="#A4C85B"
            side={compacto ? "left" : "right"}
            fontSize={compacto ? 2.15 : 3.5}
            spacing={compacto ? 1.45 : 1.35}
            curve={1}
            tilt={reducido ? 0 : 6}
            blur={reducido ? 0 : compacto ? 1.4 : 2.2}
            fade={reducido ? 0.35 : 0.22}
            smoothing={reducido ? 40 : 180}
            inset={compacto ? 16 : 28}
            loop={false}
            draggable
            capturarRueda={Boolean(reducido)}
            ariaLabel="Beneficios de ENFLORA"
          />
        </motion.div>
      </div>
    </div>
  );
}
