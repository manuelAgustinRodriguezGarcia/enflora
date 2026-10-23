"use client";

import { useState } from "react";
import { Aparecer } from "@/componentes/aparecer";
import { Boton } from "@/componentes/boton";
import { ContadorCantidad } from "@/componentes/contador-cantidad";
import { IconoCaja } from "@/componentes/iconos-ui";
import { Selector } from "@/componentes/selector";
import { TransicionVista } from "@/componentes/transicion-vista";
import { AccionesDemo } from "@/componentes/demo/acciones-demo";
import { useDemo } from "@/componentes/demo/proveedor-demo";
import {
  LIMITES_DEMO,
  generarCultivo,
  limpiarNombreEspacio,
  textoUnidadesDemo,
  tipoUnidadDemo,
} from "@/lib/demo/generar-cultivo";
import { siguienteSecuencia } from "@/lib/demo/estado-demo";
import { fechaHoy } from "@/lib/etapas";
import { admiteVarias, etiquetaTipoEspacio, textoCantidad, tiposDeUnidad } from "@/lib/unidades";

const TIPOS_ESPACIO = [
  { valor: "interior", etiqueta: "Interior" },
  { valor: "exterior", etiqueta: "Exterior" },
];

const CONFIGURACION_INICIAL = {
  nombre: "",
  tipo: "",
  tipoUnidad: "",
  tipoPersonalizado: "",
  cantidadUnidades: 1,
  plantasPorUnidad: 2,
};

function etiquetaUnidades(tipoUnidad) {
  if (tipoUnidad === "carpa") return "Cantidad de carpas";
  if (tipoUnidad === "invernadero") return "Cantidad de invernaderos";
  return "Cantidad de unidades";
}

function etiquetaPlantas(tipoUnidad) {
  if (tipoUnidad === "carpa") return "Plantas por carpa";
  if (tipoUnidad === "invernadero") return "Plantas por invernadero";
  if (tipoUnidad === "sala") return "Plantas en la sala";
  if (tipoUnidad === "aire_libre") return "Plantas al aire libre";
  return "Plantas por unidad";
}

function textoUnidades(configuracion) {
  return textoUnidadesDemo(
    configuracion.tipo,
    configuracion.cantidadUnidades,
    configuracion.tipoUnidad,
    configuracion.tipoPersonalizado,
  );
}

function textoTotal(configuracion) {
  const total = configuracion.cantidadUnidades * configuracion.plantasPorUnidad;
  if (configuracion.tipoUnidad === "aire_libre") return `Vas a crear ${textoCantidad(total)} al aire libre.`;
  const destino = textoUnidades(configuracion);
  if (configuracion.cantidadUnidades === 1) return `Vas a crear ${textoCantidad(total)} en ${destino}.`;
  return `Vas a crear ${textoCantidad(total)} distribuidas en ${destino}.`;
}

