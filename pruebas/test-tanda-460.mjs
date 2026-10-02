// Tanda 460 — Nidoran♀ y Nidoran♂ son dos especies.
//
// PINGU: «has metido al Nidoran macho dentro de la categoría de Nidoran
// hembra en la Pokédex. Hay que hacer diferenciación entre estos dos».
//
// Al normalizar un nombre para buscar su número se borraba todo lo que no
// fuera letra o número, así que los dos símbolos de género desaparecían y
// las dos especies caían en «nidoran». Ganaba la primera de la tabla —la
// hembra, el 29— y las cartas del macho acababan en la ficha de la hembra,
// con su sprite y su línea de evolución. **No daba ningún error**: la
// especie existe, la carta existe, y el número que salía era válido.
//
// La prueba no mira solo a Nidoran: mira la FORMA. Dos especies DISTINTAS
// de la Pokédex no pueden aplastarse en la misma clave, porque entonces
// una se come a la otra en silencio. Hoy Nidoran es el único caso, pero el
// que venga mañana se caza solo.
import { POKEMON_POR_DEX, dexExacto, urlDeSprite } from '/home/user/pingu/js/torneos/sprites-pokemon.js'
import { especiesDeCarta } from '/home/user/pingu/js/pokedex-especies.js'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('\n── 1. Ninguna especie se come a otra ──')
{
  // La misma normalización que usa el módulo, copiada aquí a propósito: si
  // la de allí cambia y deja de separar algo, esto lo canta.
  const aplastar = (t) => String(t).replace(/♀/g, 'f').replace(/♂/g, 'm')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const visto = new Map()
  const chocan = []
  POKEMON_POR_DEX.forEach((nombre, i) => {
    const k = aplastar(nombre)
    if (visto.has(k)) chocan.push(`${visto.get(k)} y ${nombre} → "${k}"`)
    else visto.set(k, nombre)
  })
  check('no hay dos especies con la misma clave', chocan.length === 0, chocan.join(' | '))
  check('  …y están las 1.025', POKEMON_POR_DEX.length === 1025, String(POKEMON_POR_DEX.length))
}

console.log('\n── 2. Cada Nidoran, el suyo ──')
{
  check('Nidoran♀ es el 29', dexExacto('Nidoran♀') === 29, String(dexExacto('Nidoran♀')))
  check('Nidoran♂ es el 32', dexExacto('Nidoran♂') === 32, String(dexExacto('Nidoran♂')))
  // Y lo que de verdad usa la Pokédex de «Mi colección»: de qué especie
  // habla una CARTA, que es como se agrupan.
  check('la carta del macho cae en el 32', JSON.stringify(especiesDeCarta('Nidoran♂')) === '[32]',
    JSON.stringify(especiesDeCarta('Nidoran♂')))
  check('la de la hembra, en el 29', JSON.stringify(especiesDeCarta('Nidoran♀')) === '[29]',
    JSON.stringify(especiesDeCarta('Nidoran♀')))
  // Y sus evoluciones, que no se tocan.
  check('Nidorino sigue siendo el 33', dexExacto('Nidorino') === 33, String(dexExacto('Nidorino')))
  check('Nidorina sigue siendo la 30', dexExacto('Nidorina') === 30, String(dexExacto('Nidorina')))
  // El sprite ya salía bien antes —el slug sí traducía el símbolo— y tiene
  // que seguir saliendo: es la pista de que el número es el que toca.
  check('el sprite del 29 es la hembra', /nidoran-f\.png$/.test(urlDeSprite(29)), urlDeSprite(29))
  check('el sprite del 32 es el macho', /nidoran-m\.png$/.test(urlDeSprite(32)), urlDeSprite(32))
}

console.log('\n── 3. Lo que ya funcionaba, igual ──')
{
  // Los nombres con guion o puntuación que la normalización tiene que
  // seguir resolviendo: son los que costaron la regla de la 381.
  const mismos = [['Ho-Oh', 250], ['Porygon-Z', 474], ["Farfetch'd", 83], ['Mr. Mime', 122], ['Flabébé', 669]]
  for (const [n, d] of mismos) check(`${n} sigue siendo el ${d}`, dexExacto(n) === d, String(dexExacto(n)))
  // Un nombre de mazo escrito a mano NO lleva el símbolo, y dejar de
  // resolverlo sería cambiar una firma de arquetipo por arreglar otra cosa.
  check('«Nidoran» a secas sigue dando la hembra', dexExacto('Nidoran') === 29, String(dexExacto('Nidoran')))
  // Y las TAG TEAM y las Megas, que es lo otro que pasa por aquí.
  check('una TAG TEAM sigue dando dos', JSON.stringify(especiesDeCarta('Pikachu & Zekrom-GX')) === '[25,644]',
    JSON.stringify(especiesDeCarta('Pikachu & Zekrom-GX')))
  check('una Mega sigue dando su especie base', JSON.stringify(especiesDeCarta('Mega Gardevoir ex')) === '[282]',
    JSON.stringify(especiesDeCarta('Mega Gardevoir ex')))
}

console.log('\n── 4. Y las filas ya escritas vuelven a la cola ──')
{
  // `tcg_cards.dex_ids` SE GUARDA, y las que ya están escritas se
  // calcularon con el fallo: el arreglo del cliente no las alcanza, porque
  // la función programada solo mira las que están a null. Sin la
  // migración, la Pokédex seguiría enseñando el macho dentro de la hembra
  // con el código ya arreglado — que es la peor versión del fallo, porque
  // ya no se puede reproducir leyendo el código.
  const sql = readFileSync('/home/user/pingu/supabase-migration-nidoran-genero.sql', 'utf8')
  check('la migración existe y toca `dex_ids`', /update\s+public\.tcg_cards/i.test(sql) && /dex_ids\s*=\s*null/i.test(sql))
  check('  …y las devuelve a la cola con NULL y no con {}', !/dex_ids\s*=\s*'\{\}'/.test(sql))
  check('  …buscando por nombre en los dos idiomas', /name\s+ilike/i.test(sql) && /name_es\s+ilike/i.test(sql))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
