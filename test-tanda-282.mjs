// Tanda 282: mandar una noticia a Telegram a mano, desde el panel.
//
// Lo que arregla: PINGU publicó una noticia y no salió por el canal. La
// función programada se iba en silencio porque le faltaba una variable de
// entorno, y no había ni forma de enterarse ni forma de recuperarla.
import { mandarUna } from '/home/user/pingu/netlify/functions/telegram-mandar.mjs'
import { procesar } from '/home/user/pingu/netlify/functions/telegram-noticias.mjs'
import { llavesQueFaltan, mensajeDeNoticia, portadaAbsoluta } from '/home/user/pingu/netlify/lib/telegram.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 150) : ''}`)
}

const ENV = {
  TELEGRAM_BOT_TOKEN: 'tok',
  TELEGRAM_CANAL_NOTICIAS: '@pingucollects',
  TELEGRAM_TEMA_NOTICIAS: '51511',
  SUPABASE_SERVICE_ROLE_KEY: 'k',
}

const NOTICIA = {
  id: 'n1',
  slug: 'promos-30',
  kind: 'news',
  title: 'Las 18 promos del 30 aniversario',
  description: 'Todas las promos reveladas, una por una.',
  cover_image: 'https://pokedoc.es/portada.png',
  published_at: '2026-09-02T10:00:00.000Z',
  telegram_sent_at: null,
}

function doblar({ fila = NOTICIA, telegramOk = true, patchFalla = false } = {}) {
  const enviado = []
  const marcado = []
  const restImpl = async (ruta, _clave, opciones = {}) => {
    if (opciones.method === 'PATCH') {
      if (patchFalla) throw new Error('sin permiso')
      marcado.push(JSON.parse(opciones.body))
      return null
    }
    return fila ? [fila] : []
  }
  const fetchImpl = async (url, opciones) => {
    enviado.push({ metodo: String(url).split('/').pop(), ...JSON.parse(opciones.body) })
    return new Response(JSON.stringify({ ok: telegramOk, description: telegramOk ? '' : 'chat not found' }), { status: 200 })
  }
  return { restImpl, fetchImpl, enviado, marcado }
}

console.log('\n── 1. EL FALLO: sin la variable, decir CUÁL falta ──')
{
  // Esto es lo que pasó de verdad. La función programada se iba con un
  // «sin TELEGRAM_BOT_TOKEN o TELEGRAM_CANAL_NOTICIAS» que ni decía cuál
  // era ni salía en ningún sitio. Sin el nombre no hay nada que arreglar.
  check('se nombra la que falta', llavesQueFaltan({ ...ENV, TELEGRAM_CANAL_NOTICIAS: '' }).join() === 'TELEGRAM_CANAL_NOTICIAS')
  check('y si faltan dos, las dos', llavesQueFaltan({}).length === 3, llavesQueFaltan({}).join())
  check('con todas puestas, ninguna', llavesQueFaltan(ENV).length === 0)

  const d = doblar()
  const r = await mandarUna({ id: 'n1', env: { ...ENV, TELEGRAM_CANAL_NOTICIAS: '' }, ...d })
  check('el botón no manda nada', d.enviado.length === 0)
  check('y responde diciendo el nombre', r.estado === 503 && r.cuerpo.error.includes('TELEGRAM_CANAL_NOTICIAS'), JSON.stringify(r.cuerpo))
  check('y dice dónde se pone', /Environment variables/.test(r.cuerpo.error))

  // La programada tiene que cantarlo igual: es la que corre sola.
  const r2 = await procesar({ env: { ...ENV, TELEGRAM_CANAL_NOTICIAS: '' }, restImpl: async () => [], fetchImpl: async () => new Response('{}') })
  check('la programada también lo nombra', /TELEGRAM_CANAL_NOTICIAS/.test(r2.saltado || ''), JSON.stringify(r2))
}

console.log('\n── 2. Mandar una noticia a mano ──')
{
  const d = doblar()
  const r = await mandarUna({ id: 'n1', env: ENV, ...d })
  check('sale', r.estado === 200 && r.cuerpo.ok, JSON.stringify(r.cuerpo))
  check('como foto con pie', d.enviado[0]?.metodo === 'sendPhoto', d.enviado[0]?.metodo)
  check('al grupo', d.enviado[0]?.chat_id === '@pingucollects')
  check('y al tema de noticias', d.enviado[0]?.message_thread_id === 51511, JSON.stringify(d.enviado[0]?.message_thread_id))
  check('el mensaje es el mismo que manda la automática', d.enviado[0]?.caption === mensajeDeNoticia(NOTICIA))
  check('y se apunta como mandada', !!d.marcado[0]?.telegram_sent_at, JSON.stringify(d.marcado))
}

