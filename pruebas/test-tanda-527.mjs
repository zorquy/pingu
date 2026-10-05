// Tanda 527 — lo que dijeron los datos en la primera pasada de verdad.
//
// El informe de /admin es el que tenía que decir qué rarezas de Scrydex nos
// faltaban por traducir, y en cuanto el relleno escribió sus primeras 3.224
// cartas dijo dos cosas: una verdadera —«Shiny Rare», 10 cartas— y una
// FALSA: «Promo».
//
// Y la falsa importa más que la verdadera. La pregunta estaba escrita como
// «¿se traduce a sí misma?», y la traducción de «Promo» al español ES
// «Promo». Un informe que señala lo que ya está bien enseña a no mirarlo —y
// entonces el día que aparezca una de verdad, estará en una lista que nadie
// lee. La pregunta buena es «¿está en el vocabulario?».
import { rarezaEs, rarezaConocida, RAREZAS_SCRYDEX } from '/home/user/pingu/js/rarezas-nombres.js'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. «Shiny Rare», que salió de los datos y no de mi cabeza ──')
{
  check('se traduce', rarezaEs('Shiny Rare') === 'Rara Brillante', rarezaEs('Shiny Rare'))
  // Las dos formas conviven en su catálogo: la del revés ya estaba.
  check('y la del revés sigue', rarezaEs('Rare Shiny') === 'Rara Brillante', rarezaEs('Rare Shiny'))
  // Las once que trajo la primera pasada de verdad, con su cuenta. Es el
  // fixture que manda la norma de la 501: lo que la API contestó, no lo
  // que yo me imagine que contesta.
  const LAS_ONCE = [
    'Common', 'Uncommon', 'Ultra Rare', 'Illustration Rare', 'Rare',
    'Double Rare', 'Special Illustration Rare', 'ACE SPEC Rare',
    'Hyper Rare', 'Promo', 'Shiny Rare',
  ]
  const desconocidas = LAS_ONCE.filter((r) => !rarezaConocida(r))
  check('las once de la primera pasada están todas', desconocidas.length === 0, desconocidas.join(', '))
}

console.log('── 2. Conocida no es lo mismo que distinta ──')
{
  check('«Promo» se traduce a sí misma…', rarezaEs('Promo') === 'Promo')
  check('  …y aun así la conocemos', rarezaConocida('Promo'))
  check('«Common» cambia de palabra y también', rarezaConocida('Common'))
  // Y lo que de verdad no está, se sigue señalando: la lista tiene que
  // servir para algo el día que aparezca una rareza nueva.
  check('una rareza que no existe NO se conoce', !rarezaConocida('Rare Vete A Saber'))
  check('  …y se sigue enseñando en inglés tal cual', rarezaEs('Rare Vete A Saber') === 'Rare Vete A Saber')
  // Tres estados, no dos: sin rareza no hay pregunta que hacer.
  check('sin rareza no se afirma nada', !rarezaConocida(null) && !rarezaConocida(''))
}

console.log('── 3. Y el informe pregunta lo que hay que preguntar ──')
{
  // El informe de /admin que usaba `rarezaConocida` se fue con los botones
  // de Scrydex en la 641 (la rareza la escribe ahora el catálogo de TCGGO,
  // tanda 644, pasando por `rarezaCanonica`). Lo que queda de la lección
  // es la pregunta buena —«¿está en el vocabulario?»— y su guarda de abajo.
  const admin = readFileSync('/home/user/pingu/admin/js/admin.js', 'utf8')
  check('/admin ya no compara la traducción consigo misma', !/rarezaEs\(r\) === r/.test(admin))
  check('  …ni importa lo que no usa (un import muerto no da error, pero miente)', !/rarezaConocida/.test(admin))
  // Todas las de Scrydex que tenemos escritas son, por definición,
  // conocidas: si una se cuela sin entrar en el mapa canónico, el informe
  // la pediría para siempre y nadie sabría por qué.
  const sueltas = Object.keys(RAREZAS_SCRYDEX).filter((r) => !rarezaConocida(r))
  check('ninguna rareza de Scrydex se queda fuera del mapa canónico', sueltas.length === 0, sueltas.join(', '))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
