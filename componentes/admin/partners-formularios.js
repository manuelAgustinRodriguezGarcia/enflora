"use client";

import { useActionState, useState } from "react";
import {
  cambiarEstadoCampana,
  cambiarEstadoComercio,
  guardarCampana,
  guardarComercio,
  guardarSolicitudPartners,
} from "@/app/admin/partners/acciones";
import { VistaPreviaPromocion } from "@/componentes/promociones/vista-previa-promocion";
import { SEGMENTOS_PROMOCION } from "@/lib/promociones";

function Aviso({ estado }) {
  if (!estado) return null;
  if (estado.ok) return <p role="status">Guardado.</p>;
  return (
    <p className="admin-dash__aviso" role="alert">
      {estado.error || "No se pudo guardar."}
    </p>
  );
}

export function FormularioComercio({ comercio }) {
  const [estado, accion, pendiente] = useActionState(guardarComercio, null);
  const valor = comercio || {};
  return (
    <form className="admin-planes__filtros" action={accion}>
      {valor.id ? <input type="hidden" name="id" value={valor.id} /> : null}
      <label className="admin-planes__campo">
        Nombre
        <input name="nombre" defaultValue={valor.nombre || ""} required maxLength={120} />
      </label>
      <label className="admin-planes__campo">
        Rubro
        <input name="rubro" defaultValue={valor.rubro || ""} maxLength={80} />
      </label>
      <label className="admin-planes__campo">
        Plan
        <select name="plan" defaultValue={valor.plan || "presencia"}>
          <option value="presencia">Presencia</option>
          <option value="visibilidad">Visibilidad</option>
          <option value="inteligente">Inteligente</option>
        </select>
      </label>
      <label className="admin-planes__campo">
        Inicio
        <input type="date" name="inicio" defaultValue={String(valor.fecha_inicio || valor.inicio || "").slice(0, 10)} required />
      </label>
      <label className="admin-planes__campo">
        Fin
        <input type="date" name="fin" defaultValue={String(valor.fecha_fin || valor.fin || "").slice(0, 10)} />
      </label>
      <label className="admin-planes__campo">
        Sitio https
        <input name="sitio" defaultValue={valor.sitio_web || ""} maxLength={500} />
      </label>
      <label className="admin-planes__campo">
        Logo https
        <input name="logo" defaultValue={valor.logo_url || ""} maxLength={500} />
      </label>
      <label className="admin-planes__campo">
        Banner https
        <input name="banner" defaultValue={valor.banner_url || ""} maxLength={500} />
      </label>
      <label className="admin-planes__campo">
        Enlace del banner https
        <input name="enlace" defaultValue={valor.banner_enlace || ""} maxLength={500} />
      </label>
      <button className="admin-dash__actualizar" type="submit" disabled={pendiente}>
        {valor.id ? "Guardar comercio" : "Crear comercio en revisión"}
      </button>
      <Aviso estado={estado} />
    </form>
  );
}

export function BotonesComercio({ id, revision, activo }) {
  const [estado, accion, pendiente] = useActionState(cambiarEstadoComercio, null);
  const acciones = [
    ["aprobar", "Aprobar"],
    ["rechazar", "Rechazar"],
    ["activar", "Activar"],
    ["desactivar", "Desactivar"],
  ];
  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      <p className="admin-dash__aclaracion">
        Revisión: {revision}. Activo: {activo ? "sí" : "no"}. Activar exige que ya esté aprobado. No se borra el comercio.
      </p>
      {acciones.map(([valor, texto]) => (
        <button key={valor} className="admin-dash__actualizar" type="submit" name="accion" value={valor} disabled={pendiente}>
          {texto}
        </button>
      ))}
      <Aviso estado={estado} />
    </form>
  );
}

export function FormularioSolicitud({ solicitud }) {
  const [estado, accion, pendiente] = useActionState(guardarSolicitudPartners, null);
  return (
    <form action={accion}>
      <input type="hidden" name="id" value={solicitud.id} />
      <label className="admin-planes__campo">
        Estado
        <select name="estado" defaultValue={solicitud.estado}>
          <option value="recibida">Recibida</option>
          <option value="en_revision">En revisión</option>
          <option value="aprobada">Aprobada</option>
          <option value="rechazada">Rechazada</option>
          <option value="cerrada">Cerrada</option>
        </select>
      </label>
      <label className="admin-planes__campo">
        Nota interna
        <textarea name="nota" defaultValue={solicitud.nota_interna || ""} maxLength={2000} rows={4} />
      </label>
      <button className="admin-dash__actualizar" type="submit" disabled={pendiente}>
        Guardar solicitud
      </button>
      <Aviso estado={estado} />
    </form>
  );
}

