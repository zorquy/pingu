// Tanda 1204 — la franja del próximo evento en la portada, en una línea (PINGU:
// «ocupa más en vertical… solo dejaría el título… y las fechas… y los que van
// de PokeDoc, con sus avatares… y donde va el 7 de noviembre, el logo»; eligió
// «caras y 2 van» y la flecha redonda en el móvil). El logo en lugar del día,
// el nombre, y debajo la fecha corta con las caras y «N van». Lleva a la
// agenda; en el móvil el botón es una flecha y la franja no pasa de ~80 px.
import { fechaCorta } from '/home/user/pingu/js/eventos-puro.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── La fecha corta ──')
{
  const f = (...dias) => fechaCorta({ horario: dias.map((dia) => ({ dia })) })
  check('un día: «7 nov»', f('2026-11-07') === '7 nov', f('2026-11-07'))
  check('dos seguidos: «14 y 15 nov»', f('2026-11-14', '2026-11-15') === '14 y 15 nov')
  check('tres seguidos: «Del 13 al 15 nov»', f('2026-11-13', '2026-11-14', '2026-11-15') === 'Del 13 al 15 nov')
  check('entre dos meses: «30 nov – 1 dic»', f('2026-11-30', '2026-12-01') === '30 nov – 1 dic')
  check('sueltos: «7 y 14 nov»', f('2026-11-07', '2026-11-14') === '7 y 14 nov')
  check('sin horario, de `empieza`', fechaCorta({ empieza: new Date(2026, 10, 21, 10).toISOString() }) === '21 nov')
}

// La franja de la 1204 (logo, nombre, fecha y caras, a la agenda) la sustituyó
// la 1293 (franja fina, a la ficha, con «¡Voy!»): su pantalla la mira
// test-tanda-1293-pantalla.mjs. Aquí queda la fecha corta, que sigue igual.
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
