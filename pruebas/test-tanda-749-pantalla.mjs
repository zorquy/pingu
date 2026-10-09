// Tanda 749 — las expansiones con personalidad (E1, E2, E4, E5, Y1, Y2).
//
// PINGU: «se les ha quitado el logo y daban bastante personalidad». Lo que
// se mira: que cada fila lleve su logo donde iba el código y su fondo
// difuminado; que si la cadena de logos se agota la fila enseñe el código
// (y no una caja vacía); que dentro de una expansión con logo el nombre
// vaya PEQUEÑO a su lado («si tiene logo, no pongas el título, o muy
// pequeño») y sin logo, grande como siempre; «Casi completas» en el orden;
// y las cifras con su punto de los miles.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="96"><rect width="240" height="96" fill="#d4471c"/></svg>'

async function abrir(ruta, opciones = { ...devices['iPhone 13'] }) {
  const ctx = await browser.newContext({ ...opciones, locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [
      { id: 'sv3', name: 'Llamas Obsidianas', serie_id: 'sv', market: 'WEST', card_count_official: 4, card_count_total: 4, release_date: '2023-08-11', tcg_online_code: 'OBF', logo_path: 'sv/sv03/logo' },
      { id: 'sv2', name: 'Evoluciones en Paldea', serie_id: 'sv', market: 'WEST', card_count_official: 4, card_count_total: 4, release_date: '2023-06-09', tcg_online_code: 'PAL', logo_path: 'sv/sv02/logo' },
      { id: 'sv1', name: 'Escarlata y Púrpura', serie_id: 'sv', market: 'WEST', card_count_official: 6, card_count_total: 6, release_date: '2023-03-31', tcg_online_code: 'SVI' },
      { id: 'swsh12', name: 'Tempestad Plateada', serie_id: 'swsh', market: 'WEST', card_count_official: 4, card_count_total: 4, release_date: '2022-11-11', tcg_online_code: 'SIT', logo_path: 'swsh/swsh12/roto' },
    ]
    const c = (set, n, extra = {}) => ({ id: `${set}-${n}`, market: 'WEST', set_id: set, local_id: String(n), name: `Carta ${set} ${n}`, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true }, ...extra })
    window.__FAKE_CARTAS__ = [1, 2, 3, 4].flatMap((n) => [c('sv3', n), c('sv2', n), c('swsh12', n)]).concat([1, 2, 3, 4, 5, 6].map((n) => c('sv1', n)))
    // sv3: 3 de 4 (falta 1). sv1: 3 de 6 (faltan 3). sv2: 4 de 4 (completa). swsh12: ninguna.
    const tengo = ['sv3-1', 'sv3-2', 'sv3-3', 'sv1-1', 'sv1-2', 'sv1-3', 'sv2-1', 'sv2-2', 'sv2-3', 'sv2-4']
    window.__FAKE_COLECCION__ = tengo.map((id, i) => ({ id: `l${i}`, user_id: 'admin-1', card_id: id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
    window.__FAKE_PRECIOS__ = [{ card_id: 'sv3-1', market: 'WEST', cm_low: 1475.9 }]
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => {
    const u = r.request().url()
    if (/\/roto/.test(u)) return r.fulfill({ status: 404, body: '' })
    // El set sin logo tampoco lo tiene en la ruta montada a mano: desde la 796
    // la fila prueba la cadena entera de la tarjeta (dibujosDeSet).
    if (/\/sv\/sv1\/logo/.test(u)) return r.fulfill({ status: 404, body: '' })
    if (/\/logo/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: LOGO })
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"></svg>' })
  })
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}
const filas = (page) => page.$$eval('#mcEstanteriaRejilla .mc-set-fila', (fs) => fs.map((f) => ({
  set: f.dataset.set,
  logo: !!f.querySelector('.mc-set-marca img') && f.querySelector('.mc-set-marca img').naturalWidth > 0,
  sinLogo: f.querySelector('.mc-set-marca')?.classList.contains('sin-logo') || false,
  codigo: f.querySelector('.mc-set-marca')?.dataset.codigo || f.querySelector('.mc-set-codigo')?.textContent || null,
  marcaVisible: (() => { const m = f.querySelector('.mc-set-marca, .mc-set-codigo'); return !!m && m.getBoundingClientRect().width > 20 })(),
  fondo: !!f.querySelector('.mc-set-fondo img'),
  // Lo que SE VE: sin logo, el código de la línea se esconde por CSS (796).
  corta: f.querySelector('.mc-set-corta')?.innerText.replace(/\s+/g, ' ').trim(),
  barra: f.querySelector('.mc-set-barra i')?.style.getPropertyValue('--ancho') || null,
  alto: Math.round(f.getBoundingClientRect().height),
})))

console.log('── 1. Cada fila con su logo y su color detrás (E1 y E2) ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album')
  const fs = await filas(page)
  const obf = fs.find((f) => f.set === 'sv3')
  const svi = fs.find((f) => f.set === 'sv1')
  const sit = fs.find((f) => f.set === 'swsh12')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('con logo: el logo donde iba el código, su fondo difuminado y «OBF · 2023 · 3/4»', obf?.logo && obf.fondo && obf.corta === 'OBF · 2023 · 3/4' && obf.barra === '75%', JSON.stringify(obf))
  check('  …y sigue siendo baja (≤ 90 px)', fs.every((f) => f.alto <= 90), JSON.stringify(fs.map((f) => f.alto)))
  check('sin logo: el código de siempre y sin repetirlo en la línea', svi && !svi.logo && svi.codigo === 'SVI' && svi.corta === '2023 · 3/6', JSON.stringify(svi))
  check('un logo que no carga deja el código a la vista, no una caja vacía', sit?.sinLogo && sit.codigo === 'SIT' && sit.marcaVisible, JSON.stringify(sit))

  console.log('── 2. «Casi completas» (Y2) ──')
  await page.click('#mcEstanteriaOrdenAbrir')
  await page.waitForTimeout(300)
  await page.click('[data-orden-sets="casi"]')
  await page.waitForTimeout(500)
  const orden = (await filas(page)).map((f) => f.set)
  check('primero la que menos le falta, luego las demás empezadas, luego la completa y al final la que no tienes', JSON.stringify(orden) === JSON.stringify(['sv3', 'sv1', 'sv2', 'swsh12']), JSON.stringify(orden))
  await page.evaluate(() => { try { localStorage.removeItem('mc-estanteria-orden') } catch {} })
  await ctx.close()
}

console.log('── 3. Dentro de una expansión, el logo arriba y el nombre pequeño (E5) ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album&set=sv3')
  const m = await page.evaluate(() => {
    const t = document.getElementById('mcAlbumTitulo')
    return {
      conLogo: t.closest('.mc-album-barra').classList.contains('con-logo'),
      logo: (document.querySelector('#mcAlbumLogo img')?.getBoundingClientRect().height || 0) > 30,
      tam: parseFloat(getComputedStyle(t).fontSize),
      titulo: t.textContent,
      meta: document.getElementById('mcAlbumMeta')?.offsetHeight > 0 ? document.getElementById('mcAlbumMeta').textContent : null,
      alto: Math.round(t.closest('.mc-album-barra').getBoundingClientRect().height),
      ancho: document.documentElement.scrollWidth, ventana: innerWidth,
    }
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('con logo: el logo y, a su lado, el nombre pequeño (≤ 16 px) con código y fecha', m.conLogo && m.logo && m.tam <= 16 && m.titulo === 'Llamas Obsidianas' && /^OBF · agosto de 2023 · 4 cartas$/.test(m.meta || ''), JSON.stringify(m))
  check('  …y la cabecera no crece (≤ 80 px) ni ensancha la página', m.alto <= 80 && m.ancho <= m.ventana, JSON.stringify(m))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/mi-coleccion.html?ver=album&set=sv1')
  const m = await page.evaluate(() => {
    const t = document.getElementById('mcAlbumTitulo')
    return { conLogo: t.closest('.mc-album-barra').classList.contains('con-logo'), tam: parseFloat(getComputedStyle(t).fontSize), meta: document.getElementById('mcAlbumMeta')?.offsetHeight > 0 }
  })
  check('sin logo: el título grande de siempre y sin la línea de debajo', !m.conLogo && m.tam >= 16 && !m.meta, JSON.stringify(m))
  await ctx.close()
}

console.log('── 4. El ordenador: baldosas con el logo grande (E4) y cifras con miles (Y1) ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album', { viewport: { width: 1280, height: 900 } })
  const m = await page.evaluate(() => {
    const f = document.querySelector('#mcEstanteriaRejilla .mc-set-fila[data-set="sv3"]')
    const g = document.querySelector('#mcEstanteriaRejilla .mc-set-fila[data-set="sv2"]')
    return { logoAlto: Math.round(f.querySelector('.mc-set-marca').getBoundingClientRect().height), enFila: Math.abs(f.getBoundingClientRect().top - g.getBoundingClientRect().top) < 2 }
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('baldosas una al lado de otra, con el logo grande arriba (≥ 60 px)', m.enFila && m.logoAlto >= 60, JSON.stringify(m))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/mi-coleccion.html?ver=album&set=sv3', { viewport: { width: 1440, height: 900 } })
  const linea = await page.evaluate(() => document.getElementById('mcAlbumLinea')?.textContent || '')
  check('«1.475,90 € las tuyas», con su punto de los miles', /1\.475,90\s€ las tuyas/.test(linea), linea)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
