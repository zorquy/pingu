// Tanda 596 — el repaso de fallos.
//
// PINGU: «busca errores que pueda haber en la web […] errores de interfaz,
// estilos, incluso funcionalidades […] detalles pequeños, y soluciónalos».
//
// Cada bloque es UN fallo encontrado, con su escenario de verdad:
//   1. Una ventana que espera (el enlace corto) escribía en la que estuviera
//      abierta al volver: abrir «Guardar» mientras tanto la pisaba.
//   2. Abrir un puzle reescribía la dirección a la repetición ENTERA: al
//      recargar o copiar el enlace salía la solución.
//   3. Al contestar un puzle no se veía cuál habías elegido tú.
//   4. «Pokémon noqueados» contaba sin los PS y no se recontaba al llegar:
//      un KO que solo se deduce de la vida salía como 0.
//   5. Con un registro en INGLÉS, las fichas se pedían en español: no
//      podían casar nunca.
//   6. «Cópialo a mano: ya está seleccionado» sin nada seleccionado (desde
//      «Tus repeticiones»).
//   7. Publicar SIN cambiar los nombres una repetición tuya le cambiaba el
//      título; y con los nombres cambiados, las notas iban con los de verdad.
//   8. El constructor: Ctrl+S mantenido guardaba el mismo mazo varias
//      veces, y «Con 2 copias, el 40 %» era la cifra de cuatro.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.BASE || 'http://localhost:8892'
const R481 = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8').replace(/\r/g, '')
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/></svg>'
const browser = await chromium.launch()

async function pagina({ quien = 'none', url = '/repeticiones.html', antes = {}, cartas = [], sets = [], tcgdex = null, sinPortapapeles = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => (tcgdex ? tcgdex(r) : r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })))
  await page.addInitScript(({ quien, antes, cartas, sets, sinPortapapeles }) => {
    window.__FAKE_SESSION__ = quien
    if (cartas.length) window.__FAKE_CARTAS__ = cartas
    if (sets.length) window.__FAKE_SETS__ = sets
    Object.assign(window, antes)
    // Sin permiso para el portapapeles, como en Safari tras un `await`.
    if (sinPortapapeles) Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('sin permiso')) }, configurable: true })
  }, { quien, antes, cartas, sets, sinPortapapeles })
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  return { page, ctx, errores }
}
async function pegar(page, texto) {
  await page.fill('#repTexto', texto)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
  })
}
const toasts = (page) => page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '))

