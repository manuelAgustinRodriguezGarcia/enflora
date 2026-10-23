"use client";

import { Boton, EnlaceBoton } from "@/componentes/boton";

export const AVISO_DATOS_DEMO = "Los datos de esta demostración no se transferirán a tu cuenta.";

export function Conversion({ onSeguir }) {
  return (
    <aside className="tarjeta demo-conversion" aria-labelledby="demo-conversion-titulo">
      <h2 className="demo-conversion__titulo" id="demo-conversion-titulo">
        ¿Te imaginás seguir tus propios cultivos así?
      </h2>
      <p className="demo-conversion__texto">
        Creá tu cuenta en Enflora y empezá a organizar tus espacios, registrar actividades y conocer mejor la
        evolución de tus plantas.
      </p>
      <div className="demo__acciones">
        <EnlaceBoton href="/registro" className="boton--ancho">
          Crear mi cuenta gratis
        </EnlaceBoton>
        <Boton type="button" variante="secundario" className="boton--ancho" onClick={onSeguir}>
          Seguir probando
        </Boton>
      </div>
      <p className="demo__aviso">{AVISO_DATOS_DEMO}</p>
    </aside>
  );
}
