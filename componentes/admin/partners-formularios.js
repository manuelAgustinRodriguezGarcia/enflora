"use client";

import { useActionState } from "react";
import {
  cambiarEstadoCampana,
  cambiarEstadoComercio,
  guardarCampana,
  guardarComercio,
  guardarSolicitudPartners,
} from "@/app/admin/partners/acciones";

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
  return (
    <form className="admin-planes__filtros" action={accion}>
      {valor.id ? <input type="hidden" name="id" value={valor.id} /> : null}
      <input type="hidden" name="ubicacion" value="listado_cultivos" />
      <label className="admin-planes__campo">
        Nombre interno
        <input name="nombre" defaultValue={valor.nombre || ""} required maxLength={120} />
      </label>
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
      <label className="admin-planes__campo">
        Pieza https
        <input name="pieza" defaultValue={valor.pieza_url || ""} maxLength={500} />
      </label>
      <label className="admin-planes__campo">
        Destino https
        <input name="enlace" defaultValue={valor.enlace || ""} maxLength={500} />
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
      <p className="admin-dash__aclaracion">
        Se guarda en borrador. Aparece en el listado de cultivos solo después de activarla, si el comercio está aprobado, activo, vigente y en plan Visibilidad o Inteligente. El banner dice Publicidad.
      </p>
      <button className="admin-dash__actualizar" type="submit" disabled={pendiente}>
        {valor.id ? "Guardar campaña" : "Crear borrador"}
      </button>
      <Aviso estado={estado} />
    </form>
  );
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
