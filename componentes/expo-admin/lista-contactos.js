"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, Download, Eye, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import {
  crearContactoExpo,
  editarContactoExpo,
  eliminarContactoExpo,
  exportarContactosExpo,
  leerContactoExpo,
  leerContactosExpo,
  retirarConsentimientoExpo,
} from "@/app/expo-cannabis/admin/acciones";
import { Selector } from "@/componentes/selector";
import { ETIQUETAS_ORIGEN, etiquetasOrigenes } from "@/lib/contactos/reglas";

const ORDENES = [
  { valor: "recientes", etiqueta: "Más recientes" },
  { valor: "antiguos", etiqueta: "Más antiguos" },
  { valor: "nombre", etiqueta: "Nombre A-Z" },
];

const CONSULTA_INICIAL = { busqueda: "", filtro: "todos", orden: "recientes", pagina: 1 };

function formatearNumero(valor) {
  return new Intl.NumberFormat("es-AR").format(valor || 0);
}

function formatearFecha(valor, conHora = true) {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(fecha);
}

function valorOGuion(valor) {
  return valor ? valor : "—";
}

function nombreArchivo(consulta) {
  const fecha = new Date().toISOString().slice(0, 10);
  const sufijo = consulta.filtro && consulta.filtro !== "todos" ? `-${consulta.filtro}` : "";
  return `contactos-enflora${sufijo}-${fecha}.csv`;
}

