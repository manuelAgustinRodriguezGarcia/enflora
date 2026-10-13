"use client";

import { useState } from "react";
import { Aparecer } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { FormularioPlanta } from "@/componentes/formulario-planta";

export function PanelAgregarPlanta({ unidadId, siguienteNumero, metodosPersonalizados }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="agregar-planta">
      {!abierto ? (
        <Boton type="button" onClick={() => setAbierto(true)}>
          + Agregar planta
        </Boton>
      ) : null}
      <Aparecer visible={abierto}>
        <div className="agregar-planta__panel">
          <FormularioPlanta
            unidadId={unidadId}
            siguienteNumero={siguienteNumero}
            metodosPersonalizados={metodosPersonalizados}
            onCancelar={() => setAbierto(false)}
          />
        </div>
      </Aparecer>
    </div>
  );
}
