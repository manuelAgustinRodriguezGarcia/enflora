import { permanentRedirect } from "next/navigation";
import { RUTA_ADMIN_EXPO } from "@/lib/admin/secciones";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function PaginaAdminExpoLegado() {
  permanentRedirect(RUTA_ADMIN_EXPO);
}
