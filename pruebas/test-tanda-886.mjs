// Tanda 886 — rellenar desde Scrydex lo que TCGGO no lista de un set.
//
// PINGU: «VSTAR Universe: me metes el set de la API de TCGGO, pero ahí solo
// tiene a partir de la 173 y faltan todas las cartas básicas. Cógeme las de
// Scrydex, que ahí sí que están». Lo que se mira:
//   1. Lo puro: qué falta por NÚMERO (sin ceros, sin repetir), y de qué
//      expansión de Scrydex se tira (escrita, fila, lista).
//   2. La pasada: pide a Scrydex las cartas (3 páginas, 3 créditos), escribe
//      SOLO las que faltan con origen «relleno», no toca las de TCGGO, apunta
//      el scrydex_id al set y queda hecho; la siguiente pasada no pide nada;
//      un 402 para para siempre; a la tercera caída se deja.
//   3. El reemplazo de TCGGO no borra una carta «relleno», y sus líneas
//      de colección tampoco.
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const mod = await import(`${RAIZ}/netlify/functions/scrydex-rellenar-set.mjs`)
const copia = (x) => JSON.parse(JSON.stringify(x))

const SET = { id: 's12a', name: 'VSTARユニバース', name_en: 'VSTAR Universe', tcg_online_code: 'S12a', tcggo_id: 913, scrydex_id: null, release_date: '2022-12-02', card_count_total: 262, card_count_official: 172 }
const EXPANSIONES = [
  { id: 's12a_ja', name: 'VSTARユニバース', name_en: 'VSTAR Universe', code: 'S12a', total: 262, printed_total: 172, release_date: '2022/12/02' },
  { id: 's12_ja', name: 'パラダイムトリガー', name_en: 'Paradigm Trigger', code: 'S12', total: 98, printed_total: 98, release_date: '2022/10/21' },
]
// Lo nuestro: las de TCGGO de la 173 en adelante (y una «001» vieja con ceros).
const NUESTRAS = [
  ...Array.from({ length: 90 }, (_, i) => ({ id: `tcggo-${55000 + i}`, local_id: String(173 + i) })),
  { id: 'scrydex-s12a_ja-1', local_id: '001' },
]
// Las suyas: 262, en tres páginas.
const carta = (n) => ({ id: `s12a_ja-${n}`, name: `カード${n}`, number: String(n), printed_number: `${String(n).padStart(3, '0')}/172`, translation: { en: { name: `Card ${n}`, supertype: 'Pokémon', subtypes: ['Basic'], types: ['Grass'], rarity: 'Common' } }, national_pokedex_numbers: [n], artist: 'X', hp: '60', images: [{ type: 'front', small: `https://images.scrydex.com/pokemon/s12a_ja-${n}/small`, large: `https://images.scrydex.com/pokemon/s12a_ja-${n}/large` }] })
const SUYAS = Array.from({ length: 262 }, (_, i) => carta(i + 1))

console.log('── 1. Lo puro ──')
{
  const filas = SUYAS.map((c) => ({ local_id: c.number, name: c.name }))
  const faltan = mod.cartasQueFaltan(filas, NUESTRAS)
  check('faltan las 171 (de la 2 a la 172): ni las de TCGGO ni la «001» que ya está', faltan.length === 171 && faltan[0].local_id === '2' && faltan[faltan.length - 1].local_id === '172', `${faltan.length} · ${faltan[0]?.local_id}…${faltan[faltan.length - 1]?.local_id}`)
  check('  …y un número repetido en lo suyo entra una vez', mod.cartasQueFaltan([{ local_id: '5' }, { local_id: '05' }], []).length === 1)
  check('  …y sin número, no entra', mod.cartasQueFaltan([{ local_id: '' }, { local_id: null }], []).length === 0)
  check('la expansión escrita manda', mod.expansionDelRelleno({ scrydexId: 'x_ja' }, SET, EXPANSIONES).id === 'x_ja')
  check('  …si no, la de la fila', mod.expansionDelRelleno({}, { ...SET, scrydex_id: 's12_ja' }, EXPANSIONES).id === 's12_ja')
  check('  …si no, por el nombre inglés en la lista', mod.expansionDelRelleno({}, SET, EXPANSIONES).id === 's12a_ja' && mod.expansionDelRelleno({}, SET, EXPANSIONES).por === 'nombre')
  check('  …y sin nada que case, nada', mod.expansionDelRelleno({}, { id: 'zz', name: 'ZZ' }, EXPANSIONES).id === null)
}

