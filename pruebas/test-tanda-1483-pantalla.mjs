// Tanda 1483 — Dos cosas de guías y noticias (PINGU):
//   · «Cuando yo escribo una noticia, la escribo como PokeDoc, pero a mí me
//     llegan las notificaciones de comentario… y encima pone comentario en tu
//     guía»: un comentario en una NOTICIA no avisa a nadie de «nuevo
//     comentario» (responder a alguien sí le avisa a esa persona); en una
//     guía, su autor sigue recibiendo el suyo.
//   · «Hay guías que bajo hasta abajo, scrolleo y no me la da como leída»:
//     llegar al final cuenta aunque se baje más (a los comentarios o al pie)
//     antes de los 15 segundos; antes la cuenta atrás se cancelaba.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
const LARGA = Array.from({ length: 60 }, (_, i) => ({ type: 'paragraph', text: `Párrafo ${i + 1}: lo que hay que saber para jugar mejor y no perder cartas por el camino, contado con calma y con ejemplos.` }))
async function abrir(ruta, { movil = true, sesion = 'user-1' } = {}) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), serviceWorkers: 'block' })
  await ctx.addInitScript(([s, larga]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_GUIAS__ = [{ title: 'Cómo saber si una carta es falsa', reference_blocks: larga }]
    window.__FAKE_NOTICIAS__ = [{ title: 'Cartas del 30 aniversario', description: 'Todas.' }]
  }, [sesion, LARGA])
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex|pokemontcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#articleEndSentinel', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(800)
  return { ctx, page, errores }
}
const leida = (page, id) => page.evaluate((id) => Boolean((window.__TABLAS__?.user_progress || []).find((p) => p.guide_id === id && p.read_at)), id)

console.log('── 1. Bajar del todo cuenta como leída ──')
{
  const { ctx, page, errores } = await abrir('/guia?slug=guia-1')
  const antes = await page.evaluate(() => document.getElementById('articleEndSentinel').getBoundingClientRect().top > innerHeight)
  check('la guía es larga: el final no se ve al abrirla', antes)
  // De golpe hasta el pie, más allá del final del texto, y ahí se queda.
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(600)
  const pasado = await page.evaluate(() => document.getElementById('articleEndSentinel').getBoundingClientRect().top < 0)
  check('…el final queda por encima de la pantalla', pasado)
  check('…y a los 5 segundos aún no cuenta (hacen falta 15)', !(await leida(page, 'guia-1')))
  await page.waitForTimeout(15000)
  check('…a los 15 segundos de abrirla, leída', await leida(page, 'guia-1'))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  // Sin llegar al final no cuenta, por mucho tiempo que pase.
  const { ctx, page } = await abrir('/guia?slug=guia-1')
  await page.waitForTimeout(16000)
  check('sin bajar al final, no cuenta', !(await leida(page, 'guia-1')))
  await ctx.close()
}

console.log('── 2. Los comentarios de una noticia no avisan ──')
async function comentar(ruta) {
  const { ctx, page, errores } = await abrir(ruta, { movil: false })
  await page.waitForSelector('#forumCommentBody', { timeout: 8000 }).catch(() => {})
  await page.fill('#forumCommentBody', 'Qué buena pinta tiene esto')
  await page.click('#btnSubmitForumComment')
  await page.waitForTimeout(1500)
  const avisos = await page.evaluate(() => (window.__TABLAS__?.user_notifications || []).filter((n) => n.type === 'guide_comment').map((n) => `${n.recipient_id}:${n.title}`))
  await ctx.close()
  return { avisos, errores }
}
{
  const n = await comentar('/guia?slug=noticia-1')
  check('un comentario en una noticia (firmada por PokeDoc) no avisa a quien la guardó', n.avisos.length === 0, JSON.stringify(n.avisos))
  check('sin errores', !n.errores.length, n.errores.join(' | '))
  const g = await comentar('/guia?slug=guia-1')
  check('en una guía, su autor sí recibe «Nuevo comentario en tu guía»', g.avisos.join() === 'admin-1:Nuevo comentario en tu guía', JSON.stringify(g.avisos))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
