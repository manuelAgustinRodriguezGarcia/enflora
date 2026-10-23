"use client";

import Image, { getImageProps } from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { INSTAGRAM_USUARIO } from "@/lib/seo";

const CONSULTA_MOBILE = "(max-width: 47.99rem)";
const SIZES_GALERIA = "(max-width: 47.99rem) 72vw, 17rem";
const VENTANA_EAGER = 2;
const LOTE_PRECARGA = 2;
const MARGEN_PRECARGA = "480px 0px";
const UMBRAL_EJE = 12;
const RATIO_HORIZONTAL = 1.35;

function modulo(valor, total) {
  return ((valor % total) + total) % total;
}

function propsImagenGaleria(item) {
  return getImageProps({
    src: item.src,
    alt: item.alt,
    width: item.width,
    height: item.height,
    sizes: SIZES_GALERIA,
    quality: 75,
  }).props;
}

function precalentarSrc(item) {
  const props = propsImagenGaleria(item);
  const imagen = new window.Image();
  imagen.decoding = "async";
  if (props.srcSet) imagen.srcset = props.srcSet;
  if (props.sizes) imagen.sizes = props.sizes;
  imagen.src = props.src;
  return imagen.decode?.().catch(() => undefined) ?? Promise.resolve();
}

function ItemGaleria({
  item,
  reducido,
  indice,
  className,
  itemRef,
  eager = false,
  animarEntrada = true,
  prioridad = false,
}) {
  return (
    <motion.li
      ref={itemRef}
      className={className}
      initial={animarEntrada && !reducido ? { opacity: 0, y: 16 } : false}
      whileInView={animarEntrada && !reducido ? { opacity: 1, y: 0 } : undefined}
      animate={!animarEntrada ? { opacity: 1, y: 0 } : undefined}
      viewport={animarEntrada ? { once: true, amount: 0.3 } : undefined}
      transition={{
        duration: 0.4,
        delay: reducido || !animarEntrada ? 0 : Math.min(indice, 2) * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="flora-galeria__post-cabecera">
        <span className="flora-galeria__avatar">
          <Image
            src="/images/flora-landingl-selfie.png"
            alt=""
            width={64}
            height={64}
            sizes="2rem"
            draggable={false}
          />
        </span>
        <span className="flora-galeria__usuario">{INSTAGRAM_USUARIO}</span>
      </div>
      <div className="flora-galeria__marco">
        <div className="flora-galeria__zoom">
          <Image
            src={item.src}
            alt={item.alt}
            width={item.width}
            height={item.height}
            className="flora-galeria__img"
            sizes={SIZES_GALERIA}
            quality={75}
            draggable={false}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={prioridad ? "high" : eager ? "auto" : "low"}
            decoding="async"
          />
        </div>
      </div>
      <p className="flora-galeria__caption">{item.caption}</p>
    </motion.li>
  );
}

function CarruselMobile({ items, reducido, activa }) {
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

  useEffect(() => {
    if (!activa || !items.length) return undefined;
    let cancelado = false;
    const unicos = [];
    const vistos = new Set();
    items.forEach((item) => {
      if (!item?.src || vistos.has(item.src)) return;
      vistos.add(item.src);
      unicos.push(item);
    });

    const calentar = async () => {
      for (let i = 0; i < unicos.length; i += LOTE_PRECARGA) {
        if (cancelado) return;
        const lote = unicos.slice(i, i + LOTE_PRECARGA);
        await Promise.all(lote.map((item) => precalentarSrc(item)));
      }
    };

    let idleId;
    const conIdle = typeof window.requestIdleCallback === "function";
    if (conIdle) {
      idleId = window.requestIdleCallback(() => {
        void calentar();
      }, { timeout: 900 });
    } else {
      idleId = window.setTimeout(() => {
        void calentar();
      }, 120);
    }

    return () => {
      cancelado = true;
      if (conIdle) window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
    };
  }, [activa, items]);

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
      origenY: evento.clientY,
      ultimoX: evento.clientX,
      ultimoT: performance.now(),
      velocidad: 0,
      eje: null,
      pointerId: evento.pointerId,
      nodo: evento.currentTarget,
    };
    setDesfase(0);
  };

  const alPointerMove = (evento) => {
    const estado = arrastre.current;
    if (!estado || estado.pointerId !== evento.pointerId) return;

    const dx = evento.clientX - estado.origenX;
    const dy = evento.clientY - estado.origenY;

    if (estado.eje === null) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < UMBRAL_EJE && absY < UMBRAL_EJE) return;

      if (absY >= absX * RATIO_HORIZONTAL || (absY > absX && absY >= UMBRAL_EJE)) {
        arrastre.current = null;
        setArrastrando(false);
        setDesfase(0);
        return;
      }

      if (absX < absY * RATIO_HORIZONTAL) return;

      estado.eje = "x";
      setArrastrando(true);
      try {
        estado.nodo?.setPointerCapture(evento.pointerId);
      } catch {}
    }

    if (estado.eje !== "x") return;

    const ahora = performance.now();
    const dt = Math.max(ahora - estado.ultimoT, 1);
    estado.velocidad = ((evento.clientX - estado.ultimoX) / dt) * 1000;
    estado.ultimoX = evento.clientX;
    estado.ultimoT = ahora;
    setDesfase(dx);
  };

  const alPointerUp = (evento) => {
    const estado = arrastre.current;
    if (!estado || (evento?.pointerId != null && estado.pointerId !== evento.pointerId)) {
      return;
    }

    if (estado.eje === "x" && estado.nodo) {
      try {
        estado.nodo.releasePointerCapture(estado.pointerId);
      } catch {}
    }

    if (estado.eje !== "x" || !paso || !total) {
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
    <div
      className={`flora-galeria__carrusel${arrastrando ? " flora-galeria__carrusel--arrastre-x" : ""}`}
      ref={marcoRef}
    >
      <ul
        className={`flora-galeria__pista flora-galeria__pista--carrusel${arrastrando || sinTransicion ? " flora-galeria__pista--arrastre" : ""}`}
        ref={pistaRef}
        style={{ transform: `translate3d(${x}px, 0, 0)` }}
        onPointerDown={alPointerDown}
        onPointerMove={alPointerMove}
        onPointerUp={alPointerUp}
        onPointerCancel={alPointerUp}
      >
        {bucle.map((item, i) => {
          const enVentana = Math.abs(i - indice) <= VENTANA_EAGER;
          return (
            <ItemGaleria
              key={item.clave}
              item={item}
              reducido={reducido}
              indice={i}
              eager={enVentana || activa}
              prioridad={i === indice}
              animarEntrada={false}
              itemRef={(nodo) => {
                itemRefs.current[i] = nodo;
              }}
              className={`flora-galeria__item${item.cutout ? " flora-galeria__item--cutout" : ""}${modulo(i, total) === activoLogico ? " flora-galeria__item--activo" : ""}`}
            />
          );
        })}
      </ul>
    </div>
  );
}

