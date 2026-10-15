"use client";

import { motion, useReducedMotion } from "motion/react";
import { useActionState, useState } from "react";
import { cambiarEtapa } from "@/app/espacios/[id]/acciones";
import { Aparecer } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { IconoChevron } from "@/componentes/iconos-ui";
import { SelectorEtapa } from "@/componentes/selector-etapa";
import { SelectorFecha } from "@/componentes/selector-fecha";
import { fechaHoy } from "@/lib/etapas";
import { transicionRapida } from "@/lib/animaciones";

export function CambiarEtapa({ plantaId, unidadId, espacioId, children }) {
  const [abierto, setAbierto] = useState(false);
  const [resultado, accion, pendiente] = useActionState(cambiarEtapa, null);
  const [fecha, setFecha] = useState(fechaHoy);
  const [etapa, setEtapa] = useState("");
  const reducido = useReducedMotion();

  return (
    <>
      <div className="acciones acciones--ancho">
        {children}
        <Boton
          type="button"
          className="boton boton--ancho cambiar-etapa__abrir"
          aria-expanded={abierto}
          onClick={() => setAbierto((actual) => !actual)}
        >
          Cambiar etapa
          <motion.span
            className="cambiar-etapa__chevron"
            animate={{ rotate: abierto ? 180 : 0 }}
            transition={reducido ? { duration: 0 } : transicionRapida}
          >
            <IconoChevron />
          </motion.span>
        </Boton>
      </div>
      <Aparecer visible={abierto}>
        <form className="formulario cambiar-etapa" action={accion}>
          {resultado?.error ? <p className="formulario__error">{resultado.error}</p> : null}
          <input type="hidden" name="planta_id" value={plantaId} />
          <input type="hidden" name="unidad_id" value={unidadId} />
          <input type="hidden" name="espacio_id" value={espacioId} />
          <div className="cambiar-etapa__campos">
            <SelectorEtapa
              leyenda="Nueva etapa"
              nombre="etapa"
              valor={etapa}
              onChange={setEtapa}
            />
            <SelectorFecha
              etiqueta="Fecha de inicio"
              nombre="fecha_inicio"
              valor={fecha}
              onChange={setFecha}
            />
          </div>
          <Boton type="submit" disabled={pendiente}>
            Guardar
          </Boton>
        </form>
      </Aparecer>
    </>
  );
}
