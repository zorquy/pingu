// Tanda 585 — pokemontcg.io como segunda fuente de precios de Cardmarket.
//
// AVISO (norma de la 501): la forma de la respuesta de pokemontcg.io sale
// de su documentación, no de una respuesta real pegada aquí — desde este
// contenedor no se puede preguntar. En cuanto haya una de verdad, se pega
// y sustituye a `RESPUESTA`.
import {
  idParaPokemontcg, numeroParaPokemontcg, urlPorCodigo, urlPorId, fechaDe, filaDePokemontcg, elegirPorNumero, precioDePokemontcg,
} from '/home/user/pingu/netlify/lib/pokemontcg.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}

console.log('── 1. Traducir nuestros ids a los suyos ──')
{
  check('xy5-150 se queda igual', idParaPokemontcg('xy5-150') === 'xy5-150')
  check('base1-4 se queda igual', idParaPokemontcg('base1-4') === 'base1-4')
  check('sv01-25 → sv1-25', idParaPokemontcg('sv01-25') === 'sv1-25', idParaPokemontcg('sv01-25'))
  check('sv03.5-1 → sv3pt5-1 (151)', idParaPokemontcg('sv03.5-1') === 'sv3pt5-1', idParaPokemontcg('sv03.5-1'))
  check('swsh3.5-1 → swsh35-1 (Champion’s Path)', idParaPokemontcg('swsh3.5-1') === 'swsh35-1', idParaPokemontcg('swsh3.5-1'))
  check('swsh12.5-1 → swsh12pt5-1 (Cénit Supremo)', idParaPokemontcg('swsh12.5-1') === 'swsh12pt5-1', idParaPokemontcg('swsh12.5-1'))
  check('swsh12.5gg-GG01 → swsh12pt5gg-GG01', idParaPokemontcg('swsh12.5gg-GG01') === 'swsh12pt5gg-GG01', idParaPokemontcg('swsh12.5gg-GG01'))
  check('me01-5 → me1-5', idParaPokemontcg('me01-5') === 'me1-5')
  check('swshp-SWSH001 (promos) se queda igual', idParaPokemontcg('swshp-SWSH001') === 'swshp-SWSH001')
  check('«025» → «25», «TG01» tal cual', numeroParaPokemontcg('025') === '25' && numeroParaPokemontcg('TG01') === 'TG01')
}

console.log('── 2. Las URLs ──')
{
  const u = urlPorCodigo('PRC', '150')
  check('por código y número, con los campos justos', /cards\?q=set\.ptcgoCode%3APRC%20number%3A150&select=id%2Cname%2Cnumber%2Ccardmarket|cards\?q=set\.ptcgoCode%3APRC(%20|\+)number%3A150/.test(u) && /select=id,name,number,cardmarket/.test(u), u)
  check('por id, traducido', urlPorId('sv03.5-1') === 'https://api.pokemontcg.io/v2/cards/sv3pt5-1?select=id,name,number,cardmarket', urlPorId('sv03.5-1'))
  check('su fecha «2024/03/15» → ISO', fechaDe('2024/03/15') === '2024-03-15T00:00:00.000Z', fechaDe('2024/03/15'))
  check('  …y una rara → null', fechaDe('ayer') === null)
}

// Lo que dice su documentación de `cardmarket` (no una respuesta real).
const CARDMARKET = {
  url: 'https://prices.pokemontcg.io/cardmarket/xy5-150',
  updatedAt: '2026/10/05',
  prices: { averageSellPrice: 180.5, lowPrice: 39, trendPrice: 196.68, germanProLow: 0, suggestedPrice: 0, reverseHoloSell: 0, reverseHoloLow: 0, reverseHoloTrend: 0, lowPriceExPlus: 60, avg1: 230, avg7: 144.25, avg30: 131.56, reverseHoloAvg1: 0, reverseHoloAvg7: 0, reverseHoloAvg30: 0 },
}
const RESPUESTA = { data: [{ id: 'xy5-150', name: 'Groudon-EX', number: '150', cardmarket: CARDMARKET }] }

