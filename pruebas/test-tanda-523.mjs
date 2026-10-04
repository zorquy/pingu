// Tanda 523 — la rareza exacta no llegaba a NINGUNA pantalla.
//
// La 509 puso el inglés exacto de Scrydex en `rarity_en` y la 510 le dio
// un traductor (`rarezaDeCarta`, que lee `rarity_en` y cae a `rarity`).
// Las dos tandas estaban bien y el resultado era CERO: **ninguna consulta
// del cliente pedía esa columna**. O sea que `rarezaDeCarta` caía al
// respaldo SIEMPRE, y la Rainbow de Lost Thunder —que es la queja literal
// de PINGU— seguía rotulada «Rara Híper» con el dato bueno en la base.
//
// No da ningún error de ninguna clase: una columna que no se pide llega
// `undefined`, y `undefined || otra_cosa` es una expresión perfectamente
// válida. Por eso la comprobación que de verdad importa aquí es la última,
// el barrido de los `select`.
import { readFileSync, readdirSync } from 'node:fs'
import { rarezaCrudaDeCarta, rarezaDeCarta, rarezaEs } from '/home/user/pingu/js/rarezas-nombres.js'
import { familiaDeBrillo } from '/home/user/pingu/js/carta-traducciones.js'
import { rangoDeRareza } from '/home/user/pingu/js/mi-coleccion/orden.js'
import { crudosDeGrupo, FILTROS_CATALOGO, GRUPOS_FILTRO } from '/home/user/pingu/js/mi-coleccion/filtros.js'
import { esAsTactico, esRadiante } from '/home/user/pingu/js/constructor/nucleo.js'
import { ordenarLineas } from '/home/user/pingu/js/mi-coleccion/filtros.js'
import { nucleoDeCarta } from '/home/user/pingu/js/carta-nucleo.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`)
}

// Una Rainbow de Lost Thunder tal como está en la base DESPUÉS del
// relleno: TCGdex la metió en «Hyper rare» y Scrydex la separa.
const RAINBOW = { rarity: 'Hyper rare', rarity_en: 'Rare Rainbow' }
// Y una dorada de verdad, para que no se confundan al revés.
const DORADA = { rarity: 'Hyper rare', rarity_en: 'Hyper Rare' }
// Y una a la que el relleno no ha llegado todavía: tiene que verse
// exactamente como antes.
const SIN_RELLENAR = { rarity: 'Rare Holo' }

console.log('── 1. La cadena de columnas, en un solo sitio ──')
{
  check('manda `rarity_en` cuando la hay', rarezaCrudaDeCarta(RAINBOW) === 'Rare Rainbow', rarezaCrudaDeCarta(RAINBOW))
  check('y `rarity` es el respaldo', rarezaCrudaDeCarta(SIN_RELLENAR) === 'Rare Holo', rarezaCrudaDeCarta(SIN_RELLENAR))
  // Tres respuestas y no dos: sin rareza es `null`, no cadena vacía.
  check('una carta sin ninguna de las dos no afirma nada', rarezaCrudaDeCarta({}) === null)
  check('ni una carta que no existe', rarezaCrudaDeCarta(null) === null)
  check('el rótulo de la Rainbow es «Rara Arcoíris»', rarezaDeCarta(RAINBOW) === 'Rara Arcoíris', rarezaDeCarta(RAINBOW))
  check('  …y el de la dorada sigue siendo «Rara Híper»', rarezaDeCarta(DORADA) === 'Rara Híper', rarezaDeCarta(DORADA))
  check('  …y la que no se ha rellenado, lo de siempre', rarezaDeCarta(SIN_RELLENAR) === 'Rara Holo', rarezaDeCarta(SIN_RELLENAR))
}

console.log('── 2. El BRILLO: la arcoíris no es la dorada ──')
{
  // Esto no es cosmético aquí: el foil de una Rainbow es literalmente
  // arcoíris y el de una hiperrara es oro. Se distinguen a un metro, y
  // mientras TCGdex las llamaba a las dos «Hyper rare» no se podía.
  check('la Rainbow brilla en arcoíris', familiaDeBrillo('Rare Rainbow') === 'arcoiris', familiaDeBrillo('Rare Rainbow'))
  check('la hiperrara, en oro', familiaDeBrillo('Hyper Rare') === 'dorada', familiaDeBrillo('Hyper Rare'))
  check('la de TCGdex, en oro (es lo que había)', familiaDeBrillo('Hyper rare') === 'dorada', familiaDeBrillo('Hyper rare'))
  check('y la secreta de Scrydex también', familiaDeBrillo('Rare Secret') === 'dorada', familiaDeBrillo('Rare Secret'))
  // Y por la cadena de columnas, que es como llega de verdad.
  check('la carta entera: Rainbow → arcoíris', familiaDeBrillo(rarezaCrudaDeCarta(RAINBOW)) === 'arcoiris')
  check('la carta entera: dorada → oro', familiaDeBrillo(rarezaCrudaDeCarta(DORADA)) === 'dorada')
}