console.log('\n── 2. La pasada ──')
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't' }
function montar({ estado = {}, decks = { lista: { fecha: '2026-10-18T06:00:00Z', expansiones: EXPANSIONES } }, scrydexStatus = 200, set = SET, nuestras = NUESTRAS, fallaEscribir = false } = {}) {
  const estados = { [mod.CLAVE_ESTADO]: copia(estado), [mod.CLAVE_DECKS]: copia(decks) }
  const llamadas = []
  const fetches = []
  const b = {
    env: ENV,
    estadoImpl: async (k) => copia(estados[k] || {}),
    guardarEstadoImpl: async (k, v) => { estados[k] = copia(v) },
    restImpl: async (ruta, opciones = null) => {
      llamadas.push({ ruta: decodeURIComponent(ruta), metodo: opciones?.method || 'GET', cuerpo: opciones?.body ? JSON.parse(opciones.body) : null })
      if (opciones) { if (fallaEscribir && ruta.startsWith('tcg_cards')) throw new Error('Supabase 500: boom'); return null }
      if (ruta.startsWith('tcg_sets?')) return set ? [copia(set)] : []
      if (ruta.startsWith('tcg_cards?')) return copia(nuestras)
      return []
    },
    fetchImpl: async (url) => {
      fetches.push(url)
      if (scrydexStatus !== 200) return { ok: false, status: scrydexStatus, text: async () => 'Payment Required' }
      const u = new URL(url)
      const pagina = Number(u.searchParams.get('page') || 1)
      let data = []
      if (u.pathname.endsWith('/ja/expansions')) data = EXPANSIONES.map((e) => ({ ...e, translation: { en: { name: e.name_en } } }))
      else if (u.pathname.endsWith('/ja/cards') && u.searchParams.get('q') === 'expansion.id:s12a_ja') data = SUYAS.slice((pagina - 1) * 100, pagina * 100)
      return { ok: true, status: 200, text: async () => JSON.stringify({ data, page: pagina, page_size: 100, total_count: SUYAS.length }) }
    },
    pausa: async () => {},
    ahora: new Date('2026-10-18T12:00:00Z'),
  }
  return { b, estados, llamadas, fetches, e: () => estados[mod.CLAVE_ESTADO] }
}
{
  const m = montar()
  const r = await mod.pasada(m.b)
  check('sale bien y queda hecho', r.ok && r.hecho?.estado === 'hecho', JSON.stringify(r).slice(0, 300))
  check('pide a Scrydex SOLO las cartas (la expansión sale de la lista de los decks, gratis): tres páginas, tres créditos', m.fetches.length === 3 && m.fetches.every((u) => /ja\/cards\?q=expansion\.id%3As12a_ja/.test(u)) && m.e().gasto.creditos === 3, m.fetches.join(' | '))
  const escritas = m.llamadas.filter((l) => l.metodo === 'POST' && l.ruta.startsWith('tcg_cards?on_conflict=id,market')).flatMap((l) => l.cuerpo)
  check('escribe las 171 que faltan y ninguna de las de TCGGO', escritas.length === 171 && !escritas.some((c) => Number(c.local_id) >= 173) && !escritas.some((c) => c.local_id === '1'), String(escritas.length))
  const una = escritas.find((c) => c.local_id === '25')
  check('  …con el id de Scrydex, el set nuestro, JP, nombre japonés e inglés, foto, Pokédex y origen «relleno»', una?.id === 'scrydex-s12a_ja-25' && una.set_id === 's12a' && una.market === 'JP' && una.name === 'カード25' && una.name_en === 'Card 25' && /s12a_ja-25/.test(una.image_scrydex || '') && una.dex_ids?.[0] === 25 && una.origen === 'relleno', JSON.stringify(una))
  check('  …ninguna columna obligatoria vacía', escritas.every((c) => c.local_id && c.name && c.set_id))
  check('  …en trozos de 200 como mucho', m.llamadas.filter((l) => l.metodo === 'POST' && l.ruta.startsWith('tcg_cards')).every((l) => l.cuerpo.length <= 200))
  const parche = m.llamadas.find((l) => l.metodo === 'PATCH' && l.ruta.startsWith('tcg_sets?'))
  check('el set queda apuntado a su expansión de Scrydex', parche?.cuerpo?.scrydex_id === 's12a_ja' && /id=eq\.s12a/.test(parche.ruta), JSON.stringify(parche))
  check('el estado cuenta: 262 suyas, 91 teníamos, 171 escritas, por nombre', m.e().hechos['s12a-jp-basicas']?.suyas === 262 && m.e().hechos['s12a-jp-basicas'].teniamos === 91 && m.e().hechos['s12a-jp-basicas'].escritas === 171 && m.e().hechos['s12a-jp-basicas'].por === 'nombre', JSON.stringify(m.e().hechos))
  // La pasada siguiente: nada que hacer, cero peticiones.
  const antes = m.fetches.length
  const r2 = await mod.pasada(m.b)
  check('la pasada siguiente no pide nada (hecho es hecho)', r2.ok && r2.saltado === 'nada pendiente' && m.fetches.length === antes, JSON.stringify(r2))
}
{
  // Con el scrydex_id ya en la fila no hace falta ni lista.
  const m = montar({ decks: {}, set: { ...SET, scrydex_id: 's12a_ja' } })
  const r = await mod.pasada(m.b)
  check('con scrydex_id en la fila no se pide la lista', r.ok && m.fetches.every((u) => /ja\/cards/.test(u)) && !m.llamadas.some((l) => l.metodo === 'PATCH' && l.ruta.startsWith('tcg_sets?')), m.fetches.join(' | '))
}
{
  // Sin lista guardada ni scrydex_id: se pide la suya (un crédito más).
  const m = montar({ decks: {} })
  const r = await mod.pasada(m.b)
  check('sin lista se pide la de Scrydex, y se casa por nombre', r.ok && /ja\/expansions/.test(m.fetches[0]) && m.e().hechos['s12a-jp-basicas']?.expansion === 's12a_ja' && m.e().gasto.creditos === 4, m.fetches.join(' | '))
}
{
  // Un 402: parada definitiva, y la siguiente no gasta.
  const m = montar({ scrydexStatus: 402 })
  const r = await mod.pasada(m.b)
  check('un 402 para la función para siempre', !r.ok && m.e().parado && /402/.test(m.e().parado.motivo), JSON.stringify(m.e().parado))
  const antes = m.fetches.length
  const r2 = await mod.pasada(m.b)
  check('  …y la pasada siguiente se sale sin pedir nada', r2.ok && /parado/.test(r2.saltado) && m.fetches.length === antes)
}
{
  // Nuestra base falla al escribir: cuenta como intento, y a la tercera se deja.
  const m = montar({ fallaEscribir: true })
  await mod.pasada(m.b)
  await mod.pasada(m.b)
  check('dos caídas de nuestra base: dos intentos, sin dar por hecho', m.e().intentos['s12a-jp-basicas'] === 2 && !m.e().hechos['s12a-jp-basicas'])
  const r3 = await mod.pasada(m.b)
  check('  …a la tercera se deja apuntado como parado (no se gasta para siempre)', !r3.ok && m.e().hechos['s12a-jp-basicas']?.estado === 'parado', JSON.stringify(m.e().hechos))
  const antes = m.fetches.length
  const r4 = await mod.pasada(m.b)
  check('  …y ya no pide más', r4.saltado === 'nada pendiente' && m.fetches.length === antes)
}
{
  const m = montar({ set: null })
  const r = await mod.pasada(m.b)
  check('sin el set en la base, se apunta y no se gasta', r.ok && m.e().hechos['s12a-jp-basicas']?.estado === 'sinSet' && m.fetches.length === 0)
  const sin = await mod.pasada({ ...montar().b, env: { SUPABASE_SERVICE_ROLE_KEY: 's' } })
  check('sin claves de Scrydex se salta diciéndolo', sin.ok && /SCRYDEX/.test(sin.saltado))
}

