// Tanda 525 — la marca que se perdía al ganar precisión.
//
// La 523 hizo que mandara `rarity_en`, el inglés exacto de Scrydex. Y con
// eso la ficha de una carta GX pasó de tener su marca impresa a NO tener
// ninguna: la tabla de marcas es la de la web oficial en español, o sea la
// de las rarezas de AHORA, y «Rare Holo GX», «Rare Holo V», «Rare Holo
// EX», «Rare BREAK» y «Rare Prime» no están en ella.
//
// Son miles de cartas de Sol y Luna y de Espada y Escudo, y no da ningún
// error: el dibujo deja de salir y la fila se queda con el nombre a secas.
//
// Se arregla con un respaldo que **no pierde lo que distingue** (la norma
// de la 511): el NOMBRE se queda preciso y lo único que baja un peldaño es
// el dibujo, que en esas rarezas es el mismo de todas formas.
import { marcaDeCartaHtml, marcaDeRarezaHtml, MARCAS } from '/home/user/pingu/js/rarezas.js'
import { nucleoDeCarta } from '/home/user/pingu/js/carta-nucleo.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

// Una GX de Sol y Luna como está en la base después del relleno.
const GX = { rarity: 'Ultra Rare', rarity_en: 'Rare Holo GX' }

console.log('── 1. La rareza precisa que no tiene marca ──')
{
  check('«Rare Holo GX» no está en la tabla de marcas', marcaDeRarezaHtml('Rare Holo GX') === '')
  check('pero la gruesa sí', marcaDeRarezaHtml('Ultra Rare') !== '')
  check('así que la carta la tiene por el respaldo', marcaDeCartaHtml(GX) !== '', marcaDeCartaHtml(GX))
  check('  …y es la de la gruesa', marcaDeCartaHtml(GX) === marcaDeRarezaHtml('Ultra Rare'))
}

console.log('── 2. Y cuando la precisa SÍ tiene marca, manda ella ──')
{
  // LA ARCOÍRIS NO SIRVE PARA PROBAR ESTO, y conviene dejarlo escrito:
  // lleva A PROPÓSITO el mismo dibujo que la híper —son secretas las
  // dos—, así que da igual de qué columna salga y el rigor lo apuntó como
  // «sin detectar». Para ver que manda la precisa hace falta un caso en
  // el que las dos marcas SEAN DISTINTAS.
  check('la arcoíris está en la tabla', 'Rara Arcoíris' in MARCAS)
  check('  …con el mismo dibujo que la híper, a propósito',
    marcaDeRarezaHtml('Rare Rainbow') === marcaDeRarezaHtml('Hyper rare'))

  // Aquí sí: la gruesa de TCGdex dice «Rare Holo» (una estrella tornasol)
  // y la precisa de Scrydex «Illustration Rare» (una estrella de oro).
  const ILUSTRACION = { rarity: 'Rare Holo', rarity_en: 'Illustration Rare' }
  check('cuando las dos marcas son distintas, manda la precisa',
    marcaDeCartaHtml(ILUSTRACION) === marcaDeRarezaHtml('Illustration Rare'),
    marcaDeCartaHtml(ILUSTRACION))
  check('  …y no la gruesa', marcaDeCartaHtml(ILUSTRACION) !== marcaDeRarezaHtml('Rare Holo'))
  // Una carta sin rellenar: exactamente como antes.
  check('sin `rarity_en`, la de siempre', marcaDeCartaHtml({ rarity: 'Rare Holo' }) === marcaDeRarezaHtml('Rare Holo'))
  // Tres estados: sin ninguna rareza no se dibuja nada. Una promo no
  // lleva marca impresa y ponerle una estrella sería decir que es rara.
  check('sin rareza no se dibuja nada', marcaDeCartaHtml({}) === '')
  check('ni a una carta que no existe', marcaDeCartaHtml(null) === '')
  check('ni a una promo, que no lleva', marcaDeCartaHtml({ rarity: 'Promo' }) === '')
}

console.log('── 3. En la ficha de verdad ──')
{
  const html = nucleoDeCarta(
    { id: 'sm8-39', name: 'Blacephalon-GX', local_id: '39', category: 'Pokemon', ...GX },
    { name: 'Lost Thunder', card_count_official: 214 })
  check('la ficha dice la rareza precisa', html.includes('Rara Holo GX'), (html.match(/Rara[^<]*/) || [''])[0])
  check('  …y lleva su marca delante', html.includes('class="rareza-marca"'))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
