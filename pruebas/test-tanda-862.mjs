// Tanda 862 — las versiones de TCGGO en la colección.
//
// PINGU, con Dex delante y el Drakloak de Ascended Heroes: «Normal, Reverse
// Holo y Quick Ball Holo, cada una su casilla; tener cualquiera cuenta como
// tener la carta, y la copia dice cuál es». Las versiones las trae TCGGO
// (`tcg_card_versions`, 861) y aquí pasan a ser una impresión más: en
// «separar variantes» una casilla por versión, en el diálogo de añadir su
// opción, con su precio, y en /carta una chapa más.
//   1. Lo puro: de etiqueta a id, las versiones pegadas a la carta, nombres.
//   2. El precio de una copia que es una versión (datos.js).
//   3. La migración, contra PostgreSQL: cabe `quick-ball`, no «Quick Ball».
//   4. La expansión con variantes separadas, el «+» de la Quick Ball y el
//      diálogo; la copia guardada en la lista de Cartas.
//   5. /carta con la Quick Ball como impresión que se elige, con su precio.
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const v = await import(`${RAIZ}/js/mi-coleccion/variantes.js`)
const VERSIONES = [
  { tcggo_id: 50937, card_id: 'me2pt5-159', set_id: 'me2pt5', market: 'WEST', etiqueta: 'Energy Symbol Pattern', link_cm: 'https://www.tcggo.com/external/cm/50937', cm_id_product: 870385, cm_low: 0.04, cm_low_es: 0.02, cm_low_en: 0.04 },
  { tcggo_id: 50939, card_id: 'me2pt5-159', set_id: 'me2pt5', market: 'WEST', etiqueta: 'Quick Ball', link_cm: 'https://www.tcggo.com/external/cm/50939', cm_id_product: 870386, cm_low: 0.07, cm_low_es: 0.02, cm_low_en: 0.07 },
  // La Reverse de un set viejo: sin etiqueta y con el producto de la normal.
  { tcggo_id: 40760, card_id: 'sm8-2', set_id: 'sm8', market: 'WEST', etiqueta: null, link_cm: 'https://www.tcggo.com/external/cm/40760', cm_id_product: 365605, cm_low: 0.85, cm_low_es: 0.25 },
]

console.log('── 1. Lo puro ──')
{
  check('de etiqueta a id: «Quick Ball» → quick-ball, «Poké Ball» → poke-ball, sin etiqueta → reverse, «Reverse Holo» → reverse, «Holo» → holo', v.varianteDeEtiqueta('Quick Ball') === 'quick-ball' && v.varianteDeEtiqueta('Poké Ball') === 'poke-ball' && v.varianteDeEtiqueta(null) === 'reverse' && v.varianteDeEtiqueta('Reverse Holo') === 'reverse' && v.varianteDeEtiqueta('Holo') === 'holo' && v.varianteDeEtiqueta('Standard') === 'normal')
  const drakloak = { id: 'me2pt5-159', variants: { normal: true, reverse: true, holo: false } }
  const tangrowth = { id: 'sm8-2', variants: null }
  const por = v.pegarVersiones([drakloak, tangrowth], VERSIONES)
  check('las filas se pegan a su carta', por.get('me2pt5-159').length === 2 && drakloak.versiones.length === 2 && tangrowth.versiones.length === 1)
  const ids = v.variantesDeCarta(drakloak).map((x) => x.nuestro)
  check('el Drakloak: normal, reverse (TCGdex) + Energy Symbol Pattern y Quick Ball (TCGGO), en ese orden', ids.join() === 'normal,reverse,energy-symbol-pattern,quick-ball', ids.join())
  check('  …con su nombre exacto y su código corto', v.nombreDeVariante('energy-symbol-pattern') === 'Energy Symbol Pattern' && v.cortoDeVariante('energy-symbol-pattern') === 'ESP' && v.cortoDeVariante('quick-ball') === 'QB' && v.cortoDeVariante('reverse') === 'RH')
  check('el Tangrowth sin impresiones de TCGdex: la normal (existe seguro) y la reverse de TCGGO', v.variantesDeCarta(tangrowth).map((x) => x.nuestro).join() === 'normal,reverse')
  check('  …y «no se sabe» sigue siendo lo que se pida cuando no hay nada', v.variantesDeCarta({ id: 'x', variants: null }, null) === null && v.variantesDeCarta({ id: 'x' }).length === 1)
  check('una versión repetida (reverse de TCGdex y de TCGGO) sale una vez', v.variantesDeCarta({ variants: { normal: true, reverse: true }, versiones: [{ etiqueta: null }] }).map((x) => x.nuestro).join() === 'normal,reverse')
  check('la fila de una versión por su id; la normal no tiene', v.versionDeVariante(drakloak, 'quick-ball')?.tcggo_id === 50939 && v.versionDeVariante(drakloak, 'normal') === null)
  check('un nombre no visto se deshace del id', v.nombreDeVariante('master-ball') === 'Master Ball' && v.esClasica('reverse') && !v.esClasica('quick-ball'))
}

