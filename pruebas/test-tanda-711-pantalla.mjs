// Tanda 711 — la Pokédex con el color de su tipo (C3 y V1 de la lista de
// propuestas, elegidas por PINGU).
//
// Lo que se mira: que el tipo de una especie salga de TUS cartas (el que
// más se repite, en inglés canónico o en español viejo), que cada ficha
// que tienes lleve el fondo de su tipo Y su símbolo de energía —el color
// nunca va solo—, que un tipo sin símbolo (Dragón) se quede neutro, que lo
// que no tienes vaya en silueta, y que el tema oscuro tenga su propia
// paleta y no la clara.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { tiposPorEspecie, filasDePokedex } from '/home/user/pingu/js/mi-coleccion/pokedex.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
// `color-mix` llega como «color(srgb r g b)» (0–1) y lo demás como «rgb(…)».
const rgb = (t) => {
  const m = String(t).match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/)
  if (m) return m.slice(1, 4).map((x) => Math.round(Number(x) * 255))
  return (String(t).match(/\d+/g) || []).slice(0, 3).map(Number)
}
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
const contraste = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const verde = (t) => { const [r, g, b] = rgb(t); return g > r && g > b }

console.log('── 1. El tipo de cada especie, de tus cartas ──')
{
  const cartas = new Map([
    ['a', { id: 'a', name: 'Charizard', types: ['Fire'], dex_ids: [6] }],
    ['b', { id: 'b', name: 'Charizard', types: ['Fire'], dex_ids: [6] }],
    ['c', { id: 'c', name: 'Charizard', types: ['Dragon'], dex_ids: [6] }],
    ['d', { id: 'd', name: 'Bulbasaur', types: ['Planta'], dex_ids: [1] }],
    ['e', { id: 'e', name: 'Pikachu & Zekrom', types: ['Lightning'], dex_ids: [25, 644] }],
    ['f', { id: 'f', name: 'Rayquaza', types: ['Dragon'], dex_ids: [384] }],
  ])
  const lineas = [...cartas.keys()].map((id) => ({ card_id: id })).concat([{ card_id: 'a' }, { card_id: 'c' }])
  const t = tiposPorEspecie(lineas, cartas)
  check('dos de Fuego y una de Dragón: Charizard es de Fuego (cuenta cartas distintas, no copias)', t.get(6) === 'R', JSON.stringify([...t]))
  check('una fila vieja con el tipo en español también vale', t.get(1) === 'G')
  check('una TAG TEAM tiñe a las dos especies', t.get(25) === 'L' && t.get(644) === 'L')
  // Desde la 748 Dragón, Incoloro y Hada tienen su símbolo, así que tiñen.
  check('Dragón tiene símbolo desde la 748, y tiñe', t.get(384) === 'N')
  const filas = filasDePokedex({ mio: new Map([[6, 3]]), totales: new Map(), tipos: t })
  check('la fila de una especie que tienes lleva su tipo; la de una que no, ninguno', filas.find((f) => f.dex === 6).tipo === 'R' && filas.find((f) => f.dex === 1).tipo === null)
  // 748: el de la especie, para todas (la que no tienes lleva su símbolo en
  // gris); y una que tienes sin `types` en sus cartas, el de la especie.
  check('  …y todas saben el de su especie, aunque no lo traigan sus cartas', filas.find((f) => f.dex === 1).tipoDe === 'G' && filasDePokedex({ mio: new Map([[150, 1]]), totales: new Map(), tipos: new Map() }).find((f) => f.dex === 150).tipo === 'P')
}

