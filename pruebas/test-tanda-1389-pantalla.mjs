// Tanda 1389 — la mascota 3D en la web (PINGU: «dale con todo lo
// recomendado… prefiero que tarde más en cargar y que salga la mascota»):
//   · cada hueco `[data-mascota]` (Inicio, vacíos, 404, logro, sin conexión)
//     acaba con el modelo 3D pintado (data-montada="3d", .mascota-lista);
//   · NUNCA sale antes el dibujo de siempre (ni una <img> de mascota.webp);
//   · si el motor no llega, entonces sí el dibujo (y en /sin-conexion, el suyo);
//   · Ajustes › Apariencia › Mascota: «Sin mascota» la quita, «Quieta» pinta
//     una sola foto;
//   · el hueco ocupa lo mismo que el dibujo de antes (no mueve nada).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
const estado = (p) => p.evaluate(() => ({
  huecos: [...document.querySelectorAll('[data-mascota]')].filter((e) => e.getClientRects().length).map((e) => ({ c: e.className.split(' ')[0], m: e.dataset.montada || '', lista: e.classList.contains('mascota-lista'), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })),
  dibujos: [...document.querySelectorAll('img')].filter((i) => /mascota\.webp|data:image\/webp/.test(i.getAttribute('src') || '') && !i.hidden && i.getClientRects().length).length,
}))
// ¿Hay algo pintado en el lienzo? (no transparente en el centro)
const pintado = (p, sel) => p.evaluate((sel) => {
  const c = document.querySelector(`${sel} .mascota-lienzo`)
  if (!c || !c.width) return 0
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let n = 0
  for (let i = 3; i < d.length; i += 4 * 7) if (d[i] > 0) n++
  return n
}, sel)

