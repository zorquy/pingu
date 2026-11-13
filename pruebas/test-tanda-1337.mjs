// Tanda 1337 — Redes: el meta de la semana, las cartas que más suben, los
// hitos (de `sobre_cifras`) y «Hoy toca» (el plan de cada día) en /admin → Redes.
import { writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const FOTOS = process.env.PD_FOTOS || ''
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
const R = await import(`${REPO}/js/redes-textos.js`)
const lunes = new Date('2026-11-16T10:00:00Z')
const META = [
  { arquetipo: 'drag', nombre: 'Dragapult ex', iconos: ['dragapult', 'dusknoir'], cuota: 18.43, cuota_anterior: 15.1 },
  { arquetipo: 'gard', nombre: 'Gardevoir ex', iconos: ['gardevoir'], cuota: 12, cuota_anterior: 13 },
  { arquetipo: 'bolt', nombre: 'Raging Bolt ex', iconos: ['raging-bolt'], cuota: 9.5, cuota_anterior: null },
  { arquetipo: 'zard', nombre: 'Charizard ex', iconos: ['charizard', 'pidgeot'], cuota: 7, cuota_anterior: 7 },
]
const pm = R.piezaDelMeta(META, { ahora: lunes, iconos: (i) => `https://cdn/${i}.png` })
check('el meta: clave de la semana, los de más cuota primero, «18,4 %»', pm?.clave === 'meta:2026-11-16' && pm.diapositivas[0].datos.filas.map((f) => f.nombre).join() === 'Dragapult ex,Gardevoir ex,Raging Bolt ex,Charizard ex' && pm.diapositivas[0].datos.filas[0].cuotaTexto === '18,4 %')
check('  …con lo que sube o baja (↑3,3 · ↓1) y nada si no se sabe o no cambia', /Dragapult ex 18,4 % ↑3,3/.test(pm.x.texto) && /Gardevoir ex 12 % ↓1/.test(pm.x.texto) && /Raging Bolt ex 9,5 % ·/.test(pm.x.texto) && /Charizard ex 7 %$/.test(pm.x.texto), pm.x.texto)
check('  …y los iconos con la URL que da quien llama', pm.diapositivas[0].datos.filas[0].iconos.join() === 'https://cdn/dragapult.png,https://cdn/dusknoir.png')
check('  …con menos de tres arquetipos, nada', R.piezaDelMeta(META.slice(0, 2), { ahora: lunes }) === null)
const ps = R.piezaQueMasSuben([{ nombre: 'Umbreon ex', precio: 310, sube: 0.234, imagen: null }, { nombre: 'Pikachu', precio: 12.5, sube: 0.18 }, { nombre: 'Mew', precio: 40, sube: 0.1 }], { ahora: lunes })
check('las que más suben: «+23 %» y el precio debajo, en el molde de «Las más caras»', ps?.clave === 'suben:2026-11-16' && ps.tipo === 'precios' && ps.diapositivas[0].pintor === 'lanzamiento-caras' && ps.diapositivas[0].datos.cartas.map((c) => `${c.precioTexto}|${c.debajo}`).join() === '+23 %|310 €,+18 %|12,50 €,+10 %|40 €')
check('  …con menos de tres, nada', R.piezaQueMasSuben([{ nombre: 'a', sube: 0.2 }]) === null)
check('hitos: la cifra redonda más alta a la que se ha llegado', R.hitoDe(1043) === 1000 && R.hitoDe(2499) === 1000 && R.hitoDe(2500) === 2500 && R.hitoDe(9) === null)
const hs = R.piezasDeHitos({ personas: 1043, cartas: 254321, temas: 87, torneos: 120 }, { ahora: lunes })
check('  …una pieza por cosa, la clave lleva el hito, y por debajo de 100 no sale', hs.map((p) => p.clave).join() === 'hito:personas:1000,hito:cartas:250000,hito:torneos:100' && hs[0].titulo === 'Ya somos 1.000 personas en PokeDoc' && hs[1].diapositivas[0].datos.numero === '250.000', hs.map((p) => p.clave).join())
const dias = ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'].map((d) => R.hoyToca(new Date(`${d}T10:00:00Z`)))
check('«Hoy toca»: domingo novedades, lunes meta, martes guía, miércoles precios, jueves eventos, viernes lanzamiento o torneo, sábado torneo', dias.map((d) => `${d.dia}:${d.tipos[0]}`).join() === 'domingo:novedades,lunes:meta,martes:guia,miércoles:precios,jueves:evento,viernes:lanzamiento,sábado:torneo', dias.map((d) => `${d.dia}:${d.tipos[0]}`).join())
check('  …a medianoche cuenta el día de España, no el de UTC', R.hoyToca(new Date('2026-11-16T23:30:00Z')).dia === 'martes')
const hoy = R.hoyToca()
const todas = [pm, ps, ...hs]
const deHoy = R.filtrarPiezas(todas, 'hoy', new Map())
check('  …el filtro «hoy» se queda con lo del tipo del día que falta', deHoy.every((p) => hoy.tipos.includes(p.tipo)) && R.cuentasDe(todas, new Map()).hoy === deHoy.length)

const b = await chromium.launch()
const h = (d) => new Date(Date.now() + d * 3600e3).toISOString()
const PRECIOS = [['c1', 'Umbreon ex', 310, 320, 260], ['c2', 'Pikachu ex', 40, 42, 34], ['c3', 'Mew ex', 22, 23, 20], ['c4', 'Bidoof', 12, 11, 12]]
async function abrir({ movil = false } = {}) {
  const ctx = await b.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, locale: 'es-ES', serviceWorkers: 'block', hasTouch: movil, isMobile: movil })
  await ctx.addInitScript(({ META, PRECIOS }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_FILAS__ = {
      guides: [], tournaments: [], eventos: [], tcg_sets: [], redes_compartido: [],
      tcg_card_prices: PRECIOS.map(([card_id, , cm_trend, cm_avg7, cm_avg30]) => ({ card_id, cm_trend, cm_avg7, cm_avg30 })),
      tcg_cards: PRECIOS.map(([id, name]) => ({ id, name, set_id: 's', local_id: '1', market: 'WEST', image_path: null })),
    }
    window.__RPC_RESPUESTAS__ = { meta_resumen: META, sobre_cifras: { personas: 1043, cartas: 254321, temas: 87, torneos: 120, equipo: [] } }
  }, { META, PRECIOS })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await ctx.route(/\/novedades\.json/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"destacadas":[],"entradas":[]}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/serviceWorker' property from 'Navigator'|ViewTransition/.test(String(e))) errores.push(String(e).slice(0, 200)) })
  await page.goto(`${BASE}/admin/?ver=redes`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.rd-fila', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(500)
  return { page, ctx, errores }
}

