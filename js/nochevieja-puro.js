// NOCHEVIEJA, lo puro (tanda 1288). La cuenta atrás hasta las 00:00 de España
// y las diapositivas de «Tu año en PokeDoc». Sin dependencias del documento:
// lo prueba Node y lo usa js/nochevieja.js.
import { hoyEnEspana } from './adviento-puro.js'

const dos = (n) => String(n).padStart(2, '0')

// El 31: cuánto falta para el 1 de enero a las 00:00 en España (en invierno,
// UTC+1). El 1 ya no hay cuenta: `feliz` con el año que empieza.
export function cuentaAtras(fecha = new Date()) {
  const h = hoyEnEspana(fecha)
  if (h.mes === 1) return { feliz: true, anio: h.anio, quedan: 0, texto: '' }
  const meta = new Date(`${h.anio + 1}-01-01T00:00:00+01:00`)
  const quedan = Math.max(0, meta.getTime() - fecha.getTime())
  if (quedan === 0) return { feliz: true, anio: h.anio + 1, quedan: 0, texto: '' }
  const s = Math.floor(quedan / 1000)
  return { feliz: false, anio: h.anio + 1, quedan, texto: `${dos(Math.floor(s / 3600))}:${dos(Math.floor(s / 60) % 60)}:${dos(s % 60)}` }
}

// El año que se resume: el que se acaba (el 1 de enero, el de ayer).
export function anioDelResumen(fecha = new Date()) {
  const h = hoyEnEspana(fecha)
  return h.mes === 1 ? h.anio - 1 : h.anio
}

const miles = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const plural = (n, uno, varios) => `${miles(n)} ${Number(n) === 1 ? uno : varios}`

// Las diapositivas, en orden: la portada, las que tienen algo que contar y el
// final (que es la que se comparte). Una cifra a cero no se enseña: «0 guías»
// no es un recuerdo.
export function diapositivas(d, anio) {
  const out = [{ tipo: 'portada', titulo: `Tu ${anio} en PokeDoc`, texto: d.nombre ? `${d.nombre}, esto es lo que ha dado de sí tu año.` : 'Esto es lo que ha dado de sí tu año.' }]
  if (d.cartas > 0) out.push({ tipo: 'cifra', cifra: miles(d.cartas), texto: `${Number(d.cartas) === 1 ? 'carta añadida' : 'cartas añadidas'} a tu colección en ${anio}`, icono: 'cards' })
  if (d.primera) out.push({ tipo: 'carta', carta: d.primera, texto: `Tu primera carta de ${anio}` })
  if (d.mejorRacha > 0) out.push({ tipo: 'cifra', cifra: miles(d.mejorRacha), texto: `${Number(d.mejorRacha) === 1 ? 'día' : 'días'}: tu mejor racha de retos${d.retos > 0 ? ` (${plural(d.retos, 'reto jugado', 'retos jugados')})` : ''}`, icono: 'flame' })
  if (d.mensajes > 0 || d.guias > 0) {
    const partes = [d.mensajes > 0 ? plural(d.mensajes, 'mensaje en el foro', 'mensajes en el foro') : '', d.guias > 0 ? plural(d.guias, 'guía leída', 'guías leídas') : ''].filter(Boolean)
    out.push({ tipo: 'cifra', cifra: miles(d.mensajes > 0 ? d.mensajes : d.guias), texto: partes.join(' · ').replace(/^[\d.]+ /, ''), icono: d.mensajes > 0 ? 'messageSquare' : 'bookOpen' })
  }
  out.push({ tipo: 'final', titulo: `¡Feliz ${anio + 1}!`, cifras: resumenFinal(d), texto: 'Gracias por pasar el año con nosotros.' })
  return out
}

// Las tres o cuatro cifras de la última diapositiva (y de la imagen).
export function resumenFinal(d) {
  return [
    [d.cartas, 'cartas añadidas'],
    [d.mejorRacha, 'días de racha'],
    [d.mensajes, 'mensajes'],
    [d.logros, 'logros'],
  ].filter(([n]) => Number(n) > 0).map(([n, t]) => [miles(n), t])
}
