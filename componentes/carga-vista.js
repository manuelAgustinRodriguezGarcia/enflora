// Esqueleto liviano para loading.js: aparece al instante mientras el servidor resuelve la ruta.
export function CargaVista({ etiqueta = "Cargando" }) {
  return (
    <section className="carga-vista" role="status" aria-busy="true" aria-label={etiqueta}>
      <span className="carga-vista__titulo" />
      <span className="carga-vista__bloque" />
      <span className="carga-vista__bloque" />
      <span className="carga-vista__bloque carga-vista__bloque--corto" />
    </section>
  );
}
