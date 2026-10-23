"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "motion/react";
import { IconoNavegacion } from "@/componentes/icono-navegacion";
import { toque, transicionRapida, transicionToque } from "@/lib/animaciones";
import { DESTINOS_NAVEGACION, destinoActivo, esRutaApp } from "@/lib/navegacion";

const Enlace = motion.create(Link);

export function BottomNav({ oculto = false }) {
  const ruta = usePathname();

  if (oculto || !esRutaApp(ruta)) return null;

  return (
    <LayoutGroup id="bottom-nav">
      <nav className="bottom-nav" aria-label="Secciones">
        <ul>
          {DESTINOS_NAVEGACION.map((destino) => {
            const activo = destinoActivo(ruta, destino);
            return (
              <li key={destino.clave}>
                <Enlace
                  href={destino.href}
                  className={`bottom-nav__item${activo ? " bottom-nav__item--activo" : ""}`}
                  aria-current={activo ? "page" : undefined}
                  whileTap={toque}
                  whileFocus={{ scale: 1.02 }}
                  transition={transicionToque}
                >
                  <span className="bottom-nav__icono">
                    {activo ? (
                      <motion.span
                        className="bottom-nav__indicador"
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
      </nav>
    </LayoutGroup>
  );
}
