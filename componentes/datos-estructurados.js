import { grafoEnflora } from "@/lib/seo";

export function DatosEstructurados() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(grafoEnflora()) }}
    />
  );
}
