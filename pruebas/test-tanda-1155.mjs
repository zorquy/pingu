// Tanda 1155 — de «Cuatro pantallas que se pueden aprovechar mejor» (ronda 7):
//   E2 · El constructor vacío con tres caminos (copiar un mazo del meta con los
//        tres más jugados, importar una lista, buscar cartas) y sin los iconos
//        que no hacen nada con 0 cartas (probar, compartir, deshacer sin nada).
//        Con la primera carta, todo como siempre.
//   E3 · El Panel de Mi colección en dos columnas desde 1.100 px (1155 →
//        1174). Desde la 1177 es una pila de FILAS: la cartera, la fila de
//        reojo (Movimientos, Tus alertas, Cambios, Tu mes: dos y dos, o
//        cuatro desde 1.800 px) y las tiras a lo ancho. En el móvil, una
//        columna como siempre.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const browser = await chromium.launch()

console.log('── E2 · El constructor vacío ──')
for (const movil of [false, true]) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1366, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'none'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    window.__RPC_RESPUESTAS__ = { meta_resumen: [{ arquetipo: 'charizard-ex', nombre: 'Charizard ex' }, { arquetipo: 'gardevoir-ex', nombre: 'Gardevoir ex' }, { arquetipo: 'dragapult-ex', nombre: 'Dragapult ex' }, { arquetipo: 'raging-bolt-ex', nombre: 'Raging Bolt ex' }] }
    window.__FAKE_SETS__ = [
    { id: 'sv04.5', name: 'Destinos de Paldea', market: 'WEST', tcg_online_code: 'PAF', release_date: '2024-01-26', card_count_official: 91, serie_id: 'sv', serie_name: 'Escarlata y Púrpura' },
    { id: 'sv06', name: 'Mascarada Crepuscular', market: 'WEST', tcg_online_code: 'TWM', release_date: '2024-05-24', card_count_official: 167, serie_id: 'sv', serie_name: 'Escarlata y Púrpura' },
    // El más nuevo con código y >20 cartas: es el que el buscador
    // preselecciona al entrar, y aquí vive la Prisma.
    { id: 'me02x', name: 'Héroes Ascendidos', market: 'WEST', tcg_online_code: 'ASC', release_date: '2026-05-01', card_count_official: 100, serie_id: 'me', serie_name: 'Mega Evolución' },
    { id: 'mee', name: 'Energías Mega Evolución', market: 'WEST', tcg_online_code: 'MEE', release_date: '2025-08-01', card_count_official: 16, serie_id: 'me', serie_name: 'Mega Evolución' },
  ]
  window.__FAKE_CARTAS__ = [
    // Dos impresiones del MISMO Pokémon: el límite de 4 va por nombre.
    { id: 'sv06-130', set_id: 'sv06', market: 'WEST', local_id: '130', name: 'Teal Mask Ogerpon ex', name_es: 'Ogerpon ex Máscara Turquesa', name_key: 'teal mask ogerpon ex', name_search: 'teal mask ogerpon ex ogerpon ex mascara turquesa', category: 'Pokemon', stage: 'Basic', regulation_mark: 'H', image_path: 'sv/sv06/130', types: ['Grass'], hp: 210 },
    { id: 'sv06-25', set_id: 'sv06', market: 'WEST', local_id: '25', name: 'Teal Mask Ogerpon ex', name_es: 'Ogerpon ex Máscara Turquesa', name_key: 'teal mask ogerpon ex', name_search: 'teal mask ogerpon ex ogerpon ex mascara turquesa', category: 'Pokemon', stage: 'Basic', regulation_mark: 'H', image_path: 'sv/sv06/25', types: ['Grass'], hp: 210 },
    { id: 'sv04.5-7', set_id: 'sv04.5', market: 'WEST', local_id: '7', name: 'Charmander', name_es: 'Charmander', name_key: 'charmander', name_search: 'charmander', category: 'Pokemon', stage: 'Basic', regulation_mark: 'H', image_path: 'sv/sv04.5/7', types: ['Fire'], hp: 70 },
    // La Prisma tal cual está HOY en el espejo: energy_type «Básico»
    // (tanda 357, el dato viene mal de TCGdex). Es ESPECIAL.
    { id: 'me02x-99', set_id: 'me02x', market: 'WEST', local_id: '99', name: 'Prism Energy', name_es: 'Energía Prisma', name_key: 'prism energy', name_search: 'prism energy energia prisma', category: 'Energy', energy_type: 'Básico', regulation_mark: 'J', image_path: 'me/me02x/99' },
    { id: 'mee-002', set_id: 'mee', market: 'WEST', local_id: '2', name: 'Fire Energy', name_es: 'Energía Fuego', name_key: 'fire energy', name_search: 'fire energy energia fuego', category: 'Energy', energy_type: 'Básico', regulation_mark: null, image_path: null },
  ]
  })
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/constructor.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  const que = movil ? 'móvil' : 'PC'
  const vacio = await page.evaluate(() => {
    const ve = (sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0 }
    return {
      caminos: [...document.querySelectorAll('#cmVacio .cm-camino')].map((c) => c.querySelector('b')?.textContent),
      chips: [...document.querySelectorAll('#cmMetaChips a')].map((a) => `${a.textContent}|${a.getAttribute('href')}`),
      probar: ve('#cmProbar'), compartir: ve('#cmBtnCompartir'), deshacer: ve('#cmDeshacer'), guardar: ve('#cmGuardar'),
      iconos: document.querySelectorAll('#cmVacio .cm-camino-icono svg').length,
    }
  })
  check(`${que}: con el mazo vacío, tres caminos`, vacio.caminos.join('|') === 'Copiar un mazo del meta|Importar una lista|Buscar cartas' && vacio.iconos === 3, JSON.stringify(vacio))
  check('  …con los tres mazos más jugados del meta como chips a su ficha', vacio.chips.join(',') === 'Charizard ex|/meta/charizard-ex,Gardevoir ex|/meta/gardevoir-ex,Dragapult ex|/meta/dragapult-ex', vacio.chips.join(','))
  check('  …y sin Probar, Compartir ni Deshacer (Guardar sí)', !vacio.probar && !vacio.compartir && !vacio.deshacer && vacio.guardar, JSON.stringify(vacio))
  await page.click('#cmVacioBuscar')
  await page.waitForTimeout(400)
  check('  …«Buscar cartas» pone el cursor en el buscador', await page.evaluate(() => document.activeElement?.id === 'cmTexto'))
  await page.selectOption('#cmCategoria', '').catch(() => {})
  await page.waitForTimeout(300)
  await page.selectOption('#cmSet', '').catch(() => {})
  await page.fill('#cmTexto', 'ogerpon')
  await page.locator('#cmFormBuscar button[type="submit"]').click()
  await page.waitForTimeout(800)
  await page.waitForSelector('.cm-resultado[data-id="sv06-130"]', { timeout: 5000 }).catch(() => {})
  await page.click('.cm-resultado[data-id="sv06-130"] [data-anadir]').catch(() => {})
  await page.waitForTimeout(600)
  if (movil) { await page.click('[data-vista="mazo"]').catch(() => {}); await page.waitForTimeout(400) }
  const lleno = await page.evaluate(() => {
    const ve = (sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0 }
    return { vacio: ve('#cmVacio'), probar: ve('#cmProbar'), compartir: ve('#cmBtnCompartir'), deshacer: ve('#cmDeshacer') }
  })
  check('  …con la primera carta, todo como siempre', !lleno.vacio && lleno.probar && lleno.compartir && lleno.deshacer, JSON.stringify(lleno))
  check(`${que}: sin errores`, !err.length, err.join(' | '))
  await ctx.close()
}

