// sitemap.xml, generado en la petición.
//
// Antes era un fichero estático con seis URLs y un comentario que
// explicaba por qué no estaban las guías: sus direcciones dependen de
// datos de Supabase, y listarlas obligaría a un paso de compilación que
// este proyecto no tiene. Resultado práctico: Google no tenía forma de
// enterarse de que existe una guía nueva salvo rastreando enlaces.
//
// Se resuelve igual que las etiquetas sociales: preguntando en el momento
// de servir. La ruta /sitemap.xml está reescrita a esta función en
// netlify.toml, así que la URL que conocen los buscadores no cambia.
//
// Solo lee filas públicas, así que va con la clave publicable (la misma
// que ya viaja en js/supabase.js). La clave secreta no pinta nada aquí.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const SUPABASE_KEY = 'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ'
const SITIO = 'https://pokedoc.es'

// Las páginas que existen siempre, pase lo que pase con la base de datos.
//
// Las privadas (perfil, guardados, mensajes, editor...) no están porque
// ya llevan <meta name="robots" content="noindex">.
const ESTATICAS = [
  ['/', '1.0'],
  ['/aprender.html', '0.9'],
  ['/buscar.html', '0.6'],
  ['/usuarios.html', '0.6'],
  ['/terminos.html', '0.3'],
  ['/privacidad.html', '0.3'],
]

const escapar = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

// <lastmod> quiere una fecha, no una marca de tiempo con zona horaria.
const soloFecha = (valor) => {
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function urlXml({ loc, lastmod, priority, changefreq }) {
  const partes = [`    <loc>${escapar(loc)}</loc>`]
  if (lastmod) partes.push(`    <lastmod>${lastmod}</lastmod>`)
  if (changefreq) partes.push(`    <changefreq>${changefreq}</changefreq>`)
  if (priority) partes.push(`    <priority>${priority}</priority>`)
  return `  <url>\n${partes.join('\n')}\n  </url>`
}

function documento(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(urlXml).join('\n')}
</urlset>
`
}

async function consultar(ruta) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}`)
  const filas = await res.json()
  return Array.isArray(filas) ? filas : []
}

export default async () => {
  const urls = ESTATICAS.map(([ruta, priority]) => ({ loc: `${SITIO}${ruta}`, priority, changefreq: 'daily' }))

  try {
    const [guias, categorias] = await Promise.all([
      // Sin published_at no es pública. El límite es un tope de
      // seguridad: el formato admite 50.000 URLs por fichero y no vamos a
      // acercarnos, pero una consulta sin límite es una consulta que
      // algún día devuelve toda la tabla.
      consultar('guides?published_at=not.is.null&select=slug,published_at&order=published_at.desc&limit=5000'),
      consultar('categories?select=slug&order=order_pos'),
    ])

    for (const c of categorias) {
      if (c.slug) {
        urls.push({
          loc: `${SITIO}/categoria.html?slug=${encodeURIComponent(c.slug)}`,
          priority: '0.7',
          changefreq: 'weekly',
        })
      }
    }

    for (const g of guias) {
      if (g.slug) {
        urls.push({
          loc: `${SITIO}/guia.html?slug=${encodeURIComponent(g.slug)}`,
          lastmod: soloFecha(g.published_at),
          priority: '0.8',
          changefreq: 'monthly',
        })
      }
    }
  } catch (e) {
    // Un sitemap que devuelve 500 le dice a Google que el sitio está
    // roto. Es mejor entregar el listado de páginas fijas, que siempre es
    // cierto, y que la próxima visita del robot recoja el resto.
    console.warn('sitemap: no se ha podido leer Supabase', e?.message || e)
  }

  // Los perfiles de usuario no se listan a propósito: la web todavía no
  // es pública, nadie ha pedido que su perfil salga en Google, y
  // /usuarios.html ya da acceso a todos desde dentro. El día que se
  // quiera, se añaden aquí.

  return new Response(documento(urls), {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // Los buscadores no vuelven a por el sitemap cada minuto, pero
      // tampoco hace falta consultar Supabase en cada visita.
      'cache-control': 'public, max-age=600',
    },
  })
}
