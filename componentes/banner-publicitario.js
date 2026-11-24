import { EnlaceBanner } from "@/componentes/enlace-banner";
import { destinoPromocion, etiquetaPieza } from "@/lib/promociones";
import { elegirRotacion, enlaceExternoSeguro } from "@/lib/publicidad";

export function BannerPublicitario({ campañas = [], sutil = false }) {
  if (!Array.isArray(campañas) || campañas.length === 0) return null;

  const campaña = elegirRotacion(campañas);
  if (!campaña?.bannerUrl) return null;

  const enlace = campaña.tipo === "interna"
    ? destinoPromocion(campaña.enlace || "", { interno: true })
    : enlaceExternoSeguro(campaña.enlace);
  const etiqueta = etiquetaPieza(campaña.tipo);
  const externo = Boolean(enlace && !String(enlace).startsWith("/"));
  const imagen = (
    <img
      className="banner-publicitario__img"
      src={campaña.bannerUrl}
      alt={`${etiqueta} de ${campaña.nombre}`}
      width={640}
      height={160}
      loading="lazy"
      decoding="async"
    />
  );

  return (
    <aside className={sutil ? "banner-publicitario banner-publicitario--sutil" : "banner-publicitario"} aria-label={etiqueta}>
      <p className="banner-publicitario__etiqueta">{etiqueta}</p>
      {enlace && campaña.campanaId ? (
        <EnlaceBanner href={enlace} campanaId={campaña.campanaId} externo={externo}>
          {imagen}
        </EnlaceBanner>
      ) : enlace ? (
        <a className="banner-publicitario__enlace" href={enlace} target="_blank" rel="noopener noreferrer sponsored">
          {imagen}
        </a>
      ) : (
        <div className="banner-publicitario__enlace">{imagen}</div>
      )}
    </aside>
  );
}
