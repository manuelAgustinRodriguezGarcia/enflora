"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import { eliminarFotoPerfil, guardarFotoPerfil } from "@/app/perfil/acciones-avatar";
import { AvatarUsuario, publicarAvatar } from "@/componentes/avatar-usuario";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { ACEPTAR_AVATAR } from "@/lib/perfil/avatar";
import { prepararFotoAvatar } from "@/lib/perfil/recortar-avatar";

const EditorFotoPerfil = dynamic(
  () => import("@/componentes/editor-foto-perfil").then((mod) => mod.EditorFotoPerfil),
  { ssr: false },
);

const AVATAR_VACIO = { url: "", expira: 0 };

export function FotoPerfil({ avatar = AVATAR_VACIO, inicial = "?", editable = true }) {
  const router = useRouter();
  const archivoRef = useRef(null);
  const marcoRef = useRef(null);
  const locales = useRef([]);
  const guardandoRef = useRef(false);
  const [menu, setMenu] = useState(false);
  const [origen, setOrigen] = useState("");
  const [preparando, setPreparando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState("");
  const [errorEliminar, setErrorEliminar] = useState("");
  const [aviso, setAviso] = useState("");
  const [mostrada, setMostrada] = useState(() => ({
    url: avatar?.url || "",
    expira: avatar?.expira || 0,
  }));
  const [avatarVisto, setAvatarVisto] = useState(() => ({
    url: avatar?.url || "",
    expira: avatar?.expira || 0,
  }));
  const urlProp = avatar?.url || "";
  const expiraProp = avatar?.expira || 0;
  if (avatarVisto.url !== urlProp || avatarVisto.expira !== expiraProp) {
    setAvatarVisto({ url: urlProp, expira: expiraProp });
    setMostrada({ url: urlProp, expira: expiraProp });
  }
  const tieneFoto = Boolean(mostrada.url);
  const letra = (inicial || "?").slice(0, 1).toUpperCase();

  useEffect(() => {
    const pendientes = locales.current.splice(0);
    const id = window.setTimeout(() => {
      for (const url of pendientes) URL.revokeObjectURL(url);
    }, 1000);
    return () => {
      window.clearTimeout(id);
      for (const url of pendientes) URL.revokeObjectURL(url);
    };
  }, [urlProp]);

  useEffect(() => {
    return () => {
      if (origen) URL.revokeObjectURL(origen);
    };
  }, [origen]);

  useEffect(() => {
    const pendientes = locales.current;
    return () => {
      for (const url of pendientes) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    if (!aviso) return undefined;
    const id = window.setTimeout(() => setAviso(""), 4000);
    return () => window.clearTimeout(id);
  }, [aviso]);

  useEffect(() => {
    if (!menu) return undefined;
    function alTeclado(evento) {
      if (evento.key === "Escape") setMenu(false);
    }
    function afuera(evento) {
      if (!marcoRef.current?.contains(evento.target)) setMenu(false);
    }
    document.addEventListener("keydown", alTeclado);
    document.addEventListener("pointerdown", afuera);
    return () => {
      document.removeEventListener("keydown", alTeclado);
      document.removeEventListener("pointerdown", afuera);
    };
  }, [menu]);

  function mostrar(siguiente) {
    setMostrada(siguiente);
    publicarAvatar(siguiente);
  }

  function reemplazarOrigen(siguiente) {
    setOrigen(siguiente);
  }

  function cerrarEditor() {
    reemplazarOrigen("");
    setError("");
  }

  function abrirSelector() {
    setMenu(false);
    setError("");
    archivoRef.current?.click();
  }

  function alPulsarAvatar() {
    if (preparando || guardando || !editable) return;
    if (tieneFoto || origen) {
      setMenu((actual) => !actual);
      return;
    }
    abrirSelector();
  }

  async function elegir(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;

    setMenu(false);
    setError("");
    setAviso("");
    setPreparando(true);
    const resultado = await prepararFotoAvatar(archivo);
    setPreparando(false);
    if (resultado.error || !resultado.url) {
      setError(resultado.error || "No se pudo leer la imagen. Probá con otra foto.");
      return;
    }
    reemplazarOrigen(resultado.url);
  }

  async function guardar(blob) {
    if (guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);
    setError("");
    const local = URL.createObjectURL(blob);
    locales.current.push(local);
    const anterior = mostrada;
    const previa = { url: local, expira: Number.MAX_SAFE_INTEGER };
    mostrar(previa);

    const datos = new FormData();
    datos.set("foto", new File([blob], "avatar.webp", { type: blob.type || "image/webp" }));

    try {
      const resultado = await guardarFotoPerfil(datos);
      if (resultado?.error) {
        mostrar(anterior);
        URL.revokeObjectURL(local);
        locales.current = locales.current.filter((url) => url !== local);
        setError(resultado.error);
        return;
      }
      if (resultado.url) mostrar({ url: resultado.url, expira: resultado.expira || 0 });
      cerrarEditor();
      setAviso("Foto de perfil actualizada.");
      router.refresh();
    } catch {
      mostrar(anterior);
      URL.revokeObjectURL(local);
      locales.current = locales.current.filter((url) => url !== local);
      setError("No se pudo guardar la foto. Revisá tu conexión e intentá de nuevo.");
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (eliminando) return;
    setEliminando(true);
    setErrorEliminar("");
    const anterior = mostrada;
    mostrar(AVATAR_VACIO);
    try {
      const resultado = await eliminarFotoPerfil();
      if (resultado?.error) {
        mostrar(anterior);
        setErrorEliminar(resultado.error);
        return;
      }
      setConfirmar(false);
      setAviso("Se quitó la foto de perfil.");
      router.refresh();
    } catch {
      publicarAvatar(anterior);
      setErrorEliminar("No se pudo quitar la foto. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="perfil__avatar" ref={marcoRef}>
      <div className={`perfil__avatar-marco${tieneFoto ? " perfil__avatar-marco--con-foto" : ""}`}>
        <button
          type="button"
          className="perfil__avatar-foto"
          aria-label={tieneFoto ? "Editar foto de perfil" : "Agregar foto de perfil"}
          aria-expanded={menu}
          disabled={preparando || guardando || !editable}
          onClick={alPulsarAvatar}
        >
          <AvatarUsuario url={mostrada.url} expira={mostrada.expira} alt="">
            <span className="perfil__avatar-inicial">{letra}</span>
          </AvatarUsuario>
          {preparando ? (
            <span className="perfil__avatar-espera" role="status">
              <LoaderCircle className="avatar-editor__giro" strokeWidth={1.75} aria-hidden="true" />
              <span className="perfil__avatar-espera-texto">Preparando foto…</span>
            </span>
          ) : null}
        </button>
        {editable ? (
          <button
            type="button"
            className="perfil__avatar-camara"
            aria-label={tieneFoto ? "Cambiar o quitar la foto" : "Agregar foto de perfil"}
            disabled={preparando || guardando}
            onClick={alPulsarAvatar}
          >
            <Camera size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {menu ? (
        <div className="perfil__avatar-menu" role="menu">
          <button type="button" className="perfil__avatar-opcion" role="menuitem" onClick={abrirSelector}>
            Cambiar foto
          </button>
          <button
            type="button"
            className="perfil__avatar-opcion perfil__avatar-opcion--quitar"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              setErrorEliminar("");
              setConfirmar(true);
            }}
          >
            Eliminar foto
          </button>
        </div>
      ) : null}
      <p className="perfil__avatar-texto">Foto de perfil</p>
      {aviso ? (
        <p className="perfil__avatar-aviso" role="status">
          {aviso}
        </p>
      ) : null}
      {error && !origen ? (
        <p className="formulario__error" role="alert">
          {error}
        </p>
      ) : null}
      <input
        ref={archivoRef}
        className="perfil__avatar-input"
        type="file"
        accept={ACEPTAR_AVATAR}
        tabIndex={-1}
        aria-label="Elegir foto de perfil"
        onChange={elegir}
      />
      {origen ? (
        <EditorFotoPerfil
          abierto
          origen={origen}
          guardando={guardando}
          error={error}
          onCancelar={cerrarEditor}
          onGuardar={guardar}
        />
      ) : null}
      <ModalConfirmacion
        abierto={confirmar}
        onCerrar={() => {
          if (!eliminando) setConfirmar(false);
        }}
        titulo="Eliminar foto de perfil"
        descripcion="Vas a dejar de usar esta foto. El perfil vuelve a mostrar tu inicial."
        textoConfirmar="Eliminar foto"
        textoCancelar="Cancelar"
        varianteConfirmar="destructivo"
        iconoConfirmar={<Trash2 size={18} strokeWidth={1.75} />}
        pendiente={eliminando}
        error={errorEliminar}
        onConfirmar={eliminar}
      />
    </div>
  );
}
