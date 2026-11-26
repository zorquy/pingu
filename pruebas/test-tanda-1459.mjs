// Tanda 1459 — Traer la colección de TheHobbyClub (lo que tienes a tu
// colección, lo que te falta a «La quiero»), importar por el id de producto
// de Cardmarket con «Adónde van», y sacar para Cardmarket lo que buscas (una
// lista para pegar en tus Wants) y lo que das (un CSV con el id de producto).
// Todo puro: el emparejado va con dobles de las consultas.
import { readFileSync } from 'node:fs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 400) : ''}`) }

const csv = await import(`${REPO}/js/mi-coleccion/importar-csv.js`)
const wants = await import(`${REPO}/js/mi-coleccion/cardmarket-wants.js`)
const ap = await import(`${REPO}/js/mi-coleccion/importar-apps.js`)

console.log('── TheHobbyClub: la cabecera y las filas ──')
const CAB = 'coleccion,tipo,estado,carta,set,set_id,numero,variante,idioma,estado_carta,gradeada,empresa_gradeo,nota_gradeo,precio_compra,fecha_compra,notas,posicion,pokedex,cardmarket_id'
const filas = csv.leerCsv([
  CAB,
  'Pokemon league,custom,missing,Acerola,Burning Shadows,cmset_1824_es,449248,cardmarket_only,ES,NM,0,,,,,,245,,449248',
  'Pokemon league,custom,missing,Acerola,Burning Shadows,sm3_es,sm3_es-112a,reverseHolofoil,ES,NM,0,,,,,,359,,449253',
  'Mi Charizard,custom,have,Charizard ex [Infernal Reign | Burning Darkness],Obsidian Flames,sv3_es,sv3_es-125,holofoil,EN,EX,1,PSA,9,12.5,,,1,,734000',
  'Play pokemon series,custom,,Tyranitar V [Cragalanche | Single Strike Crush],Play! Pokémon Prize Pack Series One,cmset_5204_es,697137,cardmarket_only,ES,NM,,,,,,,186,,697137',
  'Pokemon league,custom,have,Empoleon [FB],Supreme Victors,pl3,pl3-4,leagueStamp,JA,NM,0,,,,,,2,,99',
].join('\n'))
const r = csv.reconocerColumnas(filas[0])
check('la cabecera de TheHobbyClub se reconoce como tal', r.origen === 'TheHobbyClub', JSON.stringify(r))
check('  …y no le falta nada: el id de Cardmarket basta para encontrar cada carta', csv.faltanColumnas({ columnas: r.columnas }).length === 0)
check('  …y el id de Cardmarket va a su columna', r.columnas.cardmarket === 18, JSON.stringify(r.columnas))
const e = csv.entradasDe(filas.slice(1), r.columnas, { idiomaSiFalta: 'es', origen: r.origen })
check('«missing» va a «La quiero» y «have» a la colección', e[0].destino === 'deseo' && e[2].destino === 'coleccion', JSON.stringify(e.map((x) => x.destino)))
check('una fila sin «have» ni «missing» no se adivina', e[3].destino === 'nada')
check('el número de TheHobbyClub: lo de detrás del guion, y nada si es el id de Cardmarket', e[1].numero === '112a' && e[2].numero === '125' && e[0].numero === '', JSON.stringify(e.map((x) => x.numero)))
check('su versión: reverseHolofoil es Reverse y holofoil Holo', e[1].variante === 'reverse' && e[2].variante === 'holo', JSON.stringify(e.map((x) => x.variante)))
check('lo que solo vende Cardmarket y los sellos van como nota de la copia', e[0].sello === 'Versión que solo vende Cardmarket' && e[4].sello === 'Sello de Liga' && e[1].sello === null, JSON.stringify(e.map((x) => x.sello)))
check('el idioma de la fila (ES, EN, JA)', e[0].idioma === 'es' && e[2].idioma === 'en' && e[4].idioma === 'ja')
check('el gradeo con su casa; sin casa, nada', e[2].gradeo && /PSA/.test(JSON.stringify(e[2].gradeo)) && e[0].gradeo === null, JSON.stringify([e[2].gradeo, e[0].gradeo]))
check('la colección de TheHobbyClub y el nombre tal cual (con sus ataques)', e[0].coleccion === 'Pokemon league' && e[2].nombre === 'Charizard ex' && /Infernal Reign/.test(e[2].nombreOriginal))
check('el id de Cardmarket como número', e[0].cardmarket === 449248)

