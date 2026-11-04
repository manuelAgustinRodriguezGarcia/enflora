"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Droplets, Eye, PenLine, Scissors, Sprout } from "lucide-react";
import { formatearFecha } from "@/lib/etapas";
import { desplazarMes, grillaMes, hrefCalendario, hrefDia, nombreMes, tituloMes } from "@/lib/calendario/modelo";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const ICONOS = {
  riego: Droplets,
  fertilizacion: Sprout,
  poda: Scissors,
  revision: Eye,
  personalizada: PenLine,
};

const MESES = Array.from({ length: 12 }, (_, indice) => {
  const numero = String(indice + 1).padStart(2, "0");
  return { numero, etiqueta: nombreMes(`2000-${numero}`) };
});

function tareasPorFecha(tareas) {
  const mapa = new Map();
  for (const tarea of tareas || []) {
    const fecha = String(tarea.fecha || "").slice(0, 10);
    const lista = mapa.get(fecha) || [];
    lista.push(tarea);
    mapa.set(fecha, lista);
  }
  return mapa;
}

function etiquetaDia(fecha, cantidad) {
  const base = formatearFecha(fecha);
  if (!cantidad) return base;
  return cantidad === 1 ? `${base}, 1 tarea` : `${base}, ${cantidad} tareas`;
}

function hrefMes(filtros, mes) {
  return hrefCalendario({
    mes,
    unidad: filtros.unidad,
    estado: filtros.estado,
  });
}

function elegirEnlace(evento, accion) {
  if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey || evento.button !== 0) return;
  evento.preventDefault();
  accion();
}

export function TarjetaMes({ filtros, tareasMes, tareasDia, onMes, onDia }) {
  const anioVisible = Number(String(filtros.mes).slice(0, 4)) || new Date().getFullYear();
  const mesVisible = String(filtros.mes).slice(5, 7);
  const [abierto, setAbierto] = useState(false);
  const [anio, setAnio] = useState(anioVisible);
  const porFecha = tareasPorFecha(tareasMes);
  const celdas = grillaMes(filtros.mes);
  const mesAnterior = desplazarMes(filtros.mes, -1);
  const mesSiguiente = desplazarMes(filtros.mes, 1);
  const anios = [anioVisible - 2, anioVisible - 1, anioVisible, anioVisible + 1, anioVisible + 2];

  useEffect(() => {
    setAbierto(false);
    setAnio(anioVisible);
  }, [anioVisible, filtros.mes]);

  useEffect(() => {
    if (!abierto) return undefined;
    function cerrar(evento) {
      if (evento.key === "Escape") setAbierto(false);
    }
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [abierto]);

  return (
    <section className="calendario__mes" aria-labelledby="calendario-mes">
      <div className="calendario__mes-nav">
        <a
          className="calendario__flecha"
          href={hrefMes(filtros, mesAnterior)}
          aria-label={`Mes anterior, ${nombreMes(mesAnterior)}`}
          onClick={(evento) => elegirEnlace(evento, () => onMes(mesAnterior))}
        >
          <ChevronLeft size={20} />
        </a>
        <button
          id="calendario-mes"
          type="button"
          className={abierto ? "calendario__mes-titulo calendario__mes-titulo--abierto" : "calendario__mes-titulo"}
          aria-expanded={abierto}
          aria-controls="calendario-selector-mes"
          onClick={() => setAbierto((valor) => !valor)}
        >
          <span>{tituloMes(filtros.mes)}</span>
          <ChevronDown size={18} />
        </button>
        <a
          className="calendario__flecha"
          href={hrefMes(filtros, mesSiguiente)}
          aria-label={`Mes siguiente, ${nombreMes(mesSiguiente)}`}
          onClick={(evento) => elegirEnlace(evento, () => onMes(mesSiguiente))}
        >
          <ChevronRight size={20} />
        </a>
      </div>

      <div className="calendario__semana" aria-hidden="true">
        {DIAS.map((dia) => (
          <span key={dia}>{dia}</span>
        ))}
      </div>

      <div className="calendario__marco">
        <div className="calendario__grilla">
          {celdas.map((celda) => {
            const tareas = porFecha.get(celda.fecha) || [];
            const seleccionado = filtros.fecha === celda.fecha;
            const hoy = filtros.hoy === celda.fecha;
            const clase = [
              "calendario__dia",
              celda.enMes ? "" : "calendario__dia--fuera",
              tareas.length ? "calendario__dia--con-tareas" : "",
              seleccionado ? "calendario__dia--seleccionado" : "",
              hoy ? "calendario__dia--hoy" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const visibles = tareas.slice(0, 2);
            const sobran = tareas.length - visibles.length;
            return (
              <a
                key={celda.fecha}
                href={hrefDia(filtros, celda.fecha)}
                className={clase}
                aria-current={hoy ? "date" : undefined}
                aria-label={etiquetaDia(celda.fecha, tareas.length)}
                onClick={(evento) => elegirEnlace(evento, () => onDia(celda.fecha))}
              >
                <span className="calendario__numero">{Number(celda.fecha.slice(-2))}</span>
                {tareas.length ? (
                  <span className="calendario__iconos" aria-hidden="true">
                    {visibles.map((tarea) => {
                      const Icono = ICONOS[tarea.tipo] || PenLine;
                      return (
                        <span key={tarea.id} className="calendario__icono">
                          <Icono size={12} strokeWidth={2.4} />
                        </span>
                      );
                    })}
                    {sobran > 0 ? <span className="calendario__sobran">+{sobran}</span> : null}
                  </span>
                ) : null}
              </a>
            );
          })}
        </div>

        <div
          id="calendario-selector-mes"
          className={abierto ? "calendario__picker calendario__picker--abierto" : "calendario__picker"}
          role="group"
          aria-label="Elegir mes"
          aria-hidden={abierto ? undefined : true}
          inert={!abierto}
        >
          <div className="calendario__anios">
            {anios.map((valor) => (
              <button
                key={valor}
                type="button"
                className={valor === anio ? "calendario__chip calendario__chip--activo" : "calendario__chip"}
                aria-pressed={valor === anio}
                onClick={() => setAnio(valor)}
              >
                {valor}
              </button>
            ))}
          </div>
          <div className="calendario__meses">
            {MESES.map((mes) => {
              const activo = anio === anioVisible && mes.numero === mesVisible;
              return (
                <a
                  key={mes.numero}
                  className={activo ? "calendario__chip calendario__chip--activo" : "calendario__chip"}
                  href={hrefMes(filtros, `${anio}-${mes.numero}`)}
                  aria-current={activo ? "true" : undefined}
                  onClick={(evento) =>
                    elegirEnlace(evento, () => {
                      setAbierto(false);
                      onMes(`${anio}-${mes.numero}`);
                    })
                  }
                >
                  {mes.etiqueta}
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {filtros.fecha ? (
        <div className="calendario__pie">
          <p className="calendario__pie-fecha">{formatearFecha(filtros.fecha)}</p>
          {tareasDia.length ? (
            <ul>
              {tareasDia.map((tarea) => (
                <li key={tarea.id}>{tarea.descripcion || "Tarea"}</li>
              ))}
            </ul>
          ) : (
            <p>Sin tareas</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