async function abrir(url, { movil = false, quien = 'user-1', antes = null, sinMotor = false } = {}) {
  const ctx = await contexto(b, movil, quien, antes)
  if (sinMotor) await ctx.route(/\/js\/vendor\/three\.min\.js/, (r) => r.abort())
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => { if (!/Transition was (aborted|skipped)/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  // Lo que se ve a los 400 ms: nunca el dibujo de antes.
  await p.goto(BASE + url, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(400)
  const pronto = await estado(p)
  await p.waitForTimeout(4500)
  return { ctx, p, errores, pronto }
}

console.log('── 1. Los huecos acaban con la mascota 3D, y antes no sale el dibujo ──')
for (const [nombre, url, quien, sel] of [['Inicio', '/', 'user-1', '.banda-mascota'], ['Guardados vacío', '/guardados', 'user-1', '.gd-vacio-mascota'], ['404', '/404.html', 'none', '.pagina-404 .mascota-3d'], ['Sin conexión', '/sin-conexion.html', 'none', '.cabeza .mascota-3d']]) {
  for (const movil of [false, true]) {
    const q = `${nombre} ${movil ? 'móvil' : 'PC'}`
    const { ctx, p, errores, pronto } = await abrir(url, { movil, quien })
    const e = await estado(p)
    const h = e.huecos.find((x) => x.m)
    check(`${q}: el hueco está y acaba en 3D`, h && h.m === '3d' && h.lista, JSON.stringify(e.huecos))
    check(`${q}: …con algo pintado en el lienzo`, (await pintado(p, sel)) > 50, String(await pintado(p, sel)))
    check(`${q}: …sin el dibujo de antes, ni al principio ni al final`, pronto.dibujos === 0 && e.dibujos === 0, JSON.stringify([pronto.dibujos, e.dibujos]))
    check(`${q}: …y con su sitio de siempre (no mide 0)`, h && h.w > 30 && h.h > 40, JSON.stringify(h))
    check(`${q}: sin errores`, !errores.length, errores.join(' | '))
    await ctx.close()
  }
}

console.log('── 2. El logro: la mascota baila al lado del trofeo ──')
{
  const { ctx, p } = await abrir('/perfil')
  await p.evaluate(async () => { const g = await import('/js/gamification.js'); g.showAchievementModal({ id: 'x', title: 'Coleccionista', description: 'Añade 100 cartas', xp_reward: 50 }) })
  await p.waitForTimeout(3500)
  const h = await p.evaluate(() => { const e = document.querySelector('#achievementModal .achievement-mascota'); return e && { m: e.dataset.montada, g: e.dataset.mascota, lista: e.classList.contains('mascota-lista') } })
  check('el pop-up del logro lleva la mascota bailando, en 3D', h && h.m === '3d' && h.g === 'bailar' && h.lista, JSON.stringify(h))
  await ctx.close()
}

console.log('── 2b. Un momento suelto (La quiero): sale, hace el gesto y se va ──')
{
  const { ctx, p } = await abrir('/404.html', { quien: 'none' })
  await p.evaluate(async () => { const m = await import('/js/mascota.js'); m.mascotaMomento(document.querySelector('h1'), 'enamorado') })
  await p.waitForTimeout(1500)
  const sale = await p.evaluate(() => { const e = document.querySelector('.mascota-momento'); return e && { m: e.dataset.montada, g: e.dataset.mascota, lista: e.classList.contains('mascota-lista') } })
  check('sale junto al botón, en 3D y enamorada', sale && sale.m === '3d' && sale.g === 'enamorado' && sale.lista, JSON.stringify(sale))
  await p.waitForTimeout(3800)
  check('…y a los pocos segundos se va sin dejar nada', !(await p.$('.mascota-momento')))
  await ctx.close()
}

console.log('── 3. Sin el motor: entonces sí, el dibujo ──')
{
  const { ctx, p } = await abrir('/404.html', { quien: 'none', sinMotor: true })
  const e = await estado(p)
  check('404 sin el motor: sale el dibujo en su hueco', e.dibujos === 1 && e.huecos[0]?.m === 'dibujo', JSON.stringify(e))
  await ctx.close()
}
{
  const { ctx, p } = await abrir('/sin-conexion.html', { quien: 'none', sinMotor: true })
  const e = await estado(p)
  check('/sin-conexion sin el motor: el dibujo que lleva dentro', e.dibujos === 1, JSON.stringify(e))
  await ctx.close()
}

console.log('── 4. Ajustes › Apariencia › Mascota ──')
{
  const { ctx, p } = await abrir('/ajustes?ver=apariencia')
  const botones = await p.$$eval('[data-mascota-pref]', (bs) => bs.map((x) => [x.dataset.mascotaPref, x.textContent.trim(), x.getAttribute('aria-pressed')]))
  check('tres botones: Con movimiento (marcado), Quieta, Sin mascota', botones.map((x) => x[1]).join(',') === 'Con movimiento,Quieta,Sin mascota' && botones[0][2] === 'true', JSON.stringify(botones))
  await p.click('[data-mascota-pref="no"]')
  check('«Sin mascota» se guarda en este navegador', (await p.evaluate(() => localStorage.getItem('pd-mascota'))) === 'no')
  await ctx.close()
}
{
  const { ctx, p } = await abrir('/404.html', { quien: 'none', antes: () => { try { localStorage.setItem('pd-mascota', 'no') } catch {} } })
  const vis = await p.evaluate(() => { const e = document.querySelector('[data-mascota]'); return { visible: Boolean(e?.getClientRects().length), montada: e?.dataset.montada || '' } })
  check('con «Sin mascota», el 404 no la enseña ni la baja', !vis.visible && !vis.montada, JSON.stringify(vis))
  await ctx.close()
}
{
  const { ctx, p } = await abrir('/404.html', { quien: 'none', antes: () => { try { localStorage.setItem('pd-mascota', 'quieta') } catch {} } })
  const a = await pintado(p, '.pagina-404 .mascota-3d')
  const foto1 = await p.evaluate(() => document.querySelector('.mascota-lienzo').toDataURL().length)
  await p.waitForTimeout(1200)
  const foto2 = await p.evaluate(() => document.querySelector('.mascota-lienzo').toDataURL().length)
  check('con «Quieta», una foto pintada que no cambia', a > 50 && foto1 === foto2, JSON.stringify([a, foto1, foto2]))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