console.log('── Los nombres de Cardmarket ──')
check('«Empoleon [FB]» es SOLO el Empoleon FB', JSON.stringify(csv.clavesDeNombre('Empoleon [FB]')) === '["empoleon fb"]', JSON.stringify(csv.clavesDeNombre('Empoleon [FB]')))
check('«Luxray Lv.48» se compara sin el nivel', JSON.stringify(csv.clavesDeNombre('Luxray Lv.48')) === '["luxray"]')
check('los ataques entre corchetes se leen para desempatar', JSON.stringify(csv.ataquesDelNombre('Lucario [Vacuum Wave | Fight Alone]')) === '["vacuum wave","fight alone"]', JSON.stringify(csv.ataquesDelNombre('Lucario [Vacuum Wave | Fight Alone]')))
check('  …y una marca corta no es un ataque', csv.ataquesDelNombre('Empoleon [FB]').length === 0)

console.log('── Emparejar ──')
const SETS = [
  { id: 'sm3', name: 'Sombras Ardientes', name_en: 'Burning Shadows', tcg_online_code: 'BUS' },
  { id: 'sv03', name: 'Llamas Obsidianas', name_en: 'Obsidian Flames', tcg_online_code: 'OBF' },
  { id: 'swsh2', name: 'Choque Rebelde', name_en: 'Rebel Clash', tcg_online_code: 'RCL' },
  { id: 'xy1', name: 'XY', name_en: 'XY', tcg_online_code: 'XY' },
]
const CARTAS = {
  sm3: [
    { id: 'sm3-112', set_id: 'sm3', local_id: '112', name: 'Acerola', category: 'Trainer' },
    { id: 'sm3-142', set_id: 'sm3', local_id: '142', name: 'Acerola', category: 'Trainer' },
    { id: 'sm3-159', set_id: 'sm3', local_id: '159', name: 'Acerola', category: 'Trainer' },
    { id: 'sm3-20', set_id: 'sm3', local_id: '20', name: 'Lucario', category: 'Pokemon' },
    { id: 'sm3-21', set_id: 'sm3', local_id: '21', name: 'Lucario', category: 'Pokemon' },
  ],
  sv03: [
    { id: 'sv03-125', set_id: 'sv03', local_id: '125', name: 'Charizard ex', category: 'Pokemon' },
    { id: 'tcggo-sv03-125', set_id: 'sv03', local_id: '125', name: 'Charizard ex', category: 'Pokemon' },
  ],
  swsh2: [
    { id: 'swsh2-154', set_id: 'swsh2', local_id: '154', name: "Boss's Orders", category: 'Trainer' },
    { id: 'swsh2-189', set_id: 'swsh2', local_id: '189', name: "Boss's Orders", category: 'Trainer' },
  ],
  xy1: [{ id: 'xy1-121', set_id: 'xy1', local_id: '121', name: 'Muscle Band', category: 'Trainer' }],
}
const porCm = new Map([
  [734000, [{ carta: CARTAS.sv03[1], variante: null }, { carta: CARTAS.sv03[0], variante: null }]],
  [449253, [{ carta: CARTAS.sm3[0], variante: 'reverse' }]],
])
const ataques = new Map([['sm3-20', ['Vacuum Wave', 'Fight Alone']], ['sm3-21', ['Aura Sphere']]])
let llamadasAtaques = 0
const opciones = {
  sets: SETS,
  cartasDeSet: async (id) => CARTAS[id] || [],
  cartasPorCardmarket: async () => porCm,
  ataquesDe: async (ids) => { llamadasAtaques++; return new Map(ids.map((id) => [id, ataques.get(id) || []])) },
}
const ent = (x) => ({ fila: 2, id: null, cardmarket: null, nombre: '', nombreOriginal: '', set: '', codigo: '', numero: '', cantidad: 1, estado: 'NM', idioma: 'es', variante: 'normal', varianteDada: true, sello: null, gradeo: null, notas: null, destino: 'coleccion', coleccion: null, ...x })
const res = await csv.emparejar([
  ent({ cardmarket: 734000, nombre: 'Charizard ex', nombreOriginal: 'Charizard ex [Infernal Reign | Burning Darkness]', set: 'Obsidian Flames', variante: 'holo' }),
  ent({ cardmarket: 449253, nombre: 'Acerola', nombreOriginal: 'Acerola', set: 'Burning Shadows', destino: 'deseo' }),
  ent({ cardmarket: 449248, nombre: 'Acerola', nombreOriginal: 'Acerola', set: 'Burning Shadows', sello: 'Versión que solo vende Cardmarket' }),
  ent({ cardmarket: 1, nombre: 'Lucario', nombreOriginal: 'Lucario [Vacuum Wave | Fight Alone]', set: 'Burning Shadows' }),
  ent({ cardmarket: 2, nombre: "Boss's Orders - Giovanni", nombreOriginal: "Boss's Orders - Giovanni", set: 'Rebel Clash', sello: 'Versión que solo vende Cardmarket' }),
  ent({ cardmarket: 3, nombre: 'Acerola', nombreOriginal: 'Acerola', set: 'Burning Shadows' }),
  ent({ cardmarket: 4, nombre: 'Lucario', nombreOriginal: 'Lucario', set: 'Burning Shadows', sello: 'Sello de Liga' }),
  ent({ destino: 'nada', nombre: 'Tyranitar V', set: 'Burning Shadows' }),
  ent({ cardmarket: 5, nombre: 'Pikachu', set: 'Expansión japonesa', idioma: 'ja' }),
  ent({ nombre: 'Muscle Band', set: 'XY', numero: '121' }),
  ent({ cardmarket: 6, nombre: 'Acerola', set: 'Burning Shadows: Additionals', sello: 'Sello de Liga' }),
], opciones)
const de = (n) => res.listas.find((l) => l.entrada.cardmarket === n)
check('por el id de Cardmarket, y de dos gemelas la de TCGdex, no la de TCGGO', de(734000)?.carta.id === 'sv03-125' && de(734000).via === 'cardmarket', JSON.stringify(de(734000)?.carta))
check('  …un id de VERSIÓN dice la versión (aunque la fila diga otra)', de(449253)?.linea.variante === 'reverse', JSON.stringify(de(449253)?.linea))
check('  …y el destino de la fila va con ella', de(449253)?.destino === 'deseo')
check('sin número, el sello va sobre la impresión NORMAL del Entrenador (la de número más bajo)', de(449248)?.carta.id === 'sm3-112' && de(449248).via === 'nombre', JSON.stringify(de(449248)?.carta))
check('  …y el sello va en la nota de la copia', de(449248)?.linea.notas === 'Versión que solo vende Cardmarket')
check('dos Pokémon que se llaman igual se desempatan por los ataques del nombre', de(1)?.carta.id === 'sm3-20' && llamadasAtaques >= 1, JSON.stringify(de(1)?.carta))
check('«Boss\'s Orders - Giovanni»: sin el personaje cuando con él no hay ninguna', de(2)?.carta.id === 'swsh2-154', JSON.stringify(de(2)?.carta))
const perdida = (pred) => res.perdidas.find((p) => pred(p.entrada))
check('sin sello, tres Acerola sin número NO se eligen a ciegas', /hay 3 cartas que se llaman así/.test(perdida((x) => x.cardmarket === 3)?.motivo || ''), perdida((x) => x.cardmarket === 3)?.motivo)
check('dos Pokémon con el mismo nombre y sin ataques no se eligen aunque lleven sello', /hay 2 cartas/.test(perdida((x) => x.cardmarket === 4)?.motivo || ''), perdida((x) => x.cardmarket === 4)?.motivo)
check('la fila que no dice si la tienes o te falta sale con su porqué', perdida((x) => x.destino === 'nada')?.motivo === 'el fichero no dice si la tienes o te falta')
check('una japonesa en el catálogo occidental dice que se elija el japonés', /elige el catálogo Japonés/.test(perdida((x) => x.cardmarket === 5)?.motivo || ''), perdida((x) => x.cardmarket === 5)?.motivo)
check('lo de siempre (expansión y número) sigue igual', res.listas.find((l) => l.entrada.numero === '121')?.carta.id === 'xy1-121')
check('«Burning Shadows: Additionals» son cartas de Burning Shadows', de(6)?.carta.id === 'sm3-112', JSON.stringify(de(6)?.carta))

