import { EnlaceVolver } from "@/componentes/enlace-volver";

export default function NoEncontrado() {
  return (
    <section className="auth">
      <h1>No se encontró la página.</h1>
      <EnlaceVolver href="/cultivos" etiqueta="Volver a mis cultivos" />
    </section>
  );
}
