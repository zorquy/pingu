// Tanda 553 — fuera «Importar varias», y al guardar una repetición eliges
// quién eres y se apunta en tus partidas sueltas.
//
// PINGU: «lo de importar varias a la vez no lo veo, mejor haz que en las
// repeticiones que se guarden tú puedas elegir cuál de los dos jugadores
// eres y luego se guarde el resultado y los arquetipos en tu perfil en
// partidas sueltas».
//
//   1. El final que no empieza por el nombre («El rival no tiene Pokémon en
//      juego. Azul ha ganado.»), en Node: también dice quién ganó.
//   2. «Importar varias» ya no está, ni su módulo.
//   3. La ventana de guardar: cada jugador con el mazo que se le vio y
//      quién ganó; ESPERA a los mazos si aún no están (son lo que se
//      apunta); y lo apunta en las partidas sueltas con el resultado desde
//      quien elegiste.
//   4. Un registro que no dice quién ganó: se pregunta cómo acabó, y sin
//      decirlo no se apunta nada.
//   5. /mis-partidas → Partidas sueltas la enseña, con su repetición.
import { readFileSync, existsSync } from 'node:fs'
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
const REGISTRO = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8').replace(/\r/g, '')
const LINEAS = REGISTRO.trim().split('\n')
// La misma partida, acabada de otra manera: sin premios que coger.
const OTRO_FINAL = [...LINEAS.slice(0, -1), 'El rival no tiene Pokémon en juego. Azul ha ganado.'].join('\n')
// Y cortada antes del final.
const SIN_FINAL = LINEAS.slice(0, 120).join('\n')

console.log('\n── 1. Un final con la razón delante ──')
{
  const fin = leerRegistro(OTRO_FINAL).eventos.filter((e) => e.tipo === 'fin')
  check('«El rival no tiene Pokémon en juego. Azul ha ganado.» dice que ganó Azul', fin.length === 1 && fin[0].ganador === 'Azul', JSON.stringify(fin))
  check('  …y el de siempre, por premios, sigue igual', leerRegistro(REGISTRO).eventos.find((e) => e.tipo === 'fin')?.porque === 'premios')
  check('  …y uno cortado sigue sin final', !leerRegistro(SIN_FINAL).eventos.some((e) => e.tipo === 'fin'))
}

console.log('\n── 2. Fuera «Importar varias» ──')
check('ni el botón, ni el módulo, ni sus estilos', !/repVarias/.test(leer('repeticiones.html')) && !existsSync(`${RAIZ}/js/repeticiones/varias.js`) && !/varias\.js|dialogoVarias/.test(leer('js/repeticiones.js')) && !/rep-varias/.test(leer('css/repeticiones.css')))

// ── El catálogo de la 494 ──
const INGLES = { 'Zorua de N': "N's Zorua", 'Zoroark ex de N': "N's Zoroark ex", 'Darumaka de N': "N's Darumaka", 'Reshiram de N': "N's Reshiram", 'Zekrom de N': "N's Zekrom", 'Mega-Greninja ex': 'Mega Greninja ex', 'Más PP de N': "N's PP Up", 'Energía Oscura': 'Darkness Energy', 'Órdenes de Jefes': "Boss's Orders" }
const lectura = leerRegistro(REGISTRO)
const enJuego = new Set()
for (const s of fotos(lectura)) for (const p of Object.values(s.jugadores)) for (const x of [p.activo, ...p.banca].filter(Boolean)) x.cartas.forEach((c) => enJuego.add(c))
const nombres = new Set()
for (const e of lectura.eventos) for (const k of ['carta', 'pokemon', 'objetivo', 'sube', 'baja', 'a', 'de']) if (e[k] && e[k] !== '?') nombres.add(e[k])
for (const e of lectura.eventos) for (const c of e.cartas || []) nombres.add(c)
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
const ZOROARK = { id: 'arq-zoroark', nombre: "N's Zoroark", iconos: [{ nombre: "N's Zoroark ex" }], requiere: [{ nombres: ["N's Zoroark ex"] }], activo: true }
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/></svg>'
const browser = await chromium.launch()
async function pagina({ quien = 'user-1', url = '/repeticiones.html', antes = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(({ cartas, quien, antes, arq }) => {
    window.__FAKE_SESSION__ = quien
    window.__FAKE_SETS__ = [{ id: 'fk', name: 'FK', market: 'WEST', tcg_online_code: 'FK', release_date: '2025-01-01', card_count_official: 999 }]
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_ARQUETIPOS__ = [arq]
    try {
      localStorage.removeItem('pokedoc-repeticion-yo')
    } catch {}
    Object.assign(window, antes)
  }, { cartas: catalogo, quien, antes, arq: ZOROARK })
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  return { page, ctx, errores }
}
async function pegar(page, texto = REGISTRO) {
  await page.fill('#repTexto', texto)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
  })
}
const apuntadas = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'match_log').flatMap((e) => e.filas))
const opciones = (page) => page.$$eval('#repQuien .rep-ritmo-opcion', (xs) => xs.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))

