"use client";

import { fechaCorta, fechaLarga, tarjetasResumen } from "@/lib/demo/historial/historial-demo";

export function HistorialResumen({ historial }) {
  const tarjetas = tarjetasResumen(historial);
  const { resumen, cultivo } = historial;

  return (
    <section className="historial-resumen" aria-labelledby="historial-resumen-titulo">
      <h2 id="historial-resumen-titulo" className="demo__sr">
        Resumen del cultivo
      </h2>
      <ul className="historial-cifras">
        {tarjetas.map((tarjeta) => (
          <li key={tarjeta.clave} className="tarjeta historial-cifra">
            <span className="historial-cifra__valor">{tarjeta.valor}</span>
            <span className="historial-cifra__etiqueta">{tarjeta.etiqueta}</span>
          </li>
        ))}
      </ul>
      <div className="historial-narrativa">
        <p>
          <strong>{cultivo.nombre}</strong> es un cultivo real de {cultivo.genetica || "una genética"} en{" "}
          {cultivo.metodo || "hidroponía"}, registrado día a día por su cultivador con fotos, mediciones y notas.
          Lo mostramos tal como fue cargado, en modo lectura: podés recorrerlo, pero no editarlo.
        </p>
        <p className="demo__aviso">
          Los registros van del {fechaCorta(resumen.rango.desde)} al {fechaLarga(resumen.rango.hasta)}. El cultivo
          empezó el {fechaLarga(cultivo.fechaInicio)}; los primeros días no tuvieron registros digitales.
        </p>
      </div>
    </section>
  );
}
