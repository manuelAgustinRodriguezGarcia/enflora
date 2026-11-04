export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/inicio",
        "/cultivos",
        "/espacios",
        "/registros",
        "/mezclas",
        "/perfil",
        "/onboarding",
        "/api/",
      ],
    },
    sitemap: "https://enflora.com.ar/sitemap.xml",
  };
}
