import { Bell, Send, Smartphone, Users } from "lucide-react";
import { textoDia, textoEntero, textoInstante } from "@/componentes/admin/formato-dashboard";

const PERIODOS = [
  ["7", "Últimos 7 días"],
  ["30", "Últimos 30 días"],
  ["90", "Últimos 90 días"],
  ["personalizado", "Período personalizado"],
];

const ESTADOS = [
  ["todos", "Todos los estados"],
  ["borrador", "Borrador"],
  ["programada", "Programada"],
  ["en_curso", "En curso"],
  ["completada", "Completada"],
  ["cancelada", "Cancelada"],
  ["error", "Error"],
];

const PLATAFORMAS = {
  android: "Android",
  ios: "iPhone y iPad",
  escritorio: "Escritorio",
  desconocida: "Sin identificar",
};

const MOTIVOS = {
  usuario: "La persona desactivó los avisos",
  expirada: "Suscripción vencida o inválida",
  reemplazada: "Reemplazada por otra instalación",
  credenciales: "Credenciales rechazadas",
  sin_motivo: "Sin motivo registrado",
  otro: "Otro motivo",
};

const FALLOS = {
  suscripcion_invalida: "Suscripción inválida (404 o 410)",
  credenciales: "Credenciales (401 o 403)",
  temporal: "Error temporal del servicio",
  interrumpido: "Envío interrumpido",
  omitido: "Omitido antes de salir",
  otro: "Otro fallo",
};

export function etiquetaEstadoCampana(estado) {
  return ESTADOS.find(([id]) => id === estado)?.[1] || "Estado desconocido";
}

export function MarcoNotificaciones({ titulo, intro, formulario, aviso, children }) {
  return (
    <section className="admin-dash admin-planes">
      <header className="admin-dash__cabecera">
        <p className="admin-estado__etiqueta">Administración</p>
        <h1>{titulo}</h1>
        <p className="admin-dash__aclaracion">{intro}</p>
      </header>
      {formulario}
      {aviso ? (
        <p className="admin-dash__aviso admin-dash__aviso--bloque" role="alert">
          {aviso}
        </p>
      ) : null}
      {children}
    </section>
  );
}

