/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/espacios", destination: "/cultivos", permanent: false },
      { source: "/espacios/:path*", destination: "/cultivos/:path*", permanent: false },
      { source: "/registros/recetas", destination: "/mezclas", permanent: false },
      { source: "/registros/recetas/:id", destination: "/mezclas/:id", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/offline.html",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
