// Tanda 955 — Hidden Fates y Shining Fates con su nombre y en su orden, y el
// Shiny Vault sin parejas.
//
// PINGU, con la captura: la expansión salía rotulada «Hidden Fates Shiny
// Vault · 94 cartas», con las SV delante y cada una dos veces al separar
// versiones; y «Shining Fates igual: primero el Shiny Vault y luego la 1».
// TCGGO junta los dos sets (mismo `tcggo_id`) y el padre era el más grande:
// la galería. Y una carta que brilla siempre salía «Normal + Holo» en cuanto
// TCGGO le daba una «Holo».
import { join } from 'node:path'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const { padresPorEpisodio, registrarEpisodios, padreDeColeccion, idsDeColeccion, plegarHermanos } = await import(join(RAIZ, 'js/catalogo-series.js'))
const { variantesDeCarta } = await import(join(RAIZ, 'js/mi-coleccion/variantes.js'))
const vs = (c) => variantesDeCarta(c).map((v) => v.nuestro).join()

// Como están en la base: el mismo `tcggo_id` en los dos, y la galería más grande.
const SETS = [
  { id: 'sm115', name: 'Hidden Fates', tcggo_id: 2541, card_count_official: 68 },
  { id: 'sma', name: 'Hidden Fates Shiny Vault', tcggo_id: 2541, card_count_official: 94 },
  { id: 'swsh4.5', name: 'Shining Fates', tcggo_id: 2918, card_count_official: 72 },
  { id: 'swsh4.5sv', name: 'Shining Fates Shiny Vault', tcggo_id: 2918, card_count_official: 122 },
  { id: 'cel25', name: 'Celebrations', tcggo_id: 3010, card_count_official: 25 },
  { id: 'cel25c', name: 'Celebrations: Classic Collection', tcggo_id: 3010, card_count_official: 25 },
  { id: 'swsh11', name: 'Lost Origin', tcggo_id: 3100, card_count_official: 196 },
  { id: 'xx9', name: 'Una expansión cualquiera', tcggo_id: 3200, card_count_official: 30 },
  { id: 'xx9b', name: 'Su ampliación', tcggo_id: 3200, card_count_official: 80 },
]
const padres = padresPorEpisodio(SETS)
check('Hidden Fates es el padre, no el Shiny Vault', padres.get('sma') === 'sm115' && !padres.has('sm115'), JSON.stringify([...padres]))
check('Shining Fates es el padre, no el Shiny Vault', padres.get('swsh4.5sv') === 'swsh4.5' && !padres.has('swsh4.5'))
check('lo que no es galería sigue la regla de siempre (el más grande)', padres.get('xx9') === 'xx9b')
check('  …y el empate del 30 aniversario, igual que antes', padres.get('cel25c') === 'cel25')
registrarEpisodios(SETS)
check('la expansión se abre con Hidden Fates primero (el orden por bloques)', idsDeColeccion('sm115').join() === 'sm115,sma', idsDeColeccion('sm115').join())
check('  …y Shining Fates igual', idsDeColeccion('swsh4.5').join() === 'swsh4.5,swsh4.5sv', idsDeColeccion('swsh4.5').join())
const estanteria = plegarHermanos(SETS.map((s) => ({ ...s })))
const hf = estanteria.find((s) => s.id === 'sm115')
check('en la estantería sale «Hidden Fates» con las 162', hf?.name === 'Hidden Fates' && hf.card_count_official === 162 && !estanteria.some((s) => s.id === 'sma'))
check('una galería se reconoce también por su nombre', padresPorEpisodio([{ id: 'a1', name: 'Algo', tcggo_id: 1, card_count_official: 10 }, { id: 'zz', name: 'Algo Trainer Gallery', tcggo_id: 1, card_count_official: 30 }]).get('zz') === 'a1')

console.log('── Las que brillan siempre, sin «Normal» ──')
const sv = { name: 'Rowlet', set_id: 'sma', rarity: 'Shiny rare', variants: { normal: true, reverse: true } }
check('con la «Holo» de TCGGO al lado: solo Holo', vs({ ...sv, versiones: [{ etiqueta: 'Holo' }] }) === 'holo', vs({ ...sv, versiones: [{ etiqueta: 'Holo' }] }))
check('con «normal + holo» escritas: solo Holo', vs({ ...sv, variants: { normal: true, holo: true } }) === 'holo')
check('la Reverse que da TCGGO se queda (la 950)', vs({ ...sv, versiones: [{ etiqueta: 'Reverse Holo' }] }) === 'holo,reverse')
check('la Rare sin brillo no cambia (Heracross de Lost Thunder)', vs({ name: 'Heracross', rarity: 'Rare', set_id: 'sm8', variants: { normal: true, reverse: true } }) === 'normal,reverse')
check('la Rara de baraja de Pitch Black sigue con sus dos', vs({ name: 'X', rarity: 'Rare', set_id: 'me04', tcg_sets: { release_date: '2026-07-18' }, variants: { normal: true, holo: true } }) === 'normal,holo')

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
