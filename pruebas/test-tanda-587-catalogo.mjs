// Tanda 587 — nuestro emparejamiento con Cardmarket, sobre SUS ficheros.
//
// Los fixtures son trozos REALES de products_singles_6.json y
// price_guide_6.json (2026-10-04): Primal Clash (idExpansion 1585, la
// secuencia perfecta) y Paldea Evolved (5318, con tarjetas de código
// delante, dos cartas metidas fuera de orden y 46 productos de más).
// «Nuestro lado» se construye a partir del catálogo suyo con números, y
// se le mete lo que pasa en la realidad: cartas que faltan, cartas que
// sobran, nombres con guion, ataques que no vienen.
import { readFileSync } from 'node:fs'
import {
  esCarta, nombreBase, ataquesDe, plegar, prepararNuestras, prepararSuyos, porExpansion, alinear, emparejarSet, expansionDeSet, filaDeGuia,
} from '/home/user/pingu/netlify/lib/cardmarket-catalogo.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const DIR = new URL('./fixtures/', import.meta.url)
const PRODUCTOS = JSON.parse(readFileSync(new URL('cardmarket-products-prc-pal.json', DIR), 'utf8')).products
const GUIA = JSON.parse(readFileSync(new URL('cardmarket-price-guide-prc-pal.json', DIR), 'utf8')).priceGuides
const expansiones = porExpansion(PRODUCTOS)
const PRC = 1585
const PAL = 5318

console.log('── 1. Leer sus nombres ──')
{
  check('«Groudon EX [Rip Claw | Massive Rend]» → nombre y ataques', nombreBase('Groudon EX [Rip Claw | Massive Rend]') === 'Groudon EX' && JSON.stringify(ataquesDe('Groudon EX [Rip Claw | Massive Rend]')) === '["Rip Claw","Massive Rend"]')
  check('«Feraligatr (Theme Deck)» → Feraligatr', nombreBase('Feraligatr (Theme Deck)') === 'Feraligatr')
  check('una tarjeta de código no es una carta', !esCarta({ name: 'Live Code Card (Booster)' }) && !esCarta({ name: '25x Online Code Card' }) && esCarta({ name: 'Rare Candy' }))
  check('«Groudon-EX» y «Groudon EX» son lo mismo plegados', plegar('Groudon-EX') === plegar('Groudon EX') && plegar('Pokémon Catcher') === plegar('Pokemon Catcher'))
  check('Primal Clash tiene 164 cartas en el tramo + extras', expansiones.get(PRC).length >= 164 && expansiones.get(PRC)[0].idProduct === 273532)
}

// Nuestro lado de Primal Clash: las 164 primeras, numeradas por posición.
const prc = expansiones.get(PRC)
const nuestrasPRC = prc.slice(0, 164).map((p, i) => ({ id: `xy5-${i + 1}`, local_id: String(i + 1), name: p.nombre, attacks: p.ataques ? p.ataques.split('|').map((n) => ({ name: n })) : null }))

console.log('── 2. Primal Clash: la secuencia perfecta ──')
{
  const r = emparejarSet(nuestrasPRC, prc)
  check('las 164 encuentran su producto', r.pares.length === 164 && r.sinPar.length === 0, `${r.pares.length} pares, ${r.sinPar.length} sin par`)
  check('  …todas por orden', r.pares.every((p) => p.por === 'orden') && r.confianza === 1)
  const g150 = r.pares.find((p) => p.id === 'xy5-150')
  const g85 = r.pares.find((p) => p.id === 'xy5-85')
  check('EL GROUDON: la 150 es el 273681 y no el 273615 del común', g150?.idProduct === 273681, String(g150?.idProduct))
  check('  …y la 85 (el mismo Groudon EX, el normal) es el 273616', g85?.idProduct === 273616, String(g85?.idProduct))
  check('  …o sea que dos cartas con el mismo nombre y los mismos ataques caen cada una en la suya', g150.idProduct !== g85.idProduct)
  check('los extras suyos (tarjetas de código, reimpresiones tardías) sobran', r.sobran === prc.length - 164, String(r.sobran))
}

console.log('── 3. Primal Clash, con la vida real encima ──')
{
  // Nos faltan cartas (no engordadas), sobra una que Cardmarket no tiene,
  // el nombre lleva guion y no hay ataques en la mitad.
  const nuestras = nuestrasPRC
    .filter((c) => !['xy5-10', 'xy5-11', 'xy5-100'].includes(c.id))
    .map((c, i) => ({ ...c, name: c.name.replace(' EX', '-EX'), attacks: i % 2 ? null : c.attacks }))
  nuestras.push({ id: 'xy5-999', local_id: '999', name: 'Carta Que No Existe', attacks: null })
  const r = emparejarSet(nuestras, prc)
  check('las 161 que existen casan', r.pares.length === 161, `${r.pares.length}`)
  check('  …la 150 sigue siendo el 273681 con el guion y sin ataques', r.pares.find((p) => p.id === 'xy5-150')?.idProduct === 273681)
  check('  …y la que no existe se queda sin par, diciéndolo', r.sinPar.length === 1 && r.sinPar[0].id === 'xy5-999' && /ningún producto/.test(r.sinPar[0].porque), JSON.stringify(r.sinPar))
  check('  …sin que la 99 y la 101 se corran (el hueco no desplaza)', r.pares.find((p) => p.id === 'xy5-99')?.idProduct === 273630 && r.pares.find((p) => p.id === 'xy5-101')?.idProduct === 273632)
}

