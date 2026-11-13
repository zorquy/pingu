// Tu calendario de PokeDoc (tanda 1321, P7 del plan): lo que devuelve
// `calendario_de` (la base) convertido en un .ics al que se suscriben Google
// Calendar o el del iPhone. Puro: lo usan la función `calendario` y la prueba.
import { icsTexto, icsUtc, icsDia, icsDoblar, veventosDeEvento } from './eventos-puro.js'

const SITIO = 'https://pokedoc.es'
const DOS_HORAS = 2 * 3600e3
const CUATRO_HORAS = 4 * 3600e3

const evento = ({ uid, ahora, inicio, fin, diaEntero, titulo, url, desc }) => {
  const l = ['BEGIN:VEVENT', `UID:${uid}@pokedoc.es`, `DTSTAMP:${icsUtc(ahora)}`]
  if (diaEntero) {
    const sig = new Date(`${diaEntero}T12:00:00Z`)
    sig.setUTCDate(sig.getUTCDate() + 1)
    l.push(`DTSTART;VALUE=DATE:${icsDia(diaEntero)}`, `DTEND;VALUE=DATE:${icsDia(sig.toISOString().slice(0, 10))}`)
  } else {
    l.push(`DTSTART:${icsUtc(inicio)}`, `DTEND:${icsUtc(fin)}`)
  }
  l.push(`SUMMARY:${icsTexto(titulo)}`)
  if (desc) l.push(`DESCRIPTION:${icsTexto(desc)}`)
  if (url) l.push(`URL:${url}`)
  l.push('END:VEVENT')
  return l
}

// Una fecha de jornada puede venir como día («2026-11-19») o con hora.
const fechaDeJornada = (x) => {
  const t = typeof x === 'string' ? x : x?.fecha || x?.dia || ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return { dia: t }
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : { inicio: d }
}

export function icsDeCalendario(datos, { ahora = new Date() } = {}) {
  const l = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PokeDoc//Tu calendario//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:PokeDoc', 'X-WR-TIMEZONE:Europe/Madrid',
    // Cada cuánto vuelve a mirar (Apple y Outlook lo leen; Google va a su ritmo).
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
  ]
  for (const t of datos?.torneos || []) {
    const url = `${SITIO}/torneo?id=${encodeURIComponent(t.id)}`
    const jornadas = Array.isArray(t.jornadas) ? t.jornadas : []
    if (jornadas.length) {
      jornadas.forEach((j, i) => {
        const f = fechaDeJornada(j)
        if (!f) return
        l.push(...evento({ uid: `torneo-${t.id}-j${i + 1}`, ahora, titulo: `${t.nombre} · Jornada ${i + 1}`, url, desc: 'Manda tu lista antes de que empiece.', ...(f.dia ? { diaEntero: f.dia } : { inicio: f.inicio, fin: new Date(f.inicio.getTime() + DOS_HORAS) }) }))
      })
    } else if (t.empieza) {
      const ini = new Date(t.empieza)
      if (!Number.isNaN(ini.getTime())) l.push(...evento({ uid: `torneo-${t.id}`, ahora, inicio: ini, fin: new Date(ini.getTime() + CUATRO_HORAS), titulo: `Torneo: ${t.nombre}`, url }))
    }
  }
  for (const e of datos?.eventos || []) l.push(...veventosDeEvento(e, `${SITIO}/eventos/${encodeURIComponent(e.slug)}`, ahora))
  for (const s of datos?.lanzamientos || []) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(s.dia || ''))) continue
    const catalogo = s.market === 'JP' ? 'JP' : ''
    l.push(...evento({ uid: `sale-${s.market || 'WEST'}-${s.id}`, ahora, diaEntero: String(s.dia).slice(0, 10), titulo: `Sale ${s.nombre}${catalogo ? ' (Japón)' : ''}`, url: `${SITIO}/lanzamientos` }))
  }
  l.push('END:VCALENDAR')
  return l.map(icsDoblar).join('\r\n') + '\r\n'
}

// Las direcciones para suscribirse: la misma con webcal:// (el iPhone la abre
// en Calendario) y en Google Calendar (que acepta la webcal en `cid`).
export function enlacesDeCalendario(clave, origen = SITIO) {
  const https = `${origen}/cal/${clave}.ics`
  const webcal = https.replace(/^https?:/, 'webcal:')
  return { https, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` }
}

