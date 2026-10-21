// Tanda 950 — la carta que brilla de serie es «Holo», no «Normal».
//
// PINGU, con Dex al lado: en Lost Thunder el Meganium es Holo + Reverse (no
// Normal + Reverse), el Shuckle GX es Holo y el Celebi ◇ es Holo (sin
// Reverse); en un set japonés de Mega la Serperior R es Holo y las C y U son
// Normal. TCGdex no escribe versiones en Lost Thunder y TCGGO no da ninguna
// del japonés: lo dice la RAREZA (y, para la «Rara» a secas, la época).
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const v = await import(`${RAIZ}/js/mi-coleccion/variantes.js`)
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const ids = (c, siNo) => v.variantesDeCarta(c, siNo).map((e) => e.nuestro).join()
const st = (id) => [{ tcggo_id: 1, card_id: id, etiqueta: 'Standard', origen: null }]
// Lo que la API de TCGdex da cuando el fichero no dice nada: normal y reverse.
const POR_DEFECTO = { normal: true, reverse: true, holo: false, firstEdition: false }
const lot = { release_date: '2018-11-02' }

console.log('── 1. Lost Thunder (occidental), como Dex ──')
const casos = [
  ['el Meganium (Rare Holo): Holo y Reverse', { id: 'sm8-8', rarity: 'Rare', rarity_en: 'Rare Holo' }, 'holo,reverse'],
  ['el Jumpluff (Rare Holo): Holo y Reverse', { id: 'sm8-14', rarity: 'Rare', rarity_en: 'Rare Holo' }, 'holo,reverse'],
  ['el Heracross (infrecuente): Normal y Reverse', { id: 'sm8-18', rarity: 'Uncommon', rarity_en: 'Uncommon' }, 'normal,reverse'],
  ['el Shuckle GX: solo Holo', { id: 'sm8-17', rarity: 'Ultra Rare', rarity_en: 'Rare Holo GX' }, 'holo'],
  ['el Celebi ◇: solo Holo (sin la Reverse que inventa la API)', { id: 'sm8-19', rarity: 'Rare', rarity_en: 'Rare Prism Star' }, 'holo'],
  ['una rara sin brillo de 2018: Normal y Reverse (la época no dice que brille)', { id: 'sm8-50', rarity: 'Rare', rarity_en: 'Rare' }, 'normal,reverse'],
]
for (const [que, c, quiero] of casos) {
  const carta = { set_id: 'sm8', market: 'WEST', variants: POR_DEFECTO, tcg_sets: lot, ...c }
  check(que, ids(carta) === quiero, ids(carta))
}
check('la de por defecto del Meganium es la Holo', v.varianteDeCarta({ id: 'sm8-8', set_id: 'sm8', market: 'WEST', rarity_en: 'Rare Holo', variants: POR_DEFECTO }) === 'holo')

console.log('\n── 2. Un set japonés de Mega (solo la «Standard» de TCGGO), como Dex ──')
const m = { release_date: '2025-08-01' }
const jp = (rarity_en, id = 'tg-1') => ({ id, set_id: 'm1', market: 'JP', rarity_en, versiones: st(id), tcg_sets: m })
check('una R: Holo', ids(jp('Rare')) === 'holo', ids(jp('Rare')))
check('una C y una U: Normal', ids(jp('Common')) === 'normal' && ids(jp('Uncommon')) === 'normal')
check('una RR (ex): Holo', ids(jp('Double Rare')) === 'holo')
check('una R japonesa de 2010 (antes de Sol y Luna): no se afirma que brille', ids({ ...jp('Rare'), tcg_sets: { release_date: '2010-03-12' } }) === 'normal')
check('una R sin día de set: no se afirma que brille', ids({ ...jp('Rare'), tcg_sets: null }) === 'normal')

console.log('\n── 3. Lo que no se toca ──')
check('Pitch Black 028 (Holo, Reverse y la Normal de baraja): las tres', ids({ id: 'me05-028', set_id: 'me05', market: 'WEST', rarity: 'Rare', variants: { holo: true, reverse: true, normal: true }, versiones: st('me05-028'), tcg_sets: { release_date: '2026-07-17' } }).split(',').sort().join() === 'holo,normal,reverse')
check('una GX a la que TCGGO SÍ da Reverse la conserva', ids({ id: 'g', set_id: 'x', market: 'WEST', rarity_en: 'Rare Holo GX', variants: POR_DEFECTO, versiones: [...st('g'), { tcggo_id: 2, card_id: 'g', etiqueta: 'Reverse Holo', origen: null }] }) === 'holo,reverse')
const charizard = { id: 'base1-4', set_id: 'base1', market: 'WEST', rarity_en: 'Rare Holo', versiones: ['1st Edition', 'Unlimited'].map((etiqueta, i) => ({ tcggo_id: -1 - i, card_id: 'base1-4', etiqueta, origen: 'edicion', clase: 'impresion' })) }
check('una carta con ediciones (Wizards) sigue con sus ediciones', ids(charizard) === 'primera,unlimited')
check('sin saber nada, la ficha sigue ofreciendo las cuatro', ids({ id: 'u', set_id: 'zz', market: 'WEST' }, v.TODAS) === v.TODAS.map((e) => e.nuestro).join())
check('una copia vieja apuntada «normal» del Meganium se lee como Holo', v.versionPosible('normal', { id: 'sm8-8', set_id: 'sm8', market: 'WEST', rarity_en: 'Rare Holo', variants: POR_DEFECTO }) === 'holo')

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
