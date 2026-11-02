import Link from "next/link";

export default function NoEncontradoAdmin() {
  return (
    <section className="admin-estado">
      <p className="admin-estado__etiqueta">Administración</p>
      <h1>Sección no disponible</h1>
      <p className="admin-estado__resumen">
        Esta dirección no existe o no está habilitada para tu cuenta.
      </p>
      <p className="admin-estado__volver">
        <Link href="/admin">Volver al panel</Link>
      </p>
    </section>
  );
}
