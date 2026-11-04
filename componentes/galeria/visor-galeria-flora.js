"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { urlFotoOriginal } from "@/app/registros/acciones";
import { IconoNavegacion } from "@/componentes/icono-navegacion";
import { etiquetaFotoGaleria, hrefRegistroGaleria, textoFechaGaleria, textoLugarGaleria } from "@/lib/galeria-flora";

function cajaDeLaFoto(slideEl) {
  const img = slideEl.querySelector(".yarl__slide_image");
  if (!img?.offsetWidth || !img?.offsetHeight) return null;
  let left = 0;
  let top = 0;
  let nodo = img;
  while (nodo && nodo !== slideEl) {
    left += nodo.offsetLeft;
    top += nodo.offsetTop;
    const padre = nodo.offsetParent;
    if (!(padre instanceof HTMLElement) || !slideEl.contains(padre)) break;
    nodo = padre;
  }
  return { left, top: top + img.offsetHeight, width: img.offsetWidth };
}

function medidaContenida(ancho, alto, marco) {
  if (!ancho || !alto || !marco?.width || !marco?.height) return null;
  const escala = Math.min(marco.width / ancho, marco.height / alto, 1);
  return { width: Math.max(1, Math.round(ancho * escala)), height: Math.max(1, Math.round(alto * escala)) };
}

function FotoVisor({ slide, rect, fuente }) {
  const foto = slide.foto || {};
  const miniatura = foto.url_miniatura || "";
  const original = fuente?.lista ? fuente.url : "";
  const [nitida, setNitida] = useState(false);
  const originalRef = useRef(null);
  const medida = medidaContenida(foto.ancho, foto.alto, rect) || (rect?.width && rect?.height ? { width: rect.width, height: rect.height } : null);
  const origen = useRef(original);

  if (origen.current !== original) {
    origen.current = original;
    if (nitida) setNitida(false);
  }

  useEffect(() => {
    const nodo = originalRef.current;
    if (!nodo || !original) return undefined;
    const mostrar = () => setNitida(true);
    if (nodo.complete && nodo.naturalWidth) mostrar();
    nodo.addEventListener("load", mostrar);
    return () => nodo.removeEventListener("load", mostrar);
  }, [original]);

  if (!miniatura && !original) {
    return <span className="galeria-flora-visor__espera" role="status" aria-label="Cargando foto" />;
  }

  return (
    <span className="galeria-flora-visor__marco" style={medida || undefined}>
      {miniatura ? (
        <img className="yarl__slide_image" src={miniatura} alt={original ? "" : slide.alt || ""} aria-hidden={original ? true : undefined} draggable={false} />
      ) : null}
      {original ? (
        <img
          className="yarl__slide_image galeria-flora-visor__nitida"
          src={original}
          alt={slide.alt || ""}
          draggable={false}
          style={{ opacity: nitida ? 1 : 0 }}
          ref={originalRef}
          onLoad={() => setNitida(true)}
        />
      ) : null}
    </span>
  );
}

function PieVisor({ slide, fecha, lugar, href, fallo }) {
  const ref = useRef(null);
  const [caja, setCaja] = useState(null);

  useEffect(() => {
    const nodo = ref.current?.closest(".yarl__slide");
    if (!nodo) return undefined;
    let vigente = true;
    const medir = () => {
      if (!vigente) return;
      const siguiente = cajaDeLaFoto(nodo);
      if (!siguiente) return;
      setCaja((actual) => {
        if (
          actual &&
          Math.abs(actual.left - siguiente.left) < 0.5 &&
          Math.abs(actual.top - siguiente.top) < 0.5 &&
          Math.abs(actual.width - siguiente.width) < 0.5
        ) {
          return actual;
        }
        return siguiente;
      });
    };
    const marco = nodo.querySelector(".yarl__slide_wrapper");
    const img = nodo.querySelector(".yarl__slide_image");
    const observador = new ResizeObserver(medir);
    if (marco) observador.observe(marco);
    img?.addEventListener("load", medir);
    const frame = requestAnimationFrame(medir);
    return () => {
      vigente = false;
      cancelAnimationFrame(frame);
      observador.disconnect();
      img?.removeEventListener("load", medir);
    };
  }, [slide]);

  return (
    <div
      ref={ref}
      className="galeria-flora-visor__pie"
      style={caja ? { left: caja.left, width: caja.width, top: caja.top, right: "auto", bottom: "auto" } : undefined}
    >
      {fecha ? (
        <time className="galeria-flora-visor__pill" dateTime={slide.foto?.fecha_evento}>
          {fecha}
        </time>
      ) : null}
      {lugar ? <span className="galeria-flora-visor__pill">{lugar}</span> : null}
      {fallo ? <span className="galeria-flora-visor__pill">No se pudo ampliar</span> : null}
      {href ? (
        <Link className="galeria-flora-visor__pill galeria-flora-visor__registro" href={href}>
          <IconoNavegacion clave="historial" />
          Ver registro
        </Link>
      ) : null}
    </div>
  );
}

