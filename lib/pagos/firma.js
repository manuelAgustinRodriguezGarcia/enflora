import { InvalidWebhookSignatureError, WebhookSignatureValidator } from "mercadopago";

const MOTIVOS = {
  MissingSignatureHeader: "firma_ausente",
  MalformedSignatureHeader: "firma_malformada",
  MissingTimestamp: "ts_ausente",
  MissingHash: "hash_ausente",
  SignatureMismatch: "firma_no_coincide",
  TimestampOutOfTolerance: "ts_vencido",
};

function validarManifiesto({ xSignature, xRequestId, dataId, secret }) {
  try {
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId,
      dataId,
      secret,
    });
    return { ok: true };
  } catch (error) {
    const motivo = error instanceof InvalidWebhookSignatureError ? MOTIVOS[error.reason] : "";
    return { ok: false, codigo: motivo || "firma_invalida" };
  }
}

export function firmaWebhookValida({ xSignature, xRequestId, dataId, secret }) {
  if (!secret) {
    return { ok: false, codigo: "sin_secreto", coincideOriginal: false, coincideMinusculas: false };
  }
  const original = validarManifiesto({ xSignature, xRequestId, dataId, secret });
  const id = typeof dataId === "string" ? dataId : "";
  const enMinusculas = id.toLowerCase();
  const distinta = enMinusculas !== id;
  const minusculas =
    distinta && original.codigo === "firma_no_coincide"
      ? validarManifiesto({ xSignature, xRequestId, dataId: enMinusculas, secret })
      : { ok: original.ok && !distinta };
  if (original.ok) {
    return { ok: true, variante: "original", coincideOriginal: true, coincideMinusculas: minusculas.ok };
  }
  if (minusculas.ok) {
    return { ok: true, variante: "minusculas", coincideOriginal: false, coincideMinusculas: true };
  }
  return {
    ok: false,
    codigo: original.codigo,
    coincideOriginal: false,
    coincideMinusculas: false,
  };
}

export function resumenFirmaWebhook({ xSignature, xRequestId, dataId, secret }) {
  const partes = new Map();
  for (const parte of String(xSignature || "").split(",")) {
    const corte = parte.indexOf("=");
    if (corte === -1) continue;
    partes.set(parte.slice(0, corte).trim().toLowerCase(), parte.slice(corte + 1).trim());
  }
  const ts = partes.get("ts") || "";
  const v1 = partes.get("v1") || "";
  const id = String(dataId || "");
  const edad = /^\d+$/.test(ts) ? Math.round(Math.abs(Date.now() - Number(ts) * 1000) / 1000) : null;
  return {
    firma: String(xSignature || "").trim().length > 0,
    requestId: String(xRequestId || "").trim().length > 0,
    dataId: id.trim().length > 0,
    ts: /^\d+$/.test(ts),
    v1: /^[0-9a-f]+$/i.test(v1) && v1.length > 0,
    secreto: String(secret || "").trim().length > 0,
    idMayusculas: /[A-Z]/.test(id),
    edadSegundos: edad,
  };
}
