// Tanda 1320 — el glosario que se enlaza solo (P5 del plan). El subrayado y el
// globo ya estaban (792); lo nuevo: en el PC se abre al pasar el ratón, en el
// móvil es una hoja desde abajo, y se puede apagar en Ajustes › Apariencia.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const b = await chromium.launch()
const montar = async (page) => page.evaluate(async () => {
  const { GLOSARIO } = await import('/js/glosario-datos.js')
  const g = GLOSARIO.find((x) => /mulligan/i.test(x.termino)) || GLOSARIO[0]
  const div = document.createElement('div')
  div.className = 'article-body'
  div.id = 'pruebaGlosa'
  div.innerHTML = `<p>Si no tienes básicos haces ${g.termino} y robas siete.</p>`
  document.querySelector('main')?.prepend(div) || document.body.prepend(div)
  const { subrayarGlosario } = await import('/js/glosario.js')
  return { n: subrayarGlosario(div), termino: g.termino }
})

console.log('── En el PC: al pasar el ratón ──')
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(800)
  const m = await montar(p)
  check('subraya la palabra', m.n === 1, JSON.stringify(m))
  await p.hover('#pruebaGlosa .glosa')
  await p.waitForTimeout(500)
  const pop = await p.evaluate(() => { const x = document.querySelector('.glosa-pop'); return x && { texto: x.textContent, hoja: x.classList.contains('glosa-hoja'), pos: getComputedStyle(x).position } })
  check('al pasar, la definición en un globo al lado (no una hoja)', pop && !pop.hoja && pop.pos === 'absolute' && /Ver en el glosario ›/.test(pop.texto), JSON.stringify(pop))
  await p.mouse.move(5, 880)
  await p.waitForTimeout(600)
  check('  …y al salir, se va', (await p.locator('.glosa-pop').count()) === 0)
  await p.hover('#pruebaGlosa .glosa'); await p.waitForTimeout(500)
  await p.click('#pruebaGlosa .glosa'); await p.mouse.move(5, 880); await p.waitForTimeout(600)
  check('un clic lo deja fijo aunque el ratón se vaya', (await p.locator('.glosa-pop').count()) === 1)
  await ctx.close()
}

console.log('── En el móvil: una hoja desde abajo ──')
{
  const ctx = await b.newContext({ ...devices['iPhone 13'] })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(800)
  await montar(p)
  await p.tap('#pruebaGlosa .glosa')
  await p.waitForTimeout(300)
  const h = await p.evaluate(() => { const x = document.querySelector('.glosa-pop'); if (!x) return null; const r = x.getBoundingClientRect(); return { hoja: x.classList.contains('glosa-hoja'), abajo: Math.abs(r.bottom - innerHeight) <= 1, ancho: Math.round(r.width) === innerWidth, encimaDeLaBarra: Number(getComputedStyle(x).zIndex) > Number(getComputedStyle(document.querySelector('.bm') || document.body).zIndex || 0) } })
  check('al tocar, una hoja pegada abajo y a lo ancho, encima de la barra', h?.hoja && h.abajo && h.ancho && h.encimaDeLaBarra, JSON.stringify(h))
  await ctx.close()
}

console.log('── Apagarlo en Ajustes ──')
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/ajustes.html?ver=apariencia`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('[data-interruptor="glosario"]', { timeout: 6000 }).catch(() => {})
  check('Apariencia tiene «Definiciones del glosario», encendido de serie', await p.locator('[data-interruptor="glosario"]').isChecked().catch(() => false))
  await p.locator('label:has([data-interruptor="glosario"])').click()
  check('  …apagarlo lo recuerda en este navegador', await p.evaluate(() => localStorage.getItem('pd-sin-glosario')) === '1')
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(600)
  const m = await montar(p)
  check('  …y ya no se subraya nada', m.n === 0 && (await p.locator('#pruebaGlosa .glosa').count()) === 0, JSON.stringify(m))
  await ctx.close()
}
await b.close()
check('Ajustes no se baja la lista de palabras por el interruptor', !/glosario-datos|from '\.\/glosario\.js'/.test(readFileSync(`${REPO}/js/ajustes.js`, 'utf8')))

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
