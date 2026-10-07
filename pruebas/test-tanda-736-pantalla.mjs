// Tanda 736 — la campana agrupada (X11 de la lista de propuestas, elegidas
// por PINGU).
//
// Lo que se mira: las reglas puras (lo que habla de lo mismo va junto, las
// respuestas de un tema se juntan aunque cada una lleve su ancla, las
// reacciones solo si son al MISMO mensaje, los seguidores por tipo y a tu
// perfil, el tramo del grupo es el de su aviso más nuevo y por días de
// calendario); y en el navegador, que la campana pinte los tramos y la
// cuenta, y que pulsar un grupo marque leídos TODOS los suyos.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { agruparAvisos, tramoDe } = await import(`${RAIZ}/js/avisos-grupos.js`)

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

// Las 12:00 de un día cualquiera, en hora local.
const AHORA = new Date(2026, 9, 7, 12, 0, 0).getTime()
const hace = (h) => new Date(AHORA - h * 3600e3).toISOString()

console.log('── 1. Las reglas ──')
{
  check('el tramo va por días de calendario', tramoDe(hace(1), AHORA) === 'Hoy' && tramoDe(hace(12.5), AHORA) === 'Ayer' && tramoDe(hace(60), AHORA) === 'Esta semana' && tramoDe(hace(24 * 9), AHORA) === 'Antes')
  const lista = [
    { id: 'r1', type: 'forum_reaction', title: 'Han reaccionado 👍 a tu mensaje', body: 'Mazos', link: '/tema/1#mensaje-5', created_at: hace(1) },
    { id: 'f1', type: 'forum_reply', title: 'Te han respondido en el foro', body: 'Mazos', link: '/tema/1#mensaje-9', created_at: hace(2) },
    { id: 's1', type: 'new_follower', title: 'Nuevo seguidor', body: 'Ibai', link: '/usuario/ibai', created_at: hace(3) },
    { id: 'r2', type: 'forum_reaction', title: 'Han reaccionado 🔥 a tu mensaje', body: 'Mazos', link: '/tema/1#mensaje-5', created_at: hace(26) },
    { id: 'r3', type: 'forum_reaction', title: 'Han reaccionado 👍 a tu mensaje', body: 'Mazos', link: '/tema/1#mensaje-6', created_at: hace(27) },
    { id: 'f2', type: 'forum_reply', title: 'Te han mencionado en el foro', body: 'Mazos', link: '/tema/1#mensaje-7', created_at: hace(28) },
    { id: 's2', type: 'new_follower', title: 'Nuevo seguidor', body: 'Ana', link: '/usuario/ana', created_at: hace(29) },
    { id: 'g1', type: 'guide_approved', title: 'Tu guía ha sido aprobada', body: 'Charizard', link: '/guia/charizard', created_at: hace(24 * 10) },
  ]
  const t = agruparAvisos(lista, AHORA)
  const todos = t.flatMap((x) => x.grupos)
  check('ocho avisos, cinco filas', todos.length === 5, JSON.stringify(todos.map((g) => g.ids)))
  check('los tramos, en orden y sin los vacíos', JSON.stringify(t.map((x) => x.tramo)) === JSON.stringify(['Hoy', 'Ayer', 'Antes']), JSON.stringify(t.map((x) => x.tramo)))
  const reac = todos.find((g) => g.ids.includes('r1'))
  check('las reacciones al MISMO mensaje van juntas, y el grupo es de hoy', reac.n === 2 && reac.titulo === '2 reacciones a tu mensaje' && t[0].grupos.includes(reac))
  check('  …la de otro mensaje del mismo tema, aparte', todos.find((g) => g.ids.includes('r3')).n === 1)
  const resp = todos.find((g) => g.ids.includes('f1'))
  check('las respuestas de un tema se juntan aunque lleven cada una su ancla', resp.n === 2 && resp.cuerpo === 'Mazos' && resp.titulo === '2 mensajes nuevos para ti en este tema')
  check('  …y llevan al primer mensaje sin leer (el más viejo)', resp.link === '/tema/1#mensaje-7', resp.link)
  const seg = todos.find((g) => g.ids.includes('s1'))
  check('los seguidores, juntos por tipo, sin el nombre de uno y a tu perfil', seg.n === 2 && seg.titulo === 'Te siguen 2 personas nuevas' && seg.cuerpo === null && seg.link === '/perfil.html')
  const solo = todos.find((g) => g.ids.includes('g1'))
  check('uno solo se queda como estaba', solo.n === 1 && solo.titulo === 'Tu guía ha sido aprobada' && solo.cuerpo === 'Charizard' && solo.link === '/guia/charizard')
  const raro = agruparAvisos([{ id: 'a', type: 'tipo_nuevo', title: 'Algo', link: '/x', created_at: hace(1) }, { id: 'b', type: 'tipo_nuevo', title: 'Algo', link: '/x', created_at: hace(2) }], AHORA)
  check('un tipo sin frase propia no se inventa una', raro[0].grupos[0].titulo === 'Algo (y 1 más)')
  check('sin avisos, nada', agruparAvisos([], AHORA).length === 0)
}

