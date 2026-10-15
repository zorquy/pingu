// Tanda 847: /guardados rehecha y UNA fila de guía para la portada, /aprender
// y /guardados (js/guia-fila.js). PINGU: «¿te parece algo útil? ¿lo
// deberíamos quitar? Y si no… hay que mejorarla».
//
// Se mira: «Por leer» y «Ya leídas» separados, lo último guardado primero, la
// fila con foto/arte y estado, quitar con «Deshacer» (y lo que queda escrito
// en saved_guides), «Quitar las leídas», el vacío con su botón y el móvil.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ahora = Date.now()
const GUIAS = ['Cómo funcionan los pull rates', 'Comprar seguro en Wallapop', 'Todas las rarezas', 'Cómo detectar slabs PSA falsas', 'Cartas censuradas'].map((title, i) => ({
  id: `guia-${i + 1}`, slug: `guia-${i + 1}`, title, description: 'Dentro.', kind: 'guide', level: 'beginner', estimated_mins: 5 + i,
  author_id: 'admin-1', review_status: 'published', published_at: new Date(ahora - (i + 1) * 864e5).toISOString(),
  cover_image: i === 0 ? '/fotos/foto1.svg' : null, blocks: i === 2 ? Array.from({ length: 4 }, () => ({ type: 'quiz' })) : [],
}))
const NOTICIA = [{ id: 'n1', slug: 'beats-pill', title: 'Un altavoz con Pikachu', kind: 'news', author_id: 'admin-1', review_status: 'published', published_at: new Date(ahora - 3600e3).toISOString(), blocks: [] }]
// Guardadas en este orden: la última en guardarse es la noticia, que tiene que salir primera.
const GUARDADAS = ['guia-1', 'guia-2', 'guia-3', 'guia-4', 'borrada', 'n1']
const PROGRESO = [
  { user_id: 'user-1', guide_id: 'guia-2', status: 'in_progress', read_at: new Date(ahora - 600e3).toISOString(), current_block: 0 },
  { user_id: 'user-1', guide_id: 'guia-4', status: 'in_progress', read_at: new Date(ahora - 900e3).toISOString(), current_block: 0 },
  { user_id: 'user-1', guide_id: 'guia-3', status: 'in_progress', read_at: null, current_block: 2 },
]

const b = await chromium.launch()
async function abrir({ movil = false, guardadas = GUARDADAS } = {}) {
  const ctx = await b.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), locale: 'es-ES' })
  await ctx.addInitScript(([g, n, p, s]) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_GUIAS__ = g
    window.__FAKE_NOTICIAS__ = n
    window.__FAKE_PROGRESO__ = p
    window.__FAKE_PERFIL__ = { saved_guides: s }
    window.confirm = () => true
  }, [GUIAS, NOTICIA, PROGRESO, guardadas])
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}/guardados.html`, { waitUntil: 'load' })
  await p.waitForTimeout(1500)
  return { p, ctx, errores }
}
const guardadasAhora = (p) => p.evaluate(() => window.__TABLAS__.user_profiles.find((x) => x.id === 'user-1')?.saved_guides)

console.log('── 1. Las dos listas ──')
{
  const { p, ctx, errores } = await abrir()
  check('sin errores', !errores.length, errores.join(' | '))
  const porLeer = await p.$$eval('.gd-bloque:not(.gd-leidas) .guia-fila strong', (xs) => xs.map((x) => x.textContent))
  const leidas = await p.$$eval('.gd-leidas .guia-fila strong', (xs) => xs.map((x) => x.textContent))
  check('«Por leer»: la noticia, la de curso a medias y la primera, lo último guardado primero', JSON.stringify(porLeer) === JSON.stringify(['Un altavoz con Pikachu', 'Todas las rarezas', 'Cómo funcionan los pull rates']), porLeer.join(' / '))
  check('«Ya leídas»: las dos leídas', JSON.stringify(leidas) === JSON.stringify(['Cómo detectar slabs PSA falsas', 'Comprar seguro en Wallapop']), leidas.join(' / '))
  check('  …la que ya no existe no sale ni rompe nada', (await p.locator('.gd-item').count()) === 5)
  check('el resumen de arriba: 3 por leer · 2 leídas', (await p.locator('#gdResumen').innerText()) === '3 por leer · 2 leídas', await p.locator('#gdResumen').innerText())
  check('la noticia lleva a /noticias y dice que es noticia', (await p.locator('.guia-fila', { hasText: 'altavoz' }).getAttribute('href')) === '/noticias/beats-pill' && /Noticia/.test(await p.locator('.guia-fila', { hasText: 'altavoz' }).innerText()))
  check('la de curso a medias, con su barra al 50 %', (await p.locator('.guia-fila', { hasText: 'rarezas' }).locator('.guia-fila-barra i').getAttribute('style'))?.includes('50%'))
  check('las leídas dicen «✓ leída»', (await p.locator('.gd-leidas .guia-fila-hecha').count()) === 2)
  check('la que tiene foto, la enseña', (await p.locator('.guia-fila', { hasText: 'pull rates' }).locator('img').count()) === 1)
  const q = await p.locator('.gd-quitar').first().boundingBox()
  check('el «quitar» se puede tocar (44 px)', q && q.width >= 44 && q.height >= 44, JSON.stringify(q))

  // Quitar y deshacer.
  await p.locator('.gd-item', { hasText: 'pull rates' }).locator('.gd-quitar').click()
  await p.waitForTimeout(300)
  check('al quitar, la fila dice «Quitada» con «Deshacer»', /Quitada de guardados/.test(await p.locator('.gd-quitada').innerText()))
  check('  …y en la base ya no está', !(await guardadasAhora(p)).includes('guia-1'), JSON.stringify(await guardadasAhora(p)))
  await p.locator('[data-deshacer]').click()
  await p.waitForTimeout(300)
  check('«Deshacer» la devuelve a su sitio', !(await p.locator('.gd-quitada').count()) && (await p.locator('.gd-item', { hasText: 'pull rates' }).count()) === 1)
  check('  …y vuelve a la base en su sitio (no como la última guardada)', (await guardadasAhora(p))[0] === 'guia-1', JSON.stringify(await guardadasAhora(p)))

  // Quitar las leídas.
  await p.locator('[data-limpiar]').click()
  await p.waitForTimeout(800)
  const quedan = await guardadasAhora(p)
  check('«Quitar las leídas» quita las dos y nada más', !quedan.includes('guia-2') && !quedan.includes('guia-4') && quedan.includes('guia-1') && quedan.includes('n1'), JSON.stringify(quedan))
  check('  …y se repinta sin ellas', !(await p.locator('.gd-leidas').count()) && (await p.locator('.gd-item').count()) === 3)
  await ctx.close()
}

console.log('── 2. Vacío y móvil ──')
{
  const { p, ctx, errores } = await abrir({ guardadas: [] })
  check('sin nada: el vacío con un botón a las guías', !errores.length && (await p.locator('.empty-state a[href="/aprender"]').count()) === 1, errores.join(' | '))
  await ctx.close()
}
{
  const { p, ctx, errores } = await abrir({ movil: true })
  const sale = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  check('en el móvil no se sale de la pantalla', !errores.length && sale <= 1, `${sale}px ${errores.join(' | ')}`)
  await p.screenshot({ path: '/tmp/claude-0/gd-847-movil.png' })
  await ctx.close()
}
{
  const { p, ctx } = await abrir()
  await p.screenshot({ path: '/tmp/claude-0/gd-847-pc.png' })
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTODO OK')
process.exit(fails ? 1 : 0)
