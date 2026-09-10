// Tanda 272: las noticias en el resumen semanal, y `dateModified`.
//
// POR QUÉ EL RESUMEN Y NO UN CORREO POR NOTICIA: con tres o cuatro
// noticias por semana, avisar de cada una es la forma más rápida de que
// 150 personas se den de baja. El resumen semanal ya existe, ya tiene su
// baja de un clic y su dedupe, y una vez por semana sí se lee. Quien las
// quiera al momento tiene el canal RSS.
import { procesar, contenidoSemanal } from '/home/user/pingu/netlify/functions/resumen-semanal.mjs'
import { renderResumenSemanal, renderFilaDeCola } from '/home/user/pingu/netlify/lib/email.mjs'
import meta from '/home/user/pingu/netlify/edge-functions/meta-social.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 130) : ''}`)
}

// Un doble de PostgREST que responde por ruta, y que puede fingir que la
// columna `kind` todavía no existe.
function montarRest({ noticias = [], guias = [], posts = [], temas = [], perfiles = [], sinKind = false } = {}) {
  const encolado = []
  const rest = async (ruta, _clave, opciones = {}) => {
    if (opciones.method === 'POST') {
      encolado.push(...JSON.parse(opciones.body))
      return null
    }
    if (ruta.startsWith('guides?kind=eq.news')) {
      if (sinKind) throw new Error('Supabase 400: column guides.kind does not exist')
      return noticias
    }
    if (ruta.startsWith('guides?')) return guias
    if (ruta.startsWith('forum_posts?')) return posts
    if (ruta.startsWith('forum_threads?')) return temas
    if (ruta.startsWith('user_profiles?')) return perfiles
    if (ruta.startsWith('email_outbox?')) return []
    return []
  }
  return { rest, encolado }
}

const AHORA = new Date('2026-09-14T08:00:00Z')
const NOTICIAS = [
  { title: 'Reveladas las cartas del 30 aniversario', slug: 'cartas-30', published_at: '2026-09-10T09:00:00Z' },
  { title: 'Rotación de septiembre', slug: 'rotacion', published_at: '2026-09-12T09:00:00Z' },
]

console.log('\n── 1. El resumen recoge las noticias de la semana ──')
{
  const { rest } = montarRest({ noticias: NOTICIAS })
  const c = await contenidoSemanal(rest, 'clave')
  check('las trae', c.noticias.length === 2, JSON.stringify(c.noticias.map((n) => n.slug)))
}

console.log('\n── 2. Una semana solo de noticias SÍ manda correo ──')
{
  // Antes hacía falta foro movido o guía nueva. Una semana con tres
  // noticias y el foro tranquilo tiene mucho que contar.
  const { rest, encolado } = montarRest({ noticias: NOTICIAS, perfiles: [{ id: 'u1', notification_email_disabled: [] }] })
  const r = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, rest, ahora: AHORA })
  check('no se salta la semana', !r.saltado, JSON.stringify(r))
  check('y encola el correo', encolado.length === 1, JSON.stringify(r))
  const carga = JSON.parse(encolado[0]?.preview || '{}')
  check('con las noticias dentro', (carga.noticias || []).length === 2, encolado[0]?.preview)
}

console.log('\n── 3. Una semana sin NADA sigue sin mandar correo ──')
{
  // Un resumen vacío es la manera más rápida de acabar en spam.
  const { rest, encolado } = montarRest({ perfiles: [{ id: 'u1', notification_email_disabled: [] }] })
  const r = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, rest, ahora: AHORA })
  check('se calla', !!r.saltado, JSON.stringify(r))
  check('y no encola nada', encolado.length === 0)
}

console.log('\n── 4. Sin la migración puesta, el resumen NO se cae ──')
{
  // `kind` no existe todavía: la consulta de noticias falla. Eso no puede
  // llevarse por delante la parte del foro, que no tiene nada que ver.
  const { rest, encolado } = montarRest({
    sinKind: true,
    posts: [{ thread_id: 't1' }, { thread_id: 't1' }],
    temas: [{ id: 't1', title: 'Un hilo movido', post_count: 2 }],
    perfiles: [{ id: 'u1', notification_email_disabled: [] }],
  })
  const r = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, rest, ahora: AHORA })
  check('el resumen sale igual', encolado.length === 1, JSON.stringify(r))
  const carga = JSON.parse(encolado[0]?.preview || '{}')
  check('con el foro dentro', (carga.temas || []).length === 1)
  check('y sin noticias, sin romperse', (carga.noticias || []).length === 0)
}

