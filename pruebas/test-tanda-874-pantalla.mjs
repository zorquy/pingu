// Tanda 874 — «Pokémon + expansión» en los buscadores, y la paleta sin salto.
//
// PINGU: «pikachu ascended heroes o hypno rocket. deberían salir esos pokemon
// de esas expansiones, con búsqueda completa y relativa […] pikachu asc, que
// salga el pikachu de ascended heroes». Y de la paleta: «se abre el buscador
// blanco arriba y después sale el pop up. quiero que sea más rápido».
//
// Se mira en /buscar, en Mi colección › Buscar y en la paleta de Ctrl+K; y
// que la paleta espere a su hoja antes de abrirse (y que la hoja y el módulo
// se hayan pedido en reposo, antes de pulsar nada).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  const set = (id, name, name_en, code, total, serie) => ({ id, name, name_en, tcg_online_code: code, serie_id: serie, market: 'WEST', release_date: '2025-01-01', card_count_official: total, card_count_total: total })
  window.__FAKE_SETS__ = [
    set('base1', 'Set Básico', 'Base Set', 'BS', 102, 'base'),
    set('base5', 'Team Rocket', 'Team Rocket', 'TR', 82, 'base'),
    set('ex1', 'EX Rubí y Zafiro', 'EX Ruby & Sapphire', 'RS', 109, 'ex'),
    set('me2pt5', 'Héroes Ascendidos', 'Ascended Heroes', 'ASC', 217, 'me'),
    set('sv10', 'Rivales Predestinados', 'Destined Rivals', 'DRI', 182, 'sv'),
    set('sv3pt5', '151', '151', 'MEW', 165, 'sv'),
  ]
  const nombres = Object.fromEntries(window.__FAKE_SETS__.map((s) => [s.id, s.name]))
  const series = Object.fromEntries(window.__FAKE_SETS__.map((s) => [s.id, s.serie_id]))
  const c = (setId, n, nombre, dex) => ({
    id: `${setId}-${n}`, market: 'WEST', set_id: setId, local_id: String(n), name: nombre, name_es: nombre,
    image_path: `x/${setId}/${n}`, rarity: 'Rare', category: 'Pokemon', dex_ids: dex, illustrator: 'Alguien',
    tcg_sets: { id: setId, name: nombres[setId], serie_id: series[setId] },
  })
  window.__FAKE_CARTAS__ = [
    c('me2pt5', 277, 'Pikachu ex', [25]),
    c('me2pt5', 57, 'Pikachu', [25]),
    c('base1', 58, 'Pikachu', [25]),
    c('ex1', 72, 'Pikachu', [25]),
    c('sv3pt5', 25, 'Pikachu', [25]),
    c('base5', 24, 'Hypno', [97]),
    c('sv10', 109, "Team Rocket's Hypno", [97]),
    c('sv3pt5', 97, 'Hypno', [97]),
  ]
  window.__FAKE_COLECCION__ = []
  window.__FAKE_PRECIOS__ = []
  window.__FAKE_GUIAS__ = []
  window.__FAKE_TEMAS__ = []
  window.__FAKE_PERFILES__ = []
  // La paleta (apartado 4): en qué estado estaba su hoja en el instante en
  // que el diálogo se abrió. Se mira desde dentro porque es un instante.
  window.__PALETA_AL_ABRIR__ = null
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'attributes' && m.target.matches?.('dialog.paleta') && m.target.open && !window.__PALETA_AL_ABRIR__) {
        const hoja = document.querySelector('link[href="/css/buscador.css"]')
        window.__PALETA_AL_ABRIR__ = { hoja: !!hoja?.sheet, radio: getComputedStyle(m.target).borderRadius }
      }
    }
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ["open"] })
}
async function abrir(ruta, { movil = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  // La lista de sets de la CDN no existe aquí: cae a Supabase, como en la web sin CDN.
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, ctx, errores }
}
const cartasDe = (page) => page.$$eval('#searchResults .bs-grupo', (gs) => {
  const g = gs.find((x) => x.querySelector('.bs-seccion')?.textContent.trim() === 'Cartas')
  return g ? [...g.querySelectorAll('.bs-fila')].map((a) => a.getAttribute('href')) : []
})
const fin = (href) => (String(href).match(/(base1|base5|ex1|me2pt5|sv10|sv3pt5)-\d+$/) || [''])[0]

