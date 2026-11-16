"use client";

import { listarGuias } from "@/lib/guias/catalogo";
import { etiquetaEstado, reiniciaAlIniciar, textoAccionGuia } from "@/lib/guias/maquina";
import { useGuias } from "@/lib/guias/tienda";

export function PanelGuias() {
  const guias = useGuias();
  const lista = listarGuias();

  return (
    <section className="guias-perfil" aria-labelledby="guias-perfil-titulo">
      <h2 id="guias-perfil-titulo">Guías de Enflora</h2>
      <p>Volvé a recorrer la app cuando quieras. Si ya tenés cultivos, las guías explican los controles sin crear datos de ejemplo.</p>
      {!guias.listo ? <p className="guias-perfil__estado">Cargando guías…</p> : null}
      {guias.listo ? (
        <ul className="guias-perfil__lista">
          {lista.map((guia) => {
            const fila = guias.progreso?.[guia.id];
            const estado = fila?.estado || "no_iniciado";
            return (
              <li key={guia.id} className="guias-perfil__item">
                <div>
                  <p className="guias-perfil__titulo">{guia.titulo}</p>
                  <p className="guias-perfil__detalle">{guia.descripcion}</p>
                  <p className="guias-perfil__estado">{etiquetaEstado(estado)}</p>
                </div>
                <button
                  type="button"
                  className="boton boton--secundario"
                  onClick={() => guias.iniciar(guia.id, reiniciaAlIniciar(estado))}
                >
                  {textoAccionGuia(estado)}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
