"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "@/componentes/landing/gsap";
import { OptionWheel } from "@/componentes/landing/option-wheel";
import { textos } from "@/lib/landing";

const EXPANDIR_HASTA = 0.2;
const RUEDA_HASTA = 0.72;
const PIN_PROPS =
  "position,top,left,right,bottom,width,height,maxWidth,maxHeight,margin,padding,transform,inset,zIndex";

function leerInsets(nodo) {
  const sonda = document.createElement("div");
  sonda.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;top:var(--con-enflora-inset-y);right:var(--con-enflora-inset-x);bottom:var(--con-enflora-inset-bottom);left:var(--con-enflora-inset-x);";
  nodo.appendChild(sonda);
  const estilos = getComputedStyle(sonda);
  const top = Number.parseFloat(estilos.top) || 0;
  const right = Number.parseFloat(estilos.right) || 0;
  const bottom = Number.parseFloat(estilos.bottom) || 0;
  const left = Number.parseFloat(estilos.left) || 0;
  sonda.remove();
  return { top, right, bottom, left };
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
  const { antetitulo, titulo, tituloLineas, ruedaTitulo, frases } = conEnflora;
  const ref = useRef(null);
  const fondoRef = useRef(null);
  const triggerRef = useRef(null);
  const sincronizandoRef = useRef(false);
  const [compacto, setCompacto] = useState(false);
  const [notebook, setNotebook] = useState(false);
  const [listo, setListo] = useState(false);
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const movil = window.matchMedia("(max-width: 63.99rem)");
    const medio = window.matchMedia("(min-width: 64rem) and (max-width: 89.99rem)");
    const actualizar = () => {
      setCompacto(movil.matches);
      setNotebook(medio.matches);
    };
    actualizar();
    setListo(true);
    movil.addEventListener("change", actualizar);
    medio.addEventListener("change", actualizar);
    return () => {
      movil.removeEventListener("change", actualizar);
      medio.removeEventListener("change", actualizar);
    };
  }, []);

  useGSAP(
    () => {
      const nodo = ref.current;
      const fondo = fondoRef.current;
      if (!nodo || !fondo || !listo) return undefined;

      const limpiar = () => {
        gsap.set(fondo, { clearProps: "top,right,bottom,left,inset,borderRadius" });
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
      const esDesktop = window.matchMedia("(min-width: 64rem)").matches;
      const leidos = leerInsets(nodo);
      const insetsInicial = esDesktop
        ? { top: 0, right: leidos.right, bottom: 0, left: leidos.left }
        : { top: 0, right: 0, bottom: 0, left: 0 };
      const radioInicial = esDesktop ? "40px 40px 0px 0px" : 0;

      gsap.set(fondo, {
        top: insetsInicial.top,
        right: insetsInicial.right,
        bottom: insetsInicial.bottom,
        left: insetsInicial.left,
        borderRadius: radioInicial,
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: nodo,
          start: "top top",
          end: () => `+=${Math.round(window.innerHeight * (compacto ? 2.8 : 3.5))}`,
          pin: true,
          pinType: "fixed",
          scrub: compacto ? true : 0.55,
          anticipatePin: 1,
          fastScrollEnd: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            triggerRef.current = self;
            const siguiente = progresoAIndice(self.progress, ultimo);
            setIndice((actual) => {
              if (actual === siguiente) return actual;
              sincronizandoRef.current = true;
              queueMicrotask(() => {
                sincronizandoRef.current = false;
              });
              return siguiente;
            });
          },
        },
      });

      tl.fromTo(
        fondo,
        {
          top: insetsInicial.top,
          right: insetsInicial.right,
          bottom: insetsInicial.bottom,
          left: insetsInicial.left,
          borderRadius: radioInicial,
        },
        {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          borderRadius: 0,
          duration: EXPANDIR_HASTA,
          ease: "none",
          immediateRender: true,
        },
        0,
      );

      tl.to({}, { duration: 1 - EXPANDIR_HASTA }, EXPANDIR_HASTA);

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
        limpiar();
      };
    },
    { scope: ref, dependencies: [reducido, frases.length, compacto, listo] },
  );

  const irAIndice = (idx) => {
    if (sincronizandoRef.current) return;
    setIndice(idx);
    const trigger = triggerRef.current;
    if (!trigger || reducido || compacto) return;
    const ultimo = Math.max(frases.length - 1, 1);
    const progreso = indiceAProgreso(idx, ultimo);
    const destino = trigger.start + (trigger.end - trigger.start) * progreso;
    window.scrollTo(0, destino);
  };

  const animarEntrada = !reducido && !compacto;
  const animarTitulo = !reducido;
  const entrada = animarEntrada
    ? { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 } }
    : { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 } };
  const lineasTitulo = tituloLineas?.length ? tituloLineas : [titulo];
  const curva = [0.22, 1, 0.36, 1];

  return (
    <div className="con-enflora" ref={ref}>
      <div className="con-enflora__fondo" ref={fondoRef} aria-hidden="true">
        <div className="con-enflora__media" />
      </div>
      <div className="con-enflora__escena">
        <div className="con-enflora__titulo">
          <motion.p
            className="con-enflora__antetitulo"
            initial={animarTitulo ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
            {...(animarTitulo
              ? {
                  whileInView: { opacity: 1, y: 0 },
                  viewport: { once: true, amount: 0.55 },
                  transition: { duration: 0.4, ease: curva },
                }
              : { animate: { opacity: 1, y: 0 } })}
          >
            {antetitulo}
          </motion.p>
          <h2 className="con-enflora__headline">
            {lineasTitulo.map((linea, i) => (
              <motion.span
                className="con-enflora__headline-linea"
                key={linea}
                initial={
                  animarTitulo
                    ? { opacity: 0, y: 22, filter: "blur(12px)" }
                    : { opacity: 1, y: 0, filter: "blur(0px)" }
                }
                {...(animarTitulo
                  ? {
                      whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
                      viewport: { once: true, amount: 0.55 },
                      transition: {
                        duration: 0.75,
                        delay: 0.08 + i * 0.14,
                        ease: curva,
                      },
                    }
                  : { animate: { opacity: 1, y: 0, filter: "blur(0px)" } })}
              >
                {linea}
              </motion.span>
            ))}
          </h2>
        </div>
        <motion.div
          className="con-enflora__rueda"
          initial={entrada.initial}
          {...(animarEntrada
            ? {
                whileInView: entrada.animate,
                viewport: { once: true, amount: 0.35 },
                transition: { duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] },
              }
            : { animate: entrada.animate })}
        >
          <p className="con-enflora__antetitulo con-enflora__rueda-titulo">{ruedaTitulo}</p>
          {listo ? (
            <OptionWheel
              items={frases}
              defaultSelected={0}
              indice={indice}
              onChange={irAIndice}
              textColor="rgba(244, 248, 238, 0.38)"
              activeColor="#F4F8EE"
              side={compacto ? "center" : "right"}
              fontSize={compacto ? 1.6 : notebook ? 2.25 : 3.5}
              spacing={compacto ? 1.55 : notebook ? 1.28 : 1.35}
              curve={compacto ? 0 : notebook ? 0.7 : 1}
              tilt={reducido || compacto ? 0 : notebook ? 4 : 6}
              blur={reducido ? 0 : compacto ? 0.9 : notebook ? 1.4 : 2.2}
              fade={reducido ? 0.35 : compacto ? 0.28 : notebook ? 0.24 : 0.22}
              smoothing={reducido || compacto ? 40 : 180}
              inset={compacto ? 0 : notebook ? 16 : 28}
              loop={false}
              draggable={!compacto}
              capturarRueda={false}
              ariaLabel="Beneficios de ENFLORA"
            />
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}
