// Tanda 580 — leer un CSV de otra app y encontrar nuestras cartas.
//
// Lo que más vigila esta prueba son las TRADUCCIONES silenciosas: un
// «Lightly Played» que acabe guardado como NM, un «025/198» que no case
// con nuestro «25», un «Scarlet & Violet: Paldea Evolved» que no encuentre
// «Paldea Evolved». Nada de eso da error: apunta mal una colección entera
// y la pantalla la enseña contenta.
//
// Los fixtures de Collectr y TCG Vault llevan las columnas que esas apps
// publican; el de Dex es el que mejor se ha podido reconstruir SIN una
// exportación real delante (la norma de la 501 manda: en cuanto PINGU
// pase una de verdad, el fixture ES esa).
import {
  separadorDe, leerCsv, reconocerColumnas, faltanColumnas, entradasDe, emparejar,
  estadoDe, idiomaDe, varianteDe, gradeoDe, dineroDe, numeroComparable, clavesDeNombreDeSet, exportarCsv,
} from '/home/user/pingu/js/mi-coleccion/importar-csv.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}

const SETS = [
  { id: 'sv2', market: 'WEST', name: 'Evoluciones en Paldea', name_en: 'Paldea Evolved', tcg_online_code: 'PAL' },
  { id: 'sv8', market: 'WEST', name: 'Mega Evolution', name_en: 'Mega Evolution', tcg_online_code: 'MEG' },
  { id: 'base1', market: 'WEST', name: 'Base Set', name_en: 'Base Set', tcg_online_code: 'BS' },
  { id: 'swsh12tg', market: 'WEST', name: 'Crown Zenith: Galarian Gallery', name_en: 'Crown Zenith: Galarian Gallery', tcg_online_code: 'CRZ' },
]
const CARTAS = {
  sv2: [
    { id: 'sv2-25', market: 'WEST', set_id: 'sv2', local_id: '25', name: 'Pikachu', name_es: 'Pikachu' },
    { id: 'sv2-193', market: 'WEST', set_id: 'sv2', local_id: '193', name: 'Chien-Pao ex', name_es: 'Chien-Pao ex' },
  ],
  sv8: [{ id: 'sv8-1', market: 'WEST', set_id: 'sv8', local_id: '1', name: 'Lapras', name_es: 'Lapras' }],
  base1: [{ id: 'base1-4', market: 'WEST', set_id: 'base1', local_id: '4', name: 'Charizard', name_es: 'Charizard' }],
  swsh12tg: [{ id: 'swsh12tg-tg1', market: 'WEST', set_id: 'swsh12tg', local_id: 'TG01', name: 'Toxtricity', name_es: 'Toxtricity' }],
}
const cartasDeSet = async (id) => CARTAS[id] || []

console.log('── 1. Leer el CSV: separadores, comillas, BOM ──')
{
  check('coma', separadorDe('a,b,c\n1,2,3') === ',')
  check('punto y coma (Excel en español)', separadorDe('a;b;c\n1;2;3') === ';')
  check('tabulador', separadorDe('a\tb\tc') === '\t')
  check('una coma ENTRE comillas no cuenta', separadorDe('"Pikachu, el raro";b;c') === ';')
  const filas = leerCsv('﻿Name,Set,Notes\r\n"Chien-Pao ex","Scarlet & Violet: Paldea Evolved","dice ""hola""\nen dos líneas"\r\n\r\nLapras,Mega Evolution,\r\n')
  check('el BOM se quita y la cabecera se lee', JSON.stringify(filas[0]) === '["Name","Set","Notes"]', JSON.stringify(filas[0]))
  check('las comillas dobladas y el salto dentro de una celda', filas[1][2] === 'dice "hola"\nen dos líneas', JSON.stringify(filas[1][2]))
  check('las filas vacías se saltan', filas.length === 3, String(filas.length))
}

