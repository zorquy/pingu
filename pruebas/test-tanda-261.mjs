import { deducirIconos, agruparPorLinea, arquetipoDeMazo, claveCanonicaDeMazo } from '/home/user/pingu/js/torneos/arquetipos.js'
import { esAntepasadoDe, EVOLUCIONA_A } from '/home/user/pingu/js/torneos/evoluciones.js'

// Tanda 261: cómo se llama un mazo cuando no está en el catálogo.
//
// Lo reportó PINGU con dos mazos del torneo inaugural: uno de Mega
// Lucario y Mega Zygarde salía como «Mega Zygarde Riolu» y un
// Latias/Slowking como «Latias ex Slowpoke». Las dos veces ganaba la
// PREEVOLUCIÓN, que lleva más copias que la carta que da nombre al mazo.
//
// Esta prueba NO abre el navegador: el módulo es puro a propósito.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const mazo = (...lineas) => ({ pokemon: lineas.map(([name, quantity]) => ({ name, quantity })) })
const nombres = (m) => deducirIconos(m).map((i) => i.nombre)

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Los datos de evolución ──')
{
  check('la tabla está entera', EVOLUCIONA_A.size > 400, String(EVOLUCIONA_A.size))
  // Las cuatro que importan aquí: dos con números seguidos y dos sin
  // ellos, que es lo que la regla vieja (los tres números anteriores) no
  // podía ver.
  check('Riolu es antepasado de Lucario (448 = 447 + 1)', esAntepasadoDe(447, 448))
  check('Slowpoke lo es de Slowking (79 y 199, lejísimos)', esAntepasadoDe(79, 199))
  check('Duskull lo es de Dusknoir, dos saltos y lejos', esAntepasadoDe(355, 477))
  check('Ralts lo es de Gardevoir, en cadena', esAntepasadoDe(280, 282))
  check('y también de Gallade, la otra rama', esAntepasadoDe(280, 475))
  check('pero no al revés', !esAntepasadoDe(448, 447))
  check('ni entre Pokémon sin parentesco', !esAntepasadoDe(718, 448))
}

console.log('\n── 2. Los dos mazos que PINGU vio mal ──')
{
  // Riolu 4 pesa más que Mega Lucario ex 2: por copias sueltas ganaba
  // Riolu. Agrupando la línea entera, los tres son un solo mazo.
  const lucario = mazo(['Riolu', 4], ['Lucario', 3], ['Mega Lucario ex', 2], ['Mega Zygarde ex', 2], ['Fezandipiti ex', 1])
  check('Mega Lucario / Mega Zygarde', JSON.stringify(nombres(lucario)) === JSON.stringify(['Mega Lucario ex', 'Mega Zygarde ex']), nombres(lucario).join(' + '))
  check('y ni rastro de Riolu', !nombres(lucario).some((n) => /riolu/i.test(n)))

  const slowking = mazo(['Slowpoke', 4], ['Slowking', 3], ['Latias ex', 2], ['Squawkabilly ex', 1])
  check('Latias / Slowking', nombres(slowking).includes('Slowking') && nombres(slowking).includes('Latias ex'), nombres(slowking).join(' + '))
  check('y ni rastro de Slowpoke', !nombres(slowking).some((n) => /slowpoke/i.test(n)))
}

console.log('\n── 3. Una carta suelta no da nombre a un mazo ──')
{
  // El caso que motivó la regla vieja: Meowth ex es UNA copia y no es el
  // mazo de nadie. Antes había que elegir entre él y Drakloak (la
  // evolución intermedia del propio Dragapult); ahora no sale ninguno.
  const dragapult = mazo(
    ['Dreepy', 4], ['Drakloak', 2], ['Dragapult ex', 3],
    ['Duskull', 3], ['Dusclops', 3], ['Dusknoir', 2], ['Meowth ex', 1]
  )
  check('Dragapult / Dusknoir', JSON.stringify(nombres(dragapult)) === JSON.stringify(['Dragapult ex', 'Dusknoir']), nombres(dragapult).join(' + '))
  check('el ex de una sola copia no adelanta a una línea entera', !nombres(dragapult).includes('Meowth ex'))
  check('ni sale la evolución intermedia', !nombres(dragapult).includes('Drakloak'))
}

console.log('\n── 4. Cada línea se llama por su carta de arriba ──')
{
  check('Charizard, no Charmander', nombres(mazo(['Charmander', 4], ['Charmeleon', 1], ['Charizard ex', 3])).includes('Charizard ex'))
  check('Gardevoir, no Ralts', nombres(mazo(['Ralts', 4], ['Kirlia', 4], ['Gardevoir ex', 3])).includes('Gardevoir ex'))
  // Una Mega es una FORMA (número alto en la tabla de sprites): sin
  // reducirla a su especie salía «Lucario Mega Lucario ex», el mismo
  // Pokémon dos veces.
  const mega = nombres(mazo(['Ralts', 4], ['Kirlia', 3], ['Mega Gardevoir ex', 3]))
  check('la Mega y su especie son UNA línea', mega.length === 1 && mega[0] === 'Mega Gardevoir ex', mega.join(' + '))
}

