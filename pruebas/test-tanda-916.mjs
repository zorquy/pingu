// Tanda 916 — /carta con la misma columna que el pop-up (915).
//
// PINGU aprobó la ficha como el Dex del móvil para el pop-up de Mi colección
// y Cartas; /carta, que es la misma carta con su dirección propia, seguía con
// las losetas, los chips de idioma y la tabla de Cardmarket. Ahora:
//   1. Lo estático: el precio sale de `tarjetasDePrecio`, sin chips de idioma
//      ni desplegable de estado, y la loseta de «La quiero» ya no existe.
//   2. PC con dos copias: impresiones + una tarjeta por idioma del set (la de
//      tu copia primero, «tu copia»; el que nadie vende, en gris) y TCGplayer
//      la última; «− Tienes 2 +», corazón y compartir en redondo; «Avísame si
//      baja» con el precio; la ficha en filas, a dos columnas.
//   3. El «+» suma una igual y lo dice con Deshacer; Deshacer la quita; el
//      «−» resta y la última pregunta antes de quitarla (y entonces el «+» es
//      el botón grande).
//   4. Sin copias, el «+» abre la hoja de añadir; «Añadir otra copia» también.
//   5. El móvil: la barra de abajo con «− Tienes 2 +» y el corazón, sin
//      compartir (va arriba, flotando) ni la chapa «Tienes 2» del 748, y
//      «Añadir otra copia» corto bajo la carta; la
//      línea de precio bajo el nombre sale de la tarjeta de tu idioma.
//   6. Sin cuenta: «Añadir a mi colección» y «Avísame si baja» llevan a entrar.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const limpio = (t) => String(t || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim()

