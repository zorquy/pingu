// Tanda 481 — el registro que acaba por premios, y el Greninja ex que no era.
//
// PINGU pasó un segundo registro de verdad «que termina por KO y cogiendo
// todos los premios, además con Zoroark ex y justo el rival jugó con un
// Greninja ex teracristal; he probado la repetición y sale como si fuera
// el Greninja ex de la colección del 30 aniversario». Con él salieron 27
// líneas sin entender y una mesa que se iba descuadrando sin dar ningún
// error: el que hizo mulligan jugaba con la mano a cero, el Zorua que caía
// por Picado Fantasma era el que NO tenía daño, la Fábrica del Team Rocket
// se descartaba de la mano cada vez que se usaba, Ráfaga Espejismo se
// llevaba al Greninja entero al descarte…
//
//   1. El registro, entero y cuadrando: las 60 cartas de cada uno en su
//      sitio en CADA foto, y cada caso raro mirado por separado.
//   2. La impresión que se jugó (repeticiones/impresion.js), con un TCGdex
//      de mentira: casa, no casa, no se sabe.
//   3. La página: el Greninja ex que sale es el de Ráfaga Espejismo, y sin
//      la ficha de TCGdex sale el otro (para saber que lo de arriba no es
//      casualidad).
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
const { fotos, arriba } = await import(`${RAIZ}/js/repeticiones/estado.js`)
const { usosPorCarta, usosDe, impresionQueCasa } = await import(`${RAIZ}/js/repeticiones/impresion.js`)
const { EJEMPLO } = await import(`${RAIZ}/js/repeticiones/ejemplo.js`)
// El registro de PINGU con los nombres cambiados por Rojo y Azul.
const REGISTRO = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8')

const igual = (a, b) => String(a).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === String(b).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const enJuego = (p) => [p.activo, ...p.banca].filter(Boolean)
const cartasDeSlot = (s) => s.cartas.length + s.energias.length + (s.herramienta ? 1 : 0)
const total = (s, n) => {
  const p = s.jugadores[n]
  return p.mano + p.mazo + p.descarte.length + p.premios + enJuego(p).reduce((a, x) => a + cartasDeSlot(x), 0) + (s.estadio?.dueno === n ? 1 : 0)
}

