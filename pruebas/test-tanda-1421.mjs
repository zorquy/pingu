// Tanda 1421 — las cuentas de «Por torneo» (js/meta/torneos-nucleo.js).
const R = process.env.PD_RAIZ || '/home/user/pingu'
const n = await import(`${R}/js/meta/torneos-nucleo.js`)
const { RESULTADOS } = await import('./datos-meta-torneos.mjs')

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── El periodo, con la cuenta de la base ──')
{
  const ahora = new Date('2026-11-23T10:00:00Z')
  check('14 días: desde el 10 de noviembre a las 0:00 UTC (posterior a hoy menos 14)', n.desdeDePeriodo(14, ahora) === '2026-11-10T00:00:00.000Z', n.desdeDePeriodo(14, ahora))
  check('7 días: desde el 17', n.desdeDePeriodo(7, ahora) === '2026-11-17T00:00:00.000Z', n.desdeDePeriodo(7, ahora))
  check('un periodo raro cae en 14', n.desdeDePeriodo('x', ahora) === '2026-11-10T00:00:00.000Z')
}

console.log('── Las direcciones ──')
check('la ruta escapa el id', n.rutaDeTorneo('pokedoc-a b') === '/meta/torneo/pokedoc-a%20b')
check('y se lee de vuelta', n.idDeTorneoEnRuta('/meta/torneo/pokedoc-a%20b') === 'pokedoc-a b')
check('o de ?t=', n.idDeTorneoEnRuta('/meta-torneo.html', '?t=abc') === 'abc')
check('nada si no hay', n.idDeTorneoEnRuta('/meta/dragapult') === '')

console.log('── El Top y el reparto ──')
{
  const tops = n.topPorTorneo(RESULTADOS)
  check('un Top 8 por torneo, ordenado', [...tops.values()].every((t) => t.length === 8 && t.every((f, i) => i === 0 || f.puesto >= t[i - 1].puesto)), [...tops.values()].map((t) => t.length))
  const stuttgart = RESULTADOS.filter((f) => f.torneo_id === 'oficial-900')
  const rep = n.repartoDe(stuttgart)
  check('el reparto suma los 40 y va del más jugado al menos', rep.reduce((s, r) => s + r.n, 0) === 40 && rep.every((r, i) => i === 0 || r.n <= rep[i - 1].n), JSON.stringify(rep.map((r) => [r.arquetipo, r.n])))
  check('  …las cuotas suman 100', Math.abs(rep.reduce((s, r) => s + r.cuota, 0) - 100) < 1e-9)
  check('  …y cuenta los del Top 8 de cada uno', rep.reduce((s, r) => s + r.top, 0) === 8)
  const m = n.elQueMasRindio(rep)
  check('«el que más rindió» es Grimmsnarl (pocos en la sala, uno arriba)', m?.arquetipo === 'grimmsnarl-ex' && m.top === 1, JSON.stringify(m))
  check('con menos de 32 mazos no se dice', n.elQueMasRindio(n.repartoDe(RESULTADOS.filter((f) => f.torneo_id === 'pokedoc-liga-6'))) === null)
  check('si nadie rinde el doble, tampoco', n.elQueMasRindio([{ arquetipo: 'a', n: 20, top: 4 }, { arquetipo: 'b', n: 20, top: 4 }]) === null)
}

console.log('── Lo que se enseña ──')
check('un oficial sin récord no dice 0-0-0', n.resultadoDe({ victorias: 0, derrotas: 0, empates: 0 }) === '')
check('con récord, sí', n.resultadoDe({ victorias: 5, derrotas: 1, empates: 1 }) === '5-1-1')
check('la chapa de un oficial es su tipo', n.chapaDeTorneo({ fuente: 'oficial', tipo: 'Regional' }).texto === 'Regional')
check('PokeDoc lleva a La arena', n.enlaceDelTorneo({ fuente: 'pokedoc', enlace: '/torneo?slug=x' })?.texto === 'Ver en La arena')
check('un online sin enlace va a Limitless', /play\.limitlesstcg\.com\/tournament\/abc\/standings/.test(n.enlaceDelTorneo({ fuente: 'online', id: 'abc' })?.url || ''))
check('el id interno del jugador no sale nunca', n.nombreDeJugador({ jugador: 'lista-3' }) === '' && n.nombreDeJugador({ jugador: 'x', nombre_jugador: 'Ana' }) === 'Ana')

console.log(fails ? `\n${fails} FALLAN` : '\nTodo bien')
process.exit(fails ? 1 : 0)