console.log('── 4. Paldea Evolved: tarjetas de código, fuera de orden y de más ──')
{
  const pal = expansiones.get(PAL)
  check('las tarjetas de código se han ido', pal.every((p) => !/Code Card/.test(p.nombre)) && pal.length === 325, String(pal.length))
  // Nuestro lado: las 279 cartas del set en orden de numeración. En el
  // fichero, Mankey y Primeape (ids 709537-8) van DELANTE de la 1 aunque
  // son la 108 y la 109 (se añadieron antes): el orden por id no es el de
  // numeración, y la alineación lo tiene que aguantar.
  const enOrden = pal.filter((p) => ![709537, 709538].includes(p.idProduct)).slice(0, 277)
  const nuestras = []
  enOrden.forEach((p, i) => nuestras.push({ id: `sv2-${i + 1}`, local_id: String(i + 1), name: p.nombre, attacks: p.ataques ? p.ataques.split('|').map((n) => ({ name: n })) : null }))
  // Mankey y Primeape, en su sitio de verdad (al final, para el ejemplo).
  nuestras.push({ id: 'sv2-278', local_id: '278', name: 'Mankey', attacks: [{ name: 'Low Kick' }, { name: 'Hang Down' }] })
  nuestras.push({ id: 'sv2-279', local_id: '279', name: 'Primeape', attacks: [{ name: 'Low Kick' }, { name: 'Pummel' }] })
  const r = emparejarSet(nuestras, pal)
  check('las 279 encuentran producto', r.pares.length === 279, `${r.pares.length} pares, sin par: ${JSON.stringify(r.sinPar.slice(0, 3))}`)
  check('  …277 por orden y las dos descolocadas por nombre + ataques', r.pares.filter((p) => p.por === 'orden').length === 277 && r.pares.find((p) => p.id === 'sv2-278')?.por === 'nombre+ataques' && r.pares.find((p) => p.id === 'sv2-278')?.idProduct === 709537, JSON.stringify(r.pares.filter((p) => p.por !== 'orden')))
  check('  …los dos Cetoddle seguidos, cada uno en el suyo', r.pares.find((p) => p.id === 'sv2-58')?.idProduct !== r.pares.find((p) => p.id === 'sv2-59')?.idProduct)
  check('  …y sobran los 46 productos de más', r.sobran === 325 - 279, String(r.sobran))
}

console.log('── 5. Qué expansión es cada set ──')
{
  const e = expansionDeSet(nuestrasPRC, expansiones)
  check('Primal Clash se reconoce por sus nombres', e.elegida === PRC, JSON.stringify(e.candidatas))
  check('  …con casi todos los nombres en común', e.candidatas[0].puntos > 0.95, String(e.candidatas[0].puntos))
  // Un set que se parece a los dos a medias no se elige.
  const mezcla = [...nuestrasPRC.slice(0, 40), ...expansiones.get(PAL).slice(20, 60).map((p, i) => ({ id: `x-${i}`, local_id: String(i + 41), name: p.nombre }))]
  const m = expansionDeSet(mezcla, expansiones)
  check('un set a medias entre dos no se decide', m.elegida === null, JSON.stringify(m.candidatas))
  check('un set vacío no se decide', expansionDeSet([], expansiones).elegida === null)
}

console.log('── 6. De la guía a nuestra fila ──')
{
  const g = GUIA.find((x) => x.idProduct === 273681)
  check('la guía trae el Groudon EX de verdad', !!g && g.trend > 50, JSON.stringify(g))
  const f = filaDeGuia('xy5-150', 273681, g, { creada: '2026-10-04T02:40:55+0200', ahora: new Date('2026-10-05T07:00:00Z') })
  check('la fila lleva su idProduct y sus cifras', f.cm_id_product === 273681 && f.cm_trend === g.trend && f.cm_low === g.low && f.origen === 'cardmarket-guia', JSON.stringify(f))
  check('  …y la fecha del fichero', f.cm_updated === '2026-10-04T00:40:55.000Z', f.cm_updated)
  const comun = GUIA.find((x) => x.idProduct === 273615)
  check('y el común sigue valiendo 2,06 (es otro producto, no otro número)', comun?.trend === 2.06 && comun.low === 0.15)
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
