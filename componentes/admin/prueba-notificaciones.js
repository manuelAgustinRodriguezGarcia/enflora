"use client";

import { useState } from "react";
import { Boton } from "@/componentes/boton";

const INICIAL = {
  titulo: "Enflora está conectada",
  mensaje: "Flora te confirma que las notificaciones están funcionando correctamente.",
  url: "/perfil",
};

function textoResultado(datos) {
  if (!datos) return "";
  if (datos.sinDispositivo) {
    return "No hay dispositivos activos vinculados a tu cuenta. Activá los avisos en este teléfono y volvé a probar.";
  }
  const aceptados = Number(datos.aceptados) || 0;
  const fallidos = Number(datos.fallidos) || 0;
  const errores = Array.isArray(datos.errores) ? datos.errores.filter((item) => typeof item === "string") : [];
  const detalle = errores.length ? ` Motivos: ${[...new Set(errores)].join(", ")}.` : "";
  return `El servicio aceptó ${aceptados} envío${aceptados === 1 ? "" : "s"} y rechazó ${fallidos}. Eso no confirma que el dispositivo ya haya mostrado el aviso.${detalle}`;
}

export function PruebaNotificacionesAdmin() {
  const [valores, setValores] = useState(INICIAL);
  const [confirma, setConfirma] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState("");

  function cambiar(evento) {
    const { name, value } = evento.target;
    setValores((actual) => ({ ...actual, [name]: value }));
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (!confirma || ocupado) return;
    setOcupado(true);
    setResultado("");
    try {
      const respuesta = await fetch("/api/push/admin/propia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: valores.titulo,
          mensaje: valores.mensaje,
          url: valores.url,
          masivo: false,
        }),
      });
      const datos = await respuesta.json().catch(() => null);
      if (respuesta.status === 429) {
        setResultado("Demasiadas pruebas seguidas. Esperá unos minutos.");
        return;
      }
      if (!respuesta.ok) {
        setResultado("No se pudo enviar la prueba. Revisá la sesión de administración y la configuración de avisos.");
        return;
      }
      setResultado(textoResultado(datos));
    } catch {
      setResultado("No hubo respuesta del servidor. Probá de nuevo cuando vuelva la conexión.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="admin-prueba formulario" onSubmit={enviar}>
      <p className="admin-estado__etiqueta">Solo esta cuenta</p>
      <h2>Probar en mis dispositivos</h2>
      <p>
        El envío llega únicamente a las instalaciones vinculadas a tu usuario. No hay envío general desde esta pantalla.
        Una respuesta aceptada significa que el servicio de push recibió el mensaje, no que el teléfono ya lo mostró.
      </p>
      <label className="formulario__campo">
        Título
        <input name="titulo" value={valores.titulo} onChange={cambiar} maxLength={120} required />
      </label>
      <label className="formulario__campo">
        Mensaje
        <textarea name="mensaje" value={valores.mensaje} onChange={cambiar} maxLength={280} required rows={3} />
      </label>
      <label className="formulario__campo">
        Destino interno
        <input name="url" value={valores.url} onChange={cambiar} maxLength={500} required placeholder="/perfil" />
      </label>
      <label className="admin-prueba__confirma">
        <input type="checkbox" checked={confirma} onChange={(evento) => setConfirma(evento.target.checked)} />
        Enviar solo a mis dispositivos
      </label>
      <Boton type="submit" disabled={ocupado || !confirma}>
        {ocupado ? "Enviando" : "Enviar a mis dispositivos"}
      </Boton>
      {resultado ? <p role="status">{resultado}</p> : null}
    </form>
  );
}
