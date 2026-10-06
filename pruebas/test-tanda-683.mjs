// Tanda 683 — la sonda de orígenes: sus ayudantes puros, con fixtures de
// verdad (las expansiones y las cartas de TCGGO pegadas byte a byte), y la
// sonda entera con una red de mentira que dice qué contestó cada sitio.
import { readFileSync } from 'node:fs'
import { masAntiguas, episodioDelSet, cartasQueCasan, resumirCartaTcggo, resumirTcgdex, sondear } from '/home/user/pingu/netlify/functions/sonda-origenes.mjs'
import { resumirEpisodio } from '/home/user/pingu/netlify/lib/tcggo.mjs'

let fails = 0
const check = (n, ok, extra = '') => { console.log(`  ${ok ? 'ok ' : 'FALLA'} ${n}${!ok && extra ? ` — ${extra}` : ''}`); if (!ok) fails++ }
const F = (f) => JSON.parse(readFileSync(`/tmp/wt-pruebas/pruebas/fixtures/${f}`, 'utf8'))

console.log('── 1. Las más antiguas ──')
{
  const lista = F('tcggo-episodios-ejemplo.json').data.map(resumirEpisodio)
  const r = masAntiguas(lista, 3)
  check('cuenta y ordena por fecha', r.total === 20 && r.primeras.length === 3 && r.primeras[0].fecha === '2024-01-26' && r.primeras[0].nombre === 'Paldean Fates', JSON.stringify(r.primeras[0]))
  check('  …y la más nueva es la última', r.ultima?.nombre === 'Delta Reign')
  check('  …sin fecha cuenta aparte', masAntiguas([...lista, { id: 1, nombre: 'X', fecha: null }]).sinFecha === 1)
}

console.log('── 2. La expansión de nuestro set ──')
{
  const lista = F('tcggo-episodios-ejemplo.json').data.map(resumirEpisodio)
  check('por tcggo_id primero', episodioDelSet({ tcggo_id: 415, name: 'Otra cosa' }, lista).por === 'tcggo_id')
  check('por nombre inglés', episodioDelSet({ name: 'Pitch Black' }, lista).episodio?.id === 415)
  check('por código si el nombre no casa', episodioDelSet({ name: 'Negro Tono', tcg_online_code: 'PBL' }, lista).por === 'código')
  check('sin nada, candidatas vacías y sin episodio', episodioDelSet({ name: 'Base Set', tcg_online_code: 'BS' }, lista).episodio === null)
}

console.log('── 3. La carta dentro ──')
{
  const cartas = F('tcggo-cards-ejemplo.json').data
  const r = cartasQueCasan(cartas, { numero: '1', nombre: 'Tropius' })
  check('por número', r.porNumero.length >= 1 && r.porNumero[0].nombre === 'Tropius', JSON.stringify(r.porNumero[0]))
  check('  …con sus idiomas de Cardmarket y su id', r.porNumero[0].cmIdiomas.includes('ES') && r.porNumero[0].cardmarketId === 895789, JSON.stringify(r.porNumero[0]))
  check('por nombre también', r.porNombre.length >= 1)
  check('un sobre no casa por número', cartasQueCasan([{ type: 'sealed', card_number: 1, name: 'Booster' }], { numero: '1', nombre: '' }).porNumero.length === 0)
  check('resumirTcgdex cuenta ataques e imagen', JSON.stringify(resumirTcgdex({ id: 'base1-4', name: 'Charizard', image: 'https://x', attacks: [{}, {}], set: { id: 'base1', name: 'Base Set' } })) === JSON.stringify({ id: 'base1-4', nombre: 'Charizard', set: 'Base Set', setId: 'base1', imagen: 'https://x', ataques: 2, rareza: null, ilustrador: null, variantes: null, precioCardmarket: 0 }))
}

