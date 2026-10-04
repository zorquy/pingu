// Tanda 590 — la impresión que se juega de verdad, aunque no haga nada.
//
// PINGU: «en el log de Zoroark el rival saca un Shaymin y ese Shaymin no es
// el que se juega realmente. El que se está jugando es el de Rivales
// Predestinados, y en la repetición se ve otro».
//
// El Shaymin de Rivales Predestinados no ataca ni usa nada (su habilidad es
// pasiva), así que la 481 —que decide por lo que se le ve hacer— no tenía
// pista, y el resolutor por nombre elegía la impresión legal más NUEVA.
// Ahora manda la que más mazos del meta llevan (`meta_cartas_dia`).
//
//   1. `masJugadas`: suma por impresión y se queda la de más mazos.
//   2. La página: con el meta, el Shaymin es el de DRI; sin él, el otro
//      (para saber que lo de arriba no sale por casualidad). Y lo que se
//      le ve hacer sigue mandando por encima del meta.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const { masJugadas, esLaImpresion } = await import(`${RAIZ}/js/repeticiones/impresion.js`)
const REGISTRO = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8')

console.log('\n── 1. La que más mazos llevan ──')
{
  const filas = [
    // La primera fila es la más grande SUELTA (así llegan, por mazos), pero
    // sumadas gana la otra.
    { nombre: 'Shaymin', set_codigo: 'PFL', numero: '12', mazos: 30 },
    { nombre: 'Shaymin', set_codigo: 'DRI', numero: '10', mazos: 20 },
    { nombre: 'Shaymin', set_codigo: 'DRI', numero: '010', mazos: 15 },
    { nombre: 'Shaymin', set_codigo: '', numero: '7', mazos: 99 },
    { nombre: "N's Zoroark ex", set_codigo: 'jtg', numero: '98', mazos: 4 },
  ]
  const m = masJugadas(filas)
  check('suma la misma impresión escrita de dos maneras (010 y 10) y gana a la que suelta tiene más', m.get('shaymin')?.set === 'DRI' && m.get('shaymin').mazos === 35, JSON.stringify(m.get('shaymin')))
  check('  …y una fila sin colección no cuenta', m.get('shaymin').mazos === 35)
  check('el nombre se compara plano (mayúsculas, apóstrofos) y el código en mayúsculas', m.get("n's zoroark ex")?.set === 'JTG')
  check('«es esa impresión» casa sin ceros ni mayúsculas', esLaImpresion('dri', '010', m.get('shaymin')) && !esLaImpresion('PFL', '12', m.get('shaymin')) && !esLaImpresion(null, '10', m.get('shaymin')))
  check('sin filas, nada', masJugadas([]).size === 0 && masJugadas(null).size === 0)
}

console.log('\n── 2. La página ──')
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/></svg>'
const cartas = [
  // La de Rivales Predestinados (marca I) y una más nueva (marca J): por
  // nombre, gana la nueva.
  { id: 'sv10-010', set_id: 'sv10', local_id: '010', name: 'Shaymin', name_es: 'Shaymin', hp: 80, category: 'Pokemon', regulation_mark: 'I' },
  { id: 'me02-012', set_id: 'me02', local_id: '012', name: 'Shaymin', name_es: 'Shaymin', hp: 70, category: 'Pokemon', regulation_mark: 'J' },
  // Otro Pokémon de la partida, para que el meta tenga OTRO nombre.
  { id: 'sv10-020', set_id: 'sv10', local_id: '020', name: 'Budew', name_es: 'Budew', hp: 30, category: 'Pokemon', regulation_mark: 'I' },
].map((c) => ({ market: 'WEST', image_path: null, ...c }))
const sets = [
  { id: 'sv10', name: 'Rivales Predestinados', market: 'WEST', tcg_online_code: 'DRI', release_date: '2025-05-30', card_count_official: 182 },
  { id: 'me02', name: 'Llamas Fantasmales', market: 'WEST', tcg_online_code: 'PFL', release_date: '2026-11-14', card_count_official: 94 },
]
const hoy = new Date().toISOString().slice(0, 10)
const ayer = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
const META = [
  // Por días: la de DRI suma más, aunque la fila más grande sea la de PFL.
  { nombre: 'Shaymin', set_codigo: 'PFL', numero: '12', mazos: 25, dia: hoy },
  { nombre: 'Shaymin', set_codigo: 'DRI', numero: '10', mazos: 20, dia: hoy },
  { nombre: 'Shaymin', set_codigo: 'DRI', numero: '10', mazos: 20, dia: ayer },
  // Una fila de OTRA sección con muchos mazos: si se leyera, ganaría PFL.
  { nombre: 'Shaymin', seccion: 'trainer', set_codigo: 'PFL', numero: '12', mazos: 500, dia: hoy },
  // Y una vieja, de fuera de la ventana: tampoco cuenta.
  { nombre: 'Shaymin', set_codigo: 'PFL', numero: '12', mazos: 500, dia: '2020-01-01' },
]
const browser = await chromium.launch()
async function abrir({ meta = META, texto = REGISTRO } = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  await page.addInitScript(({ cartas, sets, meta }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_META_CARTAS__ = meta
  }, { cartas, sets, meta })
  await page.goto(`${BASE}/repeticiones.html`, { waitUntil: 'domcontentloaded' })
  await page.fill('#repTexto', texto)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
  })
  return { page, errores }
}
// La primera jugada (Shaymin de activo de Azul, arriba).
const shaymin = (page) =>
  page.evaluate(() => {
    const s = document.querySelector('#repLadoArriba .lab-slot-activo')
    const img = s?.querySelector('img')
    return { ps: s?.querySelector('.lab-ps-texto')?.textContent || '', fuentes: `${img?.getAttribute('src') || ''} ${img?.dataset.respaldos || ''}` }
  })
