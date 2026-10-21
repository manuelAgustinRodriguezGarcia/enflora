import { Info } from "lucide-react";

export function ComprobantePremio({ premioId, emision = null }) {
  if (!premioId || premioId === "nada") return null;

  if (emision?.codigo) {
    return (
      <div className="ruleta-comprobante ruleta-comprobante--emitido">
        <span className="ruleta-comprobante__etiqueta">Código de canje</span>
        <strong className="ruleta-comprobante__codigo">{emision.codigo}</strong>
        {emision.instrucciones ? <p className="ruleta-comprobante__texto">{emision.instrucciones}</p> : null}
      </div>
    );
  }

  return (
    <div className="ruleta-comprobante">
      <Info aria-hidden="true" />
      <p className="ruleta-comprobante__texto">
        Resultado demostrativo. Esta versión de prueba no emite códigos ni acredita premios reales.
      </p>
    </div>
  );
}