console.log('── 2. Reconocer columnas de cada app ──')
{
  const collectr = reconocerColumnas(['Game', 'Set', 'Name', 'Card Number', 'Rarity', 'Variant', 'Condition', 'Grading Company', 'Grade', 'Quantity', 'Purchase Price', 'Date Added'])
  check('Collectr: se reconoce', collectr.origen === 'Collectr', String(collectr.origen))
  check('  …set, nombre, número, versión, estado, casa, nota, cantidad, precio', ['set', 'nombre', 'numero', 'variante', 'estado', 'casa', 'gradeo', 'cantidad', 'precioCompra'].every((c) => collectr.columnas[c] !== undefined), JSON.stringify(collectr.columnas))
  check('  …y «Game» y «Rarity» se quedan sin usar, sin romper nada', collectr.sinUsar.includes('Game') && collectr.sinUsar.includes('Rarity'))
  check('  …no falta nada para buscar', faltanColumnas(collectr).length === 0, JSON.stringify(faltanColumnas(collectr)))
  const vault = reconocerColumnas(['card_name', 'set_name', 'set_id', 'number', 'tcgdex_id', 'variant', 'condition', 'grade_company', 'grade_value', 'quantity', 'notes'])
  check('TCG Vault: con su id de TCGdex', vault.origen === 'TCG Vault' && vault.columnas.id !== undefined, JSON.stringify(vault))
  const dex = reconocerColumnas(['Name', 'Set', 'Number', 'Variant', 'Condition', 'Language', 'Quantity', 'Price Paid'])
  check('Dex (reconstruido): nombre, set, número, idioma', dex.origen === 'Dex' && dex.columnas.idioma !== undefined, JSON.stringify(dex))
  const nuestro = reconocerColumnas(['Id', 'Carta', 'Expansión', 'Código', 'Número', 'Idioma', 'Estado', 'Versión', 'Cantidad', 'Gradeo', 'Tu valor (€)', 'Lo que pagaste (€)', 'Notas'])
  check('el nuestro, de vuelta', nuestro.origen === 'PokeDoc' && nuestro.columnas.valor !== undefined && nuestro.columnas.codigo !== undefined, JSON.stringify(nuestro))
  const solo = reconocerColumnas(['Name', 'Quantity'])
  check('sin expansión ni número se dice qué falta', faltanColumnas(solo).length === 2, JSON.stringify(faltanColumnas(solo)))
  // `Id` a secas podría ser cualquier cosa, pero `Number` nunca es un id:
  // dos columnas no pueden caer en el mismo campo.
  const dobles = reconocerColumnas(['Number', 'No.'])
  check('dos sinónimos del mismo campo no se pisan', dobles.columnas.numero === 0 && Object.keys(dobles.columnas).length === 1, JSON.stringify(dobles.columnas))
}

console.log('── 3. Traducir celdas ──')
{
  check('Near Mint → NM', estadoDe('Near Mint') === 'NM')
  check('Lightly Played → EX (y no NM)', estadoDe('Lightly Played') === 'EX')
  check('Moderately Played → GD', estadoDe('Moderately Played') === 'GD')
  check('Heavily Played → PL', estadoDe('HP') === 'PL')
  check('Damaged → PO', estadoDe('Damaged') === 'PO')
  check('Mint → MT', estadoDe('Mint') === 'MT')
  check('lo que no se entiende, NM', estadoDe('???') === 'NM')
  check('vacío → el que se diga', estadoDe('', 'EX') === 'EX')
  check('idiomas: English/Español/Japanese', idiomaDe('English') === 'en' && idiomaDe('Español') === 'es' && idiomaDe('Japanese') === 'ja')
  check('  …y vacío cae al elegido en pantalla', idiomaDe('', 'en') === 'en')
  check('Reverse Holofoil → reverse', varianteDe('Reverse Holofoil') === 'reverse')
  check('Holofoil → holo', varianteDe('Holofoil') === 'holo')
  check('1st Edition → primera', varianteDe('1st Edition Holofoil') === 'primera')
  check('Unlimited / vacío → normal', varianteDe('Unlimited') === 'normal' && varianteDe('') === 'normal')
  check('casa + nota → «PSA 10»', gradeoDe('PSA', '10') === 'PSA 10')
  check('«Beckett» → BGS', gradeoDe('Beckett', '9.5') === 'BGS 9.5')
  check('una casa rara se guarda tal cual', gradeoDe('TAG', '9') === 'TAG 9')
  check('sin nada → null', gradeoDe('', '') === null)
  check('«1,50 €» → 1.5', dineroDe('1,50 €') === 1.5)
  check('«$1,234.56» → 1234.56', dineroDe('$1,234.56') === 1234.56)
  check('vacío → null', dineroDe('') === null)
  check('025 y 25 comparan igual', numeroComparable('025') === numeroComparable('25'))
  check('TG01 y tg1 comparan igual', numeroComparable('TG01') === numeroComparable('tg1'))
  check('«Scarlet & Violet: Paldea Evolved» da «paldea evolved»', clavesDeNombreDeSet('Scarlet & Violet: Paldea Evolved').includes('paldea evolved'))
  check('  …y «sword and shield» casa con «sword & shield»', clavesDeNombreDeSet('Sword and Shield').includes('sword & shield'))
}

