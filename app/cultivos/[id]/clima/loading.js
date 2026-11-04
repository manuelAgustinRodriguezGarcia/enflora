export default function Loading() {
  return (
    <section className="clima" aria-busy="true" aria-live="polite">
      <p className="clima__meta">Cargando clima…</p>
      <div className="clima-mini clima-mini--espera" />
    </section>
  );
}
