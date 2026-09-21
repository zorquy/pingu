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

// Las reglas de qué carta merece estar en Google y cómo se escribe su
// dirección viven en UN sitio y se importan (tanda 326). Escribirlas aquí
// otra vez sería tener dos opiniones sobre lo mismo: el día que suba el
// listón, el sitemap seguiría ofreciendo lo de antes y Google se comería
// las páginas que la propia web marca como `noindex`.
import { claveDeJuego, mereceIndexarse, rutaDeCarta, rutaDeColeccion } from '../../js/carta-nucleo.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const SUPABASE_KEY = 'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ'
const SITIO = 'https://pokedoc.es'

// Las páginas que existen siempre, pase lo que pase con la base de datos.
//
// Las privadas (perfil, guardados, mensajes, editor...) no están porque
// ya llevan <meta name="robots" content="noindex">.
const ESTATICAS = [
  ['/', '1.0'],
  // La portada de noticias se actualiza a diario: es la que más interesa
  // que un buscador vuelva a mirar.
  ['/noticias', '0.9'],
  ['/aprender.html', '0.9'],
  // El índice del catálogo: es la puerta a las colecciones y, por ellas,
  // a las fichas de carta.
  ['/cartas', '0.8'],
  ['/buscar.html', '0.6'],
  ['/usuarios.html', '0.6'],
  ['/foro.html', '0.8'],
  // La página que explica el proyecto: es a la que apuntan el vídeo y el
  // enlace de la biografía, así que conviene que Google la tenga.
  ['/sobre.html', '0.7'],
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
    const [guias, categorias, foros, temas] = await Promise.all([
      // Sin published_at no es pública. El límite es un tope de
      // seguridad: el formato admite 50.000 URLs por fichero y no vamos a
      // acercarnos, pero una consulta sin límite es una consulta que
      // algún día devuelve toda la tabla.
      // `kind` con vuelta atrás: mientras la migración de noticias no
      // esté puesta, la columna no existe y pedirla tumbaría el sitemap
      // ENTERO. Sin ella todo se trata como guía, que es lo que era.
      consultar('guides?published_at=not.is.null&select=slug,published_at,kind&order=published_at.desc&limit=5000').catch(
        () => consultar('guides?published_at=not.is.null&select=slug,published_at&order=published_at.desc&limit=5000')
      ),
      consultar('categories?select=slug&order=order_pos'),
      // El foro va con su propio `catch`: si todavía no está migrado, la
      // consulta falla y el resto del sitemap tiene que salir igual.
      consultar('forum_boards?is_hidden=is.false&select=slug&order=position').catch(() => []),
      // Los temas son de lo que más gente puede traer de fuera ("¿es
      // falsa esta carta?" es una búsqueda real), y hasta ahora Google no
      // tenía forma de saber que existen.
      consultar('forum_threads?select=id,last_post_at&order=last_post_at.desc&limit=5000').catch(() => []),
    ])

    // ── El catálogo (tanda 326) ──
    //
    // Las colecciones van TODAS: doscientas cartas con su número y su
    // imagen no es una página escasa, y son las que enlazan a las fichas.
    //
    // Las fichas, en cambio, solo las que la propia web marca como
    // indexables — y eso lo decide `mereceIndexarse`, la misma función
    // que pone el `noindex` en la página. Ofrecer en el sitemap una
    // dirección que llega con `noindex` es pedirle a Google que gaste su
    // presupuesto de rastreo en algo que le vas a decir que ignore.
    //
    // Las dos consultas llevan su propio `catch`: mientras la migración
    // de `tcg_card_play` no esté puesta, la tabla no existe y el sitemap
    // ENTERO se caería por una sección que todavía no existe.
    const [sets, jugadas] = await Promise.all([
      consultar('tcg_sets?market=eq.WEST&select=id,release_date&order=release_date.desc&limit=2000').catch(() => []),
      consultar('tcg_card_play?select=name_key,decks,updated_at&order=decks.desc&limit=5000').catch(() => []),
    ])

    for (const s of sets) {
      if (!s.id) continue
      urls.push({
        loc: `${SITIO}${rutaDeColeccion(s)}`,
        lastmod: soloFecha(s.release_date),
        priority: '0.7',
        // Una colección solo cambia si se reimporta el catálogo.
        changefreq: 'monthly',
      })
    }

    // De las jugadas hay que sacar la carta de verdad: `tcg_card_play` se
    // agrupa por NOMBRE, y una dirección necesita un identificador. Se
    // piden en un solo viaje.
    if (jugadas.length) {
      const nombres = jugadas.map((j) => `"${encodeURIComponent(String(j.name_key))}"`).join(',')
      const cartas = await consultar(
        `tcg_cards?market=eq.WEST&name_search=in.(${nombres})&select=id,name,name_search,detalle_at&limit=5000`
      ).catch(() => [])
      const porNombre = new Map(jugadas.map((j) => [j.name_key, j]))
      for (const c of cartas) {
        // La clave se vuelve a calcular AQUÍ, en JavaScript, con la
        // misma función que usa la ficha. El `in.(…)` de arriba es solo
        // un prefiltro barato contra `name_search`, que Postgres genera
        // con su propio `unaccent` y no tiene por qué coincidir al
        // carácter con el nuestro (el nuestro además junta espacios
        // dobles). Si el prefiltro se deja alguna fuera, esa carta no
        // sale en el sitemap — un despiste, no una dirección mal puesta.
        // Al revés sería peor: ofrecerle a Google una ficha que luego
        // llega con `noindex`.
        const play = porNombre.get(claveDeJuego(c))
        if (!mereceIndexarse(c, play)) continue
        urls.push({
          loc: `${SITIO}${rutaDeCarta(c)}`,
          lastmod: soloFecha(play?.updated_at),
          priority: '0.6',
          changefreq: 'weekly',
        })
      }
    }

    for (const c of categorias) {
      if (c.slug) {
        urls.push({
          loc: `${SITIO}/categoria.html?slug=${encodeURIComponent(c.slug)}`,
          priority: '0.7',
          changefreq: 'weekly',
        })
      }
    }

    // Una noticia va con SU dirección (/noticias/<slug>) y con otra
    // prioridad: lo que le interesa a un buscador de una noticia es
    // encontrarla el mismo día, no revisarla cada mes.
    for (const g of guias) {
      if (!g.slug) continue
      const esNoticia = g.kind === 'news'
      urls.push({
        loc: esNoticia
          ? `${SITIO}/noticias/${encodeURIComponent(g.slug)}`
          : `${SITIO}/guia.html?slug=${encodeURIComponent(g.slug)}`,
        lastmod: soloFecha(g.published_at),
        priority: esNoticia ? '0.9' : '0.8',
        changefreq: esNoticia ? 'daily' : 'monthly',
      })
    }
    for (const f of foros) {
      if (f.slug) {
        urls.push({ loc: `${SITIO}/foro/${encodeURIComponent(f.slug)}`, priority: '0.7', changefreq: 'daily' })
      }
    }

    for (const t of temas) {
      if (t.id) {
        urls.push({
          loc: `${SITIO}/tema/${encodeURIComponent(t.id)}`,
          lastmod: soloFecha(t.last_post_at),
          priority: '0.6',
          changefreq: 'weekly',
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