console.log('\n── 1. El registro que acaba por premios ──')
const lectura = leerRegistro(REGISTRO)
const fs = fotos(lectura)
const ev = lectura.eventos
const fotoTras = (pred, desde = 0) => ev.findIndex((e, i) => i >= desde && pred(e)) + 1
check('se entiende ENTERO (eran 27 líneas sin leer)', lectura.sinLeer.length === 0, lectura.sinLeer.join(' | '))
check('acaba por premios, y gana Rojo', fs.at(-1).fin?.ganador === 'Rojo' && fs.at(-1).fin?.porque === 'premios', JSON.stringify(fs.at(-1).fin))
check('  …con sus seis premios cogidos', fs.at(-1).jugadores.Rojo.premios === 0 && fs.at(-1).jugadores.Azul.premios === 1, `${fs.at(-1).jugadores.Rojo.premios} y ${fs.at(-1).jugadores.Azul.premios}`)
{
  // La cuenta que no puede fallar: 60 por jugador en cada foto, desde que
  // se ponen los premios. Y que no se cuadre por la vía fácil: ni mano ni
  // mazo por debajo de cero en ningún momento.
  const malas = []
  fs.forEach((s, i) => {
    for (const n of s.orden) {
      const p = s.jugadores[n]
      if (!p.premiosPuestos) continue
      if (total(s, n) !== 60 || p.mano < 0 || p.mazo < 0) malas.push(`${i}:${n}=${total(s, n)}`)
    }
  })
  check('las 60 cartas de cada uno cuadran en las 208 fotos', !malas.length && fs.length === 209, malas.slice(0, 5).join(', ') || fs.length)
}
{
  // El mulligan: Azul vuelve a robar siete aunque el registro no lo diga.
  const i = fotoTras((e) => e.tipo === 'poner' && e.jugador === 'Azul')
  check('el que hace mulligan juega con siete cartas (le quedan 6 tras poner a Shaymin)', fs[i].jugadores.Azul.mano === 6 && fs[i].jugadores.Azul.mazo === 53, `${fs[i].jugadores.Azul.mano} en la mano, ${fs[i].jugadores.Azul.mazo} en el mazo`)
  const m = ev.find((e) => e.tipo === 'mostrar')
  check('  …y la mano que enseña al hacerlo es suya, y no son cartas que lleguen', m?.jugador === 'Azul' && m.cartas?.length === 7, JSON.stringify(m))
  const j = fotoTras((e) => e.tipo === 'nombrar')
  check('la carta de más por el mulligan cuenta UNA vez (8 en la mano, no 9)', fs[j].jugadores.Rojo.mano === 8 && fs[j].jugadores.Rojo.manoConocida.includes('Tarjeta Roja Especial'), `${fs[j].jugadores.Rojo.mano}`)
}
check('el desglose del daño NO son cartas: va en su línea', !ev.some((e) => (e.cartas || []).some((c) => /da[ñn]o/i.test(c))) && ev.filter((e) => e.tipo === 'resumen').every((e) => /Daño (?:base|total)|contadores de daño/.test(e.linea)), ev.filter((e) => e.tipo === 'resumen').map((e) => e.linea).join(' | '))
{
  // Picado Fantasma con cuatro Zorua iguales: 200 al activo y 3+3 en la
  // banca. Caen DOS, y el segundo es el que ya llevaba 40 (y su energía),
  // no el primero de la banca.
  const i = fotoTras((e) => e.tipo === 'premio' && e.jugador === 'Azul')
  const r = fs[i].jugadores.Rojo
  const zoruas = enJuego(r).filter((x) => igual(arriba(x), 'Zorua de N')).map((x) => x.danio).sort((a, b) => a - b)
  check('Picado Fantasma tumba al activo y al Zorua que ya estaba tocado', zoruas.join(',') === '0,30', zoruas.join(','))
  check('  …y la energía que se descarta es la del caído, no la de un gemelo vivo', r.descarte.filter((c) => /Oscura/.test(c)).length === 1 && !enJuego(r).some((x) => x.energias.length), r.descarte.join(', '))
  check('Azul coge 2 premios por los dos', fs[i].jugadores.Azul.premios === 4)
}
{
  // Los contadores van al RIVAL del que los pone, aunque el registro diga
  // «el Pecharunt de Azul».
  const i = fotoTras((e) => e.tipo === 'contadores' && e.pokemon === 'Pecharunt')
  const pech = enJuego(fs[i].jugadores.Rojo).find((x) => arriba(x) === 'Pecharunt')
  const fezR = enJuego(fs[i].jugadores.Rojo).find((x) => arriba(x) === 'Fezandipiti ex')
  const fezA = enJuego(fs[i].jugadores.Azul).find((x) => arriba(x) === 'Fezandipiti ex')
  check('los contadores de Picado Fantasma caen en la banca de Rojo (el registro dice «de Azul»)', pech?.danio === 20 && fezR?.danio === 10 && fezA?.danio === 0, `${pech?.danio} ${fezR?.danio} ${fezA?.danio}`)
}
{
  // El estadio que se va: una carta, al descarte de su dueño, UNA vez.
  const i = fotoTras((e) => e.tipo === 'descartar' && e.cartas?.[0] === 'Palacio de N')
  const antes = fs[i - 2].jugadores.Rojo
  const r = fs[i].jugadores.Rojo
  check('el estadio que cambia va al descarte de su dueño una vez y no sale de su mano', r.mano === antes.mano && r.descarte.filter((c) => c === 'Palacio de N').length === 1, `${antes.mano}→${r.mano}`)
  const k = fotoTras((e) => e.tipo === 'jugar' && e.carta === 'Fábrica del Team Rocket')
  check('usar el estadio que está en juego no es jugar una carta de la mano', fs[k].jugadores.Azul.mano === fs[k - 1].jugadores.Azul.mano && fs[k].jugadores.Azul.descarte.length === fs[k - 1].jugadores.Azul.descarte.length && fs[k].foco?.estadio)
}
{
  // Más PP de N une una energía del DESCARTE: ni de la mano ni de otro
  // Pokémon (antes se la quitaba al activo).
  const i = fotoTras((e) => e.tipo === 'unir' && e.sub && e.padre?.carta === 'Más PP de N')
  const a = fs[i - 1].jugadores.Rojo
  const b = fs[i].jugadores.Rojo
  const energias = (p) => enJuego(p).reduce((n, x) => n + x.energias.length, 0)
  check('Más PP de N une la energía desde el descarte', b.mano === a.mano && b.descarte.length === a.descarte.length - 1 && energias(b) === energias(a) + 1, `mano ${a.mano}→${b.mano}, descarte ${a.descarte.length}→${b.descarte.length}`)
}
{
  // Y el Pequeño Cambio del ejemplo de la 462 (lo hace el RIVAL) sigue
  // moviendo la energía de un Pokémon a otro.
  const le = leerRegistro(EJEMPLO)
  const fe = fotos(le)
  const i = le.eventos.findIndex((e) => e.tipo === 'unir' && e.sub && e.padre?.tipo === 'usar' && e.padre.jugador !== e.jugador) + 1
  const energias = (p) => enJuego(p).reduce((n, x) => n + x.energias.length, 0)
  check('  …pero lo que une el RIVAL de otro (Pequeño Cambio) se sigue moviendo', i > 0 && energias(fe[i].jugadores.Azul) === energias(fe[i - 1].jugadores.Azul) && fe[i].jugadores.Azul.mazo === fe[i - 1].jugadores.Azul.mazo)
}
{
  // Ciclón Levante: el Dragapult ex con todo lo suyo vuelve a la mano.
  const i = fotoTras((e) => e.tipo === 'aMano' && e.cartas?.length === 5)
  const a = fs[i - 1].jugadores.Azul
  const b = fs[i].jugadores.Azul
  check('Ciclón Levante se lleva a la mano el Pokémon con todo lo suyo', !enJuego(b).some((x) => arriba(x) === 'Dragapult ex') && b.mano === a.mano + 5 && b.descarte.length === a.descarte.length)
  const j = fotoTras((e) => e.tipo === 'aMano' && e.cartas?.[0] === 'Zorua de N')
  check('Camilla Nocturna saca el Zorua del descarte', fs[j].jugadores.Rojo.descarte.length === fs[j - 1].jugadores.Rojo.descarte.length - 1 && fs[j].jugadores.Rojo.mano === fs[j - 1].jugadores.Rojo.mano + 1)
}
{
  // Ráfaga Espejismo: descarta 2 energías del Greninja (que se queda) y
  // hace 120 a otro más.
  const i = fotoTras((e) => e.tipo === 'descartarTodoDe' && e.pokemon === 'Greninja ex')
  const g = fs[i].jugadores.Azul.activo
  check('descartar 2 energías del Greninja no se lo lleva entero', arriba(g || { cartas: [''] }) === 'Greninja ex' && g.energias.length === 1, g ? `${arriba(g)} con ${g.energias.length}` : 'sin activo')
  const k = fotoTras((e) => e.tipo === 'danio')
  const z = enJuego(fs[k].jugadores.Rojo).find((x) => arriba(x) === 'Zorua de N')
  check('  …y el segundo golpe de 120 cae en el Zorua de la banca', z?.danio === 120 && fs[k].foco?.slot === z.id)
}
check('el ataque copiado se enseña («elige Llama Virtuosa»)', ev.some((e) => e.tipo === 'elige' && e.que === 'Llama Virtuosa'))

