// Tanda 592 — «tú contra ti», escrita como la escribe TCG Live.
//
// PINGU: «estaría muy bien poder copiar el log de una partida que juegues tú
// contra ti mismo: que al final te deje copiar el log de eso para guardar la
// repetición».
//
//   1. El motor (constructor/diario.js + la mesa), en Node: decenas de
//      partidas jugadas al azar, y en CADA jugada el registro se lee entero
//      (sin una línea sin entender) y la repetición tiene las mismas cartas
//      en la mano, el mazo, el descarte y la banca que el laboratorio; al
//      final, el mismo activo, el mismo daño y los mismos premios.
//   2. Las piezas: la preparación como la escribe TCG Live, los nombres en
//      una palabra, deshacer también deshace el registro, buscar caminos no
//      escribe nada, y las pistas «◦» solo las lee nuestro lector.
//   3. La pantalla: «Copiar el registro» y «Verla como repetición».
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const M = await import(`${RAIZ}/js/constructor/partida.js`)
const D = await import(`${RAIZ}/js/constructor/diario.js`)
const { EFECTOS } = await import(`${RAIZ}/js/constructor/efectos.js`)
const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
const { fotos, arriba } = await import(`${RAIZ}/js/repeticiones/estado.js`)
const C = await import(`${RAIZ}/js/constructor/caminos.js`)
const { plano } = await import(`${RAIZ}/js/constructor/nucleo.js`)
const { Mesa, esPokemon, faseDe, NoSePuede } = M

const FILAS = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
const fila = (n) => FILAS.find((x) => x.name === n)
const mazo = (lista) => lista.map(([n, nombre]) => ({ carta: fila(nombre), n }))
const DRAGAPULT = [
  [4, 'Dreepy'], [4, 'Drakloak'], [3, 'Dragapult ex'], [2, 'Budew'], [1, 'Fezandipiti ex'], [1, 'Meowth ex'], [2, 'Munkidori'], [1, 'Moltres'],
  [4, 'Buddy-Buddy Poffin'], [4, 'Poké Pad'], [4, "Lillie's Determination"], [3, "Boss's Orders"], [3, 'Night Stretcher'], [3, 'Ultra Ball'],
  [4, 'Crushing Hammer'], [2, 'Crispin'], [2, 'Risky Ruins'], [1, 'Dawn'], [1, 'Judge'], [1, "Rosa's Encouragement"], [1, 'Special Red Card'], [1, 'Unfair Stamp'],
  [3, 'Fire Energy'], [3, 'Psychic Energy'], [2, 'Darkness Energy'],
]

