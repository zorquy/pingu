// Tanda 1451 — El Modo juez en consola (propuesta «El torneo, de nuevo»,
// PINGU: «la interfaz de juez es horrible… las decklists ahí abajo, scroll
// infinito… tiene que ser más visual»):
//   1. PC: tres columnas, tickets · mesas (con las listas debajo) · chat; tocar
//      una mesa abre su chat en la columna de la derecha.
//   2. Las listas ya no van en la página: un resumen (11/12, quién falta) y
//      «Ver las listas» abre una ventana con buscador.
//   3. Móvil: tres vistas (Tickets · Mesas · Listas) y el chat en una hoja.
//   4. Quien juega y no arbitra no ve el Modo juez.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ahora = Date.now()
const hace = (min) => new Date(ahora - min * 60000).toISOString()
const NOMBRES = ['ash', 'misty', 'brock', 'gary', 'erika', 'koga', 'sabrina', 'blaine', 'giovanni', 'lance', 'bruno', 'agatha']
const JUG = NOMBRES.map((_, i) => `p${i + 1}`)
const T = { id: 'torneo-1', slug: 'copa', name: 'Copa del Juez', status: 'in_progress', admin_id: 'admin-1', swiss_rounds: 3, top_cut_size: 0, current_round_id: 'ronda-1', decklist_visibility: 'al_terminar', start_at: hace(60), format: 'standard', checkin_minutes: 5, round_time_minutes: 50 }
const MESAS = JUG.filter((_, i) => i % 2 === 0).map((a, t) => ({ id: `m${t + 1}`, round_id: 'ronda-1', table_number: t + 1, player_a_id: a, player_b_id: JUG[t * 2 + 1], status: t === 5 ? 'disputed' : 'active', check_in_a_at: hace(20), check_in_b_at: hace(20) }))
const L = (quantity, name, set, number) => ({ quantity, name, set, number })
const semillas = {
  __FAKE_PERFILES__: [...JUG.map((id, i) => ({ id, username: NOMBRES[i], display_name: NOMBRES[i] })), { id: 'admin-1', username: 'jefa', display_name: 'jefa' }],
  __FAKE_TORNEOS__: [T],
  __FAKE_INSCRIPCIONES__: JUG.map((u, i) => ({ id: `insc-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active', tcg_live_username: `TCG_${i}` })),
  __FAKE_RONDAS__: [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, status: 'active', phase: 'swiss', started_at: hace(25), ends_at: new Date(ahora + 25 * 60000).toISOString() }],
  __FAKE_MESAS__: MESAS,
  __FAKE_RESULTADOS__: [],
  // Once listas de doce: a agatha le falta.
  __FAKE_DECKLISTS__: JUG.slice(0, 11).map((u, i) => ({ id: `d${i}`, tournament_id: 'torneo-1', user_id: u, raw_text: 'Pokémon: 3\n3 Dreepy TWM 128', parsed_cards: { pokemon: [L(3, 'Dreepy', 'TWM', '128')], trainer: [], energy: [], total: 60 }, locked_at: i < 9 ? hace(30) : null })),
  __FAKE_LLAMADAS__: [
    { id: 'll-1', tournament_id: 'torneo-1', match_id: 'm2', created_by: 'p3', status: 'open', motivo: 'desconexion', detalle: 'Se me cayó', created_at: hace(3) },
    { id: 'll-2', tournament_id: 'torneo-1', match_id: 'm4', created_by: 'p7', status: 'in_progress', assigned_judge_id: 'admin-1', motivo: 'reglas', created_at: hace(6) },
  ],
  __FAKE_REPORTES__: [], __FAKE_TABLON__: [], __FAKE_JUECES__: [],
}

const browser = await chromium.launch()
async function abrir(sesion, movil = false) {
  const page = await browser.newPage(movil ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/sprite\/|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  await page.addInitScript(([s, se]) => {
    window.__FAKE_SESSION__ = s
    for (const [k, v] of Object.entries(se)) window[k] = v
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, [sesion, semillas])
  await page.goto(`${BASE}/torneo?slug=copa&ver=jueces`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.evaluate(() => document.querySelectorAll('dialog.torneo-ronda-entra[open]').forEach((d) => d.close()))
  return { page, errores }
}
const caja = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e || !e.checkVisibility()) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), pos: getComputedStyle(e).position } }, sel)

console.log('── 1. PC: la consola en tres columnas ──')
{
  const { page, errores } = await abrir('admin-1')
  check('se abre en el Modo juez', await page.evaluate(() => document.documentElement.dataset.torneoPestana === 'jueces'))
  const [t, m, c] = [await caja(page, '[data-col="tickets"]'), await caja(page, '[data-col="mesas"]'), await caja(page, '[data-col="chat"]')]
  check('tickets · mesas · chat, de izquierda a derecha y a la misma altura', t && m && c && t.x < m.x && m.x < c.x && Math.abs(t.y - m.y) < 4 && Math.abs(m.y - c.y) < 4, JSON.stringify({ t, m, c }))
  check('sin la fila de vistas del móvil', !(await caja(page, '#torneoJuezVistas')))
  const l = await caja(page, '[data-col="listas"]')
  check('las listas, debajo de las mesas', l && Math.abs(l.x - m.x) < 4 && l.y > m.y, JSON.stringify({ l, m }))
  const tickets = await page.$$eval('#colaContenido .torneo-ticket', (ts) => ts.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
  check('los dos tickets en su columna', tickets.length === 2 && /Mesa 2/.test(tickets.join()) && /Mesa 4/.test(tickets.join()), tickets.join(' | '))
  check('el chat, vacío hasta tocar algo', await page.locator('.torneo-juez-chat-vacio').isVisible())
  await page.click('.torneo-juez-mesa[data-ver-mesa="m3"]')
  await page.waitForTimeout(500)
  const abierta = await page.evaluate(() => ({ titulo: document.querySelector('[data-col="chat"] #mesaJuezAbierta h4')?.textContent, vis: document.getElementById('mesaJuezAbierta').checkVisibility(), vacio: document.querySelector('.torneo-juez-chat-vacio').checkVisibility() }))
  check('tocar la mesa 3 abre su chat a la derecha', abierta.vis && /Mesa 3/.test(abierta.titulo || '') && !abierta.vacio, JSON.stringify(abierta))

  console.log('\n── 2. Las listas en una ventana ──')
  const resumen = await page.evaluate(() => ({ texto: document.getElementById('listasJuezResumen')?.textContent.replace(/\s+/g, ' '), filasFuera: [...document.querySelectorAll('.torneo-decklist-fila')].filter((f) => f.checkVisibility()).length }))
  check('en la consola solo el resumen: 11/12, 9 selladas y quién falta', /11\/12 entregadas · 9 selladas/.test(resumen.texto || '') && /agatha/.test(resumen.texto || '') && resumen.filasFuera === 0, JSON.stringify(resumen))
  await page.click('[data-abrir-listas]')
  await page.waitForTimeout(300)
  const dentro = await page.evaluate(() => ({ abierta: document.getElementById('torneoListasJuez').open, filas: [...document.querySelectorAll('#decklistsJuezContenido [data-nombre]')].filter((f) => f.checkVisibility()).length }))
  check('«Ver las listas» abre la ventana con las once', dentro.abierta && dentro.filas === 11, JSON.stringify(dentro))
  await page.fill('#listasJuezBuscar', 'GAR')
  await page.waitForTimeout(200)
  const busca = await page.$$eval('#decklistsJuezContenido [data-nombre]', (fs) => fs.filter((f) => f.checkVisibility()).map((f) => f.dataset.nombre))
  check('buscar «GAR» deja a gary', busca.join() === 'gary', busca.join())
  await page.click('#decklistsJuezContenido [data-ver-decklist="p4"]')
  await page.waitForTimeout(400)
  check('«Ver» despliega su lista', await page.locator('[data-decklist-detalle="p4"]').isVisible())
  await page.click('[data-cerrar-listas]')
  check('y se cierra', !(await page.evaluate(() => document.getElementById('torneoListasJuez').open)))
  check('nada se sale', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 3. Móvil: tres vistas y el chat en una hoja ──')
{
  const { page, errores } = await abrir('admin-1', true)
  const vistas = await page.$$eval('#torneoJuezVistas [data-juez-vista]', (bs) => bs.map((b) => b.textContent.trim()))
  check('Tickets · Mesas · Listas, con su cifra', vistas.length === 3 && /^Tickets · \d+$/.test(vistas[0]) && vistas[1] === 'Mesas · 6' && vistas[2] === 'Listas · 11/12', vistas.join(' | '))
  const solo = async () => page.evaluate(() => [...document.querySelectorAll('.torneo-juez-col')].filter((c) => c.checkVisibility()).map((c) => c.dataset.col).join())
  check('abre en Tickets, sola', (await solo()) === 'tickets', await solo())
  await page.click('[data-juez-vista="mesas"]')
  await page.waitForTimeout(200)
  check('Mesas cambia a las mesas', (await solo()) === 'mesas', await solo())
  await page.click('.torneo-juez-mesa[data-ver-mesa="m1"]')
  await page.waitForTimeout(500)
  const hoja = await caja(page, '[data-col="chat"]')
  check('tocar una mesa abre su chat en una hoja de abajo', hoja && hoja.pos === 'fixed' && /Mesa 1/.test((await page.textContent('#mesaJuezAbierta h4')) || ''), JSON.stringify(hoja))
  await page.click('[data-cerrar-mesa]')
  await page.waitForTimeout(300)
  check('…y se cierra', !(await caja(page, '[data-col="chat"]')))
  check('nada se sale', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 4. Quien solo juega ──')
{
  const { page, errores } = await abrir('p1')
  check('no tiene «Modo juez» ni entra por ?ver=jueces', !(await page.$('#btnModoJuez')) && (await page.evaluate(() => document.documentElement.dataset.torneoPestana)) !== 'jueces')
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
