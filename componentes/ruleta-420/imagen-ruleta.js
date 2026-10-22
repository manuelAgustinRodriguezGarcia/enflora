"use client";

import { useState } from "react";
import { IMAGENES_RULETA } from "@/lib/ruleta-420/configuracion";
import { IconoRuleta } from "@/componentes/ruleta-420/iconos-ruleta";

function resolverImagen(clave) {
  if (!clave) return "";
  if (clave.includes("/images/")) {
    const publica = clave.replace(/^\/?public\//, "/");
    return publica.startsWith("/") ? publica : `/${publica}`;
  }
  return IMAGENES_RULETA[clave] || "";
}

export function ImagenRuleta({ clave, alt = "", icono, etiqueta, className = "", tono = "" }) {
  const src = resolverImagen(clave);
  const [fallida, setFallida] = useState("");
  const clases = ["ruleta-imagen", tono ? `ruleta-imagen--${tono}` : "", className]
    .filter(Boolean)
    .join(" ");

  if (src && fallida !== src) {
    return (
      <div className={clases}>
        <img
          className="ruleta-imagen__foto"
          src={src}
          alt={alt}
          decoding="async"
          onError={() => setFallida(src)}
        />
      </div>
    );
  }

  return (
    <div className={`${clases} ruleta-imagen--placeholder`} role={alt ? "img" : undefined} aria-label={alt || undefined}>
      <span className="ruleta-imagen__burbuja">
        <IconoRuleta nombre={icono} />
      </span>
      {etiqueta ? <span className="ruleta-imagen__etiqueta">{etiqueta}</span> : null}
    </div>
  );
}
