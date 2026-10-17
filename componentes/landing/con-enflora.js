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
const CLIP_PROPS = "clipPath,webkitClipPath";
const COLUMNA_PROPS = "transform,x,y";
const SPREAD_PROPS = "maxWidth,width,flexGrow,flexBasis";

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

function leerPadEscena(escena) {
  const estilos = getComputedStyle(escena);
  return {
    left: Number.parseFloat(estilos.paddingLeft) || 0,
    right: Number.parseFloat(estilos.paddingRight) || 0,
  };
}

function leerPadHeader() {
  const marca = document.querySelector(".encabezado-publico__marca");
  const acceso = document.querySelector(".encabezado-publico__acceso");
  if (!marca || !acceso) {
    const fallback =
      window.matchMedia("(min-width: 64rem) and (max-width: 104.99rem)").matches
        ? window.innerWidth * 0.04
        : window.innerWidth * 0.07;
    return { left: fallback, right: fallback };
  }
  return {
    left: marca.getBoundingClientRect().left,
    right: Math.max(0, window.innerWidth - acceso.getBoundingClientRect().right),
  };
}

function leerSpreadBase(spread) {
  const estilos = getComputedStyle(spread);
  return (
    Number.parseFloat(estilos.maxWidth) ||
    Number.parseFloat(estilos.flexBasis) ||
    Number.parseFloat(estilos.width) ||
    72
  );
}