console.log('── 2. La campana ──')
const browser = await chromium.launch()
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    const h = (x) => new Date(Date.now() - x * 60e3).toISOString()
    window.__FAKE_NOTIFICACIONES__ = [
      { id: 'n1', recipient_id: 'user-1', type: 'forum_reaction', title: 'Han reaccionado a tu mensaje', body: 'Mazos de Ceruledge', link: '/tema/1#mensaje-5', created_at: h(5) },
      { id: 'n2', recipient_id: 'user-1', type: 'forum_reaction', title: 'Han reaccionado a tu mensaje', body: 'Mazos de Ceruledge', link: '/tema/1#mensaje-5', created_at: h(6) },
      { id: 'n3', recipient_id: 'user-1', type: 'forum_reaction', title: 'Han reaccionado a tu mensaje', body: 'Mazos de Ceruledge', link: '/tema/1#mensaje-5', created_at: h(7) },
      { id: 'n4', recipient_id: 'user-1', type: 'guide_approved', title: 'Tu guía ha sido aprobada', body: 'Charizard', link: '/guia/charizard', created_at: h(60 * 24 * 10) },
    ]
  })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la chapa cuenta los cuatro avisos', (await page.textContent('#navBellBadge')) === '4')
  await page.click('#navBellBtn')
  await page.waitForTimeout(700)
  const lista = await page.$$eval('#navBellList > *', (xs) => xs.map((x) => (x.classList.contains('nav-bell-tramo') ? `[${x.textContent}]` : x.querySelector('.nav-bell-item-title').textContent.replace(/\s+/g, ' ').trim())))
  check('los tramos y las filas: tres reacciones en una', JSON.stringify(lista) === JSON.stringify(['[Hoy]', '3 reacciones a tu mensaje 3', '[Antes]', 'Tu guía ha sido aprobada']), JSON.stringify(lista))
  const estilo = await page.evaluate(() => { const c = document.querySelector('.nav-bell-cuenta'); const t = document.querySelector('.nav-bell-tramo'); return { cuenta: getComputedStyle(c).borderRadius, tramo: getComputedStyle(t).textTransform } })
  check('  …con su hoja (la cuenta en chapa, el tramo en versalitas)', estilo.cuenta !== '0px' && estilo.tramo === 'uppercase', JSON.stringify(estilo))
  await Promise.all([page.waitForURL(/tema/, { timeout: 4000 }).catch(() => null), page.click('.nav-bell-item[data-notif-ids="n1,n2,n3"]')])
  const escrituras = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'user_notifications'))
  check('pulsar el grupo marca leídos los TRES (una sola escritura)', escrituras.length === 1 && escrituras[0].filas.length === 3 && escrituras[0].filas.every((f) => f.read_at), JSON.stringify(escrituras).slice(0, 200))
  check('  …y lleva al mensaje', /\/tema\/1/.test(page.url()), page.url())
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
