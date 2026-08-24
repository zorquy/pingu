// El chequeo de cursos: repasa los bloques de un curso metidos a mano
// en el editor y avisa de lo que cojea ANTES de que le toque a un
// usuario en mitad de una partida. Un índice fuera de rango o un slug
// mal escrito no rompen nada de forma ruidosa — la pregunta simplemente
// se comporta raro — y por eso hace falta este repaso explícito.
//
// Devuelve textos en cristiano, listos para pintar en el /admin:
// «bloque 4 (Pregunta): el índice de la correcta es 5 pero solo hay 4
// opciones». No lanza jamás: un bloque con forma imposible es un
// hallazgo más, no una excepción.

const ETIQUETAS = {
  hook: 'Enganche inicial',
  concept: 'Concepto',
  warning: 'Aviso',
  tip: 'Consejo',
  example: 'Ejemplo',
  quiz: 'Pregunta',
  truefalse: 'Verdadero o falso',
  fillblank: 'Rellenar hueco',
  match: 'Relacionar parejas',
  order: 'Ordenar pasos',
  cartaquiz: 'Elegir la carta',
  zonas: 'Encontrar el fallo',
  clasifica: 'Clasificar cartas',
  intruso: 'El intruso',
  desliza: 'Desliza',
  memoria: 'Memoria',
  escribe: 'Escribe la respuesta',
  diferencias: 'Las diferencias',
  checklist: 'Checklist',
  reward: 'Recompensa final',
}

const texto = (v) => typeof v === 'string' && v.trim().length > 0
const lista = (v) => (Array.isArray(v) ? v : [])

// Los avisos de UN bloque. `slugsPublicados` es un Set con los slugs de
// las guías publicadas, para validar el «siguiente curso» del reward.
function avisosDeBloque(block, slugsPublicados) {
  const avisos = []
  const b = block || {}
  switch (b.type) {
    case 'hook':
      if (!texto(b.headline)) avisos.push('le falta el titular')
      break
    case 'concept':
    case 'warning':
    case 'tip':
    case 'example':
      if (!texto(b.body) && !texto(b.title)) avisos.push('no tiene ni título ni texto')
      break
    case 'quiz': {
      const opciones = lista(b.options).filter(texto)
      if (!texto(b.question)) avisos.push('le falta la pregunta')
      if (opciones.length < 2) avisos.push('necesita al menos 2 opciones')
      const i = Number(b.correct_index)
      if (!Number.isInteger(i) || i < 0 || i >= opciones.length)
        avisos.push(`el índice de la correcta es ${b.correct_index ?? 'vacío'} pero hay ${opciones.length} opciones (va de 0 a ${Math.max(opciones.length - 1, 0)})`)
      break
    }
    case 'truefalse':
      if (!texto(b.statement)) avisos.push('le falta la afirmación')
      if (typeof b.is_true !== 'boolean') avisos.push('no dice si es verdadera o falsa')
      break
    case 'fillblank': {
      const opciones = lista(b.options).filter(texto)
      if (!texto(b.before) && !texto(b.after)) avisos.push('no tiene texto alrededor del hueco')
      if (opciones.length < 2) avisos.push('necesita al menos 2 opciones')
      if (!texto(b.correct_option)) avisos.push('le falta la opción correcta')
      else if (opciones.length && !opciones.includes(b.correct_option.trim()))
        avisos.push(`la correcta «${b.correct_option}» no está entre las opciones (¿errata?)`)
      break
    }
    case 'match': {
      const parejas = lista(b.pairs).filter((p) => texto(p?.left) && texto(p?.right))
      if (parejas.length < 2) avisos.push('necesita al menos 2 parejas completas (término :: definición)')
      break
    }
    case 'order':
      if (lista(b.items).filter(texto).length < 2) avisos.push('necesita al menos 2 pasos')
      break
    case 'cartaquiz': {
      const cartas = lista(b.card_ids).filter(texto)
      if (cartas.length < 2) avisos.push('necesita al menos 2 cartas')
      if (!texto(b.correct_id)) avisos.push('le falta la carta correcta')
      else if (cartas.length && !cartas.includes(b.correct_id.trim()))
        avisos.push(`la carta correcta «${b.correct_id}» no está entre las elegidas`)
      break
    }
    case 'intruso': {
      const cartas = lista(b.card_ids).filter(texto)
      if (cartas.length < 3) avisos.push('necesita al menos 3 cartas')
      if (!texto(b.intruso_id)) avisos.push('le falta la carta intrusa')
      else if (cartas.length && !cartas.includes(b.intruso_id.trim()))
        avisos.push(`la intrusa «${b.intruso_id}» no está entre las elegidas`)
      break
    }
    case 'zonas':
      if (!texto(b.image_url)) avisos.push('le falta la imagen')
      if (lista(b.zones).length < 1) avisos.push('no tiene ninguna zona marcada')
      break
    case 'diferencias':
      if (!texto(b.image_left_url)) avisos.push('le falta la imagen A (la original)')
      if (!texto(b.image_url)) avisos.push('le falta la imagen B (la de las diferencias)')
      if (lista(b.zones).length < 1) avisos.push('no tiene ninguna diferencia marcada')
      break
    case 'clasifica': {
      const montones = lista(b.buckets).filter(texto)
      const cartas = lista(b.cards).filter((c) => texto(c?.id) && texto(c?.bucket))
      if (montones.length < 2) avisos.push('necesita al menos 2 montones')
      if (cartas.length < 1) avisos.push('no tiene cartas que clasificar')
      cartas.forEach((c) => {
        if (montones.length && !montones.includes(c.bucket.trim()))
          avisos.push(`la carta ${c.id} apunta al montón «${c.bucket}», que no existe`)
      })
      break
    }
    case 'desliza': {
      const filas = lista(b.afirmaciones).filter((a) => texto(a?.text) && typeof a?.es_verdad === 'boolean')
      if (filas.length < 1) avisos.push('no tiene afirmaciones válidas (texto :: v/f)')
      break
    }
    case 'memoria': {
      const cartas = lista(b.card_ids).filter(texto)
      if (cartas.length < 3 || cartas.length > 6) avisos.push(`lleva ${cartas.length} cartas y el tablero pide de 3 a 6`)
      break
    }
    case 'escribe':
      if (!texto(b.question)) avisos.push('le falta la pregunta')
      if (lista(b.answers).filter(texto).length < 1) avisos.push('no tiene ninguna respuesta aceptada')
      break
    case 'checklist':
      if (lista(b.items).filter(texto).length < 1) avisos.push('está vacía')
      break
    case 'reward': {
      const slug = (b.next_guide_slug || '').trim()
      if (slug && slugsPublicados && !slugsPublicados.has(slug))
        avisos.push(`el siguiente curso apunta a «${slug}», que no es el slug de ninguna guía publicada`)
      break
    }
    default:
      avisos.push(`tipo desconocido «${b.type}»`)
  }
  return avisos
}

// Los avisos de un curso entero (su lista de bloques), con la posición
// y la etiqueta humana de cada bloque delante.
export function revisarBloques(blocks, slugsPublicados) {
  const avisos = []
  const bloques = lista(blocks)
  bloques.forEach((b, i) => {
    for (const aviso of avisosDeBloque(b, slugsPublicados)) {
      avisos.push(`bloque ${i + 1} (${ETIQUETAS[b?.type] || b?.type || '¿?'}): ${aviso}`)
    }
  })
  if (bloques.length && !bloques.some((b) => b?.type === 'reward'))
    avisos.push('el curso no termina en Recompensa final')
  return avisos
}