const FOTO_AUSENTE =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"></svg>');

function precargarImagen(url) {
  return new Promise((resolve) => {
    const imagen = new Image();
    imagen.onload = () => resolve(true);
    imagen.onerror = () => resolve(false);
    imagen.src = url;
  });
}

function indicesVecinos(indice, cantidad) {
  return [indice - 1, indice, indice + 1].filter((item) => item >= 0 && item < cantidad);
}

export function VisorGaleriaFlora({ fotos = [], indice = 0, onCerrar, onIndice, onPedirMas }) {
  const [fuentes, setFuentes] = useState({});
  const fuentesRef = useRef(fuentes);
  const fotoActual = fotos[indice] || null;

  useEffect(() => {
    fuentesRef.current = fuentes;
  }, [fuentes]);

  useEffect(() => {
    let vigente = true;
    for (const posicion of indicesVecinos(indice, fotos.length)) {
      const foto = fotos[posicion];
      if (!foto?.id) continue;
      const actual = fuentesRef.current[foto.id];
      if (actual?.lista && actual.expira > Date.now() + 20_000) continue;
      if (actual?.error) continue;
      urlFotoOriginal(foto.id)
        .then(async (respuesta) => {
          if (!vigente) return;
          if (!respuesta?.url) {
            setFuentes((previo) => ({ ...previo, [foto.id]: { error: true } }));
            return;
          }
          const lista = await precargarImagen(respuesta.url);
          if (!vigente) return;
          setFuentes((previo) => ({
            ...previo,
            [foto.id]: lista
              ? { url: respuesta.url, lista: true, expira: Date.now() + 9 * 60 * 1000 }
              : { error: true },
          }));
        })
        .catch(() => {
          if (!vigente) return;
          setFuentes((previo) => ({ ...previo, [foto.id]: { error: true } }));
        });
    }
    return () => {
      vigente = false;
    };
  }, [indice, fotos]);

  const slides = useMemo(
    () =>
      fotos.map((foto) => {
        const fuente = fuentes[foto.id];
        const src = fuente?.lista ? fuente.url : foto.url_miniatura || FOTO_AUSENTE;
        return {
          src,
          alt: etiquetaFotoGaleria(foto).replace(/^Ver /, ""),
          width: foto.ancho || undefined,
          height: foto.alto || undefined,
          imageFit: "contain",
          foto,
        };
      }),
    [fotos, fuentes],
  );

  if (!fotoActual || slides.length === 0) return null;

  const fecha = textoFechaGaleria(fotoActual.fecha_evento);
  const href = hrefRegistroGaleria(fotoActual.registro_id);
  const fallo = Boolean(fuentes[fotoActual.id]?.error);
  const lugar = textoLugarGaleria(fotoActual);

  return (
    <Lightbox
      open
      index={indice}
      slides={slides}
      plugins={[Zoom]}
      close={onCerrar}
      className="galeria-flora-visor"
      carousel={{ finite: true, imageFit: "contain", preload: 1, padding: "16px" }}
      controller={{ closeOnBackdropClick: true, closeOnEscape: true }}
      noScroll={{ disabled: false }}
      zoom={{ scrollToZoom: true, maxZoomPixelRatio: 3, doubleClickMaxStops: 2 }}
      labels={{
        Close: "Cerrar",
        Previous: "Foto anterior",
        Next: "Foto siguiente",
        Lightbox: "Visor de Galería de Flora",
        "{index} of {total}": "{index} de {total}",
      }}
      styles={{
        root: { "--yarl__portal_zindex": "400" },
        container: {
          backgroundColor: "rgb(11 61 42 / 55%)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        },
      }}
      on={{
        view: ({ index: siguiente }) => {
          onIndice?.(siguiente);
          if (siguiente >= fotos.length - 3) onPedirMas?.();
        },
      }}
      render={{
        buttonZoom: () => null,
        slide: ({ slide, rect }) => <FotoVisor slide={slide} rect={rect} fuente={fuentes[slide.foto?.id]} />,
        slideFooter: ({ slide }) =>
          slide?.foto?.id === fotoActual.id ? (
            <PieVisor slide={slide} fecha={fecha} lugar={lugar} href={href} fallo={fallo} />
          ) : null,
      }}
    />
  );
}
