import { redirect } from "next/navigation";
import { PanelInicio } from "@/componentes/inicio/panel-inicio";
import { TransicionVista } from "@/componentes/transicion-vista";
import { cargarPanelInicio } from "@/lib/inicio/cargar";
import { fechaHoy } from "@/lib/etapas";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida, sincronizarSesionParaLectura } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inicio",
};

export default async function PaginaInicioCultivo() {
  if (!configuracionLista()) {
    return (
      <section className="inicio">
        <h1>Inicio</h1>
        <p>Falta la configuración de Supabase.</p>
      </section>
    );
  }

  const user = await obtenerSesionRapida();
  if (!user) redirect("/ingreso");

  const supabase = await crearClienteServidor();
  const sesion = await sincronizarSesionParaLectura(supabase);
  if (!sesion.ok && sesion.tipo === "sin_sesion") redirect("/ingreso");
  if (!sesion.ok) {
    return (
      <section className="inicio">
        <h1>Inicio</h1>
        <p className="inicio__error" role="alert">
          No se pudo confirmar la sesión.
        </p>
      </section>
    );
  }

  let panel;
  try {
    panel = await cargarPanelInicio(supabase, sesion.userId, { hoy: fechaHoy() });
  } catch {
    return (
      <section className="inicio">
        <h1>Inicio</h1>
        <p className="inicio__error" role="alert">
          No se pudo cargar el inicio.
        </p>
      </section>
    );
  }

  return (
    <TransicionVista>
      <PanelInicio panel={panel} />
    </TransicionVista>
  );
}
