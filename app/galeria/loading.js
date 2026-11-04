const CELDAS = 12;

export default function CargandoGaleria() {
  return (
    <section className="galeria-flora" aria-busy="true" aria-live="polite">
      <header className="galeria-flora__cabecera">
        <h1>Galería de Flora</h1>
        <p>Las fotos de tus registros.</p>
      </header>
      <div className="galeria-flora__grilla">
        {Array.from({ length: CELDAS }, (_, indice) => (
          <div key={indice} className="galeria-flora__esqueleto" />
        ))}
      </div>
    </section>
  );
}
