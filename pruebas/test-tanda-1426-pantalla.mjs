// Tanda 1426 — El puesto de cambios: lo que abre el QR del modo evento de una
// persona (/evento/<usuario>). PINGU: «quiero que sea muy visual y tal, y con
// filtros para buscar dentro de cada colección». Cartas primero; Da / Busca,
// buscador y filtros (los tuyos, expansión, rareza, precio, orden) pegados
// arriba; el cruce en sellos y en una frase; Proponer en la cabecera (nada
// flota, 1023). Y lo puro: tramos, filtros, órdenes, la cuenta y la frase.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const SETS = [
  { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', tcg_online_code: 'SSP', card_count_official: 191, card_count_total: 252 },
  { id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', tcg_online_code: 'MEW', card_count_official: 165, card_count_total: 207 },
]
const carta = (set, n, nombre, rareza) => ({ id: `${set}-${n}`, set_id: set, local_id: String(n), name: nombre, name_es: nombre, market: 'WEST', category: 'Pokemon', rarity: rareza, rarity_en: rareza, image_path: `sv/${set}/${n}`, variants: { holo: true } })
const CARTAS = [
  carta('sv8', 1, 'Pikachu ex', 'Double Rare'), carta('sv8', 2, 'Charizard ex', 'Special Illustration Rare'), carta('sv8', 3, 'Eevee', 'Common'),
  carta('sv3pt5', 4, 'Charmander', 'Illustration Rare'), carta('sv3pt5', 5, 'Squirtle', 'Illustration Rare'), carta('sv3pt5', 6, 'Mew ex', 'Double Rare'),
]
const PRECIO = { 'sv8-1': 12, 'sv8-2': 140, 'sv8-3': 0.5, 'sv3pt5-4': 38, 'sv3pt5-5': 32, 'sv3pt5-6': 4 }
const PRECIOS = Object.entries(PRECIO).map(([id, p]) => ({ card_id: id, market: 'WEST', cm_low: p, cm_trend: p, cm_avg30: p, cm_low_holo: p, cm_trend_holo: p, cm_low_es: p, cm_low_en: p, checked_at: new Date().toISOString() }))
// Misty (user-2) da cinco y busca dos; Ash (user-1, quien mira con cuenta)
// busca el Charizard y el Mew, y da un Eevee que Misty busca.
const linea = (id, user, card, cambio) => ({ id, user_id: user, card_id: card, market: 'WEST', idioma: 'es', estado: 'NM', variante: 'holo', cantidad: Math.max(1, cambio), cambio })
const COLECCION = [
  linea('m1', 'user-2', 'sv8-2', 1), linea('m2', 'user-2', 'sv8-1', 2), linea('m3', 'user-2', 'sv3pt5-4', 1), linea('m4', 'user-2', 'sv3pt5-5', 1), linea('m5', 'user-2', 'sv3pt5-6', 1),
  linea('a1', 'user-1', 'sv8-3', 1),
]
const DESEOS = [
  { id: 'd1', user_id: 'user-2', card_id: 'sv8-3', idioma: null }, { id: 'd2', user_id: 'user-2', card_id: 'sv8-1', idioma: null },
  { id: 'd3', user_id: 'user-1', card_id: 'sv8-2', idioma: null }, { id: 'd4', user_id: 'user-1', card_id: 'sv3pt5-6', idioma: null },
]

const b = await chromium.launch()
async function abrir(ruta, { sesion = null, movil = true } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1440, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion || 'none'
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_COLECCION__: d.COLECCION, __FAKE_DESEOS__: d.DESEOS, __FAKE_PRECIOS__: d.PRECIOS })
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('pokedoc-onboarding', '1') } catch {}
  }, { SETS, CARTAS, COLECCION, DESEOS, PRECIOS, sesion })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitless|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/Transition/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ep-rejilla .pc-carta', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  return { ctx, page, errores }
}
const estado = (page) => page.evaluate(() => {
  const p = document.querySelector('.ep-puesto')
  const cartas = [...(p?.querySelectorAll('.ep-rejilla .pc-carta') || [])]
  const primera = cartas[0]?.getBoundingClientRect()
  return {
    nombres: cartas.map((c) => c.querySelector('.pc-carta-nombre')?.textContent),
    sellos: cartas.filter((c) => c.querySelector('.pc-sello')).map((c) => c.querySelector('.pc-carta-nombre')?.textContent),
    cuenta: p?.querySelector('[data-ep-cuenta]')?.textContent,
    chips: [...(p?.querySelectorAll('.ep-chips .ep-chip') || [])].map((c) => c.textContent.replace(/\s+/g, ' ').trim()),
    ordenes: [...(p?.querySelectorAll('select[data-ep="orden"] option') || [])].map((o) => o.value),
    frase: p?.querySelector('[data-ep-cruce]')?.textContent.trim(),
    proponer: !!p?.querySelector('[data-ep-proponer]:not([disabled])'),
    primeraArriba: primera ? Math.round(primera.top) : null,
    anchoDePagina: document.documentElement.scrollWidth, ventana: innerWidth,
    fijos: [...document.querySelectorAll('.ep-puesto *')].filter((n) => getComputedStyle(n).position === 'fixed').length,
  }
})
const elegir = (page, clave, valor) => page.selectOption(`select[data-ep="${clave}"]`, valor).then(() => page.waitForTimeout(300))

