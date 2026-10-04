// Tanda 494 — los mazos de una repetición, por lo que se vio, y guardarla
// la apunta en «Mis partidas».
//
// PINGU, de la lista de ideas: «con las cartas que enseñó cada jugador saco
// su arquetipo ("Dragapult contra Zoroark"), etiqueto con él "Tus
// repeticiones" y añado un botón "Abrir en el constructor"» y «al guardar
// una repetición, que se apunte la partida en /mis-partidas con el mazo de
// cada uno y quién ganó».
//
//   1. Lo que se ve de un mazo (repeticiones/mazos.js), en Node, contra el
//      registro de la 481: cada cuenta es lo MÁXIMO que se vio A LA VEZ, en
//      el orden de una lista; el arquetipo se cruza con el nombre INGLÉS.
//   2. La página: el mazo al lado de cada jugador, el bloque «Los mazos,
//      por lo que se vio» con su enlace al constructor, y lo que se manda
//      al guardar; «Tus repeticiones» enseña el mazo de cada uno.
//   3. El constructor abre ese enlace con el nombre y el aviso de que es
//      lo que se VIO, no la lista.
//   4. Mis partidas: «¿cuál de los dos eres tú?», la fila con las claves
//      del torneo (claveDeArquetipo), sin apuntarla dos veces, y el enlace
//      «Ver la repetición» de vuelta.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
const { fotos } = await import(`${RAIZ}/js/repeticiones/estado.js`)
const { cartasVistas, listaParaArquetipo, entradasDelConstructor, totalVisto } = await import(`${RAIZ}/js/repeticiones/mazos.js`)
const { arquetipoDeMazo, claveDeArquetipo } = await import(`${RAIZ}/js/torneos/arquetipos.js`)
const { decodificarMazo } = await import(`${RAIZ}/js/constructor/nucleo.js`)
const REGISTRO = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8')

// El catálogo de mentira: el nombre del registro va en `name_es` y el
// INGLÉS en `name`, que es como lo trae TCGdex (tanda 334). Lo que estuvo en
// juego es Pokémon, y Darumaka también, aunque solo pasó por el descarte
// (eso solo lo sabe el catálogo).
const INGLES = { 'Zorua de N': "N's Zorua", 'Zoroark ex de N': "N's Zoroark ex", 'Darumaka de N': "N's Darumaka", 'Reshiram de N': "N's Reshiram", 'Zekrom de N': "N's Zekrom", 'Mega-Greninja ex': 'Mega Greninja ex', 'Más PP de N': "N's PP Up", 'Energía Oscura': 'Darkness Energy', 'Órdenes de Jefes': "Boss's Orders" }
const lectura = leerRegistro(REGISTRO)
const fs = fotos(lectura)
const enJuego = new Set()
for (const s of fs) for (const p of Object.values(s.jugadores)) for (const x of [p.activo, ...p.banca].filter(Boolean)) x.cartas.forEach((c) => enJuego.add(c))
const nombres = new Set()
for (const e of lectura.eventos) for (const k of ['carta', 'pokemon', 'objetivo', 'sube', 'baja', 'a', 'de']) if (e[k] && e[k] !== '?') nombres.add(e[k])
for (const e of lectura.eventos) for (const c of e.cartas || []) nombres.add(c)
// La Energía Oscura básica va a su sitio de verdad (`mee-007`): el
// constructor lleva TODA energía básica a la MEE de su tipo, la escriban
// como la escriban, y la busca por ese identificador.
const catalogo = [...nombres].map((n, i) => ({
  id: n === 'Energía Oscura' ? 'mee-007' : `fk-${i + 1}`,
  set_id: n === 'Energía Oscura' ? 'mee' : 'fk',
  local_id: n === 'Energía Oscura' ? '7' : String(i + 1),
  market: 'WEST',
  image_path: null,
  regulation_mark: 'H',
  name: INGLES[n] || n,
  name_es: n,
  category: enJuego.has(n) || n === 'Darumaka de N' ? 'Pokemon' : /^Energ/.test(n) ? 'Energy' : 'Trainer',
  hp: enJuego.has(n) ? 200 : null,
}))
const cartaDe = (n) => catalogo.find((c) => c.name_es === n) || null
const ZOROARK = { id: 'arq-zoroark', nombre: "N's Zoroark", iconos: [{ nombre: "N's Zoroark ex" }], requiere: [{ nombres: ["N's Zoroark ex"] }], activo: true }

