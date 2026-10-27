"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Images, LoaderCircle, Trash2 } from "lucide-react";
import {
  guardarPortadaUnidad,
  quitarPortadaUnidad,
} from "@/app/espacios/[id]/acciones";
import { Aparecer } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { PortadaUnidad } from "@/componentes/portada-unidad";
import { ACEPTAR_FOTOS } from "@/lib/fotos";
import { liberarVista, procesarFoto } from "@/lib/fotos-cliente";
import { borrarArchivosSubidos, subirPortadaUnidad } from "@/lib/fotos-subida";

function claveLocal() {
  return globalThis.crypto.randomUUID();
}

// Portada independiente del registro diario: sube a Storage, confirma con RPC y recién ahí borra la anterior.
export function EditorPortadaUnidad({
  unidadId,
  espacioId,
  usuarioId,
  urlActual = "",
  tienePortada = false,
  abierto = true,
  onBloqueado,
}) {
  const [estadoGuardar, guardar, guardando] = useActionState(guardarPortadaUnidad, null);
  const [estadoQuitar, quitar, quitando] = useActionState(quitarPortadaUnidad, null);
  const [items, setItems] = useState([]);
  const [eligiendo, setEligiendo] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [errorLocal, setErrorLocal] = useState("");
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const subidaRef = useRef(null);
  const camara = useRef(null);
  const galeria = useRef(null);
  const router = useRouter();
  const pendiente = guardando || quitando || preparando;

  useEffect(() => {
    onBloqueado?.(pendiente);
  }, [onBloqueado, pendiente]);

  useEffect(() => {
    if (abierto) return;
    setEligiendo(false);
    setErrorLocal("");
    setConfirmarQuitar(false);
  }, [abierto]);

  useEffect(() => {
    if (!estadoGuardar?.ok && !estadoQuitar?.ok) return;
    router.refresh();
    setConfirmarQuitar(false);
    setItems((previo) => {
      for (const item of previo) liberarVista(item);
      return [];
    });
    subidaRef.current = null;
  }, [estadoGuardar?.ok, estadoQuitar?.ok, router]);

  useEffect(() => {
    if (estadoGuardar?.archivosLimpiados) subidaRef.current = null;
  }, [estadoGuardar]);

  async function seleccionar(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;

    setEligiendo(false);
    setErrorLocal("");
    setPreparando(true);
    if (subidaRef.current?.rutas?.length) borrarArchivosSubidos(subidaRef.current.rutas);
    subidaRef.current = null;

    const clave = claveLocal();
    setItems((previo) => {
      for (const item of previo) liberarVista(item);
      return [{ clave, url: "", estado: "procesando", nueva: true }];
    });

    const resultado = await procesarFoto(archivo);
    if (resultado.error) {
      setItems([]);
      setErrorLocal(resultado.error);
      setPreparando(false);
      return;
    }

    const foto = resultado.foto;
    setItems([
      {
        clave,
        url: foto.vista,
        estado: "lista",
        nueva: true,
        procesada: foto,
      },
    ]);

    const subida = await subirPortadaUnidad(usuarioId, unidadId, foto);
    if (subida.error) {
      setErrorLocal(subida.error);
      setPreparando(false);
      return;
    }

    subidaRef.current = subida;
    const datos = new FormData();
    datos.set("unidad_id", unidadId);
    datos.set("espacio_id", espacioId);
    datos.set("ruta", subida.ruta);
    datos.set("miniatura", subida.miniatura);
    setPreparando(false);
    guardar(datos);
  }

  const error =
    errorLocal ||
    estadoGuardar?.error ||
    estadoQuitar?.error ||
    (estadoGuardar?.archivosLimpiados ? "No se pudo guardar. Volvé a elegir la foto." : "");

  const vista = items[0]?.url || urlActual;
  const ocupado = pendiente;

  return (
    <div className="portada-editor">
      <p className="portada-editor__etiqueta">Portada</p>
      <div className="portada-editor__marco">
        <PortadaUnidad url={vista} vertical />
        {ocupado ? (
          <span className="portada-editor__espera" role="status">
            <LoaderCircle className="fotos-selector__giro" strokeWidth={1.75} aria-hidden="true" />
            {guardando || preparando ? "Guardando…" : "Quitando…"}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="portada-editor__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="portada-editor__acciones">
        <Boton
          type="button"
          variante="secundario"
          className="boton--ancho"
          aria-expanded={eligiendo}
          disabled={ocupado}
          onClick={() => setEligiendo((actual) => !actual)}
        >
          <Images strokeWidth={1.75} aria-hidden="true" />
          Cambiar portada
        </Boton>
        <Aparecer visible={eligiendo}>
          <div className="portada-editor__origen">
            <Boton
              type="button"
              variante="secundario"
              className="boton--ancho"
              disabled={ocupado}
              onClick={() => camara.current?.click()}
            >
              <Camera strokeWidth={1.75} aria-hidden="true" />
              Tomar foto
            </Boton>
            <Boton
              type="button"
              variante="secundario"
              className="boton--ancho"
              disabled={ocupado}
              onClick={() => galeria.current?.click()}
            >
              <Images strokeWidth={1.75} aria-hidden="true" />
              Elegir de mi galería
            </Boton>
          </div>
        </Aparecer>
        {tienePortada ? (
          <Boton
            type="button"
            variante="destructivo"
            className="boton--ancho"
            disabled={ocupado}
            onClick={() => setConfirmarQuitar(true)}
          >
            <Trash2 strokeWidth={1.75} aria-hidden="true" />
            Quitar portada
          </Boton>
        ) : null}
      </div>
      <input
        ref={camara}
        type="file"
        accept={ACEPTAR_FOTOS}
        capture="environment"
        className="fotos-selector__input"
        onChange={seleccionar}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={galeria}
        type="file"
        accept={ACEPTAR_FOTOS}
        className="fotos-selector__input"
        onChange={seleccionar}
        tabIndex={-1}
        aria-hidden="true"
      />
      <ModalConfirmacion
        abierto={confirmarQuitar}
        onCerrar={() => setConfirmarQuitar(false)}
        titulo="Quitar portada"
        descripcion="Se quitará la imagen de portada de esta unidad. Las fotos de los registros no se modifican."
        textoConfirmar="Quitar"
        pendiente={quitando}
        error={estadoQuitar?.error || ""}
        accion={quitar}
        icono={<Trash2 strokeWidth={1.75} />}
        varianteConfirmar="destructivo"
      >
        <input type="hidden" name="unidad_id" value={unidadId} />
        <input type="hidden" name="espacio_id" value={espacioId} />
      </ModalConfirmacion>
    </div>
  );
}
