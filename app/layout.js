import { Fredoka, Inter } from "next/font/google";
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
  title: "ENFLORA",
  description: "Espacios de cultivo y plantas",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function Layout({ children }) {
  const usuario = configuracionLista() ? await obtenerUsuario() : null;

  return (
    <html lang="es" className={`${fredoka.variable} ${inter.variable}`}>
      <body>
        <ProveedorMotion>
        <header className="encabezado">
          <Link className="encabezado__marca" href={usuario ? "/espacios" : "/ingreso"}>
            <img src="/enflorar-logo-apaisado.svg" alt="ENFLORA" />
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
