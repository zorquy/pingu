# PokeDoc

Base de conocimiento gamificada sobre Pokémon TCG, en español. HTML + CSS +
JavaScript vanilla (sin build ni bundler), conectada a Supabase, lista para
desplegar en Netlify.

## Configuración

1. `js/supabase.js` ya tiene la URL y la publishable key de tu proyecto
   Supabase (`zqamujmfavwrsqlgbead`) — si cambias de proyecto, actualízalas
   ahí.
2. `SCHEMA.md` documenta el esquema real de tu base de datos (confirmado
   directamente desde tu SQL Editor) y las decisiones/limitaciones que
   surgieron al adaptarlo: contenido Pro con protección solo cosmética
   (no hay política RLS que distinga `is_pro`), el conteo de "cursos
   completados" del dashboard de admin limitado por RLS a los del propio
   admin, y las notificaciones que no tienen un servicio de push real
   conectado.
3. Asegúrate de que exista un bucket público de Storage llamado `images`
   (usado por `/admin` para subir e insertar imágenes).

## Desarrollo local

No hace falta build. Sirve la carpeta con cualquier servidor estático, por
ejemplo:

```bash
npx serve .
```

## Despliegue en Netlify

El repo ya incluye `netlify.toml` con la redirección necesaria. Basta con
conectar el repo en Netlify sin comando de build y con el directorio de
publicación en la raíz (`.`).

## Panel de administración

Disponible en `/admin`. Solo accesible para usuarios cuyo
`user_profiles.is_admin` sea `true`.
