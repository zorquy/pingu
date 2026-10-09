// El tipo de energía del que habla un texto (787, SI4): la portada de una
// guía sin foto lleva el patrón de su símbolo. Puro y en su propio fichero:
// la tarjeta de guía la baja la portada, y energias.js pinta clases de Mi
// colección que la portada no carga (la 299).
// La primera palabra que case manda, y sin ninguna no hay patrón (no se
// inventa un tipo).
const PALABRAS_DE_TIPO = [
  ['G', /\bplanta\b|\bgrass\b/], ['R', /\bfuego\b|\bfire\b/], ['W', /\bagua\b|\bwater\b/],
  ['L', /\brayo\b|el[eé]ctric|\blightning\b/], ['P', /ps[ií]quic|\bpsychic\b/], ['F', /\blucha\b|\bfighting\b/],
  ['D', /\boscur[oa]\b|siniestr|\bdarkness\b/], ['M', /\bmetal\b|\bacero\b/], ['N', /\bdrag[oó]n\b/], ['Y', /\bhada\b|\bfairy\b/],
]
export function energiaDeTexto(texto) {
  const t = String(texto || '').toLowerCase()
  for (const [letra, re] of PALABRAS_DE_TIPO) if (re.test(t)) return letra
  return null
}
