"use client";

import { LayoutGroup, motion } from "motion/react";
import { IconoNavegacion } from "@/componentes/icono-navegacion";
import { useDemo } from "@/componentes/demo/proveedor-demo";
import { toque, transicionRapida, transicionToque } from "@/lib/animaciones";

const MODULOS_DEMO = [
  { clave: "cultivos", etiqueta: "Cultivos", icono: "cultivos" },
  { clave: "registros", etiqueta: "Registros", icono: "registro" },
  { clave: "historial", etiqueta: "Historial", icono: "historial" },
];

export function NavegacionDemo() {
  const { estado, ir } = useDemo();

  return (
    <LayoutGroup id="demo-nav">
      <nav className="bottom-nav demo-nav" aria-label="Módulos de la demo">
        <ul>
          {MODULOS_DEMO.map((modulo) => {
            const activo = estado.modulo === modulo.clave;
            return (
              <li key={modulo.clave}>
                <motion.button
                  type="button"
                  className={`bottom-nav__item demo-pulsable${activo ? " bottom-nav__item--activo" : ""}`}
                  aria-current={activo ? "page" : undefined}
                  onClick={() => ir(modulo.clave)}
                  whileTap={toque}
                  transition={transicionToque}
                >
                  {activo ? (
                    <motion.span
                      className="bottom-nav__indicador"
                      layoutId="demo-nav-activo"
                      transition={transicionRapida}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="bottom-nav__icono">
                    <IconoNavegacion clave={modulo.icono} />
                  </span>
                  <span className="bottom-nav__etiqueta">{modulo.etiqueta}</span>
                </motion.button>
              </li>
            );
          })}
        </ul>
      </nav>
    </LayoutGroup>
  );
}
