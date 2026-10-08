// Tanda 751 — «La quiero» (K1), su aviso de precio (K2) y compartirla como
// imagen (Y3).
//
// Lo que se mira: que el corazón de la ficha pone y quita la carta de la
// lista (y dice «La quieres» pulsado); que la pantalla «La quiero» enseña
// cada carta con su precio, lo que suman y cuántas no tienen precio; que el
// aviso puesto se lee en la fila y la campana abre el «Avísame» con un
// umbral propuesto; que «Compartir» saca la imagen; que el Panel y Cambios
// llevan a la lista; y que en /carta el corazón también está.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()

async function abrir(ruta, { deseos = [], avisos = [], opciones = { ...devices['iPhone 13'] } } = {}) {
  const ctx = await browser.newContext({ ...opciones, locale: 'es-ES', acceptDownloads: true })
  await ctx.addInitScript(([deseos, avisos]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv3', name: 'Llamas Obsidianas', serie_id: 'sv', market: 'WEST', card_count_official: 4, card_count_total: 4, release_date: '2023-08-11', tcg_online_code: 'OBF' }]
    const c = (n) => ({ id: `sv3-${n}`, market: 'WEST', set_id: 'sv3', local_id: String(n), name: `Carta ${n}`, name_es: `Carta ${n}`, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true } })
    window.__FAKE_CARTAS__ = [1, 2, 3, 4].map(c)
    window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'admin-1', card_id: 'sv3-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]
    window.__FAKE_PRECIOS__ = [['sv3-1', 0.3], ['sv3-2', 12.3], ['sv3-3', 1475.9]].map(([card_id, v]) => ({ card_id, market: 'WEST', cm_low: v, cm_trend: v }))
    window.__FAKE_DESEOS__ = deseos
    window.__FAKE_AVISOS__ = avisos
  }, [deseos, avisos])
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" fill="#c33"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|twitter\.com|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}
const deseo = (id, card_id, o = {}) => ({ id, user_id: 'admin-1', card_id, idioma: null, prioridad: 1, notas: null, created_at: '2026-10-05T10:00:00Z', ...o })
const filasDeLaBase = (page) => page.evaluate(async () => {
  const { supabase } = await import('/js/supabase.js')
  const { data } = await supabase.from('user_wants').select('card_id').eq('user_id', 'admin-1')
  return (data || []).map((d) => d.card_id).sort()
})

console.log('── 1. El corazón de la ficha (K1) ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album&set=sv3')
  await page.locator('#mcAlbum [data-carta="sv3-2"]').first().click()
  await page.waitForTimeout(900)
  const b = page.locator('#mcEdQuiero')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la ficha de una carta que no tienes lleva «La quiero», sin pulsar', await b.isVisible() && (await b.getAttribute('aria-pressed')) === 'false' && limpio(await b.textContent()) === 'La quiero', limpio(await b.textContent()))
  await b.click()
  // Desde la 771 pregunta el idioma: «Cualquiera», que va marcado.
  await page.waitForTimeout(400)
  await page.click('#iddApuntar')
  await page.waitForTimeout(900)
  check('  …al tocarlo se pulsa, dice «La quieres» y la carta va a la lista', (await b.getAttribute('aria-pressed')) === 'true' && limpio(await b.textContent()) === 'La quieres' && JSON.stringify(await filasDeLaBase(page)) === '["sv3-2"]', JSON.stringify(await filasDeLaBase(page)))
  await b.click()
  await page.waitForTimeout(900)
  check('  …y otra vez la quita', (await b.getAttribute('aria-pressed')) === 'false' && (await filasDeLaBase(page)).length === 0, JSON.stringify(await filasDeLaBase(page)))
  await ctx.close()
}