console.log('── 3. La ESCALA: una Rainbow no es una «rara» del montón ──')
{
  // Sin la palabra en la lista, «Rare Rainbow» solo casaba con `rare` y
  // la carta más buscada del set se ordenaba por debajo de una holo.
  check('la Rainbow va arriba', rangoDeRareza('Rare Rainbow') === 11, rangoDeRareza('Rare Rainbow'))
  check('la secreta también', rangoDeRareza('Rare Secret') === 11, rangoDeRareza('Rare Secret'))
  check('y no se ha movido la hiperrara', rangoDeRareza('Hyper rare') === 11)
  check('ni las de siempre', rangoDeRareza('Common') === 1 && rangoDeRareza('Rare Holo') === 4)
  // La regla de la 319 sigue puesta: una rareza que no se reconoce no se
  // coloca en medio de la escala.
  check('lo que no se reconoce no se inventa un escalón', rangoDeRareza('Vete A Saber') === null, rangoDeRareza('Vete A Saber'))
}

console.log('── 4. Los CHIPS de filtro, por la misma columna que el rótulo ──')
{
  // Si el chip mira una columna y la ficha otra, el chip dice «Rara
  // Híper» de una carta que la ficha de al lado rotula «Rara Arcoíris» —
  // y pulsarlo deja fuera cartas que se ven en pantalla.
  const g = FILTROS_CATALOGO.find((x) => x.id === 'rarity')
  check('el grupo de rareza prefiere `rarity_en`', g.prefiere === 'rarity_en', JSON.stringify(g))
  check('  …y la columna que se CONSULTA sigue siendo `rarity`', g.columna === 'rarity')
  check('de una Rainbow sale su rareza exacta', crudosDeGrupo(RAINBOW, g)[0] === 'Rare Rainbow', JSON.stringify(crudosDeGrupo(RAINBOW, g)))
  check('de una sin rellenar, la de siempre', crudosDeGrupo(SIN_RELLENAR, g)[0] === 'Rare Holo')
  // Y los grupos que no tienen columna preferida no cambian.
  const gc = FILTROS_CATALOGO.find((x) => x.id === 'category')
  check('un grupo sin `prefiere` lee su columna', crudosDeGrupo({ category: 'Pokémon' }, gc)[0] === 'Pokémon')
  const gt = FILTROS_CATALOGO.find((x) => x.id === 'types')
  check('y uno de lista sigue devolviendo la lista', JSON.stringify(crudosDeGrupo({ types: ['Agua'] }, gt)) === '["Agua"]')
  check('con una lista que no está, una lista vacía', JSON.stringify(crudosDeGrupo({}, gt)) === '[]')

  // El grupo de TU colección (el de los chips de /mi-coleccion) va por su
  // propio camino y también tiene que mirar la columna buena.
  const mio = GRUPOS_FILTRO.find((x) => x.id === 'rareza')
  const rot = mio.de({}, RAINBOW, { rarezaEs })
  check('el chip de tu colección también', rot[0] === 'Rara Arcoíris', JSON.stringify(rot))
  check('  …y una carta sin rareza no cae en ningún cajón', JSON.stringify(mio.de({}, {}, { rarezaEs })) === '[]')
}

console.log('── 5. La FICHA de /carta, que era la pantalla de la queja ──')
{
  // Se pinta el núcleo entero y se mira lo que sale: una prueba que llama
  // a la pieza suelta no prueba la pantalla (la lección de la 313), y aquí
  // la pieza estaba bien desde la 510 — lo que fallaba era la pantalla.
  const html = nucleoDeCarta(
    { id: 'sm8-150', name: 'Charizard', local_id: '150', category: 'Pokemon',
      image_scrydex: 'https://images.scrydex.com/pokemon/sm8-150', ...RAINBOW },
    { name: 'Lost Thunder', card_count_official: 214 })
  check('la ficha rotula «Rara Arcoíris»', html.includes('Rara Arcoíris'))
  check('  …y NO «Rara Híper»', !html.includes('Rara Híper'))
  check('y la lámina de brillo es la arcoíris', html.includes('data-brillo="arcoiris"'), (html.match(/data-brillo="[a-z]+"/) || ['(ninguna)'])[0])
  // Y la que no se ha rellenado, exactamente como antes.
  const viejo = nucleoDeCarta(
    { id: 'sm8-1', name: 'Rowlet', local_id: '1', category: 'Pokemon', ...SIN_RELLENAR },
    { name: 'Lost Thunder' })
  check('una carta sin rellenar sigue igual', viejo.includes('Rara Holo'))
  // Tres estados: sin rareza no se inventa una fila.
  const sinNada = nucleoDeCarta({ id: 'x-1', name: 'X', local_id: '1', category: 'Pokemon' }, { name: 'Y' })
  check('sin rareza no sale la fila', !sinNada.includes('Rareza'))
}

