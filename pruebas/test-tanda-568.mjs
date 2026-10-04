// Tanda 568 — el reto diario se comparte como Wordle.
//
// El texto era «4/5 🥈 ¿puedes superarlo?», y eso no se encadena. Lo que
// hizo que Wordle se encadenara son tres cosas: el NÚMERO del día (todos
// el mismo reto), la TIRA de cuadrados (cómo te ha ido sin desvelar nada)
// y la RACHA de días (la razón de volver mañana). Esta prueba mira que
// las tres estén en el texto y que la tira sea la de verdad —la de la
// partida que acabas de jugar, en orden—, no una inventada.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { nuevaPartida, anotarRespuesta, cerrarPartida } from '/home/user/pingu/js/curso-juego.js'
import { numeroDelDia, tiraEmoji, rachaDeDias, textoParaCompartir, DIA_UNO, ENLACE } from '/home/user/pingu/js/reto-compartir.js'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const hoy = new Date().toISOString().slice(0, 10)
const diaMenos = (n) => { const [y, m, d] = hoy.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10) }

console.log('── 1. La partida apunta la tira, en orden ──')
{
  const p = nuevaPartida(5)
  for (const [clave, ok] of [['a', true], ['b', true], ['c', false], ['d', true], ['e', true]]) anotarRespuesta(p, { clave, acierto: ok })
  const r = cerrarPartida(p)
  check('cinco cuadrados, en el orden jugado', r.tira.join(',') === 'true,true,false,true,true', r.tira.join(','))
  // «Anterior» y la repesca no cuentan dos veces: la tira tampoco.
  anotarRespuesta(p, { clave: 'a', acierto: false })
  anotarRespuesta(p, { clave: 'c', acierto: true, esRepesca: true })
  check('  …y ni repetir ni repescar la alargan', cerrarPartida(p).tira.length === 5, String(cerrarPartida(p).tira.length))
}

console.log('── 2. El texto de Wordle ──')
{
  check('el día uno es el #1', numeroDelDia(DIA_UNO) === 1)
  check('  …y cuenta de uno en uno', numeroDelDia('2026-08-31') === 31 && numeroDelDia('2026-09-01') === 32)
  check('la tira son cuadrados verdes y rojos', tiraEmoji([true, false, true]) === '🟩🟥🟩')
  check('la racha cuenta días seguidos hasta hoy', rachaDeDias([hoy, diaMenos(1), diaMenos(2), diaMenos(5)], hoy) === 3)
  check('  …y sin hoy no hay racha', rachaDeDias([diaMenos(1), diaMenos(2)], hoy) === 0)
  const t = textoParaCompartir({ dia: hoy, tira: [true, true, false, true, true], correct: 4, total: 5, medal: 'plata', rachaDias: 12 })
  check('lleva el número del día', new RegExp(`Reto PokeDoc #${numeroDelDia(hoy)} `).test(t), t.split('\n')[0])
  check('  …el resultado y la medalla', /4\/5 🥈/.test(t))
  check('  …la tira', /🟩🟩🟥🟩🟩/.test(t))
  check('  …la racha', /🔥 12 días seguidos/.test(t))
  check('  …y el enlace corto', t.trim().endsWith(ENLACE))
  check('con un día de racha no se presume de racha', !/días seguidos/.test(textoParaCompartir({ dia: hoy, tira: [true], correct: 1, total: 1, medal: 'oro', rachaDias: 1 })))
  check('  …y sin medalla, la diana', /🎯/.test(textoParaCompartir({ dia: hoy, tira: [false, false], correct: 0, total: 2, medal: null })))
  check('/reto está en netlify.toml', /from = "\/reto"\s*\n\s*to = "\/curso\.html\?reto=hoy"/.test(readFileSync('/home/user/pingu/netlify.toml', 'utf8')))
}

