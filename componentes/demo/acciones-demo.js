"use client";

import { useState } from "react";
import { Boton, EnlaceBoton } from "@/componentes/boton";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { useDemo } from "@/componentes/demo/proveedor-demo";

export function AccionesDemo() {
  const { estado, reiniciar } = useDemo();
  const [confirmando, setConfirmando] = useState(false);
  const tieneDatos = estado.espacios.length > 0;

  function pedirReinicio() {
    if (tieneDatos) setConfirmando(true);
    else reiniciar();
  }

  return (
    <aside className="demo__pie" aria-labelledby="demo-pie-titulo">
      <h2 className="demo__pie-titulo" id="demo-pie-titulo">
        ¿Te gustó la demo?
      </h2>
      <p className="demo__pie-texto">Registrate ahora y organizá tu cultivo.</p>
      <EnlaceBoton href="/registro" className="boton--ancho demo__pie-cta">
        Crear mi cuenta gratis
      </EnlaceBoton>
      <div className="demo__pie-fila">
        <Boton type="button" variante="ghost" className="demo__pie-boton" onClick={pedirReinicio}>
          Reiniciar
        </Boton>
        <EnlaceBoton href="/#producto" variante="ghost" className="demo__pie-boton">
          Volver a Enflora
        </EnlaceBoton>
      </div>
      <ModalConfirmacion
        abierto={confirmando}
        onCerrar={() => setConfirmando(false)}
        titulo="¿Reiniciar la demo?"
        descripcion="Se van a borrar los espacios, plantas y registros simulados de esta sesión."
        textoConfirmar="Reiniciar"
        varianteConfirmar="destructivo"
        onConfirmar={() => {
          setConfirmando(false);
          reiniciar();
        }}
      />
    </aside>
  );
}
