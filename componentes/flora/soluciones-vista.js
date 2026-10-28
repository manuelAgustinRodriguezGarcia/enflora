"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MessageCircle, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function formatearFecha(iso) {
  try {
    return format(new Date(iso), "d MMM yyyy, HH:mm", { locale: es });
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

export function AccionesDetalleSolucion({ solucionId, tituloInicial }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(tituloInicial);
  const [editando, setEditando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [eliminando, setEliminando] = useState(false);

  const guardarTitulo = async () => {
    setMensaje("");
    const res = await fetch(`/api/flora/soluciones/${solucionId}`, {
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
    const res = await fetch(`/api/flora/soluciones/${solucionId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setEliminando(false);
      setMensaje(data.error || "No se pudo eliminar.");
      return;
    }
    router.push("/flora/soluciones");
  };

  return (
    <div className="flora-soluciones-detalle__acciones">
      {editando ? (
        <div className="flora-soluciones-detalle__editar">
          <label htmlFor="editar-titulo-solucion">Título</label>
          <input
            id="editar-titulo-solucion"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={120}
          />
          <button type="button" onClick={guardarTitulo}>
            Guardar título
          </button>
          <button type="button" className="flora-soluciones-detalle__sec" onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setEditando(true)}>
          Cambiar título
        </button>
      )}

      <Link href={`/flora?continuar=${solucionId}`} className="flora-soluciones-detalle__continuar">
        Continuar con Flora
      </Link>

      <button
        type="button"
        className="flora-soluciones-detalle__eliminar"
        onClick={eliminar}
        disabled={eliminando}
      >
        <Trash2 strokeWidth={1.75} aria-hidden="true" />
        Eliminar
      </button>

      {mensaje ? (
        <p className="flora-soluciones-detalle__mensaje" role="status">
          {mensaje}
        </p>
      ) : null}
    </div>
  );
}
