"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { NavegacionAdmin } from "@/componentes/admin/navegacion-admin";
import { SalirExpo } from "@/componentes/expo-admin/salir-expo";

function suscribirAncho(callback) {
  const media = window.matchMedia("(max-width: 900px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function esMovil() {
  return window.matchMedia("(max-width: 900px)").matches;
}

export function CascaronAdmin({ secciones, children }) {
  const ruta = usePathname();
  const movil = useSyncExternalStore(suscribirAncho, esMovil, () => false);
  const [abierto, setAbierto] = useState(false);
  const [rutaMenu, setRutaMenu] = useState(ruta);
  const idNav = useId();

  if (ruta !== rutaMenu) {
    setRutaMenu(ruta);
    setAbierto(false);
  }

  useEffect(() => {
    if (!abierto) return undefined;
    function cerrar(evento) {
      if (evento.key === "Escape") setAbierto(false);
    }
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [abierto]);

  return (
    <div className="admin-app">
      <header className="admin-app__barra">
        <button
          type="button"
          className="admin-app__menu"
          aria-expanded={abierto}
          aria-controls={idNav}
          onClick={() => setAbierto((valor) => !valor)}
        >
          {abierto ? <X size={20} strokeWidth={2.2} aria-hidden="true" /> : <Menu size={20} strokeWidth={2.2} aria-hidden="true" />}
          <span>{abierto ? "Cerrar" : "Menú"}</span>
        </button>
        <p className="admin-app__barra-titulo">Administración</p>
      </header>

      {abierto ? (
        <button
          type="button"
          className="admin-app__cortina"
          aria-label="Cerrar menú"
          onClick={() => setAbierto(false)}
        />
      ) : null}

      <aside
        id={idNav}
        className={abierto ? "admin-app__lateral admin-app__lateral--abierto" : "admin-app__lateral"}
        inert={movil && !abierto ? true : undefined}
      >
        <div className="admin-app__marca">
          <SalirExpo />
          <p className="admin-app__kicker">Administración</p>
        </div>
        <NavegacionAdmin secciones={secciones} onNavegar={() => setAbierto(false)} />
      </aside>

      <div className="admin-app__contenido">{children}</div>
    </div>
  );
}
