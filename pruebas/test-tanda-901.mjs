// Tanda 901 — el laboratorio y una evolución cuya carta no dice de qué
// evoluciona. Un usuario (por Telegram a PINGU, con capturas): «cuando
// intenté evolucionar un Weedle a Kakuna no me dejó: "Kakuna: No tienes en
// juego nada de lo que evolucione Kakuna"», con dos Weedle en la mesa.
// La fila de ese Kakuna venía sin `evolve_from`, y `evolucionaDe` lo
// tomaba por «no evoluciona de nada». Ahora: (1) lo que no se sabe no se
// afirma como un no —se ofrecen los Pokémon en juego y se dice—, y (2)
// `detallesDeJuego` rellena `evolve_from` desde otra impresión del mismo
// nombre que sí lo diga.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. El motor, con un Kakuna que no dice de qué evoluciona ──')
{
  const M = await import(`${RAIZ}/js/constructor/partida.js`)
  const { EFECTOS } = await import(`${RAIZ}/js/constructor/efectos.js`)
  const { Mesa, esPokemon, faseDe, evolucionaDe, evolucionDesconocida } = M
  const FILAS = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
  const fila = (n) => { const f = FILAS.find((x) => x.name === n); if (!f) throw new Error(`falta ${n}`); return f }
  const kakunaMudo = { ...fila('Kakuna'), id: 'kakuna-mudo', evolve_from: null }
  const weedle = fila('Weedle'), dunsparce = fila('Dunsparce'), kakuna = fila('Kakuna')

  check('`evolucionaDe`: con la carta muda contesta «no se sabe» (null), no «no»', evolucionaDe(kakunaMudo, weedle) === null && evolucionaDe(kakunaMudo, dunsparce) === null)
  check('  …con la carta curada, sí o no de verdad', evolucionaDe(kakuna, weedle) === true && evolucionaDe(kakuna, dunsparce) === false)
  check('  …y un básico sin `evolve_from` no es «no se sabe»: es básico', evolucionaDe(weedle, dunsparce) === false && !evolucionDesconocida(weedle) && evolucionDesconocida(kakunaMudo))

  const relleno = [[20, 'Poké Pad'], [20, 'Grass Energy']]
  const mazo = (lista) => [...lista, ...relleno].map(([n, c]) => ({ carta: typeof c === 'string' ? fila(c) : c, n }))
  const ui = { async cartas(o) { return (o.elegibles || o.opciones).slice(0, 1) }, async pokemon(o) { return o.opciones.slice(0, 1) }, async confirmar() { return true }, async opcion(o) { return o.opciones.find((x) => !x.no).id }, async numero(o) { return o.valor }, async repartir(o) { return { [o.opciones[0]]: o.total } }, async premios(o) { return (o.partida || mesa.actual).s.premios.slice(0, o.n) } }
  const mesa = new Mesa({ mazos: [mazo([[4, 'Weedle'], [4, kakunaMudo]]), mazo([[4, 'Dunsparce']])], efectos: EFECTOS, semilla: 7, empieza: 0 })
  mesa.repartir()
  for (let k = 0; k < 2; k++) {
    const p = mesa.actual
    let b = p.s.mano.filter((x) => esPokemon(p.carta(x)) && faseDe(p.carta(x)) === 0)
    if (!b.length) { const x = p.s.mazo.find((y) => esPokemon(p.carta(y)) && faseDe(p.carta(y)) === 0); p.sacarDelMazo(x); p.s.mano.push(x); b = [x] }
    p.colocar(b[0], 'activo')
    await mesa.accion(() => mesa.listo(ui), ui)
  }
  const pasar = () => mesa.accion(() => mesa.pasarTurno(ui), ui)
  await pasar(); await pasar()
  const a = mesa.jugadores[0]
  // Un Weedle de hace turnos en el activo y un Kakuna mudo en la mano.
  const sacar = (p, id) => { for (const z of ['mazo', 'mano', 'premios', 'descarte']) { const u = p.s[z].find((x) => p.carta(x).id === id); if (u) { if (z === 'mazo') p.sacarDelMazo(u); else p.s[z] = p.s[z].filter((x) => x !== u); return u } } throw new Error('no hay ' + id) }
  const slot = a.nuevoSlot(sacar(a, weedle.id)); slot.entroTurno = -5
  if (a.s.activo) a.s.banca.push(a.s.activo)
  a.s.activo = slot
  const enMano = sacar(a, 'kakuna-mudo'); a.s.mano.push(enMano)
  const ops = a.opcionesDeMano(enMano)
  const evol = ops.filter((o) => o.id === 'evolucionar')
  check('el menú de la mano ofrece evolucionar el Weedle en juego, sin bloquearlo', evol.some((o) => o.slot === slot.id && !o.no), JSON.stringify(ops))
  check('  …y dice que el catálogo no sabe de qué evoluciona: tú decides', evol.some((o) => /no dice de qué evoluciona, tú decides/.test(o.texto)), JSON.stringify(evol))
  check('  …y `motivoNoEvolucionar` no lo para', a.motivoNoEvolucionar(enMano, slot) === null, a.motivoNoEvolucionar(enMano, slot))
  await mesa.accion(() => a.evolucionar(enMano, slot, ui), ui).catch((e) => check('evolucionar no lanza', false, String(e)))
  check('evoluciona de verdad: el activo es ahora el Kakuna', a.cartaDe(a.s.activo)?.id === 'kakuna-mudo', a.cartaDe(a.s.activo)?.name)
  // Con la carta CURADA y nada de lo que evolucione, el mensaje de siempre.
  const js = readFileSync(`${RAIZ}/js/constructor/partida.js`, 'utf8')
  check('el mensaje de «no tienes en juego nada de lo que evolucione» se queda para la carta curada, y la muda tiene el suyo', /No tienes en juego nada de lo que evolucione/.test(js) && /El catálogo no dice de qué evoluciona/.test(js))
}