console.log('── 2. La pantalla «La quiero», con precios y lo que suman ──')
{
  const deseos = [deseo('d1', 'sv3-2', { prioridad: 3 }), deseo('d2', 'sv3-3', { idioma: 'es' }), deseo('d3', 'sv3-4')]
  const avisos = [{ id: 'a1', user_id: 'admin-1', card_id: 'sv3-2', market: 'WEST', idioma: 'es', tipo: 'baja', umbral: 10, activo: true, disparado_at: null, precio_disparo: null, created_at: '2026-10-06T00:00:00Z' }]
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=quiero', { deseos, avisos })
  const m = await page.evaluate(() => ({
    visible: !document.getElementById('mcPanelQuiero').classList.contains('hidden'),
    titulo: document.querySelector('#mcPanelQuiero h2')?.textContent,
    cifra: document.getElementById('mcQuieroCifra')?.textContent.replace(/\s+/g, ' ').trim(),
    filas: [...document.querySelectorAll('#mcQuieroRejilla .mc-deseo-baldosa')].map((f) => ({
      precio: f.querySelector('.mc-quiero-precio')?.textContent.replace(/\s/g, ' '),
      aviso: f.querySelector('.mc-quiero-aviso')?.textContent.replace(/\s/g, ' ').trim(),
      nombre: Math.round(f.querySelector('.mc-merc-nombre').getBoundingClientRect().width),
    })),
    ancho: document.documentElement.scrollWidth <= innerWidth,
  }))
  check('sin errores', errores.length === 0, errores.join(' | '))
  // Desde la 763 la pantalla se llama «Deseos y cambios» y «La quiero» es su
  // primera vista.
  check('?ver=quiero abre «La quiero»', m.visible && m.titulo === 'Deseos y cambios', JSON.stringify(m))
  check('arriba, cuántas y lo que suman (y cuántas no tienen precio)', m.cifra === '3 cartas · unos 1.488,20 € (1 sin precio)', m.cifra)
  check('cada fila con su precio, o «sin precio»', JSON.stringify(m.filas.map((f) => f.precio)) === JSON.stringify(['12,30 €', '1.475,90 €', 'sin precio']), JSON.stringify(m.filas))
  check('el aviso puesto se lee en su fila (K2)', m.filas[0].aviso === '< 10,00 €' && m.filas[1].aviso === '', JSON.stringify(m.filas.map((f) => f.aviso)))
  check('  …y en el móvil el nombre se lee y nada se sale', m.ancho && m.filas.every((f) => f.nombre > 120), JSON.stringify(m.filas.map((f) => f.nombre)))

  await page.locator('#mcQuieroRejilla .mc-deseo-baldosa').nth(1).locator('.mc-quiero-aviso').click()
  await page.waitForTimeout(500)
  const d = await page.evaluate(() => ({ abierto: document.getElementById('pvAvisoDialogo')?.open, umbral: document.getElementById('pvAvisoUmbral')?.value }))
  check('la campana de una fila abre «Avísame» con un umbral un 10 % por debajo', d.abierto && d.umbral === '1328.31', JSON.stringify(d))
  await page.click('#pvAvisoGuardar')
  await page.waitForTimeout(700)
  await page.click('#pvAvisoCancelar')
  await page.waitForTimeout(900)
  const aviso2 = limpio(await page.locator('#mcQuieroRejilla .mc-deseo-baldosa').nth(1).locator('.mc-quiero-aviso').textContent())
  check('  …y al cerrarlo, la fila dice el aviso nuevo', aviso2 === '< 1.328,31 €', aviso2)

  const descarga = page.waitForEvent('download', { timeout: 8000 }).catch(() => null)
  await page.click('#mcQuieroCompartir')
  const dl = await descarga
  check('«Compartir» saca la lista en una imagen (Y3)', dl && /^pokedoc-la-quiero.*\.png$/.test(dl.suggestedFilename()), dl?.suggestedFilename())
  const t = await page.evaluate(async () => {
    const m = await import('/js/mi-coleccion/imagen-quiero.js')
    const carta = (n) => ({ id: `x-${n}`, name: `Carta ${n}`, local_id: String(n), set_id: 'x' })
    const muchas = m.textosDeLaQuiero({ cartas: [...Array(20)].map((_, i) => ({ carta: carta(i), prioridad: i === 0 ? 3 : 1 })), nombre: 'pingu' })
    return { n: muchas.cartas.length, mas: muchas.mas, sub: muchas.sub, falta: muchas.cartas[0].laQueFalta }
  })
  check('  …con quince como mucho, «y N más» y la que más buscas marcada', t.n === 15 && t.mas === 5 && t.sub === '@pingu · 20 cartas' && t.falta, JSON.stringify(t))
  await ctx.close()
}

console.log('── 3. Se llega desde el Panel y desde Cambios ──')
{
  const { page, ctx } = await abrir('/mi-coleccion.html', { deseos: [deseo('d1', 'sv3-2')] })
  const cifra = page.locator('.mc-panel-cifra[data-ir-a="quiero"]')
  check('el Panel cuenta lo que quieres (sin abrir Cambios antes)', /1\s*carta que quieres/.test(limpio(await cifra.textContent().catch(() => ''))), limpio(await cifra.textContent().catch(() => '')))
  await cifra.click()
  await page.waitForTimeout(900)
  check('  …y lleva a «La quiero»', new URL(page.url()).searchParams.get('ver') === 'quiero' && (await page.locator('#mcQuieroRejilla .mc-deseo-baldosa').count()) === 1)
  await page.goto(`${BASE}/mi-coleccion.html?ver=cambios`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  // Desde la 770, por el selector de las cuatro vistas.
  await page.click('#mcPanelCambios [data-deseos-vista="quiero"]')
  await page.waitForTimeout(900)
  check('en Cambios, «Lo que buscas» lleva a la lista', new URL(page.url()).searchParams.get('ver') === 'quiero')
  await ctx.close()
}

console.log('── 4. En /carta, el mismo corazón ──')
{
  const { page, ctx, errores } = await abrir('/carta.html?id=sv3-2', { deseos: [deseo('d1', 'sv3-2')] })
  const b = page.locator('#cmQuiero')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('si ya la quieres, sale pulsado', await b.isVisible() && (await b.getAttribute('aria-pressed')) === 'true', await b.getAttribute('aria-pressed'))
  await b.click()
  await page.waitForTimeout(900)
  check('  …y tocarlo la quita de la lista', (await b.getAttribute('aria-pressed')) === 'false' && (await filasDeLaBase(page)).length === 0, JSON.stringify(await filasDeLaBase(page)))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
