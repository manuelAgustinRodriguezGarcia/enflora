"use client";

import { useActionState, useState } from "react";
import { cambiarEtapa } from "@/app/espacios/[id]/acciones";
import { Aparecer } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { SelectorEtapa } from "@/componentes/selector-etapa";
import { fechaHoy } from "@/lib/etapas";

export function CambiarEtapa({ plantaId, unidadId, espacioId, children }) {
  const [abierto, setAbierto] = useState(false);
  const [resultado, accion, pendiente] = useActionState(cambiarEtapa, null);
  const [fecha, setFecha] = useState(fechaHoy);
  const [etapa, setEtapa] = useState("");

  return (
    <>
      <div className="acciones">
        {children}
        <Boton type="button" onClick={() => setAbierto((actual) => !actual)}>
          Cambiar etapa
        </Boton>
      </div>
      <Aparecer visible={abierto}>
        <form className="formulario" action={accion}>
          {resultado?.error ? <p className="formulario__error">{resultado.error}</p> : null}
          <input type="hidden" name="planta_id" value={plantaId} />
          <input type="hidden" name="unidad_id" value={unidadId} />
          <input type="hidden" name="espacio_id" value={espacioId} />
          <SelectorEtapa
            leyenda="Nueva etapa"
            nombre="etapa"
            valor={etapa}
            onChange={setEtapa}
          />
          <label className="formulario__campo">
            Fecha de inicio
            <input type="date" name="fecha_inicio" value={fecha} onChange={(evento) => setFecha(evento.target.value)} />
          </label>
          <Boton type="submit" disabled={pendiente}>
            Guardar
          </Boton>
        </form>
      </Aparecer>
    </>
  );
}
