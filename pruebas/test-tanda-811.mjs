// Tanda 811 — el nombre inglés de las cartas japonesas de TCGGO.
//
// PINGU, con el Tropius de Abyss Eye (M5 001/081): «sigue en japonés». El
// catálogo japonés de TCGGO da `name` en japonés y se copiaba tal cual como
// `name_en`; la web enseña el inglés cuando el nombre es CJK, y no había.
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const lib = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
const { procesar } = await import(`${RAIZ}/netlify/functions/tcggo-reemplazar-set.mjs`)
const calco = await import(`${RAIZ}/netlify/functions/tcggo-calco-jp.mjs`)
const { nombreDeCarta } = await import(`${RAIZ}/js/catalogo-series.js`)

console.log('── 1. Lo puro ──')
{
  check('del slug: «tropius» → Tropius', lib.nombreDeSlug('tropius') === 'Tropius')
  check('  …«mega-charizard-x-ex» → Mega Charizard X ex', lib.nombreDeSlug('mega-charizard-x-ex') === 'Mega Charizard X ex', lib.nombreDeSlug('mega-charizard-x-ex'))
  check("  …«team-rocket-s-mewtwo-ex» → Team Rocket's Mewtwo ex", lib.nombreDeSlug('team-rocket-s-mewtwo-ex') === "Team Rocket's Mewtwo ex", lib.nombreDeSlug('team-rocket-s-mewtwo-ex'))
  check('  …un slug que no es latino no da nombre', lib.nombreDeSlug('トロピウス') === null)
  const jp = { id: 900001, name: 'トロピウス', slug: 'tropius', card_number: '001', type: 'singles' }
  check('nombre en japonés + slug: el inglés sale del slug', lib.nombreInglesDe(jp) === 'Tropius')
  check('  …un campo inglés explícito manda sobre el slug', lib.nombreInglesDe({ ...jp, name_en: 'Tropius ex' }) === 'Tropius ex')
  check('  …y una carta occidental se queda con su nombre', lib.nombreInglesDe({ name: 'Snorlax', slug: 'snorlax-20' }) === 'Snorlax')
  check('  …sin nada latino, null (un inglés en japonés no es un inglés)', lib.nombreInglesDe({ name: 'トロピウス' }) === null)
  const fila = lib.filaDeCartaTcggo(jp, { setId: 'm5_ja' })
  check('la fila nueva: name en japonés, name_en en inglés', fila.name === 'トロピウス' && fila.name_en === 'Tropius', JSON.stringify(fila))
  check('  …y la web la enseña en inglés', nombreDeCarta(fila) === 'Tropius', nombreDeCarta(fila))
  const m = lib.muestraDeCarta(jp)
  check('la muestra para /admin dice cómo llega', m.name === 'トロピウス' && m.slug === 'tropius' && m.ingles === 'Tropius' && m.campos.includes('slug'))
}

console.log('\n── 2. El reemplazo entero pisa el inglés japonés de antes ──')
{
  // La «tcggo-900001» ya existía con el japonés copiado como inglés: la RPC
  // no pisa un name_en que ya hay, así que lo tiene que corregir el ajuste.
  const posts = []
  const restImpl = async (ruta, o = null) => {
    const r = decodeURIComponent(ruta)
    if (o?.method === 'POST' && r.startsWith('tcg_cards?on_conflict')) { posts.push(...JSON.parse(o.body)); return null }
    if (o) return null
    if (r.startsWith('tcg_sets?')) return [{ id: 'm5_ja', name: 'アビスアイ', name_en: null, tcggo_id: 1200 }]
    if (r.startsWith('tcg_cards?')) return [{ id: 'tcggo-900001', set_id: 'm5_ja', local_id: '001', name: 'トロピウス', name_en: 'トロピウス', tcggo_id: 900001 }]
    return []
  }
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 900001, name: 'トロピウス', slug: 'tropius', card_number: '001', cardmarket_id: 880001, type: 'singles' }], paging: { current: 1, total: 1 } }) })
  const r = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }, fetchImpl, restImpl, guardarCartasImpl: async (f) => f.length, sets: ['m5_ja'], destino: 'm5_ja', mercado: 'JP', episodio: 1200, entero: true, recolocarPorNumero: true, borrarSinDestino: false, mismaExpansion: true, pausa: async () => {} })
  const ajuste = posts.find((p) => p.id === 'tcggo-900001')
  check('se escribe el inglés nuevo encima del japonés', r.ok && ajuste?.name_en === 'Tropius' && ajuste?.name === 'トロピウス' && ajuste?.local_id === '001', JSON.stringify({ ok: r.ok, err: r.error, ajuste }))
  check('  …y vuelve la muestra de la carta', r.muestra?.slug === 'tropius')
}

console.log('\n── 3. El calco: otra vuelta, Abyss Eye por su código ──')
{
  check('la vuelta 4 rehace el japonés entero con el nombre bueno', calco.VUELTA === 4)
  check('Abyss Eye se reconoce también por «M5»', calco.esPrimero({ nombre: 'Otro nombre', codigo: 'M5' }) && calco.esPrimero({ nombre: 'Abyss Eye', codigo: null }) && !calco.esPrimero({ nombre: 'Mega Brave', codigo: 'M1L' }))
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
