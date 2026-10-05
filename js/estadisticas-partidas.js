// Las cuentas de /mis-partidas (tanda 628): filtrar, ordenar, rachas y las
// series de los gráficos. Puro, sin DOM ni base: lo prueban en Node.
//
// PINGU: «un filtro para filtrar por días, victorias, derrotas, partidas
// más recientes, más antiguas, etc. Además de hacer gráficos y sacar
// estadísticas de todo, para tener el máximo de información al alcance».
//
// Una partida aquí es la fila ya normalizada de mis-partidas.js: { fecha
// ('AAAA-MM-DD' o null), resultado ('win'|'loss'|'draw'), tipo, mio,
// mioNombre, rival, rivalNombre, donde, deTorneo, torneoId, mazoGuardado,
// creada }.
import { porcentaje } from './matriz-partidas.js'

// ── Las fechas, como TEXTO 'AAAA-MM-DD' ──
//
// Se cuenta en días de calendario y en UTC a propósito: una fecha de
// partida no tiene hora (es la que apuntó quien jugó), y pasarla por la
// zona horaria del navegador la movería de día según dónde se mire.
const DIA = 86400000
const aMs = (f) => {
  const [a, m, d] = String(f).split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}
const aFecha = (ms) => new Date(ms).toISOString().slice(0, 10)
export const sumarDias = (f, n) => aFecha(aMs(f) + n * DIA)
export const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ''))

