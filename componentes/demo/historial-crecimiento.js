"use client";

import { Dialog } from "@base-ui/react/dialog";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Boton } from "@/componentes/boton";
import { IconoChevron, IconoPausa, IconoReproducir, IconoVideo } from "@/componentes/iconos-ui";
import { IndicadorEtapa } from "@/componentes/indicador-etapa";
import { textoDiaCultivo } from "@/lib/demo/historial/historial-demo";
import { formatearFecha } from "@/lib/etapas";

const INTERVALO_BASE = 900;
const PRECARGA = 4;
const VELOCIDADES = [
  { valor: 0.5, etiqueta: "0,5×" },
  { valor: 1, etiqueta: "1×" },
  { valor: 2, etiqueta: "2×" },
];

function precargar(foto) {
  if (!foto || typeof window === "undefined") return;
  const imagen = new window.Image();
  imagen.src = foto.url;
}

export function HistorialCrecimiento({ historial }) {
  const [abierto, setAbierto] = useState(false);
  const [indice, setIndice] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const fotos = historial.fotos;
  const etapaPorDia = useMemo(() => new Map(historial.dias.map((dia) => [dia.id, dia.etapa])), [historial]);
  const foto = fotos[indice] || null;
  const ultimo = indice >= fotos.length - 1;
  const total = fotos.length;

  useEffect(() => {
    if (!abierto || !reproduciendo) return undefined;
    const temporizador = window.setTimeout(() => {
      if (indice >= total - 1) {
        setReproduciendo(false);
        return;
      }
      setIndice(indice + 1);
    }, INTERVALO_BASE / velocidad);
    return () => window.clearTimeout(temporizador);
  }, [abierto, reproduciendo, indice, total, velocidad]);

  useEffect(() => {
    if (!abierto) return;
    for (let paso = 1; paso <= PRECARGA; paso += 1) precargar(fotos[indice + paso]);
  }, [abierto, indice, fotos]);

  function abrir() {
    setIndice(0);
    setReproduciendo(true);
    setAbierto(true);
  }

  function alternar() {
    if (ultimo) {
      setIndice(0);
      setReproduciendo(true);
      return;
    }
    setReproduciendo((actual) => !actual);
  }

  function ir(destino) {
    setReproduciendo(false);
    setIndice(Math.max(0, Math.min(total - 1, destino)));
  }

  function manejarTecla(evento) {
    if (evento.key === " " || evento.key === "k") {
      evento.preventDefault();
      alternar();
    }
    if (evento.key === "ArrowLeft") {
      evento.preventDefault();
      ir(indice - 1);
    }
    if (evento.key === "ArrowRight") {
      evento.preventDefault();
      ir(indice + 1);
    }
  }

  if (!total) return null;

  return (
    <>
      <Boton type="button" variante="secundario" className="boton--ancho historial-crecimiento__abrir" onClick={abrir}>
        <IconoVideo className="historial-crecimiento__icono" />
        Ver crecimiento
      </Boton>
      <Dialog.Root
        open={abierto}
        onOpenChange={(valor) => {
          setAbierto(valor);
          if (!valor) setReproduciendo(false);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="historial-visor__fondo" />
          <Dialog.Viewport className="historial-visor__vista">
            <Dialog.Popup className="historial-visor historial-crecimiento" onKeyDown={manejarTecla}>
              {foto ? (
                <>
                  <header className="historial-visor__cabecera">
                    <div className="historial-visor__textos">
                      <Dialog.Title className="historial-visor__titulo">Crecimiento de {historial.cultivo.nombre}</Dialog.Title>
                      <Dialog.Description className="historial-visor__contador">
                        {total} fotos, desde el {textoDiaCultivo(fotos[0].dia).toLowerCase()} hasta el{" "}
                        {textoDiaCultivo(fotos[total - 1].dia).toLowerCase()}
                      </Dialog.Description>
                    </div>
                    <Dialog.Close className="historial-visor__cerrar demo-pulsable" aria-label="Cerrar animación">
                      <span aria-hidden="true">×</span>
                    </Dialog.Close>
                  </header>
                  <figure className="historial-visor__figura historial-crecimiento__figura">
                    <Image
                      key={foto.id}
                      src={foto.url}
                      alt={`Foto del cultivo en el ${textoDiaCultivo(foto.dia).toLowerCase()}`}
                      width={foto.ancho}
                      height={foto.alto}
                      unoptimized
                      priority
                      draggable={false}
                      className="historial-visor__imagen"
                    />
                    <figcaption className="historial-crecimiento__pie" aria-live="polite">
                      <span className="historial-crecimiento__dia">{textoDiaCultivo(foto.dia)}</span>
                      <span className="historial-crecimiento__fecha">{formatearFecha(foto.fecha)}</span>
                      {etapaPorDia.get(foto.diaId) ? (
                        <IndicadorEtapa etapa={etapaPorDia.get(foto.diaId)} tamano="compacto" />
                      ) : null}
                    </figcaption>
                  </figure>
                  <div className="historial-crecimiento__controles">
                    <label className="historial-crecimiento__progreso">
                      <span className="demo__sr">Posición en la animación</span>
                      <input
                        type="range"
                        min={0}
                        max={total - 1}
                        step={1}
                        value={indice}
                        onChange={(evento) => ir(Number(evento.target.value))}
                        aria-valuetext={`Foto ${indice + 1} de ${total}, ${textoDiaCultivo(foto.dia)}`}
                      />
                    </label>
                    <div className="historial-crecimiento__fila">
                      <button
                        type="button"
                        className="historial-visor__control demo-pulsable"
                        onClick={() => ir(indice - 1)}
                        disabled={indice === 0}
                        aria-label="Foto anterior"
                      >
                        <IconoChevron />
                      </button>
                      <button
                        type="button"
                        className="historial-visor__control historial-crecimiento__reproducir demo-pulsable"
                        onClick={alternar}
                        aria-label={ultimo ? "Volver a empezar" : reproduciendo ? "Pausar" : "Reproducir"}
                      >
                        {reproduciendo ? <IconoPausa /> : <IconoReproducir />}
                      </button>
                      <button
                        type="button"
                        className="historial-visor__control historial-visor__control--siguiente demo-pulsable"
                        onClick={() => ir(indice + 1)}
                        disabled={ultimo}
                        aria-label="Foto siguiente"
                      >
                        <IconoChevron />
                      </button>
                      <div className="historial-crecimiento__velocidades" role="group" aria-label="Velocidad">
                        {VELOCIDADES.map((item) => (
                          <button
                            key={item.valor}
                            type="button"
                            className={`historial-crecimiento__velocidad demo-pulsable${
                              item.valor === velocidad ? " historial-crecimiento__velocidad--activa" : ""
                            }`}
                            aria-pressed={item.valor === velocidad}
                            onClick={() => setVelocidad(item.valor)}
                          >
                            {item.etiqueta}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="historial-crecimiento__contador">
                      Foto {indice + 1} de {total}
                      {ultimo ? " · Fin del recorrido" : ""}
                    </p>
                  </div>
                </>
              ) : null}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