console.log('── Lo puro ──')
{
  const { ctx, page } = await abrir('/evento/Misty')
  const r = await page.evaluate(async () => {
    const m = await import('/js/evento-puesto-puro.js')
    const it = (i, o) => ({ i, sello: null, precio: null, nombre: '', set: '', setNombre: '', rareza: '', texto: '', ...o })
    const items = [it(0, { nombre: 'Mew', precio: 4, set: 'a', setNombre: 'A', rareza: 'Doble rara', texto: 'mew' }), it(1, { nombre: 'Charizard', precio: 140, set: 'b', setNombre: 'B', rareza: 'Ilustración especial', sello: 'La buscas', texto: 'charizard' }), it(2, { nombre: 'Eevee', precio: null, set: 'a', setNombre: 'A', rareza: 'Común', texto: 'eevee' }), it(3, { nombre: 'Pikachu', precio: 12, set: 'a', setNombre: 'A', rareza: 'Doble rara', texto: 'pikachu' })]
    const op = m.opcionesDe(items)
    const nombres = (xs) => xs.map((x) => x.nombre).join(',')
    return {
      sets: op.sets.map((s) => `${s.clave}:${s.n}`).join(','), rarezas: op.rarezas.map((s) => `${s.clave}:${s.n}`).join(','), tramos: op.tramos.map((t) => `${t.clave}:${t.n}`).join(','), conSello: op.conSello,
      tuyo: nombres(m.ordenar(items, 'tuyo')), caras: nombres(m.ordenar(items, 'caras')), baratas: nombres(m.ordenar(items, 'baratas')), nombre: nombres(m.ordenar(items, 'nombre')),
      precio: nombres(m.filtrar(items, { precio: '5a20' })), set: nombres(m.filtrar(items, { set: 'a', q: 'e' })), solo: nombres(m.filtrar(items, { solo: true })),
      cuenta: m.cuentaDe(items.slice(0, 2), 4, (n) => `${n} €`), cuentaToda: m.cuentaDe(items, 4, (n) => `${n} €`),
      f1: m.fraseDelCruce(2, 3, 'Misty'), f2: m.fraseDelCruce(0, 1, 'Misty'), f3: m.fraseDelCruce(1, 0, 'Misty'), f4: m.fraseDelCruce(0, 0, 'Misty'),
    }
  })
  check('las expansiones y las rarezas que hay, con cuántas y la más llena primero', r.sets === 'a:3,b:1' && r.rarezas === 'Doble rara:2,Común:1,Ilustración especial:1', `${r.sets} | ${r.rarezas}`)
  check('los tramos de precio que tienen algo (sin precio no entra en ninguno)', r.tramos === 'hasta5:1,5a20:1,mas50:1', r.tramos)
  check('«Lo tuyo primero»: lo que lleva sello y luego lo de más valor', r.tuyo === 'Charizard,Pikachu,Mew,Eevee', r.tuyo)
  check('más caras / más baratas (sin precio, al final) / nombre', r.caras === 'Charizard,Pikachu,Mew,Eevee' && r.baratas === 'Mew,Pikachu,Charizard,Eevee' && r.nombre === 'Charizard,Eevee,Mew,Pikachu', `${r.caras} | ${r.baratas} | ${r.nombre}`)
  check('los filtros: tramo, expansión con texto y solo lo tuyo', r.precio === 'Pikachu' && r.set === 'Mew,Eevee' && r.solo === 'Charizard', `${r.precio} | ${r.set} | ${r.solo}`)
  check('la cuenta: «de N» solo con algo puesto, y la suma', r.cuenta === '2 cartas de 4 · 144 €' && r.cuentaToda === '4 cartas · 156 €', `${r.cuenta} | ${r.cuentaToda}`)
  check('la frase del cruce en sus cuatro casos', r.f1 === 'Misty te puede dar 2 cartas de tu lista y tú le puedes dar 3 que busca.' && r.f2 === 'Tú le puedes dar a Misty 1 carta que busca.' && r.f3 === 'Misty te puede dar 1 carta de tu lista.' && /no os cuadra nada/.test(r.f4), [r.f1, r.f2, r.f3, r.f4].join(' | '))
  await ctx.close()
}

