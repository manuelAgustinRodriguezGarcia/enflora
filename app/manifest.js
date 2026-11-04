import { NOMBRE_MARCA } from "@/lib/seo";

export default function manifest() {
  return {
    name: NOMBRE_MARCA,
    short_name: NOMBRE_MARCA,
    description: "Seguimiento de cultivos de cannabis",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#F4F8EE",
    theme_color: "#0B3D2A",
    lang: "es-AR",
    categories: ["lifestyle"],
    prefer_related_applications: false,
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
