// Tanda 882 — la Pokédex japonesa vacía: la especie sale también del inglés.
//
// PINGU: «en la Pokédex (japonés) ningún Pokémon está relleno, salen todos
// vacíos sin cartas». Las japonesas vienen de TCGGO (806) con `name` en
// japonés y `name_en` en inglés (811), `dex_ids` a null (la función que lo
// rellena era solo WEST, 483) y el respaldo por nombre no sabe leer
// 「フシギダネ」. Ahora `especiesPorNombres` prueba el inglés, la función
// programada pasa también por el japonés y la pantalla cae al inglés.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. Lo puro ──')
{
  const { especiesPorNombres } = await import(`${RAIZ}/js/pokedex-especies.js`)
  check('el nombre propio manda', JSON.stringify(especiesPorNombres('Pikachu ex', 'Bulbasaur')) === '[25]')
  check('si no casa (japonés), el inglés', JSON.stringify(especiesPorNombres('フシギダネ', null, 'Bulbasaur')) === '[1]')
  check('un Entrenador en los dos idiomas, nada', JSON.stringify(especiesPorNombres('博士の研究', "Professor's Research")) === '[]')
  check('sin nombres, nada y sin romper', JSON.stringify(especiesPorNombres(null, undefined, '')) === '[]')
  const { especiesDeLaCarta } = await import(`${RAIZ}/js/mi-coleccion/pokedex.js`)
  check('la pantalla: una japonesa de TCGGO sin `dex_ids` cae al inglés', JSON.stringify(especiesDeLaCarta({ name: 'フシギダネ', name_en: 'Bulbasaur', dex_ids: null })) === '[1]')
  check('  …y la columna sigue mandando', JSON.stringify(especiesDeLaCarta({ name: 'フシギダネ', name_en: 'Bulbasaur', dex_ids: [150] })) === '[150]')
}

console.log('\n── 2. La función programada pasa por el japonés ──')
{
  const { procesar } = await import(`${RAIZ}/netlify/functions/cartas-pokedex.mjs`)
  const porMercado = {
    WEST: [{ id: 'a1', name: 'Pikachu ex', name_en: null }],
    JP: [{ id: 'tcggo-1', name: 'フシギダネ', name_en: 'Bulbasaur' }, { id: 'tcggo-2', name: '博士の研究', name_en: "Professor's Research" }, { id: 'tcggo-3', name: 'ピカチュウ', name_en: null }],
  }
  const escrito = []
  const rutas = []
  const servidos = new Set()
  const falso = async (ruta, o) => {
    rutas.push(ruta)
    if (o) { escrito.push(...JSON.parse(o.body).p_filas); return null }
    const m = ruta.match(/market=eq\.([A-Z]+)/)
    if (!m || servidos.has(m[1])) return []
    servidos.add(m[1])
    return porMercado[m[1]] || []
  }
  const r = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'x' }, fetchImpl: falso })
  check('pide las dos colas: WEST y JP, con `name_en`', rutas.some((x) => /market=eq\.WEST/.test(x) && /name_en/.test(x)) && rutas.some((x) => /market=eq\.JP/.test(x) && /name_en/.test(x)), rutas.filter((x) => !x.startsWith('rpc')).join(' | '))
  check('mira las cuatro', r.ok && r.miradas === 4 && r.conPokemon === 2, JSON.stringify(r))
  const jp = escrito.filter((f) => f.market === 'JP')
  check('la japonesa con inglés lleva su especie; el Entrenador y la sin inglés, el centinela «{}»', JSON.stringify(jp.map((f) => [f.id, f.dex_ids])) === '[["tcggo-1",[1]],["tcggo-2",[]],["tcggo-3",[]]]', JSON.stringify(jp))
  check('  …y la occidental como siempre', JSON.stringify(escrito.find((f) => f.id === 'a1')) === '{"id":"a1","market":"WEST","dex_ids":[25]}')
  check('ninguna a null', escrito.every((f) => Array.isArray(f.dex_ids)))
}

console.log('\n── 3. En pantalla: la Pokédex japonesa con tu Bulbasaur de TCGGO ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_SETS__ = [{ id: 'sv1a', name: 'トリプレットビート', name_en: 'Triplet Beat', serie_id: 'sv', serie_name: 'SV', market: 'JP', card_count_official: 73, card_count_total: 73, release_date: '2023-03-10' }]
    window.__FAKE_CARTAS__ = [
      { id: 'tcggo-1', set_id: 'sv1a', local_id: '1', name: 'フシギダネ', name_en: 'Bulbasaur', market: 'JP', rarity: 'Common', category: 'Pokemon', variants: { normal: true }, dex_ids: null },
      { id: 'tcggo-2', set_id: 'sv1a', local_id: '2', name: 'ピカチュウ', name_en: 'Pikachu', market: 'JP', rarity: 'Common', category: 'Pokemon', variants: { normal: true }, dex_ids: null },
    ]
    // Con su dueño y su mercado: el doble siembra admin-1 y WEST por defecto.
    window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'user-1', market: 'JP', card_id: 'tcggo-1', cantidad: 1, idioma: 'ja', estado: 'NM', variante: 'normal', notas: null }]
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=pokedex&catalogo=JP`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const bulba = await page.$eval('.pdx-especie[data-dex="1"]', (b) => ({ tengo: b.classList.contains('tengo'), nombre: b.querySelector('.pdx-nombre')?.textContent, cuenta: b.querySelector('.pdx-cuenta')?.textContent })).catch(() => null)
  check('Bulbasaur sale RELLENO con tu carta japonesa', bulba?.tengo && bulba.nombre === 'Bulbasaur', JSON.stringify(bulba))
  const pika = await page.$eval('.pdx-especie[data-dex="25"]', (b) => b.classList.contains('tengo')).catch(() => null)
  check('  …y Pikachu, que no tienes, vacío', pika === false, String(pika))
  await browser.close()
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
