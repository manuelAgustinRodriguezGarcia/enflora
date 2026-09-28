import Link from "next/link";
import { notFound } from "next/navigation";
import { FormularioPlanta } from "@/componentes/formulario-planta";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

function etiquetaTipo(tipo) {
  if (tipo === "interior") return "Interior";
  if (tipo === "exterior") return "Exterior";
  return tipo;
}

function etiquetaEstado(estado) {
  if (estado === "activa") return "Activa";
  if (estado === "finalizada") return "Finalizada";
  return estado;
}

function formatearFecha(fecha) {
  if (!fecha) return "—";
  const [anio, mes, dia] = fecha.split("-");
  if (!anio || !mes || !dia) return fecha;
  return `${dia}/${mes}/${anio}`;
}

export default async function PaginaEspacio({ params }) {
  const { id } = await params;

  if (!configuracionLista()) {
    return (
      <section className="espacio">
        <Link href="/espacios">Volver a espacios</Link>
        <p>Falta la configuración de Supabase.</p>
        <FormularioPlanta espacioId={id} />
      </section>
    );
  }
  const supabase = await crearClienteServidor();

  const { data: espacio, error: errorEspacio } = await supabase
    .from("espacios")
    .select("id, nombre, tipo")
    .eq("id", id)
    .maybeSingle();

  if (errorEspacio || !espacio) {
    notFound();
  }

  const { data: plantas, error: errorPlantas } = await supabase
    .from("plantas")
    .select("id, nombre, genetica, fecha_inicio, estado")
    .eq("espacio_id", id)
    .order("fecha_creacion", { ascending: true });

  if (errorPlantas) {
    return <p>No se pudieron cargar las plantas.</p>;
  }

  return (
    <section className="espacio">
      <Link href="/espacios">Volver a espacios</Link>
      <h1>{espacio.nombre}</h1>
      <p>{etiquetaTipo(espacio.tipo)}</p>
      <FormularioPlanta espacioId={espacio.id} />
      <h2>Plantas</h2>
      {(plantas || []).length === 0 ? (
        <p>Todavía no hay plantas.</p>
      ) : (
        <ul className="lista">
          {plantas.map((planta) => (
            <li className="tarjeta" key={planta.id}>
              <span className="tarjeta__nombre">{planta.nombre}</span>
              <span className="tarjeta__meta">Genética: {planta.genetica || "—"}</span>
              <span className="tarjeta__meta">
                Inicio: {formatearFecha(planta.fecha_inicio)}
              </span>
              <span className="tarjeta__meta">{etiquetaEstado(planta.estado)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
