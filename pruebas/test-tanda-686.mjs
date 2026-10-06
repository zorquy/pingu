// Tanda 686 — el espejo de precios: la gemela occidental de una carta
// japonesa antigua (nombre inglés + PS + Pokédex + ventana + la más
// antigua + con producto), la fila que se copia, y la pasada con base de
// mentira (un set por pasada, repaso al día).
import { casarGemelas, filaEspejo, pasada, CLAVE_ESTADO, VERSION_ESPEJO, huellaDeAtaques, cruzadas } from '/home/user/pingu/netlify/functions/precios-espejo.mjs'

let fails = 0
const check = (n, ok, extra = '') => { console.log(`  ${ok ? 'ok ' : 'FALLA'} ${n}${!ok && extra ? ` — ${extra}` : ''}`); if (!ok) fails++ }

console.log('── 1. Las gemelas ──')
{
  const setsWest = [{ id: 'base1', release_date: '1999-01-09' }, { id: 'base4', release_date: '2000-02-24' }, { id: 'base2', release_date: '1999-06-16' }, { id: 'base5', release_date: '2000-04-24' }]
  const west = [
    { id: 'base1-4', set_id: 'base1', name: 'Charizard', hp: 120, dex_ids: [6], cm_id_product_propio: 273699 },
    // El Charmander de Base Set y el de Team Rocket: mismo nombre, mismos PS,
    // OTROS ataques (686.1). Los nuestros con los nombres en español.
    { id: 'base1-46', set_id: 'base1', name: 'Charmander', hp: 50, dex_ids: [4], attacks: [{ name: 'Arañazo', cost: ['Colorless'], damage: '10' }, { name: 'Ascuas', cost: ['Fire', 'Colorless'], damage: '30' }], cm_id_product_propio: 1046 },
    { id: 'base5-50', set_id: 'base5', name: 'Charmander', hp: 50, dex_ids: [4], attacks: [{ name: 'Arañazo', cost: ['Colorless'], damage: '10' }, { name: 'Llamarada', cost: ['Fire', 'Colorless'], damage: '20' }], cm_id_product_propio: 5050 },
    { id: 'base4-4', set_id: 'base4', name: 'Charizard', hp: 120, dex_ids: [6], cm_id_product_propio: 999 },
    { id: 'base1-2', set_id: 'base1', name: 'Blastoise', hp: 100, dex_ids: [9], cm_id_product_propio: 273697 },
    { id: 'base1-70', set_id: 'base1', name: 'Clefairy Doll', hp: null, dex_ids: null, cm_id_product_propio: 1 },
    { id: 'base2-99', set_id: 'base2', name: 'Pikachu', hp: 60, dex_ids: [25], cm_id_product_propio: null },
  ]
  const jp = [
    { id: 'scrydex-base1-6', name_en: 'Charizard', hp: 120, dex_ids: [6] },
    { id: 'scrydex-base1-9', name_en: 'Blastoise', hp: 100, dex_ids: [9] },
    { id: 'scrydex-base1-99', name_en: 'Blastoise', hp: 90, dex_ids: [9] },
    { id: 'scrydex-base1-77', name_en: 'Clefairy Doll', hp: null, dex_ids: null },
    { id: 'scrydex-base1-50', name_en: 'Pikachu', hp: 60, dex_ids: [25] },
    { id: 'scrydex-base1-71', name_en: null },
    { id: 'scrydex-rocket-charmander', name_en: 'Charmander', hp: 50, dex_ids: [4], attacks: [{ name: 'Scratch', cost: ['Colorless'], damage: '10' }, { name: 'Flare', cost: ['Fire', 'Colorless'], damage: '20' }] },
  ]
  const { pares, sinPar } = casarGemelas(jp, west, setsWest)
  check('Charizard casa con el de Base Set (el más antiguo), no con Base Set 2', pares.get('scrydex-base1-6')?.west.id === 'base1-4', JSON.stringify(pares.get('scrydex-base1-6')))
  check('Blastoise con sus PS casa; con otros PS no', pares.get('scrydex-base1-9')?.west.id === 'base1-2' && !pares.has('scrydex-base1-99'))
  check('sin PS ni Pokédex (un Entrenador) casa por nombre', pares.get('scrydex-base1-77')?.west.id === 'base1-70')
  check('sin producto en la gemela no hay par; sin nombre inglés tampoco', !pares.has('scrydex-base1-50') && !pares.has('scrydex-base1-71'))
  check('el Charmander de Rocket Gang casa con el de Team Rocket por los ATAQUES, no con el de Base Set (686.1)', pares.get('scrydex-rocket-charmander')?.west.id === 'base5-50', JSON.stringify(pares.get('scrydex-rocket-charmander')))
  check('  …ni de cómo se escribe el «×» del daño (687)', huellaDeAtaques({ attacks: [{ cost: ['Fire', 'Fire'], damage: '20×' }] }) === huellaDeAtaques({ attacks: [{ cost: ['Fire', 'Fire'], damage: '20x' }] }) && huellaDeAtaques({ attacks: [{ cost: ['Fire'], damage: '30+' }] }) !== huellaDeAtaques({ attacks: [{ cost: ['Fire'], damage: '30' }] }))
  {
    const pares = new Map([['a', { west: { id: 'w1' }, setWest: 'base1' }], ['b', { west: { id: 'w2' }, setWest: 'base1' }], ['c', { west: { id: 'w3' }, setWest: 'gym1' }]])
    const x = cruzadas(pares)
    check('  …y las cruzadas son las que caen fuera del set con más gemelas (687)', x.principal === 'base1' && x.fuera.length === 1 && x.fuera[0].id === 'c' && x.fuera[0].gemela === 'w3', JSON.stringify(x))
  }
  check('  …y la huella de ataques no depende del idioma', huellaDeAtaques({ attacks: [{ name: 'Arañazo', cost: ['Colorless'], damage: '10' }] }) === huellaDeAtaques({ attacks: [{ name: 'Scratch', cost: ['Colorless'], damage: '10' }] }) && huellaDeAtaques({}) === '')
  check('los motivos, uno a uno', sinPar.length === 3 && sinPar.some((s) => /sin nombre/.test(s.motivo)) && sinPar.some((s) => /otros PS/.test(s.motivo)), JSON.stringify(sinPar))
  const f = filaEspejo('scrydex-base1-6', { card_id: 'base1-4', cm_id_product: 273699, cm_low: 499.99, cm_low_es: 500, cm_avg30: 709.55, tp_market_eur: 0, tcggo_updated: 'x' }, new Date('2026-10-06T12:00:00Z'))
  check('la fila copia SOLO el producto (688): el precio de la gemela va a null, lo de cada idioma ni se nombra, y se firma espejo', f.card_id === 'scrydex-base1-6' && f.cm_id_product === 273699 && f.cm_low === null && f.cm_avg30 === null && f.tp_market_eur === null && f.tcggo_updated === null && !('cm_low_es' in f) && f.origen === 'espejo' && f.checked_at, JSON.stringify(f))
  check('sin producto, sin fila', filaEspejo('x', { cm_low: 3 }) === null)
}

