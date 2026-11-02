// Tanda 1183 — lo que te espera en el foro, en su foro y en su tema. PINGU,
// con una captura del móvil: la burbuja decía «Foro 1» y ninguna tarjeta del
// índice lo decía, así que no sabías dónde entrar. Ese número son tus AVISOS
// del foro (respuestas, menciones, reacciones), y el índice solo marcaba los
// mensajes sin leer. Ahora la tarjeta de su foro lleva «N para ti» (también la
// del padre de un subforo) y lleva al aviso, y dentro del foro la fila del
// tema lleva «Para ti».
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

console.log('── 1. Lo puro ──')
{
  const A = await import(`${RAIZ}/js/foro-avisos.js`)
  check('el tema de un enlace, con página y ancla', A.temaDeAviso('/tema/12') === '12' && A.temaDeAviso('/tema/12?p=2#mensaje-80') === '12' && A.temaDeAviso('https://pokedoc.es/tema/tema-2') === 'tema-2')
  check('  …y lo que no es un tema, nada', A.temaDeAviso('/foro/general') === null && A.temaDeAviso('/temas') === null && A.temaDeAviso(null) === null)
  const avisos = [
    { type: 'forum_reply', link: '/tema/1', created_at: '2026-11-02T10:00:00Z' },
    { type: 'forum_reaction', link: '/tema/1#mensaje-9', created_at: '2026-11-02T11:00:00Z' },
    { type: 'forum_reply', link: '/tema/2', created_at: '2026-11-02T09:00:00Z' },
    { type: 'forum_reply', link: '/tema/3', read_at: 'x' },
    { type: 'new_follower', link: '/usuario/Ash' },
    { type: 'torneo_ronda', link: '/tema/4' },
  ]
  check('solo los del foro, sin leer y con tema, el más nuevo primero', A.avisosDelForo(avisos).map((a) => a.link).join() === '/tema/1#mensaje-9,/tema/1,/tema/2')
  const { porTema, porForo } = A.avisosPorSitio(avisos, new Map([['1', 'hijo'], ['2', 'otro']]), new Map([['hijo', 'padre']]))
  check('por tema', porTema.get('1').n === 2 && porTema.get('2').n === 1)
  check('por foro, y el subforo cuenta en su padre', porForo.get('hijo').n === 2 && porForo.get('padre').n === 2 && porForo.get('otro').n === 1)
  check('  …llevando al aviso más nuevo', porForo.get('padre').link === '/tema/1#mensaje-9')
}

// Un subforo de «Colección» con un tema, un aviso en él y una reacción en
// otro tema de «Competitivo» (donde ya está la respuesta del fixture).
const conAvisos = () => {
  const hace = (m) => new Date(Date.now() - m * 60000).toISOString()
  const quien = window.__FAKE_SESSION__
  window.__FAKE_FOROS__.push({ id: 'foro-5', slug: 'gradeos', name: 'Gradeos', description: 'PSA, CGC y BGS', section_id: 'seccion-2', parent_id: 'foro-4', position: 0 })
  window.__FAKE_TEMAS__.push({ id: 'tema-9', board_id: 'foro-5', title: '¿Merece la pena gradear este Pikachu?', author_id: quien, post_count: 3, view_count: 40, last_post_at: hace(50), last_post_author_id: 'user-2', created_at: hace(300) })
  window.__FAKE_NOTIFICACIONES__.push(
    { recipient_id: quien, type: 'forum_reaction', title: 'Han reaccionado a tu mensaje', link: '/tema/tema-5#mensaje-1', created_at: hace(2) },
    { recipient_id: quien, type: 'forum_reply', title: 'Misty ha respondido en «¿Merece la pena gradear?»', link: '/tema/tema-9', created_at: hace(4) },
  )
}

const b = await chromium.launch()
for (const movil of [true, false]) {
  console.log(`── 2. El índice (${movil ? 'móvil' : 'PC'}) ──`)
  const ctx = await contexto(b, movil, 'user-1', conAvisos)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/foro.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.foro-chapa-para-ti', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(600)
  const chapas = await page.$$eval('.foro-fila[data-foro]', (fs) => Object.fromEntries(fs.map((f) => [f.dataset.foro, (() => { const c = f.querySelector('.foro-chapa-para-ti'); return c ? `${c.textContent.trim()}→${c.getAttribute('href')}` : '' })()])))
  check('Competitivo: «2 para ti», al aviso más nuevo', chapas['foro-3'] === '2 para ti→/tema/tema-5#mensaje-1', JSON.stringify(chapas))
  check('Colección: «1 para ti» por su subforo', chapas['foro-4'] === '1 para ti→/tema/tema-9', JSON.stringify(chapas))
  check('  …y los demás, sin nada', !chapas['foro-1'] && !chapas['foro-2'])
  check('el subforo con el aviso va marcado', await page.$eval('.foro-subforos a[data-foro="foro-5"]', (a) => a.classList.contains('foro-con-aviso')).catch(() => false))
  const vista = await page.$eval('.foro-fila[data-foro="foro-3"] .foro-chapa-para-ti', (c) => {
    const r = c.getBoundingClientRect(), cs = getComputedStyle(c)
    return { visible: r.width > 20 && r.height > 10 && r.right <= innerWidth, fondo: cs.backgroundColor, acento: getComputedStyle(document.documentElement).getPropertyValue('--acento').trim() }
  })
  check('se ve, dentro de la pantalla y en el color de la sección', vista.visible && vista.fondo !== 'rgba(0, 0, 0, 0)', JSON.stringify(vista))
  if (movil) await page.screenshot({ path: '/tmp/1183-indice-movil.png' })
  check('sin errores', !errores.length, errores.join(' | '))

  if (movil) {
    console.log('── 3. Al leerlo desde la campana, la marca se va ──')
    await page.evaluate(() => {
      window.__pdAvisos = window.__pdAvisos.map((a) => (/tema-9/.test(a.link) ? { ...a, read_at: new Date().toISOString() } : a))
      window.dispatchEvent(new Event('pd-avisos'))
    })
    await page.waitForTimeout(400)
    const despues = await page.$$eval('.foro-fila[data-foro] .foro-chapa-para-ti', (cs) => cs.map((c) => c.closest('[data-foro]').dataset.foro))
    check('solo queda la de Competitivo', despues.join() === 'foro-3', despues.join())

    console.log('── 4. Dentro del foro, la fila del tema ──')
    await page.goto(`${BASE}/foro/competitivo`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-tema] .foro-chapa-para-ti', { timeout: 8000 }).catch(() => {})
    const filas = await page.$$eval('[data-tema]', (fs) => Object.fromEntries(fs.map((f) => [f.dataset.tema, f.querySelector('.foro-chapa-para-ti')?.textContent.trim() || ''])))
    check('«Para ti» en los dos temas con aviso, y en ninguno más', filas['tema-2'] === 'Para ti' && filas['tema-5'] === 'Para ti' && Object.values(filas).filter(Boolean).length === 2, JSON.stringify(filas))
    const encima = await page.$eval('[data-tema="tema-5"] .foro-chapa-para-ti', (c) => { const r = c.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.foro-chapa-para-ti') === c })
    check('  …y se puede tocar (por encima del enlace de la fila)', encima)
    await page.screenshot({ path: '/tmp/1183-foro-movil.png' })
    check('sin errores', !errores.length, errores.join(' | '))
  }
  await ctx.close()
}

console.log('── 5. Sin cuenta, nada ──')
{
  const ctx = await contexto(b, true, 'none')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/foro.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  check('ninguna chapa', (await page.locator('.foro-chapa-para-ti').count()) === 0)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
