// Las reglas del juego de los cursos, sin nada de DOM ni de red.
//
// Está aparte de `curso.js` a propósito: estas reglas las necesitan
// también el reto diario y el repaso de fallos, y separadas se pueden
// probar solas, sin montar media página.

// Los bloques que se juegan. El resto (hook, concept, tip…) son teoría:
// se leen y se pasa.
export const PRACTICE_TYPES = ['quiz', 'truefalse', 'fillblank', 'match', 'order', 'cartaquiz', 'zonas', 'ordenprecio', 'clasifica', 'intruso', 'desliza', 'memoria']

export function esPractica(block) {
  return !!block && PRACTICE_TYPES.includes(block.type)
}

// ── Puntuación ──
//
// Un acierto valen 10 puntos, pero lo que engancha no es el 10: es que
// el siguiente valga 20. Por eso el multiplicador sube con la racha y se
// cae entero al primer fallo — la tensión de "no la falles ahora" es
// justo lo que le faltaba a esto para dejar de ser un examen.
export const PUNTOS_BASE = 10

// Acertar en la repesca (una pregunta que ya fallaste y vuelve al final)
// vale poco a propósito: sirve para aprenderla, no para recuperar los
// puntos que perdiste. Si valiera lo mismo, fallar no costaría nada y
// volveríamos al problema de partida.
export const PUNTOS_REPESCA = 3

// Terminar sin fallar ni una.
export const BONUS_PERFECTO = 100

export function multiplicadorDe(racha) {
  if (racha >= 5) return 3
  if (racha >= 3) return 2
  return 1
}

// `racha` es la racha ANTES de contar este acierto.
export function puntosPor(racha) {
  return PUNTOS_BASE * multiplicadorDe(racha)
}

// ── Medallas ──
//
// ⚠️ Estos tres umbrales están repetidos en el disparador
// `course_attempt_medalla()` de supabase-migration-cursos-juego.sql. Los
// de allí son los que mandan: la medalla que se guarda la calcula la
// base, no el navegador. Estos son para poder enseñarla en pantalla
// antes de guardar nada. Si se tocan aquí, hay que tocarlos allí.
export const MEDALLAS = {
  oro: { nombre: 'Oro', minimo: 1 },
  plata: { nombre: 'Plata', minimo: 0.8 },
  bronce: { nombre: 'Bronce', minimo: 0.5 },
}

export function medallaDe(aciertos, total) {
  if (!total || total <= 0) return null
  const ratio = aciertos / total
  if (ratio >= MEDALLAS.oro.minimo) return 'oro'
  if (ratio >= MEDALLAS.plata.minimo) return 'plata'
  if (ratio >= MEDALLAS.bronce.minimo) return 'bronce'
  return null
}

const ORDEN_MEDALLA = { bronce: 1, plata: 2, oro: 3 }

export function medallaMejor(a, b) {
  return (ORDEN_MEDALLA[a] || 0) >= (ORDEN_MEDALLA[b] || 0) ? a : b
}

// XP por SUBIR de medalla, no por repetir el curso.
//
// Sin esto, repetir un curso fácil veinte veces sería la forma más
// rápida de subir de nivel del sitio entero. Así, mejorar de bronce a
// oro da 35 XP en total y ya nunca más: el techo por curso está puesto y
// no depende de cuántas veces lo juegues.
export const XP_POR_MEDALLA = { bronce: 0, plata: 10, oro: 25 }

export function xpPorMejoraDeMedalla(anterior, nueva) {
  const antes = XP_POR_MEDALLA[anterior] || 0
  const ahora = XP_POR_MEDALLA[nueva] || 0
  return Math.max(0, ahora - antes)
}

// ── La clave de una pregunta ──
//
// Sirve para dos cosas: acumular "cuánta gente falla esta pregunta" y
// apuntar lo que tienes pendiente de repasar.
//
// Es un hash del ENUNCIADO, no la posición del bloque. Con la posición,
// reordenar los bloques de un curso mezclaría las estadísticas de unas
// preguntas con las de otras. Con el enunciado, reordenar no afecta y
// reescribir la pregunta la convierte en otra distinta, que empieza de
// cero — que es lo correcto: el "43 % la falló" de la pregunta vieja no
// dice nada de la nueva.
const PREFIJO = {
  quiz: 'q',
  truefalse: 'v',
  fillblank: 'h',
  match: 'p',
  order: 'o',
  cartaquiz: 'c',
  zonas: 'z',
  ordenprecio: 'e',
  clasifica: 'k',
  intruso: 'n',
  desliza: 'd',
  memoria: 'y',
}