// Una partida al azar (con su semilla), comprobando el registro tras cada
// jugada. Devuelve el primer desajuste o null.
async function partidaAlAzar(semilla, { turnos = 40, nombres = ['Rojo', 'Azul'] } = {}) {
  let rnd = semilla
  const r = () => ((rnd = (rnd * 1103515245 + 12345) >>> 0) / 2 ** 32)
  const ui = {
    async cartas(o) { const op = o.elegibles || o.opciones; const max = o.max ?? o.min ?? 1; return op.slice(0, Math.max(o.min || 0, Math.min(max, 1 + Math.floor(r() * 2)))) },
    async pokemon(o) { return o.opciones.slice(0, Math.max(1, o.min || 1)) },
    async confirmar() { return r() < 0.7 },
    async opcion(o) { return o.opciones[Math.floor(r() * o.opciones.length)].id },
    async numero(o) { return o.valor },
    async premios(o) { return o.partida.s.premios.slice(0, o.n) },
    async repartir(o) { return { [o.opciones[0]]: o.total } },
  }
  const mesa = new Mesa({ mazos: [mazo(DRAGAPULT), mazo(DRAGAPULT)], nombres, efectos: EFECTOS, semilla, empieza: 'azar' })
  mesa.repartir()
  for (let k = 0; k < 2; k++) {
    const p = mesa.actual
    const basicos = p.s.mano.filter((x) => esPokemon(p.carta(x)) && faseDe(p.carta(x)) === 0)
    await mesa.accion(() => p.colocar(basicos[0], 'activo'), ui)
    if (basicos[1]) await mesa.accion(() => p.colocar(basicos[1], 'banca'), ui)
    await mesa.accion(() => mesa.listo(ui), ui)
  }
  let desajuste = null
  let jugadas = 0
  const comparar = () => {
    if (desajuste) return
    jugadas++
    const l = leerRegistro(mesa.registroLive)
    if (l.sinLeer.length) return (desajuste = `línea sin entender: ${l.sinLeer[0]}`)
    const fin = fotos(l).at(-1)
    mesa.jugadores.forEach((p, i) => {
      if (desajuste) return
      const x = fin.jugadores[mesa.nombresDiario[i]]
      const real = { mano: p.s.mano.length, mazo: p.s.mazo.length, descarte: p.s.descarte.length, banca: p.s.banca.length }
      const rep = { mano: x.mano, mazo: x.mazo, descarte: x.descarte.length, banca: x.banca.length }
      const mal = Object.keys(real).filter((k) => real[k] !== rep[k])
      if (mal.length) desajuste = `${mesa.nombresDiario[i]} tras la jugada ${jugadas}: ${mal.map((k) => `${k} ${real[k]}/${rep[k]}`).join(', ')}`
    })
  }
  const intentar = async (fn) => {
    try {
      await mesa.accion(fn, ui)
      comparar()
    } catch (e) {
      if (!(e instanceof NoSePuede)) desajuste = desajuste || `error: ${e?.message || e}`
    }
  }
  let t = 0
  while (!mesa.terminada && t < turnos && !desajuste) {
    const p = mesa.actual
    for (let paso = 0; paso < 12 && !mesa.terminada; paso++) {
      const u = p.s.mano[Math.floor(r() * p.s.mano.length)]
      if (!u) break
      const ops = p.opcionesDeMano(u) || []
      const op = ops[Math.floor(r() * ops.length)]
      if (!op || op.no) continue
      await intentar(() => p.jugarDeMano(u, op, ui))
    }
    for (const sl of [...p.enJuego]) if (p.habilidadDe(sl) && !p.motivoNoHabilidad(sl) && r() < 0.6) await intentar(() => p.usarHabilidad(sl, ui))
    if (r() < 0.15 && p.s.banca.length) await intentar(() => p.retirar(ui))
    if (!mesa.terminada && p.s.activo) {
      const at = p.ataquesDe(p.s.activo).find((a) => !p.motivoNoAtacar(p.s.activo, a.ataque))
      if (at) await intentar(() => p.atacar(p.s.activo, at.i, ui))
    }
    if (!mesa.terminada) await intentar(() => mesa.pasarTurno(ui))
    t++
  }
  // Y al final, además, lo que se ve de cada uno.
  if (!desajuste) {
    const fin = fotos(leerRegistro(mesa.registroLive)).at(-1)
    mesa.jugadores.forEach((p, i) => {
      if (desajuste) return
      const x = fin.jugadores[mesa.nombresDiario[i]]
      const act = p.s.activo
      const real = { activo: act ? D.nombreEnElRegistro(p.carta(act.cartas.at(-1))) : null, danio: act?.danio ?? null, premios: p.s.premios.length, energias: act?.energias.length ?? null }
      const rep = { activo: x.activo ? arriba(x.activo) : null, danio: x.activo?.danio ?? null, premios: x.premios, energias: x.activo?.energias.length ?? null }
      const mal = Object.keys(real).filter((k) => real[k] !== rep[k])
      if (mal.length) desajuste = `${mesa.nombresDiario[i]} al final: ${mal.map((k) => `${k} ${real[k]}/${rep[k]}`).join(', ')}`
    })
  }
  return { mesa, desajuste, jugadas }
}

