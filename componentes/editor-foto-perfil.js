"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { LoaderCircle, RotateCcw, RotateCw } from "lucide-react";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Boton } from "@/componentes/boton";
import { exportarRecorteAvatar } from "@/lib/perfil/recortar-avatar";

export function EditorFotoPerfil({ abierto, origen, guardando = false, error = "", onCancelar, onGuardar }) {
  const [recorte, setRecorte] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotacion, setRotacion] = useState(0);
  const [area, setArea] = useState(null);
  const areaRef = useRef(null);
  const [vista, setVista] = useState("");
  const [errorLocal, setErrorLocal] = useState("");
  const [exportando, setExportando] = useState(false);
  const ocupado = guardando || exportando;
  const guardadoRef = useRef(false);
  const vistaRef = useRef("");

  useEffect(() => {
    vistaRef.current = vista;
  }, [vista]);

  useEffect(() => {
    return () => {
      if (vistaRef.current) URL.revokeObjectURL(vistaRef.current);
    };
  }, []);

  useEffect(() => {
    if (!abierto || !origen || !area) return undefined;
    let vigente = true;
    const timer = window.setTimeout(async () => {
      const resultado = await exportarRecorteAvatar(origen, area, rotacion, { lado: 160, calidad: 0.8 });
      if (!vigente || resultado.error || !resultado.blob) return;
      const url = URL.createObjectURL(resultado.blob);
      setVista((anterior) => {
        if (anterior) URL.revokeObjectURL(anterior);
        return url;
      });
    }, 180);
    return () => {
      vigente = false;
      window.clearTimeout(timer);
    };
  }, [abierto, origen, area, rotacion]);

  function cambiar(siguiente, detalles) {
    if (!siguiente && ocupado) {
      detalles?.cancel?.();
      return;
    }
    if (!siguiente) onCancelar();
  }

  async function guardar() {
    if (ocupado || guardadoRef.current || !areaRef.current) return;
    guardadoRef.current = true;
    setExportando(true);
    setErrorLocal("");
    const resultado = await exportarRecorteAvatar(origen, areaRef.current, rotacion);
    setExportando(false);
    if (resultado.error || !resultado.blob) {
      guardadoRef.current = false;
      setErrorLocal(resultado.error || "No se pudo preparar la foto.");
      return;
    }
    try {
      await onGuardar(resultado.blob);
    } finally {
      guardadoRef.current = false;
    }
  }

  const mensaje = errorLocal || error;

  return (
    <Dialog.Root open={abierto} onOpenChange={cambiar}>
      <Dialog.Portal>
        <Dialog.Backdrop render={<div className="modal__fondo" />} />
        <Dialog.Viewport className="modal__vista modal__vista--avatar">
          <Dialog.Popup render={<div className="modal__panel modal__panel--avatar" />}>
            <Dialog.Title className="modal__titulo">Ajustar foto de perfil</Dialog.Title>
            <Dialog.Description className="avatar-editor__ayuda">
              Arrastrá la foto y ajustá el zoom. El círculo muestra cómo se va a ver.
            </Dialog.Description>
            <div className="avatar-editor">
              <div className="avatar-editor__recorte">
                {origen ? (
                  <Cropper
                    image={origen}
                    crop={recorte}
                    zoom={zoom}
                    rotation={rotacion}
                    aspect={1}
                    cropShape="round"
                    objectFit="cover"
                    showGrid={false}
                    zoomWithScroll
                    minZoom={1}
                    maxZoom={3}
                    onCropChange={setRecorte}
                    onZoomChange={setZoom}
                    onRotationChange={setRotacion}
                    onCropComplete={(_zona, pixeles) => {
                      areaRef.current = pixeles;
                      setArea(pixeles);
                    }}
                    onCropAreaChange={(_zona, pixeles) => {
                      areaRef.current = pixeles;
                    }}
                    mediaProps={{ alt: "" }}
                    cropperProps={{
                      tabIndex: 0,
                      "aria-label": "Encuadre de la foto. Arrastrá para moverla. Con el teclado, usá las flechas.",
                    }}
                    style={{
                      containerStyle: { background: "#0B3D2A" },
                      cropAreaStyle: {
                        color: "rgba(11, 61, 42, 0.55)",
                        border: "2px solid #EAEDBB",
                      },
                    }}
                  />
                ) : null}
                {ocupado ? (
                  <span className="avatar-editor__espera" role="status">
                    <LoaderCircle className="avatar-editor__giro" strokeWidth={1.75} aria-hidden="true" />
                    {guardando ? "Guardando…" : "Preparando…"}
                  </span>
                ) : null}
              </div>
              <div className="avatar-editor__controles">
                <label className="avatar-editor__zoom-etiqueta">
                  Zoom
                  <input
                    className="avatar-editor__zoom"
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    disabled={ocupado}
                    aria-label="Zoom"
                    onChange={(evento) => setZoom(Number(evento.target.value))}
                  />
                </label>
                <div className="avatar-editor__fila">
                  <div className="avatar-editor__giro-controles">
                    <button
                      type="button"
                      className="avatar-editor__icono"
                      aria-label="Girar a la izquierda"
                      disabled={ocupado}
                      onClick={() => setRotacion((actual) => actual - 90)}
                    >
                      <RotateCcw size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="avatar-editor__icono"
                      aria-label="Girar a la derecha"
                      disabled={ocupado}
                      onClick={() => setRotacion((actual) => actual + 90)}
                    >
                      <RotateCw size={18} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="avatar-editor__vista" aria-hidden={vista ? undefined : true}>
                    {vista ? (
                      // Vista previa del recorte, generada en el navegador.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={vista} alt="" />
                    ) : (
                      <span>Vista previa</span>
                    )}
                  </div>
                </div>
              </div>
              {mensaje ? (
                <p className="formulario__error" role="alert">
                  {mensaje}
                </p>
              ) : null}
              <div className="modal__acciones">
                <Boton type="button" variante="ghost" onClick={() => cambiar(false)} disabled={ocupado}>
                  Cancelar
                </Boton>
                <Boton type="button" onClick={guardar} disabled={ocupado || !area}>
                  {guardando ? "Guardando…" : "Guardar foto"}
                </Boton>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