console.log('\n── 4b. Y da igual el orden en que venga el export ──')
{
  // TCG Live no promete orden: la Mega puede venir ANTES que su
  // preevolución. Si el parentesco solo se mirara en un sentido, aquí
  // saldrían dos líneas donde solo hay una.
  const alReves = nombres(mazo(['Mega Lucario ex', 2], ['Lucario', 3], ['Riolu', 4], ['Mega Zygarde ex', 2]))
  check('la línea se junta igual', JSON.stringify(alReves) === JSON.stringify(['Mega Lucario ex', 'Mega Zygarde ex']), alReves.join(' + '))
}

console.log('\n── 5. Dos líneas de verdad salen las dos ──')
{
  const dosLineas = nombres(mazo(['Charmander', 4], ['Charmeleon', 1], ['Charizard ex', 3], ['Pidgey', 2], ['Pidgeot ex', 2]))
  check('Charizard y Pidgeot', dosLineas.includes('Charizard ex') && dosLineas.includes('Pidgeot ex'), dosLineas.join(' + '))
  check('la más gorda va primero', dosLineas[0] === 'Charizard ex', dosLineas.join(' + '))
}

console.log('\n── 5b. Pesa la LÍNEA entera, no el «ex» ──')
{
  // Dos copias de un ex de tecnología pesan menos que una línea de
  // ocho cartas. Si mandara el «ex», el mazo se llamaría por el tech.
  const conTech = nombres(mazo(
    ['Dreepy', 4], ['Drakloak', 2], ['Dragapult ex', 3],
    ['Duskull', 3], ['Dusclops', 3], ['Dusknoir', 2], ['Meowth ex', 2]
  ))
  check('Dusknoir por delante de un ex suelto', JSON.stringify(conTech) === JSON.stringify(['Dragapult ex', 'Dusknoir']), conTech.join(' + '))

  // Y la suma es de la LÍNEA: Gardevoir es 1+1+3, más que los 2 de
  // Munkidori, aunque su primera carta lleve una sola copia.
  const sumada = nombres(mazo(['Ralts', 1], ['Kirlia', 1], ['Gardevoir ex', 3], ['Munkidori', 2]))
  check('cuentan las tres cartas de la línea', sumada[0] === 'Gardevoir ex', sumada.join(' + '))
}

console.log('\n── 6. Un mazo de un solo Pokémon se llama por él ──')
{
  const uno = nombres(mazo(['Miraidon ex', 4], ['Iron Hands ex', 1]))
  check('un solo icono', uno.length === 1 && uno[0] === 'Miraidon ex', uno.join(' + '))
}

console.log('\n── 7. Lo que no puede pasar nunca ──')
{
  check('un mazo vacío no revienta', JSON.stringify(deducirIconos({ pokemon: [] })) === '[]')
  check('ni uno sin pokemon', JSON.stringify(deducirIconos({})) === '[]')
  check('ni null', JSON.stringify(deducirIconos(null)) === '[]')
  // Un nombre que el espejo no conoce no tiene dex: tiene que salir como
  // su propia línea, no juntarse con otro por tener dex null.
  const raros = agruparPorLinea([{ name: 'Bicho Inventado', quantity: 3 }, { name: 'Otro Invento', quantity: 2 }])
  check('dos desconocidos no se funden en uno', raros.length === 2, String(raros.length))
  // Y el resultado es estable: dos refrescos seguidos pintan lo mismo.
  // El empate se rompe por NOMBRE, no por el orden del export: aquí
  // Latios viene primero y aun así manda Latias, que es lo que hace que
  // dos refrescos seguidos pinten lo mismo.
  const empate = nombres(mazo(['Latios ex', 2], ['Latias ex', 2]))
  check('con empate manda el alfabético', JSON.stringify(empate) === JSON.stringify(['Latias ex', 'Latios ex']), empate.join(' + '))
}

console.log('\n── 8. El catálogo sigue mandando sobre la deducción ──')
{
  const catalogo = [
    { id: 'lucario-zygarde', nombre: 'Mega Lucario Zygarde', activo: true,
      requiere: [{ nombres: ['Mega Lucario ex'] }, { nombres: ['Mega Zygarde ex'] }],
      iconos: [{ nombre: 'Mega Lucario ex' }, { nombre: 'Mega Zygarde ex' }] },
  ]
  const m = mazo(['Riolu', 4], ['Lucario', 3], ['Mega Lucario ex', 2], ['Mega Zygarde ex', 2])
  const arq = arquetipoDeMazo(m, catalogo)
  check('gana el nombre curado', arq.nombre === 'Mega Lucario Zygarde', arq.nombre)
  check('y se marca como curado', arq.curado === true)
  const sinCatalogo = arquetipoDeMazo(m, [])
  check('sin catálogo, deducido y marcado', sinCatalogo.curado === false && /Mega Lucario/.test(sinCatalogo.nombre), sinCatalogo.nombre)
  // Y el agrupado del histórico sigue reconociendo el arquetipo por sus
  // Pokémon, que es lo que junta las partidas viejas con las nuevas.
  check('el histórico cae en el arquetipo curado',
    claveCanonicaDeMazo('d:mega lucario ex mega zygarde ex', 'Mega Lucario ex Mega Zygarde ex', catalogo) === 'a:lucario-zygarde',
    claveCanonicaDeMazo('d:mega lucario ex mega zygarde ex', 'Mega Lucario ex Mega Zygarde ex', catalogo))
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