console.log('\n── 1. Decenas de partidas, jugada a jugada ──')
{
  const malas = []
  const registros = []
  let jugadas = 0
  let terminadas = 0
  for (let semilla = 1; semilla <= 40; semilla++) {
    const r = await partidaAlAzar(semilla)
    registros.push(r.mesa.registroLive)
    jugadas += r.jugadas
    if (r.mesa.terminada) terminadas++
    if (r.desajuste) malas.push(`[${semilla}] ${r.desajuste}`)
  }
  check(`40 partidas: en cada jugada la repetición tiene las mismas cartas en cada sitio que el laboratorio (${jugadas} jugadas)`, malas.length === 0, malas.slice(0, 3).join(' | '))
  check('  …y casi todas terminan', terminadas >= 30, `${terminadas} de 40`)
  check('  …con los ataques contados con su daño («ha infligido N puntos»)', registros.some((t) => /ha infligido \d+ puntos de daño usando/.test(t)))
  // Mirar arriba y poner una debajo (Drakloak) no es barajar: decirlo
  // sería inventarse una jugada.
  const inventadas = registros.filter((t) => /ha usado Recon Directive\.\n(?:- [^\n]*\n)*- \S+ ha barajado su baraja\./.test(t))
  check('  …y Orden de Búsqueda de Drakloak NO «baraja la baraja»', registros.some((t) => /ha usado Recon Directive/.test(t)) && inventadas.length === 0, inventadas.length)
}