console.log('── Juntar, adónde van y los deseos ──')
const j = csv.juntarLineas([
  { card_id: 'a', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, cantidad: 1 },
  { card_id: 'a', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, cantidad: 2 },
  { card_id: 'a', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'reverse', gradeo: null, cantidad: 1 },
])
check('la misma copia en dos colecciones es UNA línea con las copias sumadas', j.length === 2 && j[0].cantidad === 3, JSON.stringify(j))
check('adónde van: lo elegido, salvo lo que te falta, que va a «La quiero» siempre', csv.destinoDe({ destino: 'deseo' }, 'cambio') === 'deseo' && csv.destinoDe({ destino: 'coleccion' }, 'cambio') === 'cambio' && csv.destinoDe({ destino: null }, 'deseo') === 'deseo' && csv.destinoDe({ destino: null }) === 'coleccion')
const d = csv.deseosDeImportar([
  { linea: { card_id: 'a', idioma: 'es', variante: 'reverse' }, entrada: { varianteDada: true } },
  { linea: { card_id: 'a', idioma: 'es', variante: 'reverse' }, entrada: { varianteDada: true } },
  { linea: { card_id: 'b', idioma: 'en', variante: 'normal' }, entrada: { varianteDada: false } },
  { linea: { card_id: 'c', idioma: 'es', variante: 'normal' }, entrada: { varianteDada: true } },
], [{ card_id: 'c', idioma: 'es', variante: 'normal' }])
check('un deseo por carta, idioma y versión; sin versión en el fichero, cualquiera; sin repetir los que ya tienes', JSON.stringify(d) === JSON.stringify([{ card_id: 'a', idioma: 'es', variante: 'reverse' }, { card_id: 'b', idioma: 'en', variante: null }]), JSON.stringify(d))

