"use client";

import { motion } from "motion/react";
import { Aparecer } from "@/componentes/aparecer";
import { IconoNavegacion } from "@/componentes/icono-navegacion";
import { IconoPlanta } from "@/componentes/iconos-ui";
import { PillPlantas } from "@/componentes/resumen-configuracion";
import { toque, transicionToque } from "@/lib/animaciones";

const MODOS = [
  { valor: "genetica", etiqueta: "Genética" },
  { valor: "manual", etiqueta: "Manual" },
];

function tituloPlanta(planta) {
  return planta.nombre || `Planta ${planta.numero || ""}`.trim();
}

function geneticaActiva(grupo, idsSeleccionados) {
  return (
    grupo.plantas.length > 0 &&
    grupo.plantas.length === idsSeleccionados.size &&
    grupo.plantas.every((planta) => idsSeleccionados.has(planta.id))
  );
}

export function EditorPlantasRegistro({
  modo,
  grupos,
  plantas,
  idsSeleccionados,
  disabled = false,
  onModo,
  onElegirGenetica,
  onAlternarPlanta,
}) {
  return (
    <div className="registro-crear__editor-plantas">
      <div className="registro-crear__filtros">
        <p className="registro-crear__filtros-titulo">Filtrar por</p>
        <div className="registro-crear__chips" role="group" aria-label="Filtrar por">
          {MODOS.map((item) => (
            <button
              key={item.valor}
              type="button"
              className={`registro-crear__chip${modo === item.valor ? " registro-crear__chip--activo" : ""}`}
              onClick={() => onModo(item.valor)}
              disabled={disabled}
              aria-pressed={modo === item.valor}
            >
              {item.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <Aparecer visible={modo === "genetica" && grupos.length > 0}>
        <div className="registro-crear__geneticas" role="group" aria-label="Genéticas de la unidad">
          {grupos.map((grupo) => {
            const activo = geneticaActiva(grupo, idsSeleccionados);
            return (
              <button
                key={grupo.clave}
                type="button"
                className={`registro-crear__genetica${activo ? " registro-crear__genetica--activa" : ""}`}
                onClick={() => onElegirGenetica(grupo.clave)}
                disabled={disabled}
                aria-pressed={activo}
              >
                <IconoNavegacion clave="geneticas" />
                <span className="registro-crear__genetica-nombre">{grupo.etiqueta}</span>
                <PillPlantas cantidad={grupo.plantas.length} />
              </button>
            );
          })}
        </div>
      </Aparecer>

      <Aparecer visible={modo === "genetica" && grupos.length === 0}>
        <p className="registro-crear__ayuda">
          No hay genéticas cargadas en esta unidad. Usá selección manual.
        </p>
      </Aparecer>

      <Aparecer visible={plantas.length > 0}>
        <div className="registro-crear__plantas-bloque">
          <div className="registro-crear__plantas">
            {plantas.map((planta) => {
              const activa = idsSeleccionados.has(planta.id);
              return (
                <motion.button
                  key={planta.id}
                  type="button"
                  className={`registro-crear__planta${activa ? " registro-crear__planta--activa" : ""}`}
                  onClick={() => onAlternarPlanta(planta.id)}
                  disabled={disabled}
                  aria-pressed={activa}
                  whileTap={disabled ? undefined : toque}
                  transition={transicionToque}
                >
                  <IconoPlanta className="registro-crear__planta-icono" />
                  <span className="registro-crear__planta-texto">
                    <span className="registro-crear__planta-nombre">{tituloPlanta(planta)}</span>
                    {planta.genetica ? (
                      <span className="registro-crear__planta-meta">{planta.genetica}</span>
                    ) : null}
                  </span>
                </motion.button>
              );
            })}
          </div>
          <p className="registro-crear__plantas-cabecera">
            {idsSeleccionados.size} de {plantas.length} plantas seleccionadas
          </p>
        </div>
      </Aparecer>

      <Aparecer visible={plantas.length === 0}>
        <p className="registro-crear__ayuda">Esta unidad todavía no tiene plantas.</p>
      </Aparecer>
    </div>
  );
}