console.log('\n── 2. Las piezas ──')
{
  const { mesa } = await partidaAlAzar(8, { turnos: 2 })
  const lineas = mesa.registroLive.split('\n')
  check('empieza como TCG Live: «Preparación», la moneda y quién empieza', lineas[0] === 'Preparación' && /ha elegido cara para el lanzamiento de moneda inicial\.$/.test(lineas[1]) && /ha ganado el lanzamiento de moneda\.$/.test(lineas[2]) && /ha decidido empezar en primer lugar\.$/.test(lineas[3]), lineas.slice(0, 4).join(' | '))
  const texto = mesa.registroLive
  check('  …las manos con sus cartas, y los mulligans ENSEÑADOS', /ha robado 7 cartas de la mano inicial\.\n- 7 cartas robadas\.\n {3}• /.test(texto) && /ha declarado un mulligan\.\n- Cartas mostradas por el mulligan número 1\n {3}• /.test(texto))
  check('  …las cartas de más por los mulligans, nombradas (y contadas una vez)', /ha robado (una carta|\d+ cartas) más porque \S+ ha declarado al menos un mulligan\./.test(texto))
  // La mano inicial son SIETE cartas, también las que ya se han puesto en
  // juego: si faltan, la repetición las saca de la nada al colocarlas.
  const manos = [...texto.matchAll(/ha robado 7 cartas de la mano inicial\.\n- 7 cartas robadas\.\n {3}• ([^\n]*)/g)].map((m) => m[1].split(', ').length)
  check('  …y cada mano inicial lista sus 7 cartas (las que se ponen en juego, también)', manos.length >= 2 && manos.every((n) => n === 7), manos.join(','))
  check('  …lo que cada uno pone en juego, y «Turno de»', /ha puesto en juego a .+ en el Puesto Activo\./.test(texto) && /\n\nTurno de (Rojo|Azul)\n/.test(texto))
  const ls = leerRegistro(texto)
  check('  …y se lee con los dos jugadores', ls.jugadores.join() === 'Rojo,Azul' || ls.jugadores.join() === 'Azul,Rojo', ls.jugadores.join())
}
{
  check('los nombres, en UNA palabra (el lector parte las frases así)', JSON.stringify(D.nombresParaElRegistro(['Jugador 1', 'Jugador 2'])) === '["Jugador1","Jugador2"]' && JSON.stringify(D.nombresParaElRegistro(['Ana', 'Ana'])) === '["Ana","Jugador2"]' && JSON.stringify(D.nombresParaElRegistro(['', 'Él.'])) === '["Jugador1","Él"]')
  check('las energías básicas, «Energía X Básica»', D.nombreEnElRegistro({ name: 'Psychic Energy', name_es: 'Energía Psíquica', category: 'Energy', energy_type: 'Basic' }) === 'Energía Psíquica Básica', D.nombreEnElRegistro({ name: 'Psychic Energy', name_es: 'Energía Psíquica', category: 'Energy', energy_type: 'Basic' }))
}
{
  // Deshacer deshace también el registro.
  const { mesa } = await partidaAlAzar(11, { turnos: 3 })
  const antes = mesa.m.diario.length
  const p = mesa.actual
  await mesa.accion(() => mesa.pasarTurno({ pokemon: async (o) => o.opciones.slice(0, 1), premios: async (o) => o.partida.s.premios.slice(0, o.n), confirmar: async () => false }), {})
  const tras = mesa.m.diario.length
  mesa.deshacer()
  check('deshacer una jugada quita también sus líneas del registro', tras > antes && mesa.m.diario.length === antes, `${antes} → ${tras} → ${mesa.m.diario.length}`)
  check('  …(y era el turno del de antes)', mesa.actual === p)
}
{
  // Buscar caminos juega MILES de jugadas de mentira: ninguna se escribe.
  const { mesa } = await partidaAlAzar(12, { turnos: 3 })
  const antes = mesa.registroLive
  const p = mesa.actual
  await C.buscarCaminos({ partida: p, objetivo: (c) => c?.name === 'Dragapult ex', muestras: 60 })
  check('buscar caminos con mesa no escribe nada en el registro', mesa.registroLive === antes)
}
{
  // Las pistas «◦» las lee nuestro lector y no inventan nada en uno de TCG Live.
  const base = ['Preparación', 'Rojo ha decidido empezar en primer lugar.', 'Rojo ha robado 7 cartas de la mano inicial.', 'Azul ha robado 7 cartas de la mano inicial.', 'Rojo ha puesto en juego a Dreepy en el Puesto Activo.', 'Rojo ha puesto en juego a Dreepy en la Banca.', 'Azul ha puesto en juego a Budew en el Puesto Activo.', '', 'Turno de Rojo', 'Rojo ha robado Energía Psíquica Básica.']
  const con = leerRegistro([...base, 'Rojo ha unido Energía Psíquica Básica al Dreepy en la Banca.', '   ◦ lugar 2'].join('\n'))
  const fin = fotos(con).at(-1).jugadores.Rojo
  check('«◦ lugar 2»: la energía va al SEGUNDO Dreepy (el de la banca), no al primero que case', con.sinLeer.length === 0 && fin.banca[0].energias.length === 1 && fin.activo.energias.length === 0)
  const sin = fotos(leerRegistro([...base, 'Rojo ha unido Energía Psíquica Básica al Dreepy en el Puesto Activo.'].join('\n'))).at(-1).jugadores.Rojo
  check('  …y sin pista, la regla de siempre', sin.activo.energias.length === 1)
  const curar = fotos(leerRegistro([...base, 'El Dreepy de Rojo ha recibido 30 puntos de daño.', 'El Dreepy de Rojo se ha curado 20 puntos de daño.'].join('\n'))).at(-1).jugadores.Rojo
  check('«se ha curado» baja el daño (antes una repetición solo podía subirlo)', curar.activo.danio === 10, curar.activo.danio)
  const baraja = leerRegistro([...base, 'Rojo ha jugado Crispin.', '- Rojo ha unido Energía Psíquica Básica al Dreepy en el Puesto Activo.', '   ◦ de la baraja'].join('\n'))
  check('«◦ de la baraja»: la energía que une un efecto sale del mazo aunque haya una igual en el descarte', baraja.eventos.find((e) => e.tipo === 'unir')?.desde === 'mazo')
}

