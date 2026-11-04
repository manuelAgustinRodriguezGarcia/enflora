import { redirect } from "next/navigation";
import { PanelInicio } from "@/componentes/inicio/panel-inicio";
import { TransicionVista } from "@/componentes/transicion-vista";
import { leerPersonalidadFloraUsuario } from "@/lib/flora-personalidad";
import { cargarClimaInicio } from "@/lib/clima/cargar";
import { cargarPanelInicio } from "@/lib/inicio/cargar";
import { cargarFotosInicio } from "@/lib/inicio/fotos";
import { saludoInicio } from "@/lib/inicio/saludo";
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
  let saludo = "Inicio";
  let clima = null;
  let fotos = [];
  try {
    const [panelCargado, personalidad, perfilRes, fotosCargadas] = await Promise.all([
      cargarPanelInicio(supabase, sesion.userId, { hoy: fechaHoy() }),
      leerPersonalidadFloraUsuario(supabase),
      supabase.from("perfiles").select("nombre_usuario, nombre").eq("id", sesion.userId).maybeSingle(),
      cargarFotosInicio(supabase, sesion.userId).catch(() => []),
    ]);
    panel = panelCargado;
    fotos = fotosCargadas;
    const fila = perfilRes?.data;
    const nombre = String(fila?.nombre_usuario || fila?.nombre || "").trim();
    saludo = saludoInicio(personalidad, nombre);
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

  try {
    clima = await cargarClimaInicio(supabase, sesion.userId);
  } catch {
    clima = null;
  }

  return (
    <TransicionVista>
      <PanelInicio panel={panel} saludo={saludo} clima={clima} fotos={fotos} />
    </TransicionVista>
  );
}
