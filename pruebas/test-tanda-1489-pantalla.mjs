// Tanda 1489 — Mis partidas › Torneos en el móvil (un usuario, con un Redmi
// Note 11S de 393 px: «fallo de CSS con los textos» y «fallo de overflow-x con
// los botones de administrar el torneo»). A 393 y a 360: el nombre del rival
// no se monta sobre la letra del resultado, Editar/Borrar van en su línea y
// los botones del torneo no se salen de la tarjeta.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const E = await import(`${RAIZ}/js/estadisticas-partidas.js`)
const hoy = E.hoyLocal()
const RIV = [['d:mega absol ex|yveltal', 'Mega Absol Yveltal', 'win'], ['d:dragapult ex', 'Dragapult', 'win'], ['d:dragapult ex|dudunsparce', 'Dragapult Dudunsparce', 'loss'], ['d:dragapult ex', 'Dragapult', 'draw']]
const RONDAS = RIV.map(([k, n, r], i) => ({ id: `r${i}`, user_id: 'user-1', torneo_id: 'lt1', mi_mazo: 'd:mega lucario ex', mi_mazo_nombre: 'Mega Lucario', rival_mazo: k, rival_mazo_nombre: n, resultado: r, jugada_el: hoy, donde: 'Torneo local', created_at: new Date(Date.now() + i * 6e5).toISOString() }))
const TORNEOS = [{ id: 'lt1', user_id: 'user-1', nombre: 'DZ Sani Challenge', donde: 'Torneo local', mi_mazo: 'd:mega lucario ex', mi_mazo_nombre: 'Mega Lucario', jugado_el: hoy, cerrado_el: null }]
const b = await chromium.launch()
for (const ancho of [393, 360]) {
  const p = await b.newPage({ viewport: { width: ancho, height: 873 }, isMobile: true, hasTouch: true })
  const errores = []; p.on('pageerror', (e) => errores.push(e.message))
  await p.route(/cdn\.jsdelivr|limitlesstcg|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  await p.addInitScript(([pp, t]) => { window.__FAKE_SESSION__ = 'user-1'; window.__FAKE_PARTIDAS__ = pp; window.__FAKE_LOG_TORNEOS__ = t }, [RONDAS, TORNEOS])
  await p.goto(`${BASE}/mis-partidas?ver=torneos`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  const tab = await p.$('#partidasTabs [data-vista="torneos"]'); if (tab) { await tab.click(); await p.waitForTimeout(500) }
  await p.locator('.pt-rejilla >> text=DZ Sani Challenge').first().click()
  await p.waitForTimeout(700)
  const r = await p.evaluate(() => {
    const filas = [...document.querySelectorAll('.pt-abierto .partidas-torneo-rondas li')]
    const pisan = filas.filter((li) => {
      const n = li.querySelector('.partidas-ronda-rival > span:last-child')?.getBoundingClientRect()
      const v = li.querySelector('.partidas-ronda-res')?.getBoundingClientRect()
      return n && v && n.right > v.left + 1 && n.bottom > v.top && n.top < v.bottom
    }).length
    const acciones = filas.map((li) => { const a = li.querySelector('.partidas-ronda-acciones')?.getBoundingClientRect(); const v = li.querySelector('.partidas-ronda-res')?.getBoundingClientRect(); return a && v ? a.top >= v.bottom - 1 : null })
    const tarjeta = document.querySelector('.pt-abierto').getBoundingClientRect()
    const fuera = [...document.querySelectorAll('.pt-abierto .partidas-torneo-acciones > *')].filter((x) => x.getBoundingClientRect().right > tarjeta.right + 1).map((x) => x.textContent.trim())
    return { filas: filas.length, pisan, acciones, fuera, ancho: document.documentElement.scrollWidth, vista: innerWidth }
  })
  check(`${ancho}: ningún nombre se monta sobre la V/D/E`, r.filas === 4 && r.pisan === 0, JSON.stringify(r))
  check(`${ancho}: Editar y Borrar, debajo`, r.acciones.every(Boolean), JSON.stringify(r.acciones))
  check(`${ancho}: los botones del torneo, dentro de la tarjeta`, !r.fuera.length && r.ancho <= r.vista, JSON.stringify(r))
  check(`${ancho}: sin errores`, !errores.length, errores.join(' | '))
  await p.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
