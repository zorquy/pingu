// El reto diario y el repaso de lo fallado.
//
// Las dos cosas son lo mismo por dentro: una lista corta de preguntas
// sacadas de cursos ya publicados, que se juega con el mismo motor que
// un curso (`curso.js`). Aquí solo se decide QUÉ preguntas.
import { supabase } from './supabase.js'
import { esPractica, claveDePregunta } from './curso-juego.js'
import { pendientesDeRepaso } from './curso-datos.js'

export const PREGUNTAS_POR_RETO = 5

// XP por jugar el reto del día. Una vez al día y punto: la clave
// primaria (user_id, day) de `daily_challenge_results` es lo que impide
// repetirlo hasta que salga bien.
export const XP_RETO_DIARIO = 15

// XP por recuperar una pregunta que habías fallado. Poco, porque el
// premio de verdad es dejar de fallarla.
export const XP_POR_RECUPERADA = 3

export function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

// Un generador de números pseudoaleatorios con semilla (mulberry32).
//
// Hace falta que sea CON SEMILLA: las cinco preguntas del día tienen que
// ser las mismas para todo el mundo, o no hay reto que comparar. Con la
// fecha como semilla sale solo, sin ningún proceso que las prepare cada
// noche.
export function generadorConSemilla(semilla) {
  let a = semilla >>> 0
  return function siguiente() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), 1 | t)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function semillaDeFecha(dia) {
  let h = 0
  const texto = String(dia)
  for (let i = 0; i < texto.length; i++) h = (Math.imul(31, h) + texto.charCodeAt(i)) | 0
  return h >>> 0
}

// Baraja con semilla (Fisher-Yates). Mismo día → mismo orden.
export function barajarConSemilla(lista, semilla) {
  const a = [...lista]
  const azar = generadorConSemilla(semilla)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Todas las preguntas de todos los cursos publicados, cada una con el
// curso del que sale (hace falta para apuntar la estadística en la
// pregunta correcta).
export async function todasLasPreguntas() {
  const { data, error } = await supabase
    .from('guides')
    .select('id, slug, title, blocks')
    .not('published_at', 'is', null)
  if (error || !data) return []

  const preguntas = []
  data.forEach((g) => {
    if (!Array.isArray(g.blocks)) return
    g.blocks.filter(esPractica).forEach((b) => {
      preguntas.push({ ...b, __guideId: g.id, __guideSlug: g.slug, __guideTitle: g.title })
    })
  })
  return preguntas
}

// Las cinco del día. Deterministas: la fecha manda.
export async function preguntasDelDia(dia = hoyISO()) {
  const todas = await todasLasPreguntas()
  if (!todas.length) return []
  // Se ordenan primero por su clave para que el resultado no dependa del
  // orden en que Supabase devuelva los cursos, que no está garantizado.
  const estables = [...todas].sort((a, b) => String(claveDePregunta(a)).localeCompare(String(claveDePregunta(b))))
  return barajarConSemilla(estables, semillaDeFecha(dia)).slice(0, PREGUNTAS_POR_RETO)
}

export async function yaJugadoHoy(userId, dia = hoyISO()) {
  if (!userId) return false
  try {
    const { data, error } = await supabase
      .from('daily_challenge_results')
      .select('correct, total, score')
      .eq('user_id', userId)
      .eq('day', dia)
      .maybeSingle()
    if (error) return false
    return data || false
  } catch {
    return false
  }
}

export async function guardarReto(userId, resumen, dia = hoyISO()) {
  if (!userId) return false
  try {
    const { error } = await supabase.from('daily_challenge_results').insert({
      user_id: userId,
      day: dia,
      correct: resumen.correct,
      total: resumen.total,
      score: resumen.score,
    })
    return !error
  } catch {
    return false
  }
}

// Las preguntas que toca repasar. El bloque va guardado entero en la
// cola, así que esto funciona aunque el curso original haya cambiado o
// se haya despublicado.
export async function preguntasDeRepaso(userId, limite = PREGUNTAS_POR_RETO) {
  const filas = await pendientesDeRepaso(userId, limite)
  return filas
    .filter((f) => f.block && esPractica(f.block))
    .map((f) => ({ ...f.block, __guideId: f.guide_id, __repaso: true }))
}
