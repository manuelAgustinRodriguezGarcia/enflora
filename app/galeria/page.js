import { redirect } from "next/navigation";
import { PanelGaleriaFlora } from "@/componentes/galeria/panel-galeria-flora";
import { TransicionVista } from "@/componentes/transicion-vista";
import { listarContextosGaleria, listarPaginaGaleria } from "@/lib/galeria-flora-servidor";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida, sincronizarSesionParaLectura } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Galería de Flora",
};

export default async function PaginaGaleria() {
  if (!configuracionLista()) {
    return (
      <section className="galeria-flora">
        <header className="galeria-flora__cabecera">
          <h1>Galería de Flora</h1>
          <p>Falta la configuración de Supabase.</p>
        </header>
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
      <section className="galeria-flora">
        <header className="galeria-flora__cabecera">
          <h1>Galería de Flora</h1>
          <p className="galeria-flora__error" role="alert">
            No se pudo confirmar la sesión.
          </p>
        </header>
      </section>
    );
  }

  const [contextos, pagina] = await Promise.all([
    listarContextosGaleria(supabase),
    listarPaginaGaleria(supabase, sesion.userId, {}),
  ]);

  return (
    <TransicionVista>
      <PanelGaleriaFlora
        fotosIniciales={pagina.fotos || []}
        hayMasInicial={Boolean(pagina.hay_mas)}
        cursorInicial={pagina.cursor || null}
        espacios={contextos.espacios || []}
        unidades={contextos.unidades || []}
        errorInicial={!pagina.ok ? pagina.error : contextos.ok ? "" : ""}
        avisoFiltros={contextos.ok ? "" : contextos.error}
      />
    </TransicionVista>
  );
}
