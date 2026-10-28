# Ingesta manual — biblioteca Flora (Supabase RAG)

No scrapear URLs. Solo textos propios o resúmenes editoriales con atribución y `condiciones_uso`.

## Requisitos

1. SQL `supabase/flora-rag.sql` aplicado en el proyecto Supabase.
2. Edge Functions desplegadas: `flora-rag-retrieve`, `flora-rag-admin`.
3. Secretos en Supabase: `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FLORA_RAG_ADMIN_IDS` o `FLORA_RAG_ADMIN_EMAILS`.
4. Sesión de un administrador (JWT) para llamar a la función admin.

## Ejemplo — Fuente 001 (borrador)

`POST {SUPABASE_URL}/functions/v1/flora-rag-admin`  
Header: `Authorization: Bearer <access_token del admin>`

```json
{
  "accion": "upsert_documento",
  "fuente": {
    "codigo": "fuente-001-hidroponia-natural",
    "titulo": "Hidroponía Natural",
    "url": "https://hidroponianatural.com/",
    "procedencia": "Fuente 001 — referencia editorial",
    "condiciones_uso": "Resúmenes propios ENFLORA; verificar derechos antes de publicar."
  },
  "documento": {
    "slug": "ejemplo-borrador",
    "titulo": "Documento de ejemplo",
    "estado": "borrador",
    "version": "0"
  },
  "secciones": []
}
```

Cuando existan secciones reales, agregar objetos en `secciones` con `seccion_id`, `contenido`, `palabras_clave`.  
Publicar con `accion: "cambiar_estado_documento"` y `estado: "publicado"` solo tras revisión.

## Activar en la app

En Vercel/local: `FLORA_GUIA_MOTOR=supabase` o `auto`.
