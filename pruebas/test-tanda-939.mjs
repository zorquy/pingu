// Tanda 939 — Los retos que se comparten no se dejan adivinar, y el
// buscador de «¿Qué carta es?» va por expansión y se vacía al fallar.
//
// PINGU: «cuando compartes qué Pokémon es, se ve demasiado… ¿quién es ese
// Pokémon? Debería ser solo la silueta. La carta debería estar muy borrosa»;
// «buscas algo, le das, fallas y cuando vuelves a buscar sigue estando el
// texto anterior»; «las cartas están muy apiladas… pondría el buscador por
// colecciones, igual que en la búsqueda de cartas».
//   1. Lo estático: ¿Quién es? pide la silueta; ¿Qué carta es? busca con EL
//      buscador de cartas y vacía el suyo al intentar.
//   2. La imagen: la silueta es la sombra del dibujo, sin un píxel de su
//      color; la carta tapada no deja ver ni un dibujo de cuadros grandes.
//   3. En pantalla: grupos por expansión (la más nueva primero) con su
//      cabecera; tras un fallo, el buscador vacío; con solo la expansión,
//      la expansión entera.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo estático ──')
{
  const q = leer('js/quien-es-juego.js')
  const i = q.indexOf('async function imagenDelResultado')
  check('¿Quién es?: la imagen pide la silueta', /tapada:\s*'silueta'/.test(q.slice(i, q.indexOf('\n}\n', i))))
  const c = leer('js/carta-del-dia-juego.js')
  check('¿Qué carta es?: busca con EL buscador de cartas (909)', /buscarComoEnCartas\(/.test(c) && !/buscarEnCatalogo\(/.test(c))
  const j = c.indexOf('function intentar(')
  check('  …y vacía el buscador al intentar', /vaciarBuscador\(\)/.test(c.slice(j, c.indexOf('\n}\n', j))))
}

const browser = await chromium.launch()

console.log('\n── 2. La imagen que se comparte ──')
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/404.html`, { waitUntil: 'domcontentloaded' })
  const r = await page.evaluate(async () => {
    const m = await import('/js/reto-imagen.js')
    const imagen = (dibujar, w, h) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h
      dibujar(c.getContext('2d'))
      return new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = c.toDataURL() })
    }
    // El dibujo de un Pokémon: un círculo rojo sobre transparente.
    const dibujo = await imagen((x) => { x.fillStyle = '#e02020'; x.beginPath(); x.arc(200, 200, 150, 0, Math.PI * 2); x.fill() }, 400, 400)
    // Una carta con cuadros GRANDES (24 px): con el desenfoque de la 924
    // todavía se veían (contraste 43); tapada de verdad, no (13).
    const carta = await imagen((x) => { for (let yy = 0; yy < 342; yy += 24) for (let xx = 0; xx < 245; xx += 24) { x.fillStyle = ((xx + yy) / 24) % 2 ? '#000' : '#fff'; x.fillRect(xx, yy, 24, 24) } }, 245, 342)
    const base = { titulo: 'X', cuenta: '3/6', numero: 47, tira: [false, true], racha: 2, lema: 'l', enlace: 'pokedoc.es/x', fotoNombre: '', formato: 'historia' }
    const sil = m.pintarResultadoReto(document.createElement('canvas'), { ...base, foto: dibujo, fotoProporcion: 1, tapada: 'silueta' })
    const nit = m.pintarResultadoReto(document.createElement('canvas'), { ...base, foto: dibujo, fotoProporcion: 1, tapada: false })
    const tap = m.pintarResultadoReto(document.createElement('canvas'), { ...base, foto: carta })
    // Dónde cae la foto en la historia: centrada en x = 540, desde y ≈ 260.
    const zona = (lienzo, x0, y0, w, h) => lienzo.getContext('2d').getImageData(x0, y0, w, h).data
    const rojos = (d) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] < 90 && d[i + 2] < 90) n++; return n }
    const centro = (lienzo) => Array.from(zona(lienzo, 540, 480, 1, 1).slice(0, 3))
    // El contraste a lo largo de una franja de la carta, lejos del «?».
    const contraste = (lienzo) => { const d = zona(lienzo, 400, 300, 280, 1); let lo = 255, hi = 0; for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; lo = Math.min(lo, v); hi = Math.max(hi, v) } return Math.round(hi - lo) }
    return {
      rojosSilueta: rojos(zona(sil, 240, 200, 600, 700)),
      rojosNitida: rojos(zona(nit, 240, 200, 600, 700)),
      centroSilueta: centro(sil),
      esquinaSilueta: Array.from(zona(sil, 540 - 150, 300, 1, 1).slice(0, 3)),
      contrasteTapada: contraste(tap),
    }
  })
  check('con la foto nítida se ve el rojo del dibujo', r.rojosNitida > 1000, JSON.stringify(r))
  check('la silueta no tiene ni un píxel del color del dibujo', r.rojosSilueta === 0, JSON.stringify(r))
  check('  …el dibujo es una sombra oscura', r.centroSilueta.every((v) => v < 60), JSON.stringify(r.centroSilueta))
  check('  …sobre un fondo claro', r.esquinaSilueta.every((v) => v > 120), JSON.stringify(r.esquinaSilueta))
  check('la carta tapada no deja ver ni cuadros de 24 px', r.contrasteTapada < 25, String(r.contrasteTapada))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 3. El buscador de «¿Qué carta es?» ──')
{
  const hoy = new Date().toISOString().slice(0, 10)
  const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#f7d354"/></svg>'
  const SETS = [
    { id: 'sv8', name: 'Surging Sparks', market: 'WEST', serie_id: 'sv', release_date: '2024-11-08', card_count_official: 191, tcg_online_code: 'SSP' },
    { id: 'sv3pt5', name: '151', market: 'WEST', serie_id: 'sv', release_date: '2023-09-22', card_count_official: 165, tcg_online_code: 'MEW' },
  ]
  const setDe = (id) => SETS.find((s) => s.id === id)
  const carta = (id, set, n, name, extra = {}) => ({ id, market: 'WEST', set_id: set, local_id: String(n), name, name_es: name, image_path: `sv/${set}/${n}`, category: 'Pokemon', rarity: 'Rare', rarity_en: 'Rare', types: ['Lightning'], tcg_sets: { name: setDe(set).name, tcg_online_code: setDe(set).tcg_online_code, serie_id: 'sv', release_date: setDe(set).release_date }, ...extra })
  const RESPUESTA = carta('sv8-25', 'sv8', 25, 'Pikachu ex')
  const CARTAS = [RESPUESTA, carta('sv8-1', 'sv8', 1, 'Lapras', { types: ['Water'] }), carta('sv3pt5-25', 'sv3pt5', 25, 'Pikachu'), carta('sv3pt5-26', 'sv3pt5', 26, 'Raichu'), carta('sv3pt5-200', 'sv3pt5', 200, 'Entrenador', { category: 'Trainer' })]
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route('**/.netlify/functions/carta-del-dia**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ dia: hoy, numero: 1, carta: RESPUESTA, ayer: null }) }))
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: SVG }))
  await page.route(/limitlesstcg|pokemontcg\.io|images\.tcggo|scrydex/, (r) => r.abort())
  await page.addInitScript(([sets, cartas]) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_ERAS__ = [{ id: 'sv', market: 'WEST', nombre: 'Escarlata y Púrpura', orden: 10 }]
    localStorage.removeItem('pokedoc-carta-del-dia')
  }, [SETS, CARTAS])
  await page.goto(`${BASE}/carta-del-dia.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  await page.waitForFunction(() => document.getElementById('cdFoto')?.complete, null, { timeout: 5000 }).catch(() => {})
  const resultados = () => page.$$eval('#nvResultados > *', (es) => es.map((e) => (e.classList.contains('nv-grupo') ? `#${e.dataset.grupoSet}` : e.dataset.elegir || e.className)))
  await page.locator('#cdAdivinar').click()
  await page.waitForTimeout(300)
  await page.fill('#nvBuscar', 'pikachu')
  await page.waitForTimeout(900)
  const r1 = await resultados()
  check('«pikachu»: un grupo por expansión, la más nueva primero', r1.join(',') === '#sv8,sv8-25,#sv3pt5,sv3pt5-25', r1.join(','))
  check('  …la cabecera dice la expansión y cuántas', /Surging Sparks/.test(await page.locator('.nv-grupo').first().innerText()) && /1 carta/.test(await page.locator('.nv-grupo').first().innerText()), await page.locator('.nv-grupo').first().innerText())
  check('  …y se queda pegada arriba al bajar', (await page.locator('.nv-grupo').first().evaluate((e) => getComputedStyle(e).position)) === 'sticky')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // Un fallo: Lapras.
  await page.locator('#cdAdivinar').click()
  await page.waitForTimeout(300)
  await page.fill('#nvBuscar', 'lapras')
  await page.waitForTimeout(900)
  await page.locator('[data-elegir="sv8-1"]').click()
  await page.waitForTimeout(500)
  check('el fallo cuenta', (await page.locator('.cd-intento:not(.cd-intento-vacio)').count()) === 1)
  await page.locator('#cdAdivinar').click()
  await page.waitForTimeout(300)
  check('al volver a buscar, el buscador está vacío', (await page.inputValue('#nvBuscar')) === '' && (await page.locator('#nvResultados [data-elegir]').count()) === 0, await page.inputValue('#nvBuscar'))
  // Solo la expansión: la expansión entera (sin los entrenadores).
  await page.selectOption('#nvSet', 'sv3pt5')
  await page.waitForTimeout(900)
  const r2 = await resultados()
  check('con solo la expansión, sus Pokémon bajo su cabecera', r2.join(',') === '#sv3pt5,sv3pt5-25,sv3pt5-26', r2.join(','))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
