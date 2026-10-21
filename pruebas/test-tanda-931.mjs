// Tanda 931: lo que diga TCGGO manda, en las versiones y en Black Bolt.
//
// PINGU: «tú siempre saca en todos los sets las variantes que diga TCGGO,
// ¿no?» — una carta de la que TCGGO da versiones y ninguna es la reverse ya
// no ofrece la «Reverse holo» de TCGdex (en Ascended Heroes las reverse SON
// los patrones). Y «de Black Bolt, simplemente tráete todo el set de nuevo,
// así lo traes bien y sin repetir»: una entrada de `REEMPLAZOS` que conserva
// lo que casa (sin perder el español), quita lo repetido y pone el número de
// TCGGO, con un freno para una lista a medias.
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const { variantesDeCarta } = await import(`${RAIZ}/js/mi-coleccion/variantes.js`)
const R = await import(`${RAIZ}/netlify/functions/tcggo-reemplazar-set.mjs`)

console.log('── 1. Las versiones de una carta: la reverse, la que diga TCGGO ──')
{
  const ids = (c) => variantesDeCarta(c).map((v) => v.nuestro).join()
  const base = { id: 'me2pt5-105', set_id: 'me2pt5', variants: { normal: true, reverse: true } }
  check('sin nada de TCGGO, lo de TCGdex: normal y reverse', ids(base) === 'normal,reverse', ids(base))
  const lunatone = { ...base, versiones: [{ etiqueta: 'Dusk Ball' }, { etiqueta: 'Energy Symbol Pattern' }] }
  check('con versiones de TCGGO y ninguna reverse (el Lunatone de Ascended Heroes): sin la «Reverse holo» de TCGdex', ids(lunatone) === 'normal,dusk-ball,energy-symbol-pattern', ids(lunatone))
  const spinarak = { ...base, versiones: [{ etiqueta: 'Reverse Holo' }] }
  check('con la reverse en TCGGO, se queda', ids(spinarak) === 'normal,reverse', ids(spinarak))
  const conBall = { ...base, versiones: [{ etiqueta: 'Reverse Holo' }, { etiqueta: 'Poké Ball' }] }
  check('  …y las demás detrás', ids(conBall) === 'normal,reverse,poke-ball', ids(conBall))
  const holo = { ...base, variants: { holo: true, reverse: true }, versiones: [{ etiqueta: 'Master Ball' }] }
  check('la holo de TCGdex no la toca (TCGGO la da como la carta misma)', ids(holo) === 'holo,master-ball', ids(holo))
}

console.log('\n── 2. Black Bolt en la lista de reemplazos ──')
{
  const e = R.REEMPLAZOS.find((x) => x.clave === 'sv10.5b-limpio')
  check('entra Black Bolt, sin el modo entero (que le quitaría el español)', e && e.destino === 'sv10.5b' && e.sets.join() === 'sv10.5b' && e.mercado === 'WEST' && !e.entero && e.conservarPorNumero && e.numerosDeTcggo, JSON.stringify(e))
  const n = R.numerosNuevos([{ id: 1, card_number: 60 }, { id: 2, card_number: 79 }, { id: 3, card_number: 'TG01' }], new Map([[1, { id: 'a', local_id: '060' }], [2, { id: 'b', local_id: '060' }], [3, { id: 'c', local_id: 'TG01' }]]))
  check('el número de TCGGO, solo donde el nuestro dice otro, y con sus ceros', [...n].join() === 'b,079', JSON.stringify([...n]))
}