const irA = (page, n) =>
  page.evaluate((n) => {
    const r = document.getElementById('repProgreso')
    r.value = String(n)
    r.dispatchEvent(new Event('input', { bubbles: true }))
  }, n)
{
  const { page, errores } = await abrir()
  await irA(page, 12)
  await page.waitForFunction(() => /\/80/.test(document.querySelector('#repLadoArriba .lab-slot-activo .lab-ps-texto')?.textContent || ''), null, { timeout: 8000 }).catch(() => {})
  const s = await shaymin(page)
  check('con el meta, el Shaymin es el de Rivales Predestinados (80 PS, DRI)', /\/80/.test(s.ps) && /sv10|DRI/i.test(s.fuentes) && !/me02|PFL/i.test(s.fuentes), JSON.stringify(s))
  const consultas = await page.evaluate(() => window.__CONSULTAS__.porTabla.meta_cartas_dia || 0)
  check('  …con UNA consulta al meta para todos los Pokémon', consultas === 1, consultas)
  check('  …sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  // El contraste: sin filas del meta, el resolutor por nombre se queda con
  // la más nueva. Si esto saliera DRI también, lo de arriba no probaría nada.
  const { page } = await abrir({ meta: [] })
  await irA(page, 12)
  await page.waitForFunction(() => /\/70/.test(document.querySelector('#repLadoArriba .lab-slot-activo .lab-ps-texto')?.textContent || ''), null, { timeout: 8000 }).catch(() => {})
  const s = await shaymin(page)
  check('sin el meta, sale la más nueva (70 PS): la de arriba no es casualidad', /\/70/.test(s.ps) && /me02|PFL/i.test(s.fuentes), JSON.stringify(s))
  await page.close()
}
{
  // La impresión de OTRO Pokémon de la partida no le cae al Shaymin.
  const { page } = await abrir({ meta: [{ nombre: 'Budew', set_codigo: 'DRI', numero: '20', mazos: 99, dia: hoy }] })
  await irA(page, 12)
  await page.waitForTimeout(1500)
  const s = await shaymin(page)
  check('una fila de OTRO Pokémon no cambia el Shaymin', /me02|PFL/i.test(s.fuentes), JSON.stringify(s))
  await page.close()
}

console.log('\n── 3. Lo estático ──')
{
  const JS = readFileSync(`${RAIZ}/js/repeticiones.js`, 'utf8')
  const D = readFileSync(`${RAIZ}/js/repeticiones/datos.js`, 'utf8')
  check('se pide solo la sección de Pokémon y de los últimos días', /\.eq\('seccion', 'pokemon'\)/.test(D) && /\.gte\('dia', desde\)/.test(D))
  check('el meta se mira ANTES de afinar por lo que se le ve hacer', JS.indexOf('preferirLasDelMeta(resueltos, vez)') > 0 && JS.indexOf('preferirLasDelMeta(resueltos, vez)') < JS.indexOf('afinarTodas(porAfinar, vez)'))
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