console.log('── /admin → Redes ──')
{
  const { page, ctx, errores } = await abrir()
  const claves = await page.evaluate(() => [...document.querySelectorAll('.rd-fila')].map((f) => f.dataset.clave))
  check('salen el meta, las que más suben y los tres hitos', claves.some((k) => k.startsWith('meta:')) && claves.some((k) => k.startsWith('suben:')) && ['hito:personas:1000', 'hito:cartas:250000', 'hito:torneos:100'].every((k) => claves.includes(k)), claves.join())
  const suben = await page.locator('.rd-fila[data-clave^="suben:"] .rd-linea').textContent().catch(() => '')
  check('  …las que más suben: Umbreon, Pikachu y Mew (Bidoof no sube)', /Umbreon ex \+23 %/.test(suben) && /Pikachu ex/.test(suben) && /Mew ex/.test(suben) && !/Bidoof/.test(suben), suben)
  const banda = await page.locator('.rd-hoy').textContent()
  check(`«Hoy toca» dice el día y lo que toca (${hoy.dia})`, banda.includes(`Hoy, ${hoy.dia}, toca ${hoy.texto}.`), banda)
  check('  …y el filtro «Hoy toca» está con su cuenta', (await page.locator('[data-rd-filtro="hoy"] b').count()) === 1)
  await page.locator('.av-pestana[data-rd-filtro="hoy"]').click()
  const deHoyPantalla = await page.evaluate(() => [...document.querySelectorAll('.rd-fila')].map((f) => f.dataset.tipo))
  check('  …al pulsarlo, solo lo de los tipos de hoy', deHoyPantalla.every((t) => hoy.tipos.includes(t)), deHoyPantalla.join())
  await page.locator('.av-pestana[data-rd-filtro="todo"]').click()
  for (const [sel, n] of [['.rd-fila[data-clave^="meta:"]', 'meta'], ['.rd-fila[data-clave^="suben:"]', 'suben'], ['.rd-fila[data-clave="hito:personas:1000"]', 'hito']]) {
    const f = page.locator(sel)
    await f.locator('[data-rd-ig]').click()
    await page.waitForFunction((s) => document.querySelector(`${s} canvas.rd-previa`), sel, { timeout: 15000 }).catch(() => {})
    check(`  …${n}: se dibuja a 1080×1350`, (await f.locator('canvas.rd-previa').evaluate((c) => `${c.width}x${c.height}`).catch(() => '')) === '1080x1350')
    if (FOTOS) {
      mkdirSync(FOTOS, { recursive: true })
      const d = await f.locator('canvas.rd-previa').evaluate((c) => c.toDataURL('image/png')).catch(() => null)
      if (d) writeFileSync(`${FOTOS}/${n}.png`, Buffer.from(d.split(',')[1], 'base64'))
    }
  }
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { page, ctx, errores } = await abrir({ movil: true })
  const ancho = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
  check('móvil: la franja «Hoy toca» no desborda', ancho[0] <= ancho[1], JSON.stringify(ancho))
  if (FOTOS) await page.screenshot({ path: `${FOTOS}/panel-movil.png` })
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
