// Lo que hay que hacer para conseguir un logro, en una frase (tanda 1117).
//
// La descripción de cada logro está escrita en pasado («Completaste una
// expansión entera»), que es lo que se lee cuando ya lo tienes. Para uno que
// no tienes hace falta el OBJETIVO, y sale de su condición (tipo y cuenta),
// que es lo que de verdad comprueba la base. Lo que no tiene condición que
// contar (los de torneo, `manual`) va por su id. Puro: lo prueba Node.
const UNO = (n) => Number(n) === 1

const FRASES = {
  completed_guides_count: (n) => (UNO(n) ? 'Completa tu primer curso.' : `Completa ${n} cursos.`),
  total_xp: (n) => `Llega a ${Number(n).toLocaleString('es-ES')} XP.`,
  quiz_correct_count: (n) => `Acierta ${n} preguntas en los cursos.`,
  approved_guides_count: (n) => (UNO(n) ? 'Publica una guía y que la aprueben.' : `Publica ${n} guías aprobadas.`),
  forum_posts_count: (n) => (UNO(n) ? 'Escribe tu primer mensaje en el foro.' : `Escribe ${n} mensajes en el foro.`),
  forum_threads_count: (n) => (UNO(n) ? 'Abre tu primer tema en el foro.' : `Abre ${n} temas en el foro.`),
  forum_reactions_received: (n) => `Consigue ${n} reacciones a tus mensajes del foro.`,
  collection_cards_count: (n) => `Ten ${Number(n).toLocaleString('es-ES')} cartas distintas en tu colección.`,
  collection_sets_complete: (n) => (UNO(n) ? 'Completa una expansión entera.' : `Completa ${n} expansiones enteras.`),
  collection_top_card_eur: (n) => `Ten en tu colección una carta que valga más de ${n} €.`,
  collection_illustrator_cards: (n) => `Ten ${n} cartas de un mismo ilustrador.`,
  collection_pokedex_regions: (n) => (UNO(n) ? 'Ten una carta de cada Pokémon de una región entera.' : `Completa ${n} regiones de la Pokédex.`),
  trades_done_count: (n) => (UNO(n) ? 'Cierra tu primer cambio con alguien de PokeDoc.' : `Cierra ${n} cambios con otras personas de PokeDoc.`),
  primeros_pasos: () => 'Completa los primeros pasos de la portada.',
  referrals_count: (n) => (UNO(n) ? 'Invita a alguien que se registre con tu enlace.' : `Invita a ${n} personas que se registren con tu enlace.`),
  was_referred: () => 'Regístrate con el enlace de invitación de alguien.',
  retos_racha: (n) => `Juega algún reto diario ${n} días seguidos.`,
  retos_perfectos: (n) => (UNO(n) ? 'Completa todos los retos de un mismo día.' : `Completa todos los retos del día ${n} días.`),
  retos_jugados: (n) => `Juega ${n} retos diarios.`,
  carta_primera: () => 'Acierta «¿Qué carta es?» a la primera.',
  carta_aciertos: (n) => `Acierta ${n} cartas en «¿Qué carta es?».`,
  caro_perfectos: (n) => (UNO(n) ? 'Haz cinco de cinco en «¿Más caro o más barato?».' : `Haz ${n} veces cinco de cinco en «¿Más caro o más barato?».`),
}

const POR_ID = {
  torneo_jugado: 'Juega un torneo de PokeDoc hasta el final.',
  torneo_veterano: 'Juega cinco torneos de PokeDoc hasta el final.',
  torneo_habitual: 'Juega diez torneos de PokeDoc.',
  torneo_top_cut: 'Entra en el top cut de un torneo.',
  torneo_podio: 'Termina entre los tres primeros de un torneo.',
  torneo_campeon: 'Gana un torneo de PokeDoc.',
  torneo_tricampeon: 'Gana tres torneos de PokeDoc.',
}

// La frase del objetivo, o null si no se sabe decir (entonces se enseña la
// descripción tal cual). Si en /admin se ha escrito una a mano (`objetivo`,
// 1118), manda esa.
export function objetivoDeLogro(logro) {
  if (!logro) return null
  const propia = String(logro.objetivo ?? '').trim()
  if (propia) return propia
  return objetivoAutomatico(logro)
}