console.log('\n── 1. Lo que se ve de un mazo ──')
const vistas = cartasVistas(fs, cartaDe)
const de = (j, n) => vistas[j].find((x) => x.nombre === n)
check('cada cuenta es lo que se vio A LA VEZ: 4 Zorua de N, 3 Zoroark ex de N', de('Rojo', 'Zorua de N')?.copias === 4 && de('Rojo', 'Zoroark ex de N')?.copias === 3, JSON.stringify(vistas.Rojo.slice(0, 3)))
check('  …las energías no tienen el tope de 4: 7 Energía Oscura', de('Rojo', 'Energía Oscura')?.copias === 7)
check('  …y de Azul, la línea entera: 2 Dreepy, 2 Drakloak, 2 Dragapult ex', ['Dreepy', 'Drakloak', 'Dragapult ex'].every((n) => de('Azul', n)?.copias === 2))
check('en el orden de una lista: Pokémon, Entrenadores y Energías', ['Rojo', 'Azul'].every((j) => vistas[j].map((x) => ({ pokemon: 0, entrenador: 1, energia: 2 })[x.tipo]).every((v, i, a) => !i || a[i - 1] <= v)))
check('un Pokémon que solo pasó por el descarte es Pokémon por el catálogo', de('Rojo', 'Darumaka de N')?.tipo === 'pokemon')
check('  …y sin catálogo, el que estuvo en juego es Pokémon igual', cartasVistas(fs).Rojo.find((x) => x.nombre === 'Zorua de N')?.tipo === 'pokemon')
check('lo que se vio, en total: 40 de Rojo y 33 de Azul', totalVisto(vistas.Rojo) === 40 && totalVisto(vistas.Azul) === 33, `${totalVisto(vistas.Rojo)} y ${totalVisto(vistas.Azul)}`)
{
  const lista = listaParaArquetipo(vistas.Rojo, cartaDe, () => 'FK')
  check('para el arquetipo, el nombre INGLÉS del catálogo y su colección', lista.pokemon.some((l) => l.name === "N's Zoroark ex" && l.set === 'FK') && lista.energy.some((l) => l.name === 'Darkness Energy'))
  check('  …y casa con el catálogo de arquetipos', arquetipoDeMazo(lista, [ZOROARK]).id === 'arq-zoroark')
  const sinCatalogo = listaParaArquetipo(cartasVistas(fs).Rojo)
  check('  …que con el nombre en español no casaba (es lo que se arregla)', !arquetipoDeMazo(sinCatalogo, [ZOROARK]).id)
  const azul = arquetipoDeMazo(listaParaArquetipo(vistas.Azul, cartaDe, () => 'FK'), [ZOROARK])
  check('sin arquetipo en el catálogo se deduce de las líneas: Mega Greninja ex y Dragapult ex', azul.nombre === 'Mega Greninja ex Dragapult ex' && !azul.curado, azul.nombre)
}
{
  const entradas = entradasDelConstructor(vistas.Rojo, cartaDe)
  check('al constructor van las cartas del catálogo, con sus copias', entradas.reduce((k, e) => k + e.n, 0) === 40 && entradas.find((e) => e.carta.name_es === 'Zorua de N')?.n === 4)
  check('  …y las que el catálogo no encontró no van', entradasDelConstructor(vistas.Rojo, (n) => (n === 'Zorua de N' ? null : cartaDe(n))).every((e) => e.carta.name_es !== 'Zorua de N'))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La página ──')
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/></svg>'
const setsRep = [{ id: 'fk', name: 'FK', market: 'WEST', tcg_online_code: 'FK', release_date: '2025-01-01', card_count_official: 999 }]
const browser = await chromium.launch()
async function pagina({ quien = 'none', url = '/repeticiones.html', ancho = 1280, alto = 800, antes = {}, contexto = null } = {}) {
  const ctx = contexto || (await browser.newContext({ viewport: { width: ancho, height: alto } }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(({ cartas, sets, quien, antes, arq }) => {
    window.__FAKE_SESSION__ = quien
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_ARQUETIPOS__ = [arq]
    Object.assign(window, antes)
  }, { cartas: catalogo, sets: setsRep, quien, antes, arq: ZOROARK })
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  return { page, ctx, errores }
}
async function pegar(page) {
  await page.fill('#repTexto', REGISTRO)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
  })
}
// Listos = con las cartas ya encontradas en el catálogo: antes de eso el
// mazo se pinta con los nombres del registro (y luego se repinta).
const mazosListos = (page) => page.waitForFunction(() => /N's Zoroark/.test(document.getElementById('repQuienes').textContent) && document.querySelectorAll('.rep-mazo-abrir').length === 2, null, { timeout: 15000 }).then(() => true).catch(() => false)
let enlaceConstructor = null
{
  const { page, ctx, errores } = await pagina({ quien: 'user-1' })
  await pegar(page)
  check('el mazo sale al lado de cada jugador en cuanto se sabe', await mazosListos(page))
  const quienes = (await page.textContent('#repQuienes')).replace(/\s+/g, ' ').trim()
  check('  …el del catálogo con su nombre curado, y el otro deducido', quienes === "Rojo N's Zoroark contra Azul Mega Greninja ex Dragapult ex", quienes)
  check('  …con sus sprites, y su hueco reservado', (await page.$$eval('#repQuienes img.rep-sprite', (xs) => xs.length >= 3 && xs.every((x) => x.getAttribute('width') === '32' && x.getAttribute('height') === '32'))))
  const bloques = await page.$$eval('.rep-mazo', (xs) => xs.map((x) => ({ nombre: x.querySelector('.rep-mazo-nombre').textContent, de: x.querySelector('.rep-mazo-de').textContent.replace(/\s+/g, ' ').trim(), secciones: [...x.querySelectorAll('.rep-mazo-seccion h4')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()), enlace: x.querySelector('.rep-mazo-abrir')?.getAttribute('href') || null, boton: x.querySelector('.rep-mazo-abrir')?.textContent.replace(/\s+/g, ' ').trim() })))
  check('«Los mazos, por lo que se vio»: uno por jugador, el del registro primero', bloques.length === 2 && bloques[0].nombre === "N's Zoroark" && bloques[1].nombre === 'Mega Greninja ex Dragapult ex', JSON.stringify(bloques.map((b) => b.nombre)))
  check('  …dice cuántas cartas se vieron de las 60', bloques[0].de === 'Rojo se vieron 40 de sus 60 cartas' && bloques[1].de === 'Azul se vieron 33 de sus 60 cartas', `${bloques[0].de} | ${bloques[1].de}`)
  check('  …por secciones, con su cuenta', bloques[0].secciones.join(' / ') === 'Pokémon 12 / Entrenadores 21 / Energías 7', bloques[0].secciones.join(' / '))
  check('  …y dice que es un mínimo, no la lista', /lo mínimo que llevaba cada uno, y lo que no salió en la partida no está/.test(await page.textContent('.rep-mazos-nota')))
  const u = new URL(bloques[0].enlace, BASE)
  const piezas = decodificarMazo(u.searchParams.get('l'))
  check('«Abrir en el constructor» lleva las 40 cartas por su identificador, el nombre y de dónde viene', u.pathname === '/constructor' && piezas.reduce((k, x) => k + x.n, 0) === 40 && piezas.find((x) => x.id === cartaDe('Zorua de N').id)?.n === 4 && u.searchParams.get('nombre') === "N's Zoroark" && u.searchParams.get('de') === 'repeticion', bloques[0].enlace)
  check('  …y el botón dice cuántas', bloques[0].boton === 'Abrir en el constructor (40 cartas)', bloques[0].boton)
  enlaceConstructor = bloques[0].enlace

  // Guardar: los mazos van con la partida, en el orden de los jugadores.
  await page.click('[data-accion="guardar"]')
  await page.click('#repQuien input[value=""]') // aquí solo se mira: lo de Mis partidas, en la 4
  await page.click('#repFormGuardar [type=submit]')
  await page.waitForFunction(() => !document.getElementById('repDialogo').open)
  const args = await page.evaluate(() => window.__RPCS__.find((r) => r.nombre === 'repeticiones_guardar')?.args)
  check('al guardar, el mazo de cada uno va con la partida (jugador_a con mazo_a)', JSON.stringify(args?.p_mazos) === JSON.stringify(["N's Zoroark", 'Mega Greninja ex Dragapult ex']) && args.p_jugadores?.join() === 'Rojo,Azul', JSON.stringify(args?.p_mazos))
  await page.waitForFunction(() => document.querySelectorAll('.rep-item').length === 1)
  check('«Tus repeticiones» enseña el mazo de cada uno', (await page.textContent('.rep-item-mazos')).replace(/\s+/g, ' ').trim() === "N's Zoroark contra Mega Greninja ex Dragapult ex")
  check('sin errores en la página', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  // Una guardada de ANTES de los mazos: la lista no dice nada de ellos.
  const { page, ctx } = await pagina({ quien: 'user-1', antes: { __FAKE_REPETICIONES__: [{}] } })
  await page.waitForFunction(() => document.querySelectorAll('.rep-item').length === 1)
  check('una guardada sin mazos no los inventa en la lista', (await page.locator('.rep-item-mazos').count()) === 0)
  await ctx.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. El constructor abre lo que se vio ──')
{
  const { page, ctx, errores } = await pagina({ quien: 'user-1', url: enlaceConstructor })
  const aviso = await page.waitForFunction(() => document.getElementById('cmAviso')?.textContent.trim(), null, { timeout: 8000 }).then((h) => h.jsonValue()).catch(() => '')
  check('avisa de que es lo que se VIO, con cuántas cartas', /lo que se vio de este mazo en la repetición: 40 cartas, y cada cuenta es lo mínimo/.test(aviso), aviso)
  const nombre = await page.evaluate(() => document.querySelector('#cmNombre, [name="nombre"], .cm-nombre input')?.value || '')
  check('  …y el mazo se llama como su arquetipo', nombre === "N's Zoroark", nombre)
  check('sin errores en el constructor', !errores.length, errores.join(' | '))
  await ctx.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Mis partidas ──')
let partidaApuntada = null
{
  const { page, ctx, errores } = await pagina({ quien: 'user-1' })
  await page.evaluate(() => localStorage.removeItem('pokedoc-repeticion-yo'))
  await pegar(page)
  await mazosListos(page)
  await page.click('[data-accion="guardar"]')
  await page.waitForSelector('#repQuien', { timeout: 8000 })
  const opciones = await page.$$eval('#repQuien input', (xs) => xs.map((x) => `${x.value}:${x.checked}`))
  check('«¿Cuál de los dos eres tú?»: sin nombre recordado, el del registro (que es quien lo copió)', opciones.join() === 'Rojo:true,Azul:false,:false', opciones.join())
  const texto = async () => (await page.textContent('#repApuntarTexto')).trim()
  check('  …y apuntarla dice cómo: ganada, con qué y contra qué', (await texto()) === "Apuntarla en tus partidas sueltas de «Mis partidas» como ganada: N's Zoroark contra Mega Greninja ex Dragapult ex", await texto())
  await page.click('#repQuien input[value="Azul"]')
  check('  …siendo Azul, perdida y al revés', (await texto()) === "Apuntarla en tus partidas sueltas de «Mis partidas» como perdida: Mega Greninja ex Dragapult ex contra N's Zoroark", await texto())
  await page.click('#repQuien input[value=""]')
  check('  …y sin ser ninguno, no hay nada que apuntar', await page.isDisabled('#repApuntar') && !(await page.isChecked('#repApuntar')))
  await page.click('#repQuien input[value="Rojo"]')
  await page.click('#repFormGuardar [type=submit]')
  await page.waitForFunction(() => !document.getElementById('repDialogo').open)
  const filas = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'match_log').flatMap((e) => e.filas))
  partidaApuntada = filas[0]
  const id = new URL(page.url()).searchParams.get('r')
  check(
    'guardar apunta la partida: tu mazo y el suyo con las claves del torneo, ganada, en TCG Live y con su repetición',
    filas.length === 1 && partidaApuntada.user_id === 'user-1' && partidaApuntada.mi_mazo === 'a:arq-zoroark' && partidaApuntada.mi_mazo_nombre === "N's Zoroark" && partidaApuntada.rival_mazo === claveDeArquetipo({ id: null, nombre: 'Mega Greninja ex Dragapult ex' }) && partidaApuntada.resultado === 'win' && partidaApuntada.tipo === 'normal' && partidaApuntada.donde === 'TCG Live' && partidaApuntada.replay_id === id,
    JSON.stringify(partidaApuntada)
  )
  check('  …se recuerda quién eres (tu nombre de TCG Live)', (await page.evaluate(() => localStorage.getItem('pokedoc-repeticion-yo'))) === 'Rojo')
  // Otra vez la misma: ya está apuntada, y se dice.
  await page.click('[data-accion="guardar"]')
  check('abrirla otra vez dice que ya está apuntada, con el enlace', await page.waitForFunction(() => /Ya está apuntada en tus partidas sueltas de Mis partidas/.test(document.getElementById('repDialogoCuerpo').textContent), null, { timeout: 4000 }).then(() => true).catch(() => false))
  check('  …y ya no pregunta quién eres', (await page.locator('#repQuien').count()) === 0 && (await page.locator('#repDialogoCuerpo a[href="/mis-partidas"]').count()) === 1)
  await page.keyboard.press('Escape')
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  // Con OTRO nombre recordado (estás mirando la partida de alguien): no se
  // marca a nadie y no se apunta nada.
  const { page, ctx } = await pagina({ quien: 'user-1' })
  await page.evaluate(() => localStorage.setItem('pokedoc-repeticion-yo', 'Ash'))
  await pegar(page)
  await page.click('[data-accion="guardar"]')
  await page.waitForSelector('#repQuien', { timeout: 8000 })
  check('con otro nombre recordado, «Ninguno» marcado y nada que apuntar', (await page.isChecked('#repQuien input[value=""]')) && (await page.isDisabled('#repApuntar')))
  await page.keyboard.press('Escape')
  // Y una partida sin final no se puede apuntar: no se sabe quién ganó.
  await page.click('[data-accion="otra"]')
  await page.fill('#repTexto', REGISTRO.split('\n').slice(0, 120).join('\n'))
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.click('[data-accion="guardar"]')
  // Desde la 553 no se rinde: pregunta cómo acabó (lo prueba la 553 entera).
  await page.waitForSelector('#repQuien', { timeout: 8000 })
  check('un registro sin final pregunta cómo acabó (y dice por qué)', (await page.locator('#repResultado').count()) === 1 && /no dice quién ganó/.test(await page.textContent('#repDialogoCuerpo')))
  await ctx.close()
}
{
  // Apuntarla dos veces: la base no deja (índice único) y la página lo dice bien.
  const { page, ctx } = await pagina({ quien: 'user-1' })
  await page.evaluate(() => localStorage.setItem('pokedoc-repeticion-yo', 'Rojo'))
  await pegar(page)
  await mazosListos(page)
  await page.click('[data-accion="guardar"]')
  await page.click('#repFormGuardar [type=submit]')
  await page.waitForFunction(() => !document.getElementById('repDialogo').open)
  // La misma partida, pegada otra vez (la página no sabe que ya está).
  await page.click('[data-accion="otra"]')
  await page.fill('#repTexto', REGISTRO)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await mazosListos(page)
  await page.click('[data-accion="guardar"]')
  await page.click('#repFormGuardar [type=submit]')
  const toast = await page.waitForFunction(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).find((t) => /ya estaba/.test(t)) || '', null, { timeout: 4000 }).then((h) => h.jsonValue()).catch(() => '')
  const apuntadas = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'match_log').length)
  check('guardar otra vez la misma NO la apunta dos veces, y lo dice', apuntadas === 1 && /ya estaba en «Mis partidas»/.test(toast), `${apuntadas} · ${toast}`)
  await ctx.close()
}
{
  // /mis-partidas: la fila que vino de una repetición lleva «Ver la
  // repetición»; la apuntada a mano, no.
  const { page, ctx, errores } = await pagina({ quien: 'user-1', url: '/mis-partidas.html', antes: { __FAKE_PARTIDAS__: [{}, { replay_id: 'abcdef1234', mi_mazo_nombre: "N's Zoroark" }] } })
  await page.click('[data-vista="sueltas"]')
  await page.waitForSelector('.partidas-fila', { timeout: 8000 })
  const enlaces = await page.$$eval('.partidas-fila a[href^="/repeticiones?r="]', (xs) => xs.map((x) => `${x.textContent.trim()}|${x.getAttribute('href')}|${x.closest('.partidas-fila').textContent.includes("N's Zoroark")}`))
  check('la que vino de una repetición lleva «Ver la repetición», a su enlace (y solo ella)', enlaces.length === 1 && enlaces[0] === "Ver la repetición|/repeticiones?r=abcdef1234|true", enlaces.join(' '))
  check('sin errores en Mis partidas', !errores.length, errores.join(' | '))
  await ctx.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Lo estático ──')
{
  const JS = leer('js/repeticiones.js')
  check('el catálogo de arquetipos y la Pokédex se bajan al hacer falta (no con la página)', !/^import .*torneos\/arquetipos\.js/m.test(JS) && !/^import .*sprites-pokemon\.js/m.test(JS) && /import\('\.\/torneos\/arquetipos\.js'\)/.test(JS))
  check('mazos.js no toca el DOM ni la base', !/document\.|supabase/.test(leer('js/repeticiones/mazos.js').replace(/^\s*\/\/.*$/gm, '')))
  const SQL = leer('supabase-migration-repeticiones.sql')
  check('los mazos los pone la FUNCIÓN al guardar: nadie puede escribirlos a mano', /grant update \(titulo, compartida, notas\) on table public\.replays/.test(SQL) && /p_mazos text\[\] default null/.test(SQL))
  check('la vieja de seis argumentos se quita (dos con el mismo nombre se pisan por la API)', /drop function if exists public\.repeticiones_guardar\(text, text, text\[\], text, int, boolean\);/.test(SQL))
  check('la misma repetición no se apunta dos veces en Mis partidas (índice único)', /create unique index if not exists match_log_repeticion on public\.match_log \(user_id, replay_id\) where replay_id is not null/.test(SQL))
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
