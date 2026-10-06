// Tanda 693 — las cartas sueltas sin foto, buscadas en TCGGO por nombre.
//
// PINGU, con el Ancient Mew: «sale sin imagen; creo que está en la
// colección incorrecta. Si encuentras dónde está guardada en la API de
// TCGGO, la traes y la metes en la colección correcta». Lo que se mira:
// que solo se escribe con UNA carta suelta del nombre exacto, que la foto,
// el id y los productos se escriben, que se cambia de set solo si la
// expansión es un set nuestro, que se prueban los dos parámetros de
// búsqueda y se apunta el que contesta, y los frenos (intentos, tope,
// parón del plan, fallo nuestro).
import { laUnica, parcheDeCarta, pasada, CLAVE_ESTADO, MAXIMO_INTENTOS, TOPE_DIARIO } from '/home/user/pingu/netlify/functions/tcggo-sueltas.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'k', TCGGO_API_KEY: 't', TCGGO_PAUSA_MS: '0' }
const MEW = { id: 7777, name: 'Ancient Mew', type: 'singles', card_number: 1, card_code_number: 'WP 1', cardmarket_id: 123, tcgplayer_id: 456, rarity: 'promo', supertype: 'Pokémon', image: 'https://images.tcggo.com/x/ancient-mew.png', episode: { id: 90, name: 'Wizards Black Star Promos' } }
const SOBRE = { id: 7778, name: 'Ancient Mew', type: 'sealed', episode: { id: 90 } }

console.log('── 1. La única ──')
check('una suelta con el nombre exacto, y los sobres no cuentan', laUnica({ data: [MEW, SOBRE] }, 'Ancient Mew')?.carta?.id === 7777)
check('con dos sueltas, nada y el motivo', laUnica({ data: [MEW, { ...MEW, id: 1 }] }, 'Ancient Mew').carta === null && /2 cartas/.test(laUnica({ data: [MEW, { ...MEW, id: 1 }] }, 'Ancient Mew').motivo))
check('con otras cartas pero ninguna del nombre, nada', /ninguna con ese nombre/.test(laUnica({ data: [{ ...MEW, name: 'Mew' }] }, 'Ancient Mew').motivo))
check('sin nada, nada', /no devuelve nada/.test(laUnica({ data: [] }, 'Ancient Mew').motivo))

console.log('── 2. El parche ──')
const NUESTRA = { id: 'miscp-1', set_id: 'miscp', local_id: '001', name: 'Ancient Mew', name_en: null }
const SETS = [{ id: 'basep', tcggo_id: 90 }, { id: 'base1', tcggo_id: 171 }]
const { parche, movida } = parcheDeCarta(NUESTRA, MEW, SETS)
check('foto, id y productos de TCGGO, y el nombre inglés que faltaba', parche.image_tcggo === MEW.image && parche.tcggo_id === 7777 && parche.cm_id_product_propio === 123 && parche.tp_id_product_propio === 456 && parche.name_en === 'Ancient Mew' && parche.tcggo_at, JSON.stringify(parche))
check('  …y se cambia a basep (la expansión 90 es ese set), con el número de TCGGO', parche.set_id === 'basep' && parche.local_id === '1' && movida?.de === 'miscp' && movida.a === 'basep')
const sinMover = parcheDeCarta(NUESTRA, { ...MEW, episode: { id: 999 } }, SETS)
check('si la expansión no es un set nuestro, no se mueve (ni set ni número)', !('set_id' in sinMover.parche) && !('local_id' in sinMover.parche) && sinMover.movida === null)
check('si ya está en ese set, tampoco', parcheDeCarta({ ...NUESTRA, set_id: 'basep' }, MEW, SETS).movida === null)
check('el id de la carta no va en el parche: es la llave de las colecciones', !('id' in parche))

