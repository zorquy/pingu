// Tanda 1033 — Deseos y cambios: el Modo evento a mano en las tres vistas,
// tres cartas por fila en el móvil (antes dos) y el occidental y el japonés
// separados con su rótulo (en La quiero, Las que doy y el modo evento); con
// un solo catálogo, sin rótulo.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const N = ['Pikachu ex', 'Charizard ex', 'Eevee', 'Snorlax', 'Gengar ex', 'Lapras']
const carta = (set, market, i) => ({ id: `${set}-${i + 1}`, market, set_id: set, local_id: String(i + 1), name: N[i], name_es: N[i], image_path: `sv/${set}/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } })
const CARTAS = [...N.map((_, i) => carta('sv8', 'WEST', i)), ...N.slice(0, 3).map((_, i) => carta('SV8', 'JP', i))]
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', tcg_online_code: 'SSP', card_count_official: 6, card_count_total: 6 }, { id: 'SV8', name: 'Super Electric Breaker', serie_id: 'SV', market: 'JP', card_count_official: 6, card_count_total: 6 }]
const MEZCLA = [...CARTAS.slice(0, 4), ...CARTAS.slice(6, 8)].map((c, i) => ({ id: `d${i}`, user_id: 'admin-1', card_id: c.id, idioma: i % 2 ? null : 'es', created_at: `2026-10-2${i}T10:00:00Z` }))
const SOLO_OCC = MEZCLA.slice(0, 4)
const DOY = [CARTAS[4], CARTAS[5], CARTAS[8]].map((c, i) => ({ id: `l${i}`, user_id: 'admin-1', card_id: c.id, market: c.market, idioma: c.market === 'JP' ? 'ja' : 'es', estado: 'NM', variante: 'normal', cantidad: 2, cambio: 1 }))

const b = await chromium.launch()
async function abrir(ruta, { movil = true, deseos = MEZCLA } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1366, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_DESEOS__: d.deseos, __FAKE_COLECCION__: d.DOY, __FAKE_PRECIOS__: [] })
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('pokedoc-onboarding', '1') } catch {}
  }, { SETS, CARTAS, deseos, DOY })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitless|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { ctx, page, errores }
}
const rejilla = (page, id) => page.evaluate((id) => {
  const r = document.getElementById(id)
  if (!r) return null
  // Desde la 1125 el selector «Los dos · Pokémon · Japón» y el final de la
  // lista que crece van en la rejilla: no son cartas ni rótulos.
  const hijos = [...r.children].filter((h) => !h.matches('.mc-lista-cats, [data-lista-mas]')).map((h) => h.matches('.mc-catalogo-rotulo') ? `#${[...h.children].map((x) => x.textContent.trim()).filter(Boolean).join(' ')}` : (h.dataset.deseoCarta || h.dataset.doyLinea || '?'))
  return { columnas: getComputedStyle(r).gridTemplateColumns.split(' ').length, hijos, ancho: document.documentElement.scrollWidth <= innerWidth }
}, id)

