import Link from "next/link";
import { FormularioEspacio } from "@/componentes/formulario-espacio";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

function etiquetaTipo(tipo) {
  if (tipo === "interior") return "Interior";
  if (tipo === "exterior") return "Exterior";
  return tipo;
}

function contarPlantas(plantas) {
  const cantidades = {};

  for (const planta of plantas) {
    const actual = cantidades[planta.espacio_id] || 0;
    cantidades[planta.espacio_id] = actual + 1;
  }

  return cantidades;
}

function textoCantidad(cantidad) {
  if (cantidad === 1) return "1 planta";
  return `${cantidad} plantas`;
}

export default async function PaginaEspacios() {
  if (!configuracionLista()) {
    return (
      <section className="espacios">
        <h1>Espacios</h1>
        <p>Falta la configuración de Supabase.</p>
        <FormularioEspacio />
      </section>
    );
  }

  const supabase = await crearClienteServidor();
  const [espaciosRespuesta, plantasRespuesta] = await Promise.all([
    supabase
      .from("espacios")
      .select("id, nombre, tipo")
      .order("fecha_creacion", { ascending: true }),
    supabase.from("plantas").select("espacio_id"),
  ]);

  if (espaciosRespuesta.error || plantasRespuesta.error) {
    return <p>No se pudieron cargar los espacios.</p>;
  }

  const espacios = espaciosRespuesta.data || [];
  const cantidades = contarPlantas(plantasRespuesta.data || []);

  return (
    <section className="espacios">
      <h1>Espacios</h1>
      <FormularioEspacio />
      {espacios.length === 0 ? (
        <p>Todavía no hay espacios.</p>
      ) : (
        <ul className="lista">
          {espacios.map((espacio) => (
            <li key={espacio.id}>
              <Link className="tarjeta" href={`/espacios/${espacio.id}`}>
                <span className="tarjeta__nombre">{espacio.nombre}</span>
                <span className="tarjeta__meta">{etiquetaTipo(espacio.tipo)}</span>
                <span className="tarjeta__meta">
                  {textoCantidad(cantidades[espacio.id] || 0)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
