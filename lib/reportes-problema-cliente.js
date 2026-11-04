import { obtenerReporteProblema } from "@/app/reportes/acciones";

const corridas = new Map();

export function corridaDiagnosticoReporte(reporteId, crear) {
  const id = String(reporteId || "");
  let actual = corridas.get(id);
  if (!actual) {
    actual = crear();
    corridas.set(id, actual);
  }
  return actual;
}

export function olvidarCorridaDiagnostico(reporteId) {
  corridas.delete(String(reporteId || ""));
}

export function adjuntosReporteVisibles(fotos) {
  return (fotos || [])
    .filter((foto) => foto?.id)
    .map((foto) => ({
      origen: "enflora",
      fotoId: foto.id,
      vista: foto.vista || "",
      mimeType: foto.mimeType || "",
      historica: true,
      noDisponible: !foto.vista,
      aviso: foto.vista ? "" : "No se pudo mostrar la fotografía de esta conversación.",
    }));
}

export function mensajesDiagnosticoReporte({ mensaje, fotos, respuesta, idMensaje, bienvenida }) {
  const lista = [
    { id: "bienvenida", rol: "flora", texto: bienvenida, animar: false },
    {
      id: idMensaje(),
      rol: "usuario",
      texto: mensaje || "",
      fecha: new Date().toISOString(),
      adjuntos: adjuntosReporteVisibles(fotos),
    },
  ];
  if (String(respuesta || "").trim()) {
    lista.push({
      id: idMensaje(),
      rol: "flora",
      texto: String(respuesta).trim(),
      animar: true,
      fecha: new Date().toISOString(),
    });
  }
  return lista;
}

export function iniciarDiagnosticoReporte(reporteId) {
  return corridaDiagnosticoReporte(reporteId, () => {
    const lectura = obtenerReporteProblema(reporteId);
    const diagnostico = lectura.then(async (leido) => {
      if (!leido?.ok) return { lectura: leido, data: null, falloRed: false };
      if (leido.estado === "enviado" && leido.floraChatId) {
        return {
          lectura: leido,
          falloRed: false,
          data: {
            ok: true,
            yaEnviado: true,
            floraChatId: leido.floraChatId,
            claveSesion: leido.claveSesion,
            mensaje: leido.mensaje,
            fotos: leido.fotos,
            unidadNombre: leido.unidadNombre,
          },
        };
      }
      try {
        const res = await fetch("/api/flora/reporte", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reporteId }),
        });
        const data = await res.json().catch(() => ({}));
        return { lectura: leido, data, falloRed: false };
      } catch {
        return { lectura: leido, data: null, falloRed: true };
      }
    });
    return { lectura, diagnostico };
  });
}
