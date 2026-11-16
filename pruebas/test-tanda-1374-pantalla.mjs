// Tanda 1374 — tres fallos que se veían y el precio de la ficha («Más
// mejoras», C y D; PINGU: «dale con lo recomendado»):
//   · Inicio: «Liga FDN · jornada 3 · jornada 3 de 3» → «Liga FDN · jornada
//     3 de 3» (`subDeTorneo`), y el titular no se corta en «Torneo en 5 d…»;
//   · perfil: «Ver los 1» → «Ver el logro», y en el móvil la cabecera al
//     mismo margen que las losas;
//   · ficha de carta (móvil): «Cardmarket · español · NM · hoy» en una línea.
import { chromium, sembrar, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

// Lo puro, primero.
const { subDeTorneo } = await import(`${RAIZ}/js/hoy.js`)
check('subDeTorneo: el nombre que ya trae la jornada no la repite', subDeTorneo({ name: 'Liga FDN [Oct–Dic] · jornada 3', jornada: 3 }, 3) === 'Liga FDN · jornada 3 de 3', subDeTorneo({ name: 'Liga FDN [Oct–Dic] · jornada 3', jornada: 3 }, 3))
check('subDeTorneo: sin jornada en el nombre, la pone', subDeTorneo({ name: 'Liga FDN', jornada: 2 }, 5) === 'Liga FDN · jornada 2 de 5')
check('subDeTorneo: un torneo suelto, solo su nombre corto', subDeTorneo({ name: 'Copa Madrid (sábado)' }) === 'Copa Madrid')
const { deQueEsCorto } = await import(`${RAIZ}/js/carta-movil.js`)
const hoy = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
check('deQueEsCorto: «Cardmarket · español · NM · hoy»', deQueEsCorto(`mínimo en español en Cardmarket · NM · ${hoy}`) === 'Cardmarket · español · NM · hoy')
check('deQueEsCorto: otro día, su fecha', deQueEsCorto('mínimo en japonés en Cardmarket · NM · 3 ene', new Date('2026-11-16T12:00:00Z')) === 'Cardmarket · japonés · NM · 3 ene')
check('deQueEsCorto: lo que no es de Cardmarket, igual', deQueEsCorto('TCGplayer, en euros') === 'TCGplayer, en euros')

const b = await chromium.launch()
async function abrir(ruta) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(sembrar, 'user-1')
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|cdn\.jsdelivr|\/sprite\//, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(e.message))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { ctx, page, errores }
}
// Inicio
{
  const { ctx, page, errores } = await abrir('/')
  const t = await page.evaluate(() => {
    const f = [...document.querySelectorAll('.hoy-ficha')].find((x) => /Torneo/.test(x.textContent))
    if (!f) return null
    const tit = f.querySelector('b')
    return { texto: f.textContent.replace(/\s+/g, ' ').trim(), cortado: tit ? tit.scrollWidth > tit.clientWidth + 1 || tit.scrollHeight > tit.clientHeight + 1 : null }
  })
  check('Inicio: la ficha del torneo no repite la jornada', t && !/jornada \d+ · jornada/.test(t.texto), JSON.stringify(t))
  check('Inicio: el titular del torneo no se corta', t && t.cortado === false, JSON.stringify(t))
  check('Inicio: sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
// Perfil
{
  const { ctx, page, errores } = await abrir('/usuario/Misty')
  const p = await page.evaluate(() => {
    const izq = (sel) => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().left) : null }
    const ver = [...document.querySelectorAll('main button, main a')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()).filter((t) => /^Ver (el|los|las)/.test(t))
    return { acciones: izq('.perfil-acciones'), nivel: izq('.pf-nivel'), losas: izq('#profileStats'), ver }
  })
  check('Perfil: con un logro dice «Ver el logro», nunca «Ver los 1»', p.ver.some((t) => /^Ver el logro/.test(t)) && !p.ver.some((t) => /Ver los 1\b/.test(t)), JSON.stringify(p.ver))
  check('Perfil (móvil): botones, nivel y losas al mismo margen', p.acciones != null && Math.abs(p.acciones - p.losas) <= 1 && Math.abs(p.nivel - p.losas) <= 1, JSON.stringify(p))
  check('Perfil: sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
// Ficha de carta
{
  const { ctx, page, errores } = await abrir('/carta.html?id=sv08-1')
  const c = await page.evaluate(() => {
    const s = document.querySelector('.carta-precio-corto small')
    if (!s) return null
    const r = s.getBoundingClientRect()
    return { texto: s.textContent.trim(), alto: Math.round(r.height), letra: parseFloat(getComputedStyle(s).fontSize) }
  })
  check('Ficha: el rótulo del precio dice «Cardmarket · … · NM» en corto', c && /^Cardmarket · /.test(c.texto) && !/mínimo/i.test(c.texto), JSON.stringify(c))
  check('Ficha: …y cabe en una línea', c && c.alto < c.letra * 2, JSON.stringify(c))
  check('Ficha: sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(N)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
