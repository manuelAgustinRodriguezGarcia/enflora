import { ImageIcon } from "lucide-react";

// Portada de una unidad (tarjeta o detalle). Solo muestra la miniatura firmada que ya trae el servidor.
export function PortadaUnidad({ url = "", compacta = false, vertical = false, className = "" }) {
  const clases = [
    "portada-unidad",
    compacta ? "portada-unidad--compacta" : "",
    vertical ? "portada-unidad--vertical" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={clases}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="portada-unidad__vacia" aria-hidden="true">
          <ImageIcon strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}