// Un doble pequeño de la base y de TCGGO para `procesar`.
const montar = ({ cartas, lineas = [], sets }) => {
  const llamadas = []
  const guardadas = []
  const db = { cartas: cartas.map((c) => ({ ...c })), lineas: lineas.map((l) => ({ ...l })), sets: sets.map((s) => ({ ...s })) }
  return {
    llamadas, guardadas, db,
    restImpl: async (ruta, opciones = null) => {
      const r = decodeURIComponent(ruta)
      llamadas.push({ ruta: r, metodo: opciones?.method || 'GET', cuerpo: opciones?.body ? JSON.parse(opciones.body) : null })
      const ids = (k) => ((r.match(new RegExp(`${k}=in\\.\\(([^)]*)\\)`)) || [])[1] || '').split(',').map((x) => x.replace(/"/g, '')).filter(Boolean)
      if (!opciones || opciones.method === 'GET' || !opciones.method) {
        if (r.startsWith('tcg_sets?')) return db.sets.filter((s) => ids('id').includes(s.id))
        if (r.startsWith('tcg_cards?')) return db.cartas.filter((c) => ids('set_id').includes(c.set_id))
        if (r.startsWith('user_collection?')) return db.lineas.filter((l) => ids('card_id').includes(l.card_id))
        return []
      }
      if (opciones.method === 'POST' && r.startsWith('tcg_cards?on_conflict')) {
        for (const f of JSON.parse(opciones.body)) { const c = db.cartas.find((x) => x.id === f.id); if (c) Object.assign(c, f) }
      }
      if (opciones.method === 'PATCH' && r.startsWith('user_collection?')) { const id = r.match(/id=eq\.([^&]+)/)[1]; Object.assign(db.lineas.find((l) => l.id === id), JSON.parse(opciones.body)) }
      if (opciones.method === 'DELETE' && r.startsWith('tcg_cards?')) db.cartas = db.cartas.filter((c) => !ids('id').includes(c.id))
      if (opciones.method === 'DELETE' && r.startsWith('tcg_sets?')) { const id = r.match(/id=eq\.([^&]+)/)[1]; db.sets = db.sets.filter((s) => s.id !== id) }
      return null
    },
    guardarCartasImpl: async (filas) => {
      guardadas.push(...filas)
      // La RPC: inserta lo nuevo; en lo que existe NO toca set_id ni pisa name_en.
      for (const f of filas) {
        const c = db.cartas.find((x) => x.id === f.id)
        if (c) Object.assign(c, { tcggo_id: f.tcggo_id, cm_id_product_propio: c.cm_id_product_propio ?? f.cm_id_product, name_en: c.name_en ?? f.name_en })
        else db.cartas.push({ id: f.id, set_id: f.set_id, local_id: f.local_id, name: f.name, name_en: f.name_en, tcggo_id: f.tcggo_id, cm_id_product_propio: f.cm_id_product })
      }
      return filas.length
    },
  }
}
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }
const NUM = Array.from({ length: 10 }, (_, i) => i + 1)
const SUYAS = [
  ...NUM.map((n) => ({ id: n, name: `Poke ${n}`, card_number: n, cardmarket_id: 7000 + n, type: 'singles' })),
  { id: 600, name: 'Escavalier', card_number: 60, cardmarket_id: 7600, type: 'singles' },
  { id: 790, name: 'Antique Cover Fossil', card_number: 79, cardmarket_id: 7790, type: 'singles' },
]
const tcggo = (suyas) => async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: suyas, paging: { current: 1, total: 1 } }) })
const NUESTRAS = () => [
  ...NUM.map((n) => ({ id: `sv10.5b-${String(n).padStart(3, '0')}`, set_id: 'sv10.5b', local_id: String(n).padStart(3, '0'), name: `Poke ${n} es`, name_en: `Poke ${n}`, tcggo_id: null })),
  { id: 'sv10.5b-060', set_id: 'sv10.5b', local_id: '060', name: 'Escavalier', name_en: 'Escavalier', tcggo_id: 600 },
  // La repetida: otra Escavalier con el mismo número, de otra pasada.
  { id: 'tcggo-9060', set_id: 'sv10.5b', local_id: '60', name: 'Escavalier', name_en: 'Escavalier', tcggo_id: null, origen: 'tcggo' },
  // Y el Antique Cover Fossil con el 60.
  { id: 'sv10.5b-079', set_id: 'sv10.5b', local_id: '060', name: 'Fósil Cubierta Arcaica', name_en: 'Antique Cover Fossil', tcggo_id: 790 },
]

console.log('\n── 3. `procesar` con Black Bolt: sin repetidas y con su número ──')
{
  const b = montar({ sets: [{ id: 'sv10.5b', name: 'Black Bolt' }], cartas: NUESTRAS(), lineas: [{ id: 'l1', card_id: 'tcggo-9060', user_id: 'u1', cantidad: 2 }] })
  const r = await R.procesar({ env: ENV, fetchImpl: tcggo(SUYAS), ...b, sets: ['sv10.5b'], destino: 'sv10.5b', mercado: 'WEST', episodio: 555, conservarPorNumero: true, numerosDeTcggo: true, pausa: async () => {} })
  check('sale bien', r.ok, JSON.stringify(r).slice(0, 300))
  const ids = b.db.cartas.map((c) => c.id).sort()
  check('se conservan NUESTRAS cartas (con su español), y la repetida se va', ids.length === 12 && !ids.includes('tcggo-9060') && ids.includes('sv10.5b-001') && ids.includes('sv10.5b-060') && ids.includes('sv10.5b-079') && b.db.cartas.find((c) => c.id === 'sv10.5b-001').name === 'Poke 1 es', ids.join())
  const por = new Map()
  for (const c of b.db.cartas) { const k = String(Number(c.local_id)); por.set(k, (por.get(k) || 0) + 1) }
  check('ningún número repetido', [...por.values()].every((n) => n === 1), JSON.stringify([...por]))
  check('el Antique Cover Fossil, con el 079 de TCGGO', b.db.cartas.find((c) => c.id === 'sv10.5b-079')?.local_id === '079' && r.renumeradas === 1, JSON.stringify(b.db.cartas.find((c) => c.id === 'sv10.5b-079')))
  check('lo que alguien tenía de la repetida pasa a la buena', b.db.lineas[0].card_id === 'sv10.5b-060', JSON.stringify(b.db.lineas))
}

