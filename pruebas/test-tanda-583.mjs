// Tanda 583 — «¿Más caro o más barato?» en pantalla, y la imagen del reto.
//
// Lo que más vigila: que la partida sea la MISMA al recargar (se guarda en
// el navegador), que el precio de la segunda carta no se vea antes de
// responder, y que al acabar se pueda compartir en texto y en imagen.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { numeroDelDia, RONDAS } from '/home/user/pingu/js/mas-caro.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

const hoy = new Date().toISOString().slice(0, 10)
const CARTAS = [5, 12, 3, 40, 7, 9].map((precio, i) => ({
  id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`,
  image_path: `sv/sv8/${i + 1}`, precio, tcg_sets: { name: 'Mega Evolution', name_en: 'Mega Evolution', tcg_online_code: 'MEG' },
}))
// B frente a A: 12>5 más, 3<12 menos, 40>3 más, 7<40 menos, 9>7 más.
const BUENAS = ['mas', 'menos', 'mas', 'menos', 'mas']
const CARTA_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c33"/></svg>'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
await page.route('**/.netlify/functions/mas-caro**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ dia: hoy, numero: numeroDelDia(hoy), cartas: CARTAS }) }))
await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: CARTA_SVG }))
await page.route('**/limitlesstcg.nyc3.cdn.digitaloceanspaces.com/**', (r) => r.abort())
await page.route('**/.netlify/functions/imagen-carta**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: CARTA_SVG }))
await page.goto(`${BASE}/mas-caro.html`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

console.log('── 1. La primera pregunta ──')
{
  const a = await page.locator('#mcrA').innerText()
  const b = await page.locator('#mcrB').innerText()
  check('la carta A sale con su precio', /Carta 1/.test(a) && /5,00\s?€/.test(a), a.replace(/\n/g, ' | '))
  check('la carta B sale SIN precio', /Carta 2/.test(b) && /¿\?/.test(b) && !/12,00/.test(b), b.replace(/\n/g, ' | '))
  check('hay dos botones, «Vale más» y «Vale menos»', (await page.locator('#mcrAcciones button').count()) === 2)
  const sub = await page.locator('#mcrSub').innerText()
  check('se dice el número del reto y la pregunta 1 de 5', new RegExp(`#${numeroDelDia(hoy)}`).test(sub) && /pregunta 1 de 5/.test(sub), sub)
  check('la tira tiene cinco huecos vacíos', (await page.locator('#mcrTira li').count()) === RONDAS && (await page.locator('#mcrTira li.bien, #mcrTira li.mal').count()) === 0)
  if (CAPS) await page.screenshot({ path: `${CAPS}/movil-mas-caro-1.png` })
}

console.log('── 2. Responder: se destapa, se marca y se pasa ──')
{
  await page.click('#mcrAcciones [data-respuesta="mas"]')
  // Desde la 835 el precio sube contando (0,7 s) y la pausa para leer el
  // veredicto es de 1,5 s.
  await page.waitForTimeout(900)
  const b = await page.locator('#mcrB').innerText()
  check('al responder se destapa el precio de B', /12,00\s?€/.test(b), b.replace(/\n/g, ' | '))
  check('  …en verde porque era «más»', (await page.locator('#mcrB.bien').count()) === 1)
  await page.waitForTimeout(900)
  const a = await page.locator('#mcrA').innerText()
  check('después, B pasa a ser A', /Carta 2/.test(a) && /12,00/.test(a), a.replace(/\n/g, ' | '))
  check('  …y la tira marca un acierto', (await page.locator('#mcrTira li.bien').count()) === 1)
  // Fallar a propósito.
  await page.click('#mcrAcciones [data-respuesta="mas"]')
  await page.waitForTimeout(300)
  check('un fallo se marca en rojo', (await page.locator('#mcrB.mal').count()) === 1)
  check('  …y lo dice: «¡Vaya!»', /¡Vaya!/.test(await page.locator('#mcrVeredicto').innerText()))
  await page.waitForTimeout(1500)
  check('  …y en la tira', (await page.locator('#mcrTira li.mal').count()) === 1)
}

console.log('── 3. Recargar no borra la partida ──')
{
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const sub = await page.locator('#mcrSub').innerText()
  check('sigue en la pregunta 3', /pregunta 3 de 5/.test(sub), sub)
  check('  …con la tira como estaba', (await page.locator('#mcrTira li.bien').count()) === 1 && (await page.locator('#mcrTira li.mal').count()) === 1)
}

console.log('── 4. Acabar y compartir ──')
{
  for (const r of BUENAS.slice(2)) {
    await page.click(`#mcrAcciones [data-respuesta="${r}"]`)
    await page.waitForTimeout(1800)
  }
  const final = page.locator('#mcrFinal')
  check('al acabar sale el resultado', await final.isVisible() && /4 de 5/.test(await final.innerText()), (await final.innerText()).slice(0, 80))
  check('  …y los botones se esconden', !(await page.locator('#mcrAcciones').isVisible()))
  check('  …con UN «Compartir» (871: texto e imagen van en la misma hoja)', (await page.locator('#mcrCompartir').count()) === 1 && (await page.locator('#mcrImagen').count()) === 0)
  if (CAPS) await page.screenshot({ path: `${CAPS}/movil-mas-caro-2.png` })
  // Desde la 988 la hoja es Instagram y X, sin pestaña de texto: el texto
  // es el que se publica en X, y se ve en su pestaña.
  await page.click('#mcrCompartir')
  await page.waitForTimeout(800)
  check('«Compartir» abre la hoja con Instagram y X', (await page.locator('.ch-hoja[open] [data-ch-red]').count()) === 2)
  await page.click('[data-ch-red="x"]')
  await page.waitForTimeout(1000)
  const texto = await page.locator('#chTextoX').innerText()
  check('el texto lleva número, 4/5, la tira y el enlace', new RegExp(`#${numeroDelDia(hoy)} · Más caro o barato · 4/5`).test(texto || '') && /🟩🟥🟩🟩🟩/.test(texto || '') && /pokedoc\.es\/mas-caro/.test(texto || ''), JSON.stringify(texto))
  // La imagen: Instagram › Publicación la dibuja a 1080×1350, la Historia a
  // 1080×1920 (988), y «Descargar» la baja.
  await page.click('[data-ch-red="instagram"]')
  await page.waitForTimeout(1000)
  const historia = await page.locator('#chPrevia img').evaluate((img) => ({ w: img.naturalWidth, h: img.naturalHeight })).catch(() => null)
  check('la historia se pinta a 1080×1920', historia?.w === 1080 && historia?.h === 1920, JSON.stringify(historia))
  await page.click('[data-ch-forma="publicacion"]')
  await page.waitForTimeout(1000)
  const previa = await page.locator('#chPrevia img').evaluate((img) => ({ w: img.naturalWidth, h: img.naturalHeight })).catch(() => null)
  check('la publicación se pinta a 1080×1350', previa?.w === 1080 && previa?.h === 1350, JSON.stringify(previa))
  const [descarga] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.click('[data-ch-descargar]'),
  ])
  check('  …y se descarga', !!descarga && /mas-caro-\d+\.png/.test(descarga.suggestedFilename()), descarga?.suggestedFilename())
  await page.click('[data-ch-red="x"]')
  await page.waitForTimeout(1000)
  const apaisada = await page.locator('#chPrevia img').evaluate((img) => ({ w: img.naturalWidth, h: img.naturalHeight })).catch(() => null)
  check('«Para X» la pinta a 1200×630', apaisada?.w === 1200 && apaisada?.h === 630, JSON.stringify(apaisada))
  await page.click('[data-ch-cerrar]')
}

