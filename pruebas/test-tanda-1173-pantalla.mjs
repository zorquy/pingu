// Tanda 1173 — Pagaste · Valen · Vas bajo la gráfica, Tus alertas y Tu mes
// (P5, P6 y P7 de la propuesta del Panel).
//   · La tira del balance (la regla de la 428: solo sobre lo apuntado) y «N
//     cartas sin apuntar lo que pagaste» → Añadidas con ?sin=pagado.
//   · «Tus alertas»: las activas con el umbral, el precio de hoy y a cuánto
//     están, las más cerca primero; la campanita de Movimientos abre el aviso.
//   · «Tu mes»: cartas, expansiones nuevas, cambios y valor; la mejor compra;
//     Compartir abre la hoja con la imagen.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const sinNbsp = (x) => String(x ?? '').replace(/\u00a0/g, ' ')
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const browser = await chromium.launch()

const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191, card_count_total: 252 }, { id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, card_count_total: 207 }, { id: 'sv9', name: 'Evoluciones Prismáticas', serie_id: 'sv', market: 'WEST', release_date: '2025-01-17', card_count_official: 131, card_count_total: 180 }]
const nombres = ['Pikachu ex', 'Charizard ex', 'Mew ex', 'Greninja', 'Zapdos ex', 'Alakazam', 'Gengar', 'Raichu']
const setDe = (i) => (i === 2 ? 'sv9' : i < 5 ? 'sv8' : 'sv3pt5')
const CARTAS = nombres.map((n, i) => ({ id: `${setDe(i)}-${i + 1}`, market: 'WEST', set_id: setDe(i), local_id: String(i + 1), name: n, name_es: n, image_path: `x/${i}`, rarity: 'Rare', category: 'Pokemon', dex_ids: [25 + i], tcg_sets: { id: setDe(i), name: SETS.find((s) => s.id === setDe(i)).name, serie_id: 'sv' } }))
const precio = (i) => [182, 96.5, 44, 12.3, 30, 7.2, 3.1, 1.5][i]
const PRECIOS = CARTAS.map((c, i) => ({ card_id: c.id, cm_low: precio(i), cm_low_es: precio(i), checked_at: '2026-10-19T10:00:00Z' }))
const hoy = new Date(); hoy.setHours(12, 0, 0, 0)
const hace = (d) => new Date(hoy.getTime() - d * 864e5).toISOString()
// Tres de hoy (Pikachu, Charizard ×3 pagando 40, Mew en un set NUEVO), el
// resto de hace mes y medio. Lo pagado solo en Pikachu (150), Charizard (40) y
// Gengar (3).
const COLECCION = CARTAS.map((c, i) => ({ id: `l${i}`, user_id: 'admin-1', card_id: c.id, market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: i === 1 ? 3 : 1, precio_compra: i === 0 ? 150 : i === 1 ? 40 : i === 6 ? 3 : null, created_at: hace(i < 3 ? 0 : 45) }))
const hoyUtc = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
const VALOR = Array.from({ length: 40 }, (_, d) => ({ user_id: 'admin-1', dia: new Date(hoyUtc - d * 864e5).toISOString().slice(0, 10), valor: 400 - d * 2 }))
const HIST = []
CARTAS.forEach((c, i) => { for (let d = 0; d < 10; d++) { const v = precio(i) * (1 + (i % 2 ? -1 : 1) * 0.01 * d); HIST.push({ card_id: c.id, dia: new Date(hoyUtc - d * 864e5).toISOString().slice(0, 10), cm_low: v, cm_low_es: v, origen: 'tcggo' }) } })
// Tres alertas: Gengar (baja de 1 €, hoy 3,10 → a 2,10 €), Charizard (sube de
// 100, hoy 96,50 → a 3,50 €, CERCA), Pikachu (baja de 150, hoy 182 → a 32 €).
const AVISOS = [{ id: 'av1', user_id: 'admin-1', card_id: 'sv8-1', market: 'WEST', idioma: 'es', tipo: 'baja', umbral: 150, activo: true }, { id: 'av2', user_id: 'admin-1', card_id: 'sv8-2', market: 'WEST', idioma: 'es', tipo: 'sube', umbral: 100, activo: true }, { id: 'av3', user_id: 'admin-1', card_id: 'sv3pt5-7', market: 'WEST', idioma: 'es', tipo: 'baja', umbral: 1, activo: true }, { id: 'av4', user_id: 'admin-1', card_id: 'sv8-1', market: 'WEST', idioma: 'es', tipo: 'baja', umbral: 170, activo: false }]
const sembrar = (d) => {
  window.__FAKE_SESSION__ = 'admin-1'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.removeItem('mc-mov-periodo') } catch {}
  Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_PRECIOS__: d.PRECIOS, __FAKE_COLECCION__: d.COLECCION, __FAKE_DESEOS__: [], __FAKE_VALOR__: d.VALOR, __FAKE_HISTORIAL__: d.HIST, __FAKE_AVISOS__: d.AVISOS, __FAKE_PERFILES__: [{ id: 'admin-1', username: 'pingu' }] })
}
const datos = { SETS, CARTAS, PRECIOS, COLECCION, VALOR, HIST, AVISOS }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

