import { etiquetaPieza, textoPromocionPlus } from "@/lib/promociones";

export function VistaPreviaPromocion({ campana, mostrarCta = true }) {
  if (!campana) return null;
  const upsell = campana.esUpsellPlus === true || campana.es_upsell_plus === true;
  const anunciar = campana.anunciarFuturos === true || campana.anunciar_futuros === true;
  const base = upsell ? textoPromocionPlus({ anunciarFuturos: anunciar }) : null;
  const titulo = campana.titulo || base?.titulo || campana.nombre || "Promoción";
  const descripcion = campana.descripcion || base?.descripcion || "";
  const cta = campana.cta || base?.cta || "";
  const etiqueta = etiquetaPieza(campana.tipo);
  const imagen = typeof campana.bannerUrl === "string" ? campana.bannerUrl : campana.pieza_url;

  return (
    <article className="promo-inicio">
      <p className="promo-inicio__etiqueta">{etiqueta}</p>
      {typeof imagen === "string" && imagen.startsWith("https://") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="promo-inicio__imagen" src={imagen} alt="" />
      ) : null}
      <h2>{titulo}</h2>
      {base ? (
        <p className="promo-inicio__precio">
          {base.precio} {base.periodicidad === "AL MES" ? "por mes" : ""}
        </p>
      ) : null}
      {descripcion ? <p>{descripcion}</p> : null}
      {base?.beneficios?.length ? (
        <ul className="promo-inicio__beneficios">
          {base.beneficios.map((item) => (
            <li key={item.texto}>
              {item.texto}
              {item.etiqueta ? <span> {item.etiqueta}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {mostrarCta && cta ? <p className="promo-inicio__cta">{cta}</p> : null}
    </article>
  );
}
