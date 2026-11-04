import {
  PROVEEDOR_CLIMA,
  TEXTO_ATRIBUCION,
  TEXTO_DESCARGO,
} from "@/lib/clima/constantes";

export function AtribucionClima({ atribucion = null }) {
  const url = atribucion?.url || PROVEEDOR_CLIMA.url;
  const texto = atribucion?.texto || TEXTO_ATRIBUCION;
  const descargo = atribucion?.descargo || TEXTO_DESCARGO;

  return (
    <footer className="clima-atribucion">
      <a href={url} target="_blank" rel="noreferrer">
        {texto}
      </a>
      <p>{descargo}</p>
    </footer>
  );
}
