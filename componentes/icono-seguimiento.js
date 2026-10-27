import { LayoutGrid, NotebookText, SlidersHorizontal } from "lucide-react";

// Iconos de los tipos de seguimiento (Chill, Pro, Personalizado). Lucide, trazo 1.75.
const ICONOS = {
  relajado: NotebookText,
  profesional: SlidersHorizontal,
  personalizado: LayoutGrid,
};

export function IconoSeguimiento({ tipo }) {
  const Icono = ICONOS[tipo];
  if (!Icono) return null;

  return <Icono className="icono-seguimiento" strokeWidth={1.75} aria-hidden="true" />;
}
