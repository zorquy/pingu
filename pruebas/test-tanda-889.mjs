// Tanda 889 — las barras de /meta sin color.
//
// PINGU: «las barras no cargan en algunos mazos: o no tienen color o no sé».
// El catálogo guarda el tipo de cada carta COMO LE LLEGA, y desde la 330 lo
// engordado en español viene en español («Oscura», «Fuego»). La barra se
// tiñe con `.meta-barra[data-tipo='Darkness']`, así que un
// `data-tipo="Oscura"` no casa con ninguna regla, `--tipo-energia` queda sin
// definir y el relleno sale TRANSPARENTE: ni el color del tipo ni el azul
// de «no se sabe». Desde la 889 el tipo de las cartas pasa por la misma
// tabla que la ficha (`canonizarCarta`), y lo que ni así se reconoce no
// tiñe ni pisa el tipo de la especie.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro ──')
const { tipoMasRepetido, TIPOS_CON_BARRA } = await import(`${RAIZ}/js/meta/datos.js`)
{
  const cartas = [{ dex_ids: [571], types: ['Oscura'] }, { dex_ids: [571], types: ['Oscuridad'] }, { dex_ids: [571], types: ['Fuego'] }]
  check('el español del catálogo se lee como el tipo inglés de la hoja («Oscura» → Darkness)', tipoMasRepetido(cartas, 571) === 'Darkness', tipoMasRepetido(cartas, 571))
  check('una grafía que nadie reconoce NO cuenta (no tiñe de transparente)', tipoMasRepetido([{ dex_ids: [1], types: ['Rarísimo'] }], 1) === null)
  check('…y si hay otra que sí, manda la que sí', tipoMasRepetido([{ dex_ids: [1], types: ['Rarísimo'] }, { dex_ids: [1], types: ['Planta'] }], 1) === 'Grass')
  check('el inglés sigue valiendo', tipoMasRepetido([{ dex_ids: [6], types: ['Fire'] }], 6) === 'Fire')
  // La lista de lo que tiñe es la de la hoja, ni uno más ni uno menos.
  const css = readFileSync(`${RAIZ}/css/meta.css`, 'utf8')
  const enHoja = new Set([...css.matchAll(/\.meta-barra\[data-tipo='([A-Za-z]+)'\]\s*\{\s*--tipo-energia/g)].map((m) => m[1]))
  check('cada tipo de TIPOS_CON_BARRA tiene su regla en css/meta.css', [...TIPOS_CON_BARRA].every((t) => enHoja.has(t)), [...TIPOS_CON_BARRA].filter((t) => !enHoja.has(t)).join(','))
  check('…y cada regla de la hoja está en la lista', [...enHoja].every((t) => TIPOS_CON_BARRA.has(t)), [...enHoja].filter((t) => !TIPOS_CON_BARRA.has(t)).join(','))
  // La barra solo escribe `data-tipo` con un tipo de la lista.
  const meta = readFileSync(`${RAIZ}/js/meta.js`, 'utf8')
  check('js/meta.js pregunta a TIPOS_CON_BARRA antes de escribir data-tipo', /TIPOS_CON_BARRA\.has\(/.test(meta))
}

console.log('\n── 2. En la pantalla: cartas en español, y una grafía desconocida ──')
const META = [
  { arquetipo: 'ns-zoroark', nombre: "N's Zoroark", iconos: ['zoroark'], mazos: 120, top8: 30, cuota: 14.2, cuota_anterior: 12, victorias: 300, derrotas: 250, empates: 10, porcentaje_victorias: 54.1 },
  { arquetipo: 'hydrapple', nombre: 'Hydrapple', iconos: ['hydrapple'], mazos: 90, top8: 20, cuota: 10.4, cuota_anterior: 11, victorias: 200, derrotas: 210, empates: 5, porcentaje_victorias: 48.9 },
  { arquetipo: 'charizard', nombre: 'Charizard ex', iconos: ['charizard'], mazos: 60, top8: 9, cuota: 6.1, cuota_anterior: 6, victorias: 100, derrotas: 100, empates: 0, porcentaje_victorias: 50 },
]
const semilla = ({ meta }) => {
  window.__RPC_RESPUESTAS__ = { meta_resumen: meta, meta_totales: [{ torneos: 12, jugadores: 800, online: 12, ultima_lectura: new Date().toISOString() }] }
  const c = (id, dex, tipo) => ({ id, market: 'WEST', set_id: 'sv3', local_id: id.split('-')[1], name: id, dex_ids: [dex], types: [tipo] })
  // Zoroark: en español, como lo guarda el engorde. Hydrapple: una grafía
  // que nadie reconoce (la especie dice Planta). Charizard: en inglés.
  window.__FAKE_CARTAS__ = [c('sv3-1', 571, 'Oscura'), c('sv3-2', 571, 'Oscura'), c('sv3-3', 1019, 'Rarísimo'), c('sv3-4', 6, 'Fire')]
}
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
await ctx.addInitScript(semilla, { meta: META })
await ctx.route(/r2\.limitlesstcg\.net|cdn\.jsdelivr\.net|raw\.githubusercontent\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"></svg>' }))
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.goto(`${BASE}/meta.html`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
const barras = await page.$$eval('#metaRanking .meta-fila', (fs) => fs.map((f) => {
  const i = f.querySelector('.meta-barra i')
  return { nombre: f.querySelector('.meta-nombre strong')?.textContent, tipo: f.querySelector('.meta-barra')?.dataset.tipo || null, color: i ? getComputedStyle(i).backgroundColor : null }
}))
const transparente = (c) => !c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent'
const de = (n) => barras.find((x) => x.nombre === n)
check('sin errores', errores.length === 0, errores.join(' | '))
check('tres filas', barras.length === 3, JSON.stringify(barras))
check('Zoroark (cartas «Oscura»): la barra lleva Darkness y SE VE', de("N's Zoroark")?.tipo === 'Darkness' && !transparente(de("N's Zoroark")?.color), JSON.stringify(de("N's Zoroark")))
check('Hydrapple (grafía desconocida): se queda el tipo de la especie, Grass, y SE VE', de('Hydrapple')?.tipo === 'Grass' && !transparente(de('Hydrapple')?.color), JSON.stringify(de('Hydrapple')))
check('Charizard (inglés): Fire', de('Charizard ex')?.tipo === 'Fire' && !transparente(de('Charizard ex')?.color), JSON.stringify(de('Charizard ex')))
check('ninguna barra con relleno transparente', barras.every((x) => !transparente(x.color)), JSON.stringify(barras))
await b.close()

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
