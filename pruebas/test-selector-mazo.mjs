import { buscarOpciones, opcionDeArquetipo } from '/home/user/pingu/js/torneos/selector-mazo.js'

// Tanda 233: el buscador de mazos, como el de trainingcourt. Escribir el
// nombre a pelo partía el histórico en dos («Dragapult» y «dragapul» son
// dos casillas distintas en la matriz); eligiendo de una lista, no.
//
// El módulo se puede abrir en Node porque NO importa app.js: el escapado
// va dentro. Si algún día alguien lo importa de app.js, esta prueba deja
// de arrancar, y eso es la señal.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}
const nombres = (q, cat = []) => buscarOpciones(q, cat).map((o) => o.nombre)

console.log('\n── 1. Encuentra lo que se busca ──')
{
  check('por el principio', nombres('dragap')[0] === 'Dragapult', JSON.stringify(nombres('dragap').slice(0, 3)))
  check('con dos palabras', nombres('iron v')[0] === 'Iron Valiant', JSON.stringify(nombres('iron v').slice(0, 3)))
  check('ignorando la puntuación', nombres('mr mime')[0] === 'Mr. Mime', JSON.stringify(nombres('mr mime').slice(0, 3)))
  check('y por el medio', nombres('drill').includes('Beedrill'), JSON.stringify(nombres('drill').slice(0, 4)))
  check('nada con lo que no existe', nombres('xyzq').length === 0)
  check('ni con la caja vacía', nombres('').length === 0)
}

console.log('\n── 2. El orden ──')
{
  // Lo que empieza por lo tecleado va DELANTE. Con «dr», «Dragapult» es
  // un mazo de verdad y «Beedrill» solo lo contiene por el medio.
  const dr = nombres('dr')
  check('lo que empieza va antes que lo que contiene',
    dr.indexOf('Dragapult') < dr.indexOf('Beedrill'), JSON.stringify(dr.slice(0, 4)))
  // Y NO se ordena por longitud: se probó y hundía «Dragapult» debajo de
  // «Drampa» y «Dreepy», que es justo lo contrario de lo que hace falta.
  check('los cortos no se cuelan delante por ser cortos',
    dr.indexOf('Dragapult') < dr.indexOf('Drampa'), JSON.stringify(dr.slice(0, 6)))
}