console.log('── 3. De su bloque a nuestra fila ──')
{
  const ahora = new Date('2026-10-06T03:00:00Z')
  const f = filaDePokemontcg('xy5-150', CARDMARKET, ahora)
  check('la URL exacta', f.cm_url === 'https://prices.pokemontcg.io/cardmarket/xy5-150')
  check('las cifras en nuestras columnas', f.cm_low === 39 && f.cm_trend === 196.68 && f.cm_avg30 === 131.56 && f.cm_avg7 === 144.25, JSON.stringify(f))
  check('los ceros del reverso son «no hay», no cero', f.cm_low_holo === null && f.cm_trend_holo === null && f.cm_avg30_holo === null)
  check('la fecha suya y la nuestra', f.cm_updated === '2026-10-05T00:00:00.000Z' && f.checked_at === ahora.toISOString())
  check('con el origen apuntado', f.origen === 'pokemontcg')
  check('sin cifras ni URL, nada', filaDePokemontcg('x', { prices: {} }) === null && filaDePokemontcg('x', null) === null)
  check('solo la URL ya es una fila (sirve para el enlace)', filaDePokemontcg('x', { url: 'https://prices.pokemontcg.io/cardmarket/x' })?.cm_url === 'https://prices.pokemontcg.io/cardmarket/x')
  check('una URL que no es URL no se guarda', filaDePokemontcg('x', { url: 'javascript:alert(1)', prices: { trendPrice: 1 } }).cm_url === null)
  check('se elige el de NUESTRO número entre vecinos', elegirPorNumero([{ number: '15' }, { number: '150' }], '150')?.number === '150')
  check('  …y «025» casa con «25»', elegirPorNumero([{ number: '25' }], '025')?.number === '25')
}

console.log('── 4. Pedirlo: por código primero, por id después, y los fallos suben ──')
{
  const pedidas = []
  const fetchImpl = async (url, { headers }) => {
    pedidas.push({ url, clave: headers['X-Api-Key'] || null })
    if (/ptcgoCode%3APRC/.test(url)) return { ok: true, status: 200, json: async () => RESPUESTA }
    if (/cards\/xy5-150/.test(url)) return { ok: true, status: 200, json: async () => ({ data: RESPUESTA.data[0] }) }
    if (/ptcgoCode%3ANADA/.test(url)) return { ok: true, status: 200, json: async () => ({ data: [] }) }
    if (/cards\/sv3pt5-999/.test(url)) return { ok: false, status: 404, json: async () => ({}) }
    if (/cards\/tope/.test(url)) return { ok: false, status: 429, json: async () => ({}) }
    return { ok: false, status: 500, json: async () => ({}) }
  }
  const f = await precioDePokemontcg({ id: 'xy5-150', numero: '150', codigo: 'PRC' }, { fetchImpl, clave: 'k' })
  check('con código: una petición, por código, y la fila', pedidas.length === 1 && /ptcgoCode/.test(pedidas[0].url) && f?.cm_trend === 196.68, JSON.stringify(pedidas))
  check('  …con la clave en la cabecera', pedidas[0].clave === 'k')
  pedidas.length = 0
  const g = await precioDePokemontcg({ id: 'xy5-150', numero: '150', codigo: null }, { fetchImpl })
  check('sin código: por id', pedidas.length === 1 && /cards\/xy5-150/.test(pedidas[0].url) && g?.cm_url, JSON.stringify(pedidas))
  check('  …y sin clave no se manda cabecera', pedidas[0].clave === null)
  pedidas.length = 0
  const h = await precioDePokemontcg({ id: 'xy5-150', numero: '150', codigo: 'NADA' }, { fetchImpl })
  check('si el código no da nada, se prueba el id', pedidas.length === 2 && h?.cm_trend === 196.68, JSON.stringify(pedidas.map((p) => p.url)))
  const i = await precioDePokemontcg({ id: 'sv03.5-999', numero: '999', codigo: null }, { fetchImpl })
  check('un 404 es «no está»: null, sin lanzar', i === null)
  let error = null
  await precioDePokemontcg({ id: 'tope-1', numero: '1', codigo: null }, { fetchImpl }).catch((e) => { error = e })
  check('un 429 LANZA con su código, para que la pasada pare', error?.status === 429, String(error))
}

console.log('── 5. La migración y la función programada ──')
{
  const sql = readFileSync('/home/user/pingu/supabase-migration-precios-url.sql', 'utf8')
  check('la migración añade cm_url y origen', /add column if not exists cm_url text/.test(sql) && /add column if not exists origen text/.test(sql))
  const fn = readFileSync('/home/user/pingu/netlify/functions/precios-coleccion.mjs', 'utf8')
  check('la función programada usa el respaldo', /precioDePokemontcg/.test(fn))
  check('  …y para la pasada con un 429', /429/.test(fn))
  const cm = readFileSync('/home/user/pingu/js/cardmarket.js', 'utf8')
  check('el cliente lee cm_url', /cm_url/.test(cm))
}

