"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buscarLocalidadesClima, guardarLocalidadClima, guardarLocalidadUsuario } from "@/app/cultivos/[id]/clima/acciones";
import { consultaValida } from "@/lib/clima/validar";

export function BusquedaLocalidad({
  espacioId,
  tieneLocalidad = false,
  embebida = false,
  idCampo = "clima-localidad",
  etiqueta = "Ciudad del cultivo",
  destino = "espacio",
}) {
  const router = useRouter();
  const pedido = useRef(0);
  const [abierta, setAbierta] = useState(embebida || !tieneLocalidad);
  const [consulta, setConsulta] = useState("");
  const [lugares, setLugares] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const textoListo = consultaValida(consulta);
  const avisoLocal = consulta.trim() && !textoListo ? "Escribí al menos 2 letras de la ciudad." : "";
  const aviso = textoListo ? mensaje : avisoLocal;

  useEffect(() => {
    if (!tieneLocalidad) setAbierta(true);
  }, [tieneLocalidad]);

  useEffect(() => {
    if (!abierta || !textoListo) return undefined;
    const actual = pedido.current + 1;
    pedido.current = actual;
    const temporizador = setTimeout(async () => {
      setBuscando(true);
      const resultado = await buscarLocalidadesClima(textoListo);
      if (pedido.current !== actual) return;
      setBuscando(false);
      if (!resultado?.ok) {
        setLugares([]);
        setMensaje(resultado?.mensaje || "No se pudo buscar la localidad.");
        return;
      }
      setLugares(resultado.lugares || []);
      setMensaje(resultado.mensaje || "");
    }, 350);

    return () => clearTimeout(temporizador);
  }, [abierta, textoListo]);

  async function elegir(lugar) {
    setGuardando(true);
    setMensaje("");
    const resultado = await guardarSegunDestino(destino, espacioId, lugar.id, consulta);
    setGuardando(false);
    if (!resultado?.ok) {
      setMensaje(resultado?.mensaje || "No se pudo guardar la localidad.");
      return;
    }
    setConsulta("");
    setLugares([]);
    setAbierta(false);
    router.refresh();
  }

  if (!embebida && !abierta) {
    return (
      <button type="button" className="clima__texto" onClick={() => setAbierta(true)}>
        Cambiar localidad
      </button>
    );
  }

  return (
    <div className="clima__busqueda">
      <label className="clima__etiqueta" htmlFor={idCampo}>
        {etiqueta}
      </label>
      <p className="clima__nota">Elegí la localidad. No hace falta la dirección ni la ubicación del teléfono.</p>
      <span className="campo-busqueda">
        <Search className="campo-busqueda__icono" size={18} strokeWidth={1.75} aria-hidden="true" />
        <input
          id={idCampo}
          className="campo-busqueda__input"
          type="text"
          value={consulta}
          autoComplete="off"
          placeholder="Rosario"
          disabled={guardando}
          onChange={(evento) => {
            setConsulta(evento.target.value);
            setLugares([]);
            setMensaje("");
            setBuscando(false);
          }}
        />
      </span>
      {buscando ? <p className="clima__meta">Buscando…</p> : null}
      {aviso ? <p className="clima__vacio">{aviso}</p> : null}
      {lugares.length ? (
        <ul className="clima__opciones">
          {lugares.map((lugar) => (
            <li key={lugar.id}>
              <button type="button" className="clima__opcion" disabled={guardando} onClick={() => elegir(lugar)}>
                {lugar.etiqueta}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function guardarSegunDestino(destino, espacioId, lugarId, consulta) {
  switch (destino) {
    case "usuario":
      return guardarLocalidadUsuario(lugarId, consulta);
    case "espacio":
      return guardarLocalidadClima(espacioId, lugarId, consulta);
    default: {
      const agotado = destino;
      void agotado;
      return Promise.resolve({ ok: false, mensaje: "No se pudo guardar la localidad." });
    }
  }
}
