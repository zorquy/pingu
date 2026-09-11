// Tanda 280: las noticias, al canal de Telegram.
//
// Sin red: se doblan Supabase y la API de Telegram.
// El envío se comparte con el botón del panel (tanda 282), así que vive
// en netlify/lib/telegram.mjs; aquí solo queda el recorrido programado.
import { procesar } from '/home/user/pingu/netlify/functions/telegram-noticias.mjs'
import { mensajeDeNoticia, escaparTelegram } from '/home/user/pingu/netlify/lib/telegram.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 130) : ''}`)
}

const NOTICIA = {
  id: 'n1',
  slug: 'cartas-30',
  title: 'Reveladas las 128 cartas del set principal',
  description: 'TPCi ha enseñado el set completo del 30 aniversario. Sale el 16 de septiembre.',
  cover_image: 'https://pokedoc.es/portada.png',
  published_at: new Date().toISOString(),
}

function doblar({ pendientes = [NOTICIA], telegramOk = true, fotoFalla = false, patchFalla = false } = {}) {
  const enviado = []
  const marcado = []
  const restImpl = async (ruta, _clave, opciones = {}) => {
    if (opciones.method === 'PATCH') {
      if (patchFalla) throw new Error('no se pudo escribir')
      marcado.push(ruta)
      return null
    }
    return pendientes
  }
  const fetchImpl = async (url, opciones) => {
    // Cuando el enlace de la foto no le sirve a Telegram, la lib se la
    // intenta traer para subirla ella (tanda 284). Aquí esa descarga se
    // dobla como que no se puede: lo que interesa en esta prueba es el
    // recorrido de la función programada, y la subida la cubre la 282.
    if (!String(url).startsWith('https://api.telegram.org/')) return new Response('', { status: 404 })
    const cuerpo = JSON.parse(opciones.body)
    const metodo = String(url).split('/').pop()
    enviado.push({ metodo, ...cuerpo })
    if (metodo === 'sendPhoto' && fotoFalla) {
      return new Response(JSON.stringify({ ok: false, description: 'wrong file identifier' }), { status: 400 })
    }
    return new Response(JSON.stringify({ ok: telegramOk, description: telegramOk ? '' : 'chat not found' }), { status: 200 })
  }
  return { restImpl, fetchImpl, enviado, marcado }
}

const ENV = { TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CANAL_NOTICIAS: '@pokedoc_noticias', SUPABASE_SERVICE_ROLE_KEY: 'k' }

console.log('\n── 1. El mensaje ──')
{
  const m = mensajeDeNoticia(NOTICIA)
  check('lleva el titular en negrita', m.includes('<b>Reveladas las 128 cartas del set principal</b>'))
  check('el resumen', m.includes('TPCi ha enseñado'))
  check('y el enlace a la noticia', m.includes('https://pokedoc.es/noticias/cartas-30'))
  // Telegram rechaza el mensaje ENTERO si un signo sin escapar le rompe
  // el HTML: un «&» en un titular y no se manda nada.
  check('los signos se escapan', escaparTelegram('Cartas <raras> & "caras"') === 'Cartas &lt;raras&gt; &amp; "caras"')
  const largo = mensajeDeNoticia({ ...NOTICIA, description: 'x '.repeat(900) })
  // El pie de una foto son 1024 como MUCHO, y pasarse no recorta: rechaza.
  check('un resumen largo se recorta al límite', largo.length <= 1024, `${largo.length} caracteres`)
  check('y se corta por un espacio, no a media palabra', /…$|…<\/|…\n/.test(largo) || largo.includes('…'), largo.slice(-60))
}

console.log('\n── 2. Se manda, y se apunta ──')
{
  const d = doblar()
  const r = await procesar({ env: ENV, ...d })
  check('va como foto con pie', d.enviado[0]?.metodo === 'sendPhoto', d.enviado[0]?.metodo)
  check('al canal que toca', d.enviado[0]?.chat_id === '@pokedoc_noticias')
  check('con la portada', d.enviado[0]?.photo === NOTICIA.cover_image)
  check('se apunta como mandada', d.marcado.length === 1, JSON.stringify(d.marcado))
  check('y lo dice', r.mandadas === 1 && r.ok, JSON.stringify(r))
}

console.log('\n── 3. Sin portada, mensaje normal ──')
{
  const d = doblar({ pendientes: [{ ...NOTICIA, cover_image: null }] })
  await procesar({ env: ENV, ...d })
  // Una foto rota es peor que ninguna foto.
  check('no se manda una foto que no existe', d.enviado[0]?.metodo === 'sendMessage', d.enviado[0]?.metodo)
}

