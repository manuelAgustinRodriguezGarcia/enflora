import { notFound, redirect } from "next/navigation";
import { ListaContactos } from "@/componentes/expo-admin/lista-contactos";
import { PanelExpo } from "@/componentes/expo-admin/panel-expo";
import { ProveedorMotion } from "@/componentes/proveedor-motion";
import { clienteContactos, listarContactos, resumenContactos } from "@/lib/contactos/datos";
import { esAdministradorExpo, obtenerPanelExpo, presentarProductos } from "@/lib/expo-cannabis/admin";
import { obtenerUsuario } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Expo Cannabis",
  robots: { index: false, follow: false },
};

async function contactosIniciales() {
  const supabase = clienteContactos();
  if (!supabase) return { ok: false, error: "El servicio de contactos no está configurado." };
  const [listado, resumen] = await Promise.all([listarContactos(supabase, {}), resumenContactos(supabase)]);
  if (!listado.ok || !resumen.ok) {
    return { ok: false, error: "No pudimos cargar los contactos. Verificá que la migración supabase/contactos.sql esté aplicada." };
  }
  return {
    ok: true,
    filas: listado.filas,
    total: listado.total,
    pagina: listado.pagina,
    paginas: listado.paginas,
    tamano: listado.tamano,
    consulta: listado.consulta,
    resumen: resumen.resumen,
  };
}

export default async function PaginaAdminExpo() {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/ingreso?siguiente=/expo-cannabis/admin");
  if (!esAdministradorExpo(usuario)) notFound();

  const [panel, contactos] = await Promise.all([obtenerPanelExpo(), contactosIniciales()]);

  return (
    <ProveedorMotion>
      <PanelExpo
        productos={presentarProductos(panel.productos)}
        participantes={panel.participantes}
        partidas={panel.partidas}
        aviso={panel.error || ""}
      >
        <ListaContactos inicial={contactos} />
      </PanelExpo>
    </ProveedorMotion>
  );
}
