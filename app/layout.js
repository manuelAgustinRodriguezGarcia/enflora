import { Fredoka, Inter } from "next/font/google";
import { headers } from "next/headers";
import Link from "next/link";
import { BotonNotificaciones } from "@/componentes/boton-notificaciones";
import { BottomNav } from "@/componentes/bottom-nav";
import { ModalAccesoPrelanzamiento } from "@/componentes/modal-acceso-prelanzamiento";
import { ProveedorMotion } from "@/componentes/proveedor-motion";
import { usuarioBloqueadoPrelanzamiento } from "@/lib/acceso-prelanzamiento";
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
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function Layout({ children }) {
  const ruta = (await headers()).get("x-enflora-ruta");

  if (ruta === "/" || ruta?.startsWith("/expo-cannabis/")) {
    const claseCuerpo =
      ruta === "/" ? "landing-cuerpo" : ruta === "/expo-cannabis/admin" ? "expo-admin-cuerpo" : "ruleta-cuerpo";
    return (
      <html lang="es" className={`${fredoka.variable} ${inter.variable}`}>
        <body className={claseCuerpo}>{children}</body>
      </html>
    );
  }

  const usuario = configuracionLista() ? await obtenerUsuario() : null;
  const bloqueado = usuarioBloqueadoPrelanzamiento(usuario, ruta);

  return (
    <html lang="es" className={`${fredoka.variable} ${inter.variable}`}>
      <body>
        <ProveedorMotion>
        <header className="encabezado" inert={bloqueado || undefined}>
          <Link
            className="encabezado__marca"
            href={usuario && !bloqueado ? "/espacios" : "/"}
          >
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
          {usuario && !bloqueado ? <BotonNotificaciones /> : null}
        </header>
        <main className="pagina" inert={bloqueado || undefined}>
          {children}
        </main>
        {usuario && !bloqueado ? <BottomNav /> : null}
        <ModalAccesoPrelanzamiento abierto={bloqueado} />
        </ProveedorMotion>
      </body>
    </html>
  );
}