console.log('── Para los Wants de Cardmarket ──')
check('un Pokémon: el nombre y sus ataques en inglés', wants.lineaParaCardmarket({ cantidad: 2, nombre: 'Umbreon EX', ataques: ['Moon Mirage', 'Onyx'], pokemon: true }) === '2x Umbreon EX Moon Mirage Onyx')
check('  …sin ataques NO se escribe (Cardmarket lo rechaza o lo casa con otra)', wants.lineaParaCardmarket({ nombre: 'Umbreon', pokemon: true }) === null)
check('un Entrenador, con el nombre basta', wants.lineaParaCardmarket({ nombre: 'Scoop Up Net' }) === '1x Scoop Up Net')
check('  …y fuera los corchetes del nombre', wants.lineaParaCardmarket({ nombre: 'Arceus VSTAR [Trinity Nova | Starbirth]', ataques: ['Starbirth', 'Trinity Nova'], pokemon: true }) === '1x Arceus VSTAR Starbirth Trinity Nova')
const t = wants.textoDeWants([
  { card_id: 'x', cantidad: 1, nombre: 'Iono', ataques: [], pokemon: false },
  { card_id: 'x', cantidad: 3, nombre: 'Iono', ataques: [], pokemon: false },
  { card_id: 'y', cantidad: 1, nombre: 'Pikachu', ataques: [], pokemon: true },
])
check('la lista: una línea por carta (con lo más que pidas) y aparte lo que no se puede escribir', t.texto === '3x Iono' && t.lineas === 1 && t.sinDatos.length === 1 && t.sinDatos[0].card_id === 'y', JSON.stringify(t))
const t2 = wants.textoDeWants([
  { card_id: 'sm3-112', cantidad: 1, nombre: 'Acerola', ataques: [], pokemon: false },
  { card_id: 'sm3-142', cantidad: 2, nombre: 'Acerola', ataques: [], pokemon: false },
])
check('  …y dos impresiones que se escriben igual (la normal y la de arte completo) son una línea con las copias sumadas', t2.texto === '3x Acerola' && t2.lineas === 1, JSON.stringify(t2))
check('los datos en inglés: guardados si la ficha está en inglés', JSON.stringify(wants.datosEnIngles({ category: 'Pokemon', detalle_lang: 'en', name: 'Mew ex', attacks: [{ name: 'Genome Hacking' }], abilities: [{ name: 'Restart' }] })) === JSON.stringify({ nombre: 'Mew ex', ataques: ['Restart', 'Genome Hacking'], pokemon: true }))
check('  …y si no, los de TCGdex en inglés', JSON.stringify(wants.datosEnIngles({ category: 'Pokemon', detalle_lang: 'es', name: 'Mew ex', attacks: [{ name: 'Hackeo Genómico' }] }, { name: 'Mew ex', attacks: [{ name: 'Genome Hacking' }] })) === JSON.stringify({ nombre: 'Mew ex', ataques: ['Genome Hacking'], pokemon: true }))
check('  …un Entrenador con su nombre en inglés no pregunta a TCGdex', wants.faltaPreguntar({ id: 'sv1-1', category: 'Trainer', name_en: 'Iono' }) === false)
check('  …y una de TCGGO o a mano tampoco (TCGdex no la conoce)', wants.faltaPreguntar({ id: 'tcggo-sv1-1', category: 'Pokemon', name: 'Pikachu' }) === false && wants.faltaPreguntar({ id: 'sv1-1', category: 'Pokemon', name: 'Pikachu' }) === true)
const q = wants.consultaDeTcgdex(['sv1-1', 'swsh1-2'])
check('TCGdex: UNA consulta con un alias por carta', /c0: card\(id: "sv1-1"\)/.test(q) && /c1: card\(id: "swsh1-2"\)/.test(q) && /attacks \{ name \}/.test(q), q)
const c = wants.csvDeLoQueDoy([
  { linea: { cambio: 2, cantidad: 3, idioma: 'es', estado: 'EX', variante: 'reverse', gradeo: null }, carta: { cm_id_product_propio: 734000, name: 'Charizard ex', name_en: 'Charizard ex', local_id: '125', tcg_sets: { name: 'Llamas Obsidianas', name_en: 'Obsidian Flames' } } },
  { linea: { cantidad: 1, idioma: 'en', estado: 'NM', variante: 'normal' }, carta: { name: 'Iono, la streamer', local_id: '1', set_id: 'sv2' } },
])
const lc = c.trim().split('\r\n')
check('lo que das: cabecera de Cardmarket, el id de producto, las que das, inglés, idioma, estado y foil', lc[0] === 'idProduct,Count,Name,Expansion,Number,Language,Condition,isFoil,Comments' && lc[1] === '734000,2,Charizard ex,Obsidian Flames,125,Spanish,EX,true,', lc.join(' | '))
check('  …y una sin id va con su nombre (entre comillas si lleva coma)', lc[2] === ',1,"Iono, la streamer",sv2,1,English,NM,,', lc[2])
// El CSV que se descarga lo vuelve a leer el importador como de Cardmarket.
const vuelta = csv.leerCsv(c)
const rv = csv.reconocerColumnas(vuelta[0])
const ev = csv.entradasDe(vuelta.slice(1), rv.columnas, { idiomaSiFalta: 'es', origen: rv.origen })
check('  …y el importador lo vuelve a leer: id de producto, copias, idioma, estado y foil', rv.origen === 'Cardmarket' && ev[0].cardmarket === 734000 && ev[0].cantidad === 2 && ev[0].idioma === 'es' && ev[0].estado === 'EX' && ev[0].variante === 'reverse', JSON.stringify({ origen: rv.origen, ev: ev[0] }))

