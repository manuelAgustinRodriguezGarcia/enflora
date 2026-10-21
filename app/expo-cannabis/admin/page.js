import { notFound, redirect } from "next/navigation";
import { PanelExpo } from "@/componentes/expo-admin/panel-expo";
import { ProveedorMotion } from "@/componentes/proveedor-motion";
import { esAdministradorExpo, obtenerPanelExpo, presentarProductos } from "@/lib/expo-cannabis/admin";
import { obtenerUsuario } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Expo Cannabis",
  robots: { index: false, follow: false },
};

export default async function PaginaAdminExpo() {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/ingreso?siguiente=/expo-cannabis/admin");
  if (!esAdministradorExpo(usuario)) notFound();

  const panel = await obtenerPanelExpo();

  return (
    <ProveedorMotion>
      <PanelExpo
        productos={presentarProductos(panel.productos)}
        participantes={panel.participantes}
        partidas={panel.partidas}
        aviso={panel.error || ""}
      />
    </ProveedorMotion>
  );
}
