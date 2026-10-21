// Tanda 930: el dibujo de cada versión de una carta.
//
// PINGU, con Dex delante: «al menos hazme iconos para las variantes más
// míticas, como la normal, holo, reverse… y para las reverse de Poké Ball,
// Quick Ball…». Las de siempre van dibujadas (js/mi-coleccion/iconos-version.js)
// y las Ball son los sprites de PokeAPI copiados a assets/versiones/.
//
// Y de paso, la respuesta REAL de TCGGO que pegó PINGU (el Lunatone de
// Ascended Heroes, /cards/31556?include_variants=1) como fixture de la 929:
// la de la documentación era un ejemplo; esta es la que contesta la API.
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const iv = await import(`${RAIZ}/js/mi-coleccion/iconos-version.js`)
const { varianteDeEtiqueta } = await import(`${RAIZ}/js/mi-coleccion/variantes.js`)
const lib = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
const LUNATONE = JSON.parse(readFileSync(join(AQUI, 'fixtures-930', 'carta-real-lunatone.json'), 'utf8')).data

console.log('── 1. Qué dibujo lleva cada versión ──')
{
  const de = (etiqueta) => { const d = iv.dibujoDeVersion(varianteDeEtiqueta(etiqueta)); return d.tipo === 'bola' ? d.clave : d.clave }
  const casos = {
    'Standard': 'normal', 'Normal': 'normal', 'Reverse Holo': 'reverse', 'Holo': 'holo', '1st Edition': 'primera',
    'Poké Ball': 'poke-ball', 'Master Ball': 'master-ball', 'Quick Ball': 'quick-ball', 'Dusk Ball': 'dusk-ball', 'Friend Ball': 'friend-ball', 'Love Ball': 'love-ball',
    'Energy Symbol Pattern': 'energia', 'Cosmos Holo': 'cosmos', 'Reverse Holo (Cosmos)': 'cosmos', 'Team Rocket': 'otra',
  }
  const mal = Object.entries(casos).filter(([e, k]) => de(e) !== k).map(([e, k]) => `${e} → ${de(e)} (y no ${k})`)
  check('cada etiqueta de TCGGO cae en su dibujo (y lo que no tiene, en el genérico)', mal.length === 0, mal.join(' | '))
  check('una Ball dentro de un nombre más largo también es su Ball', iv.dibujoDeVersion('reverse-holo-poke-ball').clave === 'poke-ball' && iv.dibujoDeVersion('master-ball-pattern').clave === 'master-ball')
  const svg = (k) => iv.iconoDeVersion(k).replace(/data-dibujo="[^"]*"/, '')
  check('la normal, la holo y la reverse son tres dibujos distintos', new Set([svg('normal'), svg('holo'), svg('reverse')]).size === 3)
  check('cada Ball de la lista tiene su sprite en assets/versiones', iv.BOLAS.every((b) => existsSync(`${RAIZ}/assets/versiones/${b}.png`)), iv.BOLAS.filter((b) => !existsSync(`${RAIZ}/assets/versiones/${b}.png`)).join(', '))
  const bola = iv.iconoDeVersion('poke-ball', 16)
  check('el sprite va a SU tamaño también en style (si no, la foto de carta lo estira)', /style="width:20px;height:20px"/.test(bola) && /loading="lazy"/.test(bola) && /alt=""/.test(bola), bola)
  check('el icono no dice nada en voz alta: el nombre va al lado', /aria-hidden="true"/.test(bola) && /aria-hidden="true"/.test(iv.iconoDeVersion('holo')))
  check('no van en js/icons.js (lo baja la portada)', !/icono-version|poke-ball/.test(readFileSync(`${RAIZ}/js/icons.js`, 'utf8')))
}

console.log('── 2. La respuesta real de TCGGO (el Lunatone de Ascended Heroes) ──')
{
  const filas = lib.filasDeVariantes(LUNATONE, { id: 'me2pt5-105', set_id: 'me2pt5' }, { ahora: new Date('2026-10-21T12:00:00Z') })
  check('dos versiones, colgando de NUESTRA carta, con su precio general', filas.length === 2 && filas.every((f) => f.card_id === 'me2pt5-105' && f.set_id === 'me2pt5') && filas[0].tcggo_id === 50858 && filas[0].etiqueta === 'Dusk Ball' && filas[0].cm_low === 0.03 && filas[1].etiqueta === 'Energy Symbol Pattern' && filas[1].cm_low === 0.1, JSON.stringify(filas))
  check('  …y sin «Reverse Holo» a secas: en este set las reverse SON los patrones', !filas.some((f) => /reverse/i.test(f.etiqueta)))
  check('  …cada una con su dibujo', filas.map((f) => iv.dibujoDeVersion(varianteDeEtiqueta(f.etiqueta)).clave).join() === 'dusk-ball,energia')
}