console.log('── 5. Sin cartas, se dice ──')
{
  const p2 = await browser.newPage({ viewport: { width: 420, height: 900 } })
  await p2.route('**/.netlify/functions/mas-caro**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Todavía no hay cartas con precio suficientes.' }) }))
  await p2.goto(`${BASE}/mas-caro.html`, { waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(1200)
  // Desde la 787 el aviso es un estado vacío con salida a los otros retos.
  check('se avisa y no hay botones', /no se han podido traer/.test(await p2.locator('main .empty-state').innerText()) && !(await p2.locator('#mcrAcciones').isVisible()))
  await p2.close()
}

console.log('── 6. En /retos y en los otros dos retos ──')
{
  const p3 = await browser.newPage({ viewport: { width: 420, height: 900 } })
  await p3.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
  await p3.goto(`${BASE}/retos.html`, { waitUntil: 'domcontentloaded' })
  await p3.waitForTimeout(1200)
  check('el índice lista SEIS retos (835)', (await p3.locator('.rt-reto').count()) === 6)
  const caja = p3.locator('#rtMasCaroEstado')
  // Desde la 989 la baldosa entera es el enlace y lleva UNA línea.
  check('  …con el tercero sin jugar: lo que da, y la baldosa lleva al juego', /Hasta \+30 XP · 5 rondas/.test(await caja.innerText()) && (await p3.locator('#rtMasCaro').getAttribute('href')) === '/mas-caro', await caja.innerText())
  // Con una partida a medias guardada en el navegador, lo dice.
  await p3.evaluate((d) => localStorage.setItem('pokedoc-mas-caro', JSON.stringify({ dia: d, respuestas: [true, false] })), hoy)
  await p3.reload({ waitUntil: 'domcontentloaded' })
  await p3.waitForTimeout(1000)
  check('  …y a medias dice por dónde vas', /^A medias · Ronda 3 de 5$/i.test((await caja.innerText()).trim()) && (await p3.locator('#rtSello-mas-caro, #rtSello-caro').first().innerText()).includes('A medias'), await caja.innerText())
  await p3.close()
  // Los otros dos retos llevan el botón de imagen (se dibuja con la misma
  // pieza, reto-imagen.js). Aquí se mira que exista y use la pieza; la
  // pantalla de resultado de cada uno la cubren la 568 y la 570.
  const { readFileSync } = await import('node:fs')
  const curso = readFileSync('/home/user/pingu/js/curso.js', 'utf8')
  const carta = readFileSync('/home/user/pingu/js/carta-del-dia-juego.js', 'utf8')
  check('el reto diario abre la hoja de compartir con la imagen de reto-imagen.js', /compartir-hoja\.js/.test(curso) && /reto-imagen\.js/.test(curso) && /pintarResultadoReto\(/.test(curso))
  check('«¿Qué carta es?» también, con la foto de la carta', /compartir-hoja\.js/.test(carta) && /fotoParaElLienzo\(/.test(carta) && /filas: estado\.intentos/.test(carta))
}

check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
