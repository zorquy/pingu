// El canal RSS de PokeDoc (tanda 271).
//
// POR QUÉ. Una parte grande del tráfico de las webs de noticias de TCG no
// entra por Google: entra por agregadores, por lectores de feeds y por
// bots de Discord y Telegram que reenvían cada entrada a un canal. Todo
// eso habla RSS y nada más. Sin canal, PokeDoc no está en ninguna de esas
// conversaciones por buenas que sean las noticias.
//
// Se genera EN LA PETICIÓN, igual que el sitemap y por lo mismo: las
// direcciones salen de Supabase y este sitio no tiene paso de compilación.
// La ruta /rss.xml está reescrita a esta función en netlify.toml.
//
// Solo lee filas públicas, así que va con la clave publicable — la misma
// que ya viaja en js/supabase.js.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const SUPABASE_KEY = 'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ'
const SITIO = 'https://pokedoc.es'

// Cuántas entradas lleva el canal. Un lector solo enseña lo que hay
// dentro, así que con las 30 últimas cualquiera que pase una vez al día
// —o una vez a la semana— lo ve todo.
const CUANTAS = 30

const escapar = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

// RSS 2.0 pide fechas en formato de correo (RFC 822), no ISO. Un lector
// que no entiende la fecha ordena las entradas como le parece.
const fechaRss = (valor) => {
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d.toUTCString()
}

async function consultar(ruta) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`supabase ${res.status}`)
  return res.json()
}

// La dirección de un artículo, que depende de qué es. Repetida a
// propósito y no importada de js/articulos.js: esto corre en el servidor
// y aquello es un módulo del navegador que arrastra sus propios imports.
const enlace = (fila) =>
  fila.kind === 'news'
    ? `${SITIO}/noticias/${encodeURIComponent(fila.slug)}`
    : `${SITIO}/guia.html?slug=${encodeURIComponent(fila.slug)}`

// El `guid` de cada entrada es su identidad para el lector: es lo que usa
// para saber si ya la ha enseñado. Tiene que ser estable aunque el título
// cambie, así que se usa la dirección.
export function documento(entradas, { ahora = new Date() } = {}) {
  const items = entradas
    .map((e) => {
      const url = enlace(e)
      const fecha = fechaRss(e.published_at)
      return `    <item>
      <title>${escapar(e.title)}</title>
      <link>${escapar(url)}</link>
      <guid isPermaLink="true">${escapar(url)}</guid>
      ${fecha ? `<pubDate>${escapar(fecha)}</pubDate>` : ''}
      <description>${escapar(e.description || '')}</description>
      <category>${escapar(e.kind === 'news' ? 'Noticias' : 'Guías')}</category>
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>PokeDoc — Pokémon TCG en español</title>
    <link>${SITIO}/noticias</link>
    <description>Noticias y guías del juego de cartas Pokémon, en español: cartas reveladas, sets, torneos y cambios de formato.</description>
    <language>es-ES</language>
    <lastBuildDate>${escapar(ahora.toUTCString())}</lastBuildDate>
    <!-- Se dice dónde vive el propio canal. Sin esto, un lector que
         reciba el fichero por otro camino no sabe a qué dirección volver
         para actualizarse. -->
    <atom:link href="${SITIO}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`
}

export default async () => {
  let entradas = []
  try {
    // Noticias primero y guías después, todo por fecha: quien se suscribe
    // quiere enterarse de lo que publica PokeDoc, sea lo que sea.
    //
    // `kind` con vuelta atrás: mientras la migración de noticias no esté
    // puesta la columna no existe, y pedirla dejaría el canal VACÍO en vez
    // de devolver las guías de siempre.
    entradas = await consultar(
      `guides?published_at=not.is.null&select=slug,title,description,published_at,kind&order=published_at.desc&limit=${CUANTAS}`
    ).catch(() =>
      consultar(
        `guides?published_at=not.is.null&select=slug,title,description,published_at&order=published_at.desc&limit=${CUANTAS}`
      )
    )
  } catch (e) {
    // Un canal vacío es un canal: el lector lo lee, no se rompe y vuelve
    // a mirar más tarde. Un error 500 hace que algunos lectores se den de
    // baja solos.
    console.warn('rss: no se ha podido leer de Supabase', e?.message || e)
  }

  return new Response(documento(entradas || []), {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      // Diez minutos de caché. Un lector no necesita el segundo exacto, y
      // así una entrada en un agregador con mucha gente no se convierte en
      // mil consultas a la base.
      'cache-control': 'public, max-age=600',
    },
  })
}
