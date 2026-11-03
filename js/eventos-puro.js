// Lo puro de los eventos (1192): sin base ni DOM, para la agenda, la ficha, la
// portada y /admin, y para las pruebas.

export const TIPOS = { card_show: 'Card show', trade_day: 'Trade day', trade_night: 'Trade night', quedada: 'Quedada', torneo: 'Torneo' }
export const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const medianoche = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const diasEntre = (desde, hasta) => Math.round((medianoche(hasta) - medianoche(desde)) / 864e5)

// «Hoy», «Mañana», «El sábado», «En 12 días»: cuando falta poco, en vez de la
// fecha a secas. Lejos (más de un mes), nada: ya lo dice la fecha.
export function cuandoEs(fecha, ahora = new Date()) {
  const d = diasEntre(ahora, fecha)
  if (d < 0) return ''
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Mañana'
  if (d < 7) return `El ${DIAS[new Date(fecha).getDay()]}`
  if (d <= 31) return `En ${d} días`
  return ''
}

// ── Los días y su horario (1193) ──
// Un día es «2026-11-07» en hora de aquí; la hora, «10:00».
const dosCifras = (n) => String(n).padStart(2, '0')
export const diaDe = (d) => { const x = new Date(d); return `${x.getFullYear()}-${dosCifras(x.getMonth() + 1)}-${dosCifras(x.getDate())}` }
export const horaDe = (d) => { const x = new Date(d); return `${dosCifras(x.getHours())}:${dosCifras(x.getMinutes())}` }
export const fechaDeDia = (dia, hora = '00:00') => {
  const [a, m, d] = dia.split('-').map(Number)
  const [h, mi] = (hora || '00:00').split(':').map(Number)
  return new Date(a, m - 1, d, h || 0, mi || 0)
}
const esDia = (x) => /^\d{4}-\d{2}-\d{2}$/.test(x?.dia || '')

// Los días del evento, uno por fila y en orden. Con `horario` guardado, ese;
// si no (los de antes de la 1193), sale de `empieza` y `termina`: cada día
// entre los dos, con la hora de empezar y la de acabar.
export function horarioDe(e) {
  const h = Array.isArray(e?.horario) ? e.horario.filter(esDia) : []
  if (h.length) return h.map((x) => ({ dia: x.dia, desde: x.desde || '', hasta: x.hasta || '' })).sort((a, b) => a.dia.localeCompare(b.dia))
  if (!e?.empieza) return []
  const ini = new Date(e.empieza)
  const fin = e.termina ? new Date(e.termina) : null
  const conHora = (d) => (d.getHours() || d.getMinutes() ? horaDe(d) : '')
  const desde = conHora(ini)
  const hasta = fin ? conHora(fin) : ''
  const dias = []
  const x = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate())
  const ultimo = fin ? new Date(fin.getFullYear(), fin.getMonth(), fin.getDate()) : new Date(x)
  while (x <= ultimo && dias.length < 31) { dias.push({ dia: diaDe(x), desde, hasta }); x.setDate(x.getDate() + 1) }
  return dias
}

// `empieza` y `termina` a partir de los días: el primero con su hora y el
// último con la suya (sin hora de acabar, ese día a las 23:59).
export function extremosDeHorario(horario) {
  const h = (horario || []).filter(esDia).slice().sort((a, b) => a.dia.localeCompare(b.dia))
  if (!h.length) return { empieza: null, termina: null }
  const pri = h[0]
  const ult = h[h.length - 1]
  const empieza = fechaDeDia(pri.dia, pri.desde)
  let termina = ult.hasta ? fechaDeDia(ult.dia, ult.hasta) : (h.length > 1 ? fechaDeDia(ult.dia, '23:59') : null)
  if (termina && termina < empieza) termina = fechaDeDia(ult.dia, '23:59')
  return { empieza: empieza.toISOString(), termina: termina ? termina.toISOString() : null }
}

const tramoHoras = (x) => (x.desde ? `${x.desde}${x.hasta ? ` – ${x.hasta}` : ''}` : '')
export const mismoHorario = (h) => h.length > 0 && h.every((x) => x.desde === h[0].desde && x.hasta === h[0].hasta)

// «Sábado, 14 de noviembre · 10:00 – 20:00»; dos días seguidos, «Sábado 7 y
// domingo 8 de noviembre»; más, «Del 7 al 9 de noviembre»; sueltos, «7 y 14 de
// noviembre». La hora va si es la misma todos los días (si no, la ficha la
// pone día a día).
export function fechaLarga(e) {
  const h = horarioDe(e)
  if (!h.length) return ''
  const f = h.map((x) => fechaDeDia(x.dia))
  const mes = (d) => MESES_LARGOS[d.getMonth()]
  const dia = (d) => DIAS[d.getDay()]
  const mayus = (t) => t[0].toUpperCase() + t.slice(1)
  const seguidos = f.every((d, i) => i === 0 || Math.round((d - f[i - 1]) / 864e5) === 1)
  const pri = f[0]
  const ult = f[f.length - 1]
  let texto
  if (f.length === 1) texto = `${mayus(dia(pri))}, ${pri.getDate()} de ${mes(pri)}`
  else if (f.length === 2 && seguidos) texto = `${mayus(dia(pri))} ${pri.getDate()}${mes(pri) !== mes(ult) ? ` de ${mes(pri)}` : ''} y ${dia(ult)} ${ult.getDate()} de ${mes(ult)}`
  else if (seguidos) texto = `Del ${pri.getDate()}${mes(pri) !== mes(ult) ? ` de ${mes(pri)}` : ''} al ${ult.getDate()} de ${mes(ult)}`
  else {
    const mismoMes = f.every((d) => mes(d) === mes(pri))
    const partes = f.map((d) => (mismoMes ? String(d.getDate()) : `${d.getDate()} de ${mes(d)}`))
    texto = `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}${mismoMes ? ` de ${mes(pri)}` : ''}`
  }
  const horas = mismoHorario(h) ? tramoHoras(h[0]) : ''
  return horas ? `${texto} · ${horas}` : texto
}

