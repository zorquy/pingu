// Tanda 1285 — EL CALENDARIO DE ADVIENTO en la web, y la línea de la
// temporada GENERADA.
//
//   1. La línea de la cabecera sale de generar-temporada.mjs en las 55 páginas.
//   2. Lo puro: qué toca cada día (hora de España), cómo se pinta cada casilla.
//   3. La cabecera: `data-adviento` en diciembre desde el primer pintado (y
//      Halloween sigue igual); un navegador automático no lo ve.
//   4. Inicio: la tira con su sitio reservado (no salta), el pop-up, abrir la
//      de hoy y una pendiente, el logro con la 24.ª, sin cuenta y el móvil.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('\n── 1. La línea, generada ──')
{
  const g = await import(`${RAIZ}/generar-temporada.mjs`)
  const conMarca = g.paginas(RAIZ).filter((p) => /<script>\/\* Temporada \(1134/.test(readFileSync(p, 'utf8')))
  const distintas = conMarca.filter((p) => { const h = readFileSync(p, 'utf8'); return g.conLinea(h) !== h || !h.includes(g.LINEA) })
  check('las 55 páginas llevan la línea que sale del generador', conMarca.length >= 55 && distintas.length === 0, `${conMarca.length} con la línea; distintas: ${distintas.join(', ')}`)
}

console.log('\n── 2. Lo puro ──')
const p = await import(`${RAIZ}/js/adviento-puro.js`)
const d = (s) => new Date(s)
check('24 casillas, sin Pokémon repetidos, la 24 es Delibird', p.CASILLAS.length === 24 && new Set(p.CASILLAS.map((c) => c[0])).size === 24 && p.CASILLAS[23][1] === 'Delibird' && p.CASILLAS.every(([n, s, t]) => n > 0 && s && t.length > 20))
check('el 30 de noviembre, nada', p.adviento(d('2026-11-30T12:00:00+01:00')) === null)
check('el 12 de diciembre, la 12', JSON.stringify(p.adviento(d('2026-12-12T12:00:00+01:00'))) === '{"anio":2026,"dia":12,"hasta":12}')
check('el 28, se pueden abrir hasta la 24', p.adviento(d('2026-12-28T12:00:00+01:00')).hasta === 24)
check('la hora es la de España: las 23:30 del 30 de noviembre en UTC ya es 1 de diciembre', p.adviento(d('2026-11-30T23:30:00Z'))?.dia === 1)
{
  const a = p.adviento(d('2026-12-12T12:00:00+01:00'))
  const ab = new Set([1, 2, 3, 5])
  check('casillas: abierta, hoy, pendiente y cerrada', [p.estadoCasilla(1, a, ab), p.estadoCasilla(12, a, ab), p.estadoCasilla(4, a, ab), p.estadoCasilla(13, a, ab)].join() === 'abierta,hoy,pendiente,cerrada')
  check('el botón abre la de hoy si falta', p.siguienteCasilla(a, ab) === 12)
  check('  …y si no, la primera pendiente', p.siguienteCasilla(a, new Set([...ab, 12])) === 4)
  check('la frase del día', p.resumenAdviento(a, ab) === 'Día 12: tu casilla te espera' && p.resumenAdviento(a, new Set([...ab, 12])) === 'Día 12 · llevas 5 de 12')
  const a28 = p.adviento(d('2026-12-28T12:00:00+01:00'))
  check('del 25 al 31, quedan las que falten', /quedan hasta el 31/.test(p.resumenAdviento(a28, ab)))
}

const browser = await chromium.launch()
const LOGRO = { id: 'adviento_2026', title: 'Adviento 2026', description: 'Abriste las 24 casillas del Calendario de Adviento de 2026.', emoji: 'gift', rarity: 'gold', xp_reward: 50, is_active: true, condition: { type: 'adviento', anio: 2026 } }
async function abrir({ ruta = '/', fecha = '2026-12-12', hora = '12:00:00', humano = true, sesion = 'user-1', dias = [], movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.route(/jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><circle cx="80" cy="80" r="60" fill="#7fc4e6"/></svg>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.clock.setFixedTime(new Date(`${fecha}T${hora}+01:00`))
  await page.addInitScript(({ humano, sesion, dias, LOGRO }) => {
    if (sesion) window.__FAKE_SESSION__ = sesion
    if (humano) Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })
    window.__FAKE_ADVIENTO__ = dias.map((dia) => ({ dia }))
    window.__FAKE_LOGROS__ = [LOGRO]
    try {
      localStorage.setItem('pokedoc-instalar-no', String(Date.now()))
      localStorage.setItem('pokedoc-push-no', JSON.stringify({ en: Date.now(), veces: 2 }))
      for (const s of ['inicio', 'aprender', 'cartas', 'comunidad', 'jugar']) localStorage.setItem(`pd-bienvenida-${s}`, '1')
    } catch {}
  }, { humano, sesion, dias, LOGRO })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  const alPintar = await page.evaluate(() => ({ adv: document.documentElement.hasAttribute('data-adviento'), t: document.documentElement.dataset.temporada || null, panel: Math.round(document.getElementById('panelPortada')?.getBoundingClientRect().top ?? -1) }))
  await page.waitForTimeout(2200)
  return { ctx, page, errores, alPintar }
}
const tira = (page) => page.evaluate(() => {
  const c = document.getElementById('adviento')
  const r = c?.getBoundingClientRect()
  return {
    visible: !!c && getComputedStyle(c).display !== 'none', alto: r ? Math.round(r.height) : 0,
    texto: c?.querySelector('.adv-texto small')?.textContent || '', boton: c?.querySelector('.adv-boton')?.textContent.trim() || '',
    href: c?.querySelector('a.adv-boton')?.getAttribute('href') || null,
    puntos: [...(c?.querySelectorAll('.adv-punto') || [])].map((x) => x.className.replace('adv-punto adv-', '')),
    panel: Math.round(document.getElementById('panelPortada')?.getBoundingClientRect().top ?? -1),
  }
})
const pop = (page) => page.evaluate(() => {
  const d = document.querySelector('dialog.adv-pop')
  const r = d?.getBoundingClientRect()
  return {
    abierto: !!d?.open, titulo: d?.querySelector('.adv-revelo h3')?.textContent || '', premio: d?.querySelector('[data-adv-premio]')?.textContent.trim() || '',
    casillas: [...(d?.querySelectorAll('.adv-casilla') || [])].map((b) => `${b.className.replace('adv-casilla adv-', '')}${b.disabled ? '·x' : ''}`),
    caja: r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left) } : null, alto: innerHeight,
  }
})

