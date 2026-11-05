"use client";

import { useEffect, useState } from "react";
import { guardarInteresClima, quitarLocalidadUsuario } from "@/app/cultivos/[id]/clima/acciones";
import { BusquedaLocalidad } from "@/componentes/clima/busqueda-localidad";
import { mensajeClima } from "@/lib/clima/constantes";

export function SeccionClimaPerfil({ clima }) {
  const verServidor = clima?.verClima !== false;
  const [verClima, setVerClima] = useState(verServidor);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState("");

  useEffect(() => {
    setVerClima(verServidor);
  }, [verServidor]);

  async function alternar() {
    if (guardando) return;
    const siguiente = !verClima;
    setVerClima(siguiente);
    setFallo("");
    setGuardando(true);
    const resultado = await guardarInteresClima(siguiente);
    setGuardando(false);
    if (!resultado?.ok) {
      setVerClima(!siguiente);
      setFallo(resultado?.mensaje || "No se pudo guardar la preferencia.");
    }
  }

  const avisoCarga =
    clima?.estado === "error" || clima?.preferenciaEstado === "error"
      ? "No se pudo cargar el clima."
      : clima?.estado === "no_disponible"
        ? mensajeClima("no_disponible")
        : "";
  const aviso = fallo || avisoCarga;
  const textoInteres = verClima ? "Me interesa ver el clima" : "No me interesa ver el clima";

  return (
    <section className="perfil-clima" id="clima" aria-labelledby="perfil-clima-titulo">
      <h2 id="perfil-clima-titulo">Clima</h2>
      <div className="estado-toggle">
        <span className={`estado-toggle__texto${verClima ? "" : " estado-toggle__texto--apagado"}`}>{textoInteres}</span>
        <button
          type="button"
          className={`estado-toggle__boton${verClima ? " estado-toggle__boton--activo" : ""}`}
          role="switch"
          aria-checked={verClima}
          aria-label={textoInteres}
          disabled={guardando}
          onClick={alternar}
        >
          <span className="estado-toggle__pulgar" />
        </button>
      </div>

      {aviso ? <p className="perfil-clima__aviso">{aviso}</p> : null}

      {verClima ? (
        <>
          <p className="perfil-clima__intro">Elegí tu ciudad para ver el clima.</p>
          <div className="perfil-clima__espacio">
            <h3>Tu localidad</h3>
            <p className="perfil-clima__lugar">{clima?.localidad || "Sin localidad"}</p>
            <BusquedaLocalidad
              destino="usuario"
              tieneLocalidad={Boolean(clima?.localidad)}
              idCampo="clima-localidad-usuario"
              etiqueta="Localidad"
            />
            {clima?.localidad ? (
              <form action={quitarLocalidadUsuario}>
                <button type="submit" className="clima__texto">
                  Quitar ubicación
                </button>
              </form>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
