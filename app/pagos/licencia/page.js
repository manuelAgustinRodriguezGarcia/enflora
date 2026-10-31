import { Boton, EnlaceBoton } from "@/componentes/boton";
import { MarcaEnflora } from "@/componentes/marca-enflora";
import { finalizarCiclo, iniciarCompra } from "@/app/pagos/acciones";
import { formatearFechaCotizacion } from "@/lib/cotizacion";
import { leerAmbientePagos } from "@/lib/pagos/ambiente";
import { licenciaHabilita } from "@/lib/pagos/cobertura";
import {
  formatearCentavosArs,
  formatearCotizacion,
  importeLicenciaCentavos,
} from "@/lib/pagos/dinero";
import {
  DIAS_ALERTA_COTIZACION,
  DIAS_VIGENCIA_COTIZACION,
  URL_BNA,
  obtenerCotizacionBilleteVendedor,
} from "@/lib/pagos/cotizacion-bna";
import { crearClienteServidor, obtenerUsuario } from "@/lib/supabase/servidor";
import { etiquetaTipoUnidad } from "@/lib/unidades";

export const metadata = {
  title: "Licencia por cultivo",
  robots: { index: false, follow: false },
};

const MENSAJES = {
  cultivo_ajeno: "Ese ciclo no pertenece a tu cuenta.",
  licencia_activa: "Ese ciclo ya tiene una licencia activa.",
  nombre: "El ciclo necesita un nombre de hasta 80 caracteres y una unidad propia.",
  ciclo_finalizado: "Ese ciclo ya está finalizado. Para otro cultivo, empezá un ciclo nuevo.",
  pago_en_curso: "Ese ciclo ya tiene un pago abierto.",
  cotizacion_no_disponible: "No pudimos leer la cotización del Banco Nación. No se creó ninguna orden.",
  cotizacion_invalida: "La cotización publicada no es válida. No se creó ninguna orden.",
  cotizacion_antigua: "La última cotización del Banco Nación es demasiado antigua. No se creó ninguna orden.",
  ambiente_prueba_requerido: "En este entorno tenés que declarar MERCADOPAGO_ENV=prueba.",
  pruebas_no_confirmadas: "Confirmá en local que el token salió de la pestaña Pruebas.",
  cobros_reales_bloqueados: "Los cobros reales están bloqueados en desarrollo.",
  cobros_reales_desactivados: "Los cobros reales siguen desactivados.",
  ambiente_no_declarado: "Falta declarar MERCADOPAGO_ENV. No se crea ninguna orden.",
  ambiente_contradictorio: "El ambiente de prueba no puede convivir con cobros reales.",
  sin_servicio: "Falta la clave de servicio de Supabase o la migración de pagos.",
  checkout_ausente: "Mercado Pago no devolvió la URL de checkout.",
  comprador_prueba_invalido: "MERCADOPAGO_TEST_BUYER_EMAIL no es un correo válido. No se creó la orden.",
  orden: "No se pudo preparar el pago. No se activó ninguna licencia.",
};

function etiquetaAncla(unidad, espacios) {
  if (!unidad) return "Unidad de ancla";
  return `${espacios.get(unidad.espacio_id) || "Espacio"} · ${etiquetaTipoUnidad(unidad.tipo, unidad.tipo_personalizado)} · ${unidad.nombre}`;
}

