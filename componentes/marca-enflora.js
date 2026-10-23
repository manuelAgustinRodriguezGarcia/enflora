import { NOMBRE_MARCA } from "@/lib/seo";

export function MarcaEnflora({ className = "" }) {
  const clase = className ? `marca-enflora ${className}` : "marca-enflora";
  return <span className={clase}>{NOMBRE_MARCA}</span>;
}

export function TextoConMarca({ texto }) {
  const valor = String(texto ?? "");
  if (!valor.includes(NOMBRE_MARCA)) return valor;
  const partes = valor.split(NOMBRE_MARCA);
  return partes.flatMap((parte, indice) => {
    const nodos = [];
    if (parte) nodos.push(<span key={`texto-${indice}`}>{parte}</span>);
    if (indice < partes.length - 1) nodos.push(<MarcaEnflora key={`marca-${indice}`} />);
    return nodos;
  });
}