console.log('── 4. Un CSV de Collectr, de punta a punta ──')
{
  const csv = [
    'Game,Set,Name,Card Number,Rarity,Variant,Condition,Grading Company,Grade,Quantity,Purchase Price,Date Added',
    'Pokemon,Scarlet & Violet: Paldea Evolved,Pikachu,025/193,Common,Reverse Holofoil,Lightly Played,,,2,$1.20,2025-01-02',
    'Pokemon,Scarlet & Violet: Paldea Evolved,Chien-Pao ex,193/193,Special Illustration Rare,Holofoil,Near Mint,PSA,10,1,$180.00,2025-01-02',
    'Pokemon,Base Set,Charizard,4/102,Holo Rare,1st Edition Holofoil,Moderately Played,,,1,,2025-01-03',
    'Pokemon,Crown Zenith: Galarian Gallery,Toxtricity,TG01/TG70,Trainer Gallery,Holofoil,Near Mint,,,1,,2025-01-03',
    'Pokemon,Scarlet & Violet: Paldea Evolved,Fantasma,999/193,Common,Normal,Near Mint,,,1,,2025-01-03',
    'Pokemon,Un set que no existe,Pikachu,25/100,Common,Normal,Near Mint,,,1,,2025-01-03',
  ].join('\n')
  const filas = leerCsv(csv)
  const { columnas, origen } = reconocerColumnas(filas[0])
  check('es Collectr', origen === 'Collectr')
  const entradas = entradasDe(filas.slice(1), columnas, { idiomaSiFalta: 'en' })
  check('seis entradas', entradas.length === 6, String(entradas.length))
  check('el número pierde el «/193»', entradas[0].numero === '025', entradas[0].numero)
  check('dos copias, reverse, EX, en inglés (el idioma elegido, que Collectr no lo dice)',
    entradas[0].cantidad === 2 && entradas[0].variante === 'reverse' && entradas[0].estado === 'EX' && entradas[0].idioma === 'en', JSON.stringify(entradas[0]))
  check('el precio de compra en número', entradas[0].precio_compra === 1.2, String(entradas[0].precio_compra))
  check('el PSA 10 con su casa', entradas[1].gradeo === 'PSA 10', String(entradas[1].gradeo))
  check('primera edición', entradas[2].variante === 'primera')
  const { listas, perdidas } = await emparejar(entradas, { sets: SETS, cartasDeSet })
  check('cuatro encontradas, dos perdidas', listas.length === 4 && perdidas.length === 2, `${listas.length} / ${perdidas.length}`)
  check('Pikachu 025 → sv2-25 (el nombre del set, sin la serie)', listas[0]?.carta.id === 'sv2-25', listas[0]?.carta.id)
  check('  …con la línea lista para guardar', JSON.stringify(listas[0]?.linea) === JSON.stringify({ card_id: 'sv2-25', market: 'WEST', idioma: 'en', estado: 'EX', variante: 'reverse', cantidad: 2, gradeo: null, valor_manual: null, precio_compra: 1.2, notas: null }), JSON.stringify(listas[0]?.linea))
  check('Charizard 4/102 → base1-4', listas[2]?.carta.id === 'base1-4', listas[2]?.carta.id)
  check('TG01/TG70 → swsh12tg-tg1 (número con letras)', listas[3]?.carta.id === 'swsh12tg-tg1', listas[3]?.carta.id)
  check('la 999 se pierde diciendo en qué set y qué número', /no hay ninguna carta con el número 999/.test(perdidas[0]?.motivo), perdidas[0]?.motivo)
  check('el set desconocido se pierde diciendo cuál', /no conozco la expansión «Un set que no existe»/.test(perdidas[1]?.motivo), perdidas[1]?.motivo)
  check('cada perdida sabe su línea del fichero', perdidas[0]?.entrada.fila === 6 && perdidas[1]?.entrada.fila === 7, JSON.stringify(perdidas.map((p) => p.entrada.fila)))
}

