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
// descripción tal cual).
export function objetivoDeLogro(logro) {
  if (!logro) return null
  if (POR_ID[logro.id]) return POR_ID[logro.id]
  const tipo = logro.condition?.type
  const frase = FRASES[tipo]
  if (!frase) return null
  return frase(logro.condition?.count ?? 1)
}

export const RAREZAS = { bronze: 'Bronce', silver: 'Plata', gold: 'Oro', platinum: 'Platino' }
