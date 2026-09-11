// Tanda 287: los torneos, al canal de Telegram.
//
// Porte de telegram-noticias a la sección «Jugar». Sin red: se doblan
// Supabase y la API de Telegram.
import { procesar } from '/home/user/pingu/netlify/functions/telegram-torneos.mjs'
import { mensajeDeTorneo, comoSeJuega, soloTexto, canalDe, llavesQueFaltan } from '/home/user/pingu/netlify/lib/telegram.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 150) : ''}`)
}

const AHORA = new Date('2026-09-11T10:00:00.000Z')
const TORNEO = {
  id: 't1',
  slug: 'copa-pokedoc-septiembre',
  name: 'Copa PokeDoc de septiembre',
  description: '<p>Torneo <b>abierto</b> a toda la comunidad.</p><p>Formato Standard H.</p>',
  banner_url: 'https://pokedoc.es/banner.jpg',
  start_at: '2026-09-20T15:00:00.000Z',
  format: 'standard',
  swiss_rounds: 5,
  top_cut_size: 8,
  max_players: 32,
  status: 'registration_open',
}

const ENV = {
  TELEGRAM_BOT_TOKEN: 'tok',
  TELEGRAM_CANAL_NOTICIAS: '@pingucollects',
  TELEGRAM_TEMA_NOTICIAS: '51511',
  TELEGRAM_TEMA_TORNEOS: '777',
  SUPABASE_SERVICE_ROLE_KEY: 'k',
}

function doblar({ pendientes = [TORNEO], telegramOk = true } = {}) {
  const enviado = []
  const marcado = []
  let ruta = ''
  const restImpl = async (r, _clave, opciones = {}) => {
    if (opciones.method === 'PATCH') {
      marcado.push(r)
      return null
    }
    ruta = r
    return pendientes
  }
  const fetchImpl = async (url, opciones = {}) => {
    if (!String(url).startsWith('https://api.telegram.org/')) return new Response('', { status: 404 })
    enviado.push({ metodo: String(url).split('/').pop(), ...JSON.parse(opciones.body) })
    return new Response(JSON.stringify({ ok: telegramOk, description: telegramOk ? '' : 'chat not found' }), { status: 200 })
  }
  return { restImpl, fetchImpl, enviado, marcado, verRuta: () => ruta }
}

console.log('\n── 1. El anuncio ──')
{
  const m = mensajeDeTorneo(TORNEO, { ahora: AHORA })
  check('lleva el nombre en negrita', m.includes('<b>Copa PokeDoc de septiembre</b>'))
  // La FICHA es lo que decide si alguien se apunta. Si hay que abrir la
  // web para saber cuándo es, no se abre.
  check('cuándo se juega', m.includes('domingo 20 de septiembre a las 17:00'), m)
  check('cómo se juega', m.includes('5 rondas suizas + top 8'))
  check('y cuántas plazas', m.includes('32 plazas'))
  check('el resumen, sin etiquetas', m.includes('Torneo abierto a toda la comunidad.') && !/<p>|<b>/.test(m.replace(/<\/?b>/g, '')))
  check('y el enlace para apuntarse', m.includes('https://pokedoc.es/torneo?slug=copa-pokedoc-septiembre'))
}

console.log('\n── 2. Los formatos ──')
{
  check('suizas', comoSeJuega({ swiss_rounds: 5 }) === '5 rondas suizas')
  check('con top', comoSeJuega({ swiss_rounds: 5, top_cut_size: 8 }) === '5 rondas suizas + top 8')
  check('liga', comoSeJuega({ format: 'league', swiss_rounds: 8 }) === 'liga de 8 jornadas')
  check('una sola ronda no se pluraliza', comoSeJuega({ swiss_rounds: 1 }) === '1 ronda suiza')
  check('y sin rondas no se inventa nada', comoSeJuega({}) === '')
  // Sin aforo no se puede decir «0 plazas», que sería justo lo contrario.
  check('sin límite de plazas se dice', mensajeDeTorneo({ ...TORNEO, max_players: null }, { ahora: AHORA }).includes('plazas sin límite'))
}

console.log('\n── 3. La descripción con formato ──')
{
  check('se quitan las etiquetas', soloTexto('<p>Hola <b>mundo</b></p>') === 'Hola mundo')
  check('los bloques separan con espacio', soloTexto('<p>Uno</p><p>Dos</p>') === 'Uno Dos')
  check('los saltos de línea también', soloTexto('Uno<br>Dos') === 'Uno Dos')
  check('y las entidades se deshacen', soloTexto('Tú&nbsp;y yo') === 'Tú y yo')
  check('sin descripción no pasa nada', soloTexto(null) === '' && soloTexto(undefined) === '')
  // Telegram RECHAZA el mensaje entero si se pasa de 1024.
  const largo = mensajeDeTorneo({ ...TORNEO, description: 'palabra '.repeat(400) }, { ahora: AHORA })
  check('un anuncio largo se recorta al límite', largo.length <= 1024, `${largo.length} caracteres`)
  check('y sigue llevando el enlace', largo.includes('/torneo?slug='))
}

