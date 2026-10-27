import { ListChecks } from "lucide-react";
import { formatearFecha } from "@/lib/etapas";

export function ListaTareasPendientes({ tareas = [], titulo = "Tareas pendientes" }) {
  if (!tareas.length) return null;

  return (
    <section className="tareas-pendientes" aria-label={titulo}>
      <h2 className="galeria-fotos__titulo">
        <ListChecks strokeWidth={1.75} aria-hidden="true" />
        {titulo}
      </h2>
      <ul className="tareas-pendientes__lista">
        {tareas.map((tarea) => (
          <li key={tarea.id} className="tareas-pendientes__item">
            <span className="tareas-pendientes__fecha">
              {formatearFecha(tarea.fecha_programada)}
            </span>
            <span className="tareas-pendientes__texto">{tarea.descripcion}</span>
            {tarea.planta_ids?.length ? (
              <span className="tareas-pendientes__meta">
                {tarea.planta_ids.length === 1
                  ? "1 planta"
                  : `${tarea.planta_ids.length} plantas`}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
