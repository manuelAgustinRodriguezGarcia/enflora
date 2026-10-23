"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import { RotateCcw, X } from "lucide-react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  guardarInventarioExpo,
  leerPanelExpo,
  registrarEntregaExpo,
  reiniciarParticipantesExpo,
} from "@/app/expo-cannabis/admin/acciones";
import { SalirExpo } from "@/componentes/expo-admin/salir-expo";
import { IlustracionRegalo } from "@/componentes/expo-cannabis/ilustraciones-expo";
import { deltasEntregaExpo } from "@/lib/expo-cannabis/productos";

const INTERVALO = 20000;

function formatearNumero(valor) {
  return new Intl.NumberFormat("es-AR").format(valor);
}

function formatearFecha(valor) {
  if (!valor) return "";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}

function leerEntero(valor) {
  const texto = String(valor ?? "").trim();
  if (!/^(0|[1-9]\d{0,6})$/.test(texto)) return null;
  return Number(texto);
}

function DibujoProducto({ producto }) {
  if (producto.imagen?.src) {
    return (
      <Image
        src={producto.imagen.src}
        alt=""
        fill
        sizes="8rem"
        className="expo-admin__foto"
      />
    );
  }
  return <IlustracionRegalo nombre={producto.ilustracion} />;
}

export function PanelExpo({ productos, participantes, partidas, aviso: avisoInicial, children }) {
  const reducido = useReducedMotion();
  const [datos, setDatos] = useState({ productos, participantes, partidas });
  const [aviso, setAviso] = useState(avisoInicial || "");
  const [slugActivo, setSlugActivo] = useState(null);
  const [editando, setEditando] = useState(false);
  const [stockTexto, setStockTexto] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [confirmandoReinicio, setConfirmandoReinicio] = useState(false);
  const [errorReinicio, setErrorReinicio] = useState("");
  const pendienteRef = useRef(false);
  const versionRef = useRef(0);
  const accionesDialogo = useRef(null);
  const accionesReinicio = useRef(null);
  const activo = datos.productos.find((producto) => producto.slug === slugActivo) ?? null;
  const sinStock = Boolean(activo?.configurado && activo.restante === 0);
  const fecha = formatearFecha(activo?.updatedAt);

  useEffect(() => {
    if (pendienteRef.current) return;
    setDatos({ productos, participantes, partidas });
    setAviso(avisoInicial || "");
  }, [productos, participantes, partidas, avisoInicial]);

  useEffect(() => {
    if (!mensaje) return undefined;
    const id = window.setTimeout(() => setMensaje(""), 1600);
    return () => window.clearTimeout(id);
  }, [mensaje]);

  useEffect(() => {
    let vigente = true;
    const id = window.setInterval(async () => {
      if (!vigente || pendienteRef.current || document.visibilityState !== "visible") return;
      const version = versionRef.current;
      const resultado = await leerPanelExpo();
      if (!vigente || pendienteRef.current || version !== versionRef.current || !resultado?.ok) return;
      setDatos({
        productos: resultado.productos,
        participantes: resultado.participantes,
        partidas: resultado.partidas,
      });
      setAviso("");
    }, INTERVALO);
    return () => {
      vigente = false;
      window.clearInterval(id);
    };
  }, []);

  function marcarPendiente(valor) {
    pendienteRef.current = valor;
    setPendiente(valor);
  }

  function aplicarProducto(producto) {
    setDatos((actual) => ({
      ...actual,
      productos: actual.productos.map((item) => (item.slug === producto.slug ? producto : item)),
    }));
  }

  async function entregar(slug, delta) {
    if (pendienteRef.current) return;
    const version = versionRef.current + 1;
    versionRef.current = version;
    marcarPendiente(true);
    setError("");
    setMensaje("");
    try {
      const resultado = await registrarEntregaExpo(slug, delta);
      if (version !== versionRef.current) return;
      if (resultado.producto) aplicarProducto(resultado.producto);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setMensaje(delta < 0 ? "Entrega corregida" : "Entrega registrada");
    } catch {
      if (version === versionRef.current) setError("No se pudo guardar el cambio.");
    } finally {
      if (version === versionRef.current) marcarPendiente(false);
    }
  }

  function abrirEdicion() {
    if (!activo || pendienteRef.current) return;
    setStockTexto(activo.configurado ? String(activo.stockTotal) : "");
    setError("");
    setMensaje("");
    setEditando(true);
  }

  async function guardar(evento) {
    evento.preventDefault();
    if (!activo || pendienteRef.current) return;
    const stockTotal = leerEntero(stockTexto);
    const entregados = activo.configurado ? activo.entregados : 0;
    if (stockTotal === null) {
      setError("Usá un número entero, cero o más.");
      return;
    }
    if (entregados + (activo.reservados || 0) > stockTotal) {
      setError("El stock no alcanza para las reservas pendientes.");
      return;
    }
    const version = versionRef.current + 1;
    versionRef.current = version;
    marcarPendiente(true);
    setError("");
    try {
      const resultado = await guardarInventarioExpo(activo.slug, stockTotal, entregados);
      if (version !== versionRef.current) return;
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      aplicarProducto(resultado.producto);
      setEditando(false);
      setMensaje("Inventario actualizado");
    } catch {
      if (version === versionRef.current) setError("No se pudo guardar el cambio.");
    } finally {
      if (version === versionRef.current) marcarPendiente(false);
    }
  }

  function abrirReinicio() {
    if (pendienteRef.current) return;
    setErrorReinicio("");
    setMensaje("");
    setConfirmandoReinicio(true);
  }

  function cambiarReinicio(siguiente, detalles) {
    if (!siguiente && pendienteRef.current) {
      detalles?.cancel();
      return;
    }
    if (!siguiente) {
      detalles?.preventUnmountOnClose?.();
      setConfirmandoReinicio(false);
      setErrorReinicio("");
    }
  }

  async function reiniciarParticipantes() {
    if (pendienteRef.current) return;
    const version = versionRef.current + 1;
    versionRef.current = version;
    marcarPendiente(true);
    setErrorReinicio("");
    try {
      const resultado = await reiniciarParticipantesExpo();
      if (version !== versionRef.current) return;
      if (!resultado.ok) {
        setErrorReinicio(resultado.error);
        return;
      }
      setDatos((actual) => ({
        ...actual,
        participantes: resultado.participantes,
        partidas: resultado.partidas,
      }));
      setConfirmandoReinicio(false);
      setError("");
      setMensaje("Participantes reiniciados");
    } catch {
      if (version === versionRef.current) setErrorReinicio("No se pudo reiniciar el conteo.");
    } finally {
      if (version === versionRef.current) marcarPendiente(false);
    }
  }

  function cambiarDialogo(siguiente, detalles) {
    if (!siguiente && pendienteRef.current) {
      detalles?.cancel();
      return;
    }
    if (!siguiente) {
      detalles?.preventUnmountOnClose?.();
      setSlugActivo(null);
      setEditando(false);
      setError("");
    }
  }

  function puedeAjustar(producto, delta) {
    if (!producto.configurado || pendiente) return false;
    if (delta < 0) return producto.entregados >= -delta;
    return producto.stockTotal - producto.entregados >= delta;
  }

  const entrada = reducido ? false : { opacity: 0, y: 14 };

  return (
    <motion.div className="expo-admin" initial={entrada} animate={{ opacity: 1, y: 0 }}>
      <header className="expo-admin__cabecera">
        <SalirExpo />
        <h1>Expo Cannabis</h1>
        <p className="expo-admin__subtitulo">Panel de administración</p>
      </header>

      {aviso ? (
        <p className="expo-admin__alerta" role="alert">
          {aviso}
        </p>
      ) : null}

      <section className="expo-admin__metricas" aria-label="Resumen">
        <article className="expo-admin__metrica expo-admin__metrica--reiniciable">
          <button
            type="button"
            className="expo-admin__reiniciar"
            aria-haspopup="dialog"
            aria-label="Reiniciar conteo de participantes"
            disabled={pendiente}
            onClick={abrirReinicio}
          >
            <RotateCcw size={16} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <p>Participantes únicos</p>
          <strong>{formatearNumero(datos.participantes)}</strong>
          <span>Partidas iniciadas: {formatearNumero(datos.partidas)}</span>
          <small>El conteo es por navegador. Una misma persona puede sumar otra vez si usa otro dispositivo.</small>
        </article>
      </section>

      <div className="expo-admin__aviso-fila" aria-live="polite">
        {!activo && error ? <p role="alert">{error}</p> : null}
        {!activo && mensaje ? <p>{mensaje}</p> : null}
      </div>

      <div className="expo-admin__fila">
        {datos.productos.map((producto) => {
          const etiqueta = producto.configurado
            ? `${producto.nombre}, ${producto.entregados} entregados, ${producto.reservados} reservados, quedan ${producto.restante}`
            : `${producto.nombre}, inventario sin configurar`;
          const deltas = deltasEntregaExpo(producto.slug);
          return (
            <article key={producto.slug} className="expo-admin__producto">
              <button
                type="button"
                className="expo-admin__abrir"
                aria-haspopup="dialog"
                aria-label={etiqueta}
                onClick={() => {
                  setSlugActivo(producto.slug);
                  setEditando(false);
                  setError("");
                  setMensaje("");
                }}
              >
                <motion.strong
                  key={producto.configurado ? producto.entregados : "vacio"}
                  initial={reducido ? false : { scale: 0.86, opacity: 0.45 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  {producto.configurado ? formatearNumero(producto.entregados) : "—"}
                </motion.strong>
                <span className="expo-admin__dibujo" aria-hidden="true">
                  <DibujoProducto producto={producto} />
                </span>
                <span className="expo-admin__nombre">{producto.nombre}</span>
                <span className="expo-admin__resto">
                  {producto.configurado
                    ? `Quedan ${formatearNumero(producto.restante)} · ${formatearNumero(producto.reservados)} reservados`
                    : "Inventario sin configurar"}
                </span>
              </button>
              <div
                className={deltas.length > 2 ? "expo-admin__pasos" : "expo-admin__pasos expo-admin__pasos--par"}
                role="group"
                aria-label={`Ajustar entregas de ${producto.nombre}`}
              >
                {deltas.map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    className={delta < 0 ? "expo-admin__paso expo-admin__paso--restar" : "expo-admin__paso expo-admin__paso--sumar"}
                    disabled={!puedeAjustar(producto, delta)}
                    aria-label={`${delta < 0 ? "Restar" : "Sumar"} ${Math.abs(delta)} ${producto.nombre}`}
                    onClick={() => entregar(producto.slug, delta)}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      {children}

      <Dialog.Root open={Boolean(activo)} onOpenChange={cambiarDialogo} actionsRef={accionesDialogo}>
        <Dialog.Portal>
          <Dialog.Backdrop
            render={
              <motion.div
                className="expo-admin__fondo"
                initial={{ opacity: 0 }}
                animate={{ opacity: activo ? 1 : 0 }}
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
                  animate={activo ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
                  transition={reducido ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                  onAnimationComplete={() => {
                    if (!activo) accionesDialogo.current?.unmount();
                  }}
                />
              }
            >
              {activo ? (
                <>
                  <div className="expo-admin__panel-cabecera">
                    <Dialog.Title className="expo-admin__panel-titulo">{activo.nombre}</Dialog.Title>
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

                  {editando ? (
                    <form className="expo-admin__formulario" onSubmit={guardar}>
                      <Dialog.Description className="expo-admin__fecha">
                        Cargá el stock total.
                      </Dialog.Description>
                      <label>
                        Stock total
                        <input
                          inputMode="numeric"
                          autoComplete="off"
                          value={stockTexto}
                          disabled={pendiente}
                          onChange={(evento) => setStockTexto(evento.target.value)}
                        />
                      </label>
                      <div className="expo-admin__aviso-accion" aria-live="polite">
                        {error ? <p role="alert">{error}</p> : null}
                      </div>
                      <div className="expo-admin__formulario-acciones">
                        <button type="submit" className="expo-admin__accion expo-admin__accion--principal" disabled={pendiente}>
                          GUARDAR CAMBIOS
                        </button>
                        <button
                          type="button"
                          className="expo-admin__accion expo-admin__accion--secundaria"
                          disabled={pendiente}
                          onClick={() => {
                            setEditando(false);
                            setError("");
                          }}
                        >
                          CANCELAR
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {activo.configurado ? (
                        <Dialog.Description className="expo-admin__cifras" render={<dl />}>
                          <div>
                            <dt>Stock total</dt>
                            <dd>{formatearNumero(activo.stockTotal)}</dd>
                          </div>
                          <div>
                            <dt>Entregados</dt>
                            <dd>{formatearNumero(activo.entregados)}</dd>
                          </div>
                          <div>
                            <dt>Reservados</dt>
                            <dd>{formatearNumero(activo.reservados)}</dd>
                          </div>
                          <div>
                            <dt>Disponibles</dt>
                            <dd>{formatearNumero(activo.restante)}</dd>
                          </div>
                        </Dialog.Description>
                      ) : (
                        <Dialog.Description className="expo-admin__vacio">
                          Inventario sin configurar
                        </Dialog.Description>
                      )}

                      {sinStock ? <p className="expo-admin__sinstock">SIN STOCK</p> : null}
                      {fecha ? <p className="expo-admin__fecha">Actualizado {fecha}</p> : null}

                      <div className="expo-admin__aviso-accion" aria-live="polite">
                        {error ? <p role="alert">{error}</p> : mensaje ? <p>{mensaje}</p> : null}
                      </div>

                      <button
                        type="button"
                        className="expo-admin__accion expo-admin__accion--secundaria"
                        disabled={pendiente}
                        onClick={abrirEdicion}
                      >
                        EDITAR INVENTARIO
                      </button>
                    </>
                  )}
                </>
              ) : null}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog.Root open={confirmandoReinicio} onOpenChange={cambiarReinicio} actionsRef={accionesReinicio}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop
            render={
              <motion.div
                className="expo-admin__fondo"
                initial={{ opacity: 0 }}
                animate={{ opacity: confirmandoReinicio ? 1 : 0 }}
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
                  animate={confirmandoReinicio ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
                  transition={reducido ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                  onAnimationComplete={() => {
                    if (!confirmandoReinicio) accionesReinicio.current?.unmount();
                  }}
                />
              }
            >
              <div className="expo-admin__panel-cabecera">
                <AlertDialog.Title className="expo-admin__panel-titulo">Reiniciar conteo</AlertDialog.Title>
                <button
                  type="button"
                  className="expo-admin__cerrar"
                  aria-label="Cerrar"
                  disabled={pendiente}
                  onClick={() => cambiarReinicio(false)}
                >
                  <X size={20} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>

              <AlertDialog.Description className="expo-admin__confirmacion">
                Se van a borrar los {formatearNumero(datos.participantes)} participantes y las{" "}
                {formatearNumero(datos.partidas)} partidas iniciadas. El inventario y las entregas no cambian. Esta
                acción no se puede deshacer.
              </AlertDialog.Description>

              <div className="expo-admin__aviso-accion" aria-live="polite">
                {errorReinicio ? <p role="alert">{errorReinicio}</p> : null}
              </div>

              <div className="expo-admin__formulario-acciones">
                <button
                  type="button"
                  className="expo-admin__accion expo-admin__accion--corregir"
                  disabled={pendiente}
                  onClick={reiniciarParticipantes}
                >
                  SÍ, REINICIAR
                </button>
                <button
                  type="button"
                  className="expo-admin__accion expo-admin__accion--secundaria"
                  disabled={pendiente}
                  onClick={() => cambiarReinicio(false)}
                >
                  CANCELAR
                </button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </motion.div>
  );
}