console.log('\n── 2. `detallesDeJuego` rellena lo que falta desde otra impresión ──')
{
  const b = await chromium.launch()
  const ctx = await b.newContext({ locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = [{ id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST' }, { id: 'me1', name: 'Mega', serie_id: 'me', market: 'WEST' }]
    window.__FAKE_CARTAS__ = [
      { id: 'sv3pt5-14', market: 'WEST', set_id: 'sv3pt5', local_id: '14', name: 'Kakuna', name_es: 'Kakuna', category: 'Pokemon', stage: 'Stage1', evolve_from: 'Weedle', hp: 80, image_path: 'x/1' },
      // La impresión nueva: el engorde no la ha visitado, sin `evolve_from`.
      { id: 'me1-2', market: 'WEST', set_id: 'me1', local_id: '2', name: 'Kakuna', name_es: 'Kakuna', category: 'Pokemon', stage: 'Stage1', evolve_from: null, hp: 80, image_path: 'x/2' },
      { id: 'me1-1', market: 'WEST', set_id: 'me1', local_id: '1', name: 'Weedle', name_es: 'Weedle', category: 'Pokemon', stage: 'Basic', evolve_from: null, hp: 50, image_path: 'x/3' },
      // Una evolución de la que NINGUNA impresión sabe: se queda sin.
      { id: 'me1-3', market: 'WEST', set_id: 'me1', local_id: '3', name: 'Beedrill ex', name_es: 'Beedrill ex', category: 'Pokemon', stage: 'Stage2', evolve_from: null, hp: 300, image_path: 'x/4' },
    ]
  })
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await p.goto(`${BASE}/constructor.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1500)
  const r = await p.evaluate(async () => {
    const { detallesDeJuego } = await import('/js/constructor/datos.js')
    const m = await detallesDeJuego(['me1-2', 'me1-1', 'me1-3', 'sv3pt5-14'])
    return Object.fromEntries([...m].map(([id, c]) => [id, c.evolve_from ?? null]))
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el Kakuna sin `evolve_from` lo toma de la otra impresión («Weedle»)', r['me1-2'] === 'Weedle', JSON.stringify(r))
  check('  …la curada sigue igual y el básico no recibe nada', r['sv3pt5-14'] === 'Weedle' && r['me1-1'] === null, JSON.stringify(r))
  check('  …y la que ninguna impresión sabe se queda sin (no se inventa)', r['me1-3'] === null, JSON.stringify(r))
  await b.close()
}

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
