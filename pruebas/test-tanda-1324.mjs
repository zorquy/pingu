// Tanda 1324 — Letra y contraste en Ajustes (D5 del plan): tres tamaños de
// letra y «Más contraste», guardados en el navegador y puestos ANTES del
// primer pintado por la cabecera de cada página (como el tema).
import { readFileSync, readdirSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const paginas = [...readdirSync(REPO).filter((f) => f.endsWith('.html')).map((f) => f), ...readdirSync(`${REPO}/admin`).filter((f) => f.endsWith('.html')).map((f) => `admin/${f}`)]
const conTema = paginas.filter((f) => /localStorage\.getItem\('pokedoc-theme'\)/.test(readFileSync(`${REPO}/${f}`, 'utf8')))
const sinLetra = conTema.filter((f) => { const s = readFileSync(`${REPO}/${f}`, 'utf8'); const i = s.indexOf("getItem('pokedoc-theme')"); const j = s.indexOf("getItem('pd-letra')"); return j < 0 || j < i || j > s.indexOf('</head>') })
check(`las ${conTema.length} páginas con tema lo ponen también (en la cabecera, detrás del tema)`, conTema.length > 50 && sinLetra.length === 0, sinLetra.join(', '))
const css = readFileSync(`${REPO}/css/style.css`, 'utf8')
check('la letra cambia el tamaño base (todo va en rem)', /:root\[data-letra="grande"\] \{ font-size: 112\.5%; \}/.test(css) && /:root\[data-letra="muy-grande"\] \{ font-size: 125%; \}/.test(css))

const luz = (hex) => { const c = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
const contraste = (a, b) => { const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const claro = css.match(/:root\[data-contraste="1"\] \{ --text-mid: (#[0-9a-f]{6}); --text-dim: (#[0-9a-f]{6});/)
const oscuro = css.match(/:root\[data-theme='dark'\]\[data-contraste="1"\] \{ --text-mid: (#[0-9a-f]{6}); --text-dim: (#[0-9a-f]{6});/)
check('con «Más contraste», hasta el gris más claro pasa de 4,5 en los dos temas', claro && oscuro && contraste(claro[2], '#ffffff') >= 4.5 && contraste(oscuro[2], '#182430') >= 4.5, claro && oscuro ? `${contraste(claro[2], '#ffffff').toFixed(2)} / ${contraste(oscuro[2], '#182430').toFixed(2)}` : 'sin reglas')

const b = await chromium.launch()
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/ajustes.html?ver=apariencia`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.aj-letra', { timeout: 6000 }).catch(() => {})
  check('Apariencia: «Letra» en tres tamaños (Normal marcado) y «Más contraste»', (await p.locator('.aj-letra [data-letra]').count()) === 3 && (await p.getAttribute('.aj-letra [data-letra=""]', 'aria-pressed')) === 'true' && (await p.locator('[data-interruptor="contraste"]').count()) === 1)
  const antes = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.aj-vista-letra')).fontSize))
  await p.click('.aj-letra [data-letra="muy-grande"]')
  const despues = await p.evaluate(() => ({ fs: parseFloat(getComputedStyle(document.querySelector('.aj-vista-letra')).fontSize), html: document.documentElement.dataset.letra, guardado: localStorage.getItem('pd-letra') }))
  check('«Muy grande» se ve al momento (la vista previa crece un 25 %) y se guarda', despues.html === 'muy-grande' && despues.guardado === 'muy-grande' && Math.abs(despues.fs / antes - 1.25) < 0.02, JSON.stringify({ antes, ...despues }))
  await p.locator('label:has([data-interruptor="contraste"])').click()
  check('«Más contraste» también', await p.evaluate(() => document.documentElement.dataset.contraste === '1' && localStorage.getItem('pd-contraste') === '1'))
  // Otra página: antes del primer pintado ya lleva la letra y el contraste.
  const q = await ctx.newPage()
  await q.addInitScript(() => { document.addEventListener('readystatechange', () => { if (document.readyState === 'interactive') window.__alLeer = { letra: document.documentElement.dataset.letra, contraste: document.documentElement.dataset.contraste, fs: getComputedStyle(document.documentElement).fontSize } }) })
  await q.goto(`${BASE}/foro.html`, { waitUntil: 'domcontentloaded' })
  const al = await q.evaluate(() => window.__alLeer)
  await q.waitForLoadState('load')
  const fs = await q.evaluate(() => getComputedStyle(document.documentElement).fontSize)
  check('en otra página, ya al leerla (antes del primer pintado): «muy grande» y con contraste', al?.letra === 'muy-grande' && al.contraste === '1', JSON.stringify(al))
  check('  …con 20 px de base', fs === '20px', fs)
  await p.click('.aj-letra [data-letra=""]')
  check('«Normal» lo quita', await p.evaluate(() => !document.documentElement.dataset.letra && localStorage.getItem('pd-letra') === null))
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
