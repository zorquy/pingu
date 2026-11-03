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
    // Dónde comprarla (1194): solo http(s).
    url: webSegura(x.url),
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
  // Con una gratis (la de los niños) y otras de pago, «Desde» cuenta la de pago
  // más barata: «Desde 0 €» no dice nada (1194).
  const pago = p.filter((x) => x > 0)
  if (!pago.length) return precioTexto(min)
  const minPago = Math.min(...pago)
  return p.length > 1 && p.some((x) => x !== minPago) ? `Desde ${precioTexto(minPago)}` : precioTexto(minPago)
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

// ── El cartel (1194) ──
const DIAS_PASTILLA = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
// La pastilla de la fecha: «SÁB–DOM» y «7–8», o «SÁB» y «21».
export function pastillaDe(e) {
  const h = horarioDe(e)
  if (!h.length) return { arriba: '', dia: '' }
  const a = fechaDeDia(h[0].dia)
  const b = fechaDeDia(h[h.length - 1].dia)
  if (h.length === 1) return { arriba: DIAS_PASTILLA[a.getDay()], dia: String(a.getDate()) }
  return { arriba: `${DIAS_PASTILLA[a.getDay()]}–${DIAS_PASTILLA[b.getDay()]}`, dia: `${a.getDate()}–${b.getDate()}` }
}

// La cuenta atrás: «Hoy», «Mañana», «Faltan N días» (hasta dos semanas), y
// «En marcha» si ya empezó y no ha acabado. Más lejos o pasado, nada.
export function cuentaAtras(e, ahora = new Date()) {
  if (esPasado(e, ahora)) return ''
  const d = diasEntre(ahora, e.empieza)
  if (d < 0) return 'En marcha'
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Mañana'
  return d <= 14 ? `Faltan ${d} días` : ''
}

// Para agrupar la agenda: «Noviembre 2026».
export const mesDe = (e) => { const d = new Date(e.empieza); return `${MESES_LARGOS[d.getMonth()][0].toUpperCase()}${MESES_LARGOS[d.getMonth()].slice(1)} ${d.getFullYear()}` }

// Una entrada que se pinta en dorado: la VIP y sus parientes.
export const esEntradaVip = (x) => /\b(vip|premium|gold|oro|platino|full ?pass|pase completo)\b/i.test(x?.nombre || '')

// Las horas de un vistazo para la tarjeta: «10:00 – 20:00» si es la misma.
export function horasDe(e) {
  const h = horarioDe(e)
  return mismoHorario(h) ? (h[0].desde ? `${h[0].desde}${h[0].hasta ? ` – ${h[0].hasta}` : ''}` : '') : ''
}

// ── Añadir al calendario (1197) ──
// Un .ics con un VEVENT por día (cada uno con su horario; sin hora, el día
// entero). Las horas van en UTC desde la hora de aquí: así lo entienden Google,
// Apple y Outlook sin tener que mandar la zona horaria.
const icsTexto = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1')
const icsUtc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const icsDia = (dia) => dia.replace(/-/g, '')
// Las líneas de más de 75 caracteres se doblan (la norma lo pide).
const icsDoblar = (linea) => linea.match(/.{1,74}/g).join('\r\n ')

export function icsDeEvento(e, url = '', ahora = new Date()) {
  const dias = horarioDe(e)
  const lugar = [e.sitio, e.direccion, e.ciudad].filter(Boolean).join(', ')
  const desc = [e.descripcion, url].filter(Boolean).join('\n\n')
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PokeDoc//Eventos//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const x of dias) {
    lineas.push('BEGIN:VEVENT', `UID:${e.slug || e.id}-${icsDia(x.dia)}@pokedoc.es`, `DTSTAMP:${icsUtc(ahora)}`)
    if (x.desde) {
      const ini = fechaDeDia(x.dia, x.desde)
      let fin = x.hasta ? fechaDeDia(x.dia, x.hasta) : new Date(ini.getTime() + 2 * 3600e3)
      if (fin <= ini) fin = new Date(ini.getTime() + 2 * 3600e3)
      lineas.push(`DTSTART:${icsUtc(ini)}`, `DTEND:${icsUtc(fin)}`)
    } else {
      const sig = fechaDeDia(x.dia)
      sig.setDate(sig.getDate() + 1)
      lineas.push(`DTSTART;VALUE=DATE:${icsDia(x.dia)}`, `DTEND;VALUE=DATE:${icsDia(diaDe(sig))}`)
    }
    lineas.push(`SUMMARY:${icsTexto(e.nombre)}`)
    if (lugar) lineas.push(`LOCATION:${icsTexto(lugar)}`)
    if (desc) lineas.push(`DESCRIPTION:${icsTexto(desc)}`)
    if (url) lineas.push(`URL:${url}`)
    lineas.push('END:VEVENT')
  }
  lineas.push('END:VCALENDAR')
  return lineas.map(icsDoblar).join('\r\n') + '\r\n'
}

// ── El hilo del foro (1197) ──
// El título del hilo: «Castellón Card Show · 7 y 8 de noviembre».
export function tituloDeHilo(e) {
  // Sin los nombres de los días: «Sábado 7 y domingo 8 de…» → «7 y 8 de…».
  const f = fechaLarga(e).split(' · ')[0].replace(/^(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo),? /, '').replace(/ y (lunes|martes|miércoles|jueves|viernes|sábado|domingo) /, ' y ')
  return `${e.nombre} · ${f.replace(/^Del /, 'del ')}`.slice(0, 150)
}

// El primer mensaje del hilo: lo que se lee y el enlace a la ficha (que el
// foro pinta como la tarjeta del evento, js/foro-eventos.js).
export function cuerpoDeHilo(e, escapar) {
  const esc = escapar || ((t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]))
  const ent = entradasDe(e)
  const lugar = [e.sitio, e.direccion, e.ciudad].filter(Boolean).join(', ')
  const partes = []
  if (e.descripcion) partes.push(...String(e.descripcion).split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`))
  const datos = [
    `<li><strong>Cuándo:</strong> ${esc(fechaLarga(e))}</li>`,
    lugar ? `<li><strong>Dónde:</strong> ${esc(lugar)}</li>` : '',
    ent.length ? `<li><strong>Entradas:</strong> ${esc(resumenEntradas(ent))}</li>` : e.entrada ? `<li><strong>Entrada:</strong> ${esc(e.entrada)}</li>` : '',
  ].filter(Boolean).join('')
  partes.push(`<ul>${datos}</ul>`)
  partes.push('<p>¿Quién se viene? Contad qué vais a llevar para cambiar y quedamos allí.</p>')
  // El enlace «a pelo» (el texto es la dirección): el foro lo convierte en la
  // tarjeta del evento (js/enlaces-internos.js).
  const url = `https://pokedoc.es/eventos/${encodeURIComponent(e.slug)}`
  partes.push(`<p><a href="${url}">${url}</a></p>`)
  return partes.join('')
}