export function GaleriaFlora({ galeria }) {
  const reducido = useReducedMotion();
  const raizRef = useRef(null);
  const [mobile, setMobile] = useState(false);
  const [cerca, setCerca] = useState(false);

  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_MOBILE);
    const sincronizar = () => setMobile(consulta.matches);
    sincronizar();
    consulta.addEventListener("change", sincronizar);
    return () => consulta.removeEventListener("change", sincronizar);
  }, []);

  useEffect(() => {
    const nodo = raizRef.current;
    if (!nodo) return undefined;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada?.isIntersecting) setCerca(true);
      },
      { root: null, rootMargin: MARGEN_PRECARGA, threshold: 0.01 },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (!cerca || mobile || !galeria.items?.length) return undefined;
    let cancelado = false;
    const unicos = [];
    const vistos = new Set();
    galeria.items.forEach((item) => {
      if (!item?.src || vistos.has(item.src)) return;
      vistos.add(item.src);
      unicos.push(item);
    });

    const calentar = async () => {
      for (let i = 0; i < unicos.length; i += LOTE_PRECARGA) {
        if (cancelado) return;
        const lote = unicos.slice(i, i + LOTE_PRECARGA);
        await Promise.all(lote.map((item) => precalentarSrc(item)));
      }
    };

    let idleId;
    const conIdle = typeof window.requestIdleCallback === "function";
    if (conIdle) {
      idleId = window.requestIdleCallback(() => {
        void calentar();
      }, { timeout: 1200 });
    } else {
      idleId = window.setTimeout(() => {
        void calentar();
      }, 160);
    }

    return () => {
      cancelado = true;
      if (conIdle) window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
    };
  }, [cerca, mobile, galeria.items]);

  return (
    <div className="flora-galeria" ref={raizRef}>
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
          activa={cerca}
        />
      ) : (
        <ul className="flora-galeria__pista">
          {galeria.items.map((item, indice) => (
            <ItemGaleria
              key={item.id}
              item={item}
              reducido={reducido}
              indice={indice}
              eager={cerca}
              className={`flora-galeria__item${item.cutout ? " flora-galeria__item--cutout" : ""}`}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
