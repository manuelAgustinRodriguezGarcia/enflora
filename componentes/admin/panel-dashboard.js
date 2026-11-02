"use client";

import { useState } from "react";
import { Camera, ClipboardList, Layers, Leaf, RefreshCw, Sprout, Users } from "lucide-react";
import { actualizarDashboard } from "@/app/admin/dashboard-acciones";
import { textoBytes, textoDia, textoEntero, textoInstante } from "@/componentes/admin/formato-dashboard";

function Cifra({ etiqueta, valor, detalle, Icono }) {
  return (
    <article className="admin-dash__tarjeta">
      <div className="admin-dash__tarjeta-cabecera">
        <Icono size={18} strokeWidth={2.2} aria-hidden="true" />
        <h2>{etiqueta}</h2>
      </div>
      <p className="admin-dash__valor">{textoEntero(valor)}</p>
      {detalle ? <p className="admin-dash__detalle">{detalle}</p> : null}
    </article>
  );
}

function GraficoSerie({ serie }) {
  const maximo = Math.max(1, ...serie.map((punto) => Math.max(punto.usuariosNuevos, punto.registros)));
  const ancho = 720;
  const alto = 168;
  const paso = ancho / serie.length;
  const barra = Math.max(2, paso * 0.32);

  return (
    <figure className="admin-dash__grafico">
      <figcaption>
        <span className="admin-dash__leyenda admin-dash__leyenda--usuarios">Usuarios nuevos</span>
        <span className="admin-dash__leyenda admin-dash__leyenda--registros">Registros creados</span>
      </figcaption>
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label="Usuarios nuevos y registros creados por día, últimos 30 días">
        {serie.map((punto, indice) => {
          const x = indice * paso;
          const alturaUsuarios = (punto.usuariosNuevos / maximo) * (alto - 8);
          const alturaRegistros = (punto.registros / maximo) * (alto - 8);
          return (
            <g key={punto.dia}>
              <rect
                x={x + paso * 0.12}
                y={alto - alturaUsuarios}
                width={barra}
                height={alturaUsuarios}
                className="admin-dash__barra admin-dash__barra--usuarios"
              >
                <title>{`${textoDia(punto.dia)}: ${textoEntero(punto.usuariosNuevos)} usuarios nuevos`}</title>
              </rect>
              <rect
                x={x + paso * 0.12 + barra + 1}
                y={alto - alturaRegistros}
                width={barra}
                height={alturaRegistros}
                className="admin-dash__barra admin-dash__barra--registros"
              >
                <title>{`${textoDia(punto.dia)}: ${textoEntero(punto.registros)} registros`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function CuerpoListo({ resumen }) {
  const sinActividad = resumen.usuariosTotal === 0 && resumen.registrosTotal === 0;
  const sinRegistrosEnPeriodo = resumen.registros30 === 0;
  const crecimiento = `Últimos ${resumen.periodoCorto} días: ${textoEntero(resumen.usuariosNuevos7)}. Últimos ${resumen.periodoLargo} días: ${textoEntero(resumen.usuariosNuevos30)}.`;
  const registrosPeriodo = `Últimos ${resumen.periodoCorto} días: ${textoEntero(resumen.registros7)}. Últimos ${resumen.periodoLargo} días: ${textoEntero(resumen.registros30)}.`;
  const actividad = `Cuentas distintas que crearon un registro. No mide sesiones. ${resumen.periodoCorto} días: ${textoEntero(resumen.usuariosConRegistros7)}. ${resumen.periodoLargo} días: ${textoEntero(resumen.usuariosConRegistros30)}.`;

  return (
    <>
      {sinActividad ? (
        <p className="admin-dash__vacio">Todavía no hay cuentas ni registros en este resumen. Las cifras en cero son el conteo real.</p>
      ) : null}
      <div className="admin-dash__grilla">
        <Cifra etiqueta="Usuarios registrados" valor={resumen.usuariosTotal} detalle={crecimiento} Icono={Users} />
        <Cifra etiqueta="Espacios" valor={resumen.espacios} Icono={Sprout} />
        <Cifra etiqueta="Unidades" valor={resumen.unidades} Icono={Layers} />
        <Cifra etiqueta="Plantas" valor={resumen.plantas} Icono={Leaf} />
        <Cifra etiqueta="Registros" valor={resumen.registrosTotal} detalle={registrosPeriodo} Icono={ClipboardList} />
        <Cifra etiqueta="Con registros en 30 días" valor={resumen.usuariosConRegistros30} detalle={actividad} Icono={Users} />
        <Cifra
          etiqueta="Fotos de registros"
          valor={resumen.fotosRegistros}
          detalle={`Tamaño declarado de los archivos originales: ${textoBytes(resumen.bytesFotosOriginales)}. No incluye miniaturas ni portadas, y no es el almacenamiento total.`}
          Icono={Camera}
        />
      </div>

      <section className="admin-dash__serie" aria-labelledby="admin-dash-serie">
        <h2 id="admin-dash-serie">Últimos {resumen.periodoLargo} días</h2>
        <p className="admin-dash__aclaracion">
          Cada barra es un día calendario en hora de Argentina, hoy incluido. Los totales de 7 y 30 días de arriba son ventanas corridas de 24 horas y pueden no coincidir con la suma del gráfico.
        </p>
        {sinRegistrosEnPeriodo && resumen.usuariosNuevos30 === 0 ? (
          <p className="admin-dash__vacio">Sin altas ni registros en estos {resumen.periodoLargo} días.</p>
        ) : null}
        <GraficoSerie serie={resumen.serie} />
        <details className="admin-dash__detalles">
          <summary>Ver cifras por día</summary>
          <div className="admin-dash__tabla-contenedor">
            <table className="admin-dash__tabla">
              <thead>
                <tr>
                  <th scope="col">Día</th>
                  <th scope="col">Usuarios nuevos</th>
                  <th scope="col">Registros creados</th>
                </tr>
              </thead>
              <tbody>
                {resumen.serie.map((punto) => (
                  <tr key={punto.dia}>
                    <th scope="row">{textoDia(punto.dia)}</th>
                    <td>{textoEntero(punto.usuariosNuevos)}</td>
                    <td>{textoEntero(punto.registros)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </>
  );
}

export function PanelDashboard({ inicial }) {
  const [estado, setEstado] = useState(inicial);
  const [pendiente, setPendiente] = useState(false);
  const [aviso, setAviso] = useState("");

  async function actualizar() {
    setPendiente(true);
    setAviso("");
    try {
      const resultado = await actualizarDashboard();
      if (resultado.estado === "denegado") {
        setAviso("No tenés permiso para ver el dashboard.");
        return;
      }
      if (resultado.estado === "error" && estado.estado === "listo") {
        setAviso(resultado.error);
        return;
      }
      setEstado(resultado);
    } catch {
      setAviso("No pudimos actualizar las cifras.");
    } finally {
      setPendiente(false);
    }
  }

  const listo = estado.estado === "listo" ? estado.resumen : null;
  const mensaje = estado.estado === "listo" ? aviso : estado.error || aviso;

  return (
    <section className="admin-dash" aria-busy={pendiente || undefined}>
      <header className="admin-dash__cabecera">
        <p className="admin-estado__etiqueta">Administración</p>
        <div className="admin-dash__titulo">
          <h1>Dashboard</h1>
          <button type="button" className="admin-dash__actualizar" onClick={actualizar} disabled={pendiente}>
            <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />
            <span>{pendiente ? "Actualizando…" : "Actualizar"}</span>
          </button>
        </div>
        <p className="admin-dash__aclaracion">
          Conteos de la aplicación. Esta pantalla no muestra nombres, observaciones, fotografías ni mensajes de Flora.
        </p>
        {listo ? <p className="admin-dash__actualizado">Actualizado {textoInstante(listo.generadoEn)}</p> : null}
      </header>

      {mensaje ? (
        <p className={estado.estado === "listo" ? "admin-dash__aviso" : "admin-dash__aviso admin-dash__aviso--bloque"} role="alert">
          {mensaje}
        </p>
      ) : null}

      {listo ? <CuerpoListo resumen={listo} /> : null}
    </section>
  );
}