console.log('── La pantalla (el código) ──')
check('TheHobbyClub entre las apps de las que traer la colección', ap.APPS.some((a) => a.id === 'thehobbyclub' && /La quiero/.test(a.lee)))
check('  …y su cabecera elige la app sola', ap.appDeCabecera ? ap.appDeCabecera(CAB.split(',')) === 'thehobbyclub' : true)
const imp = readFileSync(`${REPO}/js/mi-coleccion/importar.js`, 'utf8')
check('el importador busca por el id de Cardmarket y desempata con los ataques en inglés', /cartasPorCardmarket:\s*\(ids\)/.test(imp) && /ataquesDe:\s*\(ids\)/.test(imp))
check('  …guarda lo que te falta en «La quiero» de una vez y, si quieres, en una lista por colección', /anadirDeseos\(/.test(imp) && /mcImpListasSi/.test(imp))
const html = readFileSync(`${REPO}/mi-coleccion.html`, 'utf8')
check('«Adónde van»: colección, para cambio o «La quiero»', /id="mcImpDestino"/.test(html) && /value="cambio"/.test(html) && /value="deseo"/.test(html))
const ld = readFileSync(`${REPO}/js/mi-coleccion/listas-deseo.js`, 'utf8')
const ds = readFileSync(`${REPO}/js/mi-coleccion/deseos.js`, 'utf8')
check('«Para Cardmarket» en el ⋯ de «La quiero» y en el de «Las que doy»', /'cardmarket', 'Para Cardmarket'/.test(ld) && /abrirLaQuiero\(/.test(ds) && /descargarLoQueDoy\(/.test(ds))
const cam = readFileSync(`${REPO}/js/mi-coleccion/cambios.js`, 'utf8')
check('anadirDeseos inserta de doscientos en doscientos y, si choca, una a una', /export async function anadirDeseos/.test(cam) && /23505/.test(cam))

console.log(fails ? `\n${fails} FALLAN` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
