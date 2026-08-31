// Lo que ve la web ANTES de que se ejecuten las dos migraciones nuevas.
// Es el estado real de producción durante unas horas, así que tiene que
// aguantarlo sin romperse.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const b = await chromium.launch()
let malos = 0

for (const [nombre, ruta, extra] of [
  ['/mis-partidas', '/mis-partidas', {}],
  ['la ficha de un torneo terminado', '/torneo?slug=copa', {
    __FAKE_TORNEOS__: [{ id: 'torneo-1', slug: 'copa', name: 'Copa', status: 'finished', admin_id: 'admin-1', max_players: 8, swiss_rounds: 3 }],
    __FAKE_INSCRIPCIONES__: [{ id: 'i1', tournament_id: 'torneo-1', user_id: 'user-1', status: 'active', tcg_live_username: 'Ash' }],
  }],
]) {
  const page = await b.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.addInitScript((s) => {
    window.__FAKE_SESSION__ = 'user-1'
    // Las tablas nuevas NO existen: el doble las quita para imitar a una
    // base donde la migración aún no se ha pasado.
    window.__SIN_TABLAS__ = ['tcg_archetypes', 'match_log']
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, extra)
  await page.goto(`http://localhost:8892${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const vivo = await page.evaluate(() => document.body.innerText.length > 40)
  console.log(`${errores.length === 0 && vivo ? 'ok    ' : 'FALLA '} ${nombre}${errores[0] ? ' — ' + errores[0] : ''}`)
  if (errores.length || !vivo) malos++
  await page.close()
}
await b.close()
process.exit(malos ? 1 : 0)
