"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Boton } from "@/componentes/boton";
import { EnlaceVolver } from "@/componentes/enlace-volver";
import { FabNuevoChatFlora } from "@/componentes/flora/fab-nuevo-chat-flora";
import { MensajeFloraMarkdown } from "@/componentes/flora/mensaje-flora-markdown";
import { LIMITES_FLORA_CHATS } from "@/lib/flora-chats-guardados";
import { AVISO_IMAGEN_CHAT_NO_GUARDADA } from "@/lib/flora-imagen-chat";
import { ImagenMensajeFlora } from "@/componentes/flora/imagen-mensaje-flora";

function formatearFecha(iso) {
  try {
    return format(new Date(iso), "d MMM yyyy, HH:mm", { locale: es });
  } catch {
    return "";
  }
}

function formatearFechaDetalle(iso) {
  try {
    return format(new Date(iso), "d 'de' MMMM yyyy, HH:mm", { locale: es });
  } catch {
    return "";
  }
}

function textoCantidadMensajes(cantidad) {
  const n = Number(cantidad) || 0;
  return n === 1 ? "1 mensaje" : `${n} mensajes`;
}

function textoBusquedaItem(item) {
  return [item.titulo, item.pregunta, item.extracto, item.respuesta].filter(Boolean).join(" ").toLowerCase();
}

function AdjuntoMensajeGuardado({ adj }) {
  if (adj.tipo === "transitoria") {
    return (
      <p className="flora-soluciones-detalle__adjunto-transitorio" role="note">
        {AVISO_IMAGEN_CHAT_NO_GUARDADA}
      </p>
    );
  }
  if (adj.tipo === "foto_flora" || adj.tipo === "foto_enflora") {
    if (adj.vistaUrl) {
      return (
        <figure className="flora-soluciones-detalle__adjunto-foto">
          <ImagenMensajeFlora key={adj.vistaUrl} src={adj.vistaUrl} />
          {adj.etiqueta ? <figcaption>{adj.etiqueta}</figcaption> : null}
        </figure>
      );
    }
    return (
      <p className="flora-soluciones-detalle__adjunto-transitorio" role="note">
        {adj.tipo === "foto_flora"
          ? "No se pudo mostrar la fotografía de esta conversación."
          : "Foto de tu galería ENFLORA (no disponible o sin acceso)."}
      </p>
    );
  }
  return null;
}