console.log('\n── 2. La impresión que se jugó ──')
const usos = usosPorCarta(lectura)
check('lo que se le ve hacer a cada carta sale del registro', [...usosDe(usos, 'Greninja ex')].join() === 'rafaga espejismo' && usosDe(usos, 'Zoroark ex de N').has('intercambiar') && usosDe(usos, 'Zoroark ex de N').has('bromista nocturno'))
const FICHAS = {
  'me03-021': { id: 'me03-021', localId: '021', name: 'Greninja ex', set: { id: 'me03' }, attacks: [{ name: 'Tajo Sigiloso' }, { name: 'Filo Acuático' }] },
  'sv06-106': { id: 'sv06-106', localId: '106', name: 'Greninja ex', set: { id: 'sv06' }, attacks: [{ name: 'Ráfaga Espejismo' }], abilities: [{ name: 'Cuchilla Ninja' }] },
}
// El Mega va PRIMERO: si el filtro dejara pasar lo que solo CONTIENE el
// nombre, sería el primero en mirarse.
const LISTA = [{ id: 'me02-030', localId: '030', name: 'Mega-Greninja ex' }, { id: 'me03-021', localId: '021', name: 'Greninja ex' }, { id: 'sv06-106', localId: '106', name: 'Greninja ex' }]
function tcgdex(fichas = FICHAS, { roto = false } = {}) {
  const pedidas = []
  const pedir = async (url) => {
    pedidas.push(url)
    if (roto) throw new Error('sin red')
    if (/\/cards\?name=/.test(url)) return { ok: true, json: async () => LISTA }
    const id = decodeURIComponent(url.split('/cards/')[1] || '')
    return fichas[id] ? { ok: true, json: async () => fichas[id] } : { ok: false, json: async () => null }
  }
  return { pedir, pedidas }
}
{
  const t = tcgdex()
  const r = await impresionQueCasa('Greninja ex', usosDe(usos, 'Greninja ex'), { id: 'me03-021' }, { pedir: t.pedir })
  check('el de 30th Celebration no hace Ráfaga Espejismo: se cambia por el teracristal', r?.id === 'sv06-106' && r.set === 'sv06' && r.numero === '106', JSON.stringify(r))
  check('  …mirando en TCGdex en ESPAÑOL (como escribe los ataques TCG Live)', t.pedidas.every((u) => u.startsWith('https://api.tcgdex.net/v2/es/')), t.pedidas.join(' '))
  const t2 = tcgdex()
  check('si la elegida ya casa, se queda, con UNA sola petición', (await impresionQueCasa('Greninja ex', usosDe(usos, 'Greninja ex'), { id: 'sv06-106' }, { pedir: t2.pedir })) === null && t2.pedidas.length === 1, t2.pedidas.length)
  const t3 = tcgdex({ 'sv06-106': FICHAS['sv06-106'] })
  check('si de la elegida no se sabe nada, se cambia solo por una que CASE', (await impresionQueCasa('Greninja ex', usosDe(usos, 'Greninja ex'), { id: 'me03-021' }, { pedir: t3.pedir }))?.id === 'sv06-106')
  const t4 = tcgdex({})
  check('  …y si no casa ninguna, se queda la que había (no saber no es no casar)', (await impresionQueCasa('Greninja ex', usosDe(usos, 'Greninja ex'), { id: 'me03-021' }, { pedir: t4.pedir })) === null)
  const t5 = tcgdex(FICHAS, { roto: true })
  check('sin red, se queda la que había y no revienta', (await impresionQueCasa('Greninja ex', usosDe(usos, 'Greninja ex'), { id: 'me03-021' }, { pedir: t5.pedir })) === null)
  const t6 = tcgdex()
  check('una carta a la que no se le ha visto hacer nada no pregunta', (await impresionQueCasa('Froakie', usosDe(usos, 'Froakie'), { id: 'x-1' }, { pedir: t6.pedir })) === null && !t6.pedidas.length)
  const t7 = tcgdex()
  check('«Mega-Greninja ex» no cuenta como un «Greninja ex» (el nombre, entero)', (await impresionQueCasa('Greninja ex', new Set(['tajo sigiloso']), { id: 'sv06-106' }, { pedir: t7.pedir }))?.id === 'me03-021' && !t7.pedidas.some((u) => u.includes('me02-030')), t7.pedidas.join(' '))
}

