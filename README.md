# PokeDoc

Base de conocimiento gamificada sobre Pokémon TCG, en español. HTML + CSS +
JavaScript vanilla (sin build ni bundler), conectada a Supabase, lista para
desplegar en Netlify.

## Configuración

1. Abre `js/supabase.js` y sustituye `'TU_URL'` y `'TU_KEY'` por la URL y la
   anon key de tu proyecto de Supabase (las mismas que usabas como
   `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
2. Revisa `SCHEMA.md`: describe las tablas y columnas que el código espera
   encontrar en tu base de datos. No se ha modificado ningún dato ni tabla
   desde aquí — solo compáralo con tu esquema real y ajusta lo que falte.
3. Crea (si no existe) un bucket público de Storage llamado `images` para
   las imágenes que se suben desde `/admin`.

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
