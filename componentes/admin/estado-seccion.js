import { Info } from "lucide-react";

export function EstadoSeccion({ titulo, resumen }) {
  return (
    <section className="admin-estado">
      <p className="admin-estado__etiqueta">Administración</p>
      <h1>{titulo}</h1>
      <p className="admin-estado__resumen">{resumen}</p>
      <div className="admin-estado__nota">
        <Info size={18} strokeWidth={2.2} aria-hidden="true" />
        <p>Esta sección todavía no está operativa. No hay datos cargados ni cifras de prueba.</p>
      </div>
    </section>
  );
}