console.log('\n── 3. Las redes de la automática NO le aplican ──')
{
  // Esta es la razón de ser del botón: la programada solo mira las
  // últimas 48 horas, así que una noticia de hace días no la recupera
  // jamás. A mano sí, porque hay una persona decidiéndolo.
  const vieja = { ...NOTICIA, published_at: '2026-08-01T10:00:00.000Z' }
  const d = doblar({ fila: vieja })
  const r = await mandarUna({ id: 'n1', env: ENV, ...d })
  check('una noticia de hace un mes se manda igual', r.estado === 200 && d.enviado.length === 1, JSON.stringify(r.cuerpo))

  // Y a la programada se le siguen escapando: la red sigue puesta.
  let ruta = ''
  await procesar({ env: ENV, restImpl: async (r2) => { ruta = r2; return [] }, fetchImpl: async () => new Response('{}') })
  check('pero la automática sigue pidiendo solo las recientes', ruta.includes('published_at=gte.'))
}

console.log('\n── 4. Repetir una noticia tiene que ser una decisión ──')
{
  // Mandar dos veces lo mismo a un canal es lo que hace que la gente lo
  // silencie: sin insistir, se avisa en vez de repetirla.
  const ya = { ...NOTICIA, telegram_sent_at: '2026-09-10T08:00:00.000Z' }
  const d = doblar({ fila: ya })
  const r = await mandarUna({ id: 'n1', env: ENV, ...d })
  check('ya mandada: no se repite sola', r.estado === 409 && d.enviado.length === 0, JSON.stringify(r.cuerpo))
  check('y se dice cuándo salió', r.cuerpo.yaMandada === ya.telegram_sent_at)

  const d2 = doblar({ fila: ya })
  const r2 = await mandarUna({ id: 'n1', forzar: true, env: ENV, ...d2 })
  check('pero insistiendo, sale', r2.estado === 200 && d2.enviado.length === 1, JSON.stringify(r2.cuerpo))
}

console.log('\n── 5. Lo que no puede salir por el canal ──')
{
  const borrador = { ...NOTICIA, published_at: null }
  const d = doblar({ fila: borrador })
  const r = await mandarUna({ id: 'n1', env: ENV, ...d })
  // El enlace del mensaje llevaría a una página que no existe.
  check('un borrador no se manda', r.estado === 400 && d.enviado.length === 0, JSON.stringify(r.cuerpo))
  check('y se dice por qué', /borrador/i.test(r.cuerpo.error))

  const d2 = doblar({ fila: { ...NOTICIA, kind: 'guide' } })
  const r2 = await mandarUna({ id: 'n1', env: ENV, ...d2 })
  check('una guía tampoco', r2.estado === 400 && d2.enviado.length === 0, JSON.stringify(r2.cuerpo))

  const d3 = doblar({ fila: null })
  const r3 = await mandarUna({ id: 'fantasma', env: ENV, ...d3 })
  check('una noticia borrada, tampoco', r3.estado === 404 && d3.enviado.length === 0)

  const r4 = await mandarUna({ env: ENV, ...doblar() })
  check('y sin id no se hace nada', r4.estado === 400)
}

console.log('\n── 6. Cuando Telegram dice que no ──')
{
  // «chat not found», «bot is not a member of the supergroup chat»: eso
  // dice EXACTAMENTE qué arreglar. Traducirlo a un «no se ha podido»
  // sería tirar la única pista que hay.
  const d = doblar({ telegramOk: false })
  const r = await mandarUna({ id: 'n1', env: ENV, ...d })
  check('el error de Telegram llega tal cual', /chat not found/.test(r.cuerpo.error || ''), JSON.stringify(r.cuerpo))
  check('y NO se da por mandada', d.marcado.length === 0)
}

console.log('\n── 7. Mandada pero sin apuntar ──')
{
  // El único caso que puede duplicar: la programada la volvería a mandar
  // en cinco minutos. No es un error —la noticia ya está en el canal—
  // pero hay que decirlo.
  const d = doblar({ patchFalla: true })
  const r = await mandarUna({ id: 'n1', env: ENV, ...d })
  check('se responde que sí salió', r.estado === 200 && r.cuerpo.ok, JSON.stringify(r.cuerpo))
  check('pero avisando de que puede repetirse', /repetirse/i.test(r.cuerpo.aviso || ''), r.cuerpo.aviso)
}