// Hoy en el calendario de quien mira (no en UTC: a las 00:30 en Madrid ya
// es el día siguiente, y «hoy» tiene que ser el suyo).
export function hoyLocal(ahora = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`
}

export const PERIODOS = [
  ['siempre', 'Siempre'],
  ['hoy', 'Hoy'],
  ['7', 'Últimos 7 días'],
  ['30', 'Últimos 30 días'],
  ['90', 'Últimos 3 meses'],
  ['365', 'Último año'],
  ['rango', 'Entre dos fechas…'],
]

// El rango de un periodo: { desde, hasta } (inclusivos), o los dos a null
// para «siempre». «Últimos 7 días» son siete días contando hoy.
export function rangoDePeriodo(periodo, hoy, desde = null, hasta = null) {
  if (!periodo || periodo === 'siempre') return { desde: null, hasta: null }
  if (periodo === 'hoy') return { desde: hoy, hasta: hoy }
  if (periodo === 'rango') {
    const d = esFecha(desde) ? desde : null
    const h = esFecha(hasta) ? hasta : null
    // Puestas al revés, se entienden al derecho: nadie quiere «cero partidas».
    return d && h && d > h ? { desde: h, hasta: d } : { desde: d, hasta: h }
  }
  const n = Number(periodo)
  return Number.isFinite(n) && n > 0 ? { desde: sumarDias(hoy, -(n - 1)), hasta: hoy } : { desde: null, hasta: null }
}

// De dónde viene una partida: un torneo de PokeDoc, un torneo apuntado a
// mano, o una suelta.
export const origenDe = (p) => (p.deTorneo ? 'pokedoc' : p.torneoId ? 'torneo' : 'suelta')

// Lo que se jugó de verdad: un bye no fue un enfrentamiento y un «no se
// presentó» no dice nada del mazo rival (como en la matriz, tanda 233).
export const seJugo = (p) => !['bye', 'no_show'].includes(p.tipo)

// Filtrar. Con un periodo puesto, una partida SIN fecha se queda fuera:
// no se puede afirmar que fuera de ese periodo.
export function filtrarPartidas(partidas, f = {}, hoy = hoyLocal()) {
  const { desde, hasta } = rangoDePeriodo(f.periodo, hoy, f.desde, f.hasta)
  const conFecha = Boolean(desde || hasta)
  return (partidas || []).filter(
    (p) =>
      (!f.resultado || p.resultado === f.resultado) &&
      (!f.mazo || p.mio === f.mazo) &&
      (!f.rival || p.rival === f.rival) &&
      (!f.guardado || p.mazoGuardado === f.guardado) &&
      (!f.origen || origenDe(p) === f.origen) &&
      (!f.donde || p.donde === f.donde) &&
      (!conFecha || (esFecha(p.fecha) && (!desde || p.fecha >= desde) && (!hasta || p.fecha <= hasta)))
  )
}

// Ordenar por fecha; a igual fecha, por cuándo se apuntó (las rondas de un
// torneo comparten la fecha del torneo). Sin fecha, al final en los dos
// órdenes: no son ni las más nuevas ni las más viejas.
export function ordenarPartidas(partidas, orden = 'recientes') {
  const signo = orden === 'antiguas' ? 1 : -1
  return [...(partidas || [])].sort((a, b) => {
    const fa = esFecha(a.fecha) ? a.fecha : null
    const fb = esFecha(b.fecha) ? b.fecha : null
    if (fa !== fb) {
      if (!fa) return 1
      if (!fb) return -1
      return signo * fa.localeCompare(fb)
    }
    return signo * String(a.creada || '').localeCompare(String(b.creada || ''))
  })
}

export function cuenta(partidas) {
  const c = { ganadas: 0, perdidas: 0, empatadas: 0, total: 0 }
  for (const p of partidas || []) {
    if (p.resultado === 'win') c.ganadas++
    else if (p.resultado === 'loss') c.perdidas++
    else if (p.resultado === 'draw') c.empatadas++
    else continue
    c.total++
  }
  // El MISMO porcentaje que la matriz (un empate cuenta medio, como en el
  // juego), y null sin partidas: «0%» sería afirmar que pierdes. Dos
  // porcentajes distintos en la misma pestaña se contradirían a la vista.
  c.pct = porcentaje(c)
  return c
}

// Las rachas, en orden de juego: la de ahora (la última racha sin cortar),
// la mejor de victorias y la peor de derrotas. Un empate corta las dos.
export function rachas(partidas) {
  const orden = ordenarPartidas(partidas, 'antiguas').filter((p) => esFecha(p.fecha) || p.creada)
  let actual = { resultado: null, n: 0 }
  let mejor = 0
  let peor = 0
  for (const p of orden) {
    if (p.resultado === actual.resultado) actual = { resultado: p.resultado, n: actual.n + 1 }
    else actual = { resultado: p.resultado, n: 1 }
    if (actual.resultado === 'win') mejor = Math.max(mejor, actual.n)
    if (actual.resultado === 'loss') peor = Math.max(peor, actual.n)
  }
  return { actual: actual.n ? actual : null, mejorVictorias: mejor, peorDerrotas: peor }
}

// Las últimas N, de la más reciente a la más vieja.
export const ultimas = (partidas, n = 10) => ordenarPartidas(partidas, 'recientes').slice(0, n)

// ── Las series de los gráficos ──

// La unidad de tiempo que cabe: por días hasta un mes, por semanas hasta
// medio año, y por meses a partir de ahí. Con más barras que eso el
// gráfico deja de leerse.
export function unidadPara(desde, hasta) {
  if (!esFecha(desde) || !esFecha(hasta)) return 'semana'
  const dias = (aMs(hasta) - aMs(desde)) / DIA + 1
  return dias <= 31 ? 'dia' : dias <= 183 ? 'semana' : 'mes'
}

// La clave del cubo de una fecha: el día, el LUNES de su semana, o el mes.
export function cuboDe(fecha, unidad) {
  if (unidad === 'dia') return fecha
  if (unidad === 'mes') return `${fecha.slice(0, 7)}-01`
  const dow = (new Date(aMs(fecha)).getUTCDay() + 6) % 7 // lunes = 0
  return sumarDias(fecha, -dow)
}

function siguiente(cubo, unidad) {
  if (unidad === 'dia') return sumarDias(cubo, 1)
  if (unidad === 'semana') return sumarDias(cubo, 7)
  const [a, m] = cubo.split('-').map(Number)
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export function etiquetaDeCubo(cubo, unidad) {
  const [a, m, d] = cubo.split('-').map(Number)
  if (unidad === 'mes') return `${MESES[m - 1]} ${String(a).slice(2)}`
  return `${d} ${MESES[m - 1]}`
}

// Las partidas por día/semana/mes, SEGUIDAS: los cubos vacíos también
// están, o una semana sin jugar desaparecería del eje y dos puntos
// separados por un mes se verían pegados.
export function porPeriodo(partidas, { desde = null, hasta = null, unidad = null } = {}) {
  const fechadas = (partidas || []).filter((p) => esFecha(p.fecha))
  if (!fechadas.length) return { unidad: unidad || 'semana', cubos: [] }
  const fechas = fechadas.map((p) => p.fecha).sort()
  const ini = desde || fechas[0]
  const fin = hasta || fechas[fechas.length - 1]
  const u = unidad || unidadPara(ini, fin)
  const cubos = []
  const indice = new Map()
  for (let c = cuboDe(ini, u), vueltas = 0; c <= cuboDe(fin, u) && vueltas < 400; c = siguiente(c, u), vueltas++) {
    indice.set(c, cubos.length)
    cubos.push({ clave: c, etiqueta: etiquetaDeCubo(c, u), partidas: [] })
  }
  for (const p of fechadas) {
    const i = indice.get(cuboDe(p.fecha, u))
    if (i != null) cubos[i].partidas.push(p)
  }
  return { unidad: u, cubos: cubos.map((c) => ({ clave: c.clave, etiqueta: c.etiqueta, ...cuenta(c.partidas) })) }
}

// Agrupar por lo que sea (tu mazo, el rival, dónde, el mazo guardado), con
// su cuenta. Los que más se han jugado primero; a igual número, el nombre.
export function porGrupo(partidas, claveDe, nombreDe) {
  const grupos = new Map()
  for (const p of partidas || []) {
    const k = claveDe(p)
    if (k == null || k === '') continue
    if (!grupos.has(k)) grupos.set(k, { clave: k, nombre: nombreDe(p), partidas: [] })
    grupos.get(k).partidas.push(p)
  }
  return [...grupos.values()]
    .map((g) => ({ clave: g.clave, nombre: g.nombre, ...cuenta(g.partidas) }))
    .sort((a, b) => b.total - a.total || String(a.nombre).localeCompare(String(b.nombre)))
}

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export function porDiaDeLaSemana(partidas) {
  const dias = DIAS_SEMANA.map((etiqueta, i) => ({ clave: String(i), etiqueta, partidas: [] }))
  for (const p of partidas || []) {
    if (!esFecha(p.fecha)) continue
    dias[(new Date(aMs(p.fecha)).getUTCDay() + 6) % 7].partidas.push(p)
  }
  return dias.map((d) => ({ clave: d.clave, etiqueta: d.etiqueta, ...cuenta(d.partidas) }))
}
