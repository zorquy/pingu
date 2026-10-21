// Tanda 947 — las expansiones de las que TCGGO no tiene versiones.
//
// PINGU con Pitch Black y Chaos Rising: «no tienen las variantes». La sonda
// de /admin: «122 cartas suyas, 0 con versiones». La fila «Standard» de la
// 937 hacía que la regla de la 931 quitara la Reverse a TODAS las comunes del
// set. Lo que se mira: en me04 y me05 la Reverse de TCGdex (y la deducida)
// vuelve; la holo sigue sola; y en Ascended Heroes y en Prize Pack, que es
// lo que arreglaron la 931 y la 937, nada cambia.
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const v = await import(`${RAIZ}/js/mi-coleccion/variantes.js`)

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const ids = (c) => v.variantesDeCarta(c).map((e) => e.nuestro).join(',')
const standard = (id) => [{ tcggo_id: 1, card_id: id, etiqueta: 'Standard', origen: null }]

console.log('── 1. Chaos Rising y Pitch Black: manda TCGdex ──')
const comun = { id: 'me04-001', set_id: 'me04', market: 'WEST', rarity: 'Común', variants: { normal: true, reverse: true }, versiones: standard('me04-001') }
check('una común de Chaos Rising con solo la «Standard» de TCGGO: Normal y Reverse', ids(comun) === 'normal,reverse', ids(comun))
const rara = { id: 'me05-028', set_id: 'me05', market: 'WEST', rarity: 'Rara', variants: { holo: true, reverse: true, normal: true }, versiones: standard('me05-028') }
check('una rara de Pitch Black: Normal, Reverse y Holo (las tres de TCGdex)', ['normal', 'reverse', 'holo'].every((x) => ids(rara).split(',').includes(x)) && ids(rara).split(',').length === 3, ids(rara))
const ex = { id: 'me05-100', set_id: 'me05', market: 'WEST', rarity: 'Rara Ultra', variants: { holo: true }, versiones: standard('me05-100') }
check('una ex de Pitch Black: solo Holo', ids(ex) === 'holo', ids(ex))
const sinEngordar = { id: 'me04-002', set_id: 'me04', market: 'WEST', rarity: 'Infrecuente', variants: null, versiones: standard('me04-002') }
check('una infrecuente sin `variants` (deducida): Normal y Reverse', ids(sinEngordar) === 'normal,reverse', ids(sinEngordar))
check('  …y se sabe cuáles tiene (no se ofrecen las cuatro)', v.seSabenVariantes(sinEngordar))
check('en la lista solo Chaos Rising y Pitch Black (PINGU: «solo para esos dos sets»)', v.SETS_SIN_VERSIONES_TCGGO.size === 2 && v.SETS_SIN_VERSIONES_TCGGO.has('me04') && v.SETS_SIN_VERSIONES_TCGGO.has('me05'))
const me03 = { id: 'me03-001', set_id: 'me03', market: 'WEST', rarity: 'Común', variants: { normal: true, reverse: true }, versiones: standard('me03-001') }
check('  …y en Perfect Order siguen mandando las de TCGGO', ids(me03) === 'normal', ids(me03))

console.log('── 2. Lo de antes, igual ──')
const ah = { id: 'me02.5-180', set_id: 'me02.5', market: 'WEST', rarity: 'Infrecuente', variants: { normal: true, reverse: true }, versiones: standard('me02.5-180') }
check('Ascended Heroes (931): una carta con solo la «Standard» sigue sin Reverse', ids(ah) === 'normal', ids(ah))
const prize = { id: 'tcggo-9001', set_id: 'tcggo-900', market: 'WEST', rarity: 'Común', variants: null, versiones: standard('tcggo-9001') }
check('Prize Pack (937): una versión, la de la carta', ids(prize) === 'normal', ids(prize))
const twm = { id: 'sv06-001', set_id: 'sv06', market: 'WEST', rarity: 'Común', variants: { normal: true, reverse: true }, versiones: [...standard('sv06-001'), { tcggo_id: 2, card_id: 'sv06-001', etiqueta: 'Reverse Holo', origen: null }] }
check('un set con la Reverse de TCGGO: Normal y Reverse, sin repetir', ids(twm) === 'normal,reverse', ids(twm))
const otro = { id: 'sv07-001', set_id: 'sv07', market: 'WEST', rarity: 'Común', variants: { normal: true, reverse: true }, versiones: standard('sv07-001') }
check('fuera de la lista, la «Standard» sola sigue quitando la Reverse (937)', ids(otro) === 'normal', ids(otro))

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
