"use client";

import { useDemo } from "@/componentes/demo/proveedor-demo";
import { pasosGuia } from "@/lib/demo/estado-demo";

export function GuiaDemo() {
  const { estado, ocultarGuia } = useDemo();
  if (estado.guia.oculta) return null;

  const pasos = pasosGuia(estado);
  const hechos = pasos.filter((paso) => paso.hecho).length;
  const completa = hechos === pasos.length;

  return (
    <aside className="demo-guia" aria-labelledby="demo-guia-titulo">
      <div className="demo-guia__cabecera">
        <p className="demo-guia__titulo" id="demo-guia-titulo">
          {completa ? "¡Completaste el recorrido!" : `Tu recorrido · ${hechos} de ${pasos.length}`}
        </p>
        <button type="button" className="registro-crear__enlace demo-enlace" onClick={ocultarGuia}>
          Ocultar
        </button>
      </div>
      <ol className="demo-guia__pasos">
        {pasos.map((paso, indice) => (
          <li key={paso.id} className={`demo-guia__paso${paso.hecho ? " demo-guia__paso--hecho" : ""}`}>
            <span className="demo-guia__marca" aria-hidden="true">
              {paso.hecho ? "✓" : indice + 1}
            </span>
            <span>{paso.titulo}</span>
            <span className="demo__sr">{paso.hecho ? "Completado" : "Pendiente"}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
