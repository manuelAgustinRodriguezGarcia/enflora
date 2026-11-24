import { BannerPublicitario } from "@/componentes/banner-publicitario";
import { EnlaceBanner, RegistroImpresion } from "@/componentes/enlace-banner";
import { VistaPreviaPromocion } from "@/componentes/promociones/vista-previa-promocion";
import { DESTINO_PLUS, destinoPromocion } from "@/lib/promociones";

export function PromocionInicio({ campañas = [], sutil = false }) {
  if (!Array.isArray(campañas) || campañas.length === 0) return null;
  const conImagen = campañas.filter((campaña) => typeof campaña.bannerUrl === "string" && campaña.bannerUrl.startsWith("https://"));
  if (conImagen.length) {
    return (
      <div className={sutil ? "promo-inicio-zona promo-inicio-zona--sutil" : "promo-inicio-zona"}>
        <BannerPublicitario campañas={conImagen} sutil={sutil} />
      </div>
    );
  }
  const textual = campañas[0];
  const destino = textual ? destinoPromocion(textual.enlace || (textual.esUpsellPlus ? DESTINO_PLUS : ""), { interno: textual.tipo === "interna" }) : null;

  return (
    <div className={sutil ? "promo-inicio-zona promo-inicio-zona--sutil" : "promo-inicio-zona"}>
      {textual ? (
        <div className="promo-inicio-zona__texto">
          {destino ? (
            <EnlaceBanner href={destino} campanaId={textual.campanaId} externo={!destino.startsWith("/")} className="promo-inicio__enlace">
              <VistaPreviaPromocion campana={textual} mostrarCta={false} />
            </EnlaceBanner>
          ) : (
            <>
              <RegistroImpresion campanaId={textual.campanaId} />
              <VistaPreviaPromocion campana={textual} mostrarCta={false} />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
