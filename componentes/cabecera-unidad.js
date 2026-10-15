"use client";

import { useState } from "react";
import { Aparecer } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { EliminarUnidad } from "@/componentes/eliminar-unidad";
import { FormularioUnidad } from "@/componentes/formulario-unidad";
import { IconoLapiz } from "@/componentes/iconos-ui";
import { etiquetaTipoUnidad, textoCantidad } from "@/lib/unidades";

export function CabeceraUnidad({ unidad, espacioId, tipoEspacio, cantidadPlantas = 0 }) {
  const [editando, setEditando] = useState(false);

  return (
    <>
      <header className="detalle-cabecera">
        <div className="detalle-cabecera__superior">
          <h1 className="detalle-cabecera__titulo">{unidad.nombre}</h1>
          <div className="detalle-cabecera__acciones">
            <Boton
              className="boton boton--secundario boton--icono"
              type="button"
              aria-label="Editar unidad"
              aria-expanded={editando}
              onClick={() => setEditando((actual) => !actual)}
            >
              <IconoLapiz />
            </Boton>
            <EliminarUnidad unidadId={unidad.id} espacioId={espacioId} />
          </div>
        </div>
        <div className="detalle-cabecera__fila">
          <span className="detalle-cabecera__chip">
            {etiquetaTipoUnidad(unidad.tipo, unidad.tipo_personalizado)}
          </span>
          <span className="detalle-cabecera__meta">{textoCantidad(cantidadPlantas)}</span>
        </div>
      </header>
      <Aparecer visible={editando}>
        <FormularioUnidad unidad={unidad} espacioId={espacioId} tipoEspacio={tipoEspacio} />
      </Aparecer>
    </>
  );
}
