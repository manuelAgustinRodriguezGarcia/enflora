export default function CargandoFeedbackAdmin() {
  return (
    <section className="admin-dash admin-planes" aria-busy="true">
      <p className="admin-estado__etiqueta">Administración</p>
      <h1>Feedback</h1>
      <p className="admin-dash__aclaracion">Cargando la bandeja. Todavía no hay mensajes.</p>
      <div className="admin-dash__grilla" aria-hidden="true">
        <article className="admin-dash__tarjeta">
          <h2>Nuevos</h2>
          <p className="admin-dash__valor">…</p>
        </article>
        <article className="admin-dash__tarjeta">
          <h2>En revisión</h2>
          <p className="admin-dash__valor">…</p>
        </article>
        <article className="admin-dash__tarjeta">
          <h2>Resueltos</h2>
          <p className="admin-dash__valor">…</p>
        </article>
      </div>
    </section>
  );
}
