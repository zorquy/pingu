// Tanda 1205 — tres cosas de PINGU:
//   1. La cabecera de un tema como la de un foro (capturas de WhatsHack: «no
//      ocupa tanto espacio arriba»): firma a la izquierda, Compartir en icono,
//      Seguir y un «⋯» con editar y moderar; y en el móvil los mensajes son
//      cajas a lo ancho con el autor dentro, no burbujas de chat.
//   2. La cifra de tu colección en la portada ES la del Panel (la apunta el
//      Panel y la portada la copia).
//   3. «Gente nueva esta semana» cuenta desde el lunes.
import { readFileSync } from 'node:fs'
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { anotarCifraDelPanel, cifraDelPanel } from '/home/user/pingu/js/cifra-panel.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── La cifra del Panel (puro) ──')
{
  const m = new Map()
  const almacen = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }
  const t = new Date(2026, 10, 3, 10).getTime()
  anotarCifraDelPanel('u1', 12169.444, { almacen, ahora: t })
  check('se lee la que apuntó el Panel, a céntimos', cifraDelPanel('u1', { almacen, ahora: t + 3600e3 }) === 12169.44)
  check('  …solo de quien la apuntó', cifraDelPanel('u2', { almacen, ahora: t }) === null)
  check('  …y no de ayer ni de hace más de 12 h', cifraDelPanel('u1', { almacen, ahora: new Date(2026, 10, 4, 1).getTime() }) === null && cifraDelPanel('u1', { almacen, ahora: t + 13 * 3600e3 }) === null)
  check('sin almacén, nada (y no rompe)', cifraDelPanel('u1', { almacen: null }) === null)
  const pb = readFileSync('/home/user/pingu/js/portada-bloques.js', 'utf8')
  check('la gente nueva se cuenta desde el lunes de esta semana', /const desde = inicioDeSemana\(\)\.toISOString\(\)/.test(pb) && /d\.setDate\(d\.getDate\(\) - \(\(d\.getDay\(\) \+ 6\) % 7\)\)/.test(pb))
}

const b = await chromium.launch()

console.log('── La portada copia la cifra del Panel ──')
{
  const ctx = await contexto(b, false, 'user-1', () => {
    try { localStorage.setItem('pd-cifra-panel', JSON.stringify({ uid: 'user-1', total: 12345.67, at: Date.now() - 60000 })) } catch {}
  })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.hoy-valor b', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const cifra = (await page.textContent('.hoy-valor b').catch(() => '')).replace(/\s/g, ' ')
  check('«Tu colección» enseña la cifra del Panel', /12\.345,67/.test(cifra), cifra)
  await ctx.close()
}

console.log('── El tema en el PC ──')
{
  const ctx = await contexto(b, false, 'admin-1')
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/tema/tema-2`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.tema-meta', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const r = await page.evaluate(() => {
    const vis = (s) => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden' }
    const meta = document.querySelector('.tema-meta').getBoundingClientRect()
    const firma = document.querySelector('.tema-firma').getBoundingClientRect()
    const bot = document.querySelector('.tema-botones').getBoundingClientRect()
    return { alto: Math.round(meta.height), unaFila: Math.abs((firma.top + firma.bottom) / 2 - (bot.top + bot.bottom) / 2) < 6, compartirIcono: vis('#btnCompartirTema') && !document.getElementById('btnCompartirTema').textContent.trim(), seguir: vis('#btnSeguirTema'), mas: vis('#temaMasBtn'), modVisible: vis('#btnFijar') || vis('#btnBorrarTema') }
  })
  check('firma y botones en UNA fila, que no pasa de 40 px', r.unaFila && r.alto <= 40, JSON.stringify(r))
  check('Compartir es un icono, con Seguir y «⋯» al lado', r.compartirIcono && r.seguir && r.mas)
  check('editar y moderar no están a la vista hasta tocar «⋯»', !r.modVisible)
  await page.click('#temaMasBtn')
  await page.waitForTimeout(200)
  const abierto = await page.evaluate(() => ['btnEditarTema', 'btnFijar', 'btnCerrar', 'btnBorrarTema'].every((id) => document.getElementById(id)?.getBoundingClientRect().width > 0))
  check('  …y al tocarlo salen Editar título, Fijar, Cerrar y Borrar', abierto)
  await page.mouse.click(300, 700)
  await page.waitForTimeout(200)
  check('  …y se cierra al tocar fuera', !(await page.isVisible('#temaMas')))
  await page.click('#temaMasBtn'); await page.keyboard.press('Escape'); await page.waitForTimeout(150)
  check('  …y con Escape', !(await page.isVisible('#temaMas')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── El tema en el móvil ──')
{
  const ctx = await contexto(b, true, 'admin-1')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/tema/tema-2`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.foro-mensaje', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const r = await page.evaluate(() => {
    const lista = document.getElementById('temaMensajes').getBoundingClientRect()
    const cajas = [...document.querySelectorAll('.foro-mensaje')].map((m) => { const q = m.getBoundingClientRect(); return { izq: Math.round(q.left - lista.left), ancho: Math.round(q.width), mio: m.classList.contains('foro-mensaje-mio'), autorDentro: m.contains(m.querySelector('.foro-mensaje-autor')) && getComputedStyle(m).borderTopWidth !== '0px' } })
    const meta = document.querySelector('.tema-meta').getBoundingClientRect()
    return { listaAncho: Math.round(lista.width), cajas, metaAlto: Math.round(meta.height), compartir: getComputedStyle(document.getElementById('btnCompartirTema')).display, desborda: document.documentElement.scrollWidth > innerWidth }
  })
  check('cada mensaje es una caja a lo ancho, con su borde (no una burbuja)', r.cajas.length >= 2 && r.cajas.every((c) => c.izq === 0 && c.ancho >= r.listaAncho - 1 && c.autorDentro), JSON.stringify(r.cajas))
  check('  …también lo tuyo (no a la derecha)', r.cajas.some((c) => c.mio) && r.cajas.filter((c) => c.mio).every((c) => c.izq === 0))
  check('la cabecera del tema en una línea y sin el Compartir repetido', r.metaAlto <= 48 && r.compartir === 'none', JSON.stringify(r))
  check('sin desbordar de lado', !r.desborda)
  await page.screenshot({ path: '/tmp/1205-movil.png' })
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
