import { Fredoka, Inter } from "next/font/google";
import Link from "next/link";
import { salir } from "@/app/acciones/sesion";
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
  title: "Enflora",
  description: "Espacios de cultivo y plantas",
};

export default async function Layout({ children }) {
  const usuario = configuracionLista() ? await obtenerUsuario() : null;

  return (
    <html lang="es" className={`${fredoka.variable} ${inter.variable}`}>
      <body>
        <header className="encabezado">
          <Link className="encabezado__marca" href={usuario ? "/espacios" : "/entrar"}>
            <img src="/enflora-logo-apaisado.svg" alt="Enflora" />
          </Link>
          {usuario ? (
            <div className="encabezado__acciones">
              <Link href="/perfil">Perfil</Link>
              <form action={salir}>
                <button type="submit">Salir</button>
              </form>
            </div>
          ) : null}
        </header>
        <main className="pagina">{children}</main>
      </body>
    </html>
  );
}