console.log('\n── 3. Quién eres, con el mazo de cada uno ──')
{
  // El catálogo de arquetipos llega TARDE: la ventana se abre antes de que
  // los mazos estén, y tiene que esperarlos (son lo que se apunta).
  const { page, ctx, errores } = await pagina({ antes: { __FAKE_RETRASO__: { tcg_archetypes: 2500 } } })
  check('en la página ya no hay «Importar varias»', (await page.locator('#repVarias').count()) === 0)
  await pegar(page)
  await page.click('[data-accion="guardar"]')
  const espera = await page.textContent('#repQuienCaja')
  check('mientras se deducen los mazos, lo dice (y no enseña nada que apuntar aún)', /Mirando los mazos/.test(espera) && (await page.locator('#repApuntar').count()) === 0, espera)
  await page.waitForSelector('#repQuien', { timeout: 10000 }).catch(() => null)
  const ops = await opciones(page)
  check('«¿Cuál de los dos eres tú?»: cada uno con su mazo, y quién ganó', ops[0] === "Rojo N's Zoroark ganó" && ops[1] === 'Azul Mega Greninja ex Dragapult ex' && /Ninguno/.test(ops[2]), ops.join(' | '))
  const texto = async () => (await page.textContent('#repApuntarTexto')).trim()
  check('  …y lo que se apunta, en las partidas sueltas: ganada, con qué y contra qué', (await texto()) === "Apuntarla en tus partidas sueltas de «Mis partidas» como ganada: N's Zoroark contra Mega Greninja ex Dragapult ex", await texto())
  await page.click('#repQuien input[value="Azul"]')
  check('  …siendo Azul, perdida y al revés', (await texto()) === "Apuntarla en tus partidas sueltas de «Mis partidas» como perdida: Mega Greninja ex Dragapult ex contra N's Zoroark", await texto())
  await page.click('#repFormGuardar [type=submit]')
  await page.waitForFunction(() => !document.getElementById('repDialogo').open, null, { timeout: 8000 }).catch(() => null)
  const [fila] = await apuntadas(page)
  check('guarda la partida DESDE quien elegiste: perdida, su mazo y el del rival', fila?.resultado === 'loss' && fila.mi_mazo_nombre === 'Mega Greninja ex Dragapult ex' && fila.rival_mazo_nombre === "N's Zoroark" && fila.mi_mazo !== 'sin-mazo' && fila.rival_mazo === 'a:arq-zoroark' && fila.tipo === 'normal' && fila.replay_id, JSON.stringify(fila))
  const toast = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' '))
  check('  …y lo dice', /Guardada y apuntada en tus partidas sueltas/.test(toast), toast)
  check('  …y recuerda quién eres', (await page.evaluate(() => localStorage.getItem('pokedoc-repeticion-yo'))) === 'Azul')
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  // Un final que no empieza por el nombre: se sabe quién ganó igual.
  const { page, ctx } = await pagina()
  await pegar(page, OTRO_FINAL)
  await page.click('[data-accion="guardar"]')
  await page.waitForSelector('#repQuien', { timeout: 10000 }).catch(() => null)
  check('con «…no tiene Pokémon en juego. Azul ha ganado.», gana Azul y no se pregunta el resultado', (await page.locator('#repResultado').count()) === 0 && /Azul .*ganó/.test((await opciones(page))[1] || ''), (await opciones(page)).join(' | '))
  await ctx.close()
}

