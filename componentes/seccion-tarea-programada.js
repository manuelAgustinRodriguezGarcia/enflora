"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ListChecks } from "lucide-react";
import { Boton } from "@/componentes/boton";
import { SelectorFecha } from "@/componentes/selector-fecha";
import { Aparecer } from "@/componentes/aparecer";
import { fechaHoy } from "@/lib/etapas";
import { fechaMananaLocal, plantasIdsParaTarea } from "@/lib/tareas-programadas";

export function SeccionTareaProgramada({
  agendarTarea,
  unidadId = "",
  aplicaA = "plantas",
  plantasSeleccionadas = [],
  plantasUnidad = [],
  modoSeleccion = "unidad",
  deshabilitado = false,
}) {
  const hoy = fechaHoy();
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [estado, accion, pendiente] = useActionState(agendarTarea, null);
  const enviandoRef = useRef(false);

  useEffect(() => {
    if (!estado?.ok) return;
    // Tras agendar, se limpia el formulario de tarea sin tocar el registro principal.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- confirmación del servidor
    setDescripcion("");
    setFecha(hoy);
  }, [estado?.ok, hoy]);

  function armarDatos(fechaElegida) {
    const datos = new FormData();
    datos.set("unidad_id", unidadId);
    datos.set("descripcion", descripcion.trim());
    datos.set("fecha", fechaElegida);
    datos.set(
      "planta_ids",
      JSON.stringify(
        plantasIdsParaTarea({
          aplicaA,
          plantasSeleccionadas,
          plantasUnidad,
          modoSeleccion,
        })
      )
    );
    return datos;
  }

  function enviar(fechaElegida) {
    if (!agendarTarea || !unidadId || pendiente || enviandoRef.current) return;
    if (!descripcion.trim()) return;
    enviandoRef.current = true;
    accion(armarDatos(fechaElegida));
    window.setTimeout(() => {
      enviandoRef.current = false;
    }, 600);
  }

  if (!agendarTarea) return null;

  const bloqueado = deshabilitado || pendiente || !unidadId;
  const sinTexto = bloqueado || !descripcion.trim();

  return (
    <section
      className="registro-crear__seccion registro-crear__tarea"
      aria-labelledby="tarea-programada-titulo"
    >
      <h2 id="tarea-programada-titulo" className="registro-crear__etiqueta registro-crear__etiqueta--icono">
        <ListChecks strokeWidth={1.75} aria-hidden="true" />
        Tarea para otro día
      </h2>

      <div className="registro-crear__tarea-form">
        <label className="formulario__campo registro-crear__tarea-campo">
          <span className="registro-crear__sr">Tarea</span>
          <input
            type="text"
            value={descripcion}
            onChange={(evento) => setDescripcion(evento.target.value)}
            placeholder="Defoliación sobre OG Kush"
            maxLength={500}
            disabled={bloqueado}
            autoComplete="off"
          />
        </label>

        <div className="registro-crear__tarea-fecha-bloque">
          <label className="registro-crear__etiqueta registro-crear__etiqueta--campo" htmlFor="tarea-fecha">
            Fecha
          </label>
          <div
            className="registro-crear__tarea-fecha-fila"
            role="group"
            aria-label="Elegí una fecha o agendá para mañana"
          >
            <div className="registro-crear__tarea-fecha">
              <SelectorFecha
                id="tarea-fecha"
                valor={fecha}
                onChange={setFecha}
                fechaMinima={hoy}
                deshabilitado={bloqueado}
                sinIcono
              />
            </div>
            <span className="registro-crear__tarea-o" aria-hidden="true">o</span>
            <Boton
              type="button"
              className="registro-crear__tarea-manana"
              variante="secundario"
              disabled={sinTexto}
              onClick={() => enviar(fechaMananaLocal())}
            >
              Para mañana
            </Boton>
          </div>
        </div>

        <Boton
          type="button"
          className="registro-crear__tarea-agendar boton--ancho"
          variante="ghost"
          disabled={sinTexto}
          onClick={() => enviar(fecha)}
        >
          Agendar tarea
        </Boton>
      </div>

      {estado?.error ? (
        <p className="formulario__error" role="alert">
          {estado.error}
        </p>
      ) : null}

      <Aparecer visible={Boolean(estado?.ok) && !pendiente}>
        <p className="registro-crear__exito" role="status">
          {estado?.mensaje || "Tarea agendada."}
        </p>
      </Aparecer>
    </section>
  );
}
