// Las casas de gradeo y su escala (tanda 563).
//
// PINGU: «gradeo, que te deje elegir dos cosas, la casa —CGC, Beckett,
// PSA— y luego la nota en desplegable. Pero tiene que ir con, por
// ejemplo, PSA son números redondos pero también tiene algunos
// decimales, Beckett va con decimales. Depende de la casa».
//
// Era un campo de texto libre de 20 caracteres con «CGC 10» de ejemplo,
// así que lo que había escrito dentro era lo que a cada uno le hubiera
// parecido: «psa10», «Beckett 9'5», «grado 9». Un dato que luego se
// quiere FILTRAR o CONTAR —«enséñame mis PSA 10»— no puede ser prosa.
//
// ── POR QUÉ CADA CASA TIENE SU LISTA Y NO HAY UNA COMÚN ──
//
// Porque las escalas NO son la misma con otro nombre, y ofrecer una nota
// que la casa no da sería lo mismo que ofrecer una versión que de esa
// carta no se ha impreso (la lección de `variantes.js`): la colección
// acabaría diciendo que tienes un «PSA 9,5» que no existe.
//
//   · PSA va en números ENTEROS del 1 al 10 y tiene UNA sola media nota,
//     el 1.5. Más «Authentic», que es «es de verdad, pero sin nota».
//   · Beckett (BGS) va de medio en medio del 1 al 10, y por encima del 10
//     está la Black Label, que es un 10 con los cuatro subgrados a 10.
//   · CGC va de medio en medio y baja hasta el 0.5; su tope es la
//     «Perfect 10», que es su equivalente a la Black Label.
//   · SGC y ACE van de medio en medio del 1 al 10.
//
// ── LA NOTA SE ESCRIBE CON PUNTO, NO CON COMA ──
//
// Contra la norma de la casa de escribir en español, y a propósito: «9.5»
// no es un número que se calcule, es el NOMBRE que la casa le ha dado a
// la nota y lo que lleva impreso la cápsula. Escribir «BGS 9,5» sería
// traducir una etiqueta.
//
// Sin DOM y sin Supabase: se prueba en Node.

// De 10 a `hasta`, de medio en medio. Sale más barato que escribir las
// veinte a mano y, sobre todo, no se puede uno saltar una.
function mitades(hasta) {
  const n = []
  for (let v = 10; v >= hasta - 0.001; v -= 0.5) n.push(String(v))
  return n
}

export const CASAS = [
  // `nombre` es cómo se lee en el desplegable; `id` es lo que se guarda y
  // lo que lleva la cápsula impreso.
  { id: 'PSA', nombre: 'PSA', notas: ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1.5', '1', 'Authentic'] },
  { id: 'BGS', nombre: 'Beckett (BGS)', notas: ['10 Black Label', ...mitades(1)] },
  { id: 'CGC', nombre: 'CGC', notas: ['10 Perfect', ...mitades(0.5)] },
  { id: 'SGC', nombre: 'SGC', notas: mitades(1) },
  { id: 'ACE', nombre: 'ACE', notas: mitades(1) },
]

// El valor del desplegable de casa cuando lo que hay guardado no lo
// entendemos. No es una casa: es «déjame escribirlo a mano».
export const OTRA = 'otra'

export const casaDe = (id) => CASAS.find((c) => c.id === id) || null
export const notasDeCasa = (id) => casaDe(id)?.notas || []

// Lo que se guarda en la columna `gradeo`, que sigue siendo UN texto.
// Dos columnas habrían pedido una migración y, sobre todo, habrían
// dejado sin sentido lo que ya hay escrito ahí.
export function escribirGradeo(casa, nota) {
  if (!casa) return null
  if (casa === OTRA) return (nota || '').trim().slice(0, 20) || null
  if (!nota) return null
  return `${casa} ${nota}`.slice(0, 20)
}

// Y de vuelta. Lo que no se entiende NO se tira ni se corrige: vuelve
// como `otra` con su texto intacto, para que el desplegable pueda
// ofrecerlo tal cual. Un `<select>` cuyo valor no está entre sus
// opciones se queda con la primera y al guardar escribe ESA (tanda 472):
// aquí eso le cambiaría a alguien el PSA 10 por un «BGS 10 Black Label».
export function leerGradeo(txt) {
  const t = (txt || '').trim()
  if (!t) return { casa: '', nota: '', libre: '' }
  const sep = t.indexOf(' ')
  if (sep > 0) {
    const casa = casaDe(t.slice(0, sep).toUpperCase())
    const nota = t.slice(sep + 1).trim()
    if (casa && casa.notas.includes(nota)) return { casa: casa.id, nota, libre: '' }
  }
  return { casa: OTRA, nota: '', libre: t }
}
