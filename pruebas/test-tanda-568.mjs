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
  check('lleva el número del día y el nombre corto (870: «PokeDoc #N · El reto · c/t»)', new RegExp(`^PokeDoc #${numeroDelDia(hoy)} · El reto · `).test(t), t.split('\n')[0])
  check('  …el resultado y la medalla', /4\/5 🥈/.test(t))
  check('  …la tira', /🟩🟩🟥🟩🟩/.test(t))
  check('  …la racha', /🔥 12 días seguidos/.test(t))
  check('  …y el enlace corto', t.trim().endsWith(ENLACE))
  check('con un día de racha no se presume de racha', !/días seguidos/.test(textoParaCompartir({ dia: hoy, tira: [true], correct: 1, total: 1, medal: 'oro', rachaDias: 1 })))
  check('  …y sin medalla, la diana', /🎯/.test(textoParaCompartir({ dia: hoy, tira: [false, false], correct: 0, total: 2, medal: null })))
  // Desde la 989 el cuestionario ya no es un reto: /reto lleva al menú.
  check('/reto lleva a /retos en netlify.toml (989, un 301)', /from = "\/reto"\s*\n\s*to = "\/retos"\s*\n\s*status = 301/.test(readFileSync('/home/user/pingu/netlify.toml', 'utf8')))
}

console.log('── 3. El cuestionario ya no se juega como reto (989) ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
  await page.addInitScript(() => { window.__FAKE_SESSION__ = 'admin-1' })
  await page.goto(`${BASE}/curso.html?reto=hoy`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/retos/, { timeout: 8000 }).catch(() => {})
  check('un enlace viejo a curso.html?reto=hoy acaba en /retos', /\/retos(\.html)?$/.test(new URL(page.url()).pathname), page.url())
  await browser.close()
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
