import Link from "next/link";
import { EnlaceBoton } from "@/componentes/boton";
import { TarjetaClima as TarjetaClimaVista } from "@/componentes/clima/tarjeta-clima";
import { mensajeClima } from "@/lib/clima/constantes";

function TarjetaConfigurar() {
  return (
    <li>
      <article className="clima-mini clima-mini--configurar">
        <div className="clima-mini__configurar">
          <p className="clima-mini__configurar-texto">Configurá el clima para que Flora te pueda avisar</p>
          <EnlaceBoton href="/perfil#clima">Ir a clima</EnlaceBoton>
        </div>
      </article>
    </li>
  );
}

function TarjetaSimple({ lugar }) {
  return (
    <li>
      <Link className="clima-mini clima-mini--simple" href={lugar.href}>
        <span className="clima-mini__nombre">{lugar.espacioNombre}</span>
        <span>{lugar.localidad || "Sin localidad"}</span>
        {lugar.linea ? <span>{lugar.linea}</span> : null}
      </Link>
    </li>
  );
}

function TarjetaClima({ lugar }) {
  const detalle = [lugar.region, lugar.pais].map((parte) => String(parte || "").trim()).filter(Boolean).join(", ");

  return (
    <li>
      <TarjetaClimaVista
        nombre={lugar.lugarNombre}
        detalle={detalle}
        actual={lugar.vista?.actual}
        dias={lugar.vista?.dias || []}
        avisoEnflora={lugar.avisoEnflora}
        avisoOficial={lugar.avisoOficial}
        href={lugar.href}
      />
    </li>
  );
}

export function ResumenClimaInicio({ clima }) {
  if (!clima || clima.estado === "oculto") return null;

  const lugares = Array.isArray(clima.lugares) ? clima.lugares : [];
  const listos = lugares.filter((lugar) => lugar.estado === "listo" && lugar.vista);
  const otros = lugares.filter((lugar) => lugar.estado !== "sin_localidad" && !(lugar.estado === "listo" && lugar.vista));
  const sinConfigurar = clima.estado !== "no_disponible" && listos.length === 0 && otros.length === 0;

  return (
    <section className="inicio__seccion" aria-label="Clima">
      {clima.estado === "no_disponible" ? <p className="inicio__vacio">{mensajeClima("no_disponible")}</p> : null}
      {listos.length || otros.length || sinConfigurar ? (
        <ul className="clima-minis">
          {listos.map((lugar) => (
            <TarjetaClima key={lugar.espacioId} lugar={lugar} />
          ))}
          {otros.map((lugar) => (
            <TarjetaSimple key={lugar.espacioId} lugar={lugar} />
          ))}
          {sinConfigurar ? <TarjetaConfigurar /> : null}
        </ul>
      ) : null}
    </section>
  );
}