console.log('── PC: la tira, las alertas y tu mes ──')
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(sembrar, datos)
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcAlertas a.mc-alerta', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
  // Desde la 1174 es UNA línea secundaria bajo la gráfica (PINGU: «no me
  // gusta que ocupe tanto espacio»), no tres fichas.
  const t = await page.evaluate(() => ({
    linea: document.getElementById('mcBalance')?.textContent.replace(/\s+/g, ' ').trim(),
    vas: document.querySelector('#mcBalance b.mc-gana')?.textContent,
    falta: document.querySelector('#mcBalance [data-ir-a="anadidas"]')?.textContent.trim(),
    dentro: !!document.querySelector('#mcValorCaja #mcBalance'),
    linea1: document.getElementById('mcBalance')?.classList.contains('mc-cartera-sub'),
  }))
  check('la línea Pagaste · valen · vas, dentro de la cartera y secundaria, sobre las 5 copias con lo pagado', t.dentro && t.linea1 && /^Pagaste 273,00 € en 5 cartas valen 474,60 € vas \+201,60 € \(\+74 %\)/.test(sinNbsp(t.linea)) && sinNbsp(t.vas) === '+201,60 € (+74 %)', JSON.stringify(t))
  check('  …y «5 sin apuntar →»', /^5 sin apuntar/.test(t.falta || ''), t.falta)
  const al = await page.evaluate(() => ({
    filas: [...document.querySelectorAll('#mcAlertas a.mc-alerta')].map((a) => `${a.querySelector('b').textContent}|${a.querySelector('.mc-movida-precio small').textContent.trim()}|${a.classList.contains('cerca') ? 'cerca' : ''}`),
    textos: [...document.querySelectorAll('#mcAlertas a.mc-alerta .mc-movida-nombre small')].map((s) => s.textContent),
    mas: !!document.querySelector('[data-alertas-mas]'),
  }))
  check('«Tus alertas»: las tres activas (no la apagada), la más cerca primero', sinNbsp(al.filas.join(' / ')) === 'Gengar|a 2,10 €| / Charizard ex|a 3,50 €|cerca / Pikachu ex|a 32,00 €|', JSON.stringify(al))
  check('  …con el umbral y el precio de hoy', sinNbsp(al.textos[0]) === 'si baja de 1,00 € · hoy 3,10 €' && sinNbsp(al.textos[1]) === 'si sube de 100,00 € · hoy 96,50 €', JSON.stringify(al.textos))
  check('  …y sin «Ver las N» con tres', !al.mas)
  const mes = await page.evaluate(() => ({
    titulo: document.querySelector('#mcMes .mc-subtitulo')?.textContent,
    fichas: [...document.querySelectorAll('#mcMes .mc-mes-ficha')].map((f) => `${f.querySelector('b').textContent} ${f.querySelector('span').textContent}`),
    mejor: document.querySelector('#mcMes .mc-vistazo-linea')?.textContent,
  }))
  check(`«Tu ${MESES[new Date().getMonth()]}»: 5 cartas, 1 expansión nueva, 0 cambios y el valor del mes`, mes.titulo === `Tu ${MESES[new Date().getMonth()]}` && mes.fichas[0] === '+5 cartas' && mes.fichas[1] === '1 expansión nueva' && mes.fichas[2] === '0 cambios hechos' && /^[+−]\d/.test(mes.fichas[3] || '') && /de valor este mes$/.test(mes.fichas[3] || ''), JSON.stringify(mes))
  check('  …y la mejor compra del mes (Charizard ex: pagaste 40, vale 96,50)', sinNbsp(mes.mejor) === 'Tu mejor compra del mes: Charizard ex, pagaste 40,00 € y vale 96,50 €.', mes.mejor)
  await page.click('#mcMes [data-mes-compartir]')
  await page.waitForTimeout(2500)
  const hoja = await page.evaluate(() => { const d = document.querySelector('.ch-caja')?.closest('dialog'); return { abierta: !!d?.open, titulo: document.getElementById('chTitulo')?.textContent, lienzo: !!d?.querySelector('canvas, img') } })
  check('«Compartir» abre la hoja con la imagen del mes', hoja.abierta && hoja.titulo === `Tu ${MESES[new Date().getMonth()]}` && hoja.lienzo, JSON.stringify(hoja))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // «Sin apuntar» → Añadidas filtradas.
  await page.click('#mcBalance [data-ir-a="anadidas"]')
  await page.waitForSelector('#mcAnadLista a.mc-movida', { timeout: 8000 }).catch(() => {})
  const an = await page.evaluate(() => ({ url: location.search, filas: document.querySelectorAll('#mcAnadLista a.mc-movida').length, campos: document.querySelectorAll('#mcAnadLista input[data-pagado-de]').length }))
  check('«sin apuntar» abre Añadidas con ?sin=pagado y las 5', /ver=anadidas/.test(an.url) && /sin=pagado/.test(an.url) && an.filas === 5 && an.campos === 5, JSON.stringify(an))
  await page.click('#mcVistaVolver')
  await page.waitForTimeout(400)
  check('  …y al volver se va el ?sin', await page.evaluate(() => !location.search.includes('sin=')))
  // La campanita de Movimientos.
  await page.click('#mcMovidas .ver-todo')
  await page.waitForSelector('#mcMovLista a.mc-movida', { timeout: 8000 }).catch(() => {})
  const campanas = await page.locator('#mcMovLista [data-alerta-de]').count()
  check('cada fila de Movimientos lleva su campanita', campanas > 0 && campanas === (await page.locator('#mcMovLista a.mc-movida').count()), String(campanas))
  await page.locator('#mcMovLista [data-alerta-de]').first().click()
  await page.waitForTimeout(600)
  const aviso = await page.evaluate(() => ({ abierto: !!document.getElementById('pvAvisoDialogo')?.open, ahora: document.getElementById('pvAvisoAhora')?.textContent, url: location.pathname }))
  check('  …que abre «Avísame de esta carta» con el precio de hoy, sin salir', aviso.abierto && /Ahora está a/.test(aviso.ahora || '') && /mi-coleccion/.test(aviso.url), JSON.stringify(aviso))
  check('PC: sin errores', !err.length, err.join(' | '))
  await ctx.close()
}

console.log('── Móvil: la tira cabe y nada se sale ──')
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(sembrar, datos)
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcAlertas a.mc-alerta', { timeout: 15000 }).catch(() => {})
  const m = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect()
    const t = r('#mcBalance'); const mes = r('#mcMes .mc-mes-rejilla')
    return { tira: t && t.width <= innerWidth, mes: mes && mes.width <= innerWidth, mesFilas: new Set([...document.querySelectorAll('#mcMes .mc-mes-ficha')].map((f) => Math.round(f.getBoundingClientRect().top))).size, reojoMes: !!document.querySelector('#mcReojoMes')?.getClientRects().length, ancho: document.documentElement.scrollWidth <= innerWidth, alertas: document.querySelectorAll('#mcAlertas a.mc-alerta').length }
  })
  check('la línea del balance cabe, Tu mes como tarjeta de reojo (1178), tres alertas', m.tira && m.reojoMes && m.alertas === 3, JSON.stringify(m))
  check('  …sin salirse de la pantalla', m.ancho, JSON.stringify(m))
  check('móvil: sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