console.log('\n── Móvil, sin cuenta ──')
{
  const { ctx, page, errores } = await abrir('/evento/Misty')
  const e = await estado(page)
  check('sin errores', !errores.length, errores.join(' | '))
  check('lo que da, las cinco, de la más cara a la más barata', e.nombres.join(',') === 'Charizard ex,Charmander,Squirtle,Pikachu ex,Mew ex', e.nombres.join(','))
  check('sin cuenta no hay «Lo tuyo primero» ni chip de lo tuyo', !e.ordenes.includes('tuyo') && !e.chips.some((c) => /La buscas/.test(c)), JSON.stringify({ ordenes: e.ordenes, chips: e.chips }))
  check('los chips: Expansión, Rareza, Precio y el orden', e.chips.length === 4 && /^Expansión/.test(e.chips[0]) && /^Rareza/.test(e.chips[1]) && /^Precio/.test(e.chips[2]) && /^Más caras/.test(e.chips[3]), JSON.stringify(e.chips))
  check('la cuenta con lo que suman', e.cuenta === '5 cartas · 226,00 €', e.cuenta)
  check('la primera carta en la primera pantalla', e.primeraArriba !== null && e.primeraArriba < 844 - 200, e.primeraArriba)
  check('nada se sale por los lados', e.anchoDePagina <= e.ventana, `${e.anchoDePagina} > ${e.ventana}`)
  check('nada flota en el puesto (1023)', e.fijos === 0, e.fijos)
  await elegir(page, 'set', 'sv3pt5')
  let x = await estado(page)
  check('Expansión: solo las de 151, y el chip lo dice', x.nombres.join(',') === 'Charmander,Squirtle,Mew ex' && /^151/.test(x.chips[0]) && x.cuenta === '3 cartas de 5 · 74,00 €', JSON.stringify({ n: x.nombres, c: x.chips[0], cuenta: x.cuenta }))
  await elegir(page, 'precio', 'hasta5')
  x = await estado(page)
  check('y Precio «Hasta 5 €» encima: el Mew', x.nombres.join(',') === 'Mew ex', x.nombres.join(','))
  await elegir(page, 'precio', '')
  await elegir(page, 'set', '')
  await elegir(page, 'orden', 'baratas')
  x = await estado(page)
  check('Más baratas', x.nombres.join(',') === 'Mew ex,Pikachu ex,Squirtle,Charmander,Charizard ex', x.nombres.join(','))
  await page.fill('#epBuscar', 'char')
  await page.waitForTimeout(300)
  x = await estado(page)
  check('el buscador: «char» deja Charmander y Charizard', x.nombres.join(',') === 'Charmander,Charizard ex', x.nombres.join(','))
  await page.fill('#epBuscar', 'zzz')
  await page.waitForTimeout(300)
  const nada = await page.evaluate(() => document.querySelector('.ep-nada')?.textContent.trim())
  check('sin resultados, lo dice y deja quitar los filtros', /Nada con estos filtros/.test(nada || ''), nada)
  await page.click('[data-ep-limpiar]')
  await page.waitForTimeout(300)
  x = await estado(page)
  check('«Quitar los filtros» vuelve a las cinco', x.nombres.length === 5 && (await page.inputValue('#epBuscar')) === '', x.nombres.join(','))
  await page.click('[data-ep-lista="busca"]')
  await page.waitForTimeout(300)
  x = await estado(page)
  check('«Busca»: sus dos', x.nombres.sort().join(',') === 'Eevee,Pikachu ex', x.nombres.join(','))
  // Los mandos se quedan arriba al bajar.
  await page.click('[data-ep-lista="da"]')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(700)
  const pegado = await page.evaluate(() => { const r = document.querySelector('.ep-mandos').getBoundingClientRect(); return { top: Math.round(r.top), alto: Math.round(r.height) } })
  check('al bajar, los mandos siguen arriba', pegado.top >= 0 && pegado.top <= 72, JSON.stringify(pegado))
  await ctx.close()
}