function clipInset(top, right, bottom, left, radio) {
  if (radio > 0) {
    return `inset(${top}px ${right}px ${bottom}px ${left}px round ${radio}px ${radio}px 0px 0px)`;
  }
  return `inset(${top}px ${right}px ${bottom}px ${left}px)`;
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
  const escenaRef = useRef(null);
  const tituloRef = useRef(null);
  const spreadRef = useRef(null);
  const ruedaRef = useRef(null);
  const ruedaCtrlRef = useRef(null);
  const triggerRef = useRef(null);
  const sincronizandoRef = useRef(false);
  const [compacto, setCompacto] = useState(false);
  const [notebook, setNotebook] = useState(false);
  const [listo, setListo] = useState(false);
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const movil = window.matchMedia("(max-width: 63.99rem)");
    const medio = window.matchMedia("(min-width: 64rem) and (max-width: 119.99rem)");
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
      const escena = escenaRef.current;
      const tituloEl = tituloRef.current;
      const spread = spreadRef.current;
      const ruedaEl = ruedaRef.current;
      if (!nodo || !fondo || !escena || !listo) return undefined;

      const limpiar = () => {
        gsap.set(fondo, { clearProps: `${CLIP_PROPS},top,right,bottom,left,inset,borderRadius` });
        gsap.set(escena, {
          clearProps: `${CLIP_PROPS},top,right,bottom,left,inset,padding,paddingLeft,paddingRight`,
        });
        if (tituloEl) gsap.set(tituloEl, { clearProps: COLUMNA_PROPS });
        if (ruedaEl) gsap.set(ruedaEl, { clearProps: COLUMNA_PROPS });
        if (spread) gsap.set(spread, { clearProps: SPREAD_PROPS });
        gsap.set(nodo, { clearProps: PIN_PROPS });
        triggerRef.current = null;
      };

      if (reducido || compacto) {
        const pad = compacto ? leerPadEscena(escena) : leerPadHeader();
        gsap.set(fondo, {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          borderRadius: 0,
          clipPath: "none",
        });
        gsap.set(escena, {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          paddingLeft: pad.left,
          paddingRight: pad.right,
          clipPath: "none",
        });
        if (spread) gsap.set(spread, { maxWidth: 10000, flexBasis: 0, flexGrow: 1 });
        if (tituloEl) gsap.set(tituloEl, { x: 0 });
        if (ruedaEl) gsap.set(ruedaEl, { x: 0 });
        return limpiar;
      }

      const ultimo = Math.max(frases.length - 1, 1);
      const leidos = leerInsets(nodo);
      const insetsInicial = { top: 0, right: leidos.right, bottom: 0, left: leidos.left };
      const radioInicial = 40;
      const padInicial = leerPadEscena(escena);
      const padFinal = leerPadHeader();
      const spreadBase = spread ? leerSpreadBase(spread) : 0;
      const clipInicial = clipInset(
        insetsInicial.top,
        insetsInicial.right,
        insetsInicial.bottom,
        insetsInicial.left,
        radioInicial,
      );
      const clipFinal = clipInset(0, 0, 0, 0, 0);

      gsap.set(fondo, {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        borderRadius: 0,
        clipPath: clipInicial,
        force3D: true,
      });

      gsap.set(escena, {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        paddingLeft: padFinal.left,
        paddingRight: padFinal.right,
        clipPath: clipInicial,
        force3D: true,
      });

      let tituloX0 = 0;
      let ruedaX0 = 0;

      if (spread && tituloEl && ruedaEl) {
        gsap.set(spread, {
          maxWidth: 10000,
          flexBasis: 0,
          flexGrow: 1,
        });

        const padOrigenL = insetsInicial.left + padInicial.left;
        const padOrigenR = insetsInicial.right + padInicial.right;
        const anchoOrigen = Math.max(0, window.innerWidth - padOrigenL - padOrigenR);
        const grupo = tituloEl.offsetWidth + spreadBase + ruedaEl.offsetWidth;
        const origenCentro = padOrigenL + anchoOrigen / 2;
        const tituloFinalLeft = tituloEl.getBoundingClientRect().left;
        const ruedaFinalLeft = ruedaEl.getBoundingClientRect().left;
        const tituloInicialLeft = origenCentro - grupo / 2;
        const ruedaInicialLeft = origenCentro + grupo / 2 - ruedaEl.offsetWidth;
        tituloX0 = tituloInicialLeft - tituloFinalLeft;
        ruedaX0 = ruedaInicialLeft - ruedaFinalLeft;

        gsap.set(tituloEl, { x: tituloX0, force3D: true });
        gsap.set(ruedaEl, { x: ruedaX0, force3D: true });
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: nodo,
          start: "top top",
          end: () => `+=${Math.round(window.innerHeight * 3.5)}`,
          pin: true,
          pinType: "fixed",
          scrub: 0.7,
          anticipatePin: 1,
          fastScrollEnd: false,
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
        { clipPath: clipInicial },
        {
          clipPath: clipFinal,
          duration: EXPANDIR_HASTA,
          ease: "none",
          immediateRender: true,
        },
        0,
      );

      tl.fromTo(
        escena,
        { clipPath: clipInicial },
        {
          clipPath: clipFinal,
          duration: EXPANDIR_HASTA,
          ease: "none",
          immediateRender: true,
        },
        0,
      );

      if (tituloEl && ruedaEl) {
        tl.fromTo(
          tituloEl,
          { x: tituloX0 },
          {
            x: 0,
            duration: EXPANDIR_HASTA,
            ease: "none",
            immediateRender: true,
            force3D: true,
          },
          0,
        );
        tl.fromTo(
          ruedaEl,
          { x: ruedaX0 },
          {
            x: 0,
            duration: EXPANDIR_HASTA,
            ease: "none",
            immediateRender: true,
            force3D: true,
          },
          0,
        );
      }

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
    if (sincronizandoRef.current || compacto) return;
    setIndice(idx);
    const trigger = triggerRef.current;
    if (!trigger || reducido) return;
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
    <div className="con-enflora" id="con-enflora" data-logo="light" ref={ref}>
      <div className="con-enflora__fondo" ref={fondoRef} aria-hidden="true">
        <div className="con-enflora__media" />
      </div>
      <div className="con-enflora__escena" ref={escenaRef}>
        <div className="con-enflora__titulo" ref={tituloRef}>
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
        <div className="con-enflora__spread" ref={spreadRef} aria-hidden="true" />
        {!compacto ? (
          <div className="con-enflora__rueda" ref={ruedaRef}>
            <motion.div
              className="con-enflora__rueda-entrada"
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
                  ref={ruedaCtrlRef}
                  items={frases}
                  defaultSelected={0}
                  indice={indice}
                  onChange={irAIndice}
                  textColor="rgba(244, 248, 238, 0.38)"
                  activeColor="#F4F8EE"
                  side="right"
                  fontSize={notebook ? 2.45 : 3.5}
                  spacing={notebook ? 1.3 : 1.35}
                  curve={notebook ? 0.65 : 1}
                  tilt={reducido ? 0 : notebook ? 4 : 6}
                  blur={reducido ? 0 : notebook ? 1.35 : 2.2}
                  fade={reducido ? 0.35 : notebook ? 0.24 : 0.22}
                  smoothing={reducido ? 40 : 180}
                  inset={notebook ? 8 : 28}
                  loop={false}
                  draggable
                  snapAlSoltar
                  inercia={false}
                  capturarRueda={false}
                  ariaLabel="Beneficios de ENFLORA"
                />
              ) : null}
            </motion.div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