export function FormularioNotificaciones({ consulta }) {
  return (
    <form className="admin-planes__filtros" method="get" action="/admin/notificaciones">
      <label className="admin-planes__campo">
        <span>Período</span>
        <select name="periodo" defaultValue={consulta.periodo}>
          {PERIODOS.map(([id, texto]) => (
            <option key={id} value={id}>
              {texto}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-planes__campo">
        <span>Desde</span>
        <input type="date" name="desde" defaultValue={consulta.periodo === "personalizado" ? consulta.desdeDia : ""} />
      </label>
      <label className="admin-planes__campo">
        <span>Hasta</span>
        <input type="date" name="hasta" defaultValue={consulta.periodo === "personalizado" ? consulta.hastaDia : ""} />
      </label>
      <label className="admin-planes__campo">
        <span>Estado de campaña</span>
        <select name="estado" defaultValue={consulta.estado}>
          {ESTADOS.map(([id, texto]) => (
            <option key={id} value={id}>
              {texto}
            </option>
          ))}
        </select>
      </label>
      <button className="admin-dash__actualizar" type="submit">
        Actualizar
      </button>
      <p className="admin-planes__contexto">
        Las suscripciones activas son las de ahora. El período filtra altas, envíos y campañas. Un día en cero es un día
        sin filas nuevas, no un historial reconstruido. Aceptado significa que el servicio push recibió el aviso.
      </p>
    </form>
  );
}

export function AvisoNotificaciones(resultado) {
  if (!resultado || resultado.estado === "listo") return null;
  if (resultado.estado === "denegado") return "No tenés permiso para ver las notificaciones.";
  return resultado.error || "No pudimos leer las notificaciones. No se muestran cifras parciales.";
}

function Cifra({ etiqueta, valor, detalle, icono: Icono }) {
  return (
    <article className="admin-dash__tarjeta">
      <h2>
        {Icono ? <Icono aria-hidden="true" size={18} /> : null} {etiqueta}
      </h2>
      <p className="admin-dash__valor">{valor}</p>
      {detalle ? <p className="admin-dash__detalle">{detalle}</p> : null}
    </article>
  );
}

function textoTasa(resumen) {
  const cerrados = resumen.aceptados_periodo + resumen.errores_periodo + resumen.expirados_periodo + resumen.omitidos_periodo;
  if (cerrados === 0) return "Sin envíos cerrados en el período";
  const tasa = resumen.errores_periodo / cerrados;
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(tasa * 100)} % de los envíos cerrados del período`;
}

function GraficoActividad({ serie }) {
  const maximo = Math.max(1, ...serie.map((punto) => Math.max(punto.suscripciones, punto.envios)));
  const paso = Math.max(8, Math.min(28, Math.floor(640 / serie.length)));
  const ancho = paso * serie.length;
  const alto = 160;
  return (
    <figure className="admin-dash__grafico">
      <figcaption>
        Altas de suscripciones y envíos por día, en hora de Argentina. La segunda barra cuenta todos los envíos de
        ese día; el detalle indica cuántos aceptó el servicio.
      </figcaption>
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label="Actividad diaria de notificaciones">
        {serie.map((punto, indice) => {
          const x = indice * paso;
          const barra = Math.max(1, paso * 0.28);
          const altas = (punto.suscripciones / maximo) * (alto - 24);
          const envios = (punto.envios / maximo) * (alto - 24);
          return (
            <g key={punto.dia}>
              <rect
                x={x + 2}
                y={alto - 20 - altas}
                width={barra}
                height={Math.max(punto.suscripciones ? 2 : 0, altas)}
                className="admin-dash__barra admin-dash__barra--usuarios"
              >
                <title>{`${textoDia(punto.dia)}: ${textoEntero(punto.suscripciones)} altas`}</title>
              </rect>
              <rect
                x={x + 2 + barra + 1}
                y={alto - 20 - envios}
                width={barra}
                height={Math.max(punto.envios ? 2 : 0, envios)}
                className="admin-dash__barra admin-dash__barra--registros"
              >
                <title>{`${textoDia(punto.dia)}: ${textoEntero(punto.envios)} envíos, ${textoEntero(punto.aceptados)} aceptados`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function ResumenNotificaciones({ resumen, lista, enlace, anterior, siguiente }) {
  const vacio = resumen.suscripciones === 0 && resumen.envios === 0;
  return (
    <>
      {vacio ? (
        <p className="admin-dash__aclaracion">Todavía no hay suscripciones ni envíos registrados.</p>
      ) : null}
      <div className="admin-dash__grilla">
        <Cifra etiqueta="Suscripciones" valor={textoEntero(resumen.suscripciones)} detalle="Cada una es un dispositivo" icono={Smartphone} />
        <Cifra etiqueta="Activas" valor={textoEntero(resumen.activas)} detalle={`${textoEntero(resumen.inactivas)} inactivas`} icono={Bell} />
        <Cifra
          etiqueta="Usuarios con aviso activo"
          valor={textoEntero(resumen.usuarios_activos)}
          detalle={`${textoEntero(resumen.dispositivos_sin_cuenta)} dispositivos activos sin cuenta`}
          icono={Users}
        />
        <Cifra
          etiqueta="Envíos del período"
          valor={textoEntero(resumen.envios_periodo)}
          detalle={`${textoEntero(resumen.aceptados_periodo)} aceptados por el servicio. En total hay ${textoEntero(resumen.envios)}.`}
          icono={Send}
        />
        <Cifra
          etiqueta="Fallos del período"
          valor={textoEntero(resumen.errores_periodo)}
          detalle={textoTasa(resumen)}
        />
        <Cifra
          etiqueta="Suscripciones invalidadas"
          valor={textoEntero(resumen.invalidadas)}
          detalle={`${textoEntero(resumen.expirados)} envíos marcados como suscripción vencida. Última actividad: ${resumen.ultima_actividad ? textoInstante(resumen.ultima_actividad) : "sin envíos"}.`}
        />
      </div>
      <GraficoActividad serie={resumen.serie} />
      <p className="admin-dash__aclaracion">
        Altas del período: {textoEntero(resumen.altas_periodo)}. Envíos de prueba: {textoEntero(resumen.envios_prueba)}.
        Envíos de campaña: {textoEntero(resumen.envios_campana)}. Pendientes o en curso: {textoEntero(resumen.pendientes)}.
        No hay registro de avisos abiertos o leídos.
      </p>
      <h2>Plataformas</h2>
      <table className="admin-planes__tabla">
        <thead>
          <tr>
            <th>Plataforma</th>
            <th>Suscripciones</th>
            <th>Activas</th>
          </tr>
        </thead>
        <tbody>
          {resumen.por_plataforma.map((fila) => (
            <tr key={fila.plataforma}>
              <td>{PLATAFORMAS[fila.plataforma]}</td>
              <td>{textoEntero(fila.suscripciones)}</td>
              <td>{textoEntero(fila.activas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Errores</h2>
      <table className="admin-planes__tabla">
        <thead>
          <tr>
            <th>Clase</th>
            <th>Envíos</th>
          </tr>
        </thead>
        <tbody>
          {resumen.por_error.map((fila) => (
            <tr key={fila.categoria}>
              <td>{FALLOS[fila.categoria]}</td>
              <td>{textoEntero(fila.envios)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Motivos de baja</h2>
      <table className="admin-planes__tabla">
        <thead>
          <tr>
            <th>Motivo</th>
            <th>Suscripciones inactivas</th>
          </tr>
        </thead>
        <tbody>
          {resumen.por_baja.map((fila) => (
            <tr key={fila.motivo}>
              <td>{MOTIVOS[fila.motivo]}</td>
              <td>{textoEntero(fila.suscripciones)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Campañas</h2>
      {lista.total === 0 ? (
        <p className="admin-dash__aclaracion">No hay campañas en este período y estado.</p>
      ) : (
        <table className="admin-planes__tabla">
          <thead>
            <tr>
              <th>Campaña</th>
              <th>Estado</th>
              <th>Programada</th>
              <th>Dispositivos</th>
              <th>Aceptados</th>
              <th>Errores</th>
            </tr>
          </thead>
          <tbody>
            {lista.filas.map((fila) => (
              <tr key={fila.id}>
                <td>
                  <a href={enlace(fila.id)}>{fila.titulo}</a>
                  <p className="admin-dash__detalle">{fila.clave}</p>
                </td>
                <td>{etiquetaEstadoCampana(fila.estado)}</td>
                <td>{textoInstante(fila.programada_para)}</td>
                <td>{textoEntero(fila.dispositivos)}</td>
                <td>{textoEntero(fila.aceptados)}</td>
                <td>{textoEntero(fila.errores)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="admin-dash__aclaracion">
        {lista.total === 0
          ? "Sin páginas."
          : `Mostrando ${textoEntero(lista.offset + 1)}–${textoEntero(lista.offset + lista.filas.length)} de ${textoEntero(lista.total)}.`}
      </p>
      <p>
        {anterior ? <a href={anterior}>Anterior</a> : null} {siguiente ? <a href={siguiente}>Siguiente</a> : null}
      </p>
      <p className="admin-dash__aclaracion">
        Crear, programar, cancelar o enviar una campaña desde este panel no está habilitado.
      </p>
    </>
  );
}

export function FichaCampana({ campana }) {
  const procesados = campana.envios - campana.pendientes;
  return (
    <article className="admin-dash__tarjeta">
      <h2>{campana.titulo}</h2>
      <p className="admin-dash__detalle">{campana.clave}</p>
      <dl>
        <dt>Estado</dt>
        <dd>{etiquetaEstadoCampana(campana.estado)}</dd>
        <dt>Habilitada</dt>
        <dd>{campana.habilitada ? "Sí" : "No"}</dd>
        <dt>Creada</dt>
        <dd>{textoInstante(campana.creada_en)}</dd>
        <dt>Programada</dt>
        <dd>{textoInstante(campana.programada_para)}</dd>
        <dt>Iniciada</dt>
        <dd>{campana.iniciada_en ? textoInstante(campana.iniciada_en) : "Sin inicio"}</dd>
        <dt>Finalizada</dt>
        <dd>{campana.finalizada_en ? textoInstante(campana.finalizada_en) : "Sin cierre"}</dd>
        <dt>Dispositivos con envío</dt>
        <dd>{textoEntero(campana.dispositivos)}</dd>
        <dt>Envíos procesados</dt>
        <dd>{textoEntero(procesados)}</dd>
        <dt>Aceptados por el servicio</dt>
        <dd>{textoEntero(campana.aceptados)}</dd>
        <dt>Errores</dt>
        <dd>{textoEntero(campana.errores)}</dd>
        <dt>Suscripciones vencidas</dt>
        <dd>{textoEntero(campana.expirados)}</dd>
        <dt>Omitidos</dt>
        <dd>{textoEntero(campana.omitidos)}</dd>
        <dt>Pendientes</dt>
        <dd>{textoEntero(campana.pendientes)}</dd>
      </dl>
      <p className="admin-dash__aclaracion">
        Aceptado no significa mostrado ni leído. Esta ficha no incluye el texto del aviso ni su destino.
      </p>
    </article>
  );
}

const ESTADOS_EJECUCION = {
  ok: "Terminó",
  error: "Error",
  omitido: "Omitido",
};

const MOTIVOS_EJECUCION = {
  configuracion: "Faltaba la configuración de envío",
  excepcion: "El proceso falló",
  migracion: "Falta aplicar la migración",
};

export function RecordatoriosCalendario({ resultado }) {
  return (
    <article className="admin-dash__tarjeta">
      <h2 id="recordatorios-calendario">Recordatorios del calendario</h2>
      {resultado?.estado === "listo" ? (
        <DetalleRecordatorios recordatorios={resultado.recordatorios} />
      ) : (
        <p className="admin-dash__aviso admin-dash__aviso--bloque" role="alert">
          {resultado?.estado === "denegado"
            ? "No tenés permiso para ver los recordatorios."
            : resultado?.error || "No pudimos leer los recordatorios. No se muestran cifras parciales."}
        </p>
      )}
    </article>
  );
}

function DetalleRecordatorios({ recordatorios }) {
  const ultima = recordatorios.ultima;
  const proxima = recordatorios.proxima;
  return (
    <>
      <p className="admin-dash__aclaracion">
        El cron declarado es <code>{recordatorios.cronDeclarado}</code> en {recordatorios.zonaCron}. Este panel no
        consulta a Vercel. Aceptado significa que el proveedor recibió el envío, no que el teléfono lo haya mostrado.
      </p>
      {recordatorios.hayEjecucion ? (
        <dl>
          <dt>Última ejecución</dt>
          <dd>{textoInstante(ultima.iniciada_en)}</dd>
          <dt>Estado</dt>
          <dd>{ESTADOS_EJECUCION[ultima.estado] || "Estado desconocido"}</dd>
          <dt>Detalle</dt>
          <dd>{ultima.motivo ? MOTIVOS_EJECUCION[ultima.motivo] || "Sin detalle" : "Sin incidencia"}</dd>
          <dt>Tareas examinadas</dt>
          <dd>{textoEntero(ultima.examinadas)}</dd>
          <dt>Tareas elegibles</dt>
          <dd>{textoEntero(ultima.elegibles)}</dd>
          <dt>Recordatorios procesados</dt>
          <dd>{textoEntero(ultima.procesadas)}</dd>
          <dt>Envíos aceptados por el proveedor</dt>
          <dd>{textoEntero(ultima.aceptadas)}</dd>
          <dt>Errores</dt>
          <dd>{textoEntero(ultima.errores)}</dd>
          <dt>Sin dispositivo</dt>
          <dd>{textoEntero(ultima.sin_dispositivo)}</dd>
          <dt>Suscripciones vencidas</dt>
          <dd>{textoEntero(ultima.expiradas)}</dd>
          <dt>Omitidos</dt>
          <dd>{textoEntero(ultima.omitidas)}</dd>
          <dt>Próxima ejecución estimada</dt>
          <dd>
            {proxima.fiable && proxima.estimada
              ? textoInstante(proxima.estimada)
              : "No se puede estimar: no hay una ejecución reciente que confirme que el cron sigue activo."}
          </dd>
        </dl>
      ) : (
        <p className="admin-dash__aclaracion">
          No hay ejecuciones registradas. No se puede saber si Vercel está llamando al proceso, si el secreto no
          coincide o si la migración todavía no está aplicada. La próxima ejecución no se estima sin una corrida
          reciente.
        </p>
      )}
    </>
  );
}
