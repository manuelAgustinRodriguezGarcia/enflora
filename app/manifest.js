import { ID_PWA, RUTA_ARRANQUE_PWA, SCOPE_PWA, urlManifiestoPwa } from "@/lib/pwa-entrada";
import { NOMBRE_MARCA } from "@/lib/seo";

export default function manifest() {
  return {
    name: NOMBRE_MARCA,
    short_name: NOMBRE_MARCA,
    description: "Seguimiento de cultivos de cannabis",
    id: ID_PWA,
    start_url: RUTA_ARRANQUE_PWA,
    scope: SCOPE_PWA,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#F4F8EE",
    theme_color: "#0B3D2A",
    lang: "es-AR",
    categories: ["lifestyle"],
    prefer_related_applications: false,
    related_applications: [
      {
        platform: "webapp",
        url: urlManifiestoPwa(),
      },
    ],
    icons: [
      {
        src: "/icons/enflora-isotipo-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/enflora-isotipo-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/enflora-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/enflora-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
