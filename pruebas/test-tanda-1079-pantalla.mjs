// Tanda 1079 — el logo y la portada de una tienda, sus destacadas y sus
// novedades (lo que PINGU dio por bueno de «Lo siguiente para tiendas»).
// En Datos se sube el logo y la portada (comprimidos, y guardados en su
// perfil); el escaparate enseña la portada y, en «Todo» sin filtros, las
// tiras de Destacadas, En oferta y Novedades; con un filtro, no. En el
// Stock, la estrella cambia ya y vuelve si la base dice que no, y con ocho
// no deja poner la novena. Sin la migración, ni estrella ni tiras.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hace = (d) => new Date(Date.now() - d * 864e5).toISOString()
const FILAS = Array.from({ length: 6 }, (_, i) => ({ id: `st-${i}`, card_id: `carta-${i % 2}`, market: 'WEST', nombre: `Carta ${i}`, set_id: 'set-0', numero: String(i), idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, precio: 10 + i, precio_antes: i === 1 ? 20 : null, oferta_hasta: null, destacada: i < 2, nueva: i === 4, entro_el: hace(i) }))
const TIENDA = { user_id: 'user-2', ciudad: 'Bilbao', precio_visible: true }
const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-2', movil = false, conMigracion = true, destacadas = 1, banner = 'https://ejemplo.supabase.co/storage/v1/object/public/avatars/user-2/banner-1.webp', errorAlGuardar = false } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1500, height: 950 }, serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion
    if (d.sesion === 'user-2') { window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon', banner_url: d.banner }; localStorage.setItem('pd-tienda', '{"u":"rincon","id":"user-2"}') }
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda', banner_url: d.banner }]
    const filas = d.FILAS.map((f, i) => ({ ...f, tienda_id: 'user-2', destacada: i < d.destacadas }))
    window.__FAKE_FILAS__ = { tiendas: [d.TIENDA], tienda_stock: d.errorAlGuardar ? [] : filas.map((f) => ({ id: f.id, tienda_id: 'user-2', card_id: f.card_id, destacada: f.destacada })) }
    window.__FAKE_CARTAS__ = [{ id: 'carta-0', set_id: 'set-0', market: 'WEST', local_id: '0', name: 'Pikachu ex' }, { id: 'carta-1', set_id: 'set-0', market: 'WEST', local_id: '1', name: 'Mew ex' }]
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__PEDIDAS__ = []
    const cuenta = (k) => (d.conMigracion ? { [k]: filas.filter((f) => (k === 'destacadas' ? f.destacada : k === 'ofertas' ? f.precio_antes : f.nueva)).length } : {})
    const quita = (f) => { if (d.conMigracion) return f; const { destacada, nueva, precio_antes, oferta_hasta, ...resto } = f; return resto }
    window.__RPC_RESPUESTAS__ = {
      tienda_stock_lista: { total: filas.length, en_stock: filas.length, ...cuenta('destacadas'), sumas: {}, facetas: {}, filas: filas.map((f) => quita({ ...f, coste: 5, cm: 9, visible: true })) },
      tienda_escaparate: (a) => {
        window.__PEDIDAS__.push(a.p_filtros || {})
        const s = a.p_filtros?.seccion
        const v = filas.filter((f) => !s || (s === 'destacadas' ? f.destacada : s === 'ofertas' ? f.precio_antes : f.nueva))
        return { total: v.length, en_escaparate: filas.length, de_tu_lista: 0, ...cuenta('destacadas'), ...cuenta('ofertas'), ...cuenta('nuevas'), precios: true, facetas: { idioma: { es: 6 } }, filas: v.map(quita) }
      },
      tienda_hoy: { actual: {}, anterior: {}, serie: [], stock: {}, avisos: {}, demanda: [], visitas: {} },
    }
  }, { sesion, TIENDA, FILAS, conMigracion, destacadas, banner, errorAlGuardar })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex|ejemplo\.supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { p, ctx, errs }
}

