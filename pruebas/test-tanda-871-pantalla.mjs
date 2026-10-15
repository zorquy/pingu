// Tanda 871 — la hoja de compartir común (Texto · Historia · Para X) y
// «Compartir mi día» en pantalla.
//
// Se juega «¿Más caro o más barato?» entero (como la 583) y de ahí se abre
// la hoja: las tres pestañas, la vista previa de cada una, los dos
// formatos de imagen (1080×1350 y 1200×630), compartir y descargar, y el
// cierre. Luego «Compartir mi día» desde el bloque del siguiente reto y
// desde /retos.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { numeroDelDia } from '/home/user/pingu/js/reto-compartir.js'
import { textoParaCompartir } from '/home/user/pingu/js/mas-caro.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const hoy = new Date().toISOString().slice(0, 10)
const CARTAS = [5, 12, 3, 40, 7, 9].map((precio, i) => ({
  id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`,
  image_path: `sv/sv8/${i + 1}`, precio, tcg_sets: { name: 'Mega Evolution', name_en: 'Mega Evolution', tcg_online_code: 'MEG' },
}))
const CARTA_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c33"/></svg>'

const browser = await chromium.launch()
async function contexto({ movil = true, conPartidas = true } = {}) {
  const ctx = await browser.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: movil })
  await ctx.addInitScript(({ hoy, conPartidas }) => {
    window.__FAKE_SESSION__ = 'none'
    navigator.share = async (d) => { window.__compartido = { text: d.text, ficheros: (d.files || []).map((f) => f.name) }; return true }
    navigator.canShare = () => true
    try {
      localStorage.setItem('pokedoc-instalar-no', String(Date.now()))
      if (conPartidas) {
        localStorage.setItem('pokedoc-reto-hoy', JSON.stringify({ dia: hoy, tira: [true, false, true, true, true] }))
        localStorage.setItem('pokedoc-carta-del-dia', JSON.stringify({ dia: hoy, intentos: [1, 2, 3, 4, 5, 6].map(() => ({ id: 'x' })), acertada: false }))
        localStorage.setItem('pokedoc-quien-es', JSON.stringify({ dia: hoy, elegidos: [1, 2], acertada: true }))
      }
    } catch {}
  }, { hoy, conPartidas })
  await ctx.route('**/.netlify/functions/mas-caro**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ dia: hoy, numero: numeroDelDia(hoy), cartas: CARTAS }) }))
  await ctx.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: CARTA_SVG }))
  await ctx.route('**/limitlesstcg.nyc3.cdn.digitaloceanspaces.com/**', (r) => r.abort())
  await ctx.route('**/.netlify/functions/imagen-carta**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: CARTA_SVG }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  return { ctx, page, errores }
}

async function jugarMasCaro(page) {
  await page.goto(`${BASE}/mas-caro.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  for (const r of ['mas', 'menos', 'menos', 'menos', 'mas']) {
    await page.click(`#mcrAcciones button[data-respuesta="${r}"]`)
    await page.waitForTimeout(1800)
  }
}
const medida = (page) => page.locator('#chPrevia img').evaluate((img) => ({ w: img.naturalWidth, h: img.naturalHeight })).catch(() => null)
const pestana = async (page, id) => { await page.click(`[data-ch-pestana="${id}"]`); await page.waitForTimeout(900) }

console.log('── 1. La hoja desde un reto (móvil) ──')
{
  const { ctx, page, errores } = await contexto()
  await jugarMasCaro(page)
  check('sin errores al jugar', errores.length === 0, errores.join(' | '))
  check('un solo «Compartir» (sin «Como imagen» aparte)', (await page.locator('#mcrCompartir').count()) === 1 && (await page.locator('#mcrImagen').count()) === 0)
  await page.click('#mcrCompartir')
  await page.waitForTimeout(900)
  const hoja = page.locator('.ch-hoja[open]')
  check('se abre la hoja, modal', (await hoja.count()) === 1 && (await hoja.evaluate((d) => d.matches(':modal'))))
  check('  …con el título del reto', (await page.locator('#chTitulo').innerText()) === '¿Más caro o más barato?')
  check('  …y tres pestañas: Texto, Historia, Para X', (await page.locator('[data-ch-pestana]').allInnerTexts()).join('|') === 'Texto|Historia|Para X')
  check('  …Texto activa', (await page.locator('[data-ch-pestana="texto"]').getAttribute('aria-pressed')) === 'true')
  // Las respuestas de arriba: 12>5 ✓, 3<12 ✓, 40>3 ✗ («menos»), 7<40 ✓, 9>7 ✓.
  const esperado = textoParaCompartir({ dia: hoy, tira: [true, true, false, true, true], rachaDias: 0 })
  check('la vista previa es EL texto que se va a mandar', (await page.locator('.ch-texto').innerText()) === esperado, await page.locator('.ch-texto').innerText())
  check('  …con la cabecera única (870)', esperado.startsWith(`PokeDoc #${numeroDelDia(hoy)} · Más caro o barato · 4/5`))
  const caja = await hoja.evaluate((d) => d.getBoundingClientRect().toJSON())
  check('en el móvil sale desde abajo, a lo ancho', caja && caja.width >= 380 && Math.abs(caja.y + caja.height - 844) < 2, JSON.stringify(caja))
  const botones = await page.locator('.ch-acciones button').evaluateAll((bs) => bs.map((b) => ({ t: b.innerText.trim(), h: b.getBoundingClientRect().height })))
  check('los dos botones miden 44 px: «Compartir…» y «Copiar»', botones.length === 2 && botones.every((b) => b.h >= 44) && botones[0].t.includes('Compartir') && botones[1].t === 'Copiar', JSON.stringify(botones))
  await page.click('[data-ch-compartir]')
  await page.waitForTimeout(400)
  const c = await page.evaluate(() => window.__compartido)
  check('«Compartir…» manda el texto por la hoja del sistema', c?.text === esperado, JSON.stringify(c))
  // Copiar, por el portapapeles.
  await page.evaluate(() => { window.__copiado = null; navigator.clipboard.writeText = async (t) => { window.__copiado = t } })
  await page.click('[data-ch-copiar]')
  await page.waitForTimeout(300)
  check('«Copiar» lo pone en el portapapeles', (await page.evaluate(() => window.__copiado)) === esperado)
  // Historia.
  await pestana(page, 'historia')
  check('«Historia» dibuja la imagen a 1080×1350', JSON.stringify(await medida(page)) === '{"w":1080,"h":1350}', JSON.stringify(await medida(page)))
  check('  …el segundo botón pasa a «Descargar»', (await page.locator('[data-ch-copiar]').innerText()).trim() === 'Descargar')
  check('  …y la nota lo dice', /Instagram/.test(await page.locator('#chNota').innerText()))
  const alto = await page.locator('#chPrevia img').evaluate((i) => i.getBoundingClientRect().height)
  check('  …y en el móvil la vertical no se come la pantalla (≤ 40 vh)', alto <= 844 * 0.4 + 1, String(alto))
  await page.click('[data-ch-compartir]')
  await page.waitForTimeout(600)
  const c2 = await page.evaluate(() => window.__compartido)
  check('«Compartir…» manda el PNG con el texto', c2?.ficheros?.[0] === `mas-caro-${numeroDelDia(hoy)}.png` && c2?.text === esperado, JSON.stringify(c2))
  // Para X.
  await pestana(page, 'apaisada')
  check('«Para X» la dibuja a 1200×630', JSON.stringify(await medida(page)) === '{"w":1200,"h":630}', JSON.stringify(await medida(page)))
  await page.evaluate(() => { navigator.share = undefined })
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), page.click('[data-ch-copiar]')])
  check('  …y «Descargar» baja «mas-caro-N-x.png»', descarga?.suggestedFilename() === `mas-caro-${numeroDelDia(hoy)}-x.png`, descarga?.suggestedFilename())
  await page.click('[data-ch-cerrar]')
  await page.waitForTimeout(300)
  check('la X cierra', (await page.locator('.ch-hoja[open]').count()) === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))

  console.log('── 2. «Compartir mi día» desde el final del reto ──')
  const miDia = page.locator('#mcrFinal .rj-adonde .rj-mi-dia')
  check('el botón está en el bloque del siguiente reto, de 44 px', (await miDia.count()) === 1 && (await miDia.evaluate((b) => b.getBoundingClientRect().height)) >= 44)
  await miDia.click()
  await page.waitForTimeout(1000)
  check('abre la hoja «Mi día en PokeDoc»', (await page.locator('.ch-hoja[open]').count()) === 1 && (await page.locator('#chTitulo').innerText()) === 'Mi día en PokeDoc')
  const t = await page.locator('.ch-texto').innerText()
  const lineas = t.split('\n')
  check('  …con 4 de 6: el reto, la carta, el más caro recién jugado y el quién es', lineas[0] === `PokeDoc #${numeroDelDia(hoy)} · 4/6 retos`, lineas[0])
  check('  …la tira del más caro es la jugada', lineas[3] === '💶 Más caro o barato  🟩🟩🟥🟩🟩', lineas[3])
  check('  …los dos sin jugar en gris', lineas[5] === '🔢 Ordena por precio  ⬜⬜⬜' && lineas[6] === '📦 ¿Qué expansión?  ⬜⬜⬜⬜⬜')
  check('  …y el enlace a /retos', lineas.at(-1) === 'pokedoc.es/retos')
  await pestana(page, 'historia')
  check('la imagen de «Mi día», 1080×1350', JSON.stringify(await medida(page)) === '{"w":1080,"h":1350}')
  await pestana(page, 'apaisada')
  check('  …y apaisada, 1200×630', JSON.stringify(await medida(page)) === '{"w":1200,"h":630}')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. En el ordenador, centrada ──')
{
  const { ctx, page, errores } = await contexto({ movil: false })
  await jugarMasCaro(page)
  await page.click('#mcrCompartir')
  await page.waitForTimeout(900)
  const caja = await page.locator('.ch-hoja[open]').evaluate((d) => d.getBoundingClientRect().toJSON())
  check('la hoja va centrada y no a lo ancho (ni pegada a la esquina)', caja && caja.width <= 520 && Math.abs(caja.x + caja.width / 2 - 640) < 4 && caja.y > 40, JSON.stringify(caja))
  check('  …sin tirador', !(await page.locator('.ch-tirador').isVisible()))
  // Tocar el velo cierra.
  await page.mouse.click(20, 20)
  await page.waitForTimeout(300)
  check('tocar fuera cierra', (await page.locator('.ch-hoja[open]').count()) === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. /retos: «Compartir mi día» en «Tu día» ──')
{
  const { ctx, page, errores } = await contexto()
  await page.goto(`${BASE}/retos.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const b = page.locator('#rtDiaFila .rt-compartir-dia')
  check('con retos hechos, el botón está en «Tu día»', (await b.count()) === 1 && (await b.evaluate((x) => x.getBoundingClientRect().height)) >= 44)
  await b.click()
  await page.waitForTimeout(1000)
  check('  …y abre la hoja de «Mi día»', (await page.locator('.ch-hoja[open]').count()) === 1 && /PokeDoc #\d+ · \d\/6 retos/.test(await page.locator('.ch-texto').innerText()))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
  const sin = await contexto({ conPartidas: false })
  await sin.page.goto(`${BASE}/retos.html`, { waitUntil: 'domcontentloaded' })
  await sin.page.waitForTimeout(1500)
  check('sin nada jugado, no hay nada que compartir y el botón no sale', (await sin.page.locator('.rt-compartir-dia').count()) === 0)
  await sin.ctx.close()
}

console.log('── 5. Los otros cuatro retos y el cuestionario van por la misma hoja ──')
{
  const { readFileSync } = await import('node:fs')
  const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
  for (const f of ['carta-del-dia-juego', 'quien-es-juego', 'ordena-precio-juego', 'que-expansion-juego', 'curso']) {
    const s = readFileSync(`${RAIZ}/js/${f}.js`, 'utf8')
    check(`${f}: abre compartir-hoja.js con texto e imagen, sin su propio navigator.share`, /import\('\.\/compartir-hoja\.js'\)/.test(s) && /imagen: (imagenDelResultado|async \(formato\))/.test(s) && !/navigator\.share\(/.test(s))
  }
  const quien = readFileSync(`${RAIZ}/js/quien-es-juego.js`, 'utf8')
  check('«¿Quién es?» pinta el dibujo del Pokémon cuadrado (fotoProporcion: 1)', /fotoProporcion: 1/.test(quien) && /urlsDelDibujo\(buena\)/.test(quien))
  const ordena = readFileSync(`${RAIZ}/js/ordena-precio-juego.js`, 'utf8')
  check('«Ordena» pinta una fila de cuatro por intento', /filas: estado\.intentos\.map\(\(o\) => enSuSitio\(o, cartas\)\)/.test(ordena))
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