console.log('── 5. Por código de TCG Live y por id de TCGdex ──')
{
  const filas = leerCsv('card_name;set_name;set_id;number;tcgdex_id;variant;condition;grade_company;grade_value;quantity;notes\nLapras;Mega Evolution;sv8;001;sv8-1;normal;NM;;;3;mi favorita\nChien-Pao ex;;PAL;193;;holo;NM;;;1;\nPikachu;;pal;25;;normal;NM;;;1;')
  const { columnas } = reconocerColumnas(filas[0])
  const entradas = entradasDe(filas.slice(1), columnas)
  let pedidos = 0
  const { listas, perdidas } = await emparejar(entradas, {
    sets: SETS,
    cartasDeSet: async (id) => { pedidos++; return CARTAS[id] || [] },
    cartaPorId: async (id) => Object.values(CARTAS).flat().find((c) => c.id === id) || null,
  })
  check('todas encontradas', listas.length === 3 && perdidas.length === 0, `${listas.length} / ${perdidas.length}`)
  check('el id de TCGdex manda', listas[0].carta.id === 'sv8-1' && listas[0].linea.cantidad === 3 && listas[0].linea.notas === 'mi favorita')
  check('«PAL» en la columna del set id es el código de Live', listas[1].carta.id === 'sv2-193')
  check('  …y en minúsculas también', listas[2].carta.id === 'sv2-25')
  check('las cartas de un set se piden UNA vez', pedidos === 1, String(pedidos))
  check('un nombre que casa, casa', listas[1].nombreCasa === true)
}

console.log('── 6. Un nombre que no coincide AVISA, no rechaza ──')
{
  const filas = leerCsv('Name,Set,Number\nPikachu de Eco,Paldea Evolved,25')
  const { columnas } = reconocerColumnas(filas[0])
  const { listas } = await emparejar(entradasDe(filas.slice(1), columnas), { sets: SETS, cartasDeSet })
  check('se encuentra por set y número', listas[0]?.carta.id === 'sv2-25')
  check('  …y se marca que el nombre no es el mismo', listas[0]?.nombreCasa === false)
}

console.log('── 7. Exportar y volver a leer ──')
{
  const lineas = [
    { card_id: 'sv2-25', idioma: 'es', estado: 'NM', variante: 'reverse', cantidad: 2, gradeo: null, valor_manual: null, precio_compra: 1.2, notas: 'con "comillas", y coma' },
    { card_id: 'base1-4', idioma: 'en', estado: 'GD', variante: 'primera', cantidad: 1, gradeo: 'PSA 8', valor_manual: 900, precio_compra: null, notas: null },
  ]
  const cartaDe = (l) => ({ ...Object.values(CARTAS).flat().find((c) => c.id === l.card_id), tcg_sets: SETS.find((s) => s.id === l.card_id.split('-')[0]) })
  const csv = exportarCsv(lineas, cartaDe)
  check('cabecera nuestra', csv.startsWith('Id,Carta,Expansión,Código,Número,Idioma,Estado,Versión,Cantidad,Gradeo,Tu valor (€),Lo que pagaste (€),Notas\r\n'), csv.slice(0, 80))
  check('la nota con comillas y coma va entre comillas', /"con ""comillas"", y coma"/.test(csv), csv.split('\n')[1])
  const filas = leerCsv(csv)
  const { columnas, origen } = reconocerColumnas(filas[0])
  check('se reconoce como nuestro', origen === 'PokeDoc')
  const entradas = entradasDe(filas.slice(1), columnas)
  const { listas, perdidas } = await emparejar(entradas, { sets: SETS, cartasDeSet, cartaPorId: async (id) => Object.values(CARTAS).flat().find((c) => c.id === id) || null })
  check('vuelven las dos, por su id', listas.length === 2 && perdidas.length === 0)
  check('  …con TODO lo que se exportó', JSON.stringify(listas[0].linea) === JSON.stringify({ card_id: 'sv2-25', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'reverse', cantidad: 2, gradeo: null, valor_manual: null, precio_compra: 1.2, notas: 'con "comillas", y coma' }), JSON.stringify(listas[0].linea))
  check('  …el gradeo y el valor manual también', listas[1].linea.gradeo === 'PSA 8' && listas[1].linea.valor_manual === 900 && listas[1].linea.variante === 'primera', JSON.stringify(listas[1].linea))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
