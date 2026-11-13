// Lo que no es la web no se publica (tanda 1305).
//
// Netlify publica la RAÍZ del repo tal cual (no hay paso de compilación), así
// que pokedoc.es/SCHEMA.md, /CLAUDE.md, /BITACORA.md, las ~300 migraciones
// .sql, el código de /netlify/functions/ y /herramientas/ se podían
// descargar: cómo está montada la seguridad, las decisiones del equipo y el
// código del servidor. Nada de eso es la web. Aquí se contesta la 404 de
// siempre (con su código 404 y sin indexar) a esas rutas.
//
// Va en una función de borde y no en `[[redirects]]` porque las redirecciones
// de Netlify no admiten un comodín a mitad de ruta («/supabase-*»,
// «/*.md»); el `path` de una función de borde sí (URLPattern). Solo se
// ejecuta en esas rutas: no toca el resto de la web.
export default async (request) => {
  let cuerpo = 'No encontrado'
  try {
    const r = await fetch(new URL('/404.html', request.url))
    if (r.ok) cuerpo = await r.text()
  } catch {
    // Sin la página bonita, el texto: lo importante es no servir el fichero.
  }
  return new Response(cuerpo, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex', 'cache-control': 'public, max-age=300' },
  })
}

export const RUTAS_INTERNAS = [
  '/*.md',
  '/supabase-*',
  '/netlify/*',
  '/herramientas/*',
  '/.github/*',
  '/node_modules/*',
  '/package.json',
  '/package-lock.json',
  '/netlify.toml',
  '/generar-*.mjs',
]

export const config = { path: RUTAS_INTERNAS }