console.log('── 2. La pasada ──')
{
  const escrito = []
  const estados = {}
  const pedidas = []
  const restImpl = async (ruta, opciones) => {
    pedidas.push(ruta)
    if (ruta.startsWith('tcg_sets?select=id,name_en,release_date')) return [{ id: 'base1_ja', name_en: 'Expansion Pack', release_date: '1996-10-20' }, { id: 'sinfecha_ja', name_en: 'Sin fecha', release_date: null }]
    if (ruta.startsWith('tcg_cards?select=id,name_en,hp,dex_ids')) return [{ id: 'scrydex-base1-6', name_en: 'Charizard', hp: 120, dex_ids: [6] }, { id: 'scrydex-base1-1', name_en: null }]
    if (ruta.startsWith('tcg_sets?select=id,release_date&market=eq.WEST')) return /release_date=gte\.1996-10-20&release_date=lte\.2000-10-/.test(ruta) ? [{ id: 'base1', release_date: '1999-01-09' }] : []
    if (ruta.startsWith('tcg_cards?select=id,set_id,name,name_en')) return [{ id: 'base1-4', set_id: 'base1', name: 'Charizard', hp: 120, dex_ids: [6], cm_id_product_propio: 273699 }]
    if (ruta.startsWith('tcg_card_prices?select=')) return [{ card_id: 'base1-4', cm_id_product: 273699, cm_low: 499.99, cm_avg30: 709.55 }]
    if (ruta.startsWith('tcg_card_prices?on_conflict=card_id')) { escrito.push(...JSON.parse(opciones.body)); return null }
    throw new Error('ruta no prevista ' + ruta)
  }
  estados.scrydex_huecos = { vistos: { 'JP|base1_ja': { estado: 'rellenado', nombres: 1 } } }
  const correr = (ahora = new Date('2026-10-06T12:00:00Z')) => pasada({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, restImpl, estadoImpl: async (k) => estados[k] || {}, guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) }, ahora })
  const r1 = await correr()
  check('primera pasada: el Expansion Pack, 1 espejada y 1 sin par', r1.ok && r1.set === 'base1_ja' && r1.espejadas === 1 && r1.sinPar === 1 && r1.setsWest.join() === 'base1', JSON.stringify(r1))
  check('  …y la fila escrita lleva el producto de la gemela y NINGÚN precio suyo (688)', escrito[0]?.card_id === 'scrydex-base1-6' && escrito[0].cm_id_product === 273699 && escrito[0].origen === 'espejo' && escrito[0].cm_low === null && estados[CLAVE_ESTADO].hechos.base1_ja.version === VERSION_ESPEJO, JSON.stringify(escrito[0]))
  check('  …y lo que se le pide a la base de la gemela es el producto, no su precio', !/cm_low|tp_market_eur/.test(pedidas.find((x) => x.startsWith('tcg_card_prices?select=')) || ''), pedidas.find((x) => x.startsWith('tcg_card_prices?select=')))
  const r2 = await correr()
  check('segunda: el set sin fecha se apunta y no se mira', r2.ok && r2.set === 'sinfecha_ja' && /sin fecha/.test(r2.nota), JSON.stringify(r2))
  const r3 = await correr()
  check('tercera: hecho', r3.ok && r3.hecho === true && escrito.length === 1)
  estados.scrydex_huecos.vistos['JP|base1_ja'].nombres = 2
  const rn = await correr()
  check('si scrydex-huecos vuelve a escribir los nombres, se buscan las gemelas otra vez sin esperar al día', rn.ok && rn.set === 'base1_ja' && escrito.length === 2 && estados[CLAVE_ESTADO].hechos.base1_ja.nombres === 2, JSON.stringify(rn))
  const r4 = await correr(new Date('2026-10-07T13:00:00Z'))
  check('al día siguiente se repasa el primero', r4.ok && r4.set === 'base1_ja' && escrito.length === 3, JSON.stringify(r4))
  estados[CLAVE_ESTADO].hechos.base1_ja.version = 1
  const rv = await correr(new Date('2026-10-07T13:00:00Z'))
  check('un set hecho con otra versión del espejo se vuelve a pasar (688: el precio copiado se borra)', rv.ok && rv.set === 'base1_ja' && escrito.length === 4 && estados[CLAVE_ESTADO].hechos.base1_ja.version === VERSION_ESPEJO, JSON.stringify(rv))
  check('el estado guarda el resumen por set', estados[CLAVE_ESTADO].hechos.base1_ja.espejadas === 1 && estados[CLAVE_ESTADO].hechos.base1_ja.ejemplosSinPar.length === 1)
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