console.log('\n── Móvil, con cuenta ──')
{
  const { ctx, page, errores } = await abrir('/evento/Misty', { sesion: 'user-1' })
  await page.waitForFunction(() => !document.querySelector('[data-ep-proponer][disabled]'), null, { timeout: 8000 }).catch(() => {})
  const e = await estado(page)
  check('sin errores', !errores.length, errores.join(' | '))
  check('lo tuyo primero: el Charizard y el Mew, que buscas, delante y con su sello', e.nombres.slice(0, 2).join(',') === 'Charizard ex,Mew ex' && e.sellos.sort().join(',') === 'Charizard ex,Mew ex', JSON.stringify({ n: e.nombres, s: e.sellos }))
  check('el chip «La buscas · 2»', e.chips[0] === 'La buscas · 2', e.chips[0])
  check('la frase del cruce y «Proponer cambio» listo', /te puede dar 2 cartas de tu lista y tú le puedes dar 1 que busca/.test(e.frase || '') && e.proponer, JSON.stringify({ frase: e.frase, proponer: e.proponer }))
  await page.click('[data-ep-solo]')
  await page.waitForTimeout(300)
  const solo = await estado(page)
  check('«La buscas» deja solo esas dos', solo.nombres.join(',') === 'Charizard ex,Mew ex' && solo.chips[0] === 'La buscas · 2', JSON.stringify(solo.nombres))
  await page.click('[data-ep-lista="busca"]')
  await page.waitForTimeout(300)
  const busca = await estado(page)
  check('en «Busca», lo que le puedes dar tú lleva «Las tienes» y el chip se suelta', busca.chips[0] === 'Las tienes · 1' && busca.nombres.length === 2 && busca.sellos.join(',') === 'Eevee', JSON.stringify({ c: busca.chips[0], n: busca.nombres, s: busca.sellos }))
  await page.click('[data-ep-proponer]')
  const propuesta = await page.waitForSelector('dialog[open]', { timeout: 8000 }).then(() => true).catch(() => false)
  check('«Proponer cambio» abre la propuesta', propuesta)
  await ctx.close()
}

console.log('\n── PC ──')
{
  const { ctx, page, errores } = await abrir('/evento/Misty', { sesion: 'user-1', movil: false })
  const r = await page.evaluate(() => {
    const q = document.querySelector('.ep-quien').getBoundingClientRect()
    const a = document.querySelector('.ep-acciones').getBoundingClientRect()
    const filas = new Set([...document.querySelectorAll('.ep-rejilla .pc-carta')].map((c) => Math.round(c.getBoundingClientRect().top)))
    return { mismaLinea: Math.abs((q.top + q.height / 2) - (a.top + a.height / 2)) < 20, porFila: document.querySelectorAll('.ep-rejilla .pc-carta').length / filas.size, titulo: document.title }
  })
  check('sin errores', !errores.length, errores.join(' | '))
  check('la cabecera en una línea: quién a la izquierda, Proponer y Escribir a la derecha', r.mismaLinea, JSON.stringify(r))
  check('las cinco cartas en una fila', r.porFila === 5, r.porFila)
  check('el título de la pestaña', r.titulo === 'Lo que cambia Misty — PokeDoc', r.titulo)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
