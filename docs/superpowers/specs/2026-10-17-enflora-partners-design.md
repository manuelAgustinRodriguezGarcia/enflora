# ENFLORA Partners — Design

## Objetivo

Incorporar acuerdos publicitarios de precio fijo mensual: sección comercial en la landing, formulario con Resend, directorio público de comercios, banners no intrusivos y estructura Supabase. Sin pasarelas de pago ni recomendaciones inteligentes.

## Decisiones

- Layout landing: intro + Flora → 3 planes → formulario (antes de Contacto).
- Acceso directorio: solo footer → página pública `/partners` (sin Bottom Nav).
- Banners: componente reutilizable + un slot al final de la lista de Espacios; si no hay campañas, no se renderiza.
- Ilustración: placeholder hasta `/images/flora-landing-partners.png`.
- Correo: endpoint propio `POST /api/partners`, asunto exacto `OPORTUNIDAD PROMO MARCA`, reutiliza Resend/env.
- Plan Inteligente: visible como “Próximamente”; permite interés comercial, no cobro ni fecha.
- Enfoque: espejo de Contacto (lib + route + form).

## Arquitectura

```
Landing SeccionPartners
  → planes desde lib/partners
  → FormularioPartners → POST /api/partners → Resend

/partners (público)
  → cargarComerciosPublicos (Supabase + RLS)

Espacios
  → BannerPublicitario → campañas vigentes con banner
```

## Datos (Supabase)

Tabla `comercios_asociados`: nombre, logo_url, rubro, sitio_web, activo, aprobado, plan, fecha_inicio, fecha_fin, banner_url, banner_enlace.

RLS: SELECT público solo si `aprobado AND activo AND vigencia`. Sin INSERT/UPDATE desde el cliente (gestión manual / admin futuro).

## Fuera de alcance

- Panel admin, pagos publicitarios, pujas, segmentación, Gemini/IA, recomendaciones inteligentes (solo documentadas).
