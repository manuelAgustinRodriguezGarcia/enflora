import { Fredoka, Inter } from "next/font/google";
import { headers } from "next/headers";
import { BotonNotificaciones } from "@/componentes/boton-notificaciones";
import { EnlacePerfil } from "@/componentes/enlace-perfil";
import { RegistroServiceWorker } from "@/componentes/registro-service-worker";
import { MarcaEncabezado } from "@/componentes/marca-encabezado";
import { AjusteTecladoViewport } from "@/componentes/ajuste-teclado-viewport";
import { BottomNav } from "@/componentes/bottom-nav";
import { ClaseCuerpo } from "@/componentes/clase-cuerpo";
import { ModalAccesoPrelanzamiento } from "@/componentes/modal-acceso-prelanzamiento";
import { ProveedorGuardSalidaFlora } from "@/componentes/flora/proveedor-guard-salida-flora";
import { ProveedorMotion } from "@/componentes/proveedor-motion";
import { esRutaDemo, usuarioBloqueadoPrelanzamiento } from "@/lib/acceso-prelanzamiento";
import { RUTA_INICIO } from "@/lib/navegacion";
import { esRutaPanelAdmin } from "@/lib/admin/secciones";
import { DESCRIPCION_INICIO, NOMBRE_MARCA } from "@/lib/seo";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { obtenerSesionRapida } from "@/lib/supabase/servidor";
import "@/estilos/principal.scss";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fredoka",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL("https://enflora.com.ar"),
  title: {
    default: NOMBRE_MARCA,
    template: `%s | ${NOMBRE_MARCA}`,
  },
  description: DESCRIPCION_INICIO,
  applicationName: NOMBRE_MARCA,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/icon.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: NOMBRE_MARCA,
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: NOMBRE_MARCA,
    images: [
      {
        url: "/og/enflora.png",
        width: 1200,
        height: 630,
        alt: `${NOMBRE_MARCA}, aplicación de seguimiento de cultivos de cannabis`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/enflora.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

function claseInicial(ruta) {
  if (ruta === "/") return "landing-cuerpo";
  if (esRutaPanelAdmin(ruta)) return "admin-cuerpo";
  if (ruta === "/expo-cannabis/admin") return "expo-admin-cuerpo";
  if (ruta.startsWith("/expo-cannabis/")) return "ruleta-cuerpo";
  return "";
}

export default async function Layout({ children }) {
  const ruta = (await headers()).get("x-enflora-ruta") || "";
  const esDemo = esRutaDemo(ruta);
  const esShellPublico = ruta === "/" || ruta.startsWith("/expo-cannabis/") || esDemo || esRutaPanelAdmin(ruta);
  const conSupabase = configuracionLista();
  const usuario = !esShellPublico && conSupabase ? await obtenerSesionRapida() : null;
  const bloqueado = usuarioBloqueadoPrelanzamiento(usuario, ruta);
  const claseCuerpo = claseInicial(ruta);

  return (
    <html lang="es-AR" className={`${fredoka.variable} ${inter.variable}`}>
      <body className={claseCuerpo || undefined}>
        <ClaseCuerpo />
        <AjusteTecladoViewport />
        <RegistroServiceWorker />
        <ProveedorMotion>
          <ProveedorGuardSalidaFlora>
          <header className="encabezado" inert={bloqueado || undefined}>
            <MarcaEncabezado
              alt={NOMBRE_MARCA}
              href={usuario && !bloqueado && !esDemo ? RUTA_INICIO : "/"}
            />
            <div className="encabezado__acciones">
              {conSupabase ? <BotonNotificaciones oculto={bloqueado} /> : null}
              {usuario && !bloqueado ? (
                <EnlacePerfil usuarioId={usuario.id} email={usuario.email} />
              ) : null}
            </div>
          </header>
          <main className="pagina" inert={bloqueado || undefined}>
            {children}
          </main>
          {conSupabase ? <BottomNav oculto={bloqueado} /> : null}
          <ModalAccesoPrelanzamiento abierto={bloqueado} />
          </ProveedorGuardSalidaFlora>
        </ProveedorMotion>
      </body>
    </html>
  );
}
