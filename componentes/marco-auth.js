export function MarcoAuth({ fondo, children }) {
  return (
    <div className={`marco-auth marco-auth--${fondo}`}>
      <div className="marco-auth__panel">
        <div className="marco-auth__contenido">{children}</div>
      </div>
    </div>
  );
}
