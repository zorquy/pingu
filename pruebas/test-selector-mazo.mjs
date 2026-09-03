import { buscarOpciones } from '/home/user/pingu/js/torneos/selector-mazo.js'

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

console.log('\n── 3. Los arquetipos catalogados NO salen (tanda 238) ──')
{
  // Lo pidió Ibai: los arquetipos ya hechos salían sin sprite y no
  // aportaban nada que elegir los Pokémon no diera. El parámetro sigue
  // en la firma para no romper a quien llama, pero se ignora, y la
  // agrupación la hace claveCanonicaDeMazo al leer.
  const cat = [{ id: 'martillos', nombre: 'Martillos' }, { id: 'pult-noir', nombre: 'Dragapult Dusknoir' }]
  check('el catálogo no cuela nada en la lista',
    !buscarOpciones('dragapult', cat).some((o) => o.tipo === 'arquetipo'),
    JSON.stringify(buscarOpciones('dragapult', cat).slice(0, 2).map((o) => o.nombre)))
  check('y pasarlo no cambia el resultado',
    JSON.stringify(nombres('dragapult', cat)) === JSON.stringify(nombres('dragapult')),
    JSON.stringify(nombres('dragapult', cat)))
  // Lo que SÍ sale sin ser un Pokémon es el martillo: es un objeto con
  // sprite propio (OBJETOS_TCG), y sale del código, no del catálogo.
  const martillo = buscarOpciones('martil')[0]
  check('el martillo sale igual, y con su sprite',
    martillo?.nombre === 'Crushing Hammer' && martillo?.sprite === '/assets/sprites/crushing-hammer.png',
    JSON.stringify(martillo || null))
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

  // Desde la tanda 238 no hay opciones de catálogo, así que tampoco hay
  // valores `a:<id>`: TODO lo que se elige aquí se guarda como mazo
  // deducido, y agrupar con el catálogo es cosa de claveCanonicaDeMazo.
  const cat = [{ id: 'martillos', nombre: 'Martillos' }]
  check('ya no se guarda nada por id de catálogo',
    !buscarOpciones('martillos', cat).some((o) => String(o.valor).startsWith('a:')),
    JSON.stringify(buscarOpciones('martillos', cat).map((o) => o.valor)))
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