console.log('── 2. El precio de una copia que es una versión ──')
{
  const datos = await import(`${RAIZ}/js/mi-coleccion/datos.js`)
  datos.registrarVersiones(VERSIONES)
  const guardados = new Map([['me2pt5-159', { card_id: 'me2pt5-159', cm_id_product: 869770, cm_low: 0.02, cm_low_es: 0.02 }], ['sm8-2', { card_id: 'sm8-2', cm_id_product: 365605, cm_low: 0.2, cm_low_es: 0.1 }]])
  const qb = datos.precioDeLinea({ card_id: 'me2pt5-159', variante: 'quick-ball' }, guardados, new Map())
  check('la Quick Ball vale lo de SU fila (0,07; en español 0,02), con su producto', qb?.desde === 0.07 && qb.porIdioma?.es === 0.02 && qb.idProduct === 870386, JSON.stringify(qb))
  const n = datos.precioDeLinea({ card_id: 'me2pt5-159', variante: 'normal' }, guardados, new Map())
  check('  …y la normal lo de siempre', n?.desde === 0.02 && n.idProduct === 869770)
  const rv = datos.precioDeLinea({ card_id: 'sm8-2', variante: 'reverse' }, guardados, new Map())
  check('la reverse de un set viejo, con fila de TCGGO, vale lo de esa fila (0,85) y no una cuenta sobre la normal', rv?.desde === 0.85, JSON.stringify(rv))
  check('una versión sin fila registrada cae a la carta, sin error', datos.precioDeLinea({ card_id: 'me2pt5-159', variante: 'master-ball' }, guardados, new Map())?.desde === 0.02)
}