console.log('\n── 3. La página ──')
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/><rect x="10" y="10" width="225" height="322" rx="8" fill="#9cc3e0"/></svg>'
const cartas = [
  { id: 'sv06-106', set_id: 'sv06', local_id: '106', name: 'Greninja ex', name_es: 'Greninja ex', hp: 310, category: 'Pokemon', regulation_mark: 'H' },
  { id: 'me03-021', set_id: 'me03', local_id: '021', name: 'Greninja ex', name_es: 'Greninja ex', hp: 300, category: 'Pokemon', regulation_mark: 'J' },
].map((c) => ({ market: 'WEST', image_path: null, ...c }))
const sets = [
  { id: 'sv06', name: 'Máscaras del Crepúsculo', market: 'WEST', tcg_online_code: 'TWM', release_date: '2024-05-24', card_count_official: 167 },
  { id: 'me03', name: '30th Celebration', market: 'WEST', tcg_online_code: 'CEL', release_date: '2026-06-01', card_count_official: 128 },
]
const browser = await chromium.launch()
async function abrir({ fichas = true } = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errores = []
  const pedidas = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => {
    const url = r.request().url()
    if (url.includes('/v2/es/')) pedidas.push(url)
    if (!url.includes('/v2/es/') || !fichas) return r.fulfill({ status: url.includes('/cards?') ? 200 : 404, contentType: 'application/json', body: url.includes('/cards?') ? '[]' : '{}' })
    if (/\/cards\?name=/.test(url)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LISTA) })
    const id = decodeURIComponent(url.split('/cards/')[1] || '')
    return FICHAS[id] ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FICHAS[id]) }) : r.fulfill({ status: 404, body: '{}' })
  })
  await page.addInitScript(({ cartas, sets }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
  }, { cartas, sets })
  await page.goto(`${BASE}/repeticiones.html`, { waitUntil: 'domcontentloaded' })
  await page.fill('#repTexto', REGISTRO)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
  })
  return { page, errores, pedidas }
}
const irA = (page, n) =>
  page.evaluate((n) => {
    const r = document.getElementById('repProgreso')
    r.value = String(n)
    r.dispatchEvent(new Event('input', { bubbles: true }))
  }, n)