console.log('\n── 1. Lo que llega tarde no pisa otra ventana ──')
{
  const { page, ctx, errores } = await pagina({ antes: { __RPC_RETRASO__: { enlace_corto_crear: 1500 } } })
  await pegar(page, R481)
  await page.click('[data-accion="compartir"]')
  await page.waitForTimeout(200)
  await page.keyboard.press('Escape')
  await page.click('[data-accion="guardar"]')
  await page.waitForTimeout(200)
  const titulo = await page.textContent('#repDialogoTitulo')
  const antes = await page.innerHTML('#repDialogoCuerpo')
  await page.waitForTimeout(2000)
  check('el enlace que llega tarde NO se escribe en «Guardar», que es la que está abierta', (await page.textContent('#repDialogoTitulo')) === titulo && (await page.innerHTML('#repDialogoCuerpo')) === antes && (await page.locator('#repDialogoCuerpo #repEnlace').count()) === 0, titulo)
  check('  …y no revienta', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 2 y 3. Los puzles: la dirección y tu respuesta ──')
{
  const GUARDADA = { id: 'rep0000001', user_id: 'user-1', registro: R481, titulo: 'La de los puzles', jugador_a: 'Rojo', jugador_b: 'Azul', ganador: 'Rojo', turnos: 11, compartida: true }
  const PUZLE = { id: 'pz00000001', replay_id: GUARDADA.id, user_id: 'user-1', foto: 120, pregunta: '¿Qué jugarías aquí?', opciones: ['Retirarse', 'Atacar', 'Jugar Órdenes de Jefes'], correcta: 2, explicacion: 'Con Jefes se cogen los dos últimos premios.' }
  const { page, ctx, errores } = await pagina({ quien: 'user-2', url: `/repeticiones.html?puzle=${PUZLE.id}`, antes: { __FAKE_PUZLES__: [PUZLE], __FAKE_REPETICIONES__: [GUARDADA] } })
  await page.waitForSelector('#repPuzle [data-opcion]', { timeout: 8000 }).catch(() => null)
  const direccion = await page.evaluate(() => location.pathname + location.search)
  check('abrir un puzle deja la dirección del PUZLE (no la de la repetición, que es la solución)', /[?&]puzle=pz00000001\b/.test(direccion) && !/[?&]r=/.test(direccion), direccion)
  await page.click('#repPuzle [data-opcion="1"]')
  await page.waitForSelector('#repPuzle .rep-puzle-solucion', { timeout: 5000 }).catch(() => null)
  const filas = await page.$$eval('#repPuzle li', (xs) => xs.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
  check('al contestar, tu respuesta lo dice con palabras («la tuya»)', filas.some((f) => /^Atacar \(la tuya\)/.test(f)), filas.join(' / '))
  check('  …y la buena también («la buena»), y nada más', filas.some((f) => /^Jugar Órdenes de Jefes \(la buena\)/.test(f)) && !filas.some((f) => /^Retirarse \(/.test(f)), filas.join(' / '))
  check('  …y «la tuya» tiene su estilo (no solo la negrita de la buena)', (await page.$eval('#repPuzle .rep-puzle-tuya', (x) => getComputedStyle(x).textDecorationLine)) === 'underline')
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 4. Un KO que solo se deduce de la vida se cuenta al llegar los PS ──')
{
  const mini = `Preparación
Rojo ha robado 7 cartas de la mano inicial.
Azul ha robado 7 cartas de la mano inicial.
Rojo ha puesto en juego a Pikachu en el Puesto Activo.
Azul ha puesto en juego a Eevee en el Puesto Activo.
Azul ha puesto en juego a Snorlax en la Banca.

Turno de Rojo
Rojo ha robado Ultra Ball.
El Pikachu de Rojo ha infligido 60 puntos de daño usando Impactrueno contra el Eevee de Azul.
El Snorlax de Azul pasa a estar en el Puesto Activo.
Rojo ha cogido una carta de Premio.

Turno de Azul
Azul ha robado una carta.`
  const cartas = [
    ['Pikachu', 60], ['Eevee', 60], ['Snorlax', 150],
  ].map(([n, hp], i) => ({ id: `ko-${i + 1}`, set_id: 'ko', local_id: String(i + 1), market: 'WEST', image_path: null, regulation_mark: 'H', name: n, name_es: n, category: 'Pokemon', hp }))
  const sets = [{ id: 'ko', name: 'KO', market: 'WEST', tcg_online_code: 'KO', release_date: '2025-01-01', card_count_official: 99 }]
  const { page, ctx, errores } = await pagina({ cartas, sets })
  await pegar(page, mini)
  await page.waitForFunction(() => {
    const tr = [...document.querySelectorAll('.rep-tabla-numeros tbody tr')].find((x) => x.firstElementChild?.textContent.trim() === 'Pokémon noqueados')
    return tr && tr.children[1].textContent.trim() === '1'
  }, null, { timeout: 8000 }).catch(() => null)
  const fila = await page.evaluate(() => [...[...document.querySelectorAll('.rep-tabla-numeros tbody tr')].find((x) => x.firstElementChild?.textContent.trim() === 'Pokémon noqueados')?.children || []].map((c) => c.textContent.trim()).join('|'))
  check('«Pokémon noqueados»: Rojo 1 (Eevee, 60 de daño con 60 PS, sin línea de KO), Azul 0', fila === 'Pokémon noqueados|1|0', fila)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 5. Un registro en inglés pregunta a TCGdex en inglés ──')
{
  const EN = `Setup
Ash chose tails for the opening coin flip.
Gary won the coin toss.
Gary decided to go second.
Ash drew 7 cards for the opening hand.
- 7 drawn cards.
   • Raikou V, Raikou V, Basic Lightning Energy, Forest Seal Stone, Rescue Board, Ultra Ball, Arven
Gary drew 7 cards for the opening hand.
- 7 drawn cards.
Ash played Raikou V to the Active Spot.
Ash played Raikou V to the Bench.
Gary played Mew ex to the Active Spot.

Turn # 1 - Ash's Turn
Ash drew Boss's Orders.
Ash attached Basic Lightning Energy to Raikou V in the Active Spot.
Ash ended their turn.

Turn # 2 - Gary's Turn
Gary drew a card.
Gary's Mew ex used Genome Hacking on Ash's Raikou V for 200 damage.
Ash's Raikou V was Knocked Out!
- 2 cards were discarded from Ash's Raikou V.
   • Raikou V, Basic Lightning Energy
Ash's Raikou V is now in the Active Spot.
Gary took 2 Prize cards.
A card was added to Gary's hand.
A card was added to Gary's hand.`
  const cartas = [
    { id: 'en-1', set_id: 'en', local_id: '1', name: 'Mew ex', name_es: 'Mew ex', category: 'Pokemon', hp: 180 },
    { id: 'en-2', set_id: 'en', local_id: '2', name: 'Raikou V', name_es: 'Raikou V', category: 'Pokemon', hp: 200 },
  ].map((c) => ({ market: 'WEST', image_path: null, regulation_mark: 'H', ...c }))
  const sets = [{ id: 'en', name: 'EN', market: 'WEST', tcg_online_code: 'EN', release_date: '2025-01-01', card_count_official: 99 }]
  const pedidas = []
  const { page, ctx, errores } = await pagina({ cartas, sets, tcgdex: (r) => { pedidas.push(r.request().url()); r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }) } })
  await pegar(page, EN)
  await page.waitForTimeout(2500)
  const fichas = pedidas.filter((u) => /\/cards\//.test(u))
  check('las fichas para comprobar la impresión se piden en INGLÉS', fichas.length > 0 && fichas.every((u) => u.includes('/v2/en/')), fichas.join(' '))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 6. Copiar sin portapapeles: el enlace, a la vista ──')
{
  const GUARDADA = { id: 'rep0000001', user_id: 'user-1', registro: R481, titulo: 'Mía', jugador_a: 'Rojo', jugador_b: 'Azul', ganador: 'Rojo', turnos: 11, compartida: true }
  const { page, ctx, errores } = await pagina({ quien: 'user-1', antes: { __FAKE_REPETICIONES__: [GUARDADA] }, sinPortapapeles: true })
  await page.waitForSelector('#repGuardadasCuerpo [data-copiar]', { timeout: 8000 }).catch(() => null)
  await page.click('#repGuardadasCuerpo [data-copiar]')
  await page.waitForTimeout(400)
  const t = await toasts(page)
  check('desde «Tus repeticiones», sin portapapeles, el aviso ENSEÑA el enlace (no dice «ya está seleccionado»)', /\/rep\/rep0000001/.test(t) && !/ya está seleccionado/.test(t), t)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 7. Publicar una repetición tuya ──')
{
  const CON_NOMBRES = R481.replace(/\bRojo\b/g, 'AshKetchum99').replace(/\bAzul\b/g, 'Misty_TCG')
  const INGLES = { 'Zorua de N': "N's Zorua", 'Zoroark ex de N': "N's Zoroark ex", 'Darumaka de N': "N's Darumaka", 'Reshiram de N': "N's Reshiram", 'Zekrom de N': "N's Zekrom", 'Mega-Greninja ex': 'Mega Greninja ex', 'Más PP de N': "N's PP Up", 'Energía Oscura': 'Darkness Energy', 'Órdenes de Jefes': "Boss's Orders" }
  const { leerRegistro } = await import('/home/user/pingu/js/repeticiones/registro.js')
  const lectura = leerRegistro(R481)
  const nombres = new Set()
  for (const e of lectura.eventos) for (const k of ['carta', 'pokemon', 'objetivo', 'sube', 'baja', 'a', 'de']) if (e[k] && e[k] !== '?') nombres.add(e[k])
  for (const e of lectura.eventos) for (const c of e.cartas || []) nombres.add(c)
  const enJuego = new Set(['Zorua de N', 'Zoroark ex de N', 'Fezandipiti ex', 'Pecharunt', 'Reshiram de N', 'Zekrom de N', 'Budew', 'Shaymin', 'Dreepy', 'Drakloak', 'Dragapult ex', 'Froakie', 'Frogadier', 'Mega-Greninja ex'])
  const cartas = [...nombres].map((n, i) => ({
    id: `fk-${i + 1}`, set_id: 'fk', local_id: String(i + 1), market: 'WEST', image_path: null, regulation_mark: 'H',
    name: INGLES[n] || n, name_es: n,
    category: enJuego.has(n) || n === 'Darumaka de N' ? 'Pokemon' : /^Energ/.test(n) ? 'Energy' : 'Trainer',
    hp: enJuego.has(n) ? 200 : null,
  }))
  const sets = [{ id: 'fk', name: 'FK', market: 'WEST', tcg_online_code: 'FK', release_date: '2025-01-01', card_count_official: 999 }]
  const ZOROARK = { id: 'zoroark-n', nombre: "N's Zoroark", iconos: [{ nombre: "N's Zoroark ex" }], requiere: [{ nombres: ["N's Zoroark ex"] }], activo: true }
  const MIA = { id: 'rep0000009', user_id: 'user-1', registro: CON_NOMBRES, titulo: 'Mi gran remontada', jugador_a: 'AshKetchum99', jugador_b: 'Misty_TCG', ganador: 'AshKetchum99', turnos: 11, compartida: false, notas: [{ fila: 30, texto: 'Aquí AshKetchum99 se la juega con Jefes' }] }
  const abrir = () => pagina({ quien: 'user-1', url: `/repeticiones.html?r=${MIA.id}`, cartas, sets, antes: { __FAKE_ARQUETIPOS__: [ZOROARK], __FAKE_REPETICIONES__: [MIA] } })
  const publicar = async (page, { anonima }) => {
    await page.waitForSelector('#repSala:not(.hidden)', { timeout: 8000 })
    await page.waitForFunction(() => /N's Zoroark/.test(document.getElementById('repMazosCuerpo')?.textContent || ''), null, { timeout: 10000 }).catch(() => null)
    await page.click('[data-accion="publicar"]')
    await page.waitForSelector('[data-dlg="publicar"]', { timeout: 8000 })
    if (!anonima) await page.uncheck('#repPublicarAnonima')
    await page.click('[data-dlg="publicar"]')
    await page.waitForFunction(() => (window.__RPCS__ || []).some((r) => r.nombre === 'repeticiones_publicar'), null, { timeout: 10000 }).catch(() => null)
  }
  {
    const { page, ctx, errores } = await abrir()
    await publicar(page, { anonima: false })
    const rpcs = await page.evaluate(() => window.__RPCS__.map((r) => ({ nombre: r.nombre, id: r.args.p_id })))
    const fila = await page.evaluate(() => window.__TABLAS__.replays.find((r) => r.id === 'rep0000009'))
    check('sin cambiar los nombres se publica LA TUYA, sin guardarla otra vez', !rpcs.some((r) => r.nombre === 'repeticiones_guardar') && rpcs.some((r) => r.nombre === 'repeticiones_publicar' && r.id === 'rep0000009'), JSON.stringify(rpcs))
    check('  …y se queda con su título (antes pasaba a «Mazo contra Mazo»)', fila?.titulo === 'Mi gran remontada' && fila.publica, JSON.stringify({ titulo: fila?.titulo, publica: fila?.publica }))
    check('sin errores', !errores.length, errores.join(' | '))
    await ctx.close()
  }
  {
    const { page, ctx, errores } = await abrir()
    await publicar(page, { anonima: true })
    const copia = await page.evaluate(() => window.__TABLAS__.replays.find((r) => r.id !== 'rep0000009'))
    const notas = JSON.stringify(copia?.notas || [])
    check('con los nombres cambiados, la copia lleva tus notas… con los nombres cambiados también', /Rojo se la juega con Jefes/.test(notas) && !/AshKetchum99/.test(notas), notas)
    check('sin errores', !errores.length, errores.join(' | '))
    await ctx.close()
  }
}

console.log('\n── 8. El constructor ──')
{
  const cartas = [
    { id: 'svi-1', set_id: 'svi', local_id: '1', name: 'Pikachu', name_es: 'Pikachu', category: 'Pokemon', stage: 'Basic', hp: 60 },
    { id: 'paf-1', set_id: 'paf', local_id: '1', name: 'Pikachu', name_es: 'Pikachu', category: 'Pokemon', stage: 'Basic', hp: 60 },
    { id: 'svi-2', set_id: 'svi', local_id: '2', name: 'Lightning Energy', name_es: 'Energía Rayo', category: 'Energy', energy_type: 'Basic' },
  ].map((c) => ({ market: 'WEST', image_path: null, regulation_mark: 'H', ...c }))
  const sets = [
    { id: 'svi', name: 'Escarlata y Púrpura', market: 'WEST', tcg_online_code: 'SVI', release_date: '2023-03-31', card_count_official: 198 },
    { id: 'paf', name: 'Destinos de Paldea', market: 'WEST', tcg_online_code: 'PAF', release_date: '2024-01-26', card_count_official: 91 },
  ]
  const lista = '2~svi-1_2~paf-1_56~svi-2'
  const { page, ctx, errores } = await pagina({ quien: 'user-1', url: `/constructor?l=${lista}`, cartas, sets })
  await page.waitForSelector('#cmMazo [data-info]', { timeout: 8000 }).catch(() => null)
  await page.locator('#cmMazo [data-info]').first().click()
  await page.waitForTimeout(300)
  const texto = (await page.textContent('#cmCartaProbabilidad').catch(() => '')).trim()
  check('la probabilidad dice las copias que cuenta: las 4 Pikachu (2 + 2 de otra impresión)', /^Con 4 copias \(contando las otras impresiones\)/.test(texto), texto)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  // Dos Ctrl+S en el mismo instante (el segundo, con la tecla mantenida) y
  // un tercero «de repetición»: un solo mazo nuevo.
  const antes = await page.evaluate(() => window.__TABLAS__.user_decks.length)
  await page.evaluate(() => {
    const ctrlS = (repeat) => document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, repeat, bubbles: true, cancelable: true }))
    ctrlS(false)
    ctrlS(false)
    ctrlS(true)
  })
  await page.waitForTimeout(1500)
  const despues = await page.evaluate(() => window.__TABLAS__.user_decks.length)
  check('Ctrl+S varias veces seguidas guarda el mazo nuevo UNA vez', despues === antes + 1, `${antes} → ${despues}`)
  // Ya guardado, la tecla mantenida (la repetición del teclado) no vuelve
  // a guardar: cada repetición era otro «Mazo guardado».
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()))
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, repeat: true, bubbles: true, cancelable: true })))
  await page.waitForTimeout(800)
  check('  …y la tecla MANTENIDA no vuelve a guardar', !/guardado/i.test(await toasts(page)), await toasts(page))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 10. El laboratorio: un nombre con apóstrofo ──')
{
  const FILAS = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
  const fila = (n) => FILAS.find((x) => x.name === n)
  const mazo = [[20, "N's Zorua"], [40, 'Psychic Energy']].map(([n, nombre]) => ({ carta: fila(nombre), n }))
  const cartas = mazo.map((e) => ({ ...e.carta, market: 'WEST', image_path: null }))
  const sets = [...new Set(cartas.map((c) => c.set_id))].map((id) => ({ id, name: id.toUpperCase(), market: 'WEST', tcg_online_code: id.toUpperCase(), release_date: '2025-01-01', card_count_official: 200 }))
  const lista = mazo.map((e) => `${e.n}~${e.carta.id}`).join('_')
  const { page, ctx, errores } = await pagina({ url: `/constructor?l=${lista}`, cartas, sets })
  await page.waitForTimeout(1200)
  await page.click('#cmProbar')
  await page.waitForSelector('.lab:not([hidden]) .lab-mesa', { timeout: 6000 }).catch(() => {})
  await page.click('[data-accion="auto"]')
  await page.click('[data-accion="empezar"]')
  await page.waitForTimeout(300)
  await page.locator('#labLadoPropio .lab-zona-activo [data-slot-carta]').click()
  await page.locator('#labMenu [data-op]', { hasText: 'Poner o quitar daño' }).click()
  await page.waitForTimeout(200)
  const titulo = await page.textContent('#labDialogoTitulo').catch(() => '')
  check('«Daño en N\'s Zorua», con su apóstrofo (antes «N&#39;s», escapado dos veces)', titulo === "Daño en N's Zorua", titulo)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 9. Lo que salió en el barrido de todas las páginas ──')
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 760 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
  await page.goto(`${BASE}/constructor`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const r = await page.evaluate(() => ({ sobra: document.documentElement.scrollWidth - document.documentElement.clientWidth, sello: getComputedStyle(document.getElementById('cmSello')).display }))
  check('el constructor a 360 px no se sale por la derecha (el desplegable de formato encoge)', r.sobra <= 0, r.sobra)
  check('  …y con el mazo vacío no hay un botón «sello» sin texto', r.sello === 'none', r.sello)
  for (const ruta of ['/auth', '/reset-password']) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)
    const h1 = await page.evaluate(() => [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()))
    check(`${ruta} tiene su <h1> (para quien no ve la pantalla)`, h1.length === 1 && h1[0].length > 5, h1.join(' | '))
  }
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} fallos.` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
