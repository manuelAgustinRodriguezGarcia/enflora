export default function manifest() {
  return {
    name: "Enflora",
    short_name: "Enflora",
    description: "Espacios de cultivo y plantas",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F4F8EE",
    theme_color: "#0B3D2A",
    icons: [
      {
        src: "/logos/enflora-isotipo-dark-green.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/logos/enflora-isotipo-dark-green.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