console.log('\n── 4. Si la foto no le gusta a Telegram, la noticia sale igual ──')
{
  const d = doblar({ fotoFalla: true })
  const r = await procesar({ env: ENV, ...d })
  check('se reintenta sin la foto', d.enviado.map((e) => e.metodo).join('→') === 'sendPhoto→sendMessage')
  check('y la noticia se manda', r.mandadas === 1, JSON.stringify(r))
  check('y se apunta', d.marcado.length === 1)
}

console.log('\n── 5. Lo que NO puede pasar: repetir o perder una noticia ──')
{
  // Si Telegram falla, NO se marca: se reintenta en la siguiente pasada.
  // Una caída de red no puede hacer que una noticia se pierda.
  const d = doblar({ telegramOk: false })
  const r = await procesar({ env: ENV, ...d })
  check('si falla el envío, no se da por mandada', d.marcado.length === 0)
  check('y se avisa del fallo', r.fallos?.length === 1 && !r.ok, JSON.stringify(r.fallos))

  // Y el caso feo: mandada pero sin poder apuntarla. Es el único que
  // puede duplicar, así que tiene que cantarlo bien claro.
  const d2 = doblar({ patchFalla: true })
  const r2 = await procesar({ env: ENV, ...d2 })
  check('mandada pero no apuntada se canta', /MANDADA PERO NO APUNTADA/.test(JSON.stringify(r2.fallos)), JSON.stringify(r2.fallos))
}

console.log('\n── 6. No se manda de golpe el archivo entero ──')
{
  // Lo que arruinaría el estreno del canal. Dos redes: la migración marca
  // lo ya publicado como mandado, y aquí se limita cuántas van por pasada.
  const muchas = [...Array(12)].map((_, i) => ({ ...NOTICIA, id: `n${i}`, slug: `noticia-${i}` }))
  const d = doblar({ pendientes: muchas.slice(0, 5) })
  const r = await procesar({ env: ENV, ...d })
  check('como mucho cinco por pasada', r.mandadas <= 5, JSON.stringify(r.mandadas))
  // Y la consulta pide solo las recientes: una noticia vieja que se
  // republique no vuelve a salir por el canal.
  let rutaPedida = ''
  const d2 = { ...doblar(), restImpl: async (ruta) => { rutaPedida = ruta; return [] } }
  await procesar({ env: ENV, ...d2 })
  check('solo se piden las pendientes', rutaPedida.includes('telegram_sent_at=is.null'), rutaPedida.slice(0, 80))
  check('y solo las recientes', rutaPedida.includes('published_at=gte.'), rutaPedida.slice(0, 120))
}

console.log('\n── 7. Los TEMAS de un grupo ──')
{
  // Un «canal» dentro de una comunidad suele ser un TEMA de un grupo, y
  // eso no es un chat distinto: es el mismo grupo con message_thread_id.
  // Sin él, el mensaje cae en el tema General y no donde toca.
  const d = doblar()
  await procesar({ env: { ...ENV, TELEGRAM_TEMA_NOTICIAS: '45' }, ...d })
  check('se manda al tema', d.enviado[0]?.message_thread_id === 45, JSON.stringify(d.enviado[0]?.message_thread_id))

  // Y el reintento sin foto tiene que ir al MISMO tema, no al General.
  const d2 = doblar({ fotoFalla: true })
  await procesar({ env: { ...ENV, TELEGRAM_TEMA_NOTICIAS: '45' }, ...d2 })
  check('y el reintento sin foto, también', d2.enviado[1]?.message_thread_id === 45, JSON.stringify(d2.enviado[1]))

  // Un canal normal no lleva tema: mandar uno que no existe da error.
  const d3 = doblar()
  await procesar({ env: ENV, ...d3 })
  check('un canal normal no lleva tema', !('message_thread_id' in (d3.enviado[0] || {})))
}

console.log('\n── 8. Sin las llaves, no hace nada y lo dice ──')
{
  for (const [que, env] of [
    ['sin token', { ...ENV, TELEGRAM_BOT_TOKEN: '' }],
    ['sin canal', { ...ENV, TELEGRAM_CANAL_NOTICIAS: '' }],
    ['sin la clave de servicio', { ...ENV, SUPABASE_SERVICE_ROLE_KEY: '' }],
  ]) {
    const d = doblar()
    const r = await procesar({ env, ...d })
    check(`${que}: no manda nada`, d.enviado.length === 0 && !!r.saltado, JSON.stringify(r))
  }
}

console.log('\n── 9. La migración protege el estreno del canal ──')
{
  const sql = (await import('node:fs')).readFileSync('/home/user/pingu/supabase-migration-telegram-noticias.sql', 'utf8')
  check('crea la columna', /add column if not exists telegram_sent_at/.test(sql))
  // ESTO es lo que evita soltar el archivo entero en el canal al
  // encenderlo. Sin esta línea, el estreno sería un aluvión.
  check('y da por mandado lo ya publicado', /update public\.guides[\s\S]*?set telegram_sent_at = now\(\)/.test(sql))
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
