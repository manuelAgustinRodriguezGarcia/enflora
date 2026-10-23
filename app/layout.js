import { Fredoka, Inter } from "next/font/google";
import { headers } from "next/headers";
import { BotonNotificaciones } from "@/componentes/boton-notificaciones";
import { RegistroServiceWorker } from "@/componentes/registro-service-worker";
import { MarcaEncabezado } from "@/componentes/marca-encabezado";
import { BottomNav } from "@/componentes/bottom-nav";
import { ClaseCuerpo } from "@/componentes/clase-cuerpo";
import { ModalAccesoPrelanzamiento } from "@/componentes/modal-acceso-prelanzamiento";
import { ProveedorMotion } from "@/componentes/proveedor-motion";
import { esRutaDemo, usuarioBloqueadoPrelanzamiento } from "@/lib/acceso-prelanzamiento";
import { NOMBRE_MARCA } from "@/lib/seo";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { obtenerUsuario } from "@/lib/supabase/servidor";
import "@/estilos/principal.scss";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-fredoka",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL("https://enflora.com.ar"),
  title: {
    default: NOMBRE_MARCA,
    template: `%s | ${NOMBRE_MARCA}`,
  },
  description:
    "Aplicación web argentina para organizar, registrar y seguir cultivos de cannabis.",
  applicationName: NOMBRE_MARCA,
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
};

function claseInicial(ruta) {
  if (ruta === "/") return "landing-cuerpo";
  if (ruta === "/expo-cannabis/admin") return "expo-admin-cuerpo";
  if (ruta.startsWith("/expo-cannabis/")) return "ruleta-cuerpo";
  return "";
}

export default async function Layout({ children }) {
  const ruta = (await headers()).get("x-enflora-ruta") || "";
  const esDemo = esRutaDemo(ruta);
  const esShellPublico = ruta === "/" || ruta.startsWith("/expo-cannabis/") || esDemo;
  const conSupabase = configuracionLista();
  const usuario = !esShellPublico && conSupabase ? await obtenerUsuario() : null;
  const bloqueado = usuarioBloqueadoPrelanzamiento(usuario, ruta);
  const claseCuerpo = claseInicial(ruta);

  return (
    <html lang="es-AR" className={`${fredoka.variable} ${inter.variable}`}>
      <body className={claseCuerpo || undefined}>
        <ClaseCuerpo />
        <RegistroServiceWorker />
        <ProveedorMotion>
          <header className="encabezado" inert={bloqueado || undefined}>
            <MarcaEncabezado
              alt={NOMBRE_MARCA}
              confirmarSalida={Boolean(usuario && !bloqueado && !esDemo)}
            />
            {conSupabase ? <BotonNotificaciones oculto={bloqueado} /> : null}
          </header>
          <main className="pagina" inert={bloqueado || undefined}>
            {children}
          </main>
          {conSupabase ? <BottomNav oculto={bloqueado} /> : null}
          <ModalAccesoPrelanzamiento abierto={bloqueado} />
        </ProveedorMotion>
      </body>
    </html>
  );
}