console.log('\n── 3. La cabecera ──')
{
  const { ctx, alPintar } = await abrir({ fecha: '2026-11-30' })
  check('el 30 de noviembre, sin hueco', !alPintar.adv, JSON.stringify(alPintar))
  await ctx.close()
}
{
  const { ctx, alPintar } = await abrir({ humano: false })
  check('un navegador automático no lo ve en diciembre (la suite sigue igual)', !alPintar.adv, JSON.stringify(alPintar))
  await ctx.close()
}
{
  const { ctx, alPintar } = await abrir({ ruta: '/?temporada=adviento', fecha: '2026-06-15', humano: false })
  check('con ?temporada=adviento, sí', alPintar.adv, JSON.stringify(alPintar))
  await ctx.close()
}
{
  const { ctx, alPintar } = await abrir({ ruta: '/foro', fecha: '2026-10-31' })
  check('Halloween sigue igual con la línea nueva (el 31, de noche)', alPintar.t === 'halloween' && !alPintar.adv, JSON.stringify(alPintar))
  await ctx.close()
}

console.log('\n── 4. Inicio, el 12 de diciembre ──')
{
  const { ctx, page, errores, alPintar } = await abrir({ dias: [1, 2, 3, 5] })
  check('desde el primer pintado, con su sitio', alPintar.adv, JSON.stringify(alPintar))
  const t = await tira(page)
  check('la tira: «Día 12: tu casilla te espera» y «Abrir la 12»', t.visible && t.texto === 'Día 12: tu casilla te espera' && t.boton === 'Abrir la 12', JSON.stringify(t))
  check('  …con los 24 puntos: 4 abiertas, la de hoy, las pendientes y las cerradas', t.puntos.length === 24 && t.puntos.filter((x) => x === 'abierta').length === 4 && t.puntos[11] === 'hoy' && t.puntos[3] === 'pendiente' && t.puntos[12] === 'cerrada', t.puntos.join())
  check('  …y lo de debajo no se ha movido al llegar (el sitio estaba reservado)', Math.abs(t.panel - alPintar.panel) <= 2, `${alPintar.panel} → ${t.panel}`)
  await page.click('#adviento [data-adv-abrir="12"]')
  await page.waitForTimeout(600)
  let e = await pop(page)
  check('«Abrir la 12»: Mamoswine, con su +10 XP', e.abierto && e.titulo === 'Mamoswine' && e.premio === '+10 XP', JSON.stringify(e))
  check('  …y la base lo ha apuntado', await page.evaluate(async () => { const { supabase } = await import('/js/supabase.js'); const { data } = await supabase.from('adviento_casillas').select('dia'); return data.map((x) => x.dia).sort((a, b) => a - b).join() }) === '1,2,3,5,12')
  await page.click('[data-adv-volver]')
  await page.waitForTimeout(300)
  e = await pop(page)
  check('«Volver al calendario»: la 12 abierta, la 4 pendiente y la 13 cerrada (sin poder pulsarla)', e.casillas[11] === 'abierta' && e.casillas[3] === 'pendiente' && e.casillas[12] === 'cerrada·x', e.casillas.join())
  await page.click('.adv-pop [data-adv-abrir="4"]')
  await page.waitForTimeout(500)
  e = await pop(page)
  check('una de días pasados (la 4, Cubchoo) se abre tarde con su XP', e.titulo === 'Cubchoo' && e.premio === '+10 XP', JSON.stringify(e))
  await page.click('[data-adv-cerrar]')
  await page.waitForTimeout(300)
  const t2 = await tira(page)
  check('al cerrar, la tira dice cuántas llevas', !(await pop(page)).abierto && t2.texto === 'Día 12 · llevas 6 de 12' && t2.boton === 'Abrir la 6', JSON.stringify(t2))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 5. La 24.ª y el logro ──')
{
  const { ctx, page, errores } = await abrir({ fecha: '2026-12-24', dias: Array.from({ length: 23 }, (_, i) => i + 1) })
  await page.click('#adviento [data-adv-abrir="24"]')
  await page.waitForTimeout(1200)
  const e = await pop(page)
  check('Delibird, con el XP de la casilla y del logro (+60 XP)', e.titulo === 'Delibird' && e.premio === '+60 XP', JSON.stringify(e))
  const modal = await page.evaluate(() => ({ visible: !!document.getElementById('achievementModal') && getComputedStyle(document.getElementById('achievementModal')).display !== 'none', nombre: document.getElementById('achievementName')?.textContent || '' }))
  check('  …y sale el logro «Adviento 2026»', modal.visible && modal.nombre === 'Adviento 2026', JSON.stringify(modal))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 6. Sin cuenta, el 31 y el móvil ──')
{
  const { ctx, page } = await abrir({ sesion: 'none' })
  const t = await tira(page)
  check('sin cuenta no sale (allí está el héroe) ni deja hueco', !t.alto && !(await page.evaluate(() => document.documentElement.hasAttribute('data-adviento'))), JSON.stringify(t))
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ fecha: '2026-12-31', dias: [1, 2, 3] })
  const t = await tira(page)
  check('el 31: quedan las que falten, y el botón abre la primera pendiente', /quedan hasta el 31/.test(t.texto) && t.boton === 'Abrir la 4', JSON.stringify(t))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir({ movil: true, dias: [1, 2] })
  const t = await tira(page)
  check('móvil: la tira cabe en su sitio', t.visible && t.alto <= 140, JSON.stringify(t))
  await page.click('#adviento [data-adv-ver]')
  await page.waitForTimeout(500)
  const e = await pop(page)
  check('  …el calendario es una hoja desde abajo', e.abierto && e.caja && Math.abs(e.caja.bottom - e.alto) <= 2 && e.caja.left <= 1, JSON.stringify(e.caja))
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('  …y nada se sale de lado', desborde <= 0, desborde)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
