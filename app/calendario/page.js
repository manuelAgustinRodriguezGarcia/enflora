import { redirect } from "next/navigation";
import Link from "next/link";
import { VistaCalendario } from "@/componentes/calendario/vista-calendario";
import { TransicionVista } from "@/componentes/transicion-vista";
import { cargarCalendario } from "@/lib/calendario/cargar";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mi calendario",
  robots: { index: false, follow: false },
};

export default async function PaginaCalendario({ searchParams }) {
  const parametros = await searchParams;
  if (!configuracionLista()) {
    return (
      <section className="calendario">
        <h1>Mi calendario</h1>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const user = await obtenerSesionRapida();
  if (!user) redirect("/ingreso");

  const supabase = await crearClienteServidor();
  const datos = await cargarCalendario(supabase, user.id, parametros);

  if (!datos.disponible) {
    return (
      <section className="calendario">
        <h1>Mi calendario</h1>
        <p className="calendario__vacio">
          El calendario todavía no está en esta base. Aplicá la migración en el SQL Editor.
        </p>
        <p className="calendario__archivo">supabase/calendario-tareas.sql</p>
        <p>
          <Link href="/inicio">Volver al inicio</Link>
        </p>
      </section>
    );
  }

  if (datos.error) {
    return (
      <section className="calendario">
        <h1>Mi calendario</h1>
        <p className="formulario__error" role="alert">
          No se pudieron cargar las tareas.
        </p>
      </section>
    );
  }

  return (
    <TransicionVista>
      <VistaCalendario datos={datos} />
    </TransicionVista>
  );
}
