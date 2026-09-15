// Tanda 271: el canal RSS.
//
// Buena parte del tráfico de las webs de noticias de TCG no entra por
// Google: entra por agregadores, lectores de feeds y bots de Discord que
// reenvían cada entrada a un canal. Todo eso habla RSS y nada más.
import rss, { documento } from '/home/user/pingu/netlify/functions/rss.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 130) : ''}`)
}

const ENTRADAS = [
  { slug: 'cartas-30', title: 'Reveladas las cartas del 30 aniversario', description: 'Todas, una por una.', published_at: '2026-09-10T09:00:00Z', kind: 'news' },
  { slug: 'carta-falsa', title: 'Cómo saber si una carta es falsa', description: 'La prueba de la luz.', published_at: '2026-08-01T09:00:00Z', kind: 'guide' },
]

console.log('\n── 1. El canal, bien formado ──')
{
  const xml = documento(ENTRADAS, { ahora: new Date('2026-09-10T12:00:00Z') })
  check('declara que es RSS 2.0', xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"'))
  check('dice en qué idioma está', xml.includes('<language>es-ES</language>'))
  check('y dónde vive él mismo', xml.includes('href="https://pokedoc.es/rss.xml" rel="self"'))
  check('lleva las dos entradas', (xml.match(/<item>/g) || []).length === 2)
  check('con su fecha de construcción', xml.includes('<lastBuildDate>Thu, 10 Sep 2026 12:00:00 GMT</lastBuildDate>'))
}

console.log('\n── 2. Cada entrada ──')
{
  const xml = documento(ENTRADAS)
  check('el título', xml.includes('<title>Reveladas las cartas del 30 aniversario</title>'))
  // Una noticia va a su dirección de noticia; una guía, a la suya.
  check('la noticia enlaza a /noticias/', xml.includes('<link>https://pokedoc.es/noticias/cartas-30</link>'))
  check('y la guía a la suya', xml.includes('<link>https://pokedoc.es/guia.html?slug=carta-falsa</link>'.replace('?', '?')))
  check('el guid es la dirección, que no cambia', xml.includes('<guid isPermaLink="true">https://pokedoc.es/noticias/cartas-30</guid>'))
  // RSS 2.0 pide fecha de correo, no ISO: un lector que no la entiende
  // ordena las entradas como le parece.
  check('la fecha va en formato de correo', xml.includes('<pubDate>Thu, 10 Sep 2026 09:00:00 GMT</pubDate>'))
  check('se distingue noticia de guía', xml.includes('<category>Noticias</category>') && xml.includes('<category>Guías</category>'))
}

console.log('\n── 3. Nada de lo que entra puede romper el XML ──')
{
  const xml = documento([
    { slug: 'a&b', title: 'Cartas <raras> & "caras"', description: "Con 'comillas' y <etiquetas>", published_at: '2026-09-10T09:00:00Z', kind: 'news' },
  ])
  check('los signos del título se escapan', xml.includes('<title>Cartas &lt;raras&gt; &amp; &quot;caras&quot;</title>'), xml.match(/<title>Cartas[^<]*/)?.[0])
  check('los de la descripción también', !/<description>[^<]*<etiquetas>/.test(xml))
  check('y los de la dirección', xml.includes('a%26b'), xml.match(/<link>[^<]*a[^<]*<\/link>/g)?.join())
  check('no queda ningún < suelto que no sea etiqueta', !/<(?![a-zA-Z/?!])/.test(xml.replace(/<!--[\s\S]*?-->/g, '')))
}

console.log('\n── 4. Servido de verdad ──')
{
  const original = globalThis.fetch
  globalThis.fetch = async (url) => {
    // La primera petición pide `kind`; se responde como PostgREST.
    if (String(url).includes('kind')) {
      return new Response(JSON.stringify(ENTRADAS), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try {
    const r = await rss()
    const xml = await r.text()
    check('se sirve como RSS', (r.headers.get('content-type') || '').includes('application/rss+xml'))
    check('con caché corta', (r.headers.get('cache-control') || '').includes('max-age=600'))
    check('y con las entradas dentro', xml.includes('Reveladas las cartas del 30 aniversario'))
  } finally {
    globalThis.fetch = original
  }
}

console.log('\n── 5. El puente, y que nunca devuelva un error ──')
{
  const original = globalThis.fetch
  // Sin la migración puesta, la columna `kind` no existe: PostgREST
  // devuelve 400. El canal tiene que caer al camino viejo, no vaciarse.
  globalThis.fetch = async (url) => {
    if (String(url).includes('kind')) return new Response('{"code":"42703"}', { status: 400 })
    return new Response(JSON.stringify([{ slug: 'g1', title: 'Una guía', description: '', published_at: '2026-08-01T09:00:00Z' }]), {
      status: 200, headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const xml = await (await rss()).text()
    check('sin la migración, el canal sigue trayendo artículos', xml.includes('Una guía'), xml.slice(0, 120))
    check('y trata lo que no sabe como guía', xml.includes('/guia.html?slug=g1'))
  } finally {
    globalThis.fetch = original
  }

  // Y si Supabase se cae del todo: un canal vacío es un canal. Un 500
  // hace que algunos lectores se den de baja solos.
  globalThis.fetch = async () => { throw new Error('red caída') }
  try {
    const r = await rss()
    const xml = await r.text()
    check('con la base caída, responde 200', r.status === 200)
    check('y devuelve un canal vacío pero válido', xml.includes('<channel>') && !xml.includes('<item>'))
  } finally {
    globalThis.fetch = original
  }
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
