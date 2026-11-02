"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { crearGeneticaPersonalizada } from "@/app/geneticas/acciones";
import { Boton } from "@/componentes/boton";
import { liberarVista, procesarFoto } from "@/lib/fotos-cliente";
import { MAX_BYTES_IMAGEN_GENETICA } from "@/lib/geneticas/reglas";

function CamposGenetica({ nombreInicial, onCerrar, onCreada }) {
  const [nombre, setNombre] = useState(nombreInicial || "");
  const [thc, setThc] = useState("");
  const [cbd, setCbd] = useState("");
  const [sabor, setSabor] = useState("");
  const [aroma, setAroma] = useState("");
  const [foto, setFoto] = useState(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [error, setError] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const vista = useRef("");

  useEffect(() => () => {
    if (vista.current) liberarVista({ vista: vista.current });
  }, []);

  function reemplazarFoto(siguiente) {
    if (vista.current) liberarVista({ vista: vista.current });
    vista.current = siguiente?.vista || "";
    setFoto(siguiente);
    if (!siguiente) setNombreArchivo("");
  }

  async function elegirImagen(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    const procesada = await procesarFoto(archivo, {
      ladoMaximo: 960,
      maxBytes: MAX_BYTES_IMAGEN_GENETICA,
      generarMiniatura: false,
    });
    if (procesada.error) {
      setError(procesada.error);
      return;
    }
    reemplazarFoto(procesada.foto);
    setNombreArchivo(archivo.name);
    setError("");
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (pendiente) return;
    setPendiente(true);
    setError("");
    const datos = new FormData();
    datos.set("nombre", nombre);
    datos.set("thc", thc);
    datos.set("cbd", cbd);
    datos.set("sabor", sabor);
    datos.set("aroma", aroma);
    if (foto?.blob) {
      const extension = foto.tipo_mime === "image/webp" ? "webp" : "jpg";
      datos.set("imagen", new File([foto.blob], `genetica.${extension}`, { type: foto.tipo_mime }));
    }
    const resultado = await crearGeneticaPersonalizada(datos);
    setPendiente(false);
    if (resultado?.error) {
      setError(resultado.error);
      return;
    }
    onCreada(resultado.detalle, resultado.reutilizada);
  }

  return (
    <>
      <div className="genetica-form__cabecera">
        <Dialog.Title className="genetica-modal__titulo">Crear genética</Dialog.Title>
        <button
          type="button"
          className="genetica-modal__cerrar"
          aria-label="Cerrar"
          disabled={pendiente}
          onClick={onCerrar}
        >
          <X strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <form className="genetica-form" onSubmit={enviar}>
        {error ? <p className="formulario__error">{error}</p> : null}
        <label className="formulario__campo">
          Nombre de la genética
          <input value={nombre} onChange={(evento) => setNombre(evento.target.value)} required maxLength={80} />
        </label>
        <label className="formulario__campo">
          Imagen
          <span className="genetica-form__archivo">
            <input
              className="genetica-form__archivo-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={elegirImagen}
            />
            <span className="genetica-form__archivo-boton">Elegir imagen</span>
            <span className="genetica-form__archivo-nombre">
              {nombreArchivo || "Sin archivo"}
            </span>
          </span>
        </label>
        {foto?.vista ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="genetica-form__vista" src={foto.vista} alt="" />
        ) : null}
        <p className="genetica-form__nota">Opcional. JPG, PNG o WEBP, hasta 2&nbsp;MB.</p>
        <div className="genetica-form__fila">
          <label className="formulario__campo">
            THC (%)
            <input
              inputMode="decimal"
              autoComplete="off"
              value={thc}
              onChange={(evento) => setThc(evento.target.value)}
              placeholder="Opcional"
            />
          </label>
          <label className="formulario__campo">
            CBD (%)
            <input
              inputMode="decimal"
              autoComplete="off"
              value={cbd}
              onChange={(evento) => setCbd(evento.target.value)}
              placeholder="Opcional"
            />
          </label>
        </div>
        <label className="formulario__campo">
          Sabor
          <input value={sabor} onChange={(evento) => setSabor(evento.target.value)} maxLength={400} placeholder="Opcional" />
        </label>
        <label className="formulario__campo">
          Olor / Aroma
          <input value={aroma} onChange={(evento) => setAroma(evento.target.value)} maxLength={400} placeholder="Opcional" />
        </label>
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar genética"}
        </Boton>
      </form>
    </>
  );
}

export function FormularioGenetica({ abierto, nombreInicial, onCerrar, onCreada }) {
  return (
    <Dialog.Root
      open={abierto}
      onOpenChange={(siguiente) => {
        if (!siguiente) onCerrar();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="modal__fondo" />
        <Dialog.Viewport className="modal__vista">
          <Dialog.Popup className="modal__panel genetica-modal">
            {abierto ? (
              <CamposGenetica
                key={nombreInicial || ""}
                nombreInicial={nombreInicial}
                onCerrar={onCerrar}
                onCreada={onCreada}
              />
            ) : null}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
