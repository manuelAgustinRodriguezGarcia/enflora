"use client";

import { useActionState, useState } from "react";
import { cambiarEtapa } from "@/app/espacios/[id]/acciones";
import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { IconoFlecha } from "@/componentes/iconos-ui";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { ETAPAS, fechaHoy } from "@/lib/etapas";

export function EtapaProgreso({
  etapa,
  dia = null,
  inicio = "",
  plantaId = "",
  unidadId = "",
  espacioId = "",
}) {
  const indice = ETAPAS.findIndex((item) => item.valor === etapa);
  const siguiente = indice >= 0 && indice < ETAPAS.length - 1 ? ETAPAS[indice + 1] : null;
  const esFinal = etapa === "finalizado";
  const puedeAvanzar = Boolean(!esFinal && siguiente && plantaId && unidadId && espacioId);
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(cambiarEtapa, null);
  const mostrarPie = dia !== null || Boolean(inicio);

  return (
    <section className="etapa-progreso" aria-labelledby="etapa-progreso-titulo">
      <div className="etapa-progreso__avance">
        <div className="etapa-progreso__bloque">
          <p className="etapa-progreso__etiqueta" id="etapa-progreso-titulo">
            Etapa actual
          </p>
          <IndicadorEtapa etapa={etapa} tamano="normal" animar />
        </div>
        {puedeAvanzar ? (
          <button
            type="button"
            className={`etapa-progreso__siguiente etapa-progreso__siguiente--${siguiente.valor}`}
            onClick={() => setAbierto(true)}
            aria-label={`Pasar a ${siguiente.etiqueta}`}
          >
            <p className="etapa-progreso__etiqueta">Siguiente etapa</p>
            <IndicadorEtapa etapa={siguiente.valor} tamano="compacto" />
          </button>
        ) : null}
      </div>
      {mostrarPie ? (
        <div className="etapa-progreso__pie">
          {inicio ? <p className="etapa-progreso__inicio">Inicio: {inicio}</p> : <span />}
          {dia === null ? null : <p className="etapa-progreso__dia">Día {dia}</p>}
        </div>
      ) : null}
      {puedeAvanzar ? (
        <ModalConfirmacion
          abierto={abierto}
          onCerrar={() => setAbierto(false)}
          titulo={`¿Seguro que querés pasar a la etapa ${siguiente.etiqueta}?`}
          textoConfirmar="Pasar"
          pendiente={pendiente}
          error={estado?.error || ""}
          accion={accion}
          varianteIcono="etapas"
          icono={
            <>
              <IndicadorEtapa etapa={etapa} soloIcono />
              <IconoFlecha />
              <IndicadorEtapa etapa={siguiente.valor} soloIcono />
            </>
          }
        >
          <input type="hidden" name="planta_id" value={plantaId} />
          <input type="hidden" name="unidad_id" value={unidadId} />
          <input type="hidden" name="espacio_id" value={espacioId} />
          <input type="hidden" name="etapa" value={siguiente.valor} />
          <input type="hidden" name="fecha_inicio" value={fechaHoy()} />
        </ModalConfirmacion>
      ) : null}
    </section>
  );
}