function normaliza(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

// FNV-1a de 32 bits. No hace falta nada criptográfico: esto solo tiene
// que dar siempre lo mismo para el mismo texto, en cualquier navegador.
function hash32(texto) {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

// El texto que identifica a cada tipo de pregunta. Se coge el enunciado
// y lo mínimo que haga falta para distinguir dos preguntas que empiezan
// igual.
function enunciadoDe(block) {
  switch (block.type) {
    case 'quiz':
      return block.question
    case 'truefalse':
      return block.statement
    case 'fillblank':
      return `${block.before || ''}|${block.after || ''}`
    case 'match':
      return `${block.title || ''}|${(block.pairs || []).map((p) => p.left).join(',')}`
    case 'order':
      return `${block.title || ''}|${(block.items || []).join(',')}`
    case 'cartaquiz':
      return `${block.question || ''}|${(block.cards || []).map((c) => c.id).join(',')}`
    case 'zonas':
      return `${block.question || ''}|${block.image_url || ''}`
    case 'ordenprecio':
      return (block.cards || []).map((c) => c.id).join(',')
    case 'clasifica':
      return `${block.title || ''}|${(block.buckets || []).join(',')}`
    case 'intruso':
      return `${block.question || ''}|${(block.card_ids || []).join(',')}`
    case 'desliza':
      return `${block.title || ''}|${(block.afirmaciones || []).map((a) => a.text).join(',')}`
    case 'memoria':
      return `${block.title || ''}|${(block.card_ids || []).join(',')}`
    default:
      return JSON.stringify(block)
  }
}

export function claveDePregunta(block) {
  if (!block || !block.type) return null
  const prefijo = PREFIJO[block.type] || 'x'
  return prefijo + hash32(normaliza(enunciadoDe(block))).toString(36)
}

// ── El marcador de una partida ──
//
// Un objeto pequeño con las reglas dentro, para que `curso.js` no tenga
// que acordarse de cuándo se rompe la racha ni de qué cuenta para la
// medalla.
export function nuevaPartida(totalPreguntas) {
  return {
    puntos: 0,
    racha: 0,
    mejorRacha: 0,
    aciertos: 0,
    total: totalPreguntas,
    // Preguntas ya respondidas por primera vez, por clave. Lo que
    // impide que ir y volver con "Anterior" cuente dos veces.
    respondidas: new Set(),
  }
}

// Devuelve cuántos puntos ha ganado esta respuesta, y deja la partida
// actualizada. `esRepesca` es una pregunta que ya fallaste antes y
// vuelve al final del curso.
export function anotarRespuesta(partida, { clave, acierto, esRepesca = false }) {
  if (esRepesca) {
    // La repesca no toca la racha ni los aciertos: la nota de la partida
    // ya está puesta. Solo da unos puntos por aprendértela.
    const ganados = acierto ? PUNTOS_REPESCA : 0
    partida.puntos += ganados
    return ganados
  }

  // Segunda vez que se ve la misma pregunta (por haber dado a
  // "Anterior"): ni puntúa ni cuenta.
  if (clave && partida.respondidas.has(clave)) return 0
  if (clave) partida.respondidas.add(clave)

  if (!acierto) {
    partida.racha = 0
    return 0
  }

  const ganados = puntosPor(partida.racha)
  partida.puntos += ganados
  partida.racha += 1
  partida.aciertos += 1
  if (partida.racha > partida.mejorRacha) partida.mejorRacha = partida.racha
  return ganados
}

// Al terminar: cierra el marcador con el bonus y devuelve el resumen que
// se guarda en `course_attempts`.
export function cerrarPartida(partida) {
  const perfecto = partida.total > 0 && partida.aciertos === partida.total
  if (perfecto) partida.puntos += BONUS_PERFECTO
  return {
    score: partida.puntos,
    correct: partida.aciertos,
    total: partida.total,
    medal: medallaDe(partida.aciertos, partida.total),
    perfecto,
    mejorRacha: partida.mejorRacha,
  }
}