console.log('── 1. iPhone · La quiero: tres por fila y los dos catálogos separados ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=quiero')
  const r = await rejilla(page, 'mcQuieroRejilla')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('tres columnas y nada se sale', r?.columnas === 3 && r.ancho, JSON.stringify(r))
  const occ = r.hijos.indexOf('#Pokémon 4'), jp = r.hijos.indexOf('#Pokémon Japón 2')
  check('«Pokémon 4» con las cuatro occidentales y luego «Pokémon Japón 2» con las dos japonesas', occ === 0 && jp === 5 && r.hijos.slice(1, 5).every((x) => x.startsWith('sv8-')) && r.hijos.slice(6).every((x) => x.startsWith('SV8-')), r.hijos.join(' '))
  const boton = await page.evaluate(() => { const a = document.querySelector('#mcPanelQuiero .mc-evento-boton'); const t = document.querySelector('#mcPanelQuiero .mc-deseos-cabeza .mc-subtitulo').getBoundingClientRect(); const r = a?.getBoundingClientRect(); return a && { href: a.getAttribute('href'), texto: a.innerText.trim(), alto: Math.round(r.height), alLado: Math.abs((r.top + r.height / 2) - (t.top + t.height / 2)) < 16 } })
  check('«Modo evento» a /evento, de 44 px o más', boton?.href === '/evento' && boton.texto === '' /* un icono en el móvil desde la 1038, flotante desde la 1041 */ && boton.alto >= 44, JSON.stringify(boton))
  // Desde la 1057 (PINGU) la que nadie da no lleva fila: ni «Nadie la da aún».
  const nadie = await page.evaluate(() => [...document.querySelectorAll('#mcQuieroRejilla .mc-deseo-baldosa')].some((b) => /Nadie la da/.test(b.innerText)))
  check('sin «Nadie la da aún» en las baldosas', !nadie)
  // Las que doy, en la misma pantalla.
  await page.click('#mcPanelQuiero [data-deseos-vista="doy"]')
  await page.waitForTimeout(1200)
  const d = await rejilla(page, 'mcDoyRejilla')
  check('Las que doy: tres columnas, «Pokémon 2» y «Pokémon Japón 1»', d?.columnas === 3 && d.hijos[0] === '#Pokémon 2' && d.hijos[3] === '#Pokémon Japón 1' && d.hijos.length === 5, JSON.stringify(d))
  // Desde la 1061, «− N de M +» en una línea: círculos de 28 con su franja de 8 (44 al dedo) y la cifra entera.
  const paso = await page.evaluate(() => { const p = document.querySelector('#mcDoyRejilla .mc-doy-paso'); const bs = [...p.querySelectorAll('.mc-doy-boton')]; const r = bs.map((x) => x.getBoundingClientRect()); const c = p.querySelector('.mc-doy-cuantas'); const t = c.getBoundingClientRect(); return { cabe: c.scrollWidth <= c.clientWidth + 1, texto: c.innerText, enLinea: r.every((x) => Math.abs((x.top + x.height / 2) - (t.top + t.height / 2)) < 4) && r[0].right <= t.left && r[1].left >= t.right, alto: bs.map((x) => Math.round(x.getBoundingClientRect().height - 2 * parseFloat(getComputedStyle(x, '::after').top))) } })
  check('  …«− N de M +» en una línea, la cifra entera y 44 al dedo', paso.cabe && /^\d+ de \d+$/.test(paso.texto.trim()) && paso.enLinea && paso.alto.every((h) => h >= 44), JSON.stringify(paso))
  await ctx.close()
}

console.log('\n── 2. Con un solo catálogo, sin rótulos; y el PC ──')
{
  const { ctx, page } = await abrir('/mi-coleccion.html?ver=quiero', { deseos: SOLO_OCC })
  const r = await rejilla(page, 'mcQuieroRejilla')
  check('solo occidentales: ningún rótulo', r && !r.hijos.some((x) => x.startsWith('#')) && r.hijos.length === 4, JSON.stringify(r?.hijos))
  await ctx.close()
  const pc = await abrir('/mi-coleccion.html?ver=quiero', { movil: false })
  const p = await rejilla(pc.page, 'mcQuieroRejilla')
  const orden = await pc.page.evaluate(() => [...document.querySelector('#mcPanelQuiero .mc-deseos-cabeza').children].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map((x) => x.className.split(' ').find((c) => /^mc-(subtitulo|deseos-seg|evento-boton)$/.test(c))))
  check('PC: sin errores, más de tres columnas y los rótulos', pc.errores.length === 0 && p.columnas > 3 && p.hijos[0] === '#Pokémon 4', JSON.stringify({ errores: pc.errores, p }))
  check('PC: título, vistas y «Modo evento» a la derecha', orden.join('|') === 'mc-subtitulo|mc-deseos-seg|mc-evento-boton', orden.join('|'))
  for (const v of ['mercado', 'cambios']) check(`el botón también está en ${v}`, (await pc.page.locator(`#mcPanel${v[0].toUpperCase()}${v.slice(1)} .mc-evento-boton[href="/evento"]`).count()) === 1)
  await pc.ctx.close()
}

console.log('\n── 3. El modo evento también separa ──')
{
  const { ctx, page, errores } = await abrir('/evento.html')
  await page.waitForSelector('#eventoLista li', { timeout: 8000 }).catch(() => {})
  const lista = await page.evaluate(() => [...document.querySelectorAll('#eventoLista > li')].map((li) => li.classList.contains('evento-rotulo') ? `#${[...li.children].map((x) => x.textContent.trim()).join(' ')}` : li.querySelector('b')?.textContent))
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('Busco: «Pokémon 4», sus cuatro, «Pokémon Japón 2» y sus dos', lista[0] === '#Pokémon 4' && lista[5] === '#Pokémon Japón 2' && lista.length === 8, lista.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
