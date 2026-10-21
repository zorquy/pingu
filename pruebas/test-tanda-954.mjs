// Tanda 954 — las promos y el Shiny Vault, Holo; Hidden Fates en uno.
//
// PINGU: «las promo son las únicas que no tienen holo… porque las promo no
// traen rareza»; «el Mewtwo GX del Shiny Vault de Hidden Fates» salía
// «Normal»; y «se llama Hidden Fates Shiny Vault y no: es Hidden Fates, y
// ordenado como en TCGGO, primero las normales y luego el Shiny Vault».
import { join } from 'node:path'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const { brillaDeSerie, variantesDeCarta } = await import(join(RAIZ, 'js/mi-coleccion/variantes.js'))
const { rarezaEs } = await import(join(RAIZ, 'js/rarezas-nombres.js'))
const { setsHermanos, padreDeColeccion, idsDeColeccion } = await import(join(RAIZ, 'js/catalogo-series.js'))
const { porNumero } = await import(join(RAIZ, 'js/mi-coleccion/orden.js'))
const vs = (c) => variantesDeCarta(c).map((v) => v.nuestro).join()

console.log('── Promos: lo dice el nombre ──')
for (const [name, set] of [['Mewtwo-GX', 'smp'], ['Blastoise-EX', 'xyp'], ['M Charizard-EX', 'xyp'], ['Lugia V', 'swshp'], ['Charizard VMAX', 'swshp'], ['Arceus VSTAR', 'swshp'], ['Pikachu ex', 'svp'], ['Greninja BREAK', 'xyp'], ['Giratina LV.X', 'dpp'], ['Ultra Necrozma ◇', 'smp']]) {
  check(`«${name}» de promo es Holo`, vs({ name, rarity: 'Promo', set_id: set }) === 'holo', vs({ name, rarity: 'Promo', set_id: set }))
}
check('  …también con el nombre en name_en y la rareza vacía', vs({ name: 'Mewtwo GX', name_en: 'Mewtwo-GX', rarity: null, set_id: 'smp' }) === 'holo')
check('  …y con «Normal + Reverse» por defecto, sin Reverse', vs({ name: 'Lugia V', rarity: 'Promo', set_id: 'swshp', variants: { normal: true, reverse: true } }) === 'holo')
check('una promo sin mecánica no se toca (Snorlax)', vs({ name: 'Snorlax', rarity: 'Promo', set_id: 'xyp' }) === 'normal')
check('  …ni una con «Ex» dentro de la palabra (Exeggcute)', vs({ name: 'Exeggcute', rarity: 'Promo', set_id: 'svp' }) === 'normal')
check('  …y la que TCGdex dice holo, Holo', vs({ name: 'Rowlet', rarity: 'Promo', set_id: 'smp', variants: { holo: true } }) === 'holo')
check('la mecánica NO manda sobre una rareza que dice que no brilla (Común)', !brillaDeSerie({ name: 'Unown V', rarity: 'Common' }))

console.log('── Rarezas que no conocíamos ──')
check('«Secret Rare» (TCGdex, Hidden Fates) es la Rara Secreta', rarezaEs('Secret Rare') === 'Rara Secreta')
check('«Shiny Holo Rare» (Cardmarket) es la Rara Brillante', rarezaEs('Shiny Holo Rare') === 'Rara Brillante')
check('«Holo Rare» es la Rara Holo', rarezaEs('Holo Rare') === 'Rara Holo')
check('el Mewtwo GX del Shiny Vault con la rareza de TCGGO es Holo', vs({ name: 'Mewtwo GX', rarity: 'Shiny rare', rarity_en: 'Shiny Holo Rare', set_id: 'sma' }) === 'holo')
check('  …y con una rareza que no está en el vocabulario («Rare Shiny GX»)', vs({ name: 'Mewtwo GX', rarity_en: 'Rare Shiny GX', set_id: 'sma', variants: { normal: true, reverse: true } }) === 'holo')
check('  …sin inventarle traducción', rarezaEs('Rare Shiny GX') === 'Rare Shiny GX')
check('una desconocida con «Holo» brilla y conserva la Reverse', vs({ name: 'X', rarity_en: 'Holo Rare Foo', set_id: 'zz', variants: { normal: true, reverse: true } }) === 'holo,reverse')
check('lo de siempre no cambia: la Rare de Lost Thunder sigue Normal + Reverse', vs({ name: 'Heracross', rarity: 'Rare', set_id: 'sm8', variants: { normal: true, reverse: true } }) === 'normal,reverse')

console.log('── Hidden Fates, uno ──')
check('el Shiny Vault cuelga de Hidden Fates', padreDeColeccion('sma') === 'sm115')
check('  …la expansión se lleva los dos', idsDeColeccion('sm115').join() === 'sm115,sma')
check('  …y el catálogo de TCGGO casa sus SV contra el Shiny Vault antes de crear', setsHermanos('sm115', ['sm115', 'sma', 'sm11']).join() === 'sma')
check('las Trainer Gallery siguen aparte (la 534)', padreDeColeccion('swsh11tg') === null)
const orden = [{ local_id: 'SV59' }, { local_id: '69' }, { local_id: 'SV1' }, { local_id: '1' }, { local_id: 'SV10' }, { local_id: '10' }].sort(porNumero).map((c) => c.local_id).join()
check('ordenado como TCGGO: las normales y luego el Shiny Vault', orden === '1,10,69,SV1,SV10,SV59', orden)

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
