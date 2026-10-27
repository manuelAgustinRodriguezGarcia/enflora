import { Leaf } from "lucide-react";
import { ilustracionEspacio } from "@/lib/imagenes-espacio";
import { etiquetaTipoEspacio } from "@/lib/unidades";

// Encabezado visual del espacio: ilustración en public/ si está configurada; si no, bloque neutro.
export function ImagenEspacio({ tipo, className = "" }) {
  const src = ilustracionEspacio(tipo);
  const etiqueta = etiquetaTipoEspacio(tipo);

  return (
    <div className={`imagen-espacio ${className}`.trim()} aria-hidden={!src}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span className="imagen-espacio__neutro">
          <Leaf strokeWidth={1.5} aria-hidden="true" />
          <span className="imagen-espacio__tipo">{etiqueta}</span>
        </span>
      )}
    </div>
  );
}
