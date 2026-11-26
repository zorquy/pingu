// Tanda 1457 — Torneos que se repiten, en la web:
//   1. El creador pregunta «¿Se repite?» en «Dale tu toque», lo dice en el
//      resumen y lo guarda (`repite`).
//   2. La agenda pone «Cada viernes» en la fila.
//   3. La ficha dice cada cuánto y las tres próximas fechas.
//   4. Quien organiza tiene «⋯ › Dejar de repetir», que quita `repite`.
//   5. Un jugador no ve «Dejar de repetir»; un terminado no dice nada.
//   6. Lo puro: «Cada dos sábados».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
// El próximo viernes a las 17:00 UTC (18:00 o 19:00 en Madrid: viernes igual).
const viernes = (() => {
  const d = new Date()
  d.setUTCHours(17, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7 || 7))
  return d.toISOString()
})()
const T = (extra = {}) => ({ id: 'torneo-1', slug: 'viernes', name: 'Liga del viernes', status: 'registration_open', admin_id: 'admin-1', swiss_rounds: 4, top_cut_size: 0, max_players: 16, start_at: viernes, format: 'standard', checkin_minutes: 0, round_time_minutes: 50, modalidad: 'presencial', lugar: 'Cartas Bilbao', direccion: 'Calle Ercilla 12, Bilbao', inscripcion: 'pedir', repite: 'semanal', serie_id: 'torneo-1', ...extra })

