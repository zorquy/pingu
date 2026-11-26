// Tanda 1454–1456 — La agenda de /torneos, lo puro (js/torneos/agenda-puro.js):
//   · la ciudad sale de la dirección (sin código postal ni país; online, nada);
//   · los tramos por días de calendario (hoy / esta semana / más adelante);
//   · los filtros (Los míos, Online, En persona con ciudad, Oficiales, Ligas,
//     buscador sin tildes);
//   · los terminados por meses, del último al primero;
//   · los borradores, SOLO de quien los creó (aunque mire un admin).
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const m = await import(pathToFileURL(path.join(RAIZ, 'js/torneos/agenda-puro.js')).href)
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + JSON.stringify(extra).slice(0, 300) : ''}`)
}

console.log('── La ciudad ──')
const P = (direccion) => ({ modalidad: 'presencial', direccion })
check('«Calle Ercilla 12, 48009 Bilbao» → Bilbao', m.ciudadDe(P('Calle Ercilla 12, 48009 Bilbao')) === 'Bilbao')
check('«Gran Vía 30, 28013 Madrid, España» → Madrid', m.ciudadDe(P('Gran Vía 30, 28013 Madrid, España')) === 'Madrid')
check('«Av. Constitución 4, sevilla» → Sevilla', m.ciudadDe(P('Av. Constitución 4, sevilla')) === 'Sevilla')
check('sin coma no hay ciudad que adivinar', m.ciudadDe(P('Calle Mayor 3')) === null)
check('online no tiene ciudad', m.ciudadDe({ modalidad: 'online', direccion: 'Calle X 1, Bilbao' }) === null)
const lista = [P('A 1, Bilbao'), P('B 2, Bilbao'), P('C 3, Madrid'), { modalidad: 'online' }]
check('las ciudades con su cuenta, la de más arriba primero', JSON.stringify(m.ciudadesDe(lista)) === JSON.stringify([{ ciudad: 'Bilbao', n: 2 }, { ciudad: 'Madrid', n: 1 }]), m.ciudadesDe(lista))

console.log('── Los tramos ──')
const ahora = new Date(2026, 10, 26, 12, 0) // jueves 26 de noviembre
const en = (d, h = 18) => new Date(2026, 10, 26 + d, h, 0).toISOString()
check('en juego → hoy', m.tramoDe({ status: 'in_progress', start_at: en(-1) }, ahora) === 'hoy')
check('esta noche → hoy', m.tramoDe({ status: 'registration_open', start_at: en(0, 22) }, ahora) === 'hoy')
check('debía empezar y no ha empezado → hoy', m.tramoDe({ status: 'registration_closed', start_at: en(0, 9) }, ahora) === 'hoy')
check('mañana → esta semana', m.tramoDe({ status: 'registration_open', start_at: en(1) }, ahora) === 'semana')
check('dentro de 7 días (por la noche) → esta semana', m.tramoDe({ status: 'registration_open', start_at: en(7, 23) }, ahora) === 'semana')
check('dentro de 8 días → más adelante', m.tramoDe({ status: 'registration_open', start_at: en(8, 9) }, ahora) === 'luego')
const orden = m.ordenarProximos([{ id: 'b', status: 'registration_open', start_at: en(3) }, { id: 'a', status: 'registration_open', start_at: en(1) }, { id: 'v', status: 'in_progress', start_at: en(0, 9) }])
check('lo que viene va por fecha, con lo que se juega delante', orden.map((t) => t.id).join() === 'v,a,b', orden.map((t) => t.id))

console.log('── Los filtros ──')
const TS = [
  { id: 'on', name: 'Copa de Otoño', modalidad: 'online', format: 'standard' },
  { id: 'bi', name: 'Copa Cartas', modalidad: 'presencial', direccion: 'Ercilla 12, Bilbao', lugar: 'Cartas Bilbao', format: 'standard' },
  { id: 'ma', name: 'Torneo Tienda', modalidad: 'presencial', direccion: 'Gran Vía 30, Madrid', format: 'standard' },
  { id: 'li', name: 'Liga PokeDoc', modalidad: 'online', format: 'league', of: true },
]
const ids = (o) => m.filtrarTorneos(TS, { mio: (t) => t.id === 'bi', oficial: (t) => Boolean(t.of), organiza: (t) => (t.id === 'ma' ? 'dragonpapel' : ''), ...o }).map((t) => t.id).join()
check('Todos', ids({}) === 'on,bi,ma,li')
check('Los míos', ids({ filtro: 'mios' }) === 'bi')
check('Online', ids({ filtro: 'online' }) === 'on,li')
check('En persona, todas las ciudades', ids({ filtro: 'persona' }) === 'bi,ma')
check('En persona · Madrid', ids({ filtro: 'persona', ciudad: 'Madrid' }) === 'ma')
check('Oficiales', ids({ filtro: 'oficiales' }) === 'li')
check('Ligas', ids({ filtro: 'ligas' }) === 'li')
check('el buscador no mira tildes: «otono» encuentra «Otoño»', ids({ busca: 'otono' }) === 'on')
check('el buscador mira el sitio y la dirección', ids({ busca: 'bilbao' }) === 'bi')
check('el buscador mira quién organiza', ids({ busca: 'dragon' }) === 'ma')

console.log('── Los terminados por meses ──')
const meses = m.terminadosPorMes([{ id: 'oct', start_at: '2026-10-22T18:00:00' }, { id: 'nov2', start_at: '2026-11-23T18:00:00' }, { id: 'nov1', start_at: '2026-11-19T18:00:00' }])
check('dos grupos, el mes más reciente primero', meses.map((g) => g.texto).join('|') === 'Noviembre 2026|Octubre 2026', meses.map((g) => g.texto))
check('dentro del mes, del último al primero', meses[0].torneos.map((t) => t.id).join() === 'nov2,nov1')

console.log('── Los borradores, solo de quien los creó ──')
const borr = [{ id: 'mio', status: 'draft', admin_id: 'yo' }, { id: 'otro', status: 'draft', admin_id: 'admin-del-sitio' }, { id: 'abierto', status: 'registration_open', admin_id: 'yo' }]
check('salen los míos y ninguno más (aunque mire un admin)', m.borradoresDe(borr, 'yo').map((t) => t.id).join() === 'mio')
check('sin cuenta, ninguno', m.borradoresDe(borr, null).length === 0)

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