console.log('── E3 · El Panel ──')
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191, card_count_total: 252 }, { id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, card_count_total: 207 }]
const nombres = ['Pikachu ex', 'Charizard ex', 'Mew ex', 'Greninja', 'Zapdos ex', 'Alakazam', 'Gengar', 'Raichu', 'Snorlax', 'Eevee', 'Dragonite', 'Gyarados']
const CARTAS = nombres.map((n, i) => ({ id: `${i < 6 ? 'sv8' : 'sv3pt5'}-${i + 1}`, market: 'WEST', set_id: i < 6 ? 'sv8' : 'sv3pt5', local_id: String(i + 1), name: n, name_es: n, image_path: `x/${i}`, rarity: 'Rare', category: 'Pokemon', dex_ids: [25 + i], tcg_sets: { id: i < 6 ? 'sv8' : 'sv3pt5', name: i < 6 ? 'Chispas Fulgurantes' : '151', serie_id: 'sv' } }))
const precio = (i) => [182, 96.5, 44, 12.3, 30, 7.2, 3.1, 1.5, 0.9, 22, 15, 5][i]
const PRECIOS = CARTAS.map((c, i) => ({ card_id: c.id, cm_low: precio(i), cm_low_es: precio(i), checked_at: '2026-10-19T10:00:00Z' }))
const COLECCION = CARTAS.map((c, i) => ({ id: `l${i}`, user_id: 'admin-1', card_id: c.id, market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 + (i % 3), created_at: `2026-10-${String(1 + i).padStart(2, '0')}T10:00:00Z` }))
// El histórico se mira desde HOY menos ocho días: con una fecha fija la
// prueba caducaba sola (la 925 se puso roja al pasar la semana).
const hoy = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
const VALOR = Array.from({ length: 30 }, (_, d) => ({ user_id: 'admin-1', dia: new Date(hoy - d * 864e5).toISOString().slice(0, 10), valor: 610 - d * 3 + (d % 4) * 5 }))
const HIST = []
CARTAS.forEach((c, i) => { for (let d = 0; d < 9; d++) { const v = precio(i) * (1 + (i % 2 ? -1 : 1) * 0.02 * d * (i < 3 ? 1 : 0.3)); HIST.push({ card_id: c.id, dia: new Date(hoy - d * 864e5).toISOString().slice(0, 10), cm_low: v, cm_low_es: v, origen: 'tcggo' }) } })
for (const [ancho, dos] of [[1366, true], [1024, false]]) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_PRECIOS__: d.PRECIOS, __FAKE_COLECCION__: d.COLECCION, __FAKE_DESEOS__: [], __FAKE_VALOR__: d.VALOR, __FAKE_HISTORIAL__: d.HIST, __FAKE_PERFILES__: [{ id: 'admin-1', username: 'pingu' }] })
  }, { SETS, CARTAS, PRECIOS, COLECCION, VALOR, HIST })
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)
  const m = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect()
    const v = r('#mcValorCaja'), mv = r(innerWidth >= 1100 ? '#mcMovidas' : '#mcReojoMovidas'), va = r('#mcValiosas'), al = r('#mcAlertas'), ca = r('#mcCambios'), me = r('#mcMes'), lado = r('.mc-cartera-lado')
    const caja = (e) => e && [Math.round(e.left), Math.round(e.top), Math.round(e.width), Math.round(e.bottom)]
    return { v: v && [Math.round(v.left), Math.round(v.top), Math.round(v.right), Math.round(v.bottom)], mv: mv && [Math.round(mv.left), Math.round(mv.top), Math.round(mv.width)], va: va && [Math.round(va.left), Math.round(va.top)], al: caja(al), ca: caja(ca), me: caja(me), lado: caja(lado), fichaMes: document.querySelector('#mcCarteraMes b')?.textContent, ancho: document.documentElement.scrollWidth <= innerWidth }
  })
  if (dos) {
    check(`${ancho} px: la cartera a lo ancho, y «Movimientos» DEBAJO, a la izquierda (1177)`, m.v && m.mv && m.mv[1] >= m.v[3] && Math.abs(m.mv[0] - m.v[0]) < 4 && m.mv[2] < (m.v[2] - m.v[0]) * 0.6, JSON.stringify(m))
    // Sin alertas en este fixture, la fila de reojo son tres: Movimientos y
    // Cambios arriba, Tu mes debajo a la izquierda (dos y dos a este ancho).
    check('  …con «Cambios» a su derecha, a la misma altura', m.ca && m.ca[0] > m.mv[0] + m.mv[2] - 4 && Math.abs(m.ca[1] - m.mv[1]) < 4, JSON.stringify(m.ca))
    check('  …y Tu mes en la fila siguiente, a la izquierda', m.me && m.me[1] >= m.ca[3] - 4 && Math.abs(m.me[0] - m.mv[0]) < 4, JSON.stringify(m.me))
    check('  …y «Ranking» a lo ancho, debajo de la fila de reojo', m.va && Math.abs(m.va[0] - m.v[0]) < 4 && m.va[1] >= m.me[3] - 4, JSON.stringify(m.va))
    check('  …y el lado de la cartera (este mes, esta semana, lo pagado) a la derecha de la gráfica, con su cifra', m.lado && m.lado[0] > m.v[0] + 400 && m.lado[1] < m.v[1] + 40 && /€/.test(m.fichaMes || ''), JSON.stringify([m.lado, m.fichaMes]))
  } else {
    check(`${ancho} px: una columna, con la tarjeta de Movimientos (1178) bajo la cartera`, m.v && m.mv && m.mv[1] > m.v[1] + 100 && Math.abs(m.mv[0] - m.v[0]) < 4, JSON.stringify(m))
  }
  check(`${ancho} px: la página no se sale y sin errores`, m.ancho && !err.length, err.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
