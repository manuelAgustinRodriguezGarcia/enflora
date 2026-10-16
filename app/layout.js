import { Fredoka, Inter } from "next/font/google";
import { headers } from "next/headers";
import Link from "next/link";
import { BotonNotificaciones } from "@/componentes/boton-notificaciones";
import { BottomNav } from "@/componentes/bottom-nav";
import { ProveedorMotion } from "@/componentes/proveedor-motion";
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
    default: "ENFLORA",
    template: "%s | ENFLORA",
  },
  description: "Espacios de cultivo y plantas",
  applicationName: "ENFLORA",
  appleWebApp: {
    capable: true,
    title: "ENFLORA",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/logos/enflora-isotipo-light.svg",
    apple: "/logos/enflora-isotipo-dark-green.svg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function Layout({ children }) {
  const ruta = (await headers()).get("x-enflora-ruta");

  if (ruta === "/") {
    return (
      <html lang="es" className={`${fredoka.variable} ${inter.variable}`}>
        <body className="landing-cuerpo">{children}</body>
      </html>
    );
  }

  const usuario = configuracionLista() ? await obtenerUsuario() : null;

  return (
    <html lang="es" className={`${fredoka.variable} ${inter.variable}`}>
      <body>
        <ProveedorMotion>
        <header className="encabezado">
          <Link className="encabezado__marca" href={usuario ? "/espacios" : "/"}>
            <img
              className="encabezado__logo encabezado__logo--oscuro"
              src="/logos/enflora-logo-apaisado.svg"
              alt="ENFLORA"
            />
            <img
              className="encabezado__logo encabezado__logo--claro"
              src="/logos/enflora-logo-apaisado-light.svg"
              alt="ENFLORA"
            />
          </Link>
          {usuario ? <BotonNotificaciones /> : null}
        </header>
        <main className="pagina">{children}</main>
        {usuario ? <BottomNav /> : null}
        </ProveedorMotion>
      </body>
    </html>
  );
}
