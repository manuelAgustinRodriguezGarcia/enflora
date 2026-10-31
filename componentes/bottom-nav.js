"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { IconoNavegacion } from "@/componentes/icono-navegacion";
import { toque, transicionRapida, transicionToque } from "@/lib/animaciones";
import { DESTINOS_NAVEGACION, destinoActivo, esRutaApp } from "@/lib/navegacion";

const Enlace = motion.create(Link);

export function BottomNav({ oculto = false }) {
  const ruta = usePathname();
  const [destinoPendiente, setDestinoPendiente] = useState(null);

  useEffect(() => {
    setDestinoPendiente(null);
  }, [ruta]);

  if (oculto || !esRutaApp(ruta)) return null;

  return (
    <LayoutGroup id="bottom-nav">
      <nav className="bottom-nav" aria-label="Secciones">
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
          </ul>
        </div>
      </nav>
    </LayoutGroup>
  );
}
