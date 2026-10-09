import Link from "next/link";
import { notFound } from "next/navigation";
import { EnlaceBoton } from "@/componentes/boton";
import { EliminarEspacio } from "@/componentes/eliminar-espacio";
import { ListaEntrada } from "@/componentes/lista-entrada";
import { TransicionVista } from "@/componentes/transicion-vista";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { etiquetaTipoEspacio, etiquetaTipoUnidad, textoCantidad } from "@/lib/unidades";

export default async function PaginaEspacio({ params }) {
  const { id } = await params;

  if (!configuracionLista()) {
    return (
      <section className="espacio">
        <Link href="/espacios">Volver a espacios</Link>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const supabase = await crearClienteServidor();
  const { data: espacio, error: errorEspacio } = await supabase
    .from("espacios")
    .select("id, nombre, tipo")
    .eq("id", id)
    .maybeSingle();

  if (errorEspacio || !espacio) notFound();

  const { data: unidades, error: errorUnidades } = await supabase
    .from("unidades_cultivo")
    .select("id, nombre, tipo, tipo_personalizado, numero")
    .eq("espacio_id", espacio.id)
    .order("numero", { ascending: true });

  if (errorUnidades) return <p>No se pudieron cargar las unidades.</p>;

  const lista = unidades || [];
  const ids = lista.map((unidad) => unidad.id);
  let cantidades = {};

  if (ids.length) {
    const { data: plantas, error: errorPlantas } = await supabase
      .from("plantas")
      .select("unidad_cultivo_id")
      .in("unidad_cultivo_id", ids);

    if (errorPlantas) return <p>No se pudieron cargar las plantas.</p>;

    cantidades = {};
    for (const planta of plantas || []) {
      cantidades[planta.unidad_cultivo_id] = (cantidades[planta.unidad_cultivo_id] || 0) + 1;
    }
  }

  const total = Object.values(cantidades).reduce((suma, cantidad) => suma + cantidad, 0);

  return (
    <TransicionVista>
    <section className="espacio">
      <Link href="/espacios">Volver a espacios</Link>
      <h1>{espacio.nombre}</h1>
      <p>{etiquetaTipoEspacio(espacio.tipo)}</p>
      <p>{textoCantidad(total)}</p>
      <div className="acciones">
        <Link href={`/espacios/${espacio.id}/editar`}>Editar</Link>
        <EliminarEspacio espacioId={espacio.id} />
      </div>
      <h2>Unidades</h2>
      {lista.length === 0 ? (
        <p>No hay unidades de cultivo.</p>
      ) : (
        <ListaEntrada>
          {lista.map((unidad) => (
            <li key={unidad.id}>
              <Link className="tarjeta" href={`/espacios/${espacio.id}/unidades/${unidad.id}`}>
                <span className="tarjeta__nombre">{unidad.nombre}</span>
                <span className="tarjeta__meta">
                  {etiquetaTipoUnidad(unidad.tipo, unidad.tipo_personalizado)}
                </span>
                <span className="tarjeta__meta">{textoCantidad(cantidades[unidad.id] || 0)}</span>
              </Link>
            </li>
          ))}
        </ListaEntrada>
      )}
      <EnlaceBoton className="boton" href={`/espacios/${espacio.id}/unidades/nueva`}>
        Agregar unidad
      </EnlaceBoton>
    </section>
    </TransicionVista>
  );
}
