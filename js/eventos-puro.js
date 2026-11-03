// Lo puro de los eventos (1192): sin base ni DOM, para la agenda, la ficha, la
// portada y /admin, y para las pruebas.

export const TIPOS = { card_show: 'Card show', trade_day: 'Trade day', quedada: 'Quedada', torneo: 'Torneo' }
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

// «Sábado, 14 de noviembre» y, con hora, «· 10:00 – 20:00».
export function fechaLarga(e) {
  const d = new Date(e.empieza)
  const dia = `${DIAS[d.getDay()][0].toUpperCase()}${DIAS[d.getDay()].slice(1)}, ${d.getDate()} de ${MESES_LARGOS[d.getMonth()]}`
  const hora = (x) => x.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const fin = e.termina ? new Date(e.termina) : null
  if (fin && diasEntre(d, fin) > 0) return `${dia} – ${fin.getDate()} de ${MESES_LARGOS[fin.getMonth()]}`
  const conHora = d.getHours() || d.getMinutes()
  return conHora ? `${dia} · ${hora(d)}${fin ? ` – ${hora(fin)}` : ''}` : dia
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
