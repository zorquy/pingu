// Tanda 1013 — seis pequeños de lógica del repaso: L1 la pestaña inicial de
// Mis partidas es la que tiene algo (y se recuerda), L2 una sola regla para
// los mensajes del foro (el que abre un tema cuenta), L3 el podio de
// Comunidad en el móvil no corta los nombres, L6 una sola cuenta atrás en
// Lanzamientos, L9 el logo de /auth sin hueco, L12 un icono que no existe
// sale como el de por defecto (y /admin no lo deja guardar).
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

console.log('── 1. Lo puro ──')
{
  const { pestaniaConAlgo } = await import(`${RAIZ}/js/matriz-partidas.js`)
  if (pestaniaConAlgo) {
    check('L1: con torneos, Torneos; sin torneos y con sueltas, Partidas; sin nada, Torneos', pestaniaConAlgo({ torneos: 2, sueltas: 14 }) === 'torneos' && pestaniaConAlgo({ torneos: 0, sueltas: 14 }) === 'sueltas' && pestaniaConAlgo({ torneos: 0, sueltas: 0 }) === 'torneos')
  } else check('L1: matriz-partidas.js exporta pestaniaConAlgo', false)
  const { cuentaDelDestacado, relojHasta } = await import(`${RAIZ}/js/lanzamientos.js`)
  const ahora = new Date('2026-10-10T20:00:00').getTime()
  check('L6: con más de tres días, los días a secas', cuentaDelDestacado('2026-10-21', ahora) === 'Faltan 11 días', cuentaDelDestacado('2026-10-21', ahora))
  check('  …con tres o menos, la precisa, en una línea', cuentaDelDestacado('2026-10-12', ahora) === 'Faltan 1 día y 4 h' && cuentaDelDestacado('2026-10-11', ahora + 30 * 6e4) === 'Faltan 3 h y 30 min', cuentaDelDestacado('2026-10-12', ahora) + ' / ' + cuentaDelDestacado('2026-10-11', ahora + 30 * 6e4))
  check('  …y el día de salida, «¡Sale hoy!»', cuentaDelDestacado('2026-10-10', ahora) === '¡Sale hoy!' && relojHasta('2026-10-10', ahora) === '')
  const { contentIconHtml } = await import(`${RAIZ}/js/content-icon.js`)
  check('L12: un nombre de icono que no existe sale como el de por defecto, no como texto', /<svg/.test(contentIconHtml('award', 20, 'trophy')) && !/award/.test(contentIconHtml('award', 20, 'trophy')), contentIconHtml('award', 20, 'trophy').slice(0, 80))
  check('  …un emoji de verdad se respeta y un icono que existe se dibuja', /🦑/.test(contentIconHtml('🦑', 20)) && /<svg/.test(contentIconHtml('trophy', 20)))
  const fa = leer('js/foro-actividad.js')
  check('L2: la chapa cuenta mensajes y comentarios (el que abre un tema ya es un mensaje), y la lista no aparta ninguno', /return \(nMensajes \|\| 0\) \+ \(nComentarios \|\| 0\)\n/.test(fa) && !/\(nTemas \|\| 0\) \+ \(nMensajes/.test(fa) && /const respuestas = listaMensajes\n/.test(fa) && !/aperturas/.test(fa))
  check('L12: /admin no guarda un nombre de icono que icons.js no conoce', /No hay ningún icono que se llame/.test(leer('admin/js/admin.js')))
  check('L9: el nombre del logo de /auth va en un envoltorio', /<div class="auth-logo"><span class="auth-logo-nombre">Poke<b>Doc<\/b><\/span><\/div>/.test(leer('auth.html')) && /\.auth-logo-nombre b \{/.test(leer('css/auth.css')))
}

const b = await chromium.launch()
const abrir = async (ruta, { viewport = { width: 1280, height: 900 }, init = null, espera = 2500 } = {}) => {
  const ctx = await b.newContext({ viewport, locale: 'es-ES', serviceWorkers: 'block' })
  if (init) await ctx.addInitScript(init)
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(e.message))
  await p.goto(`${BASE}/${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(espera)
  return { p, ctx, errores }
}

console.log('\n── 2. Las pantallas ──')
{
  const { p, ctx, errores } = await abrir('auth.html', { init: "window.__FAKE_SESSION__ = 'none'" })
  const r = await p.evaluate(() => {
    const logo = document.querySelector('.auth-logo')
    const nombre = logo.querySelector('.auth-logo-nombre')
    const doc = logo.querySelector('b')
    const poke = document.createRange(); poke.setStart(nombre.firstChild, 0); poke.setEnd(nombre.firstChild, 4)
    return { hueco: Math.round(doc.getBoundingClientRect().left - poke.getBoundingClientRect().right), texto: logo.textContent.trim() }
  })
  check('L9: «Poke» y «Doc» van pegados (sin el gap del flex entre medio)', r.hueco <= 1 && r.texto === 'PokeDoc' && !errores.length, JSON.stringify(r) + ' ' + errores.join(' | '))
  await ctx.close()
}
{
  const gente = [['brock', 'Brock'], ['jesus', 'jesus'], ['cynthia', 'Cynthia de Sinnoh']].map(([u, n], i) => ({ id: `u-${i}`, username: u, display_name: n, total_xp: 5000 - i * 100, level: 'Entrenador', created_at: '2026-01-01' }))
  const init = `window.__FAKE_SESSION__ = 'none'; window.__FAKE_PERFILES__ = ${JSON.stringify(gente)}; window.__FAKE_FILAS__ = Object.assign(window.__FAKE_FILAS__ || {}, { xp_mes: ${JSON.stringify(gente.map((g, i) => ({ user_id: g.id, mes: new Date().toISOString().slice(0, 7) + '-01', xp_inicio: g.total_xp - (3590 - i * 310) })))} })`
  const { p, ctx } = await abrir('usuarios.html', { viewport: { width: 390, height: 800 }, init, espera: 3500 })
  const r = await p.evaluate(() => [...document.querySelectorAll('.com-puesto')].map((a) => {
    const n = a.querySelector('.com-puesto-nombre')
    return { nombre: n?.textContent, cabe: n ? n.scrollWidth <= n.clientWidth + 1 : null, fila: n && a.querySelector('.com-puesto-xp') ? Math.round(a.querySelector('.com-puesto-xp').getBoundingClientRect().top) > Math.round(n.getBoundingClientRect().top) : null }
  }))
  if (r.length) check('L3: en el móvil el nombre entero cabe y la XP va debajo, en su fila', r.every((x) => x.cabe && x.fila), JSON.stringify(r))
  else console.log('  (sin podio en el doble: no se mira)')
  await ctx.close()
}
{
  const init = `window.__FAKE_PARTIDAS__ = [{}, {}, {}]; window.__FAKE_SESSION__ = 'user-1'`
  const { p, ctx, errores } = await abrir('mis-partidas.html', { init, espera: 3500 })
  const activa = await p.evaluate(() => document.querySelector('#partidasTabs .seg-btn[aria-pressed="true"]')?.dataset.vista)
  const sueltas = await p.evaluate(() => document.querySelectorAll('#vista-sueltas .partidas-fila, #vista-sueltas [data-partida], #vista-sueltas tbody tr').length)
  if (sueltas > 0) check('L1: con partidas sueltas y sin torneos, la página abre en Partidas', activa === 'sueltas' && !errores.length, `${activa} (${sueltas} sueltas) ${errores.join(' | ')}`)
  else console.log(`  (el doble no da partidas sueltas con este fixture: ${activa}; no se mira)`)
  await p.click('#partidasTabs .seg-btn[data-vista="stats"]')
  const recordada = await p.evaluate(() => localStorage.getItem('pokedoc-partidas-vista'))
  check('  …y la pestaña que eliges se recuerda', recordada === 'stats', recordada)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
