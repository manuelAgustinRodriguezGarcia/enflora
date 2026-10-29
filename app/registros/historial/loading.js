import { CargaVista } from "@/componentes/carga-vista";

export default function Loading() {
  return (
    <section className="historial historial--vista-cultivo historial--cargando" aria-busy="true">
      <header className="historial__cabecera">
        <h1>Historial</h1>
      </header>
      <CargaVista />
    </section>
  );
}