console.log('── 1. Lo estático ──')
{
  const js = readFileSync(join(RAIZ, 'js/carta-mercado.js'), 'utf8')
  check('/carta pinta el precio con las tarjetas por idioma, no con el bloque viejo', /tarjetasDePrecio\(/.test(js) && !/bloqueDePrecio/.test(js))
  check('  …sin chips de idioma ni desplegable de estado', !/id="cmIdiomas"/.test(js) && !/id="cmEstado"/.test(js))
  check('  …y con los idiomas de SU set (911)', /idiomasDeSet\(carta\.set_id/.test(js))
  const quiero = readFileSync(join(RAIZ, 'js/la-quiero.js'), 'utf8')
  check('la loseta de «La quiero» ya no existe (nadie la pinta)', !/losetaHtml/.test(quiero))
  const movil = readFileSync(join(RAIZ, 'js/carta-movil.js'), 'utf8')
  check('la línea de precio del móvil lee la tarjeta de tu idioma', /pv-tarjeta-tuya \.pv-cifra/.test(movil) && !/pv-burbuja-principal/.test(movil))
}

const browser = await chromium.launch()
const semilla = ({ copias, sesion }) => {
  window.__FAKE_SESSION__ = sesion ? 'user-1' : 'none'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  window.__FAKE_SETS__ = [{ id: 'me2pt5', name: 'Ascended Heroes', serie_id: 'me', market: 'WEST', release_date: '2026-01-30', card_count_official: 217, card_count_total: 295 }]
  window.__FAKE_CARTAS__ = [{ id: 'me2pt5-159', market: 'WEST', set_id: 'me2pt5', local_id: '159', name: 'Drakloak', name_es: 'Drakloak', image_path: 'me/me2pt5/159', rarity: 'Uncommon', category: 'Pokemon', stage: 'Stage1', hp: 90, types: ['Dragon'], illustrator: 'Mitsuhiro Arita', dex_ids: [886], variants: { normal: true, reverse: true }, tcg_sets: { id: 'me2pt5', name: 'Ascended Heroes', serie_id: 'me' } }]
  window.__FAKE_PRECIOS__ = [{ card_id: 'me2pt5-159', cm_id_product: 869770, cm_low: 0.05, cm_low_es: 0.12, cm_low_en: 0.05, cm_low_de: 0.09, cm_low_fr: 0.1, tp_market_eur: 0.08, checked_at: new Date().toISOString() }]
  window.__FAKE_IDIOMAS_SET__ = { me2pt5: ['de', 'en', 'es', 'fr', 'it'] }
  window.__FAKE_COLECCION__ = copias ? [{ id: 'l1', user_id: 'user-1', card_id: 'me2pt5-159', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: copias }] : []
}
async function abrir({ movil = false, copias = 2, sesion = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1440, height: 1000 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla, { copias, sesion })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/carta.html?id=me2pt5-159`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelector('#cmPrecios .pv-tarjeta') && document.getElementById('cartaAcciones'), null, { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1200)
  return { page, ctx, errores }
}

console.log('── 2. En el PC, con dos copias ──')
{
  const { page, ctx, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await page.evaluate(() => {
    const t = [...document.querySelectorAll('#cmPrecios .pv-tarjeta')]
    return {
      tarjetas: t.map((x) => (x.classList.contains('pv-tarjeta-tcg') ? 'TCG' : x.querySelector('.pv-t-cab b')?.textContent) + (x.classList.contains('pv-tarjeta-sin') ? '-sin' : '')),
      tuya: document.querySelector('#cmPrecios .pv-tarjeta-tuya')?.textContent || '',
      impresiones: [...document.querySelectorAll('#cmPrecios .pv-impresion')].map((b) => b.dataset.variante),
      tabla: document.querySelectorAll('#cmPrecios .pv-tabla, #cmPrecios .pv-fila').length,
      chips: document.querySelectorAll('#cmIdiomas, #cmEstado').length,
      tienes: document.getElementById('cmTienes')?.textContent,
      sinCopias: document.getElementById('cartaAcciones').classList.contains('mc-sin-copias'),
      menos: !!document.getElementById('cmMenos')?.getBoundingClientRect().height,
      redondos: [...document.querySelectorAll('#cartaAcciones .mc-ficha-redondo')].filter((x) => x.getBoundingClientRect().height >= 44).map((x) => x.id),
      aviso: !!document.querySelector('#cartaMercado #cmAviso[data-aviso="me2pt5-159"]'),
      avisoEnAcciones: !!document.querySelector('#cartaAcciones [data-aviso]'),
      enFigura: !!document.querySelector('#cartaNucleo .carta-scan #cartaAcciones'),
    }
  })
  check('una tarjeta por idioma del set: la tuya (ES) primero, el italiano en gris y TCGplayer la última', r.tarjetas.join() === 'ES,EN,DE,FR,IT-sin,TCG', r.tarjetas.join())
  check('  …la tuya dice «tu copia» y su cifra', /tu copia/.test(r.tuya) && /0,12/.test(limpio(r.tuya)), limpio(r.tuya))
  check('  …con las impresiones encima (se eligen ahí)', r.impresiones.join() === 'normal,reverse', r.impresiones.join())
  check('  …y sin la tabla de Cardmarket ni los chips de idioma y estado', r.tabla === 0 && r.chips === 0)
  check('«− Tienes 2 +» bajo la carta', r.enFigura && r.tienes === 'Tienes 2' && !r.sinCopias && r.menos, JSON.stringify(r))
  check('  …con el corazón y compartir en redondo (44 px)', r.redondos.join() === 'cmQuiero,cmCompartir', r.redondos.join())
  check('«Avísame si baja» va con el precio, no con las acciones', r.aviso && !r.avisoEnAcciones)
  const ficha = await page.evaluate(() => {
    const filas = [...document.querySelectorAll('.carta-ficha > div')]
    const dt = document.querySelector('.carta-ficha dt')
    const cs = getComputedStyle(document.querySelector('.carta-ficha'))
    return { n: filas.length, flex: filas.every((f) => getComputedStyle(f).display === 'flex'), mayus: getComputedStyle(dt).textTransform, columnas: cs.gridTemplateColumns.split(' ').length, dd: getComputedStyle(document.querySelector('.carta-ficha dd')).textAlign }
  })
  check('la ficha en filas (rótulo y dato a los lados), sin mayúsculas, a dos columnas en el PC', ficha.n >= 4 && ficha.flex && ficha.mayus === 'none' && ficha.columnas === 2 && ficha.dd === 'right', JSON.stringify(ficha))

  console.log('── 3. «+», Deshacer y «−» ──')
  await page.click('#cmAnadir')
  // «Tienes 3» sale ya (896); el aviso, cuando la base ha dicho que sí.
  await page.waitForSelector('.mc-deshacer', { timeout: 4000 }).catch(() => {})
  const tras = await page.evaluate(() => ({ tienes: document.getElementById('cmTienes').textContent, aviso: document.querySelector('.mc-deshacer')?.textContent || '', dialogo: !!document.querySelector('dialog[open]') }))
  check('el «+» suma una igual (Tienes 3), sin abrir la hoja, y lo dice con Deshacer', tras.tienes === 'Tienes 3' && /una más · ya tienes 3/.test(tras.aviso) && !tras.dialogo, JSON.stringify(tras))
  await page.click('.mc-deshacer-boton')
  await page.waitForFunction(() => document.getElementById('cmTienes')?.textContent === 'Tienes 2', null, { timeout: 4000 }).catch(() => {})
  check('  …y Deshacer la quita (Tienes 2)', (await page.textContent('#cmTienes')) === 'Tienes 2')
  await page.click('#cmMenos')
  await page.waitForFunction(() => document.getElementById('cmTienes')?.textContent === 'Tienes 1', null, { timeout: 4000 }).catch(() => {})
  check('el «−» resta una (Tienes 1)', (await page.textContent('#cmTienes')) === 'Tienes 1')
  let pregunta = ''
  page.once('dialog', (d) => { pregunta = d.message(); d.accept() })
  await page.click('#cmMenos')
  await page.waitForFunction(() => document.getElementById('cartaAcciones')?.classList.contains('mc-sin-copias'), null, { timeout: 4000 }).catch(() => {})
  const fin = await page.evaluate(() => ({ sin: document.getElementById('cartaAcciones').classList.contains('mc-sin-copias'), texto: document.querySelector('#cmAnadir .mc-mas-texto') && getComputedStyle(document.querySelector('#cmAnadir .mc-mas-texto')).display, menos: document.getElementById('cmMenos').getBoundingClientRect().height }))
  check('  …la última pregunta antes de quitarla, y el «+» vuelve a ser «Añadir a mi colección»', /Quitar esta carta/.test(pregunta) && fin.sin && fin.texto !== 'none' && fin.menos === 0, JSON.stringify({ pregunta, ...fin }))
  await ctx.close()
}

console.log('── 4. Sin copias ──')
{
  const { page, ctx, errores } = await abrir({ copias: 0 })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await page.evaluate(() => ({ sin: document.getElementById('cartaAcciones').classList.contains('mc-sin-copias'), otra: document.getElementById('cmAnadirOtra').getBoundingClientRect().height, tuya: document.querySelector('#cmPrecios .pv-tarjeta-tuya')?.textContent || '' }))
  check('el «+» es el botón grande y no hay «Añadir otra copia»; la primera tarjeta es «tu idioma»', r.sin && r.otra === 0 && /tu idioma/.test(r.tuya), JSON.stringify(r))
  await page.click('#cmAnadir')
  await page.waitForTimeout(600)
  // Desde la 922, con dos versiones abre preguntando «¿Cuál tienes?».
  check('  …y abre la hoja de añadir', (await page.isVisible('#cmAdIdiomas')) || (await page.isVisible('#cmAdElegir')))
  await ctx.close()
}

console.log('── 5. En el móvil ──')
{
  const { page, ctx, errores } = await abrir({ movil: true })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await page.evaluate(() => {
    const barra = document.getElementById('cartaAcciones')
    const vis = (id) => { const e = document.getElementById(id); return !!e && e.getBoundingClientRect().height > 0 }
    return {
      pos: getComputedStyle(barra).position,
      bottom: Math.round(barra.getBoundingClientRect().bottom), vh: innerHeight,
      menos: vis('cmMenos'), mas: vis('cmAnadir'), tienes: document.getElementById('cmTienes').textContent,
      quiero: vis('cmQuiero'), compartir: vis('cmCompartir'), otra: vis('cmAnadirOtra'), otraTexto: document.getElementById('cmAnadirOtra').innerText.replace(/^\+\s*/, '').trim(),
      chapa: document.querySelectorAll('.carta-tienes').length,
      precio: (document.querySelector('.carta-precio-corto b')?.textContent || '').replace(/\s/g, ' '),
      flotante: !!document.querySelector('.carta-flotantes [data-flota="compartir"]'),
    }
  })
  check('abajo, fija: «− Tienes 2 +» y el corazón', r.pos === 'fixed' && r.bottom <= r.vh && r.bottom >= r.vh - 64 && r.menos && r.mas && r.tienes === 'Tienes 2' && r.quiero, JSON.stringify(r))
  check('  …sin compartir (flota arriba); «Añadir otra copia», corto, bajo la carta', !r.compartir && r.flotante && r.otra && r.otraTexto === 'Añadir otra copia', JSON.stringify(r))
  check('sin la chapa «Tienes 2» del 748 (lo dice la barra)', r.chapa === 0)
  check('la línea de precio bajo el nombre sale de la tarjeta de tu idioma (0,12 €)', r.precio === '0,12 €', r.precio)
  await ctx.close()
}

console.log('── 6. Sin cuenta ──')
{
  const { page, ctx, errores } = await abrir({ sesion: false })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await page.evaluate(() => ({
    anadir: document.querySelector('#cartaAcciones a.mc-ficha-mas')?.getAttribute('href') || '',
    aviso: document.querySelector('#cmAvisoSitio a')?.getAttribute('href') || '',
    quiero: !!document.getElementById('cmQuiero'),
    compartir: !!document.getElementById('cmCompartir'),
  }))
  check('«Añadir a mi colección» y «Avísame si baja» llevan a entrar, y compartir se queda', /^\/auth\.html\?volver=/.test(r.anadir) && /^\/auth\.html\?volver=/.test(r.aviso) && !r.quiero && r.compartir, JSON.stringify(r))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