// La que sale sola de la regla: la que /admin enseña mientras editas.
export function objetivoAutomatico(logro) {
  if (!logro) return null
  if (POR_ID[logro.id]) return POR_ID[logro.id]
  const tipo = logro.condition?.type
  const frase = FRASES[tipo]
  if (!frase) return null
  return frase(logro.condition?.count ?? 1)
}

// «Lo tiene el 3 %» (793): cuánta gente tiene un logro, en palabras.
export function textoDeReparto(personas, total) {
  if (!total) return ''
  const p = (personas / total) * 100
  if (p === 0) return 'Nadie la tiene aún'
  if (p < 1) return 'La tiene menos del 1 %'
  return `La tiene el ${Math.round(p).toLocaleString('es-ES')} %`
}

export const RAREZAS = { bronze: 'Bronce', silver: 'Plata', gold: 'Oro', platinum: 'Platino' }

// Las familias del panel de /admin (1118) y los tipos de condición que
// comprueba la web, con su nombre. La lista de tipos es la de `FRASES`: un
// tipo nuevo va en los dos sitios (la prueba 1118 lo vigila).
export const FAMILIAS = {
  cursos: 'Cursos',
  foro: 'Foro',
  guias: 'Guías',
  coleccion: 'Colección',
  retos: 'Retos',
  torneos: 'Torneos',
  comunidad: 'Comunidad',
}

export const TIPOS = [
  { tipo: 'completed_guides_count', etiqueta: 'Cursos completados', familia: 'cursos' },
  { tipo: 'quiz_correct_count', etiqueta: 'Preguntas acertadas en los cursos', familia: 'cursos' },
  { tipo: 'total_xp', etiqueta: 'XP total', familia: 'cursos' },
  { tipo: 'forum_posts_count', etiqueta: 'Mensajes en el foro', familia: 'foro' },
  { tipo: 'forum_threads_count', etiqueta: 'Temas abiertos en el foro', familia: 'foro' },
  { tipo: 'forum_reactions_received', etiqueta: 'Reacciones recibidas en el foro', familia: 'foro' },
  { tipo: 'approved_guides_count', etiqueta: 'Guías aprobadas (autor)', familia: 'guias' },
  { tipo: 'collection_cards_count', etiqueta: 'Cartas distintas en la colección', familia: 'coleccion' },
  { tipo: 'collection_sets_complete', etiqueta: 'Expansiones completas', familia: 'coleccion' },
  { tipo: 'collection_top_card_eur', etiqueta: 'Una carta que vale más de (€)', familia: 'coleccion' },
  { tipo: 'collection_illustrator_cards', etiqueta: 'Cartas de un mismo ilustrador', familia: 'coleccion' },
  { tipo: 'collection_pokedex_regions', etiqueta: 'Regiones de la Pokédex completas', familia: 'coleccion' },
  { tipo: 'trades_done_count', etiqueta: 'Cambios hechos', familia: 'coleccion' },
  { tipo: 'retos_racha', etiqueta: 'Días seguidos jugando retos', familia: 'retos' },
  { tipo: 'retos_perfectos', etiqueta: 'Días con todos los retos hechos', familia: 'retos' },
  { tipo: 'retos_jugados', etiqueta: 'Retos jugados', familia: 'retos' },
  { tipo: 'carta_primera', etiqueta: '«¿Qué carta es?» a la primera', familia: 'retos' },
  { tipo: 'carta_aciertos', etiqueta: 'Aciertos en «¿Qué carta es?»', familia: 'retos' },
  { tipo: 'caro_perfectos', etiqueta: 'Cinco de cinco en «¿Más caro o más barato?»', familia: 'retos' },
  { tipo: 'primeros_pasos', etiqueta: 'Primeros pasos de la portada', familia: 'comunidad' },
  { tipo: 'referrals_count', etiqueta: 'Personas invitadas', familia: 'comunidad' },
  { tipo: 'was_referred', etiqueta: 'Entró con una invitación', familia: 'comunidad' },
  { tipo: 'manual', etiqueta: 'A mano o por un torneo', familia: 'torneos' },
]

export function familiaDeLogro(logro) {
  if (String(logro?.id || '').startsWith('torneo_')) return 'torneos'
  return TIPOS.find((t) => t.tipo === logro?.condition?.type)?.familia || 'comunidad'
}

export const TIPOS_CON_FRASE = Object.keys(FRASES)
