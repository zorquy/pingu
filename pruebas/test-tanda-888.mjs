// Tanda 888 — el vigilante de los sprites: una CDN que no contesta.
//
// PINGU: «no cargan los sprites en pokedoc». r2.limitlesstcg.net se quedó
// colgada (no un 404: una petición que no termina) y el meta salió vacío,
// porque la cadena de respaldos solo da un paso cuando la imagen FALLA, y
// el navegador tarda minutos en darla por perdida. Desde la 888, el sprite
// que lleve más de cuatro segundos sin cargar salta solo al siguiente origen.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro ──')
{
  const m = await import(`${RAIZ}/js/torneos/sprites-pokemon.js`)
  const { saltoPorEspera, MS_DE_ESPERA } = m
  check('cuatro segundos de espera', MS_DE_ESPERA === 4000)
  const estado = { respaldos: 'https://b/1.png https://c/1.png', desde: 1000, completa: false }
  check('antes del plazo, nada', saltoPorEspera(estado, 1000 + MS_DE_ESPERA - 1) === null)
  const salto = saltoPorEspera(estado, 1000 + MS_DE_ESPERA)
  check('pasado el plazo, el PRIMER respaldo, y quedan los demás', salto?.src === 'https://b/1.png' && salto.respaldos === 'https://c/1.png', JSON.stringify(salto))
  check('una imagen que ya terminó (cargó o falló) no se toca', saltoPorEspera({ ...estado, completa: true }, 99999) === null)
  check('sin respaldos, nada que hacer', saltoPorEspera({ respaldos: '', desde: 1000, completa: false }, 99999) === null)
  check('sin «desde» (aún no vista), nada', saltoPorEspera({ respaldos: 'https://b/1.png', desde: 0, completa: false }, 99999) === null)
  check('el último respaldo deja la lista vacía (el onerror pondrá la inicial)', saltoPorEspera({ respaldos: 'https://c/1.png', desde: 1, completa: false }, 99999)?.respaldos === '')
  // Importar el módulo en Node no arranca nada: no hay `document`.
  check('en Node no hay vigilante (sin document)', typeof document === 'undefined')
}

console.log('\n── 2. En el navegador: Limitless colgada, PokeAPI contesta ──')
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const b = await chromium.launch()
async function abrir({ limitless }) {
  const ctx = await b.newContext()
  const p = await ctx.newPage()
  const pedidas = []
  // Limitless: colgada (la petición no termina) o rápida, según el caso.
  await p.route(/r2\.limitlesstcg\.net/, (r) => { pedidas.push(r.request().url()); if (limitless === 'rapida') r.fulfill({ status: 200, contentType: 'image/png', body: PNG }) /* colgada: no se contesta nunca */ })
  await p.route(/cdn\.jsdelivr\.net/, (r) => { pedidas.push(r.request().url()); r.fulfill({ status: 200, contentType: 'image/png', body: PNG }) })
  await p.goto(`${BASE}/meta.html`, { waitUntil: 'domcontentloaded' })
  // Un sprite montado como lo montan las páginas: Limitless primero y su cadena detrás.
  await p.evaluate(async () => {
    const m = await import('/js/torneos/sprites-pokemon.js')
    const url = m.urlDeSprite(887)
    document.body.insertAdjacentHTML('beforeend', `<div id="pruebaSprite"><img id="spr" src="${url}" width="40" height="40" alt=""${m.atributosDeRespaldo(url)}></div>`)
  })
  return { p, ctx, pedidas }
}
{
  const { p, ctx, pedidas } = await abrir({ limitless: 'colgada' })
  await p.waitForTimeout(1500)
  check('al segundo y medio sigue esperando a Limitless (no se precipita)', await p.evaluate(() => /limitlesstcg/.test(document.getElementById('spr').src)), await p.evaluate(() => document.getElementById('spr').src))
  await p.waitForTimeout(5000)
  const src = await p.evaluate(() => document.getElementById('spr').src)
  const cargada = await p.evaluate(() => { const i = document.getElementById('spr'); return i.complete && i.naturalWidth > 0 })
  check('pasados los cuatro segundos salta a PokeAPI (jsDelivr) y la imagen CARGA', /cdn\.jsdelivr\.net\/gh\/PokeAPI\/sprites@master\/sprites\/pokemon\/887\.png/.test(src) && cargada, `${src} · cargada ${cargada}`)
  check('  …y los respaldos que quedan son los de después (GitHub a pelo)', /raw\.githubusercontent\.com/.test(await p.evaluate(() => document.getElementById('spr').dataset.respaldos)) && !/jsdelivr/.test(await p.evaluate(() => document.getElementById('spr').dataset.respaldos)))
  check('  …se pidió a Limitless una vez y a jsDelivr una vez', pedidas.filter((u) => /limitless/.test(u)).length === 1 && pedidas.filter((u) => /jsdelivr/.test(u)).length === 1, pedidas.join(' | '))
  await ctx.close()
}
{
  const { p, ctx, pedidas } = await abrir({ limitless: 'rapida' })
  await p.waitForTimeout(6000)
  const src = await p.evaluate(() => document.getElementById('spr').src)
  check('si Limitless contesta a tiempo, se queda su sprite y no se pide nada más', /limitlesstcg/.test(src) && !pedidas.some((u) => /jsdelivr/.test(u)), `${src} · ${pedidas.join(' | ')}`)
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
