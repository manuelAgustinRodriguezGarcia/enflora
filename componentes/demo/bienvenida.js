"use client";

import Image from "next/image";
import { Boton, EnlaceBoton } from "@/componentes/boton";
import { IconoNavegacion } from "@/componentes/icono-navegacion";
import { IconoCalendario, IconoReproducir } from "@/componentes/iconos-ui";
import { MarcaEnflora } from "@/componentes/marca-enflora";
import { TransicionVista } from "@/componentes/transicion-vista";
import { useDemo } from "@/componentes/demo/proveedor-demo";

const MODULOS = [
  {
    id: "cultivos",
    titulo: "Mis cultivos",
    texto: "Espacios, unidades y plantas en un solo lugar.",
    icono: "espacios",
  },
  {
    id: "registros",
    titulo: "Registros",
    texto: "Actividades y parámetros de cada cultivo.",
    icono: "registro",
  },
  {
    id: "historial",
    titulo: "Historial",
    texto: "La evolución de un cultivo a lo largo del tiempo.",
    icono: "historial",
  },
];

function IconoModulo({ icono }) {
  if (icono === "historial") return <IconoCalendario />;
  return <IconoNavegacion clave={icono} />;
}

export function Bienvenida() {
  const { estado, comenzar } = useDemo();

  return (
    <TransicionVista>
      <section className="demo">
        <div className="demo__flora">
          <Image
            src="/images/demo-flora.png"
            alt="Flora plantando una semilla"
            width={1075}
            height={1070}
            priority
            sizes="(max-width: 48rem) 55vw, 14rem"
          />
        </div>
        <div className="demo__intro">
          <h1>Probá <MarcaEnflora />.</h1>
          <p className="demo__bajada">
            Descubrí cómo organizar tus cultivos, registrar actividades y explorar su evolución. Sin
            registrarte.
          </p>
        </div>
        <ol className="demo__modulos" aria-label="Qué vas a ver en la demo">
          {MODULOS.map((modulo, posicion) => (
            <li key={modulo.id} className="demo__modulo">
              <span className="demo__numero" aria-hidden="true">
                {posicion + 1}
              </span>
              <span className="demo__copia">
                <span className="demo__paso">Paso {posicion + 1}</span>
                <span className="demo__titulo">{modulo.titulo}</span>
                <span className="demo__detalle">{modulo.texto}</span>
              </span>
              <span className="demo__simbolo" aria-hidden="true">
                <IconoModulo icono={modulo.icono} />
              </span>
            </li>
          ))}
        </ol>
        <div className="demo__acciones">
          <Boton type="button" className="boton--ancho demo__comenzar" onClick={comenzar}>
            <IconoReproducir className="demo__comenzar-icono" />
            {estado.espacios.length ? "Continuar demo" : "Comenzar demo"}
          </Boton>
          <EnlaceBoton href="/#producto" variante="secundario" className="boton--ancho">
            Volver a Enflora
          </EnlaceBoton>
        </div>
        <p className="demo__aviso">
          Esto es una demostración. Los datos que generes son simulados y quedan solo en este
          navegador. La versión final de Enflora tiene otro estilo pero la misma funcionalidad.
        </p>
      </section>
    </TransicionVista>
  );
}