console.log('\n── 8. El botón está en el panel, y se ve el estado ──')
{
  const fs = await import('node:fs')
  const admin = fs.readFileSync('/home/user/pingu/admin/js/admin.js', 'utf8')
  check('hay botón por noticia', /data-telegram-noticia/.test(admin))
  check('y llama a la función', /\/\.netlify\/functions\/telegram-mandar/.test(admin))
  check('con el token del admin', /authorization: `Bearer \$\{session\.access_token\}`/.test(admin))
  // Sin esta columna, una noticia publicada que no salió por el canal no
  // se distingue de una que sí: el fallo puede estar semanas escondido.
  check('la tabla dice si salió o no', /Sin mandar/.test(admin) && /Mandada/.test(admin))
  check('solo en las publicadas', /n\.published_at \? `<button class="btn-secondary" data-telegram-noticia/.test(admin))
  // Icono de js/icons.js, nunca un emoji suelto (normas de la casa).
  check('con icono, no emoji', /icons\.send\(15\)\} Telegram/.test(admin))
}

console.log('\n── 9. La portada tiene que LLEGAR (tanda 283) ──')
{
  // A la foto no la sube PokeDoc: se le pasa la URL y va Telegram a
  // buscarla desde SUS servidores. Una ruta del sitio, que dentro de la
  // web funciona, ahí no se puede resolver.
  check('una ruta del sitio se completa', portadaAbsoluta('/fotos/p.png') === 'https://pokedoc.es/fotos/p.png')
  check('sin barra, también', portadaAbsoluta('fotos/p.png') === 'https://pokedoc.es/fotos/p.png')
  check('una absoluta se deja en paz', portadaAbsoluta('https://sb.co/a.png') === 'https://sb.co/a.png')
  // data:/blob: no son direcciones que nadie pueda ir a buscar: mandarlas
  // es un envío rechazado. Mejor sin foto.
  check('una imagen incrustada no se manda como foto', portadaAbsoluta('data:image/png;base64,AAA') === '')
  check('ni un esquema raro', portadaAbsoluta('javascript:alert(1)') === '')
  check('sin portada, nada', portadaAbsoluta(null) === '' && portadaAbsoluta('  ') === '')

  const d = doblar({ fila: { ...NOTICIA, cover_image: '/fotos/p.png' } })
  await mandarUna({ id: 'n1', env: ENV, ...d })
  check('y el envío usa la completa', d.enviado[0]?.photo === 'https://pokedoc.es/fotos/p.png', d.enviado[0]?.photo)

  const d2 = doblar({ fila: { ...NOTICIA, cover_image: 'data:image/png;base64,AAA' } })
  await mandarUna({ id: 'n1', env: ENV, ...d2 })
  check('una incrustada no rompe el envío: va como mensaje', d2.enviado[0]?.metodo === 'sendMessage', d2.enviado[0]?.metodo)
}

console.log('\n── 10. Si la foto no entra, la portada sale igual ──')
{
  // Antes el reintento mandaba un mensaje PELADO y la portada se perdía
  // del todo. Ahora va con la vista previa grande: Telegram saca el
  // og:image de la noticia, que es esa misma portada.
  const enviado = []
  const fetchImpl = async (url, opciones) => {
    const metodo = String(url).split('/').pop()
    enviado.push({ metodo, ...JSON.parse(opciones.body) })
    if (metodo === 'sendPhoto') return new Response(JSON.stringify({ ok: false, description: 'file is too big' }), { status: 400 })
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }
  const base = doblar()
  const r = await mandarUna({ id: 'n1', env: ENV, restImpl: base.restImpl, fetchImpl })
  check('se reintenta como mensaje', enviado.map((e) => e.metodo).join('→') === 'sendPhoto→sendMessage')
  check('con la vista previa grande', enviado[1]?.link_preview_options?.prefer_large_media === true, JSON.stringify(enviado[1]?.link_preview_options))
  check('y encima del texto', enviado[1]?.link_preview_options?.show_above_text === true)
  check('la noticia sale', r.estado === 200 && r.cuerpo.ok)
  // Y se cuenta POR QUÉ no entró la foto: eso es lo que se puede arreglar.
  check('diciendo por qué no entró la foto', /file is too big/.test(r.cuerpo.motivo || ''), JSON.stringify(r.cuerpo))

  // El mensaje sin portada también lleva la vista previa grande.
  const d2 = doblar({ fila: { ...NOTICIA, cover_image: null } })
  await mandarUna({ id: 'n1', env: ENV, ...d2 })
  check('y un mensaje sin portada, también', d2.enviado[0]?.link_preview_options?.prefer_large_media === true)
}

console.log('\n── 11. El panel cuenta lo de la portada ──')
{
  const admin = (await import('node:fs')).readFileSync('/home/user/pingu/admin/js/admin.js', 'utf8')
  check('se avisa de que la portada no entró como foto', /la portada no ha entrado como foto/.test(admin))
  check('con el motivo de Telegram', /\$\{r\.motivo/.test(admin))
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
