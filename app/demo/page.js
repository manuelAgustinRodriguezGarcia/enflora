"use client";

import { useEffect } from "react";
import { Bienvenida } from "@/componentes/demo/bienvenida";
import { CrearEspacio } from "@/componentes/demo/crear-espacio";
import { NavegacionDemo } from "@/componentes/demo/navegacion-demo";
import { useDemo } from "@/componentes/demo/proveedor-demo";
import { VistaEspacio } from "@/componentes/demo/vista-espacio";
import { VistaEspacios } from "@/componentes/demo/vista-espacios";
import { VistaHistorial } from "@/componentes/demo/vista-historial";
import { VistaPlanta } from "@/componentes/demo/vista-planta";
import { VistaRegistros } from "@/componentes/demo/vista-registros";
import { VistaUnidad } from "@/componentes/demo/vista-unidad";
import { SpinnerCarga } from "@/componentes/spinner-carga";

const VISTAS = {
  crear: CrearEspacio,
  cultivos: VistaEspacios,
  espacio: VistaEspacio,
  unidad: VistaUnidad,
  planta: VistaPlanta,
  registros: VistaRegistros,
  historial: VistaHistorial,
};

export default function PaginaDemo() {
  const { estado, listo } = useDemo();
  const { espacioId, unidadId, plantaId } = estado.navegacion;
  const pantalla = `${estado.fase}:${espacioId}:${unidadId}:${plantaId}`;

  useEffect(() => {
    if (listo) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [listo, pantalla]);

  if (!listo) {
    return (
      <div className="demo demo__espera">
        <SpinnerCarga />
      </div>
    );
  }

  const Vista = VISTAS[estado.fase];
  if (!Vista) return <Bienvenida />;

  return (
    <>
      <Vista />
      <NavegacionDemo />
    </>
  );
}
