import { PrefetchImagenesAuth } from "@/componentes/prefetch-imagenes-auth";
import { imagenesAuth, imagenesAuthTodas } from "@/lib/auth-imagenes";

export function MarcoAuth({ fondo, children }) {
  const imagenMobile = imagenesAuth[fondo]?.mobile || imagenesAuth.entrar.mobile;

  return (
    <div className={`marco-auth marco-auth--${fondo}`}>
      <PrefetchImagenesAuth />
      {imagenesAuthTodas.map((href) => (
        <link key={href} rel="preload" as="image" href={href} />
      ))}
      <div className="marco-auth__flora" aria-hidden="true">
        <img src={imagenMobile} alt="" decoding="async" fetchPriority="high" />
      </div>
      <div className="marco-auth__panel">
        <div className="marco-auth__contenido">{children}</div>
      </div>
    </div>
  );
}