console.log('── 1. /buscar: «pikachu asc» y «pikachu ascended heroes» ──')
{
  const { page, ctx, errores } = await abrir('/buscar.html?q=pikachu%20asc&en=cartas')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const hs = (await cartasDe(page)).map(fin).sort()
  check('«pikachu asc»: los dos Pikachu de Héroes Ascendidos y ninguno más', hs.join() === 'me2pt5-277,me2pt5-57', hs.join())
  await page.fill('#searchInput', 'pikachu ascended heroes')
  await page.waitForTimeout(1200)
  const hs2 = (await cartasDe(page)).map(fin).sort()
  check('«pikachu ascended heroes»: los mismos', hs2.join() === 'me2pt5-277,me2pt5-57', hs2.join())
  await page.fill('#searchInput', 'pikachu héroes')
  await page.waitForTimeout(1200)
  const hs3 = (await cartasDe(page)).map(fin).sort()
  check('«pikachu héroes», en español: los mismos', hs3.join() === 'me2pt5-277,me2pt5-57', hs3.join())
  await ctx.close()
}

console.log('── 2. /buscar: «hypno rocket», lo de por nombre delante; «pikachu ex» sin los sets EX ──')
{
  const { page, ctx } = await abrir('/buscar.html?q=hypno%20rocket&en=cartas')
  // Desde la 909 /buscar ordena como Cartas (por expansión, de la más nueva
  // a la más vieja), no «lo de por nombre delante»: se miran cuáles salen.
  const hs = (await cartasDe(page)).map(fin).sort()
  check('el Hypno de Team Rocket’s (por nombre) y el Hypno de Team Rocket (por expansión), y no el de 151', hs.join() === 'base5-24,sv10-109', hs.join())
  await page.fill('#searchInput', 'pikachu ex')
  await page.waitForTimeout(1200)
  const hs2 = (await cartasDe(page)).map(fin)
  check('«pikachu ex»: el Pikachu ex y nada de EX Rubí y Zafiro', hs2.join() === 'me2pt5-277', hs2.join())
  await page.fill('#searchInput', 'pikachu')
  await page.waitForTimeout(1200)
  const hs3 = (await cartasDe(page)).map(fin)
  check('«pikachu» a secas sigue dando todos', hs3.length === 5, hs3.join())
  await ctx.close()
}

console.log('── 3. Mi colección › Buscar va por el mismo sitio ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=buscar&q=pikachu%20asc', { movil: false })
  await page.waitForTimeout(800)
  const res = await page.$$eval('#mcBuscarResultados .mc-resultado', (as) => as.map((a) => a.dataset.carta).sort().join())
  check('«pikachu asc»: los dos de Héroes Ascendidos', res === 'me2pt5-277,me2pt5-57', res)
  await page.fill('#mcBuscarTodo', 'hypno rocket')
  await page.waitForTimeout(1200)
  const res2 = await page.$$eval('#mcBuscarResultados .mc-resultado', (as) => as.map((a) => a.dataset.carta).sort().join())
  check('«hypno rocket»: los dos Hypno de Rocket', res2 === 'base5-24,sv10-109', res2)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. La paleta: precalentada en reposo y abierta ya con su hoja ──')
{
  const { page, ctx, errores } = await abrir('/index.html', { movil: false })
  await page.waitForTimeout(3500)
  const antes = await page.evaluate(() => ({
    hoja: !!document.querySelector('link[href="/css/buscador.css"]')?.sheet,
    modulo: performance.getEntriesByType('resource').some((r) => /\/js\/paleta\.js/.test(r.name)),
    abierta: !!document.querySelector('dialog.paleta')?.open,
  }))
  check('sin pulsar nada, la hoja ya está puesta y el módulo pedido (en reposo)', antes.hoja && antes.modulo && !antes.abierta, JSON.stringify(antes))
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(500)
  const al = await page.evaluate(() => window.__PALETA_AL_ABRIR__)
  check('en el instante de abrirse ya tenía su hoja (no sale la caja blanca del navegador)', al?.hoja === true && al.radio !== '0px', JSON.stringify(al))
  await page.keyboard.type('pikachu asc')
  await page.waitForTimeout(1200)
  const ops = await page.$$eval('#paletaLista [role="option"]', (os) => os.map((o) => o.getAttribute('href') || '').map((h) => (h.match(/(me2pt5|base1|ex1|sv3pt5)-\d+$/) || [''])[0]).filter(Boolean))
  check('«pikachu asc» en Ctrl+K ofrece los de Héroes Ascendidos y no los demás Pikachu', ops.length === 2 && ops.every((h) => /^me2pt5-/.test(h)), JSON.stringify(ops))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Y con el ahorro de datos, nada se precalienta; la paleta espera a su hoja igual ──')
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'connection', { value: { saveData: true } }) })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  const antes = await page.evaluate(() => ({ hoja: !!document.querySelector('link[href="/css/buscador.css"]'), modulo: performance.getEntriesByType('resource').some((r) => /\/js\/paleta\.js/.test(r.name)) }))
  check('con saveData no se pide nada en reposo', !antes.hoja && !antes.modulo, JSON.stringify(antes))
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(800)
  const al = await page.evaluate(() => window.__PALETA_AL_ABRIR__)
  check('…y al abrirla, la hoja llega antes que el diálogo', al?.hoja === true && al.radio !== '0px', JSON.stringify(al))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
