// Tanda 1281 — /para-tiendas rediseñada (PINGU: «rediséñame la pantalla de
// tiendas, de cuando se registran, para poner más info, poder agregar el pdf
// para que se descargue desde ahí y que sea todo más visual»; lo principal,
// «gestionar tu inventario de una manera sencilla y virtual»):
//   · el héroe con el título del inventario, «Pide acceso» al formulario y el
//     dossier para descargar;
//   · las capturas son de la web de verdad y TODAS existen (y llevan su
//     tamaño, para no saltar al cargar);
//   · el PDF existe, es un PDF, y los dos enlaces lo descargan;
//   · el formulario sigue igual (sus ids, la 1067);
//   · sin salirse de ancho en el móvil y sin errores, en claro y en oscuro.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { existsSync, readFileSync, statSync } from 'node:fs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Los ficheros ──')
{
  const html = readFileSync(`${RAIZ}/para-tiendas.html`, 'utf8')
  const imgs = [...html.matchAll(/src="(\/assets\/tiendas\/[^"]+)"/g)].map((m) => m[1])
  const faltan = imgs.filter((f) => !existsSync(`${RAIZ}${f}`))
  check('las imágenes de la página existen (y son unas cuantas)', imgs.length >= 9 && !faltan.length, faltan.join(', ') || imgs.length)
  const sinTamano = [...html.matchAll(/<img [^>]*src="\/assets\/tiendas\/[^"]+"[^>]*>/g)].map((m) => m[0]).filter((t) => !/width="\d+"/.test(t) || !/height="\d+"/.test(t))
  check('  …y todas con su ancho y su alto', !sinTamano.length, sinTamano[0])
  const pdf = `${RAIZ}/descargas/pokedoc-para-tiendas.pdf`
  check('el dossier existe y es un PDF', existsSync(pdf) && readFileSync(pdf).subarray(0, 5).toString() === '%PDF-')
  const mb = statSync(pdf).size / 1048576
  check('  …de menos de 6 MB, y la página dice lo que pesa', mb < 6 && new RegExp(`${Math.round(mb)} MB`).test(html), mb.toFixed(1))
  check('la hoja propia, sin la de /tiendas', /href="\/css\/para-tiendas\.css"/.test(html) && !/href="\/css\/tiendas\.css"/.test(html))
}

const b = await chromium.launch()
async function abrir({ movil = false, tema = 'light' } = {}) {
  const ctx = await b.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1360, height: 900 } }), colorScheme: tema, serviceWorkers: 'block' })
  await ctx.addInitScript((t) => { window.__FAKE_SESSION__ = 'none'; try { localStorage.setItem('pokedoc-theme', t) } catch {} }, tema)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}/para-tiendas`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  return { p, ctx, errs }
}

console.log('── 2. La página ──')
{
  const { p, ctx, errs } = await abrir()
  check('sin errores', !errs.length, errs.join(' | '))
  check('el título habla del inventario', /Tu inventario de cartas/.test(await p.textContent('h1')))
  check('«Pide acceso» lleva al formulario de la misma página', (await p.getAttribute('.pt-heroe a.btn-primary', 'href')) === '#pide' && (await p.locator('#pide #tiendasForm').count()) === 1)
  const descargas = await p.$$eval('a[href="/descargas/pokedoc-para-tiendas.pdf"]', (as) => as.map((a) => a.hasAttribute('download')))
  check('dos botones al dossier (arriba y en su bloque), los dos de descarga', descargas.length === 2 && descargas.every(Boolean), JSON.stringify(descargas))
  const r = await p.request.get(`${BASE}/descargas/pokedoc-para-tiendas.pdf`)
  check('  …y el PDF se sirve', r.ok() && (await r.body()).subarray(0, 5).toString() === '%PDF-')
  check('el inventario va primero y marcado', /Inventario/.test(await p.textContent('.pt-tres li:first-child')) && (await p.locator('.pt-tres .pt-tres-uno').count()) === 1)
  check('los iconos están pintados', (await p.locator('main [data-icono] svg').count()) >= 25, await p.locator('main [data-icono] svg').count())
  await p.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager' }))
  await p.waitForTimeout(1500)
  const rotas = await p.$$eval('main img', (is) => is.filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src))
  check('ninguna imagen rota', !rotas.length, rotas.join(', '))
  await p.click('.pt-heroe a.btn-primary'); await p.waitForTimeout(1600) // el desplazamiento es suave
  check('pulsar «Pide acceso» deja el formulario a la vista', await p.evaluate(() => { const r = document.querySelector('#tiendasNombre').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight }))
  await ctx.close()
}
for (const [movil, tema] of [[true, 'light'], [false, 'dark'], [true, 'dark']]) {
  const { p, ctx, errs } = await abrir({ movil, tema })
  const ancho = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
  check(`${movil ? 'móvil' : 'PC'} en ${tema === 'dark' ? 'oscuro' : 'claro'}: sin errores ni salirse de ancho`, !errs.length && ancho[0] <= ancho[1], `${errs.join(' | ')} ${ancho}`)
  if (movil) {
    const desborda = await p.$$eval('.pt-moviles', (xs) => xs.map((x) => getComputedStyle(x).overflowX))
    check('  …los tres móviles del escaparate se deslizan de lado', desborda[0] === 'auto', desborda.join())
  }
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
