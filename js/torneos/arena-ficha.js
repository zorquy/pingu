// La cabecera de la ficha, «Arena limpia» (PINGU y Manso: «que las pestañas
// estén bien pensadas, compensadas… que no esté desigualado»). Debajo del
// banner, la imagen del torneo y CUATRO datos del mismo tamaño, siempre los
// mismos y en el mismo orden: cuándo, formato, jugadores y cómo va. Lo que
// antes iba en la pastilla de la cuenta y en las rayitas, va aquí. Puro.
import { escapeHtml } from '../html.js'
import { numJornadas, rondasPorJornada } from './rondas-jornada.js'
import { jornadasDeLiga } from './liga-en-curso.js'
import { cuentaDeCabecera } from './cabecera.js'

const DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const hora = (d) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

// [{ b, s, clase }] × 4. `ronda`: la viva (o la última); `rondas`: las de la
// liga; `activos`: los inscritos que siguen; `campeon`: su nombre, si lo hay.
export function datosDeFicha(t, { ronda = null, rondas = null, activos = 0, campeon = '', ahora = Date.now() } = {}) {
  const inicio = new Date(t.start_at)
  const liga = t.format === 'league'
  const fin = ['finished', 'cancelled'].includes(t.status)
  const enJuego = t.status === 'in_progress'
  const cuenta = cuentaDeCabecera(t, { rondas, ronda, ahora })
  const cuando = {
    b: `${DIA[inicio.getDay()]} ${inicio.getDate()} · ${hora(inicio)}`,
    s: fin ? inicio.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : enJuego ? `empezó a las ${hora(inicio)}` : cuenta ? `${cuenta.hoy ? 'hoy, en' : 'en'} ${cuenta.valor}` : 'cuándo',
    clase: cuenta?.hoy ? 'hoy' : '',
  }
  const formato = liga
    ? { b: `${numJornadas(t)} jornadas`, s: `${rondasPorJornada(t) > 1 ? `${rondasPorJornada(t)} rondas · ` : ''}BO${t.swiss_bo ?? 1}` }
    : { b: `${t.swiss_rounds}${t.top_cut_size ? ` + top ${t.top_cut_size}` : ' rondas'}`, s: `suizo · BO${t.swiss_bo ?? 1}${t.round_time_minutes ? ` · ${t.round_time_minutes} min` : ''}` }
  const jugadores = {
    b: `${activos}${t.max_players && !fin && !enJuego ? `/${t.max_players}` : ''}`,
    s: fin ? 'jugaron' : enJuego ? 'jugando' : t.max_players ? (t.max_players - activos > 0 ? `plazas · quedan ${t.max_players - activos}` : 'plazas · completo') : 'apuntados',
  }
  let estado
  if (t.status === 'cancelled') estado = { b: 'Cancelado', s: '', clase: 'suave' }
  else if (fin) estado = { b: 'Terminado', s: campeon ? `ganó ${campeon}` : 'resultados', clase: 'oro' }
  else if (enJuego && liga && Array.isArray(rondas)) {
    const { siguiente, total } = jornadasDeLiga(t, rondas)
    estado = siguiente?.estado === 'en_juego'
      ? { b: `Jornada ${siguiente.n}`, s: `de ${total} · en juego`, clase: 'vivo' }
      : { b: `Jornada ${siguiente?.n || '—'}`, s: siguiente?.fecha ? `de ${total} · ${DIA[new Date(siguiente.fecha).getDay()]} ${new Date(siguiente.fecha).getDate()}` : `de ${total}`, clase: '' }
  } else if (enJuego) {
    const corte = ronda?.phase === 'top_cut'
    estado = { b: corte ? `Top ${t.top_cut_size}` : `Ronda ${ronda?.round_number || 1}`, s: corte ? 'en juego' : `de ${t.swiss_rounds} · en juego`, clase: 'vivo' }
  } else if (t.modalidad === 'presencial' && t.inscripcion === 'organizador' && !liga) {
    // «Solo tú los apuntas» (1484): no hay inscripción abierta ni cerrada,
    // la gente entra el día, cuando le dan entrada en la puerta.
    estado = { b: 'En la puerta', s: 'te apuntan al llegar', clase: 'abierto' }
  } else estado = t.status === 'registration_open' ? { b: 'Abierto', s: 'inscripción', clase: 'abierto' } : { b: 'Cerrado', s: 'inscripción', clase: 'suave' }
  return [
    { ...cuando, rotulo: 'Cuándo' },
    { ...formato, rotulo: 'Formato' },
    { ...jugadores, rotulo: 'Jugadores' },
    { ...estado, rotulo: 'Estado' },
  ]
}

export function datosDeFichaHtml(datos) {
  return datos
    .map((d) => `<div class="tficha-dato${d.clase ? ` ${d.clase}` : ''}"><dt class="sr-only">${escapeHtml(d.rotulo)}</dt><dd><b>${d.clase === 'vivo' ? '<span class="torneo-punto" aria-hidden="true"></span>' : ''}${escapeHtml(d.b)}</b><small>${escapeHtml(d.s)}</small></dd></div>`)
    .join('')
}
