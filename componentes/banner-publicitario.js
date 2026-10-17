import { elegirRotacion, enlaceExternoSeguro } from "@/lib/publicidad";

export function BannerPublicitario({ campañas = [] }) {
  if (!Array.isArray(campañas) || campañas.length === 0) return null;

  const campaña = elegirRotacion(campañas);
  if (!campaña?.bannerUrl) return null;

  const enlace = enlaceExternoSeguro(campaña.enlace);
  const imagen = (
    <img
      className="banner-publicitario__img"
      src={campaña.bannerUrl}
      alt={`Publicidad de ${campaña.nombre}`}
      width={640}
      height={160}
      loading="lazy"
      decoding="async"
    />
  );

  return (
    <aside className="banner-publicitario" aria-label="Publicidad">
      <p className="banner-publicitario__etiqueta">Publicidad</p>
      {enlace ? (
        <a
          className="banner-publicitario__enlace"
          href={enlace}
          target="_blank"
          rel="noopener noreferrer sponsored"
        >
          {imagen}
        </a>
      ) : (
        <div className="banner-publicitario__enlace">{imagen}</div>
      )}
    </aside>
  );
}