console.log('\n── 5. El correo, pintado ──')
{
  const correo = renderResumenSemanal({
    temas: [{ id: 't1', titulo: 'Un hilo movido', mensajes: 7 }],
    guia: null,
    noticias: [{ titulo: 'Reveladas las cartas del 30 aniversario', slug: 'cartas-30' }],
    siteUrl: 'https://pokedoc.es',
    unsubscribeUrl: 'https://pokedoc.es/baja-correo?t=x',
  })
  check('la noticia sale en el HTML', correo.html.includes('Reveladas las cartas del 30 aniversario'))
  check('con su dirección de noticia', correo.html.includes('https://pokedoc.es/noticias/cartas-30'))
  check('y también en la versión de texto', correo.text.includes('· Noticia: Reveladas las cartas del 30 aniversario'))
  // Las noticias van PRIMERO: son lo más perecedero del correo.
  check('las noticias van antes que el foro',
    correo.html.indexOf('cartas-30') < correo.html.indexOf('Un hilo movido'))
  check('y mandan en lo que se lee en la bandeja',
    correo.html.includes('Reveladas las cartas del 30 aniversario'), '')
  // Sin noticias, el correo de siempre.
  const soloForo = renderResumenSemanal({
    temas: [{ id: 't1', titulo: 'Un hilo movido', mensajes: 7 }], siteUrl: 'https://pokedoc.es',
  })
  check('sin noticias, el correo es el de siempre', soloForo.html.includes('Lo que más se ha movido en el foro estos días'))
}

console.log('\n── 6. Y una fila de la cola se pinta con lo suyo ──')
{
  const fila = {
    type: 'weekly_digest',
    subject: 'Lo mejor de PokeDoc esta semana',
    preview: JSON.stringify({ temas: [], guia: null, noticias: [{ titulo: 'Una noticia', slug: 'una' }] }),
    link: null,
  }
  const correo = renderFilaDeCola(fila, { siteUrl: 'https://pokedoc.es', unsubscribeUrl: null })
  check('la cola sabe pintar las noticias', correo.html.includes('https://pokedoc.es/noticias/una'), correo.html.slice(0, 100))
}

console.log('\n── 7. dateModified, sin poder tumbar el sitio ──')
{
  const HTML = `<!DOCTYPE html><html><head><title>t</title><meta name="description" content="d" />
<!-- meta-social:inicio --><!-- meta-social:fin --></head><body>
<article id="articleMain"><!-- articulo:inicio -->x<!-- articulo:fin --></article></body></html>`

  const servir = async ({ conColumna, fila }) => {
    const original = globalThis.fetch
    globalThis.fetch = async (url) => {
      const u = String(url)
      if (u.includes('/guides?')) {
        // Es lo que hace PostgREST cuando la columna no existe.
        if (!conColumna && u.includes('updated_at')) return new Response('{"code":"42703"}', { status: 400 })
        return new Response(JSON.stringify(fila ? [fila] : []), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    }
    try {
      const r = await meta(new Request('https://pokedoc.es/noticias/x'), {
        next: async () => new Response(HTML, { status: 200, headers: { 'content-type': 'text/html' } }),
      })
      return await r.text()
    } finally {
      globalThis.fetch = original
    }
  }

  const base = { title: 'Una noticia', description: 'd', published_at: '2026-09-10T09:00:00Z', reference_blocks: [{ type: 'richtext', html: '<p>x</p>' }], categories: null }

  const tocada = await servir({ conColumna: true, fila: { ...base, updated_at: '2026-09-10T18:00:00Z' } })
  check('una noticia corregida lo dice', tocada.includes('"dateModified":"2026-09-10T18:00:00Z"'))

  // Una fecha de modificación igual a la de publicación es ruido.
  const intacta = await servir({ conColumna: true, fila: { ...base, updated_at: '2026-09-10T09:00:00Z' } })
  check('una que no se ha tocado, no', !intacta.includes('dateModified'))

  // Y lo que de verdad importa: sin la columna, el sitio entero se
  // quedaría sin etiquetas sociales. Tiene que caer al camino de antes.
  const sinColumna = await servir({ conColumna: false, fila: base })
  check('sin la migración, sigue habiendo etiquetas', sinColumna.includes('Una noticia'), sinColumna.slice(0, 120))
  check('y ficha de noticia', sinColumna.includes('"NewsArticle"'))
  check('y el cuerpo del artículo', sinColumna.includes('<p>x</p>'))
  check('sin dateModified, claro', !sinColumna.includes('dateModified'))
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