export function CrearEspacio() {
  const { estado, agregarCultivo, irACultivos, volverBienvenida } = useDemo();
  const [configuracion, setConfiguracion] = useState(CONFIGURACION_INICIAL);
  const [errores, setErrores] = useState({});
  const tieneEspacios = estado.espacios.length > 0;
  const nombreLimpio = limpiarNombreEspacio(configuracion.nombre);
  const personalizadoLimpio = limpiarNombreEspacio(configuracion.tipoPersonalizado);
  const total = configuracion.cantidadUnidades * configuracion.plantasPorUnidad;
  const opcionesUnidad = tiposDeUnidad(configuracion.tipo);
  const esOtro = configuracion.tipoUnidad === "otro";
  const unidadElegida = Boolean(configuracion.tipoUnidad);
  const variasUnidades = unidadElegida && admiteVarias(configuracion.tipoUnidad);

  function limpiarErrores(campos) {
    setErrores((actual) => {
      if (!campos.some((campo) => actual[campo]) && !actual.general) return actual;
      const resto = { ...actual };
      for (const campo of campos) delete resto[campo];
      delete resto.general;
      return resto;
    });
  }

  function cambiar(campo, valor) {
    setConfiguracion((actual) => ({ ...actual, [campo]: valor }));
    limpiarErrores([campo]);
  }

  function cambiarTipo(tipo) {
    setConfiguracion((actual) => ({
      ...actual,
      tipo,
      tipoUnidad: tipoUnidadDemo(tipo),
      tipoPersonalizado: "",
    }));
    limpiarErrores(["tipo", "tipoUnidad", "cantidadUnidades"]);
  }

  function cambiarTipoUnidad(tipoUnidad) {
    setConfiguracion((actual) => ({
      ...actual,
      tipoUnidad,
      tipoPersonalizado: tipoUnidad === "otro" ? actual.tipoPersonalizado : "",
      cantidadUnidades: admiteVarias(tipoUnidad) ? actual.cantidadUnidades : 1,
    }));
    limpiarErrores(["tipoUnidad", "cantidadUnidades"]);
  }

  function crear(evento) {
    evento.preventDefault();
    const resultado = generarCultivo(configuracion, {
      secuencia: siguienteSecuencia(estado),
      fecha: fechaHoy(),
    });
    if (resultado.errores) {
      setErrores(resultado.errores);
      return;
    }
    agregarCultivo(resultado.cultivo);
  }

  return (
    <TransicionVista>
      <section className="demo">
        <div className="demo__intro">
          <h1>{tieneEspacios ? "Creá otro espacio" : "Creá tu espacio"}</h1>
          <p className="demo__bajada">
            Configurá un espacio de cultivo simulado. Vamos a preparar sus unidades y plantas.
          </p>
        </div>
        <form className="formulario demo-crear" onSubmit={crear} noValidate>
          <label
            className={errores.nombre ? "formulario__campo formulario__campo--falta" : "formulario__campo"}
            htmlFor="demo-nombre-espacio"
          >
            ¿Cómo se llama tu espacio?
            <input
              id="demo-nombre-espacio"
              type="text"
              autoComplete="off"
              placeholder="Cuartito del fondo"
              value={configuracion.nombre}
              aria-invalid={errores.nombre ? "true" : undefined}
              aria-describedby="demo-nombre-ayuda"
              onChange={(evento) => cambiar("nombre", evento.target.value)}
            />
            <span id="demo-nombre-ayuda" className="demo-crear__ayuda">
              {errores.nombre ? (
                <span className="formulario__error">{errores.nombre}</span>
              ) : (
                <span>
                  {nombreLimpio.length}/{LIMITES_DEMO.nombre}
                </span>
              )}
            </span>
          </label>

          <div className="demo-crear__campo">
            <Selector
              etiqueta="Tipo"
              id="demo-tipo-espacio"
              valor={configuracion.tipo || null}
              onChange={cambiarTipo}
              opciones={TIPOS_ESPACIO}
              placeholder="Interior o exterior"
              error={Boolean(errores.tipo)}
            />
            {errores.tipo ? <span className="formulario__error">{errores.tipo}</span> : null}
          </div>

          <div className="demo-crear__campo">
            <Selector
              etiqueta="Tipo de unidad"
              id="demo-tipo-unidad"
              valor={configuracion.tipoUnidad || null}
              onChange={cambiarTipoUnidad}
              opciones={opcionesUnidad}
              placeholder={configuracion.tipo ? "Carpa, sala, invernadero…" : "Primero elegí interior o exterior"}
              deshabilitado={!configuracion.tipo}
              error={Boolean(errores.tipoUnidad) && !esOtro}
            />
            {esOtro ? (
              <label
                className={
                  errores.tipoUnidad ? "formulario__campo formulario__campo--falta" : "formulario__campo"
                }
                htmlFor="demo-tipo-personalizado"
              >
                ¿Qué tipo de unidad es?
                <input
                  id="demo-tipo-personalizado"
                  type="text"
                  autoComplete="off"
                  placeholder="Armario, balcón, patio…"
                  value={configuracion.tipoPersonalizado}
                  aria-invalid={errores.tipoUnidad ? "true" : undefined}
                  aria-describedby="demo-tipo-personalizado-ayuda"
                  onChange={(evento) => cambiar("tipoPersonalizado", evento.target.value)}
                />
                <span id="demo-tipo-personalizado-ayuda" className="demo-crear__ayuda">
                  {errores.tipoUnidad ? (
                    <span className="formulario__error">{errores.tipoUnidad}</span>
                  ) : (
                    <span>
                      {personalizadoLimpio.length}/{LIMITES_DEMO.tipoPersonalizado}
                    </span>
                  )}
                </span>
              </label>
            ) : errores.tipoUnidad ? (
              <span className="formulario__error">{errores.tipoUnidad}</span>
            ) : null}
          </div>

          <Aparecer visible={unidadElegida && variasUnidades}>
            <div className="demo-crear__contador demo-crear__contador--unidades">
              <ContadorCantidad
                valor={configuracion.cantidadUnidades}
                minimo={LIMITES_DEMO.unidades.minimo}
                maximo={LIMITES_DEMO.unidades.maximo}
                contexto={etiquetaUnidades(configuracion.tipoUnidad)}
                ariaLabel={etiquetaUnidades(configuracion.tipoUnidad)}
                icono={IconoCaja}
                onChange={(cantidad) => cambiar("cantidadUnidades", cantidad)}
              />
              {errores.cantidadUnidades ? (
                <span className="formulario__error">{errores.cantidadUnidades}</span>
              ) : null}
            </div>
          </Aparecer>

          <Aparecer visible={unidadElegida}>
            <div className="demo-crear__contador demo-crear__contador--plantas">
              <ContadorCantidad
                valor={configuracion.plantasPorUnidad}
                minimo={LIMITES_DEMO.plantas.minimo}
                maximo={LIMITES_DEMO.plantas.maximo}
                contexto={etiquetaPlantas(configuracion.tipoUnidad)}
                ariaLabel={etiquetaPlantas(configuracion.tipoUnidad)}
                onChange={(cantidad) => cambiar("plantasPorUnidad", cantidad)}
              />
              {errores.plantasPorUnidad ? (
                <span className="formulario__error">{errores.plantasPorUnidad}</span>
              ) : (
                <span className="demo-crear__nota">
                  La demo limita hasta {LIMITES_DEMO.plantas.maximo} plantas de prueba.
                </span>
              )}
            </div>
          </Aparecer>

          <Aparecer visible={unidadElegida}>
            <p className="demo-crear__total" aria-live="polite">
              {textoTotal(configuracion)}
            </p>
          </Aparecer>

          <article className="tarjeta demo-resumen" aria-label="Resumen del espacio">
            <span className="demo-resumen__titulo">Resumen</span>
            <span className="tarjeta__nombre">{nombreLimpio || "Tu espacio"}</span>
            <div className="tarjeta__metricas">
              <span className="tarjeta__dato">
                <span className="tarjeta__etiqueta">Tipo</span>
                <span className="tarjeta__valor">
                  {configuracion.tipo ? etiquetaTipoEspacio(configuracion.tipo) : "—"}
                </span>
              </span>
              <span className="tarjeta__dato">
                <span className="tarjeta__etiqueta">Unidades</span>
                <span className="tarjeta__valor">{unidadElegida ? textoUnidades(configuracion) : "—"}</span>
              </span>
              <span className="tarjeta__dato">
                <span className="tarjeta__etiqueta">Por unidad</span>
                <span className="tarjeta__valor">
                  {unidadElegida ? textoCantidad(configuracion.plantasPorUnidad) : "—"}
                </span>
              </span>
              <span className="tarjeta__dato">
                <span className="tarjeta__etiqueta">Total</span>
                <span className="tarjeta__valor">{unidadElegida ? textoCantidad(total) : "—"}</span>
              </span>
            </div>
          </article>

          {errores.general ? <p className="formulario__error">{errores.general}</p> : null}

          <Boton type="submit" className="boton--ancho">
            Crear mi espacio
          </Boton>
          <Boton
            type="button"
            variante="secundario"
            className="boton--ancho"
            onClick={tieneEspacios ? irACultivos : volverBienvenida}
          >
            {tieneEspacios ? "Volver a mis espacios" : "Volver a guía"}
          </Boton>
        </form>
        <AccionesDemo />
      </section>
    </TransicionVista>
  );
}
