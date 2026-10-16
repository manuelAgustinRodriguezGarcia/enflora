# Contacto landing — Design

## Decisiones
- Reemplazar `section#contacto` con componente `SeccionContacto`.
- Sin `Revelar` / `data-revelar` / GSAP / Motion en esta sección.
- Sin detalle botánico. Sin nota de privacidad.
- Tres tarjetas enlace reales: Instagram, Email, LinkedIn (en ese orden).
- Conservar lógica mailto del formulario existente.

## Copy
- Título: `¿Charlamos?`
- Descripción: `¿Tenés una duda, una idea o algo para contarme sobre ENFLORA? Escribime, que te leo.`
- Instagram: `Seguinos en Instagram` / `@enflora420` → `https://www.instagram.com/enflora420/?hl=es-la`
- Email: `Mandame un mail` / `enflora.420@gmail.com` → `mailto:enflora.420@gmail.com`
- LinkedIn: `LinkedIn del creador` / `Manuel Rodríguez García` → `https://www.linkedin.com/in/manuel-agustin-rodriguez-garcia/`
- Form: `Dejame un mensaje` / `Contame qué necesitás` / botón `Enviar consulta` con flecha

## Estilo
- Fondo `#F4F8EE`, verde oscuro `#0B3D2A`, verde claro `#A4C85B`, superficies `#FFFFFF`
- Fredoka títulos, Inter resto
- Form: blanco, radius 24px, borde verde suave, sombra discreta
- Tarjetas: blancas, ícono en caja sage, flecha externa

## Responsive
- Mobile: copy → 3 tarjetas → form
- Nombre/Correo a una columna cuando no hay espacio

## Archivos
- `componentes/landing/seccion-contacto.js` (nuevo)
- `componentes/landing/formulario-contacto.js`
- `componentes/landing/landing.js`
- `lib/landing.js`
- `estilos/paginas/_landing.scss`
