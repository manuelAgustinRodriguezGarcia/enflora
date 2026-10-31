import { notFound, redirect } from "next/navigation";
import { ListaContactos } from "@/componentes/expo-admin/lista-contactos";
import { PanelExpo } from "@/componentes/expo-admin/panel-expo";
import { ProveedorMotion } from "@/componentes/proveedor-motion";
import { MOTIVOS_ADMIN } from "@/lib/admin/reglas";
import { obtenerAdminExpo, obtenerPanelExpo, presentarProductos } from "@/lib/expo-cannabis/admin";
import { operacionesContactosAdmin } from "@/lib/expo-cannabis/contactos-admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Expo Cannabis",
  robots: { index: false, follow: false },
};

async function contactosIniciales(admin) {
  const contactos = operacionesContactosAdmin(admin);
  if (!contactos) return { ok: false, error: "El servicio de contactos no está configurado." };
  const [listado, resumen] = await Promise.all([contactos.listar({}), contactos.resumen()]);
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
  const autorizacion = await obtenerAdminExpo();
  if (!autorizacion.ok) {
    if (autorizacion.motivo === MOTIVOS_ADMIN.sinSesion) redirect("/ingreso?siguiente=/expo-cannabis/admin");
    notFound();
  }
  const admin = autorizacion.credencial;

  const [panel, contactos] = await Promise.all([obtenerPanelExpo(admin), contactosIniciales(admin)]);

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