console.log('── 6. La función programada, de punta a punta ──')
{
  const { procesar, igualarClaves } = await import('/home/user/pingu/netlify/functions/precios-coleccion.mjs')
  check('igualarClaves pone las claves que faltan a null', JSON.stringify(igualarClaves([{ a: 1 }, { a: 2, b: 3 }])) === '[{"a":1,"b":null},{"a":2,"b":3}]')
  const pedidas = []
  const cuerpos = []
  let fallarPorColumna = false
  const fetchImpl = async (url, opciones = {}) => {
    pedidas.push(url)
    const json = (datos, status = 200) => ({ ok: status < 300, status, json: async () => datos, text: async () => JSON.stringify(datos) })
    if (/rpc\/precios_pendientes/.test(url)) return json([{ card_id: 'sv8-1' }, { card_id: 'xy5-150' }])
    // TCGdex: la primera con precio, la segunda sin `pricing`.
    if (/api\.tcgdex\.net\/v2\/en\/cards\/sv8-1/.test(url)) return json({ id: 'sv8-1', pricing: { cardmarket: { idProduct: 111, low: 1, trend: 2, avg30: 1.5, updated: '2026-10-05' } } })
    if (/api\.tcgdex\.net\/v2\/en\/cards\/xy5-150/.test(url)) return json({ id: 'xy5-150' })
    // Nuestra base: el código y el número de las que se han quedado sin cifras.
    if (/rest\/v1\/tcg_cards\?select=id,local_id/.test(url)) return json([{ id: 'xy5-150', local_id: '150', tcg_sets: { tcg_online_code: 'PRC' } }])
    // pokemontcg.io, por código.
    if (/api\.pokemontcg\.io.*ptcgoCode%3APRC/.test(url)) return json(RESPUESTA)
    if (/rest\/v1\/tcg_card_prices$/.test(url)) {
      cuerpos.push(JSON.parse(opciones.body))
      if (fallarPorColumna && cuerpos.length === 1) return { ok: false, status: 400, text: async () => "Could not find the 'cm_url' column of 'tcg_card_prices' in the schema cache (PGRST204)" }
      return { ok: true, status: 201, text: async () => '' }
    }
    return json({ error: `inesperada ${url}` }, 500)
  }
  const r = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 's', POKEMONTCG_API_KEY: 'k' }, fetchImpl, pausa: 0 })
  check('la pasada va bien', r.ok === true && r.guardados === 2, JSON.stringify(r))
  check('  …y dice cuántas vinieron del respaldo', r.dePokemontcg === 1, JSON.stringify(r))
  check('solo se pregunta a pokemontcg por la que TCGdex no tenía', pedidas.filter((u) => /pokemontcg\.io/.test(u)).length === 1, pedidas.filter((u) => /pokemontcg/.test(u)).join(' | '))
  const filas = cuerpos[0]
  const tcgdex = filas.find((f) => f.card_id === 'sv8-1')
  const respaldo = filas.find((f) => f.card_id === 'xy5-150')
  check('la de TCGdex se guarda como siempre, con sus claves igualadas', tcgdex.cm_trend === 2 && tcgdex.cm_url === null && 'origen' in tcgdex, JSON.stringify(tcgdex))
  check('la del respaldo lleva cifras, URL exacta y origen', respaldo.cm_trend === 196.68 && respaldo.cm_url === 'https://prices.pokemontcg.io/cardmarket/xy5-150' && respaldo.origen === 'pokemontcg', JSON.stringify(respaldo))
  check('las dos filas tienen LAS MISMAS claves (PostgREST lo exige)', JSON.stringify(Object.keys(tcgdex).sort()) === JSON.stringify(Object.keys(respaldo).sort()))

  // Sin la migración puesta: se quitan las dos columnas y se vuelve a mandar.
  cuerpos.length = 0
  fallarPorColumna = true
  const r2 = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 's' }, fetchImpl, pausa: 0 })
  check('si la base no conoce cm_url, se reintenta sin las columnas nuevas', r2.ok === true && cuerpos.length === 2 && !('cm_url' in cuerpos[1][0]) && !('origen' in cuerpos[1][0]), JSON.stringify(cuerpos[1]?.[0]))

  // Un 429 corta el respaldo en esa pasada, sin tumbarla.
  const conTope = async (url, o) => (/pokemontcg\.io/.test(url) ? { ok: false, status: 429, json: async () => ({}), text: async () => 'tope' } : fetchImpl(url, o))
  fallarPorColumna = false
  const r3 = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 's' }, fetchImpl: conTope, pausa: 0 })
  check('con un 429 la pasada guarda lo de TCGdex y apunta el fallo', r3.guardados === 2 && r3.dePokemontcg === 0 && r3.fallos.some((f) => /429/.test(f.error)), JSON.stringify(r3))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
