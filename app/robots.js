export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/inicio",
        "/espacios",
        "/registros",
        "/perfil",
        "/onboarding",
        "/api/",
      ],
    },
    sitemap: "https://enflora.com.ar/sitemap.xml",
  };
}