const browser = await chromium.launch()
async function abrir(ruta, { sesion = 'admin-1', torneos = [T()] } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  page.on('dialog', (d) => d.accept())
  await page.route(/\/sprite\/|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  await page.addInitScript(([s, t]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = t
    window.__FAKE_INSCRIPCIONES__ = []
    window.__FAKE_PERFILES__ = [{ id: 'user-1', username: 'pingu' }, { id: 'admin-1', username: 'tienda' }]
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, [sesion, torneos])
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.evaluate(() => document.querySelectorAll('dialog[open]:not(#torneoCrear)').forEach((d) => d.close()))
  return { page, errores }
}
const espera = (page, ms = 320) => page.waitForTimeout(ms)

console.log('── 1. El creador ──')
{
  const { page, errores } = await abrir('/torneos', { torneos: [] })
  await page.click('#btnNuevoTorneo')
  await page.waitForSelector('#torneoCrear[open]')
  await page.fill('#torneoNombre', 'Liga del viernes')
  await page.keyboard.press('Enter'); await espera(page)
  await page.click('.tc-opcion[data-campo="torneoModalidad"][data-valor="presencial"]'); await espera(page)
  await page.fill('#torneoLugar', 'Cartas Bilbao')
  await page.click('#btnPasoSiguiente'); await espera(page)
  await page.click('.tc-opcion[data-campo="torneoTipo"][data-valor="standard"]'); await espera(page)
  await page.click('[data-chips="dia"] [data-dia]:nth-child(2)')
  await page.click('#btnPasoSiguiente'); await espera(page)
  await page.click('.tc-opcion[data-campo="torneoPlazas"][data-valor="16"]'); await espera(page)
  await page.click('#btnPasoSiguiente'); await espera(page)
  await page.click('.tc-opcion[data-campo="torneoMinutos"][data-valor="50"]'); await espera(page)
  await page.click('.tc-opcion[data-campo="torneoInscripcion"][data-valor="pedir"]'); await espera(page)
  await page.click('.tc-opcion[data-campo="torneoListasModo"][data-valor="al_terminar"]'); await espera(page)
  const extra = page.locator('[data-extra="repite"]')
  check('«Dale tu toque» tiene «¿Se repite?» y dice «Solo esta vez»', (await extra.isVisible()) && /Solo esta vez/.test(await extra.textContent()), await extra.textContent().catch(() => ''))
  await page.click('[data-extra="repite"] summary')
  await page.selectOption('#torneoRepite', 'semanal')
  await page.dispatchEvent('#torneoRepite', 'change')
  await espera(page)
  await page.click('#btnPasoSiguiente'); await espera(page)
  const resumen = (await page.textContent('#wizardResumen')).replace(/\s+/g, ' ')
  check('el resumen lo dice («cada semana»)', /cada semana/.test(resumen), resumen)
  await page.click('#btnCrearTorneo')
  await page.waitForTimeout(1500)
  const fila = await page.evaluate(() => (window.__TABLAS__?.tournaments || []).find((t) => t.name === 'Liga del viernes'))
  check('se guarda con repite = semanal', fila?.repite === 'semanal', JSON.stringify(fila))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 2. La agenda ──')
{
  const { page, errores } = await abrir('/torneos', { sesion: 'user-1', torneos: [T(), T({ id: 'torneo-2', slug: 'otro', name: 'Copa suelta', repite: null })] })
  const chapas = await page.evaluate(() => [...document.querySelectorAll('.torneo-fila')].map((f) => `${f.dataset.torneoId}:${f.querySelector('.torneo-chapa-repite')?.textContent.trim() || '-'}`).sort())
  check('«Cada viernes» en la fila del que se repite, y nada en el otro', chapas.join() === 'torneo-1:Cada viernes,torneo-2:-', chapas.join())
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 3 y 4. La ficha y «Dejar de repetir» ──')
{
  const { page, errores } = await abrir('/torneo?slug=viernes&ver=torneo')
  const serie = await page.$eval('#torneoSerie', (l) => l.textContent.replace(/\s+/g, ' ').trim()).catch(() => '')
  check('dice «Cada viernes» y tres próximas fechas', /Cada viernes/.test(serie) && (serie.match(/Próximos: (.*?)\./)?.[1] || '').split(' · ').length === 3, serie)
  check('hay «Dejar de repetir» en el «⋯»', Boolean(await page.$('#torneoMasMenu #btnDejarDeRepetir')))
  await page.evaluate(() => document.getElementById('btnDejarDeRepetir').click())
  await page.waitForTimeout(900)
  const repite = await page.evaluate(() => (window.__TABLAS__?.tournaments || []).find((t) => t.id === 'torneo-1')?.repite)
  check('y quita `repite`', repite === null, String(repite))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 5. Quién no lo ve ──')
{
  const { page } = await abrir('/torneo?slug=viernes&ver=torneo', { sesion: 'user-1' })
  check('un jugador ve la serie pero no «Dejar de repetir»', Boolean(await page.$('#torneoSerie')) && !(await page.$('#btnDejarDeRepetir')))
  await page.close()
}
{
  const { page } = await abrir('/torneo?slug=viernes&ver=torneo', { torneos: [T({ status: 'finished' })] })
  check('un terminado no dice que se repite', !(await page.$('#torneoSerie')) && !(await page.$('#btnDejarDeRepetir')))
  await page.close()
}

console.log('\n── 6. Lo puro ──')
{
  const page = await browser.newPage()
  await page.goto(`${BASE}/torneos`, { waitUntil: 'domcontentloaded' })
  const r = await page.evaluate(async () => {
    const m = await import('/js/torneos/agenda-puro.js')
    return [
      m.textoDeRepite({ repite: 'quincenal', start_at: '2026-12-05T17:00:00Z' }),
      m.textoDeRepite({ repite: 'semanal', start_at: '2026-12-02T17:00:00Z' }),
      m.textoDeRepite({ repite: null, start_at: '2026-12-02T17:00:00Z' }),
      m.proximasDeSerie({ repite: 'quincenal', start_at: '2026-12-05T17:00:00Z' }, 2).map((d) => d.toISOString().slice(0, 10)),
    ]
  })
  check('«Cada dos sábados»', r[0] === 'Cada dos sábados', r[0])
  check('«Cada miércoles»', r[1] === 'Cada miércoles', r[1])
  check('sin repetir, nada', r[2] === '')
  check('las próximas, de 14 en 14 días', r[3].join() === '2026-12-19,2027-01-02', r[3].join())
  await page.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
