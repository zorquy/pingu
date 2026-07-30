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
4. Para el generador de cursos con IA (botón "✨ Generar con IA" en el editor
   de guías), añade la variable de entorno `ANTHROPIC_API_KEY` en Netlify
   (Site settings → Environment variables) con una clave de
   [console.anthropic.com](https://console.anthropic.com). Sin esa variable
   el resto del panel funciona igual, solo ese botón da error.
5. Ejecuta `supabase-migration-social.sql` en el SQL Editor de Supabase para
   activar las guías colaborativas y los perfiles públicos (muro, reseñas).
6. Login por contraseña: si quieres que crear cuenta sea 100% sin fricción
   (sin ningún email de por medio), desactiva "Confirm email" en tu proyecto
   Supabase → Authentication → Providers → Email. Si lo dejas activado, tras
   registrarse el usuario recibe un enlace de confirmación (una sola vez, no
   un código cada vez que inicia sesión).
7. Login con Google (opcional): en Supabase → Authentication → Providers →
   Google, actívalo y añade el Client ID/Secret de un proyecto en
   [Google Cloud Console](https://console.cloud.google.com/) (con la URI de
   redirección que te muestra el propio panel de Supabase autorizada ahí).
   Sin esto configurado, el botón "Continuar con Google" da error — el resto
   del login (email + contraseña) funciona igual.

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
