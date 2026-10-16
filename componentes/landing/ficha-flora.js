"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

function esModoAuto() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(max-width: 63.99rem)").matches ||
    window.matchMedia("(hover: none)").matches
  );
}

function medirExceso(pista, contenedor) {
  const fase = pista.dataset.fase || "reposo";
  pista.dataset.fase = "medida";
  const exceso = pista.scrollWidth - contenedor.clientWidth;
  pista.dataset.fase = fase;
  return exceso;
}

function ValorDesbordable({ valor, activo }) {
  const pistaRef = useRef(null);
  const activoRef = useRef(false);
  const cancelarRef = useRef(null);
  const reducido = useReducedMotion();

  const detener = useCallback(() => {
    cancelarRef.current?.();
    cancelarRef.current = null;
    activoRef.current = false;
    const pista = pistaRef.current;
    if (!pista) return;
    pista.style.transition = "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)";
    pista.style.transform = "translateX(0)";
    pista.dataset.fase = "reposo";
  }, []);

  const recorrer = useCallback(() => {
    const pista = pistaRef.current;
    if (!pista || reducido || activoRef.current) return;

    const contenedor = pista.parentElement;
    if (!contenedor) return;

    const exceso = medirExceso(pista, contenedor);
    if (exceso <= 0) return;

    let vivo = true;
    cancelarRef.current = () => {
      vivo = false;
    };
    activoRef.current = true;

    const esperarTransicion = () =>
      new Promise((resolve) => {
        const fin = (evento) => {
          if (evento.propertyName !== "transform") return;
          pista.removeEventListener("transitionend", fin);
          resolve();
        };
        pista.addEventListener("transitionend", fin);
      });

    const pausa = (ms) =>
      new Promise((resolve) => {
        window.setTimeout(resolve, ms);
      });

    const ciclo = async () => {
      while (vivo) {
        const ancho = medirExceso(pista, contenedor);
        if (ancho <= 0) break;

        pista.dataset.fase = "ida";
        const duracionIda = Math.max(2.2, ancho / 55);
        pista.style.transition = `transform ${duracionIda}s cubic-bezier(0.22, 1, 0.36, 1)`;
        pista.style.transform = `translateX(${-ancho}px)`;
        await esperarTransicion();
        if (!vivo) break;

        await pausa(400);
        if (!vivo) break;

        pista.dataset.fase = "vuelta";
        pista.style.transition =
          "transform 0.55s cubic-bezier(0.33, 1, 0.68, 1)";
        pista.style.transform = "translateX(0)";
        await esperarTransicion();
        if (!vivo) break;

        pista.dataset.fase = "reposo";
        await pausa(1200);
      }
      activoRef.current = false;
    };

    ciclo();
  }, [reducido]);

  useEffect(() => {
    if (reducido || esModoAuto()) return undefined;
    if (activo) {
      detener();
      recorrer();
    } else {
      detener();
    }
    return undefined;
  }, [activo, reducido, detener, recorrer]);

  useEffect(() => {
    if (reducido) return undefined;

    const pista = pistaRef.current;
    if (!pista) return undefined;

    let observer;

    const arrancarSiCorresponde = () => {
      if (!esModoAuto()) return;
      recorrer();
    };

    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (visible) arrancarSiCorresponde();
        else detener();
      },
      { threshold: 0.35 },
    );
    observer.observe(pista);

    const onResize = () => {
      detener();
      if (esModoAuto()) recorrer();
    };
    window.addEventListener("resize", onResize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
      detener();
    };
  }, [reducido, recorrer, detener]);

  return (
    <dd className="flora-ficha__valor flora-ficha__valor--desbordar" title={valor}>
      <span className="flora-ficha__pista" ref={pistaRef} data-fase="reposo">
        {valor}
      </span>
    </dd>
  );
}

export function FichaFlora({ ficha, protagonista }) {
  const reducido = useReducedMotion();
  const [hoverFicha, setHoverFicha] = useState(false);

  const alEntrar = useCallback(() => {
    if (esModoAuto()) return;
    setHoverFicha(true);
  }, []);

  const alSalir = useCallback(() => {
    if (esModoAuto()) return;
    setHoverFicha(false);
  }, []);

  return (
    <motion.article
      className="flora-ficha"
      initial={reducido ? false : { opacity: 0, y: 16 }}
      whileInView={reducido ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={alEntrar}
      onMouseLeave={alSalir}
      onFocus={alEntrar}
      onBlur={alSalir}
    >
      <div className="flora-ficha__foto">
        <div className="flora-ficha__retrato">
          <Image
            src={protagonista.src}
            alt={protagonista.alt}
            width={protagonista.width}
            height={protagonista.height}
            className="flora-ficha__img"
            sizes="(max-width: 63.99rem) 90vw, 14rem"
          />
        </div>
      </div>
      <div className="flora-ficha__cuerpo">
        <header className="flora-ficha__cabecera">
          <h3 className="flora-ficha__titulo">{ficha.nombre}</h3>
          <p className="flora-ficha__rol">
            <span>{ficha.rol}</span>
            <Image
              className="flora-ficha__logo"
              src={ficha.logo.src}
              alt={ficha.logo.alt}
              width={ficha.logo.width}
              height={ficha.logo.height}
            />
          </p>
        </header>
        <dl className="flora-ficha__lista">
          {ficha.campos.map((campo) => (
            <div className="flora-ficha__fila" key={campo.etiqueta}>
              <dt>{campo.etiqueta}</dt>
              {campo.desbordar ? (
                <ValorDesbordable valor={campo.valor} activo={hoverFicha} />
              ) : (
                <dd>{campo.valor}</dd>
              )}
            </div>
          ))}
        </dl>
      </div>
    </motion.article>
  );
}