console.log('\n── 4. Sin final: se pregunta cómo acabó ──')
{
  const { page, ctx } = await pagina()
  await pegar(page, SIN_FINAL)
  await page.click('[data-accion="guardar"]')
  await page.waitForSelector('#repQuien', { timeout: 10000 }).catch(() => null)
  check('dice que el registro no dice quién ganó y pregunta cómo acabó', (await page.locator('#repResultado input').count()) === 3 && /no dice quién ganó/.test(await page.textContent('#repResultado legend')))
  check('  …y, siendo Rojo pero sin decir cómo acabó, no hay nada que apuntar', (await page.isChecked('#repQuien input[value="Rojo"]')) && (await page.isDisabled('#repApuntar')) && /dinos cómo acabó/.test(await page.textContent('#repApuntarTexto')))
  await page.click('#repResultado input[value="loss"]')
  check('  …al decir «La perdí», se puede y se marca sola', !(await page.isDisabled('#repApuntar')) && (await page.isChecked('#repApuntar')) && /como perdida/.test(await page.textContent('#repApuntarTexto')))
  await page.click('#repResultado input[value="draw"]')
  check('  …y con «Empate», empate', /como empate/.test(await page.textContent('#repApuntarTexto')))
  await page.click('#repQuien input[value=""]')
  check('  …y sin ser ninguno, otra vez nada', (await page.isDisabled('#repApuntar')) && !(await page.isChecked('#repApuntar')))
  await page.click('#repQuien input[value="Rojo"]')
  await page.click('#repFormGuardar [type=submit]')
  await page.waitForFunction(() => !document.getElementById('repDialogo').open, null, { timeout: 8000 }).catch(() => null)
  const [fila] = await apuntadas(page)
  check('guarda el resultado que se dijo (empate)', fila?.resultado === 'draw' && fila.mi_mazo_nombre === "N's Zoroark", JSON.stringify(fila))
  await ctx.close()
}
{
  // Sin final y sin decir cómo acabó: se guarda, pero no se apunta nada.
  const { page, ctx } = await pagina()
  await pegar(page, SIN_FINAL)
  await page.click('[data-accion="guardar"]')
  await page.waitForSelector('#repQuien', { timeout: 10000 }).catch(() => null)
  await page.click('#repFormGuardar [type=submit]')
  await page.waitForFunction(() => !document.getElementById('repDialogo').open, null, { timeout: 8000 }).catch(() => null)
  const guardada = await page.evaluate(() => window.__RPCS__.some((r) => r.nombre === 'repeticiones_guardar'))
  check('sin decir cómo acabó, se guarda pero NO se apunta (un resultado inventado ensucia tus números)', guardada && (await apuntadas(page)).length === 0)
  await ctx.close()
}

console.log('\n── 5. En tus partidas sueltas ──')
{
  const fila = { id: 'p-1', user_id: 'user-1', mi_mazo: 'a:arq-zoroark', rival_mazo: 'sin-mazo', mi_mazo_nombre: "N's Zoroark", rival_mazo_nombre: 'Mega Greninja ex Dragapult ex', resultado: 'win', tipo: 'normal', donde: 'TCG Live', replay_id: 'rep0000001', fecha: '2026-10-04' }
  const { page, ctx, errores } = await pagina({ url: '/mis-partidas.html', antes: { __FAKE_PARTIDAS__: [fila] } })
  await page.click('[data-vista="sueltas"]').catch(() => null)
  await page.waitForSelector('#partidasLista .partidas-fila', { timeout: 8000 }).catch(() => null)
  const t = (await page.textContent('#partidasLista').catch(() => '')).replace(/\s+/g, ' ')
  check('/mis-partidas → Partidas sueltas la enseña con los dos mazos', /N's Zoroark/.test(t) && /Mega Greninja ex Dragapult ex/.test(t) && /TCG Live/.test(t), t.slice(0, 200))
  check('  …y su «Ver la repetición»', (await page.getAttribute('#partidasLista a[href^="/repeticiones?r="]', 'href').catch(() => null)) === '/repeticiones?r=rep0000001')
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
