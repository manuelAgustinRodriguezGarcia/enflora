# Guía interna ENFLORA (Flora IA)

Carpeta para documentos editoriales versionados. **No incluir datos de cultivos de usuarios.**

## Formato recomendado

Un archivo JSON por documento:

```json
{
  "id": "identificador-unico",
  "titulo": "Título del documento",
  "tema": "nutricion",
  "subtema": "ph",
  "palabrasClave": ["ph", "acidez"],
  "estado": "publicado",
  "version": "1",
  "incorporado": "2026-10-28",
  "referencias": [],
  "fuenteOriginal": null,
  "autor": null,
  "urlOriginal": null,
  "secciones": [
    {
      "id": "intro",
      "titulo": "Sección",
      "contenido": "Texto autorizado o resumen propio.",
      "palabrasClave": []
    }
  ]
}
```

La carpeta `_fixtures-test/` se ignora en producción y sirve solo para pruebas automatizadas.

Recuperación: `lib/flora-conocimiento.js` → `buscarEnGuiaCultivo`.
