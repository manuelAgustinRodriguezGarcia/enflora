"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MessageCircle, Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Boton } from "@/componentes/boton";
import { MensajeFloraMarkdown } from "@/componentes/flora/mensaje-flora-markdown";

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

export function SolucionesVista({ soluciones = [] }) {
  const [consulta, setConsulta] = useState("");

  const filtradas = useMemo(() => {
    const q = consulta.trim().toLowerCase();
    const ordenadas = [...soluciones].sort(
      (a, b) => new Date(b.fecha_respuesta) - new Date(a.fecha_respuesta),
    );
    if (!q) return ordenadas;
    return ordenadas.filter(
      (s) =>
        s.titulo?.toLowerCase().includes(q) ||
        s.pregunta?.toLowerCase().includes(q) ||
        s.respuesta?.toLowerCase().includes(q),
    );
  }, [consulta, soluciones]);

  return (
    <div className="flora-soluciones">
      <header className="flora-soluciones__cabecera">
        <div>
          <h1 className="flora-soluciones__titulo">Soluciones de Flora</h1>
          <p className="flora-soluciones__sub">Respuestas que guardaste para consultarlas después.</p>
        </div>
        <Link href="/flora" className="flora-soluciones__link-flora">
          <MessageCircle strokeWidth={1.75} aria-hidden="true" />
          Volver a Flora
        </Link>
      </header>

      <div className="flora-soluciones__busqueda">
        <Search strokeWidth={1.75} aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar por título, pregunta o texto…"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          aria-label="Buscar soluciones"
        />
      </div>

      {filtradas.length === 0 ? (
        <p className="flora-soluciones__vacio" role="status">
          {soluciones.length === 0
            ? "Todavía no guardaste soluciones. En el chat con Flora, usá «Guardar solución» en una respuesta."
            : "Ninguna solución coincide con la búsqueda."}
        </p>
      ) : (
        <ul className="flora-soluciones__lista">
          {filtradas.map((s) => (
            <li key={s.id}>
              <Link href={`/flora/soluciones/${s.id}`} className="flora-soluciones__item">
                <span className="flora-soluciones__item-titulo">{s.titulo}</span>
                <span className="flora-soluciones__item-pregunta">{s.pregunta}</span>
                <time className="flora-soluciones__item-fecha" dateTime={s.fecha_respuesta}>
                  {formatearFecha(s.fecha_respuesta)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
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
        <Link href="/flora/soluciones" className="flora-soluciones-detalle__volver">
          ← Soluciones
        </Link>
        <div className="flora-soluciones-detalle__cabecera-fila">
          <div className="flora-soluciones-detalle__cabecera-texto">
            <h1>{titulo}</h1>
            <time dateTime={solucion.fecha_respuesta}>
              Respuesta del {formatearFechaDetalle(solucion.fecha_respuesta)}
            </time>
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

      <p className="flora-soluciones-detalle__aviso-historico" role="note">
        Esta es una respuesta generada en su fecha original. Los datos actuales de tu cultivo pueden
        haber cambiado; no uses fechas o recomendaciones históricas como si fueran vigentes hoy.
      </p>

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