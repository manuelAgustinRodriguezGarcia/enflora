"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { duplicarRecetaMezcla, establecerRecetaActiva } from "@/app/registros/mezclas-acciones";
import { textoMedida } from "@/lib/mezclas/calculo";

export function PanelRecetas({ recetas = [], disponible = false }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function duplicar(id) {
    setError("");
    const resultado = await duplicarRecetaMezcla(id);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  async function cambiarActiva(receta) {
    setError("");
    const resultado = await establecerRecetaActiva(receta.id, !receta.activa);
    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  if (!disponible) {
    return (
      <p className="registro-crear__ayuda">
        Falta aplicar supabase/mezclas.sql en Supabase. Después de eso vas a poder guardar recetas.
      </p>
    );
  }

  return (
    <div className="mezclas__panel">
      <Link className="boton" href="/registros/recetas/nueva">
        Nueva receta
      </Link>
      {error ? <p className="formulario__error">{error}</p> : null}
      <ul className="mezclas__lista">
        {recetas.map((receta) => (
          <li key={receta.id} className={receta.activa ? "" : "mezclas__item--archivado"}>
            <div>
              <p className="mezclas__nombre">{receta.nombre}</p>
              <p className="mezclas__meta">
                {textoMedida(receta.volumen_agua, receta.unidad_volumen)}
                {` · ${(receta.componentes || receta.receta_componentes || []).length} componentes`}
                {receta.activa ? "" : " · Archivada"}
              </p>
            </div>
            <div className="mezclas__acciones">
              <Link className="boton boton--secundario" href={`/registros/recetas/${receta.id}`}>
                Editar
              </Link>
              <button type="button" className="boton boton--secundario" onClick={() => duplicar(receta.id)}>
                Duplicar
              </button>
              <button type="button" className="boton boton--ghost" onClick={() => cambiarActiva(receta)}>
                {receta.activa ? "Archivar" : "Activar"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {recetas.length === 0 ? <p className="registro-crear__ayuda">Todavía no guardaste recetas.</p> : null}
    </div>
  );
}
