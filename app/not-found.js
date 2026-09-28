import Link from "next/link";

export default function NoEncontrado() {
  return (
    <section className="auth">
      <h1>No se encontró la página.</h1>
      <Link href="/espacios">Volver a espacios</Link>
    </section>
  );
}
