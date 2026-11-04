import { notFound, redirect } from "next/navigation";
import { quitarLocalidadClima } from "@/app/cultivos/[id]/clima/acciones";
import { BusquedaLocalidad } from "@/componentes/clima/busqueda-localidad";
import { PanelClima } from "@/componentes/clima/panel-clima";
import { EnlaceVolver } from "@/componentes/enlace-volver";
import { TransicionVista } from "@/componentes/transicion-vista";
import { climaDeUbicacion, leerUbicacion } from "@/lib/clima/cargar";
import { mensajeClima } from "@/lib/clima/constantes";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Clima",
};

export default async function PaginaClima({ params }) {
  const { id } = await params;

  if (!configuracionLista()) {
    return (
      <section className="clima">
        <EnlaceVolver href="/cultivos" etiqueta="Volver a espacios" />
        <h1>Clima</h1>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const user = await obtenerSesionRapida();
  if (!user) redirect("/ingreso");

  const supabase = await crearClienteServidor();
  const { data: espacio, error } = await supabase
    .from("espacios")
    .select("id, nombre, tipo, usuario_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !espacio || espacio.usuario_id !== user.id) notFound();

  return (
    <TransicionVista>
      <section className="clima">
        <EnlaceVolver href={`/cultivos/${espacio.id}`} etiqueta="Volver al espacio" />
        {espacio.tipo === "exterior" ? (
          <ClimaExterior supabase={supabase} espacio={espacio} usuarioId={user.id} />
        ) : (
          <>
            <h1>Clima</h1>
            <p className="clima__vacio">El clima corresponde a espacios exteriores. Este espacio es interior.</p>
          </>
        )}
      </section>
    </TransicionVista>
  );
}

async function ClimaExterior({ supabase, espacio, usuarioId }) {
  const ubicacion = await leerUbicacion(supabase, espacio.id, usuarioId);
  if (ubicacion.estado === "no_disponible") {
    return (
      <>
        <h1>Clima</h1>
        <p className="clima__error">{mensajeClima("no_disponible")}</p>
      </>
    );
  }
  if (ubicacion.estado === "error") {
    return (
      <>
        <h1>Clima</h1>
        <p className="clima__error">{mensajeClima("sin_datos")}</p>
      </>
    );
  }

  let clima = null;
  let errorClima = "";
  if (ubicacion.fila) {
    const resultado = await climaDeUbicacion(supabase, ubicacion.fila, usuarioId);
    if (resultado.ok) clima = resultado.clima;
    else errorClima = resultado.mensaje;
  }

  const controles = (
    <ControlesUbicacion espacioId={espacio.id} tieneLocalidad={Boolean(ubicacion.fila)} />
  );

  return (
    <>
      {errorClima ? <p className="clima__error" role="alert">{errorClima}</p> : null}
      {clima ? (
        <PanelClima clima={clima} menu={controles} />
      ) : (
        <>
          <header className="clima__cabecera">
            <h1>Clima</h1>
            <p>{espacio.nombre}</p>
          </header>
          {!ubicacion.fila && !errorClima ? (
            <p className="clima__vacio">Todavía no hay una localidad para este cultivo.</p>
          ) : null}
          {controles}
        </>
      )}
    </>
  );
}

function ControlesUbicacion({ espacioId, tieneLocalidad }) {
  if (!tieneLocalidad) return <BusquedaLocalidad espacioId={espacioId} />;

  return (
    <details className="clima-menu">
      <summary>Cambiar o quitar ubicación</summary>
      <BusquedaLocalidad espacioId={espacioId} tieneLocalidad embebida />
      <form action={quitarLocalidadClima}>
        <input type="hidden" name="espacio_id" value={espacioId} />
        <button type="submit" className="clima__texto">
          Quitar ubicación
        </button>
      </form>
    </details>
  );
}