console.log('\n── 4. Una lista a medias no manda ──')
{
  const b = montar({ sets: [{ id: 'sv10.5b', name: 'Black Bolt' }], cartas: NUESTRAS() })
  const r = await R.procesar({ env: ENV, fetchImpl: tcggo(SUYAS.slice(0, 4)), ...b, sets: ['sv10.5b'], destino: 'sv10.5b', mercado: 'WEST', episodio: 555, conservarPorNumero: true, numerosDeTcggo: true, pausa: async () => {} })
  check('TCGGO da 4 de 11 números: no se toca nada', !r.ok && /a medias/.test(r.error || '') && b.guardadas.length === 0 && b.db.cartas.length === 13, JSON.stringify(r).slice(0, 200))
}

console.log('\n── 5. La pasada le pasa las opciones ──')
{
  let opciones = null
  const estados = { tcggo_reemplazos: { hechos: Object.fromEntries(R.REEMPLAZOS.filter((x) => x.clave !== 'sv10.5b-limpio').map((x) => [x.clave, { fecha: 'x' }])), intentos: {} } }
  const r = await R.pasada({
    env: ENV,
    restImpl: async (ruta) => (/^tcg_sets\?/.test(ruta) ? [{ id: 'sv10.5b', name: 'Black Bolt', tcggo_id: 555 }] : []),
    estadoImpl: async (k) => estados[k] || {},
    guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
    procesarImpl: async (o) => { opciones = o; return { ok: true, suyas: 12, renumeradas: 1 } },
  })
  check('Black Bolt, con su expansión de la fila y sus dos opciones', opciones?.destino === 'sv10.5b' && opciones.episodio === 555 && opciones.conservarPorNumero === true && opciones.numerosDeTcggo === true && opciones.entero === false, JSON.stringify(opciones))
  check('  …y queda hecho, con lo renumerado en el resumen', !!estados.tcggo_reemplazos?.hechos?.['sv10.5b-limpio'] && estados.tcggo_reemplazos.hechos['sv10.5b-limpio'].resumen.renumeradas === 1, JSON.stringify(estados.tcggo_reemplazos?.hechos?.['sv10.5b-limpio']))
}