console.log('\n── 4. Se manda, y se apunta ──')
{
  const d = doblar()
  const r = await procesar({ env: ENV, ...d, ahora: AHORA })
  check('va como foto', d.enviado[0]?.metodo === 'sendPhoto', d.enviado[0]?.metodo)
  // Con el BANNER del torneo, que es lo que PINGU pidió.
  check('con el banner del torneo', d.enviado[0]?.photo === TORNEO.banner_url, d.enviado[0]?.photo)
  check('al grupo', d.enviado[0]?.chat_id === '@pingucollects')
  check('y al tema de TORNEOS, no al de noticias', d.enviado[0]?.message_thread_id === 777, String(d.enviado[0]?.message_thread_id))
  check('se apunta como mandado', d.marcado.length === 1, JSON.stringify(d.marcado))
  check('y lo dice', r.mandados === 1 && r.ok, JSON.stringify(r))
}

console.log('\n── 5. Cuándo SÍ y cuándo NO ──')
{
  const d = doblar({ pendientes: [] })
  await procesar({ env: ENV, ...d, ahora: AHORA })
  const ruta = d.verRuta()
  // Un borrador no lo ve nadie y puede cambiar de fecha tres veces:
  // anunciarlo sería anunciar algo que no existe.
  check('solo los que abren inscripciones', ruta.includes('status=eq.registration_open'), ruta.slice(0, 90))
  check('solo los pendientes', ruta.includes('telegram_sent_at=is.null'))
  // Anunciar un torneo al que ya no te puedes apuntar es peor que no
  // anunciarlo.
  check('y ninguno que ya haya empezado', ruta.includes(`start_at=gte.${encodeURIComponent(AHORA.toISOString())}`), ruta)
  check('el más cercano primero', ruta.includes('order=start_at.asc'))
  check('y no más de tres por pasada', ruta.includes('limit=3'))
}

console.log('\n── 6. Sin banner, y cuando Telegram dice que no ──')
{
  const d = doblar({ pendientes: [{ ...TORNEO, banner_url: null }] })
  await procesar({ env: ENV, ...d, ahora: AHORA })
  check('sin banner va como mensaje', d.enviado[0]?.metodo === 'sendMessage', d.enviado[0]?.metodo)

  // Si falla, NO se marca: se reintenta en la siguiente pasada. Un
  // torneo no puede perderse por una caída de red.
  const d2 = doblar({ telegramOk: false })
  const r2 = await procesar({ env: ENV, ...d2, ahora: AHORA })
  check('si falla el envío no se da por mandado', d2.marcado.length === 0)
  check('y se avisa', r2.fallos?.length === 1 && !r2.ok, JSON.stringify(r2.fallos))
}

console.log('\n── 7. El canal y el tema ──')
{
  // En una comunidad de Telegram los «canales» son TEMAS de un mismo
  // grupo, así que el chat es el mismo y lo que cambia es el tema.
  check('sin canal propio se usa el de noticias', canalDe(ENV, 'TELEGRAM_CANAL_TORNEOS') === '@pingucollects')
  check('pero se puede poner uno aparte', canalDe({ ...ENV, TELEGRAM_CANAL_TORNEOS: '@otro' }, 'TELEGRAM_CANAL_TORNEOS') === '@otro')
  check('y por eso no se echa en falta', !llavesQueFaltan(ENV, { canal: 'TELEGRAM_CANAL_TORNEOS' }).length)
  check('pero sin ninguno de los dos, sí', llavesQueFaltan({ ...ENV, TELEGRAM_CANAL_NOTICIAS: '' }, { canal: 'TELEGRAM_CANAL_TORNEOS' }).includes('TELEGRAM_CANAL_TORNEOS'))

  // Sin tema, el anuncio caería en el General del grupo.
  const d = doblar()
  await procesar({ env: { ...ENV, TELEGRAM_TEMA_TORNEOS: '' }, ...d, ahora: AHORA })
  check('sin tema no se manda un tema inventado', !('message_thread_id' in (d.enviado[0] || {})))

  // Y sin las llaves, ni se intenta, y se dice cuál falta.
  const d2 = doblar()
  const r2 = await procesar({ env: { ...ENV, TELEGRAM_BOT_TOKEN: '' }, ...d2, ahora: AHORA })
  check('sin token no manda nada y lo nombra', d2.enviado.length === 0 && /TELEGRAM_BOT_TOKEN/.test(r2.saltado || ''), JSON.stringify(r2))
}

console.log('\n── 8. La migración protege el estreno del canal ──')
{
  const sql = (await import('node:fs')).readFileSync('/home/user/pingu/supabase-migration-telegram-torneos.sql', 'utf8')
  check('crea la columna', /add column if not exists telegram_sent_at/.test(sql))
  // Sin esto, la primera pasada soltaría de golpe todos los torneos que
  // ya están abiertos.
  check('y da por mandado lo que ya existe', /update public\.tournaments[\s\S]*?set telegram_sent_at = now\(\)/.test(sql))
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