export function SolucionesVista({ items = [], paginaInicial = 0 }) {
  const [consulta, setConsulta] = useState("");
  const [pagina, setPagina] = useState(paginaInicial);

  const filtradas = useMemo(() => {
    const q = consulta.trim().toLowerCase();
    const ordenadas = [...items].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    if (!q) return ordenadas;
    return ordenadas.filter((s) => textoBusquedaItem(s).includes(q));
  }, [consulta, items]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / LIMITES_FLORA_CHATS.paginaListado));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const slice = filtradas.slice(
    paginaActual * LIMITES_FLORA_CHATS.paginaListado,
    paginaActual * LIMITES_FLORA_CHATS.paginaListado + LIMITES_FLORA_CHATS.paginaListado,
  );

  return (
    <div className="flora-soluciones">
      <header className="flora-soluciones__cabecera">
        <h1 id="soluciones-titulo" className="flora-soluciones__titulo">
          Chats guardados
        </h1>
      </header>

      <FabNuevoChatFlora href="/flora" ariaLabel="Nuevo chat con Flora" />

      <label className="flora-soluciones__busqueda campo-busqueda">
        <Search className="campo-busqueda__icono" size={18} strokeWidth={1.75} aria-hidden="true" />
        <input
          type="search"
          className="campo-busqueda__input"
          placeholder="Buscar por título o contenido…"
          value={consulta}
          onChange={(e) => {
            setConsulta(e.target.value);
            setPagina(0);
          }}
          aria-label="Buscar chats guardados"
        />
      </label>

      {filtradas.length === 0 ? (
        <p className="flora-soluciones__vacio" role="status">
          {items.length === 0
            ? "Todavía no guardaste chats. En el chat con Flora, usá «Guardar» en la cabecera."
            : "Ningún chat coincide con la búsqueda."}
        </p>
      ) : (
        <>
          <ul className="flora-soluciones__lista">
            {slice.map((s) => (
              <li key={`${s.tipo}-${s.id}`}>
                <Link href={`/flora/soluciones/${s.id}`} className="flora-soluciones__item">
                  <span className="flora-soluciones__item-titulo">{s.titulo}</span>
                  <span className="flora-soluciones__item-pregunta">{s.pregunta}</span>
                  <span className="flora-soluciones__item-meta">
                    {s.cantidad_mensajes} mensajes
                    {s.tipo === "solucion" ? " · solución anterior" : ""}
                  </span>
                  <time className="flora-soluciones__item-fecha" dateTime={s.fecha}>
                    {formatearFecha(s.fecha)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
          {totalPaginas > 1 ? (
            <nav className="flora-soluciones__paginacion" aria-label="Páginas">
              <button
                type="button"
                disabled={paginaActual <= 0}
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
              >
                Anterior
              </button>
              <span>
                Página {paginaActual + 1} de {totalPaginas}
              </span>
              <button
                type="button"
                disabled={paginaActual >= totalPaginas - 1}
                onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
              >
                Siguiente
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

export function SolucionDetalleVista({ solucion }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(solucion.titulo);
  const [editando, setEditando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [eliminando, setEliminando] = useState(false);

  const guardarTitulo = async () => {
    setMensaje("");
    const res = await fetch(`/api/flora/soluciones/${solucion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setMensaje(data.error || "No se pudo actualizar.");
      return;
    }
    setTitulo(data.solucion.titulo);
    setEditando(false);
    setMensaje("Título actualizado.");
  };

  const eliminar = async () => {
    if (!window.confirm("¿Eliminar esta solución guardada? No se puede deshacer.")) return;
    setEliminando(true);
    const res = await fetch(`/api/flora/soluciones/${solucion.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setEliminando(false);
      setMensaje(data.error || "No se pudo eliminar.");
      return;
    }
    router.push("/flora/soluciones");
  };

  return (
    <article className="flora-soluciones-detalle">
      <header className="flora-soluciones-detalle__cabecera">
        <EnlaceVolver href="/flora/soluciones" etiqueta="Volver a chats guardados" />
        <div className="flora-soluciones-detalle__cabecera-fila">
          <div className="flora-soluciones-detalle__cabecera-texto">
            <h1>{titulo}</h1>
            <time dateTime={solucion.fecha_respuesta}>
              Respuesta del {formatearFechaDetalle(solucion.fecha_respuesta)}
            </time>
            <p className="flora-soluciones-detalle__etiqueta-legacy">Solución suelta (formato anterior)</p>
          </div>
          {!editando ? (
            <div className="flora-soluciones-detalle__acciones-iconos">
              <Boton
                type="button"
                variante="secundario"
                className="boton--icono"
                aria-label="Cambiar título"
                onClick={() => setEditando(true)}
              >
                <Pencil strokeWidth={1.75} aria-hidden="true" />
              </Boton>
              <Boton
                type="button"
                variante="destructivo"
                className="boton--icono"
                aria-label="Eliminar solución"
                onClick={eliminar}
                disabled={eliminando}
              >
                <Trash2 strokeWidth={1.75} aria-hidden="true" />
              </Boton>
            </div>
          ) : null}
        </div>
        {editando ? (
          <div className="flora-soluciones-detalle__editar">
            <label htmlFor="editar-titulo-solucion">Título</label>
            <input
              id="editar-titulo-solucion"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={120}
            />
            <div className="flora-soluciones-detalle__editar-acciones">
              <Boton type="button" onClick={guardarTitulo}>
                Guardar título
              </Boton>
              <Boton type="button" variante="ghost" onClick={() => setEditando(false)}>
                Cancelar
              </Boton>
            </div>
          </div>
        ) : null}
      </header>

      <section className="flora-soluciones-detalle__bloque">
        <h2>Tu pregunta</h2>
        <p className="flora-soluciones-detalle__pregunta">{solucion.pregunta}</p>
      </section>

      <section className="flora-soluciones-detalle__bloque">
        <h2>Respuesta de Flora</h2>
        <div className="flora-soluciones-detalle__respuesta">
          <MensajeFloraMarkdown texto={solucion.respuesta} animar={false} />
        </div>
      </section>

      {solucion.referencias ? (
        <section className="flora-soluciones-detalle__bloque flora-soluciones-detalle__refs">
          <h2>Referencias conservadas</h2>
          <pre>{JSON.stringify(solucion.referencias, null, 2)}</pre>
        </section>
      ) : null}

      <div className="flora-soluciones-detalle__acciones">
        <Link href={`/flora?continuar=${solucion.id}`} className="flora-soluciones-detalle__continuar">
          Continuar con Flora
        </Link>
        {mensaje ? (
          <p className="flora-soluciones-detalle__mensaje" role="status">
            {mensaje}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function ChatDetalleVista({ chat }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(chat.titulo);
  const [editando, setEditando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [eliminando, setEliminando] = useState(false);

  const guardarTitulo = async () => {
    setMensaje("");
    const res = await fetch(`/api/flora/chats/${chat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setMensaje(data.error || "No se pudo actualizar.");
      return;
    }
    setTitulo(data.chat.titulo);
    setEditando(false);
    setMensaje("Título actualizado.");
  };

  const eliminar = async () => {
    if (!window.confirm("¿Eliminar este chat guardado? No se puede deshacer.")) return;
    setEliminando(true);
    const res = await fetch(`/api/flora/chats/${chat.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setEliminando(false);
      setMensaje(data.error || "No se pudo eliminar.");
      return;
    }
    router.push("/flora/soluciones");
  };

  const fechaRef = chat.updated_at || chat.created_at;

  return (
    <article className="flora-soluciones-detalle">
      <header className="flora-soluciones-detalle__cabecera">
        <EnlaceVolver href="/flora/soluciones" etiqueta="Volver a chats guardados" />
        <div className="flora-soluciones-detalle__cabecera-fila">
          <div className="flora-soluciones-detalle__cabecera-texto">
            <h1>{titulo}</h1>
            <div className="flora-soluciones-detalle__meta">
              <time dateTime={fechaRef}>Actualizado el {formatearFechaDetalle(fechaRef)}</time>
              <span className="flora-soluciones-detalle__meta-pill">
                {textoCantidadMensajes(chat.cantidad_mensajes)}
              </span>
            </div>
          </div>
          {!editando ? (
            <div className="flora-soluciones-detalle__acciones-iconos">
              <Boton
                type="button"
                variante="secundario"
                className="boton--icono"
                aria-label="Cambiar título"
                onClick={() => setEditando(true)}
              >
                <Pencil strokeWidth={1.75} aria-hidden="true" />
              </Boton>
              <Boton
                type="button"
                variante="destructivo"
                className="boton--icono"
                aria-label="Eliminar chat"
                onClick={eliminar}
                disabled={eliminando}
              >
                <Trash2 strokeWidth={1.75} aria-hidden="true" />
              </Boton>
            </div>
          ) : null}
        </div>
        {editando ? (
          <div className="flora-soluciones-detalle__editar">
            <label htmlFor="editar-titulo-chat">Título</label>
            <input
              id="editar-titulo-chat"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={120}
            />
            <div className="flora-soluciones-detalle__editar-acciones">
              <Boton type="button" onClick={guardarTitulo}>
                Guardar título
              </Boton>
              <Boton type="button" variante="ghost" onClick={() => setEditando(false)}>
                Cancelar
              </Boton>
            </div>
          </div>
        ) : null}
      </header>

      <div className="flora-soluciones-detalle__conversacion" role="log">
        {(chat.mensajes || []).map((m, i) => (
          <section
            key={`${m.fecha || i}-${m.rol}`}
            className={`flora-soluciones-detalle__turno flora-soluciones-detalle__turno--${m.rol === "flora" ? "flora" : "usuario"}`}
          >
            <h2 className="flora-soluciones-detalle__turno-rol">
              {m.rol === "flora" ? "Flora" : "Vos"}
              {m.fecha ? (
                <time dateTime={m.fecha} className="flora-soluciones-detalle__turno-fecha">
                  {formatearFecha(m.fecha)}
                </time>
              ) : null}
            </h2>
            {Array.isArray(m.adjuntos)
              ? m.adjuntos.map((adj, j) => <AdjuntoMensajeGuardado key={j} adj={adj} />)
              : null}
            {m.texto ? (
              m.rol === "flora" ? (
                <MensajeFloraMarkdown texto={m.texto} animar={false} />
              ) : (
                <p className="flora-soluciones-detalle__pregunta">{m.texto}</p>
              )
            ) : null}
          </section>
        ))}
      </div>

      <div className="flora-soluciones-detalle__acciones">
        <Link href={`/flora?continuar=${chat.id}`} className="flora-soluciones-detalle__continuar">
          Continuar con Flora
        </Link>
        {mensaje ? (
          <p className="flora-soluciones-detalle__mensaje" role="status">
            {mensaje}
          </p>
        ) : null}
      </div>
    </article>
  );
}