console.log('\n── 3. El reemplazo respeta el relleno ──')
{
  const { procesar } = await import(`${RAIZ}/netlify/functions/tcggo-reemplazar-set.mjs`)
  const db = {
    sets: [{ id: 's12a', market: 'JP', tcggo_id: 913 }],
    cartas: [
      { id: 'tcggo-55000', set_id: 's12a', local_id: '173', name: 'A', name_en: 'A', tcggo_id: 55000, origen: 'tcggo' },
      { id: 'scrydex-s12a_ja-25', set_id: 's12a', local_id: '25', name: 'カード25', name_en: 'Card 25', tcggo_id: null, origen: 'relleno' },
      { id: 'scrydex-s12a_ja-26', set_id: 's12a', local_id: '26', name: 'カード26', name_en: 'Card 26', tcggo_id: null, origen: 'scrydex' },
    ],
    lineas: [{ id: 'l1', card_id: 'scrydex-s12a_ja-25', user_id: 'u', cantidad: 1 }],
  }
  const restImpl = async (ruta, opciones = null) => {
    const r = decodeURIComponent(ruta)
    const ids = (k) => ((r.match(new RegExp(`${k}=in\\.\\(([^)]*)\\)`)) || [])[1] || '').split(',').map((x) => x.replace(/"/g, '')).filter(Boolean)
    if (!opciones || !opciones.method || opciones.method === 'GET') {
      if (r.startsWith('tcg_sets?')) return db.sets.filter((s) => ids('id').includes(s.id))
      if (r.startsWith('tcg_cards?')) return db.cartas.filter((c) => ids('set_id').includes(c.set_id))
      if (r.startsWith('user_collection?')) return db.lineas.filter((l) => ids('card_id').includes(l.card_id))
      return []
    }
    if (opciones.method === 'DELETE' && r.startsWith('user_collection?')) { const id = r.match(/id=eq\.([^&]+)/)[1]; db.lineas = db.lineas.filter((l) => l.id !== id) }
    if (opciones.method === 'DELETE' && r.startsWith('tcg_cards?')) db.cartas = db.cartas.filter((c) => !ids('id').includes(c.id))
    return null
  }
  const guardarCartasImpl = async (filas) => { for (const f of filas) if (!db.cartas.some((c) => c.id === f.id)) db.cartas.push({ ...f }); return filas.length }
  const SUYAS_TCGGO = [{ id: 55000, name: 'A', card_number: '173', cardmarket_id: 7001, type: 'singles' }]
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: SUYAS_TCGGO, paging: { current: 1, total: 1 } }) })
  const r = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }, fetchImpl, restImpl, guardarCartasImpl, sets: ['s12a'], destino: 's12a', mercado: 'JP', episodio: 913, entero: true, recolocarPorNumero: true, borrarSinDestino: true, mismaExpansion: true, pausa: async () => {} })
  check('el reemplazo entero con borrado sale bien', r.ok, JSON.stringify(r).slice(0, 200))
  check('la carta «relleno» se queda', db.cartas.some((c) => c.id === 'scrydex-s12a_ja-25'), db.cartas.map((c) => c.id).join())
  check('  …con su motivo', (r.seQuedan || []).some((q) => q.id === 'scrydex-s12a_ja-25' && /Scrydex/.test(q.motivo)), JSON.stringify(r.seQuedan))
  check('  …y su línea de colección también', db.lineas.some((l) => l.id === 'l1'))
  check('la vieja de Scrydex a secas (origen «scrydex») sí se va, como en la 806', !db.cartas.some((c) => c.id === 'scrydex-s12a_ja-26'))
}

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