console.log('── 1. El escaparate: la portada y las tiras ──')
{
  const { p, ctx, errs } = await abrir('/usuario/rincon', { sesion: 'user-1' })
  check('la portada encima de la cabecera, con su foto', !errs.length && (await p.isVisible('.pt-portada')) && /banner-1\.webp/.test(await p.getAttribute('.pt-portada', 'style')) && (await p.locator('.pt-cab.pt-cab-portada').count()) === 1, errs.join(' | '))
  const tiras = await p.locator('.pt-tira h2').allTextContents()
  check('tres tiras, en su orden: Destacadas, En oferta, Novedades', tiras.join('|') === 'Destacadas|En oferta|Novedades', tiras.join('|'))
  check('  …cada una con lo suyo (1, 1 y 1), y «Todo el stock» debajo', (await p.locator('.pt-tira').nth(0).locator('.pt-carta').count()) === 1 && (await p.locator('.pt-tira').nth(1).locator('.pt-carta').count()) === 1 && (await p.isVisible('.pt-todo-titulo')) && (await p.locator('.pt-rejilla .pt-carta').count()) === 6)
  check('la oferta: el precio de antes tachado y cuánto baja', (await p.locator('.pt-tira').nth(1).locator('s.pt-antes').textContent()).includes('20') && /−45 %/.test(await p.locator('.pt-tira').nth(1).locator('.pt-chapa-oferta').textContent()))
  check('lo nuevo lleva su chapa', (await p.locator('.pt-rejilla .pt-chapa-nueva').count()) === 1)
  check('  …y los botones de la barra para verlas enteras', (await p.isVisible('.seg [data-pt-ver="destacadas"]')) && (await p.isVisible('.seg [data-pt-ver="ofertas"]')) && (await p.isVisible('.seg [data-pt-ver="nuevas"]')))
  await p.click('.seg [data-pt-ver="ofertas"]'); await p.waitForTimeout(700)
  check('«Ofertas»: pide esa sección y quita las tiras', (await p.evaluate(() => window.__PEDIDAS__.at(-1).seccion)) === 'ofertas' && (await p.locator('.pt-tira').count()) === 0 && (await p.locator('.pt-rejilla .pt-carta').count()) === 1 && (await p.getAttribute('.seg [data-pt-ver="ofertas"]', 'aria-pressed')) === 'true')
  await p.click('.seg [data-pt-ver="todo"]'); await p.waitForTimeout(700)
  await p.fill('[data-pt-q]', 'pika'); await p.waitForTimeout(900)
  check('buscando, sin tiras: lo que se busca es la lista', (await p.locator('.pt-tira').count()) === 0 && (await p.isHidden('.pt-todo-titulo')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario/rincon', { sesion: 'user-1', movil: true })
  check('en el móvil: sin desbordar, y la barra de chips en una fila', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390 && (await p.evaluate(() => { const s = document.querySelector('.pt-barra .seg'); return getComputedStyle(s).flexWrap })) === 'nowrap')
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir('/usuario/rincon', { sesion: 'user-1', conMigracion: false, banner: null })
  check('sin la migración (ni portada): sin tiras, sin pedirlas y sin botones', !errs.length && (await p.locator('.pt-tira').count()) === 0 && (await p.locator('.pt-portada').count()) === 0 && (await p.evaluate(() => window.__PEDIDAS__.length)) === 1 && (await p.isHidden('.seg [data-pt-ver="ofertas"]')), errs.join(' | '))
  await ctx.close()
}

console.log('── 2. Datos: el logo y la portada ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=datos')
  check('la portada que tiene y los tres botones', !errs.length && /banner-1\.webp/.test(await p.getAttribute('#tdPortada', 'style')) && (await p.textContent('#tdCambiarPortada')) === 'Cambiar la portada' && (await p.isVisible('#tdQuitarPortada')), errs.join(' | '))
  // Un PNG de verdad, para que el navegador lo descodifique y lo comprima.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
  await p.setInputFiles('#tdLogoFichero', { name: 'mi logo raro.png', mimeType: 'image/png', buffer: png }); await p.waitForTimeout(1500)
  const subida = await p.evaluate(() => window.__SUBIDAS__.at(-1))
  check('el logo sube al cubo de los avatares, comprimido y sin el nombre del fichero', subida?.cubo === 'avatars' && /^user-2\/avatar-\d+\.(webp|jpg|png)$/.test(subida.ruta), JSON.stringify(subida))
  check('  …y se guarda en su perfil', await p.evaluate(() => /avatar-\d+/.test(window.__TABLAS__.user_profiles.find((u) => u.id === 'user-2')?.avatar_url || '')))
  check('  …y la cabecera lo pinta', /avatar-\d+/.test(await p.getAttribute('#tdLogoDatos', 'style')))
  await p.click('#tdQuitarPortada'); await p.waitForTimeout(800)
  check('quitar la portada la quita (y el botón vuelve a «Poner una portada»)', (await p.evaluate(() => window.__TABLAS__.user_profiles.find((u) => u.id === 'user-2')?.banner_url)) == null && (await p.textContent('#tdCambiarPortada')) === 'Poner una portada' && (await p.isHidden('#tdQuitarPortada')))
  await ctx.close()
}

console.log('── 3. La estrella del Stock ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=stock')
  check('cada línea lleva su estrella; la destacada, encendida', !errs.length && (await p.locator('.tds-estrella').count()) === 6 && (await p.getAttribute('[data-estrella="st-0"]', 'aria-pressed')) === 'true' && (await p.getAttribute('[data-estrella="st-1"]', 'aria-pressed')) === 'false', errs.join(' | '))
  await p.click('[data-estrella="st-1"]'); await p.waitForTimeout(600)
  check('pulsarla la enciende y lo guarda', (await p.getAttribute('[data-estrella="st-1"]', 'aria-pressed')) === 'true' && (await p.evaluate(() => window.__TABLAS__.tienda_stock.find((f) => f.id === 'st-1')?.destacada)) === true)
  await p.click('[data-tds="seleccionar"]'); await p.waitForTimeout(300)
  check('  …y en la barra de seleccionar está «Destacar»', await p.isVisible('[data-bloque="destacar"]'))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html?ver=stock', { destacadas: 6, errorAlGuardar: true })
  // Seis destacadas de seis líneas: la cuenta de la base manda (8 en total).
  await p.evaluate(() => { window.__RPC_RESPUESTAS__.tienda_stock_lista.destacadas = 8 })
  await p.click('[data-tds="seleccionar"]'); await p.click('[data-tds="seleccionar"]')
  await p.evaluate(() => document.querySelector('[data-tds-orden]').dispatchEvent(new Event('change', { bubbles: true }))); await p.waitForTimeout(700)
  await p.click('[data-estrella="st-0"]'); await p.waitForTimeout(600)
  check('quitar una que la base no deja guardar vuelve a encenderla, con su aviso', (await p.getAttribute('[data-estrella="st-0"]', 'aria-pressed')) === 'true' && /No se ha podido/.test(await p.textContent('body')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html?ver=stock', { destacadas: 0 })
  await p.evaluate(() => { window.__RPC_RESPUESTAS__.tienda_stock_lista.destacadas = 8 })
  await p.evaluate(() => document.querySelector('[data-tds-orden]').dispatchEvent(new Event('change', { bubbles: true }))); await p.waitForTimeout(700)
  await p.click('[data-estrella="st-2"]'); await p.waitForTimeout(500)
  check('con ocho, la novena no: ni se enciende ni se pide', (await p.getAttribute('[data-estrella="st-2"]', 'aria-pressed')) === 'false' && /Como mucho 8/.test(await p.textContent('body')) && (await p.evaluate(() => window.__TABLAS__.tienda_stock.find((f) => f.id === 'st-2')?.destacada)) === false)
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=stock', { conMigracion: false })
  check('sin la migración, el stock sin estrella ni «Destacar»', !errs.length && (await p.locator('.tds-estrella').count()) === 0 && (await p.locator('.tds-sel [data-bloque="destacar"]').evaluate((b) => b.hidden)), errs.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