console.log('── 3. La pasada ──')
const montar = ({ searchContesta = true, limite = false, baseFalla = false } = {}) => {
  const estados = {}
  const urls = []
  const parches = []
  const fetchImpl = async (url) => {
    urls.push(url)
    if (limite) return { ok: false, status: 429, text: async () => 'You have exceeded the rate limit' }
    const u = new URL(url)
    const q = u.searchParams.get('search') ?? u.searchParams.get('name')
    if (u.searchParams.has('search') && !searchContesta) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [] }) }
    const data = /ancient/i.test(q) ? [MEW, SOBRE] : /pikachu/i.test(q) ? [{ ...MEW, id: 1, name: 'Pikachu' }, { ...MEW, id: 2, name: 'Pikachu' }] : []
    return { ok: true, status: 200, text: async () => JSON.stringify({ data }) }
  }
  const restImpl = async (ruta, opciones) => {
    if (opciones?.method === 'PATCH') { if (baseFalla) throw new Error('Supabase 400: PGRST204'); parches.push({ ruta, cuerpo: JSON.parse(opciones.body) }); return null }
    if (ruta.startsWith('tcg_cards?select=')) return [NUESTRA, { id: 'xyp-1', set_id: 'xyp', local_id: '1', name: 'Pikachu', name_en: 'Pikachu' }]
    if (ruta.startsWith('tcg_sets?select=')) return SETS
    return []
  }
  const correr = (ahora = new Date('2026-10-06T18:00:00Z')) => pasada({ env: ENV, fetchImpl, restImpl, estadoImpl: async (k) => estados[k] || {}, guardarEstadoImpl: async (k, v) => { estados[k] = v }, ahora, pausa: async () => {} })
  return { estados, urls, parches, correr }
}
{
  const b = montar()
  const r = await b.correr()
  check('va bien: el Ancient Mew hecho (movido a basep) y el Pikachu sin par (varias)', r.ok && r.hechasAhora.length === 1 && r.hechasAhora[0].id === 'miscp-1' && r.hechasAhora[0].movida?.a === 'basep' && r.sinParAhora.length === 1 && /2 cartas/.test(r.sinParAhora[0].motivo), JSON.stringify(r))
  check('  …el PATCH va a ESA carta con la foto y el set', b.parches.length === 1 && /id=eq\.miscp-1/.test(b.parches[0].ruta) && b.parches[0].cuerpo.image_tcggo === MEW.image && b.parches[0].cuerpo.set_id === 'basep', JSON.stringify(b.parches[0]))
  check('  …con `search` contestando, UNA petición por carta y el parámetro apuntado', b.urls.length === 2 && b.urls.every((u) => /[?&]search=/.test(u)) && b.estados[CLAVE_ESTADO].parametro === 'search' && b.estados[CLAVE_ESTADO].peticionesHoy === 2, JSON.stringify(b.urls))
  const r2 = await b.correr()
  check('la segunda pasada no repite la hecha y reintenta la sin par (intento 2)', r2.ok && r2.hechasAhora.length === 0 && b.estados[CLAVE_ESTADO].sinPar['xyp-1'].intentos === 2, JSON.stringify(r2))
  await b.correr()
  const r4 = await b.correr()
  check(`a los ${MAXIMO_INTENTOS} intentos se deja en paz`, r4.miradas === 0 && b.estados[CLAVE_ESTADO].sinPar['xyp-1'].intentos === MAXIMO_INTENTOS, JSON.stringify(r4))
  const r5 = await b.correr(new Date('2026-10-25T18:00:00Z'))
  check('  …y a las dos semanas se vuelve a mirar, desde el intento 1', r5.miradas === 1 && b.estados[CLAVE_ESTADO].sinPar['xyp-1'].intentos === 1, JSON.stringify(r5))
}
{
  const b = montar({ searchContesta: false })
  const r = await b.correr()
  check('si `search` no da nada se prueba `name`, se escribe igual y se apunta `name`', r.ok && r.hechasAhora.length === 1 && b.estados[CLAVE_ESTADO].parametro === 'name' && b.urls.some((u) => /[?&]name=/.test(u)), JSON.stringify(b.urls))
  const antes = b.urls.length
  await b.correr(new Date('2026-10-07T18:00:00Z'))
  check('  …y la pasada siguiente va con `name` primero', /[?&]name=/.test(b.urls[antes] || ''), b.urls[antes])
}
{
  const b = montar({ limite: true })
  const r = await b.correr()
  check('con el plan agotado se para hasta mañana, sin escribir nada', r.ok && r.parado?.dia === '2026-10-06' && b.parches.length === 0 && b.urls.length === 1, JSON.stringify(r))
  const r2 = await b.correr()
  check('  …y no vuelve a pedir nada ese día', /parado hoy/.test(r2.saltado) && b.urls.length === 1)
}
{
  const b = montar({ baseFalla: true })
  const r = await b.correr()
  check('si NUESTRA base falla al escribir, la pasada para y lo apunta', !r.ok && /nuestra base/.test(r.error) && b.estados[CLAVE_ESTADO].ultimoError?.carta === 'miscp-1', JSON.stringify(r))
}
{
  const b = montar()
  b.estados[CLAVE_ESTADO] = { dia: '2026-10-06', peticionesHoy: TOPE_DIARIO, hechas: {}, sinPar: {} }
  const r = await b.correr()
  check('con el tope diario gastado no se pide nada', r.saltado === 'tope diario' && b.urls.length === 0)
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