console.log('── 3. En la web ──')
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 4, card_count_total: 4 }]
const CARTAS = [1, 2, 3, 4].map((n) => ({ id: `sv8-${n}`, market: 'WEST', set_id: 'sv8', local_id: String(n), name: `Carta ${n}`, name_es: `Carta ${n}`, image_path: `sv/sv8/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true, reverse: true }, tcg_sets: { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv' } }))
const PRECIOS = CARTAS.map((c) => ({ card_id: c.id, cm_low: 1, cm_low_es: 1, checked_at: '2026-10-21T10:00:00Z' }))
const VERSIONES = [
  { tcggo_id: 902, market: 'WEST', card_id: 'sv8-2', set_id: 'sv8', etiqueta: 'Poké Ball', cm_low: 2.9 },
  { tcggo_id: 952, market: 'WEST', card_id: 'sv8-2', set_id: 'sv8', etiqueta: 'Energy Symbol Pattern', cm_low: 1.4 },
]
const COLECCION = [
  { id: 'a', user_id: 'user-1', card_id: 'sv8-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 },
  { id: 'b', user_id: 'user-1', card_id: 'sv8-2', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 },
  { id: 'c', user_id: 'user-1', card_id: 'sv8-2', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'reverse', cantidad: 1 },
  { id: 'd', user_id: 'user-1', card_id: 'sv8-2', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'poke-ball', cantidad: 1 },
]
const browser = await chromium.launch()
for (const movil of [true, false]) {
  console.log(`  · ${movil ? 'móvil' : 'PC'}`)
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1366, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_PRECIOS__: d.PRECIOS, __FAKE_COLECCION__: d.COLECCION, __FAKE_VERSIONES__: d.VERSIONES })
  }, { SETS, CARTAS, PRECIOS, COLECCION, VERSIONES })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=sv8`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('#mcAlbum [data-carta]').length > 0, null, { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1200)
  const apil = await page.evaluate(() => {
    const c = document.querySelector('#mcAlbum .mc-bolsillo-enlace[data-carta="sv8-2"]')
    const ins = [...(c?.querySelectorAll('.mc-insignia:not(.mc-insignia-n)') || [])]
    return {
      dibujos: ins.map((i) => i.querySelector('[data-dibujo]')?.dataset.dibujo || i.querySelector('img.icono-bola')?.getAttribute('src')).join(),
      letras: ins.map((i) => i.textContent.trim()).join(''),
      bola: (() => { const b = c?.querySelector('.mc-insignia img.icono-bola')?.getBoundingClientRect(); const i = c?.querySelector('.mc-insignia img.icono-bola')?.closest('.mc-insignia').getBoundingClientRect(); return b && i ? { w: b.width, h: b.height, dentro: b.width <= i.width + 0.5 && b.height <= i.height + 0.5 } : null })(),
    }
  })
  check('apiladas: la carta 2 lleva el dibujo de la reverse y el sprite de la Poké Ball, sin letras', apil.dibujos === 'reverse,/assets/versiones/poke-ball.png' && apil.letras === '', JSON.stringify(apil))
  check('  …y el sprite cabe en su insignia (la foto de carta no lo estira)', apil.bola && apil.bola.w <= 20 && apil.bola.dentro, JSON.stringify(apil.bola))
  // Separadas: la chapa lleva el dibujo en su redondel.
  await page.click('#mcVistaVariantes')
  await page.waitForTimeout(500)
  const sep = await page.evaluate(() => [...document.querySelectorAll('#mcAlbum .mc-bolsillo-enlace[data-carta="sv8-2"]')].map((a) => {
    const b = a.querySelector('.mc-chapa-variante b')
    return `${a.dataset.variante}:${b?.querySelector('[data-dibujo]')?.dataset.dibujo || b?.querySelector('img')?.getAttribute('src')?.match(/([\w-]+)\.png/)?.[1] || b?.textContent}`
  }).join(' '))
  check('separadas: cada chapa con su dibujo', sep === 'normal:normal reverse:reverse poke-ball:poke-ball energy-symbol-pattern:energia', sep)
  await page.click('#mcVistaVariantes')
  await page.waitForTimeout(400)
  // La ficha: la lista de versiones con su dibujo.
  await page.click('#mcAlbum .mc-bolsillo-enlace[data-carta="sv8-2"]', { position: { x: 20, y: 60 } })
  await page.waitForTimeout(1200)
  if (movil) { await page.click('#mcEdVersion').catch(() => {}); await page.waitForTimeout(500) }
  const ficha = await page.evaluate(() => ({
    lista: [...document.querySelectorAll('#mcEditor .mc-version')].map((v) => `${v.dataset.version}:${v.querySelector('.mc-version-icono [data-dibujo]')?.dataset.dibujo || v.querySelector('.mc-version-icono img')?.getAttribute('src')?.match(/([\w-]+)\.png/)?.[1] || '-'}`).join(' '),
    fila: document.querySelector('#mcEdVersion .mc-fila-ico [data-dibujo]')?.dataset.dibujo || null,
  }))
  check('la ficha: cada versión de la lista con su dibujo', ficha.lista === 'normal:normal reverse:reverse poke-ball:poke-ball energy-symbol-pattern:energia', ficha.lista)
  if (movil) check('  …y la fila «Versión» lleva el de la que miras', ficha.fila === 'normal', JSON.stringify(ficha))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  // «¿Cuál tienes?» al añadir la 2 (tiene cuatro versiones).
  await page.evaluate(() => document.querySelector('#mcAlbum .mc-bolsillo-enlace[data-carta="sv8-3"]')?.closest('.mc-bolsillo')?.querySelector('.mc-mas')?.click())
  await page.waitForTimeout(800)
  const cual = await page.evaluate(() => ({
    abierta: Boolean(document.getElementById('mcAnadirDialogo')?.open),
    opciones: [...document.querySelectorAll('#mcAdElegir .vp-opcion')].map((o) => o.querySelector('.vp-opcion-icono [data-dibujo]')?.dataset.dibujo || '-').join(),
    fija: document.querySelector('#mcAdVersionFija .vp-fija-icono [data-dibujo]')?.dataset.dibujo || null,
  }))
  check('«¿Cuál tienes?»: cada opción con su dibujo', cual.abierta && cual.opciones === 'normal,reverse', JSON.stringify(cual))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await browser.close()

console.log(fails ? `\n✗ ${fails} fallos` : '\n✓ Todo bien')
process.exit(fails ? 1 : 0)