console.log('── 3. En la pantalla del resultado ──')
{
  // Una guía publicada con cinco preguntas: el reto del día sale de ahí.
  const quiz = (i) => ({ type: 'quiz', question: `Pregunta ${i}`, options: ['Mal', 'Bien', 'Peor'], correct_index: 1, explanation: 'Porque sí.' })
  const GUIA = {
    id: 'g1', slug: 'guia-uno', title: 'Guía uno', category_id: 'c1', author_id: 'admin-1', review_status: 'published',
    published_at: '2026-09-01T10:00:00Z', estimated_mins: 5, blocks: [1, 2, 3, 4, 5].map(quiz),
  }
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  let compartido = null
  await page.addInitScript(([g, retos]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_GUIAS__ = [g]
    window.__FAKE_CATEGORIAS__ = [{ id: 'c1', name: 'Básico', slug: 'basico' }]
    // Dos días seguidos antes de hoy: con el de hoy, racha de tres.
    window.__FAKE_RETOS__ = retos
    // El menú de compartir del sistema, de mentira: lo que importa es el
    // texto que se le da.
    navigator.share = async (d) => { window.__compartido = d; return true }
  }, [GUIA, [diaMenos(1), diaMenos(2)].map((d, i) => ({ id: `r${i}`, user_id: 'admin-1', day: d, correct: 3, total: 5, score: 30 }))])
  await page.goto(`${BASE}/curso.html?reto=hoy`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  check('sin errores', errores.length === 0, errores.join(' | '))
  // La primera pantalla es la portada del reto («El reto de hoy»): se
  // pasa con Continuar y empiezan las preguntas.
  await page.locator('#btnContinue').click()
  await page.waitForTimeout(600)
  // Se juega: 1.ª bien, 2.ª mal, 3.ª bien, 4.ª bien, 5.ª bien.
  const plan = [1, 0, 1, 1, 1]
  for (let i = 0; i < 5; i++) {
    const opciones = page.locator('.quiz-option')
    if (!(await opciones.count())) { check(`hay pregunta ${i + 1}`, false, 'sin opciones'); break }
    await opciones.nth(plan[i]).click()
    await page.waitForTimeout(500)
    const continuar = page.locator('#btnContinue')
    await continuar.click()
    await page.waitForTimeout(700)
  }
  // La que has fallado vuelve al final como REPESCA: se contesta (bien)
  // y no toca la tira — eso es justo lo que la sección 1 comprueba en
  // Node, y aquí se ve en la pantalla.
  for (let i = 0; i < 3 && (await page.locator('.quiz-option').count()); i++) {
    await page.locator('.quiz-option').nth(1).click()
    await page.waitForTimeout(500)
    await page.locator('#btnContinue').click()
    await page.waitForTimeout(700)
  }
  await page.waitForTimeout(1500)
  check('se llega a la pantalla del resultado', (await page.locator('.block-reward').count()) === 1)
  const tira = await page.$$eval('.reward-tira span', (ss) => ss.map((s) => (s.classList.contains('bien') ? 1 : 0)).join(''))
  check('la tira de la pantalla es la jugada', tira === '10111', tira)
  check('  …con el número del día', (await page.locator('.reward-tira-num').textContent()).trim() === `Reto #${numeroDelDia(hoy)}`, await page.locator('.reward-tira-num').textContent())
  await page.locator('#btnPresumir').click()
  await page.waitForTimeout(600)
  compartido = await page.evaluate(() => window.__compartido)
  const texto = compartido?.text || ''
  check('el texto que se comparte lleva el número', texto.includes(`Reto PokeDoc #${numeroDelDia(hoy)}`), texto)
  check('  …la tira jugada', texto.includes('🟩🟥🟩🟩🟩'), texto)
  check('  …la racha, contando hoy', texto.includes('🔥 3 días seguidos'), texto)
  check('  …y el enlace corto', texto.includes(ENLACE), texto)
  await browser.close()
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