console.log('── 3. La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
  if (hay.status === 0) {
    psql(['-c', 'drop database if exists prueba_862'])
    psql(['-c', 'create database prueba_862'])
    // La tabla como la dejó la migración de la colección: con las cuatro.
    psql(['-d', 'prueba_862', '-c', "create table public.user_collection (id serial primary key, card_id text not null, variante text not null default 'normal', constraint user_collection_variante check (variante in ('normal', 'reverse', 'holo', 'primera')))"])
    const antes = psql(['-d', 'prueba_862', '-c', "insert into public.user_collection (card_id, variante) values ('x', 'quick-ball')"])
    check('antes de la migración, «quick-ball» no cabe', antes.status !== 0)
    const mig = join(RAIZ, 'supabase-migration-variantes-tcggo.sql')
    for (let i = 0; i < 2; i++) {
      const r = psql(['-d', 'prueba_862', '-f', mig])
      check(`la migración carga${i ? ' otra vez (se puede repetir)' : ''}`, r.status === 0, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    }
    const ok = psql(['-d', 'prueba_862', '-c', "insert into public.user_collection (card_id, variante) values ('x', 'quick-ball'), ('x', 'energy-symbol-pattern'), ('x', 'reverse'), ('x', 'normal')"])
    check('después caben las versiones de TCGGO y las cuatro de siempre', ok.status === 0, ok.stderr)
    const mal = psql(['-d', 'prueba_862', '-c', "insert into public.user_collection (card_id, variante) values ('x', 'Quick Ball')"])
    const mal2 = psql(['-d', 'prueba_862', '-c', "insert into public.user_collection (card_id, variante) values ('x', '')"])
    check('  …pero no una etiqueta sin pasar por la web («Quick Ball», vacía)', mal.status !== 0 && mal2.status !== 0)
    psql(['-c', 'drop database if exists prueba_862'])
  }
}

const browser = await chromium.launch()
const semilla = (VERSIONES) => {
  window.__FAKE_SESSION__ = 'user-1'
  try {
    localStorage.setItem('pokedoc-instalar-no', String(Date.now()))
    localStorage.setItem('mc-split', '1')
  } catch { /* sin memoria */ }
  window.__FAKE_SETS__ = [{ id: 'me2pt5', name: 'Ascended Heroes', serie_id: 'me', market: 'WEST', release_date: '2026-01-30', card_count_official: 217, card_count_total: 295 }]
  const c = (n, nombre, variants) => ({ id: `me2pt5-${n}`, market: 'WEST', set_id: 'me2pt5', local_id: String(n), name: nombre, name_es: nombre, image_path: `me/me2pt5/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [886], variants, tcg_sets: { id: 'me2pt5', name: 'Ascended Heroes', serie_id: 'me' } })
  window.__FAKE_CARTAS__ = [c(158, 'Dreepy', { normal: true, reverse: true }), c(159, 'Drakloak', { normal: true, reverse: true, holo: false }), c(160, 'Dragapult ex', { holo: true })]
  window.__FAKE_PRECIOS__ = [{ card_id: 'me2pt5-159', cm_id_product: 869770, cm_low: 0.02, cm_low_es: 0.02, checked_at: new Date().toISOString() }]
  window.__FAKE_VERSIONES__ = VERSIONES.filter((x) => x.card_id === 'me2pt5-159')
  window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'user-1', card_id: 'me2pt5-159', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'energy-symbol-pattern', cantidad: 1 }]
}
async function abrir(ruta, { movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1366, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla, VERSIONES)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { page, ctx, errores }
}

console.log('── 4. La expansión, con las variantes separadas ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album&set=me2pt5')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const casillas = await page.evaluate(() => [...document.querySelectorAll('#mcAlbum [data-carta="me2pt5-159"]')].map((a) => {
    const caja = a.closest('.mc-bolsillo') || a
    const chapa = caja.querySelector('.mc-chapa-variante')
    return { var: chapa?.dataset.var, corto: chapa?.querySelector('b')?.textContent, nombre: chapa?.querySelector('span')?.textContent, tengo: caja.classList.contains('tengo') || /tienes/.test(a.getAttribute('aria-label') || ''), mas: caja.querySelector('.mc-mas')?.dataset.variante, velo: Boolean(caja.querySelector('.mc-velo-reverse')) }
  }))
  check('el Drakloak abre en CUATRO casillas: N, RH, ESP y QB, cada una con su chapa', casillas.map((c) => c.var).join() === 'normal,reverse,energy-symbol-pattern,quick-ball' && casillas.map((c) => c.corto).join() === 'N,RH,ESP,QB' && casillas[3].nombre === 'Quick Ball', JSON.stringify(casillas))
  check('  …la Energy Symbol Pattern, que tienes, marcada; la Quick Ball no; y las de TCGGO con velo, como la reverse', casillas[2]?.tengo && !casillas[3]?.tengo && casillas[2].velo && casillas[3].velo && !casillas[0].velo, JSON.stringify(casillas))
  check('  …y el «+» de cada casilla lleva su versión', casillas[3]?.mas === 'quick-ball')
  const dreepy = await page.evaluate(() => document.querySelectorAll('#mcAlbum [data-carta="me2pt5-158"]').length)
  check('el Dreepy, sin versiones de TCGGO, sigue en dos', dreepy === 2, String(dreepy))
  // El «+» de la Quick Ball abre el diálogo con esa versión puesta.
  await page.evaluate(() => document.querySelector('#mcAlbum .mc-mas[data-anadir="me2pt5-159"][data-variante="quick-ball"]').click())
  await page.waitForTimeout(800)
  const dialogo = await page.evaluate(() => {
    const d = document.getElementById('mcAnadirDialogo')
    const s = document.getElementById('mcAdVariante')
    return { abierto: d?.open, puesta: s?.value, opciones: [...(s?.options || [])].map((o) => `${o.value}=${o.textContent}`), tienes: document.getElementById('mcAdTienes')?.textContent }
  })
  check('el diálogo de añadir sale con «Quick Ball» puesta y las cuatro versiones a elegir; y «Ya tienes 1» (la ESP cuenta como la carta)', dialogo.abierto && dialogo.puesta === 'quick-ball' && dialogo.opciones.join('|') === 'normal=Normal|reverse=Reverse holo|energy-symbol-pattern=Energy Symbol Pattern|quick-ball=Quick Ball' && /Ya tienes 1/.test(dialogo.tienes || ''), JSON.stringify(dialogo))
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(1200)
  const despues = await page.evaluate(() => {
    const a = [...document.querySelectorAll('#mcAlbum [data-carta="me2pt5-159"]')].find((x) => x.closest('.mc-bolsillo')?.querySelector('.mc-chapa-variante')?.dataset.var === 'quick-ball')
    return { tengo: a?.closest('.mc-bolsillo')?.classList.contains('tengo'), etiqueta: a?.getAttribute('aria-label') }
  })
  check('al guardar, la casilla de la Quick Ball pasa a tuya', despues.tengo && /tienes 1/.test(despues.etiqueta || ''), JSON.stringify(despues))
  // En «Cartas», la copia dice su versión.
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const fila = await page.evaluate(() => [...document.querySelectorAll('.mc-chapa-variante')].map((c) => `${c.dataset.var}:${c.textContent.trim()}`))
  // (La Quick Ball recién añadida no está: el doble vuelve a sembrar la
  // colección al recargar. Lo guardado se ha comprobado arriba.)
  check('en Cartas, la copia lleva la chapa «ESP Energy Symbol Pattern»', fila.some((f) => /^energy-symbol-pattern:ESP\s*Energy Symbol Pattern$/.test(f)), JSON.stringify(fila))
  await ctx.close()
}

console.log('── 5. /carta ──')
{
  const { page, ctx, errores } = await abrir('/carta.html?id=me2pt5-159')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await page.evaluate(() => ({
    opciones: [...document.querySelectorAll('#cmVariante option')].map((o) => o.value),
    chapas: [...document.querySelectorAll('#cmPrecios .pv-impresion')].map((b) => `${b.dataset.variante}:${b.querySelector('b')?.textContent}`),
  }))
  check('la versión se elige entre las cuatro, también en las chapas', r.opciones.join() === 'normal,reverse,energy-symbol-pattern,quick-ball' && r.chapas.length === 4 && r.chapas[3] === 'quick-ball:Quick Ball', JSON.stringify(r))
  await page.click('#cmPrecios .pv-impresion[data-variante="quick-ball"]')
  await page.waitForTimeout(600)
  const precio = await page.evaluate(() => ({ activa: document.querySelector('#cmPrecios .pv-impresion.pv-activa')?.dataset.variante, texto: document.querySelector('#cmPrecios .pv-impresion.pv-activa')?.textContent.replace(/ /g, ' ').trim(), cuantas: document.querySelectorAll('#cmPrecios .pv-fila').length }))
  check('elegida la Quick Ball, su precio (0,02 € en español) y su tabla por idioma', precio.activa === 'quick-ball' && /0,02/.test(precio.texto || '') && precio.cuantas >= 1, JSON.stringify(precio))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
