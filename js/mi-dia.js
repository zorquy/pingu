// «Mi día» (870): los seis retos de hoy en un texto tipo Wordle, y la
// cabecera ÚNICA de todos los retos.
//
// PINGU: «joder, mira, hoy he hecho todos los retos, pero el de qué carta
// es es más complicado y lo he fallado». Eso es lo que se comparte aquí:
// una cabecera con el número del día y cuántos has hecho, una línea por
// reto con su emoji, su nombre corto y su tira, la corona del día perfecto y
// la racha. Nada desvela una respuesta: la tira dice cómo te ha ido, no qué
// era.
//
// Hasta la 869 cada reto llevaba su cabecera («Reto PokeDoc #77», «¿Qué
// carta es? #40», «¿Más caro o más barato? PokeDoc #12») y TRES
// numeraciones: quien veía dos tuits no sabía si eran del mismo día. Desde
// aquí el número es uno para todos —el del reto de preguntas, el más
// viejo y el que la gente ya ha publicado (`reto-compartir.js`, que no se
// mueve)— y la forma es una: «PokeDoc #77 · ¿Qué carta es? · 3/6».
//
// Los emojis van A PROPÓSITO (la norma de la 568): esto se pega en X o en
// WhatsApp, donde un SVG no existe. En la pantalla, los iconos de la casa.
// Sin DOM y sin Supabase: se prueba en Node.
import { numeroDelDia, tiraEmoji, ENLACE, NOMBRE_CORTO, cabeceraDeReto } from './reto-compartir.js'
import { RETOS } from './retos-xp.js'

export { numeroDelDia, ENLACE, cabeceraDeReto }
// «Mi día» manda al menú de los retos, no a uno.
export const ENLACE_RETOS = 'pokedoc.es/retos'

export const EMOJI = { reto: '📚', carta: '🃏', caro: '💶', silueta: '👤', ordena: '🔢', expansion: '📦', parejas: '🧠' }
export const CORTO = NOMBRE_CORTO
// Cuántos cuadrados tiene cada reto cuando no se ha jugado (en gris).
export const TAMANO = { reto: 5, carta: 6, caro: 5, silueta: 3, ordena: 3, expansion: 5, parejas: 6 }
// El reto de preguntas no guarda partida en el navegador (es de la base);
// el cuestionario deja aquí su tira de hoy para que «Mi día» la lea sin
// esperar a la base: { dia, tira }.
export const CLAVE_RETO_LOCAL = 'pokedoc-reto-hoy'

// De un resultado guardado en la base (`retos_mis_numeros().hoy[juego]`:
// { aciertos, total, intentos, acertada, tira }) a su tira de cuadrados.
// Los de una sola respuesta (carta, silueta, ordena) son un cuadrado por
// intento: fallos en rojo y, si acertaste, el último en verde.
export function tiraDeBase(juego, h) {
  if (!h) return null
  if (Array.isArray(h.tira) && h.tira.length) return h.tira.map(Boolean)
  // Parejas (989): la tira de movimientos va en la partida guardada.
  if (juego === 'parejas') return Array.isArray(h.estado?.tira) && h.estado.tira.length ? h.estado.tira.map(Boolean) : null
  if (['carta', 'silueta', 'ordena'].includes(juego)) {
    const n = Math.max(1, Number(h.intentos) || 1)
    return Array.from({ length: n }, (_, i) => Boolean(h.acertada) && i === n - 1)
  }
  const total = Number(h.total) || TAMANO[juego] || 0
  const aciertos = Math.min(total, Math.max(0, Number(h.aciertos) || 0))
  return Array.from({ length: total }, (_, i) => i < aciertos)
}

// De la partida que guarda el navegador (las mismas formas que
// `resumenLocal` en retos-xp.js) a su tira; null si no está terminada.
export function tiraLocal(juego, g, dia) {
  if (!g || g.dia !== dia) return null
  if (juego === 'reto') return Array.isArray(g.tira) && g.tira.length ? g.tira.map(Boolean) : null
  if (juego === 'carta') {
    const n = (g.intentos || []).length
    if (!n || !(g.acertada || n >= 6)) return null
    return Array.from({ length: n }, (_, i) => Boolean(g.acertada) && i === n - 1)
  }
  if (juego === 'caro') return (g.respuestas || []).length >= 5 ? g.respuestas.slice(0, 5).map(Boolean) : null
  if (juego === 'silueta') {
    const e = (g.elegidos || []).length
    if (!e || !(g.acertada || e >= 3)) return null
    return Array.from({ length: e }, (_, i) => Boolean(g.acertada) && i === e - 1)
  }
  if (juego === 'ordena') {
    const n = (g.intentos || []).length
    if (!n || !(g.acertada || n >= 3)) return null
    return Array.from({ length: n }, (_, i) => Boolean(g.acertada) && i === n - 1)
  }
  if (juego === 'expansion') return (g.elegidas || []).length >= 5 ? (g.tira || []).slice(0, 5).map(Boolean) : null
  if (juego === 'parejas') return (g.hechas || []).length >= TAMANO.parejas ? (g.tira || []).map(Boolean) : null
  return null
}

