"use client";

export default function ErrorUsuarios({ reset }) {
  return (
    <section className="admin-dash admin-planes">
      <p className="admin-estado__etiqueta">Administración</p>
      <h1>Usuarios</h1>
      <p className="admin-dash__aviso admin-dash__aviso--bloque" role="alert">
        No pudimos mostrar esta vista. No hay datos de reemplazo.
      </p>
      <button className="admin-dash__actualizar" type="button" onClick={() => reset()}>
        Reintentar
      </button>
    </section>
  );
}