export default async function PaginaLicencia({ searchParams }) {
  const parametros = await searchParams;
  const codigo = MENSAJES[parametros.error] ? parametros.error : "";
  const supabase = await crearClienteServidor();
  const usuario = await obtenerUsuario();
  const usuarioId = usuario?.id || "";
  const [unidadesRespuesta, espaciosRespuesta, ciclosRespuesta, licenciasRespuesta, pagosRespuesta, cotizacion] = await Promise.all([
    supabase
      .from("unidades_cultivo")
      .select("id, nombre, tipo, tipo_personalizado, espacio_id")
      .order("fecha_creacion", { ascending: true }),
    supabase.from("espacios").select("id, nombre"),
    supabase
      .from("ciclos_cultivo")
      .select("id, nombre, estado, unidad_ancla_id, iniciado_en")
      .order("iniciado_en", { ascending: false }),
    supabase.from("licencias_cultivo").select("ciclo_cultivo_id, pago_id, estado, usuario_id").eq("estado", "activa"),
    supabase.from("pagos").select("id, ciclo_cultivo_id, ambiente, estado, usuario_id"),
    obtenerCotizacionBilleteVendedor(),
  ]);

  if (
    unidadesRespuesta.error ||
    espaciosRespuesta.error ||
    ciclosRespuesta.error ||
    licenciasRespuesta.error ||
    pagosRespuesta.error
  ) {
    return (
      <section className="pago">
        <h1>Licencia por cultivo</h1>
        <p role="alert">No se pudieron cargar tus ciclos. Ejecutá la migración de pagos en Supabase y volvé a intentar.</p>
      </section>
    );
  }

  const espacios = new Map((espaciosRespuesta.data || []).map((espacio) => [espacio.id, espacio.nombre]));
  const unidades = unidadesRespuesta.data || [];
  const unidadesPorId = new Map(unidades.map((unidad) => [unidad.id, unidad]));
  const pagosPorId = new Map((pagosRespuesta.data || []).map((pago) => [pago.id, pago]));
  const cobertura = new Map();
  for (const licencia of licenciasRespuesta.data || []) {
    const pago = pagosPorId.get(licencia.pago_id);
    if (licenciaHabilita({ licencia, pago, ambiente: "produccion", usuarioId }))
      cobertura.set(licencia.ciclo_cultivo_id, "produccion");
    else if (licenciaHabilita({ licencia, pago, ambiente: "prueba", usuarioId }))
      cobertura.set(licencia.ciclo_cultivo_id, "prueba");
  }
  const activas = new Set(cobertura.keys());
  const ciclos = ciclosRespuesta.data || [];
  const elegibles = ciclos.filter((ciclo) => ciclo.estado === "activo" && !activas.has(ciclo.id));
  const centavos = cotizacion.ok ? importeLicenciaCentavos(cotizacion.cotizacion.venta) : null;
  const prueba = leerAmbientePagos().ambiente === "prueba";
  const puedeNuevo = unidades.length > 0;

  return (
    <section className="pago">
      <header className="pago__encabezado">
        <h1>Licencia por cultivo</h1>
        <p>
          Un pago único de USD 30 para un ciclo. La carpa o la sala se pueden volver a usar: el ciclo siguiente se contrata aparte. Finalizar un ciclo no libera la licencia.
        </p>
        {prueba ? (
          <p className="pago__nota">
            Esta compra es de prueba. En el checkout tenés que iniciar sesión con el usuario comprador de la aplicación de Mercado Pago. Una cuenta real o una ventana sin sesión deja el botón Pagar deshabilitado. El titular de la tarjeta de prueba es APRO. Si definís MERCADOPAGO_TEST_BUYER_EMAIL con el correo de esa cuenta, las órdenes nuevas lo usan y no el correo de tu usuario de <MarcaEnflora />.
          </p>
        ) : null}
      </header>

      {codigo ? <p className="pago__alerta" role="alert">{MENSAJES[codigo]}</p> : null}

      {ciclos.length > 0 ? (
        <ul className="pago__historial">
          {ciclos.map((ciclo) => {
            const coberturaCiclo = cobertura.get(ciclo.id);
            return (
              <li key={ciclo.id}>
                <strong>{ciclo.nombre}</strong>
                <span>{etiquetaAncla(unidadesPorId.get(ciclo.unidad_ancla_id), espacios)}</span>
                <span>
                  {ciclo.estado === "finalizado" ? "Finalizado" : "Activo"}
                  {coberturaCiclo === "produccion" ? " · Licencia activa" : ""}
                  {coberturaCiclo === "prueba" ? " · Licencia de prueba" : ""}
                  {ciclo.iniciado_en ? ` · ${formatearFechaCotizacion(ciclo.iniciado_en)}` : ""}
                </span>
                {coberturaCiclo === "prueba" ? (
                  <span>Esta licencia no habilita el producto en producción y no pasa a un ciclo nuevo.</span>
                ) : null}
                {ciclo.estado === "activo" ? (
                  <form action={finalizarCiclo}>
                    <input type="hidden" name="cicloId" value={ciclo.id} />
                    <Boton type="submit" variante="secundario">Finalizar ciclo</Boton>
                  </form>
                ) : (
                  <span>El historial y la licencia, si la hubo, siguen en este ciclo.</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {!puedeNuevo && elegibles.length === 0 ? (
        <div className="vacio">
          <p>Todavía no tenés una unidad para anclar un ciclo.</p>
          <EnlaceBoton href="/espacios/nuevo">Crear espacio</EnlaceBoton>
        </div>
      ) : (
        <form className="formulario pago__formulario" action={iniciarCompra}>
          <fieldset className="pago__cultivos">
            <legend>Elegí el ciclo</legend>
            {elegibles.map((ciclo) => {
              const id = `ciclo-${ciclo.id}`;
              return (
                <label className="pago__opcion" key={ciclo.id} htmlFor={id}>
                  <input id={id} type="radio" name="destino" value={ciclo.id} required={!puedeNuevo || elegibles.length > 0} />
                  <span>
                    <strong>{ciclo.nombre}</strong>
                    <span>{etiquetaAncla(unidadesPorId.get(ciclo.unidad_ancla_id), espacios)}</span>
                  </span>
                </label>
              );
            })}
            {puedeNuevo ? (
              <label className="pago__opcion" htmlFor="ciclo-nuevo">
                <input
                  id="ciclo-nuevo"
                  type="radio"
                  name="destino"
                  value="nuevo"
                  required={elegibles.length > 0}
                  defaultChecked={elegibles.length === 0}
                />
                <span>
                  <strong>Nuevo ciclo</strong>
                  <span>Queda un ciclo distinto aunque uses la misma unidad.</span>
                </span>
              </label>
            ) : null}
          </fieldset>

          {puedeNuevo ? (
            <div className="pago__nuevo">
              <label className="pago__campo" htmlFor="nombreCiclo">
                Nombre del ciclo
                <input id="nombreCiclo" name="nombreCiclo" maxLength={80} autoComplete="off" />
              </label>
              <label className="pago__campo" htmlFor="unidadId">
                Unidad donde empieza
                <select id="unidadId" name="unidadId" defaultValue={unidades[0]?.id || ""}>
                  {unidades.map((unidad) => (
                    <option key={unidad.id} value={unidad.id}>
                      {etiquetaAncla(unidad, espacios)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="pago__nota">
                El nombre y la unidad se usan solo si elegís Nuevo ciclo. La unidad registra dónde empieza. No es la licencia. Un cultivo que use varias unidades no entra en este pago: esa relación todavía no está definida.
              </p>
            </div>
          ) : null}

          <dl className="pago__resumen">
            <div>
              <dt>Precio original</dt>
              <dd>USD 30</dd>
            </div>
            <div>
              <dt>Dólar billete vendedor</dt>
              <dd>{cotizacion.ok ? formatearCotizacion(cotizacion.cotizacion.venta) : "No disponible"}</dd>
            </div>
            <div>
              <dt>Fuente</dt>
              <dd>
                <a href={URL_BNA}>Banco Nación</a>
                {cotizacion.ok ? ` · ${formatearFechaCotizacion(cotizacion.cotizacion.publicadaEn)}` : ""}
              </dd>
            </div>
            <div>
              <dt>Total en pesos</dt>
              <dd>{centavos === null ? "—" : formatearCentavosArs(centavos)}</dd>
            </div>
            <div>
              <dt>Vigencia</dt>
              <dd>
                {cotizacion.ok
                  ? `Última publicación del Banco Nación (también en días no hábiles). Máximo ${DIAS_VIGENCIA_COTIZACION} días de antigüedad; vence el ${formatearFechaCotizacion(cotizacion.vigenteHasta)}.${
                      cotizacion.advertenciaAntigua
                        ? ` Publicada hace más de ${DIAS_ALERTA_COTIZACION} días: confirmá el total antes de pagar.`
                        : ""
                    }`
                  : "Sin una cotización vigente no se puede pagar."}
              </dd>
            </div>
          </dl>

          <Boton type="submit" disabled={!cotizacion.ok}>
            Confirmar compra
          </Boton>
        </form>
      )}
    </section>
  );
}
