"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { IconoNavegacion } from "@/componentes/icono-navegacion";
import { toque, transicionRapida, transicionToque } from "@/lib/animaciones";
import { DESTINOS_MAS, DESTINOS_NAVEGACION, destinoActivo, esRutaApp } from "@/lib/navegacion";

const Enlace = motion.create(Link);
const CURVA_PANEL = [0.22, 1, 0.36, 1];

export function BottomNav({ oculto = false }) {
  const ruta = usePathname();
  const reducido = useReducedMotion();
  const [destinoPendiente, setDestinoPendiente] = useState(null);
  const [masAbierto, setMasAbierto] = useState(false);
  const panelId = useId();
  const tituloId = useId();
  const masRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    setDestinoPendiente(null);
    setMasAbierto(false);
  }, [ruta]);

  useEffect(() => {
    if (!masAbierto) return undefined;

    const panel = panelRef.current;
    const cerrar = panel?.querySelector("[data-cerrar-mas]");
    if (cerrar instanceof HTMLElement) cerrar.focus();

    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const enfocar = (evento) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        setMasAbierto(false);
        masRef.current?.focus();
        return;
      }
      if (evento.key !== "Tab" || !panel) return;
      const focos = [...panel.querySelectorAll("a, button")];
      const primero = focos[0];
      const ultimo = focos[focos.length - 1];
      if (!primero || !ultimo) return;
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener("keydown", enfocar);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", enfocar);
    };
  }, [masAbierto]);

  if (oculto || !esRutaApp(ruta)) return null;

  const masActivo = DESTINOS_MAS.some((destino) => destinoActivo(ruta, destino));
  const transicionPanel = reducido ? { duration: 0.01 } : { duration: 0.34, ease: CURVA_PANEL };

  return (
    <LayoutGroup id="bottom-nav">
      <nav className="bottom-nav" aria-label="Secciones">
        <AnimatePresence>
          {masAbierto ? (
            <motion.div
              key="velo-mas"
              className="bottom-nav__velo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transicionPanel}
              onClick={() => setMasAbierto(false)}
            />
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {masAbierto ? (
            <motion.div
              key="panel-mas"
              ref={panelRef}
              id={panelId}
              className="bottom-nav__panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby={tituloId}
              initial={reducido ? { opacity: 0 } : { opacity: 0, y: "100%" }}
              animate={reducido ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reducido ? { opacity: 0 } : { opacity: 0, y: "100%" }}
              transition={transicionPanel}
            >
              <div className="bottom-nav__panel-cabecera">
                <h2 id={tituloId} className="bottom-nav__panel-titulo">
                  Más
                </h2>
                <button
                  type="button"
                  className="bottom-nav__cerrar"
                  data-cerrar-mas=""
                  aria-label="Cerrar"
                  onClick={() => {
                    setMasAbierto(false);
                    masRef.current?.focus();
                  }}
                >
                  <X size={18} strokeWidth={2.25} aria-hidden="true" />
                </button>
              </div>
              <ul className="bottom-nav__grilla">
                {DESTINOS_MAS.map((destino) => {
                  const activo = destinoActivo(ruta, destino);
                  return (
                    <li key={destino.clave}>
                      <Enlace
                        href={destino.href}
                        className={`bottom-nav__atajo${activo ? " bottom-nav__atajo--activo" : ""}`}
                        aria-current={activo ? "page" : undefined}
                        whileTap={toque}
                        transition={transicionToque}
                        onClick={() => setMasAbierto(false)}
                      >
                        <IconoNavegacion clave={destino.clave} />
                        <span>{destino.etiqueta}</span>
                      </Enlace>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="bottom-nav__capsula">
          <ul>
            {DESTINOS_NAVEGACION.map((destino) => {
              const activo = destinoActivo(ruta, destino);
              const esRegistro = destino.clave === "registro";
              const pendiente = destinoPendiente === destino.clave && !activo;
              const clases = [
                "bottom-nav__item",
                esRegistro ? "bottom-nav__item--registro" : null,
                activo ? "bottom-nav__item--activo" : null,
                esRegistro && activo ? "bottom-nav__item--registro-activo" : null,
                pendiente ? "bottom-nav__item--pendiente" : null,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <li
                  key={destino.clave}
                  className={esRegistro ? "bottom-nav__celda bottom-nav__celda--registro" : "bottom-nav__celda"}
                >
                  <Enlace
                    href={destino.href}
                    className={clases}
                    aria-current={activo ? "page" : undefined}
                    onPointerDown={() => {
                      if (!activo) setDestinoPendiente(destino.clave);
                    }}
                    whileTap={toque}
                    whileFocus={{ scale: 1.02 }}
                    transition={transicionToque}
                  >
                    <span className="bottom-nav__icono">
                      {activo && !esRegistro ? (
                        <motion.span
                          className="bottom-nav__halo"
                          layoutId="bottom-nav-activo"
                          transition={transicionRapida}
                          aria-hidden="true"
                        />
                      ) : null}
                      <IconoNavegacion clave={destino.clave} />
                    </span>
                    <span className="bottom-nav__etiqueta">{destino.etiqueta}</span>
                  </Enlace>
                </li>
              );
            })}
            <li className="bottom-nav__celda">
              <motion.button
                ref={masRef}
                type="button"
                className={[
                  "bottom-nav__item",
                  masActivo ? "bottom-nav__item--activo" : null,
                  masAbierto ? "bottom-nav__item--abierto" : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-expanded={masAbierto}
                aria-controls={panelId}
                aria-haspopup="dialog"
                aria-current={masActivo ? "page" : undefined}
                onClick={() => setMasAbierto((abierto) => !abierto)}
                whileTap={toque}
                whileFocus={{ scale: 1.02 }}
                transition={transicionToque}
              >
                <span className="bottom-nav__icono">
                  {masActivo ? (
                    <motion.span
                      className="bottom-nav__halo"
                      layoutId="bottom-nav-activo"
                      transition={transicionRapida}
                      aria-hidden="true"
                    />
                  ) : null}
                  <IconoNavegacion clave="mas" />
                </span>
                <span className="bottom-nav__etiqueta">Más</span>
              </motion.button>
            </li>
          </ul>
        </div>
      </nav>
    </LayoutGroup>
  );
}