// Las filas del día, en el orden del menú: { juego, emoji, nombre, tira,
// hecho, acertado }. `resultados` = { juego: tira | null }.
export function filasDeMiDia(resultados = {}) {
  return RETOS.map((r) => {
    const tira = resultados[r.juego] || null
    const unaRespuesta = ['carta', 'silueta', 'ordena'].includes(r.juego)
    return {
      juego: r.juego,
      emoji: EMOJI[r.juego] || '🎯',
      nombre: CORTO[r.juego] || r.titulo,
      tira,
      hecho: Boolean(tira),
      // En los de una respuesta, «acertado» es el último cuadrado en verde;
      // Parejas siempre se acaba (989): hecho es acertado.
      acertado: tira ? (r.juego === 'parejas' || (unaRespuesta ? tira[tira.length - 1] === true : tira.every(Boolean))) : null,
    }
  })
}

const grises = (n) => '⬜'.repeat(n)

// El texto largo: una línea por reto.
export function textoDeMiDia({ dia, resultados = {}, rachaDias = 0, enlace = ENLACE_RETOS } = {}) {
  const filas = filasDeMiDia(resultados)
  const hechos = filas.filter((f) => f.hecho).length
  const perfecto = hechos === filas.length
  const lineas = [`PokeDoc #${numeroDelDia(dia)} · ${hechos}/${filas.length} retos${perfecto ? ' 👑' : ''}`]
  for (const f of filas) {
    const tira = f.tira ? tiraEmoji(f.tira) : grises(TAMANO[f.juego] || 3)
    const marca = f.tira && ['carta', 'silueta', 'ordena'].includes(f.juego) && !f.acertado ? ' ✗' : ''
    lineas.push(`${f.emoji} ${f.nombre}  ${tira}${marca}`)
  }
  if (rachaDias >= 2) lineas.push(`🔥 ${rachaDias} días seguidos`)
  lineas.push(enlace)
  return lineas.join('\n')
}

// El corto, de una línea: un cuadrado por reto (verde si lo acertaste o lo
// hiciste perfecto, amarillo si acertaste parte, rojo si nada, gris sin
// jugar).
export function textoCortoDeMiDia({ dia, resultados = {}, rachaDias = 0, enlace = ENLACE_RETOS } = {}) {
  const filas = filasDeMiDia(resultados)
  const hechos = filas.filter((f) => f.hecho).length
  const cuadros = filas.map((f) => (!f.hecho ? '⬜' : f.acertado ? '🟩' : f.tira.some(Boolean) && !['carta', 'silueta', 'ordena'].includes(f.juego) ? '🟨' : '🟥')).join('')
  const partes = [`PokeDoc #${numeroDelDia(dia)} · ${hechos}/${filas.length}${hechos === filas.length ? ' 👑' : ''}`, cuadros]
  if (rachaDias >= 2) partes.push(`🔥 ${rachaDias}`)
  partes.push(enlace)
  return partes.join(' · ')
}

// «Mi mes» (873): los últimos `n` días en filas de diez, con las cifras del
// calendario. Gris sin jugar, amarillo uno o dos retos, verde tres o más.
export function textoDeMiMes({ dias = {}, hoy, n = 30, jugados = 0, mejorRacha = 0, perfectos = 0, enlace = ENLACE_RETOS } = {}) {
  const [y, m, d] = String(hoy).split('-').map(Number)
  const cuadros = []
  for (let i = n - 1; i >= 0; i--) {
    const dia = new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10)
    const k = Number(dias[dia]) || 0
    cuadros.push(!k ? '⬜' : k >= 3 ? '🟩' : '🟨')
  }
  const filas = []
  for (let i = 0; i < cuadros.length; i += 10) filas.push(cuadros.slice(i, i + 10).join(''))
  const diasJugados = cuadros.filter((c) => c !== '⬜').length
  return [
    `PokeDoc · mis últimos ${n} días: ${diasJugados} jugados`,
    ...filas,
    `🎯 ${jugados} retos · 🔥 mejor racha ${mejorRacha} · 👑 ${perfectos} ${perfectos === 1 ? 'día perfecto' : 'días perfectos'}`,
    enlace,
  ].join('\n')
}