console.log('── 1b. Los ocho tipos se leen, en los dos temas ──')
{
  // Se calcula con lo que dice LA HOJA: las proporciones de la mezcla y los
  // ocho colores, y el fondo y el texto de cada tema de style.css. Así un
  // cambio de proporción que deje el amarillo ilegible se ve aquí, aunque
  // la pantalla solo pinte dos tipos.
  const { readFileSync } = await import('node:fs')
  const hoja = readFileSync('/home/user/pingu/css/mi-coleccion.css', 'utf8')
  const estilo = readFileSync('/home/user/pingu/css/style.css', 'utf8')
  const pBg = Number(hoja.match(/--pdx-bg: color-mix\(in srgb, var\(--tipo-energia\) (\d+)%/)[1]) / 100
  const pTi = Number(hoja.match(/--pdx-tinta: color-mix\(in srgb, var\(--tipo-energia\) (\d+)%/)[1]) / 100
  const tipos = Object.fromEntries([...hoja.matchAll(/\.pdx-especie\.tipo-([A-Z]) \{ --tipo-energia: (#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]))
  const hx = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16))
  const mezcla = (a, b, p) => a.map((v, i) => v * p + b[i] * (1 - p))
  const tema = (bloque) => ({ white: hx(bloque.match(/--white: (#[0-9a-f]{6})/)[1]), text: hx(bloque.match(/--text: (#[0-9a-f]{6})/)[1]) })
  const claro = tema(estilo.slice(estilo.indexOf(':root {'))), oscuro = tema(estilo.slice(estilo.indexOf(":root[data-theme='dark'] {")))
  const peor = []
  for (const [nombre, t] of [['claro', claro], ['oscuro', oscuro]]) {
    for (const [letra, c] of Object.entries(tipos)) {
      const bg = mezcla(hx(c), t.white, pBg), ti = mezcla(hx(c), t.text, pTi)
      const k = contraste(`rgb(${ti.map(Math.round)})`, `rgb(${bg.map(Math.round)})`)
      if (k < 4.5) peor.push(`${letra} en ${nombre}: ${k.toFixed(2)}`)
    }
  }
  check('los once tipos (los ocho y, desde la 748, Dragón, Incoloro y Hada), en claro y en oscuro, con la cifra a 4,5 o más', Object.keys(tipos).length === 11 && peor.length === 0, peor.join(', '))
}

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'base1', name: 'Set Base', serie_id: 'base', market: 'WEST', release_date: '1999-01-09', card_count_official: 102, card_count_total: 102 }]
  const c = (n, nombre, dex, tipo) => ({ id: `base1-${n}`, market: 'WEST', set_id: 'base1', local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', types: [tipo], dex_ids: [dex], tcg_sets: { id: 'base1', name: 'Set Base', serie_id: 'base' } })
  window.__FAKE_CARTAS__ = [c(44, 'Bulbasaur', 1, 'Grass'), c(46, 'Charmander', 4, 'Fire'), c(4, 'Charizard', 6, 'Fire'), c(63, 'Squirtle', 7, 'Water'), c(99, 'Dratini', 147, 'Dragon')]
  window.__FAKE_COLECCION__ = ['base1-44', 'base1-46', 'base1-4', 'base1-99'].map((id, i) => ({ id: `l${i}`, card_id: id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
}
async function abrir({ oscuro = false } = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  if (oscuro) await ctx.addInitScript(() => { try { localStorage.setItem('theme', 'dark') } catch {} })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg\.net|raw\.githubusercontent\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="68" height="56"><rect width="68" height="56" fill="#f80"/></svg>' }))
  await ctx.route(/cdn\.jsdelivr\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=pokedex`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  if (oscuro) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  return { page, ctx, errores }
}
const ficha = (page, dex) => page.$eval(`.pdx-especie[data-dex="${dex}"]`, (b) => {
  const e = b.querySelector('.pdx-energia')
  const img = b.querySelector('.pdx-sprite img')
  return { clases: b.className, fondo: getComputedStyle(b).backgroundColor, tinta: getComputedStyle(b.querySelector('.pdx-cuenta')).color, energia: e ? { src: e.getAttribute('src'), titulo: e.title, carga: e.complete && e.naturalWidth > 0 } : null, filtro: img ? getComputedStyle(img).filter : null }
})

console.log('── 2. En la pantalla ──')
{
  const { page, ctx, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const bulba = await ficha(page, 1), chari = await ficha(page, 6), squirtle = await ficha(page, 7), dratini = await ficha(page, 147)
  check('Bulbasaur (tienes uno de Planta): fondo verde y claro, y su símbolo de Planta', /tipo-G/.test(bulba.clases) && verde(bulba.fondo) && lum(rgb(bulba.fondo)) > 0.7 && bulba.energia?.titulo === 'Planta' && bulba.energia.src === '/assets/energias/G.svg', JSON.stringify(bulba))
  check('  …el símbolo existe de verdad (el SVG carga)', bulba.energia?.carga)
  check('  …y la cifra va en el color de su tipo (verde), y se lee encima (≥ 4,5)', verde(bulba.tinta) && contraste(bulba.tinta, bulba.fondo) >= 4.5, `${bulba.tinta} sobre ${bulba.fondo}: ${contraste(bulba.tinta, bulba.fondo).toFixed(2)}`)
  const chFondo = chari.fondo
  check('  …y el Fuego también se lee (≥ 4,5)', contraste(chari.tinta, chFondo) >= 4.5, contraste(chari.tinta, chFondo).toFixed(2))
  check('Charizard: Fuego', /tipo-R/.test(chari.clases) && chari.energia?.titulo === 'Fuego')
  check('Dratini (Dragón, con símbolo desde la 748): teñido de Dragón y con su icono', /tipo-N/.test(dratini.clases) && dratini.energia?.titulo === 'Dragón' && /tengo/.test(dratini.clases), JSON.stringify(dratini))
  check('Squirtle (no lo tienes): sin tipo y el sprite en silueta', !/tipo-/.test(squirtle.clases) && /brightness\(0\)/.test(squirtle.filtro || ''), JSON.stringify(squirtle))
  await ctx.close()
}

console.log('── 3. En oscuro, su propia paleta ──')
{
  const { page, ctx } = await abrir({ oscuro: true })
  const bulba = await ficha(page, 1), squirtle = await ficha(page, 7)
  check('el fondo de Planta es oscuro y verdoso, no el claro', lum(rgb(bulba.fondo)) < 0.08 && rgb(bulba.fondo)[1] > rgb(bulba.fondo)[0], bulba.fondo)
  check('  …y su cifra se lee encima (≥ 4,5)', contraste(bulba.tinta, bulba.fondo) >= 4.5, `${bulba.tinta}: ${contraste(bulba.tinta, bulba.fondo).toFixed(2)}`)
  check('la silueta se aclara para verse sobre el fondo oscuro', /invert\(1\)/.test(squirtle.filtro || ''), squirtle.filtro)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
