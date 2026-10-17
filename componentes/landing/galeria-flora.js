"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const CONSULTA_MOBILE = "(max-width: 47.99rem)";

function modulo(valor, total) {
  return ((valor % total) + total) % total;
}

function ItemGaleria({ item, reducido, indice, className, itemRef }) {
  return (
    <motion.li
      ref={itemRef}
      className={className}
      initial={reducido ? false : { opacity: 0, y: 16 }}
      whileInView={reducido ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{
        duration: 0.4,
        delay: reducido ? 0 : Math.min(indice, 2) * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="flora-galeria__marco">
        <Image
          src={item.src}
          alt={item.alt}
          width={item.width}
          height={item.height}
          className="flora-galeria__img"
          sizes="(max-width: 47.99rem) 72vw, 28vw"
          draggable={false}
        />
      </div>
      <p className="flora-galeria__caption">{item.caption}</p>
    </motion.li>
  );
}

function CarruselMobile({ items, reducido }) {
  const total = items.length;
  const bucle = useMemo(
    () =>
      total
        ? [
            ...items.map((item, i) => ({ ...item, clave: `a-${item.id}-${i}` })),
            ...items.map((item, i) => ({ ...item, clave: `b-${item.id}-${i}` })),
            ...items.map((item, i) => ({ ...item, clave: `c-${item.id}-${i}` })),
          ]
        : [],
    [items, total],
  );

  const marcoRef = useRef(null);
  const pistaRef = useRef(null);
  const itemRefs = useRef([]);
  const arrastre = useRef(null);
  const saltando = useRef(false);
  const [indice, setIndice] = useState(total);
  const [desfase, setDesfase] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const [sinTransicion, setSinTransicion] = useState(false);
  const [paso, setPaso] = useState(0);
  const [origen, setOrigen] = useState(0);

  const medir = useCallback(() => {
    const marco = marcoRef.current;
    const primero = itemRefs.current[0];
    const pista = pistaRef.current;
    if (!marco || !primero || !pista) return;
    const anchoItem = primero.getBoundingClientRect().width;
    const gap = Number.parseFloat(getComputedStyle(pista).gap) || 0;
    setPaso(anchoItem + gap);
    setOrigen(marco.clientWidth / 2 - anchoItem / 2);
  }, []);

  useLayoutEffect(() => {
    medir();
  }, [medir, bucle.length]);

  useEffect(() => {
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [medir]);

  const normalizarIndice = useCallback(
    (valor) => {
      if (!total) return 0;
      let siguiente = valor;
      if (siguiente < total) siguiente += total;
      else if (siguiente >= total * 2) siguiente -= total;
      return siguiente;
    },
    [total],
  );

  useEffect(() => {
    const pista = pistaRef.current;
    if (!pista || !total) return undefined;

    const alTerminar = (evento) => {
      if (evento.target !== pista || evento.propertyName !== "transform") return;
      if (arrastrando || saltando.current) return;
      if (indice >= total && indice < total * 2) return;

      saltando.current = true;
      setSinTransicion(true);
      setIndice(normalizarIndice(indice));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSinTransicion(false);
          saltando.current = false;
        });
      });
    };

    pista.addEventListener("transitionend", alTerminar);
    return () => pista.removeEventListener("transitionend", alTerminar);
  }, [indice, total, arrastrando, normalizarIndice]);

  const x = origen - indice * paso + desfase;
  const activoLogico = modulo(indice, total);

  const alPointerDown = (evento) => {
    if (evento.pointerType === "mouse" && evento.button !== 0) return;
    arrastre.current = {
      origenX: evento.clientX,
      ultimoX: evento.clientX,
      ultimoT: performance.now(),
      velocidad: 0,
    };
    setDesfase(0);
    setArrastrando(true);
    evento.currentTarget.setPointerCapture(evento.pointerId);
  };

  const alPointerMove = (evento) => {
    const estado = arrastre.current;
    if (!estado) return;
    const ahora = performance.now();
    const dt = Math.max(ahora - estado.ultimoT, 1);
    estado.velocidad = ((evento.clientX - estado.ultimoX) / dt) * 1000;
    estado.ultimoX = evento.clientX;
    estado.ultimoT = ahora;
    setDesfase(evento.clientX - estado.origenX);
  };

  const alPointerUp = () => {
    const estado = arrastre.current;
    if (!estado || !paso || !total) {
      arrastre.current = null;
      setArrastrando(false);
      setDesfase(0);
      return;
    }

    const base = origen - indice * paso;
    const proyectado = base + (estado.ultimoX - estado.origenX) + estado.velocidad * 0.18;
    const crudo = Math.round((origen - proyectado) / paso);
    arrastre.current = null;
    setArrastrando(false);
    setDesfase(0);
    setIndice(crudo);
  };

  return (
    <div className="flora-galeria__carrusel" ref={marcoRef}>
      <ul
        className={`flora-galeria__pista flora-galeria__pista--carrusel${arrastrando || sinTransicion ? " flora-galeria__pista--arrastre" : ""}`}
        ref={pistaRef}
        style={{ transform: `translate3d(${x}px, 0, 0)` }}
        onPointerDown={alPointerDown}
        onPointerMove={alPointerMove}
        onPointerUp={alPointerUp}
        onPointerCancel={alPointerUp}
      >
        {bucle.map((item, i) => (
          <ItemGaleria
            key={item.clave}
            item={item}
            reducido={reducido}
            indice={i}
            itemRef={(nodo) => {
              itemRefs.current[i] = nodo;
            }}
            className={`flora-galeria__item${item.cutout ? " flora-galeria__item--cutout" : ""}${modulo(i, total) === activoLogico ? " flora-galeria__item--activo" : ""}`}
          />
        ))}
      </ul>
    </div>
  );
}

export function GaleriaFlora({ galeria }) {
  const reducido = useReducedMotion();
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_MOBILE);
    const sincronizar = () => setMobile(consulta.matches);
    sincronizar();
    consulta.addEventListener("change", sincronizar);
    return () => consulta.removeEventListener("change", sincronizar);
  }, []);

  return (
    <div className="flora-galeria">
      <motion.div
        className="flora-galeria__cabecera"
        initial={reducido ? false : { opacity: 0, y: 14 }}
        whileInView={reducido ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <h3 className="flora-galeria__titulo">{galeria.titulo}</h3>
        <p className="flora-galeria__bajada">{galeria.bajada}</p>
      </motion.div>

      {mobile ? (
        <CarruselMobile
          key={galeria.items.map((item) => item.id).join("-")}
          items={galeria.items}
          reducido={reducido}
        />
      ) : (
        <ul className="flora-galeria__pista">
          {galeria.items.map((item, indice) => (
            <ItemGaleria
              key={item.id}
              item={item}
              reducido={reducido}
              indice={indice}
              className={`flora-galeria__item${item.cutout ? " flora-galeria__item--cutout" : ""}`}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