console.log('── 6. El ORDEN por rareza, por el camino de verdad ──')
{
  // Con las dos columnas en el mismo escalón esto no se podría ver, así
  // que la carta de la prueba es una a la que TCGdex le puso una rareza
  // MÁS BAJA que la de Scrydex — que es lo que pasa de verdad: la 509
  // nació de que TCGdex colapsa rarezas.
  const cartas = new Map([
    ['a', { id: 'a', rarity: 'Rare', rarity_en: 'Hyper Rare' }],
    ['b', { id: 'b', rarity: 'Rare Holo' }],
  ])
  const AY = {
    carta: (l) => cartas.get(l.card_id),
    rango: rangoDeRareza,
    nombre: (c) => c?.name || '',
    valor: () => 0,
    porNumero: () => 0,
  }
  const lineas = [{ id: '1', card_id: 'a' }, { id: '2', card_id: 'b' }]
  const orden = ordenarLineas(lineas, 'rareza', 'desc', AY).map((l) => l.card_id)
  check('la hiperrara de Scrydex va delante de una holo', orden[0] === 'a', JSON.stringify(orden))
}

console.log('── 7. Las REGLAS de mazo, que no son un rótulo ──')
{
  // El AS táctico y el radiante son uno por mazo, y el constructor los
  // reconoce por la rareza. Ahí la rareza no decide lo que se LEE sino lo
  // que se PUEDE: una carta cuya rareza española no esté curada se
  // escaparía del límite, y un mazo ilegal no da ningún error.
  check('el AS táctico, por la rareza española', esAsTactico({ rarity: 'Rara AS TÁCTICO' }))
  check('  …y por la inglesa de Scrydex', esAsTactico({ rarity_en: 'ACE SPEC Rare' }))
  check('  …aunque la española esté sin curar', esAsTactico({ rarity: '', rarity_en: 'ACE SPEC Rare' }))
  check('y una carta normal no lo es', !esAsTactico({ rarity: 'Rara Holo', rarity_en: 'Rare Holo' }))
  check('el radiante, por la rareza inglesa', esRadiante({ name: 'Greninja', rarity_en: 'Radiant Rare' }))
  check('  …y sigue valiendo por el nombre', esRadiante({ name: 'Radiant Greninja' }))
  check('y una carta sin nada no lo es', !esRadiante({}))
}

console.log('── 8. EL BARRIDO: quién pide `rarity_en` y quién se la deja ──')
{
  // ESTA es la comprobación de la tanda, y es de la familia «una columna
  // que la base rellena y nadie pide»: todo lo demás de aquí arriba
  // estaba YA bien desde la 510 y no servía de nada.
  //
  // La regla: un `select` que nombre `rarity` tiene que nombrar también
  // `rarity_en`. Y se busca con bordes para que `rarity_en` no cuente
  // como `rarity` —la trampa de la 312, que al barrer texto todo lo que
  // CONTIENE la cadena cuenta—, que si no este barrido saldría verde
  // mirándose a sí mismo.
  const raiz = '/home/user/pingu/js'
  const ficheros = []
  const andar = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) andar(`${dir}/${e.name}`)
      else if (e.name.endsWith('.js')) ficheros.push(`${dir}/${e.name}`)
    }
  }
  andar(raiz)
  check('el barrido llega', ficheros.length > 100, ficheros.length)

  // Una lista de columnas de PostgREST: lo que va dentro de `select(…)` o
  // de una constante COLUMNAS_*. Se reconoce por tener comas y nombres de
  // columna, y por nombrar `id`.
  const faltan = []
  let vistas = 0
  for (const f of ficheros) {
    const txt = readFileSync(f, 'utf8')
    // Cadenas de una sola línea con comas: las listas de columnas.
    for (const m of txt.matchAll(/'([a-z_][a-z_0-9(),. *]*)'/gi)) {
      const lista = m[1]
      if (!lista.includes(',') || !/\bid\b/.test(lista)) continue
      const columnas = lista.split(/[,()]/).map((s) => s.trim())
      if (!columnas.includes('rarity')) continue
      vistas++
      if (!columnas.includes('rarity_en')) faltan.push(`${f.replace(raiz, 'js')}: ${lista.slice(0, 90)}`)
    }
  }
  check('se han encontrado consultas con rareza', vistas >= 4, vistas)
  check('TODAS piden también `rarity_en`', faltan.length === 0, faltan.join(' | '))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