console.log('\n── 6. En la web: la Reverse que TCGGO no da, salvo la que ya tienes ──')
{
  const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')
  const SETS = [{ id: 'me2pt5', name: 'Ascended Heroes', serie_id: 'me', market: 'WEST', release_date: '2026-01-30', card_count_official: 2, card_count_total: 2 }]
  const CARTAS = [1, 2].map((n) => ({ id: `me2pt5-${n}`, market: 'WEST', set_id: 'me2pt5', local_id: String(n), name: `Carta ${n}`, name_es: `Carta ${n}`, image_path: `me/me2pt5/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true, reverse: true }, tcg_sets: { id: 'me2pt5', name: 'Ascended Heroes', serie_id: 'me' } }))
  const VERSIONES = [1, 2].map((n) => ({ tcggo_id: 800 + n, market: 'WEST', card_id: `me2pt5-${n}`, set_id: 'me2pt5', etiqueta: 'Dusk Ball', cm_low: 1 }))
  // La 1 la apuntó alguien como Reverse antes de esta tanda.
  const COLECCION = [{ id: 'a', user_id: 'user-1', card_id: 'me2pt5-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'reverse', cantidad: 1 }]
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_COLECCION__: d.COLECCION, __FAKE_VERSIONES__: d.VERSIONES, __FAKE_PRECIOS__: [] })
  }, { SETS, CARTAS, COLECCION, VERSIONES })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=me2pt5`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('#mcAlbum [data-carta]').length > 0, null, { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1200)
  await page.click('#mcVistaVariantes')
  await page.waitForTimeout(500)
  const casillas = await page.evaluate(() => [...document.querySelectorAll('#mcAlbum .mc-bolsillo-enlace')].map((a) => `${a.dataset.carta.split('-')[1]}:${a.dataset.variante}:${a.closest('.mc-bolsillo').classList.contains('tengo') ? 'si' : 'no'}`).join(' '))
  check('separadas: la 2 sin Reverse; la 1 con la suya, que la tienes', casillas === '1:normal:no 1:dusk-ball:no 1:reverse:si 2:normal:no 2:dusk-ball:no', casillas)
  await page.click('#mcAlbum .mc-bolsillo-enlace[data-carta="me2pt5-1"][data-variante="reverse"]', { position: { x: 20, y: 60 } })
  await page.waitForTimeout(1200)
  const ficha = await page.evaluate(() => [...document.querySelectorAll('#mcEditor .mc-version')].map((v) => v.dataset.version).join())
  check('  …y en su ficha, tu Reverse entre las versiones', /reverse/.test(ficha) && /dusk-ball/.test(ficha), ficha)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await browser.close()
}

console.log('\n── 7. La sonda trae YA las versiones de una expansión (932) ──')
{
  const sonda = await import(`${RAIZ}/netlify/functions/tcggo-sonda.mjs`)
  const { sinVersionesRepetidas } = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
  const suyas = [
    { id: 31452, name: "Erika's Oddish", card_number: 1, cardmarket_id: 869612, variants: [{ type: 'energy_symbol_pattern', label: 'Energy Symbol Pattern', id: 50001, prices: { cardmarket: { lowest_near_mint: null } } }, { type: 'poke_ball', label: 'Poké Ball', id: 50002, prices: { cardmarket: { lowest_near_mint: 0.03 } } }] },
    { id: 31453, name: 'Gloom', card_number: 2, cardmarket_id: 869613, variants: [] },
  ]
  const guardadas = []
  const urls = []
  const r = await sonda.sondear({ modo: 'versiones', valor: 'me02.5' }, {
    env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k' },
    fetchImpl: async (u) => { urls.push(u); return { ok: true, status: 200, text: async () => JSON.stringify({ data: suyas, paging: { current: 1, total: 1 } }) } },
    pedir: async (ruta) => {
      if (/^tcg_cards/.test(ruta)) return [{ id: 'me02.5-001', set_id: 'me02.5', cm_id_product_propio: 869612, tcggo_id: null }, { id: 'me02.5-002', set_id: 'me02.5', cm_id_product_propio: 869613, tcggo_id: 31453 }]
      if (/select=tcggo_id/.test(ruta)) return [{ tcggo_id: 396 }]
      if (/^tcg_sets\?select=id&/.test(ruta)) return [{ id: 'me02.5' }]
      return []
    },
    guardarVersiones: async (f) => { guardadas.push(...f) },
  })
  check('del id de nuestro set saca su expansión y pide sus páginas con versiones', r.episodio === 396 && urls.length === 1 && /episode_id=396.*include_variants=1/.test(urls[0]), JSON.stringify(r))
  // Desde la 937 va también la fila «Standard» de cada carta mirada.
  check('  …y guarda las del Oddish de Erika colgando de NUESTRA carta', guardadas.filter((g) => g.etiqueta !== 'Standard').map((g) => `${g.card_id}:${g.etiqueta}`).join() === 'me02.5-001:Energy Symbol Pattern,me02.5-001:Poké Ball' && r.emparejadas === 2, JSON.stringify(guardadas))
  check('  …y la fila «Standard» de cada carta, con su id de TCGGO', guardadas.filter((g) => g.etiqueta === 'Standard').map((g) => g.card_id).sort().join() === 'me02.5-001,me02.5-002' && r.escritas === guardadas.length, JSON.stringify(guardadas.filter((g) => g.etiqueta === 'Standard')))
  check('sin set nuestro que apunte a esa expansión, lo dice y no pide nada', /Ningún set/.test((await sonda.sondear({ modo: 'versiones', valor: '999' }, { env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k' }, fetchImpl: async () => { throw new Error('no') }, pedir: async () => [] })).error || ''))
  check('una versión UNA vez por lote (si no, Postgres rechaza el lote entero)', sinVersionesRepetidas([{ tcggo_id: 1, card_id: 'a' }, { tcggo_id: 1, card_id: 'b' }, { tcggo_id: 2, card_id: 'a' }]).map((f) => `${f.tcggo_id}${f.card_id}`).join() === '1a,2a')
}

console.log(fails ? `\n✗ ${fails} fallos` : '\n✓ Todo bien')
process.exit(fails ? 1 : 0)
