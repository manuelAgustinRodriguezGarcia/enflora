const imagenesFlora = {
  entrar: "/images/flora-login-mobile.png",
  registro: "/images/flora-register-mobile.png",
};

export function MarcoAuth({ fondo, children }) {
  const imagen = imagenesFlora[fondo] || imagenesFlora.entrar;

  return (
    <div className={`marco-auth marco-auth--${fondo}`}>
      <div className="marco-auth__flora" aria-hidden="true">
        <img src={imagen} alt="" />
      </div>
      <div className="marco-auth__panel">
        <div className="marco-auth__contenido">{children}</div>
      </div>
    </div>
  );
}