console.log('\n── 3. Los arquetipos del catálogo SÍ salen (tanda 1461) ──')
{
  // Se quitaron en la 238 (Ibai: salían sin sprite y no aportaban nada que
  // elegir los Pokémon no diera) y vuelven en la 1461, con el catálogo de
  // Limitless de la 1460 y los sprites de sus iconos (Ibai: «adelante»).
  const cat = [
    { id: 'martillos', nombre: 'Martillos', iconos: [] },
    { id: 'dragapult-dusknoir', nombre: 'Dragapult Dusknoir', iconos: [{ set: 'TWM', numero: '130', nombre: 'Dragapult ex' }, { set: 'PRE', numero: '37', nombre: 'Dusknoir' }] },
    { id: 'dragapult', nombre: 'Dragapult', iconos: [{ set: 'TWM', numero: '130', nombre: 'Dragapult ex' }] },
    { id: 'apagado', nombre: 'Dragapult Viejo', iconos: [], activo: false },
  ]
  const ops = buscarOpciones('dragapult', cat)
  const pareja = ops.find((o) => o.valor === 'a:dragapult-dusknoir')
  check('el arquetipo sale, como arquetipo y con su id', pareja?.tipo === 'arquetipo' && pareja.nombre === 'Dragapult Dusknoir', JSON.stringify(ops.slice(0, 3)))
  check('  …con los sprites de sus DOS iconos, por nombre de Pokémon',
    pareja?.sprites?.length === 2 && /dragapult\.png$/.test(pareja.sprites[0]) && /dusknoir\.png$/.test(pareja.sprites[1]) && pareja.sprite === pareja.sprites[0],
    JSON.stringify(pareja?.sprites))
  check('el que se llama como la especie OCUPA su sitio: no hay dos «Dragapult»',
    ops.filter((o) => o.nombre === 'Dragapult').length === 1 && ops.find((o) => o.nombre === 'Dragapult')?.valor === 'a:dragapult',
    JSON.stringify(ops.slice(0, 4).map((o) => o.valor)))
  // Con «drag» empiezan todos (Dragalge, Dragonite…): los mazos, delante.
  const drag = buscarOpciones('drag', cat)
  const ultimoMazo = drag.map((o) => o.tipo).lastIndexOf('arquetipo')
  const primeraEspecie = drag.findIndex((o) => o.tipo !== 'arquetipo')
  check('a igualdad, el mazo antes que la especie suelta',
    ultimoMazo === 1 && primeraEspecie === 2 && drag[2].nombre === 'Dragalge',
    JSON.stringify(drag.slice(0, 4).map((o) => o.nombre)))
  check('el desactivado no sale', !ops.some((o) => o.valor === 'a:apagado'))
  check('sin catálogo, la lista es la de siempre', nombres('dragap')[0] === 'Dragapult' && !buscarOpciones('dragap').some((o) => o.tipo === 'arquetipo'))
  // Un arquetipo sin iconos (o que se nombra por un objeto) sale sin sprite,
  // con el hueco que alinea los nombres.
  const mart = buscarOpciones('martillos', cat).find((o) => o.valor === 'a:martillos')
  check('el de sin iconos sale igual, sin sprite', mart && !mart.sprite && mart.sprites.length === 0, JSON.stringify(mart || null))
  // Lo que SÍ sale sin ser un Pokémon ni un arquetipo es el martillo: es un
  // objeto con sprite propio (OBJETOS_TCG), y sale del código.
  const martillo = buscarOpciones('martil')[0]
  check('el martillo sale igual, y con su sprite',
    martillo?.nombre === 'Crushing Hammer' && martillo?.sprite === '/assets/sprites/crushing-hammer.png',
    JSON.stringify(martillo || null))
  const deUno = opcionDeArquetipo(cat[1])
  check('opcionDeArquetipo da lo mismo que la lista (lo usa Mis partidas al editar)',
    deUno.valor === pareja.valor && JSON.stringify(deUno.sprites) === JSON.stringify(pareja.sprites))
}

console.log('\n── 4. Lo que se guarda ──')
{
  const uno = buscarOpciones('gardevoir')[0]
  // La clave tiene que ser la MISMA forma que usa arquetipos.js para un
  // mazo deducido, o una partida a mano no caería en la casilla de las
  // de torneo.
  check('un Pokémon se guarda como mazo deducido', uno.valor === 'd:gardevoir', uno.valor)
  // La CDN cambió en la tanda 236 (PokeAPI → Limitless) y la URL pasó a
  // montarse por nombre en vez de por número de Pokédex.
  check('y trae su sprite', /r2\.limitlesstcg\.net\/pokemon\/gen9\/gardevoir\.png$/.test(uno.sprite || ''), uno.sprite)
  // Un arquetipo se guarda por su id (`a:<id>`), la clave con la que
  // agrupan los de los torneos (claveCanonicaDeMazo la deja como está).
  const cat = [{ id: 'gardevoir', nombre: 'Gardevoir', iconos: [{ nombre: 'Gardevoir ex' }] }]
  check('el arquetipo se guarda por su id', buscarOpciones('gardevoir', cat)[0]?.valor === 'a:gardevoir', String(buscarOpciones('gardevoir', cat)[0]?.valor))
  check('el martillo se guarda como mazo deducido',
    buscarOpciones('crushing')[0]?.valor === 'd:crushing hammer',
    String(buscarOpciones('crushing')[0]?.valor))
}

console.log('\n── 5. No se atraganta ──')
{
  // «a» casa con cientos: la lista se corta o el desplegable sería
  // inusable y el navegador pintaría mil filas por cada tecla.
  check('la lista está acotada', buscarOpciones('a').length <= 40, String(buscarOpciones('a').length))
}

console.log(fails ? `\n${fails} FALLOS\n` : '\nTodo en verde\n')
process.exit(fails ? 1 : 0)