// Cada día con su hora, para la ficha cuando no todos son iguales.
export const diasConHora = (e) => horarioDe(e).map((x) => {
  const d = fechaDeDia(x.dia)
  return { texto: `${DIAS[d.getDay()][0].toUpperCase()}${DIAS[d.getDay()].slice(1)} ${d.getDate()}`, horas: tramoHoras(x) }
})

// ── Las entradas (1193) ──
export function entradasDe(e) {
  const l = Array.isArray(e?.entradas) ? e.entradas : []
  return l.filter((x) => x && String(x.nombre || '').trim()).map((x) => ({
    nombre: String(x.nombre).trim(),
    precio: x.precio === null || x.precio === undefined || x.precio === '' || Number.isNaN(Number(x.precio)) ? null : Number(x.precio),
    nota: String(x.nota || '').trim(),
  }))
}
export const precioTexto = (p) => (p === null || p === undefined ? '' : p === 0 ? 'Gratis' : `${Number(p).toLocaleString('es-ES', { minimumFractionDigits: Number.isInteger(Number(p)) ? 0 : 2, maximumFractionDigits: 2 })} €`)
// «General 5 € · VIP 15 €»: lo que se guarda en `entrada` y lo que se enseña
// donde no cabe la lista.
export const resumenEntradas = (l) => l.map((x) => [x.nombre, precioTexto(x.precio)].filter(Boolean).join(' ')).join(' · ')
// «Desde 5 €», «Gratis», o nada.
export function desdePrecio(l) {
  const p = l.map((x) => x.precio).filter((x) => x !== null)
  if (!p.length) return ''
  const min = Math.min(...p)
  if (min === 0 && p.every((x) => x === 0)) return 'Gratis'
  return p.length > 1 && p.some((x) => x !== min) ? `Desde ${min ? precioTexto(min) : '0 €'}` : precioTexto(min)
}

// Lo que acabó antes de hoy va a «Pasados».
export const esPasado = (e, ahora = new Date()) => new Date(e.termina || e.empieza) < medianoche(ahora)

// Las siglas del logo cuando no hay foto: las suyas o las iniciales.
export function siglasDe(e) {
  if (e.siglas) return e.siglas.toUpperCase().slice(0, 4)
  const palabras = String(e.nombre || '').split(/\s+/).filter((p) => p && !/^(de|del|la|el|y|los|las)$/i.test(p))
  return (palabras.length > 1 ? palabras.slice(0, 3).map((p) => p[0]) : [String(e.nombre || '?').slice(0, 3)]).join('').toUpperCase()
}

export function filtrar(eventos, { tipo = '', provincia = '', soloVoy = false } = {}) {
  return eventos.filter((e) => (!tipo || e.tipo === tipo) && (!provincia || (e.provincia || e.ciudad) === provincia) && (!soloVoy || e.voy))
}

export function separar(eventos, ahora = new Date()) {
  const proximos = eventos.filter((e) => !esPasado(e, ahora)).sort((a, b) => new Date(a.empieza) - new Date(b.empieza))
  const pasados = eventos.filter((e) => esPasado(e, ahora)).sort((a, b) => new Date(b.empieza) - new Date(a.empieza))
  return { proximos, pasados }
}

// El más cercano de los próximos `dias` días (la portada), o null.
export function proximoEvento(eventos, ahora = new Date(), dias = 14) {
  const { proximos } = separar(eventos, ahora)
  const e = proximos[0]
  return e && diasEntre(ahora, e.empieza) <= dias ? e : null
}

// Un enlace de fuera solo si es http(s): lo escribe el equipo, pero una
// dirección «javascript:» no se pinta nunca.
export function webSegura(url) {
  const u = String(url || '').trim()
  if (!u) return ''
  const conEsquema = /^[a-z]+:/i.test(u) ? u : `https://${u}`
  return /^https?:\/\//i.test(conEsquema) ? conEsquema : ''
}

export function instagramDe(handle) {
  const h = String(handle || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? { usuario: h, url: `https://www.instagram.com/${h}/` } : null
}

export function mapaDe(e) {
  const q = [e.sitio, e.direccion, e.ciudad].filter(Boolean).join(', ')
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : ''
}

// La dirección de un evento a partir de su nombre y su año: «Iberian Card
// Show» del 2026 → «iberian-card-show-2026». La usa /admin al darlo de alta.
export function slugDeEvento(nombre, fecha) {
  const base = String(nombre || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '')
  const anio = fecha ? new Date(fecha).getFullYear() : ''
  return [base || 'evento', anio && !base.endsWith(String(anio)) ? anio : ''].filter(Boolean).join('-')
}

export const vanTexto = (n, pasado = false) => (pasado ? `${n} ${n === 1 ? 'fue' : 'fueron'}` : `${n} ${n === 1 ? 'va' : 'van'}`)