function descargarCsv(nombre, contenido) {
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Origenes({ contacto }) {
  const etiquetas = etiquetasOrigenes(contacto);
  if (!etiquetas.length) return "—";
  return (
    <span className="expo-contactos__origenes">
      {etiquetas.map((etiqueta) => (
        <span key={etiqueta} className={`expo-contactos__tag expo-contactos__tag--${etiqueta.toLowerCase()}`}>
          {etiqueta}
        </span>
      ))}
    </span>
  );
}

function FormularioContacto({ idBase, valores, setValores, errores, pendiente, onSubmit, onCancelar, textoGuardar }) {
  return (
    <form className="expo-admin__formulario" onSubmit={onSubmit} noValidate>
      <label htmlFor={`${idBase}-nombre`}>
        Nombre
        <input
          id={`${idBase}-nombre`}
          type="text"
          autoComplete="off"
          maxLength={80}
          placeholder="Flora Tricoma"
          value={valores.nombre}
          disabled={pendiente}
          aria-invalid={errores.nombre ? true : undefined}
          onChange={(evento) => setValores({ ...valores, nombre: evento.target.value })}
        />
        {errores.nombre ? <span className="expo-contactos__error">{errores.nombre}</span> : null}
      </label>
      <label htmlFor={`${idBase}-email`}>
        Correo electrónico
        <input
          id={`${idBase}-email`}
          type="email"
          inputMode="email"
          autoComplete="off"
          maxLength={254}
          placeholder="flora.trico420@gmail.com"
          value={valores.email}
          disabled={pendiente}
          aria-invalid={errores.email ? true : undefined}
          onChange={(evento) => setValores({ ...valores, email: evento.target.value })}
        />
        {errores.email ? <span className="expo-contactos__error">{errores.email}</span> : null}
      </label>
      <label htmlFor={`${idBase}-telefono`}>
        Teléfono
        <input
          id={`${idBase}-telefono`}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          maxLength={25}
          placeholder="+54 9 11 1234 5678"
          value={valores.telefono}
          disabled={pendiente}
          aria-invalid={errores.telefono ? true : undefined}
          onChange={(evento) => setValores({ ...valores, telefono: evento.target.value })}
        />
        {errores.telefono ? <span className="expo-contactos__error">{errores.telefono}</span> : null}
      </label>
      <p className="expo-admin__fecha">Se necesita al menos un correo o un teléfono.</p>
      <div className="expo-admin__aviso-accion" aria-live="polite">
        {errores.general ? <p role="alert">{errores.general}</p> : null}
      </div>
      <div className="expo-admin__formulario-acciones expo-admin__formulario-acciones--fila">
        <button
          type="button"
          className="expo-admin__accion expo-admin__accion--gris"
          disabled={pendiente}
          onClick={onCancelar}
        >
          CANCELAR
        </button>
        <button type="submit" className="expo-admin__accion expo-admin__accion--principal" disabled={pendiente}>
          {textoGuardar}
        </button>
      </div>
    </form>
  );
}

export function ListaContactos({ inicial }) {
  const reducido = useReducedMotion();
  const idBase = useId();
  const [consulta, setConsulta] = useState(() => ({ ...CONSULTA_INICIAL, ...(inicial?.consulta || {}) }));
  const [busquedaTexto, setBusquedaTexto] = useState(inicial?.consulta?.busqueda || "");
  const [datos, setDatos] = useState(inicial?.ok ? inicial : null);
  const [error, setError] = useState(inicial?.ok ? "" : inicial?.error || "");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [pendiente, setPendiente] = useState(false);
  const [modal, setModal] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [valores, setValores] = useState({ nombre: "", email: "", telefono: "" });
  const [errores, setErrores] = useState({});
  const [eliminando, setEliminando] = useState(null);
  const accionesDialogo = useRef(null);
  const accionesEliminar = useRef(null);
  const primeraCarga = useRef(true);
  const version = useRef(0);

  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      if (inicial?.ok) return undefined;
    }
    const actual = ++version.current;
    const id = window.setTimeout(async () => {
      setCargando(true);
      const respuesta = await leerContactosExpo(consulta);
      if (actual !== version.current) return;
      setCargando(false);
      if (!respuesta.ok) {
        setError(respuesta.error);
        return;
      }
      setError("");
      setDatos(respuesta);
    }, 0);
    return () => window.clearTimeout(id);
  }, [consulta, inicial]);

  useEffect(() => {
    if (!mensaje) return undefined;
    const id = window.setTimeout(() => setMensaje(""), 2500);
    return () => window.clearTimeout(id);
  }, [mensaje]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setConsulta((previa) => {
        const limpia = busquedaTexto.trim();
        if (previa.busqueda === limpia) return previa;
        return { ...previa, busqueda: limpia, pagina: 1 };
      });
    }, 300);
    return () => window.clearTimeout(id);
  }, [busquedaTexto]);

  function recargar() {
    setConsulta((previa) => ({ ...previa }));
  }

  function cambiarOrden(orden) {
    setConsulta((previa) => ({ ...previa, orden, pagina: 1 }));
  }

  function irPagina(pagina) {
    setConsulta((previa) => ({ ...previa, pagina }));
  }

  function cerrarModal() {
    setModal(null);
    setErrores({});
  }

  function cambiarDialogo(abierto, detalles) {
    if (!abierto) {
      detalles?.preventUnmountOnClose?.();
      if (!pendiente) cerrarModal();
    }
  }

  function cambiarEliminar(abierto, detalles) {
    if (!abierto) {
      detalles?.preventUnmountOnClose?.();
      if (!pendiente) setEliminando(null);
    }
  }

  function abrirNuevo() {
    setValores({ nombre: "", email: "", telefono: "" });
    setErrores({});
    setMensaje("");
    setModal({ tipo: "nuevo" });
  }

  async function abrirVer(contacto) {
    setDetalle(null);
    setErrores({});
    setModal({ tipo: "ver", contacto });
    const respuesta = await leerContactoExpo(contacto.id);
    if (respuesta.ok) setDetalle(respuesta.contacto);
    else setErrores({ general: respuesta.error });
  }

  function abrirEditar(contacto) {
    setValores({ nombre: contacto.nombre || "", email: contacto.email || "", telefono: contacto.telefono || "" });
    setErrores({});
    setModal({ tipo: "editar", contacto });
  }

  async function guardar(evento) {
    evento.preventDefault();
    if (pendiente || !modal) return;
    setPendiente(true);
    setErrores({});
    const respuesta =
      modal.tipo === "nuevo" ? await crearContactoExpo(valores) : await editarContactoExpo(modal.contacto.id, valores);
    setPendiente(false);
    if (!respuesta.ok) {
      setErrores(respuesta.campo ? { [respuesta.campo]: respuesta.error } : { general: respuesta.error });
      return;
    }
    setMensaje(modal.tipo === "nuevo" ? respuesta.mensaje : "Contacto actualizado.");
    cerrarModal();
    recargar();
  }

  async function confirmarEliminar() {
    if (pendiente || !eliminando) return;
    setPendiente(true);
    const respuesta = await eliminarContactoExpo(eliminando.id);
    setPendiente(false);
    if (!respuesta.ok) {
      setErrores({ eliminar: respuesta.error });
      return;
    }
    setEliminando(null);
    setErrores({});
    setMensaje("Contacto eliminado.");
    recargar();
  }

  async function retirarConsentimiento() {
    if (pendiente || !modal?.contacto) return;
    setPendiente(true);
    const respuesta = await retirarConsentimientoExpo(modal.contacto.id);
    setPendiente(false);
    if (!respuesta.ok) {
      setErrores({ general: respuesta.error });
      return;
    }
    const lectura = await leerContactoExpo(modal.contacto.id);
    if (lectura.ok) setDetalle(lectura.contacto);
    setMensaje("Consentimiento retirado.");
    recargar();
  }

  async function exportar() {
    if (pendiente) return;
    setPendiente(true);
    setMensaje("");
    const respuesta = await exportarContactosExpo(consulta);
    setPendiente(false);
    if (!respuesta.ok) {
      setError(respuesta.error);
      return;
    }
    descargarCsv(nombreArchivo(consulta), respuesta.csv);
    setMensaje(
      respuesta.truncado
        ? `Exportamos ${formatearNumero(respuesta.cantidad)} contactos (límite alcanzado, afiná el filtro para el resto).`
        : `Exportamos ${formatearNumero(respuesta.cantidad)} contactos.`,
    );
  }

  const resumen = datos?.resumen || { total: 0 };
  const filas = datos?.filas || [];
  const paginas = datos?.paginas || 1;
  const pagina = datos?.pagina || consulta.pagina;
  const total = datos?.total || 0;
  const desde = total ? (pagina - 1) * (datos?.tamano || 25) + 1 : 0;
  const hasta = total ? Math.min(total, desde + filas.length - 1) : 0;
  const detalleActivo = modal?.tipo === "ver" ? detalle || modal.contacto : null;

  return (
    <section className="expo-contactos" aria-labelledby={`${idBase}-titulo`}>
      <header className="expo-contactos__cabecera">
        <div>
          <h2 id={`${idBase}-titulo`} className="expo-contactos__titulo">
            Lista de jugadores y conocidos
          </h2>
          <p className="expo-contactos__descripcion">
            Administrá los contactos registrados desde Enflora y la Ruleta 420.
          </p>
        </div>
        <div className="expo-contactos__cabecera-acciones">
          <button
            type="button"
            className="expo-admin__accion expo-admin__accion--secundaria expo-contactos__boton"
            disabled={pendiente || !datos}
            onClick={exportar}
          >
            <Download size={18} strokeWidth={2.4} aria-hidden="true" />
            EXPORTAR CSV
          </button>
        </div>
      </header>

      <button
        type="button"
        className="expo-contactos__flotante"
        aria-label="Agregar contacto"
        disabled={pendiente}
        onClick={abrirNuevo}
      >
        <Plus size={28} strokeWidth={2.6} aria-hidden="true" />
      </button>

      <div className="expo-admin__metricas expo-contactos__metricas" aria-label="Resumen de contactos">
        <article className="expo-admin__metrica">
          <p>Total de contactos</p>
          <strong>{formatearNumero(resumen.total)}</strong>
        </article>
      </div>

      <div className="expo-contactos__controles">
        <label className="expo-contactos__busqueda" htmlFor={`${idBase}-busqueda`}>
          <Search size={18} strokeWidth={2.2} aria-hidden="true" />
          <span className="expo-contactos__oculto">Buscar contactos</span>
          <input
            id={`${idBase}-busqueda`}
            type="search"
            placeholder="Buscar por nombre, correo o teléfono"
            autoComplete="off"
            maxLength={60}
            value={busquedaTexto}
            onChange={(evento) => setBusquedaTexto(evento.target.value)}
          />
        </label>
        <Selector
          id={`${idBase}-orden`}
          etiqueta="Ordenar"
          className="expo-contactos__orden"
          valor={consulta.orden}
          opciones={ORDENES}
          onChange={cambiarOrden}
        />
      </div>

      <div className="expo-admin__aviso-fila" aria-live="polite">
        {error ? <p role="alert">{error}</p> : mensaje ? <p>{mensaje}</p> : null}
      </div>

      <div className={`expo-contactos__tabla-marco${cargando ? " expo-contactos__tabla-marco--cargando" : ""}`} aria-busy={cargando}>
        <table className="expo-contactos__tabla">
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Email</th>
              <th scope="col">Teléfono</th>
              <th scope="col">Origen</th>
              <th scope="col">Fecha</th>
              <th scope="col">
                <span className="expo-contactos__oculto">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={6} className="expo-contactos__vacio">
                  {datos
                    ? "No hay contactos que coincidan con la búsqueda."
                    : error
                      ? "Todavía no se pudieron cargar los contactos."
                      : "Cargando contactos..."}
                </td>
              </tr>
            ) : (
              filas.map((contacto) => (
                <tr key={contacto.id}>
                  <td data-columna="Nombre">{valorOGuion(contacto.nombre)}</td>
                  <td data-columna="Email" className="expo-contactos__celda-larga">
                    {valorOGuion(contacto.email)}
                  </td>
                  <td data-columna="Teléfono">{valorOGuion(contacto.telefono)}</td>
                  <td data-columna="Origen">
                    <Origenes contacto={contacto} />
                  </td>
                  <td data-columna="Fecha">{formatearFecha(contacto.created_at, false)}</td>
                  <td data-columna="Acciones">
                    <span className="expo-contactos__acciones">
                      <button
                        type="button"
                        className="expo-contactos__icono"
                        aria-label={`Ver ${contacto.nombre || contacto.email || contacto.telefono || "contacto"}`}
                        onClick={() => abrirVer(contacto)}
                      >
                        <Eye size={18} strokeWidth={2.2} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="expo-contactos__icono"
                        aria-label={`Editar ${contacto.nombre || contacto.email || contacto.telefono || "contacto"}`}
                        onClick={() => abrirEditar(contacto)}
                      >
                        <Pencil size={18} strokeWidth={2.2} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="expo-contactos__icono expo-contactos__icono--peligro"
                        aria-label={`Eliminar ${contacto.nombre || contacto.email || contacto.telefono || "contacto"}`}
                        onClick={() => {
                          setErrores({});
                          setEliminando(contacto);
                        }}
                      >
                        <Trash2 size={18} strokeWidth={2.2} aria-hidden="true" />
                      </button>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <nav className="expo-contactos__paginacion" aria-label="Paginación de contactos">
        <p>{total ? `${desde}–${hasta} de ${formatearNumero(total)}` : "0 contactos"}</p>
        <div>
          <button
            type="button"
            className="expo-contactos__icono"
            aria-label="Página anterior"
            disabled={pagina <= 1 || cargando}
            onClick={() => irPagina(pagina - 1)}
          >
            <ChevronLeft size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <span>
            Página {pagina} de {paginas}
          </span>
          <button
            type="button"
            className="expo-contactos__icono"
            aria-label="Página siguiente"
            disabled={pagina >= paginas || cargando}
            onClick={() => irPagina(pagina + 1)}
          >
            <ChevronRight size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </nav>

      <Dialog.Root open={Boolean(modal)} onOpenChange={cambiarDialogo} actionsRef={accionesDialogo}>
        <Dialog.Portal>
          <Dialog.Backdrop
            render={
              <motion.div
                className="expo-admin__fondo"
                initial={{ opacity: 0 }}
                animate={{ opacity: modal ? 1 : 0 }}
                transition={{ duration: reducido ? 0 : 0.18 }}
              />
            }
          />
          <Dialog.Viewport className="expo-admin__vista">
            <Dialog.Popup
              render={
                <motion.div
                  className="expo-admin__panel"
                  initial={reducido ? false : { opacity: 0, y: 28 }}
                  animate={modal ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
                  transition={reducido ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                  onAnimationComplete={() => {
                    if (!modal) accionesDialogo.current?.unmount();
                  }}
                />
              }
            >
              {modal ? (
                <>
                  <div className="expo-admin__panel-cabecera">
                    <Dialog.Title className="expo-admin__panel-titulo">
                      {modal.tipo === "nuevo" ? "Nuevo contacto" : modal.tipo === "editar" ? "Editar contacto" : "Contacto"}
                    </Dialog.Title>
                    <button
                      type="button"
                      className="expo-admin__cerrar"
                      aria-label="Cerrar"
                      disabled={pendiente}
                      onClick={() => cambiarDialogo(false)}
                    >
                      <X size={20} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  </div>

                  {modal.tipo === "ver" && detalleActivo ? (
                    <>
                      <Dialog.Description className="expo-contactos__ficha" render={<dl />}>
                        <div>
                          <dt>Nombre</dt>
                          <dd>{valorOGuion(detalleActivo.nombre)}</dd>
                        </div>
                        <div>
                          <dt>Correo electrónico</dt>
                          <dd>{valorOGuion(detalleActivo.email)}</dd>
                        </div>
                        <div>
                          <dt>Teléfono</dt>
                          <dd>{valorOGuion(detalleActivo.telefono)}</dd>
                        </div>
                        <div>
                          <dt>Orígenes</dt>
                          <dd>
                            <Origenes contacto={detalleActivo} />
                          </dd>
                        </div>
                        <div>
                          <dt>Registrado</dt>
                          <dd>{formatearFecha(detalleActivo.created_at)}</dd>
                        </div>
                        <div>
                          <dt>Última actualización</dt>
                          <dd>{formatearFecha(detalleActivo.updated_at)}</dd>
                        </div>
                      </Dialog.Description>

                      {Array.isArray(detalleActivo.detalle_origenes) && detalleActivo.detalle_origenes.length ? (
                        <div className="expo-contactos__historial">
                          <h3>Registros por origen</h3>
                          <ul>
                            {detalleActivo.detalle_origenes.map((origen) => (
                              <li key={origen.origen}>
                                <strong>{ETIQUETAS_ORIGEN[origen.origen] || origen.origen}</strong>
                                <span>
                                  {origen.veces > 1 ? `${origen.veces} veces · ` : ""}
                                  primera vez {formatearFecha(origen.primera_vez)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {Array.isArray(detalleActivo.historial) && detalleActivo.historial.length ? (
                        <div className="expo-contactos__historial">
                          <h3>Historial de consentimiento</h3>
                          <ul>
                            {detalleActivo.historial.map((evento) => (
                              <li key={`${evento.registrado_en}-${evento.acepta}`}>
                                <strong>{evento.acepta ? "Aceptó" : "Retiró"}</strong>
                                <span>
                                  {formatearFecha(evento.registrado_en)} · {ETIQUETAS_ORIGEN[evento.origen] || evento.origen}
                                  {evento.version ? ` · ${evento.version}` : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="expo-admin__aviso-accion" aria-live="polite">
                        {errores.general ? <p role="alert">{errores.general}</p> : null}
                      </div>

                      <div className="expo-admin__formulario-acciones">
                        <button
                          type="button"
                          className="expo-admin__accion expo-admin__accion--secundaria"
                          disabled={pendiente}
                          onClick={() => abrirEditar(detalleActivo)}
                        >
                          EDITAR DATOS
                        </button>
                        {detalleActivo.consentimiento_marketing ? (
                          <button
                            type="button"
                            className="expo-admin__accion expo-admin__accion--corregir"
                            disabled={pendiente}
                            onClick={retirarConsentimiento}
                          >
                            RETIRAR CONSENTIMIENTO
                          </button>
                        ) : null}
                      </div>
                    </>
                  ) : null}

                  {modal.tipo === "nuevo" || modal.tipo === "editar" ? (
                    <>
                      {modal.tipo === "editar" ? (
                        <Dialog.Description className="expo-admin__fecha">
                          Corregí los datos de contacto. El consentimiento no se modifica desde acá.
                        </Dialog.Description>
                      ) : null}
                      <FormularioContacto
                        idBase={`${idBase}-${modal.tipo}`}
                        valores={valores}
                        setValores={setValores}
                        errores={errores}
                        pendiente={pendiente}
                        onSubmit={guardar}
                        onCancelar={cerrarModal}
                        textoGuardar={modal.tipo === "nuevo" ? "AGREGAR" : "GUARDAR CAMBIOS"}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog.Root open={Boolean(eliminando)} onOpenChange={cambiarEliminar} actionsRef={accionesEliminar}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop
            render={
              <motion.div
                className="expo-admin__fondo"
                initial={{ opacity: 0 }}
                animate={{ opacity: eliminando ? 1 : 0 }}
                transition={{ duration: reducido ? 0 : 0.18 }}
              />
            }
          />
          <AlertDialog.Viewport className="expo-admin__vista">
            <AlertDialog.Popup
              render={
                <motion.div
                  className="expo-admin__panel"
                  initial={reducido ? false : { opacity: 0, y: 28 }}
                  animate={eliminando ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
                  transition={reducido ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                  onAnimationComplete={() => {
                    if (!eliminando) accionesEliminar.current?.unmount();
                  }}
                />
              }
            >
              <div className="expo-admin__panel-cabecera">
                <AlertDialog.Title className="expo-admin__panel-titulo">Eliminar contacto</AlertDialog.Title>
                <button
                  type="button"
                  className="expo-admin__cerrar"
                  aria-label="Cerrar"
                  disabled={pendiente}
                  onClick={() => cambiarEliminar(false)}
                >
                  <X size={20} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>

              <AlertDialog.Description className="expo-admin__confirmacion">
                Se va a eliminar a {eliminando?.nombre || eliminando?.email || eliminando?.telefono || "este contacto"} junto
                con sus orígenes y su historial de consentimiento. Esta acción no se puede deshacer.
              </AlertDialog.Description>

              <div className="expo-admin__aviso-accion" aria-live="polite">
                {errores.eliminar ? <p role="alert">{errores.eliminar}</p> : null}
              </div>

              <div className="expo-admin__formulario-acciones">
                <button
                  type="button"
                  className="expo-admin__accion expo-admin__accion--corregir"
                  disabled={pendiente}
                  onClick={confirmarEliminar}
                >
                  SÍ, ELIMINAR
                </button>
                <button
                  type="button"
                  className="expo-admin__accion expo-admin__accion--secundaria"
                  disabled={pendiente}
                  onClick={() => cambiarEliminar(false)}
                >
                  CANCELAR
                </button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}
