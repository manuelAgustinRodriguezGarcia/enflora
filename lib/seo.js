import { planesEnflora } from "@/lib/planes";

export const URL_SITIO = "https://enflora.com.ar";
export const URL_INICIO = "https://enflora.com.ar";
export const CORREO_PUBLICO = "enflora.420@gmail.com";
export const NOMBRE_MARCA = "Enflora";
export const INSTAGRAM_USUARIO = "@enflora420";
export const INSTAGRAM_URL = "https://www.instagram.com/enflora420/";
export const ESTILO_MARCA_CORREO =
  "font-family:Fredoka,'Fredoka',sans-serif;font-weight:600;letter-spacing:-0.045em;";
export const TITULO_INICIO = `${NOMBRE_MARCA} | Registro y seguimiento de cultivos`;
export const DESCRIPCION_ENFLORA =
  `Organizá tus plantas de cannabis, registrá riegos y parámetros, y seguí cada cultivo con ${NOMBRE_MARCA}.`;

const imagenSocial = {
  url: "/og/enflora.png",
  width: 1200,
  height: 630,
  alt: `${NOMBRE_MARCA}, aplicación de seguimiento de cultivos de cannabis`,
};

export function metadatosPublicos({ titulo, descripcion, canonical }) {
  return {
    title: { absolute: titulo },
    description: descripcion,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: NOMBRE_MARCA,
      title: titulo,
      description: descripcion,
      url: canonical,
      images: [imagenSocial],
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descripcion,
      images: [imagenSocial.url],
    },
  };
}

function textoOferta(plan) {
  if (plan.precioUsd === 0) return "Plan gratuito";
  if (plan.periodicidad === "AL MES") return "Suscripción mensual";
  return "Pago único por un cultivo, sin vencimiento";
}

function oferta(plan) {
  return {
    "@type": "Offer",
    name: plan.titulo,
    price: plan.precioUsd === 0 ? "0" : plan.precioUsd.toFixed(2),
    priceCurrency: "USD",
    description: textoOferta(plan),
    url: `${URL_SITIO}/#precios`,
  };
}

export function grafoEnflora() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${URL_SITIO}/#website`,
        name: NOMBRE_MARCA,
        alternateName: `${NOMBRE_MARCA} Cultivos`,
        url: URL_SITIO,
        inLanguage: "es-AR",
        publisher: { "@id": `${URL_SITIO}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${URL_SITIO}/#organization`,
        name: NOMBRE_MARCA,
        url: URL_SITIO,
        sameAs: [INSTAGRAM_URL],
        logo: {
          "@type": "ImageObject",
          url: `${URL_SITIO}/icons/enflora-isotipo-512.png`,
          width: 512,
          height: 512,
        },
        email: CORREO_PUBLICO,
      },
      {
        "@type": "WebApplication",
        "@id": `${URL_SITIO}/#app`,
        name: NOMBRE_MARCA,
        url: URL_SITIO,
        description: DESCRIPCION_ENFLORA,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web",
        browserRequirements: "Navegador moderno. Se puede instalar como aplicación web en Android e iOS.",
        inLanguage: "es-AR",
        isAccessibleForFree: true,
        featureList: [
          "Organizar cultivos",
          "Registrar plantas",
          "Registrar riegos y parámetros",
          "Llevar el seguimiento de cada cultivo",
        ],
        offers: planesEnflora.items.map(oferta),
        publisher: { "@id": `${URL_SITIO}/#organization` },
      },
    ],
  };
}
