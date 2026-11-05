"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { motion } from "motion/react";
import { cargarContextoReporte, crearReporteProblema } from "@/app/reportes/acciones";
import { Boton } from "@/componentes/boton";
import { ModalConfirmacion } from "@/componentes/modal-confirmacion";
import { PillPlantas } from "@/componentes/resumen-configuracion";
import { Selector } from "@/componentes/selector";
import { SelectorFotos } from "@/componentes/selector-fotos";
import { MAX_FOTOS_REPORTE, descripcionReporteValida, plantasAfectadasReporte, seleccionInicialReporte } from "@/lib/reportes-problema";
import { liberarVista, procesarFoto } from "@/lib/fotos-cliente";
import { borrarArchivosSubidos, subirFotoRegistro } from "@/lib/fotos-subida";
import { transicionRapida, transicionVista } from "@/lib/animaciones";

const PLACEHOLDER =
  "Contale a Flora qué estás observando. Por ejemplo: las hojas inferiores están amarillas, algunas tienen manchas marrones y el crecimiento parece más lento";

const panelAbierto = { opacity: 1, scale: 1, y: 0 };
const panelCerrado = { opacity: 0, scale: 0.98, y: 8 };

function TextoUnidad({ nombre, espacio }) {
  return (
    <span className="selector__opcion-texto">
      <span className="registro-crear__unidad-nombre">{nombre}</span>
      {espacio ? <span className="registro-crear__unidad-lugar">{` en ${espacio}`}</span> : null}
    </span>
  );
}

function tituloPlanta(planta) {
  const nombre = String(planta?.nombre || "").trim();
  if (nombre) return nombre;
  return planta?.numero ? `Planta ${planta.numero}` : "Planta";
}