console.log('\n── 3. La pantalla ──')
const browser = await chromium.launch()
const entradas = mazo(DRAGAPULT)
const cartas = [...new Map(entradas.map((e) => [e.carta.id, { ...e.carta, market: 'WEST', name_key: plano(e.carta.name), image_path: null }])).values()]
const sets = [...new Set(cartas.map((c) => c.set_id))].map((id) => ({ id, name: id.toUpperCase(), market: 'WEST', tcg_online_code: id.toUpperCase(), release_date: '2025-01-01', card_count_official: 200 }))
const lista = entradas.map((e) => `${e.n}~${e.carta.id}`).join('_')
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.abort())
  await page.addInitScript(({ cartas, sets }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    let s = 42
    Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    localStorage.setItem('pokedoc-laboratorio', JSON.stringify({ opciones: { primero: 'segundo', estricta: true, rival: 'ex', banca: 2, modo: 'muneco' }, panelAbierto: true, panelPestania: 'registro' }))
  }, { cartas, sets })
  await page.goto(`${BASE}/constructor?l=${lista}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.click('#cmProbar')
  await page.waitForSelector('.lab:not([hidden]) .lab-mesa', { timeout: 6000 }).catch(() => {})
  await page.click('[data-modo="mesa"]')
  await page.waitForTimeout(200)
  await page.click('[data-cambiar-mazo="1"]')
  await page.waitForTimeout(150)
  await page.click('#labDialogo [data-fuente="este"]')
  await page.click('#labDialogo [data-usar="este"]')
  await page.waitForTimeout(200)
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(300)
  check('en la preparación todavía no se ofrece copiar (no hay partida)', (await page.locator('[data-accion="copiar-registro"]').count()) === 0)
  for (let k = 0; k < 2; k++) {
    await page.click('[data-accion="auto"]')
    await page.click('[data-accion="empezar"]')
    await page.waitForTimeout(250)
  }
  for (let k = 0; k < 2; k++) if (await page.locator('#labVelo:not(.hidden) .lab-numero').count()) await page.click('#labDialogo [data-dlg="ok"]')
  // Unos cuantos turnos pasando.
  for (let k = 0; k < 4; k++) {
    await page.click('[data-accion="pasar"]')
    await page.waitForTimeout(200)
    if (await page.locator('#labVelo:not(.hidden)').count()) await page.keyboard.press('Escape')
  }
  await page.click('[data-panel-pestania="registro"]').catch(() => null)
  await page.waitForTimeout(200)
  check('en la pestaña «Registro» del panel: «Copiar el registro» y «Verla como repetición»', (await page.locator('#labPanel [data-accion="copiar-registro"]').count()) === 1 && (await page.locator('#labPanel [data-accion="ver-repeticion"]').count()) === 1)
  await page.click('#labPanel [data-accion="copiar-registro"]')
  await page.waitForTimeout(300)
  const copiado = await page.evaluate(() => navigator.clipboard.readText())
  const l = leerRegistro(copiado)
  check('«Copiar» deja el registro de TCG Live en el portapapeles, y se lee entero', copiado.startsWith('Preparación\n') && l.sinLeer.length === 0 && l.eventos.filter((e) => e.tipo === 'turno').length >= 4, `${l.sinLeer[0] || ''} ${copiado.slice(0, 80)}`)
  const [nueva] = await Promise.all([ctx.waitForEvent('page'), page.click('#labPanel [data-accion="ver-repeticion"]')])
  await nueva.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.abort())
  const abre = await nueva.waitForSelector('#repSala:not(.hidden)', { timeout: 10000 }).then(() => true).catch(() => false)
  check('«Verla como repetición» la abre en Repeticiones, en otra pestaña', abre && /\/repeticiones/.test(nueva.url()), nueva.url())
  check('  …la misma partida (el mismo texto)', (await nueva.inputValue('#repTexto').catch(() => '')) === copiado)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
