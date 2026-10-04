// Qué contenido tiene una guía: sus dos mitades y qué cuenta como cada una.
//
// Una guía es documentación (`reference_blocks`) y, a veces, un curso
// jugable (`blocks`). Quién tiene qué lo preguntan la ficha, las tarjetas,
// /aprender, la página de categoría y el propio curso, así que la regla
// vive en un módulo PURO que pueden importar todos —y una prueba sin
// navegador—. El porqué largo, en SCHEMA.md, tanda 548.

// Los bloques que SE JUEGAN. El resto (hook, concept, tip) es teoría: se
// lee y se pasa.
export const PRACTICE_TYPES = ['quiz', 'truefalse', 'fillblank', 'match', 'order', 'cartaquiz', 'zonas', 'ordenprecio', 'clasifica', 'intruso', 'desliza', 'memoria', 'escribe', 'diferencias']

export function esPractica(block) {
  return !!block && PRACTICE_TYPES.includes(block.type)
}

// «Tiene curso» es «hay algo que JUGAR», no «hay bloques» (tanda 548): una
// guía de solo teoría enseñaba el botón «Hacer el curso» y detrás no había
// ni una pregunta. Lo contó quien se lo encontró.
export function guideHasCourse(guide) {
  if (!Array.isArray(guide?.blocks) || guide.blocks.length === 0) return false
  return guide.blocks.some(esPractica)
}

// La simétrica, para la parte de Documentación.
//
// Antes las tarjetas miraban `guide.has_reference_blocks`, un campo que NO
// calcula nadie en la web: solo existía en el stub de pruebas. Si la base
// no lo trae, sale undefined y la tarjeta cree que la guía no tiene
// documentación. Se deduce del contenido, y el campo, si viene, se respeta.
export function guideHasReference(guide) {
  if (typeof guide?.has_reference_blocks === 'boolean') return guide.has_reference_blocks
  return Array.isArray(guide?.reference_blocks) && guide.reference_blocks.length > 0
}