export function ModalReporteProblema({
  abierto,
  onCerrar,
  origen = "inicio",
  unidadId = "",
  plantaIds = [],
  unidades = null,
  usuarioId = "",
}) {
  const router = useRouter();
  const acciones = useRef(null);
  const enviandoRef = useRef(false);
  const exitoRef = useRef(false);
  const claveRef = useRef("");
  const subidasRef = useRef(new Map());
  const descripcionRef = useRef("");
  const fotosRef = useRef([]);
  const estabaAbierto = useRef(false);
  const anclaUnidad = useRef(null);
  const [lista, setLista] = useState(unidades || []);
  const [usuario, setUsuario] = useState(usuarioId);
  const [unidadActual, setUnidadActual] = useState(unidadId);
  const [alcance, setAlcance] = useState("unidad");
  const [ids, setIds] = useState(() => new Set());
  const [descripcion, setDescripcion] = useState("");
  const [fotos, setFotos] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [fase, setFase] = useState("");
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const entradaRef = useRef({ origen, unidadId, plantaIds, unidades, usuarioId });

  useEffect(() => {
    entradaRef.current = { origen, unidadId, plantaIds, unidades, usuarioId };
    descripcionRef.current = descripcion;
    fotosRef.current = fotos;
  });

  useEffect(() => {
    if (abierto && !estabaAbierto.current) {
      claveRef.current = globalThis.crypto.randomUUID();
      exitoRef.current = false;
    }
    estabaAbierto.current = abierto;
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return undefined;
    const vista = window.visualViewport;
    if (!vista) return undefined;
    const aplicar = () => {
      document.documentElement.style.setProperty("--reporte-vvh", `${Math.round(vista.height)}px`);
    };
    aplicar();
    vista.addEventListener("resize", aplicar);
    vista.addEventListener("scroll", aplicar);
    return () => {
      vista.removeEventListener("resize", aplicar);
      vista.removeEventListener("scroll", aplicar);
      document.documentElement.style.removeProperty("--reporte-vvh");
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return undefined;
    let cancelado = false;
    const entrada = entradaRef.current;

    (async () => {
      setError("");
      if (!entrada.unidades?.length) setCargando(true);
      const contexto = entrada.unidades?.length
        ? { ok: true, error: "", usuarioId: entrada.usuarioId, unidades: entrada.unidades }
        : await cargarContextoReporte();
      if (cancelado) return;
      if (!contexto.ok) {
        setCargando(false);
        setError(contexto.error || "No se pudieron cargar tus cultivos.");
        return;
      }
      setUsuario(contexto.usuarioId || entrada.usuarioId);
      setLista(contexto.unidades);
      const elegida = contexto.unidades.some((item) => item.id === entrada.unidadId)
        ? entrada.unidadId
        : contexto.unidades.length === 1
          ? contexto.unidades[0].id
          : "";
      setUnidadActual(elegida);
      const plantasUnidad = contexto.unidades.find((item) => item.id === elegida)?.plantas || [];
      const seleccion = seleccionInicialReporte({
        origen: entrada.origen,
        plantaIds: entrada.plantaIds,
        plantasUnidad,
      });
      setAlcance(seleccion.alcance);
      setIds(new Set(seleccion.ids));
      setCargando(false);
    })();

    return () => {
      cancelado = true;
    };
    // La entrada se lee al abrir. Si dependiera de los arrays del padre, cada tecla reiniciaría el borrador.
  }, [abierto]);

  const unidad = lista.find((item) => item.id === unidadActual) || null;
  const plantas = unidad?.plantas || [];
  const unaPlanta = plantas.length === 1;

  function liberarItem(item, { borrarStorage }) {
    const subida = subidasRef.current.get(item.clave);
    if (borrarStorage && subida?.rutas?.length) borrarArchivosSubidos(subida.rutas);
    subidasRef.current.delete(item.clave);
    liberarVista(item.procesada || item);
  }

  function cerrarLimpio({ conservarArchivos = false } = {}) {
    for (const item of fotosRef.current) liberarItem(item, { borrarStorage: !conservarArchivos });
    setFotos([]);
    setConfirmarCierre(false);
    setDescripcion("");
    setError("");
    onCerrar();
  }

  function cambiarUnidad(siguiente) {
    setUnidadActual(siguiente);
    setError("");
    const plantasNuevas = lista.find((item) => item.id === siguiente)?.plantas || [];
    const seleccion = seleccionInicialReporte({
      origen: "inicio",
      plantaIds: [],
      plantasUnidad: plantasNuevas,
    });
    setAlcance(seleccion.alcance);
    setIds(new Set(seleccion.ids));
  }

  function alternarPlanta(id) {
    setIds((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  async function incorporarArchivos(archivos, reemplazoClave = "") {
    const cupo = reemplazoClave ? 1 : MAX_FOTOS_REPORTE - fotosRef.current.length;
    if (cupo <= 0) {
      setError(`Un reporte admite hasta ${MAX_FOTOS_REPORTE} fotos.`);
      return;
    }
    setError("");
    const aceptados = archivos.slice(0, cupo);
    if (!reemplazoClave && archivos.length > cupo) {
      setError(`Solo se agregaron ${cupo}: un reporte admite hasta ${MAX_FOTOS_REPORTE} fotos.`);
    }

    if (reemplazoClave) {
      const anterior = fotosRef.current.find((item) => item.clave === reemplazoClave);
      if (anterior) liberarItem(anterior, { borrarStorage: true });
    }

    const marcadores = aceptados.map((archivo) => ({
      clave: reemplazoClave || globalThis.crypto.randomUUID(),
      archivo,
      estado: "procesando",
      url: "",
    }));

    setFotos((listaActual) => {
      const sinReemplazo = reemplazoClave
        ? listaActual.filter((item) => item.clave !== reemplazoClave)
        : listaActual;
      return [...sinReemplazo, ...marcadores];
    });

    for (const marcador of marcadores) {
      const resultado = await procesarFoto(marcador.archivo);
      if (resultado.error) {
        setError(resultado.error);
        setFotos((listaActual) => listaActual.filter((item) => item.clave !== marcador.clave));
        continue;
      }
      setFotos((listaActual) =>
        listaActual.map((item) =>
          item.clave === marcador.clave
            ? {
                clave: item.clave,
                estado: "lista",
                url: resultado.foto.vista,
                procesada: resultado.foto,
              }
            : item,
        ),
      );
    }
  }

  async function subirPendientes() {
    const resultado = [];
    for (const item of fotosRef.current) {
      if (item.estado !== "lista" || !item.procesada) {
        return { error: "Esperá a que termine de prepararse la foto." };
      }
      let subida = subidasRef.current.get(item.clave);
      if (!subida) {
        subida = await subirFotoRegistro(usuario, item.procesada);
        if (subida.error) return { error: subida.error };
        subidasRef.current.set(item.clave, subida);
      }
      resultado.push(subida.foto);
    }
    return { fotos: resultado };
  }

  async function enviar() {
    if (enviandoRef.current) return;
    const relato = descripcionReporteValida(descripcion);
    if (!unidad) {
      setError(lista.length ? "Seleccioná una unidad." : "No hay unidades para reportar.");
      return;
    }
    const afectadas = plantasAfectadasReporte({
      alcance,
      plantasUnidad: plantas,
      idsSeleccionados: [...ids],
    });
    if (!relato.ok) {
      setError(relato.error);
      return;
    }
    if (!afectadas.ok) {
      setError(afectadas.error);
      return;
    }
    if (!usuario) {
      setError("Tenés que iniciar sesión.");
      return;
    }

    enviandoRef.current = true;
    setEnviando(true);
    setError("");

    try {
      setFase(fotosRef.current.length ? "Subiendo fotos..." : "Guardando el reporte...");
      const subidas = await subirPendientes();
      if (subidas.error) {
        setError(subidas.error);
        return;
      }
      setFase("Guardando el reporte...");
      const resultado = await crearReporteProblema({
        claveEnvio: claveRef.current,
        unidadId: unidad.id,
        alcance,
        plantaIds: afectadas.plantas.map((planta) => planta.id),
        descripcion: relato.texto,
        fotos: subidas.fotos || [],
      });
      if (!resultado?.ok) {
        if (resultado?.archivosLimpiados) subidasRef.current = new Map();
        setError(resultado?.error || "No se pudo guardar el reporte. Revisá tu conexión y volvé a intentar.");
        return;
      }
      setFase("Abriendo Flora...");
      exitoRef.current = true;
      router.push(`/flora?reporte=${resultado.reporteId}`);
      cerrarLimpio({ conservarArchivos: true });
    } catch {
      setError("Falló la conexión. El reporte no se envió. Revisá tu internet y reintentá.");
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
      setFase("");
    }
  }

  function alCambiarApertura(siguiente, detalles) {
    if (siguiente) return;
    if (enviandoRef.current) {
      detalles?.cancel();
      return;
    }
    const hayBorrador = descripcionRef.current.trim() || fotosRef.current.length > 0;
    if (!exitoRef.current && hayBorrador) {
      detalles?.cancel();
      setConfirmarCierre(true);
      return;
    }
    detalles?.preventUnmountOnClose?.();
    onCerrar();
  }

  const opcionesUnidad = lista.map((item) => ({
    valor: item.id,
    nombre: item.nombre,
    espacio: item.espacio_nombre || "",
    etiqueta: item.espacio_nombre ? `${item.nombre} en ${item.espacio_nombre}` : item.nombre,
    cantidadPlantas: Array.isArray(item.plantas) ? item.plantas.length : 0,
  }));

  return (
    <>
      <Dialog.Root open={abierto} onOpenChange={alCambiarApertura} actionsRef={acciones}>
        <Dialog.Portal>
          <Dialog.Backdrop
            render={
              <motion.div
                className="modal__fondo"
                initial={{ opacity: 0 }}
                animate={{ opacity: abierto ? 1 : 0 }}
                transition={transicionRapida}
              />
            }
          />
          <Dialog.Viewport className="modal__vista reporte-problema__vista">
            <Dialog.Popup
              render={
                <motion.div
                  className="modal__panel reporte-problema__panel"
                  initial={panelCerrado}
                  animate={abierto ? panelAbierto : panelCerrado}
                  transition={transicionVista}
                  onAnimationComplete={() => {
                    if (!abierto) acciones.current?.unmount();
                  }}
                />
              }
            >
              <button
                type="button"
                className="reporte-problema__cerrar"
                aria-label="Cerrar"
                disabled={enviando}
                onClick={() => alCambiarApertura(false)}
              >
                <X strokeWidth={2} aria-hidden="true" />
              </button>
              <Dialog.Title className="modal__titulo reporte-problema__titulo">
                Contale a Flora tu problema
              </Dialog.Title>

              <div className="reporte-problema__cuerpo">
                {cargando ? <p className="reporte-problema__ayuda">Cargando plantas...</p> : null}

                {!cargando && lista.length > 1 ? (
                  <div className="reporte-problema__campo" ref={anclaUnidad}>
                    <h2 className="reporte-problema__pregunta" id="reporte-unidad-titulo">
                      ¿En qué unidad?
                    </h2>
                    <Selector
                      valor={unidadActual || null}
                      onChange={cambiarUnidad}
                      opciones={opcionesUnidad}
                      placeholder="Elegí una unidad"
                      id="reporte-unidad"
                      ancla={anclaUnidad}
                      alinear="start"
                      deshabilitado={enviando}
                      ariaLabel="Unidad del problema"
                      renderValor={(opcion) =>
                        opcion ? <TextoUnidad nombre={opcion.nombre} espacio={opcion.espacio} /> : null
                      }
                      renderOpcion={(opcion) => (
                        <>
                          <TextoUnidad nombre={opcion.nombre} espacio={opcion.espacio} />
                          <PillPlantas cantidad={opcion.cantidadPlantas} mostrarCero />
                        </>
                      )}
                    />
                  </div>
                ) : null}

                {!cargando && lista.length === 1 && unidad ? (
                  <p className="reporte-problema__unidad">
                    Unidad: <strong>{unidad.nombre}</strong>
                  </p>
                ) : null}

                {!cargando && !unidad && lista.length > 1 ? (
                  <p className="reporte-problema__ayuda">Elegí la unidad para ver sus plantas.</p>
                ) : null}

                {unidad ? (
                  <fieldset className="reporte-problema__campo" disabled={enviando}>
                    <legend className="reporte-problema__pregunta">¿Qué plantas tienen el problema?</legend>
                    {unaPlanta ? (
                      <p className="reporte-problema__ayuda">
                        Esta unidad tiene una sola planta. El reporte abarca toda la unidad.
                      </p>
                    ) : (
                      <div className="reporte-problema__chips" role="group" aria-label="Alcance del problema">
                        <button
                          type="button"
                          className={`reporte-problema__chip${alcance === "unidad" ? " reporte-problema__chip--activo" : ""}`}
                          aria-pressed={alcance === "unidad"}
                          onClick={() => {
                            setAlcance("unidad");
                            setIds(new Set(plantas.map((planta) => planta.id)));
                          }}
                        >
                          Todas las plantas
                        </button>
                        <button
                          type="button"
                          className={`reporte-problema__chip${alcance === "seleccion" ? " reporte-problema__chip--activo" : ""}`}
                          aria-pressed={alcance === "seleccion"}
                          onClick={() => setAlcance("seleccion")}
                        >
                          Solo algunas plantas
                        </button>
                      </div>
                    )}

                    {unaPlanta || alcance === "seleccion" ? (
                      <ul className="reporte-problema__grilla">
                        {plantas.map((planta) => {
                          const activa = unaPlanta || ids.has(planta.id);
                          return (
                            <li key={planta.id}>
                              <button
                                type="button"
                                className={`reporte-problema__planta${activa ? " reporte-problema__planta--activa" : ""}`}
                                aria-pressed={activa}
                                disabled={unaPlanta}
                                onClick={() => alternarPlanta(planta.id)}
                              >
                                <span className="reporte-problema__numero" aria-hidden="true">
                                  {planta.numero || "·"}
                                </span>
                                <span className="reporte-problema__planta-texto">
                                  <span className="reporte-problema__planta-nombre">{tituloPlanta(planta)}</span>
                                  {planta.genetica ? (
                                    <span className="reporte-problema__planta-meta">{planta.genetica}</span>
                                  ) : null}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </fieldset>
                ) : null}

                <label className="reporte-problema__campo" htmlFor="reporte-descripcion">
                  <span className="reporte-problema__pregunta">¿Qué está pasando con tus plantas?</span>
                  <textarea
                    id="reporte-descripcion"
                    value={descripcion}
                    onChange={(evento) => setDescripcion(evento.target.value)}
                    rows={5}
                    maxLength={4000}
                    placeholder={PLACEHOLDER}
                    disabled={enviando}
                    required
                  />
                </label>

                <div className="reporte-problema__campo">
                  <h2 className="reporte-problema__pregunta">Fotografías</h2>
                  <p className="reporte-problema__ayuda">
                    Son opcionales. Ayudan a Flora a mirar el problema. Podés sacarlas con la cámara o elegirlas de la galería, y quitar o reemplazar cualquiera antes de enviar.
                  </p>
                  <SelectorFotos
                    items={fotos}
                    maximo={MAX_FOTOS_REPORTE}
                    disabled={enviando}
                    onSeleccionar={(archivos) => incorporarArchivos(archivos)}
                    onQuitar={(item) => {
                      liberarItem(item, { borrarStorage: true });
                      setFotos((listaActual) => listaActual.filter((foto) => foto.clave !== item.clave));
                    }}
                    onReemplazar={(clave, archivo) => incorporarArchivos([archivo], clave)}
                  />
                </div>
              </div>

              {error ? (
                <p className="formulario__error reporte-problema__error" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="reporte-problema__pie">
                <Boton
                  type="button"
                  className="boton boton--cta boton--ancho"
                  disabled={enviando || cargando || !unidad}
                  onClick={enviar}
                >
                  {fase || "Enviar problema a Flora"}
                </Boton>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      <ModalConfirmacion
        abierto={confirmarCierre}
        onCerrar={() => setConfirmarCierre(false)}
        titulo="¿Cerrar el reporte?"
        descripcion="Si cerrás ahora se pierden la descripción y las fotos que todavía no enviaste."
        textoConfirmar="Cerrar y descartar"
        textoCancelar="Seguir editando"
        varianteConfirmar="destructivo"
        onConfirmar={cerrarLimpio}
      />
    </>
  );
}