const fotoDelAtaque = fotoTras((e) => e.tipo === 'ataque' && e.pokemon === 'Greninja ex')
const greninja = (page) =>
  page.evaluate(() => {
    const s = document.querySelector('#repLadoArriba .lab-slot-activo')
    const img = s?.querySelector('img')
    return { ps: s?.querySelector('.lab-ps-texto')?.textContent || '', fuentes: `${img?.getAttribute('src') || ''} ${img?.dataset.respaldos || ''}` }
  })
{
  const { page, errores, pedidas } = await abrir()
  check('ninguna línea sale como «no entendida»', (await page.locator('.rep-paso-sin-leer').count()) === 0 && (await page.locator('#repSinLeer.hidden').count()) === 1)
  await irA(page, fotoDelAtaque)
  await page.waitForFunction(() => /310/.test(document.querySelector('#repLadoArriba .lab-slot-activo .lab-ps-texto')?.textContent || ''), null, { timeout: 8000 }).catch(() => {})
  const g = await greninja(page)
  check('el Greninja ex que ataca es el teracristal (310 PS, Máscaras del Crepúsculo)', /^310\/310/.test(g.ps) && /sv06/.test(g.fuentes) && !/me03/.test(g.fuentes), JSON.stringify(g))
  check('  …con pocas peticiones a TCGdex (la ficha de la elegida, la lista y la buena)', pedidas.length > 0 && pedidas.length <= 4, pedidas.length)
  await irA(page, fs.length - 1)
  check('la última jugada dice quién gana', /Gana/.test(await page.textContent('#repCentro')) && /Todas las cartas de Premio/.test(await page.textContent('#repCentro')))
  // Otra partida en la misma pestaña, con el Greninja ex de 30th
  // Celebration (el que hace Filo Acuático): el mismo nombre es OTRA carta,
  // así que lo resuelto en la partida de antes no vale.
  await page.click('[data-accion="otra"]')
  await page.fill('#repTexto', REGISTRO.replaceAll('Ráfaga Espejismo', 'Filo Acuático'))
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
  })
  await irA(page, fotoDelAtaque)
  await page.waitForFunction(() => /300/.test(document.querySelector('#repLadoArriba .lab-slot-activo .lab-ps-texto')?.textContent || ''), null, { timeout: 8000 }).catch(() => {})
  const g2 = await greninja(page)
  check('en otra partida, el Greninja ex de Filo Acuático es el de 30th Celebration (no se arrastra el de antes)', /^300\/300/.test(g2.ps) && /me03/.test(g2.fuentes), JSON.stringify(g2))
  check('sin errores en la página', !errores.length, errores.join(' | '))
  await page.close()
}
{
  // El contraste: sin la ficha en español, el resolutor por nombre se
  // queda con el más nuevo. Si esto saliera 310 también, lo de arriba no
  // probaría nada.
  const { page } = await abrir({ fichas: false })
  await irA(page, fotoDelAtaque)
  await page.waitForTimeout(1500)
  const g = await greninja(page)
  check('  …y sin TCGdex sale el de 30th Celebration (el más nuevo): lo de arriba no es casualidad', /^300\/300/.test(g.ps) && /me03/.test(g.fuentes), JSON.stringify(g))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