export function FormularioCampana({ campana, comercios }) {
  const [estado, accion, pendiente] = useActionState(guardarCampana, null);
  const valor = campana || {};
  const iniciales = Array.isArray(valor.segmentos) && valor.segmentos.length ? valor.segmentos : ["gratuito", "plus", "licencia"];
  const [tipo, setTipo] = useState(valor.tipo || "comercial");
  const [formato, setFormato] = useState(valor.formato || "banner");
  const [ubicacion, setUbicacion] = useState(valor.ubicacion || "listado_cultivos");
  const [upsell, setUpsell] = useState(valor.es_upsell_plus === true);
  const [anunciar, setAnunciar] = useState(valor.anunciar_futuros === true);
  const [titulo, setTitulo] = useState(valor.titulo || "");
  const [descripcion, setDescripcion] = useState(valor.descripcion || "");
  const [cta, setCta] = useState(valor.cta || "");
  const [enlace, setEnlace] = useState(valor.enlace || "");
  const [segmentos, setSegmentos] = useState(iniciales);
  const interna = tipo === "interna";
  const vista = {
    tipo,
    formato,
    titulo,
    descripcion,
    cta,
    enlace: upsell ? "/pagos/plus" : enlace,
    esUpsellPlus: interna && upsell,
    anunciarFuturos: anunciar,
    nombre: valor.nombre || titulo,
    bannerUrl: valor.pieza_url || "",
  };

  function cambiarSegmento(segmento, activo) {
    setSegmentos((actuales) => {
      const siguiente = activosSin(actuales, segmento, activo);
      return siguiente.length ? siguiente : actuales;
    });
  }

  return (
    <form className="admin-planes__filtros" action={accion}>
      {valor.id ? <input type="hidden" name="id" value={valor.id} /> : null}
      <label className="admin-planes__campo">
        Nombre interno
        <input name="nombre" defaultValue={valor.nombre || ""} required maxLength={120} />
      </label>
      <label className="admin-planes__campo">
        Tipo
        <select name="tipo" value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
          <option value="comercial">Campaña comercial</option>
          <option value="beneficio">Beneficio de partner</option>
          <option value="interna">Promoción interna</option>
        </select>
      </label>
      <label className="admin-planes__campo">
        Formato
        <select
          name="formato"
          value={ubicacion === "listado_cultivos" ? "banner" : formato}
          onChange={(evento) => setFormato(evento.target.value)}
        >
          <option value="banner">Banner</option>
          <option value="modal" disabled={ubicacion === "listado_cultivos"}>Ventana</option>
        </select>
      </label>
      <label className="admin-planes__campo">
        Ubicación
        <select
          name="ubicacion"
          value={ubicacion}
          onChange={(evento) => {
            setUbicacion(evento.target.value);
            if (evento.target.value === "listado_cultivos") setFormato("banner");
          }}
        >
          <option value="listado_cultivos">Listado de cultivos</option>
          <option value="inicio">Inicio</option>
        </select>
      </label>
      {interna ? null : (
        <label className="admin-planes__campo">
          Comercio
          <select name="comercio" defaultValue={valor.comercio_id || ""} required>
            <option value="">Elegir</option>
            {comercios.map((comercio) => (
              <option key={comercio.id} value={comercio.id}>
                {comercio.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      <fieldset className="admin-planes__campo">
        <legend>A quién se muestra</legend>
        {SEGMENTOS_PROMOCION.map((segmento) => (
          <label key={segmento}>
            <input
              type="checkbox"
              name="segmento"
              value={segmento}
              checked={segmentos.includes(segmento) && !(upsell && segmento === "plus")}
              disabled={upsell && segmento === "plus"}
              onChange={(evento) => cambiarSegmento(segmento, evento.target.checked)}
            />
            {segmento === "gratuito" ? " Gratuito" : segmento === "plus" ? " Plus" : " Pago único por cultivo"}
          </label>
        ))}
      </fieldset>
      <label className="admin-planes__campo">
        Título
        <input name="titulo" value={titulo} onChange={(evento) => setTitulo(evento.target.value)} maxLength={80} required={interna} />
      </label>
      <label className="admin-planes__campo">
        Descripción
        <textarea name="descripcion" value={descripcion} onChange={(evento) => setDescripcion(evento.target.value)} maxLength={400} rows={3} />
      </label>
      <label className="admin-planes__campo">
        Texto del botón
        <input name="cta" value={cta} onChange={(evento) => setCta(evento.target.value)} maxLength={40} required={interna} />
      </label>
      <label className="admin-planes__campo">
        Pieza https
        <input name="pieza" defaultValue={valor.pieza_url || ""} maxLength={500} />
      </label>
      <label className="admin-planes__campo">
        Destino
        <input
          name="enlace"
          value={upsell ? "/pagos/plus" : enlace}
          onChange={(evento) => setEnlace(evento.target.value)}
          maxLength={500}
          readOnly={upsell}
        />
      </label>
      <label className="admin-planes__campo">
        Inicio
        <input type="date" name="inicio" defaultValue={String(valor.inicio || "").slice(0, 10)} required />
      </label>
      <label className="admin-planes__campo">
        Fin
        <input type="date" name="fin" defaultValue={String(valor.fin || "").slice(0, 10)} />
      </label>
      <label className="admin-planes__campo">
        Prioridad
        <input name="prioridad" type="number" min="0" max="100" defaultValue={valor.prioridad ?? 0} />
      </label>
      <label className="admin-planes__campo">
        Frecuencia del modal, en días
        <input name="frecuencia" type="number" min="0" max="366" defaultValue={valor.frecuencia_dias ?? 0} />
      </label>
      {interna ? (
        <label className="admin-planes__campo">
          <input
            type="checkbox"
            name="es_upsell_plus"
            value="si"
            checked={upsell}
            onChange={(evento) => {
              const activo = evento.target.checked;
              setUpsell(activo);
              if (activo) {
                setSegmentos((actuales) => {
                  const sinPlus = actuales.filter((item) => item !== "plus");
                  return sinPlus.length ? sinPlus : ["gratuito"];
                });
              }
            }}
          />
          Oferta para contratar Plus
        </label>
      ) : null}
      {interna ? (
        <label className="admin-planes__campo">
          <input type="checkbox" name="anunciar_futuros" value="si" checked={anunciar} onChange={(evento) => setAnunciar(evento.target.checked)} />
          Anunciar beneficios que todavía no están disponibles
        </label>
      ) : null}
      <p className="admin-dash__aclaracion">
        Se guarda en borrador y no se publica. Una comercial o un beneficio solo puede activarse con comercio aprobado, vigente y en plan Visibilidad o Inteligente. Una interna no lleva comercio. El modal de Plus espera al menos 7 días en gratuito y 30 en Plus. No prometas una experiencia sin anuncios.
      </p>
      <VistaPreviaPromocion campana={vista} />
      <button className="admin-dash__actualizar" type="submit" disabled={pendiente}>
        {valor.id ? "Guardar campaña" : "Crear borrador"}
      </button>
      <Aviso estado={estado} />
    </form>
  );
}

function activosSin(actuales, segmento, activo) {
  if (activo) return actuales.includes(segmento) ? actuales : [...actuales, segmento];
  return actuales.filter((item) => item !== segmento);
}

const SIGUIENTES = {
  borrador: ["programada", "activa"],
  programada: ["borrador", "activa", "pausada", "finalizada"],
  activa: ["pausada", "finalizada"],
  pausada: ["activa", "finalizada"],
  finalizada: [],
};

export function BotonesCampana({ id, estadoActual }) {
  const [estado, accion, pendiente] = useActionState(cambiarEstadoCampana, null);
  const opciones = SIGUIENTES[estadoActual] || [];
  if (!opciones.length) return <p className="admin-dash__aclaracion">Esta campaña está finalizada.</p>;
  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      {opciones.map((valor) => (
        <button key={valor} className="admin-dash__actualizar" type="submit" name="estado" value={valor} disabled={pendiente}>
          Pasar a {valor}
        </button>
      ))}
      <Aviso estado={estado} />
    </form>
  );
}