console.log('── 4. La sonda entera, con red de mentira ──')
{
  const episodios = F('tcggo-episodios-ejemplo.json')
  const cartas = F('tcggo-cards-ejemplo.json')
  const pedidas = []
  const fetchImpl = async (url) => {
    pedidas.push(url)
    const r = (status, cuerpo) => ({ ok: status < 400, status, text: async () => (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)) })
    if (url.includes('/rest/v1/tcg_cards')) return r(200, [{ id: 'pbl-1', set_id: 'pbl', market: 'WEST', local_id: '1', name: 'Tropius', image_path: 'me/pbl/1', tcg_sets: { id: 'pbl', name: 'Pitch Black', name_en: 'Pitch Black', tcg_online_code: 'PBL', tcggo_id: null } }])
    if (url.includes('/rest/v1/tcg_card_prices')) return r(200, [{ card_id: 'pbl-1', cm_low: 0.02, cm_low_es: 0.02, origen: 'tcggo', nada: null }])
    if (url.includes('api.tcgdex.net/v2/en/cards/')) return r(200, { id: 'pbl-1', name: 'Tropius', image: 'https://assets.tcgdex.net/en/me/pbl/1', attacks: [{}] })
    if (url.includes('api.tcgdex.net/v2/es/cards/')) return r(404, 'Not found')
    if (url.includes('api.tcgdex.net/v2/en/sets/')) return r(200, { id: 'pbl', name: 'Pitch Black', cards: [{ image: 'x' }, {}] })
    if (url.includes('/episodes?page=')) return r(200, { ...episodios, paging: { current: 1, total: 1 } })
    if (url.includes('/cards?episode_id=')) return r(200, { ...cartas, paging: { current: 1, total: 1 } })
    if (url.includes('/cards?search=')) return r(200, { data: [cartas.data[0]] })
    if (url.includes('/cards?name=')) return r(400, 'Bad request')
    if (url.includes('api.scrydex.com')) return r(403, '{"error":"subscription expired"}')
    return r(500, 'ruta no prevista: ' + url)
  }
  const env = { SUPABASE_SERVICE_ROLE_KEY: 'k', TCGGO_API_KEY: 't', SCRYDEX_API_KEY: 's', SCRYDEX_TEAM_ID: 'e' }
  const r = await sondear({ id: 'pbl-1', mercado: 'WEST', env, fetchImpl })
  check('lo nuestro, resumido', r.nuestra?.nombre === 'Tropius' && r.nuestra.precio?.cm_low === 0.02 && !('nada' in (r.nuestra.precio || {})), JSON.stringify(r.nuestra))
  check('TCGdex: inglés con imagen, español 404, set con 1 de 2 imágenes', r.tcgdex.carta_en?.imagen && r.tcgdex.carta_es?.status === 404 && r.tcgdex.set?.conImagen === 1, JSON.stringify(r.tcgdex))
  check('TCGGO: las dos listas de expansiones', r.tcggo.expansiones_WEST?.total === 20 && r.tcggo.expansiones_JP?.total === 20)
  check('  …la expansión del set por nombre', r.tcggo.expansionDelSet?.por === 'nombre' && r.tcggo.expansionDelSet.id === 415, JSON.stringify(r.tcggo.expansionDelSet))
  check('  …y la carta dentro, por número', r.tcggo.laCarta?.porNumero?.[0]?.nombre === 'Tropius')
  check('  …y dice qué búsqueda contesta', r.tcggo.busqueda?.search?.resultados === 1 && r.tcggo.busqueda?.name?.status === 400, JSON.stringify(r.tcggo.busqueda))
  check('Scrydex: el 403 es una respuesta, no un error', r.scrydex.carta?.status === 403 && /expired/.test(r.scrydex.carta.texto))
  check('cuenta las peticiones', r.peticiones.tcggo === 5 && r.peticiones.tcgdex === 3 && r.peticiones.scrydex === 2, JSON.stringify(r.peticiones))
  check('sin TCGGO_API_KEY se salta TCGGO y lo dice', (await sondear({ id: 'pbl-1', env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, fetchImpl })).tcggo.saltado === 'falta TCGGO_API_KEY')
  check('nada va a una ruta no prevista', !pedidas.some((u) => u.includes('no prevista')))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
