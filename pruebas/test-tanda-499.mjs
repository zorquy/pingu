// Tanda 499 — emparejar el catálogo de Scrydex con el nuestro sin fiarse
// de los identificadores, y no tragarse su imagen de relleno.
//
// PINGU va a pagar el Starter de Scrydex (29 $) para tapar lo que TCGdex no
// tiene: 11.712 escaneos asiáticos, 340 logos, 68 sets japoneses enteros, y
// —sin medir todavía— 1.351 escaneos y 63 logos occidentales.
//
// Dos cosas de esa integración son puras y son las que pueden hundirla en
// silencio, así que se prueban antes de escribir una sola petición.
import {
  esRelleno, HUELLAS_DE_RELLENO, clave, huellaDeSet, casan, emparejarSets, CAMPOS_SUYOS,
} from '/home/user/pingu/netlify/lib/scrydex.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. El relleno de su servidor de imágenes ──')
//
// `images.scrydex.com` contesta 200 CON UNA IMAGEN para cualquier id que no
// exista. Preguntar «¿existe?» te dice que sí SIEMPRE, así que sin esto el
// relleno entraría en la base como un escaneo bueno y la pantalla saldría
// con la misma imagen gris quince mil veces, sin un error en ninguna parte.
{
  check('la huella del relleno de carta es relleno', esRelleno(HUELLAS_DE_RELLENO.carta))
  check('la del logo también, pidiéndole el tipo', esRelleno(HUELLAS_DE_RELLENO.logo, 'logo'))
  check('un escaneo de verdad NO es relleno', !esRelleno('a1b2c3d4e5f6'))
  // Las dos huellas son distintas: pedir el tipo equivocado no da un falso
  // positivo, pero tampoco uno negativo que cuele un relleno.
  check('la de carta no cuela como logo', !esRelleno(HUELLAS_DE_RELLENO.carta, 'logo'))
  check('la de logo no cuela como carta', !esRelleno(HUELLAS_DE_RELLENO.logo, 'carta'))
  // Se compara por PREFIJO: un SHA-1 completo que empiece igual sigue
  // siendo el relleno.
  check('un sha-1 entero que empieza igual se caza', esRelleno(HUELLAS_DE_RELLENO.carta + '0a1b2c3d4e5f', 'carta'))
  check('da igual la caja', esRelleno(HUELLAS_DE_RELLENO.carta.toUpperCase()))
  // LO QUE IMPORTA DE VERDAD: sin huella no se dice «no es relleno». Eso
  // sería dar por bueno un fichero por no tener con qué compararlo, que es
  // exactamente el fallo que esta función existe para evitar.
  check('sin huella NO se da por bueno', !esRelleno(''), 'una cadena vacía no puede significar «es relleno»')
  check('  …ni con una huella más corta que la nuestra', !esRelleno('ce9a'))
  check('  …ni con nada', !esRelleno(null) && !esRelleno(undefined))
  check('un tipo que no conocemos no afirma nada', !esRelleno(HUELLAS_DE_RELLENO.carta, 'simbolo'))
}

console.log('\n── 2. La huella de un set ──')
{
  const h = huellaDeSet({ release_date: '2023-03-10', card_count_official: 73, card_count_total: 103, name: 'Triplete Beat' })
  check('coge fecha, las DOS cuentas y el nombre',
    h.fecha === '2023-03-10' && h.oficial === 73 && h.total === 103 && h.nombre === 'tripletebeat', JSON.stringify(h))
  check('una fecha con hora se recorta al día', huellaDeSet({ release_date: '2023-03-10T00:00:00Z' }).fecha === '2023-03-10')
  check('una fecha rara no es fecha', huellaDeSet({ release_date: 'marzo' }).fecha === null)
  check('un cero no es una cuenta', huellaDeSet({ card_count_official: 0 }).oficial === null)
  check('nada no revienta', huellaDeSet(null).fecha === null && huellaDeSet(undefined).nombre === '')
  // Los campos se pueden llamar distinto en cada lado.
  const suyo = huellaDeSet({ releaseDate: '2023-03-10', total: 103 }, { fecha: 'releaseDate', oficial: 'nope', total: 'total' })
  check('acepta otros nombres de campo', suyo.fecha === '2023-03-10' && suyo.total === 103, JSON.stringify(suyo))
}

console.log('\n── 3. Cuándo casan dos sets ──')
{
  const a = { fecha: '2023-03-10', oficial: 73, total: 103 }
  check('misma fecha y misma cuenta oficial', casan(a, { fecha: '2023-03-10', oficial: 73 }))
  // Un catálogo cuenta las secretas y el otro puede que no, así que vale
  // que coincida CUALQUIERA de las dos cuentas.
  check('  …o la total contra la oficial del otro', casan(a, { fecha: '2023-03-10', oficial: 103 }))
  check('  …o total contra total', casan(a, { fecha: '2023-03-10', total: 103 }))
  // LA FECHA SOLA NO BASTA: en Japón salen tres o cuatro sets el mismo día
  // —un set y sus dos mazos de ejemplo— y emparejar por fecha los mezcla.
  check('la fecha sola NO basta', !casan(a, { fecha: '2023-03-10', oficial: 30 }))
  // Y LA CUENTA SOLA TAMPOCO: hay decenas de sets de 30 cartas.
  check('la cuenta sola tampoco', !casan(a, { fecha: '2019-01-01', oficial: 73 }))
  check('sin fecha, nunca', !casan({ oficial: 73 }, { oficial: 73 }))
  check('sin cuenta, nunca', !casan({ fecha: '2023-03-10' }, { fecha: '2023-03-10' }))
}

console.log('\n── 4. El emparejamiento, con el caso real que lo motiva ──')
//
// Los cuatro sets de control de COWORK. Tres siguen la regla «minúsculas +
// _ja» y el cuarto NO: nuestro `S8b` es su `swsh8b_ja`, porque la era
// Espada y Escudo la nombran con el prefijo INGLÉS. Emparejar por
// identificador acierta en tres de cuatro — que es la peor clase de regla,
// la que funciona lo bastante para que te la creas.
{
  const nuestros = [
    { id: 'SM1M',  name: 'Collection Moon',   release_date: '2016-12-09', card_count_official: 60 },
    { id: 'M4',    name: 'Mega Brave',        release_date: '2025-09-26', card_count_official: 70 },
    { id: 'SM12a', name: 'Tag All Stars',     release_date: '2019-10-04', card_count_official: 173 },
    { id: 'S8b',   name: 'VMAX Climax',       release_date: '2021-12-03', card_count_official: 184 },
  ]
  const suyos = [
    { id: 'sm1m_ja',   name: 'Collection Moon', releaseDate: '2016-12-09', total: 60 },
    { id: 'm4_ja',     name: 'Mega Brave',      releaseDate: '2025-09-26', total: 70 },
    { id: 'sm12a_ja',  name: 'TAG ALL STARS',   releaseDate: '2019-10-04', total: 173 },
    { id: 'swsh8b_ja', name: 'VMAX Climax',     releaseDate: '2021-12-03', total: 184 },
  ]
  const campos = { suyos: { fecha: 'releaseDate', oficial: 'nope', total: 'total' } }
  const r = emparejarSets(nuestros, suyos, campos)
  check('casan los cuatro', r.pares.length === 4, JSON.stringify(r.pares.map((p) => `${p.nuestro.id}→${p.suyo.id}`)))
  check('ni ambiguos ni sueltos', r.ambiguos.length === 0 && r.sueltos.length === 0)
  // EL QUE IMPORTA: el que un mapeo mecánico se dejaría.
  const s8b = r.pares.find((p) => p.nuestro.id === 'S8b')
  check('S8b encuentra swsh8b_ja, que NO se deriva de su id', s8b?.suyo.id === 'swsh8b_ja', s8b?.suyo?.id)
}

console.log('\n── 5. Lo que NO empareja se dice, no se adivina ──')
{
  const nuestros = [
    { id: 'A', name: 'Uno',  release_date: '2020-01-01', card_count_official: 30 },
    { id: 'B', name: 'Dos',  release_date: '2020-01-01', card_count_official: 30 },
    { id: 'C', name: 'Tres', release_date: null,          card_count_official: 50 },
    { id: 'D', name: 'Cuat', release_date: '1999-01-01', card_count_official: 99 },
  ]
  const suyos = [
    { id: 'x', name: 'Uno', releaseDate: '2020-01-01', total: 30 },
    { id: 'y', name: 'Dos', releaseDate: '2020-01-01', total: 30 },
  ]
  const campos = { suyos: { fecha: 'releaseDate', oficial: 'nope', total: 'total' } }
  const r = emparejarSets(nuestros, suyos, campos)
  // A y B tienen la MISMA fecha y la MISMA cuenta, y sus dos candidatos
  // también: solo el nombre los separa. Eso sí se desempata.
  check('dos iguales se desempatan por el nombre', r.pares.length === 2, JSON.stringify(r.pares.map((p) => `${p.nuestro.id}→${p.suyo.id}`)))
  check('  …y cada uno con el suyo',
    r.pares.find((p) => p.nuestro.id === 'A')?.suyo.id === 'x' && r.pares.find((p) => p.nuestro.id === 'B')?.suyo.id === 'y')
  check('el que no tiene fecha se declara suelto', r.sueltos.some((s) => s.nuestro.id === 'C' && /fecha/.test(s.porque)))
  check('el que no casa con nada, también', r.sueltos.some((s) => s.nuestro.id === 'D'))
  check('  …y dice por qué', r.sueltos.every((s) => s.porque), JSON.stringify(r.sueltos.map((s) => s.porque)))
}
{
  // Dos candidatos que casan por fecha y cuenta y cuyos nombres NO ayudan:
  // AMBIGUO. No se elige. Elegir aquí es escribir el escaneo de otro set
  // encima del bueno, y no daría ningún error.
  const nuestros = [{ id: 'A', name: 'Promo', release_date: '2020-01-01', card_count_official: 30 }]
  const suyos = [
    { id: 'p1', name: 'Algo', releaseDate: '2020-01-01', total: 30 },
    { id: 'p2', name: 'Otro', releaseDate: '2020-01-01', total: 30 },
  ]
  const r = emparejarSets(nuestros, suyos, { suyos: { fecha: 'releaseDate', oficial: 'nope', total: 'total' } })
  check('con dos candidatos indistinguibles, NO se elige', r.pares.length === 0 && r.ambiguos.length === 1, JSON.stringify(r))
  check('  …y se dice cuáles eran', r.ambiguos[0].candidatos.length === 2)
}
{
  // Un set suyo no se puede usar dos veces: si ya casó con uno nuestro, no
  // vuelve a estar disponible. Sin esto, dos sets nuestros parecidos
  // apuntarían al MISMO suyo y uno de los dos se llenaría con las cartas
  // del otro.
  const nuestros = [
    { id: 'A', name: 'Uno', release_date: '2020-01-01', card_count_official: 30 },
    { id: 'B', name: 'Uno', release_date: '2020-01-01', card_count_official: 30 },
  ]
  const suyos = [{ id: 'x', name: 'Uno', releaseDate: '2020-01-01', total: 30 }]
  const r = emparejarSets(nuestros, suyos, { suyos: { fecha: 'releaseDate', oficial: 'nope', total: 'total' } })
  check('un set suyo no se reparte entre dos nuestros', r.pares.length === 1 && r.sueltos.length === 1, JSON.stringify(r.pares.length) + '/' + r.sueltos.length)
}

console.log('\n── 6. Y no se rompe con lo vacío ──')
{
  check('sin nada', emparejarSets(null, null).pares.length === 0)
  check('sin suyos, todo suelto', emparejarSets([{ id: 'A', release_date: '2020-01-01', card_count_official: 1 }], []).sueltos.length === 1)
  check('clave() aguanta cualquier cosa', clave(null) === '' && clave('Pokémon — ¡Ja!') === 'pokemonja')
}

console.log('\n── 7. SU respuesta de verdad, tal cual la devolvió la sonda ──')
//
// Esto es lo que contestó `en/expansions?page_size=1` el 2026-10-04, byte
// por byte. Está aquí porque el fixture que escribí ANTES de verla usaba
// fechas con guiones —me las imaginé— y su fecha viene con BARRAS. Con la
// primera versión, TODOS sus sets salían sin fecha y el emparejamiento no
// casaba NI UNO: todo «suelto», y sin un solo error.
const RESPUESTA_REAL = JSON.parse(`{"data":[{"id":"me55c","name":"30th Celebration: Classic Collection","series":"Mega Evolution","code":"30C","total":30,"printed_total":null,"language":"English","language_code":"EN","release_date":"2026/09/16","is_online_only":false,"logo":"https://images.scrydex.com/pokemon/me55c-logo/logo","symbol":"https://images.scrydex.com/pokemon/me55c-symbol/symbol"}],"page":1,"page_size":1,"count":1,"total_count":224}`)
{
  const suyo = RESPUESTA_REAL.data[0]
  const h = huellaDeSet(suyo, CAMPOS_SUYOS)
  check('su fecha CON BARRAS se entiende', h.fecha === '2026-09-16', JSON.stringify(h.fecha))
  check('  …y queda como la escribe Postgres', /^\d{4}-\d{2}-\d{2}$/.test(h.fecha || ''))
  check('`total` es la cuenta total', h.total === 30, String(h.total))
  check('`printed_total` a null no se inventa', h.oficial === null, String(h.oficial))
  check('`code` se recoge', h.codigo === '30C', String(h.codigo))
  // Y el nuestro, con nuestros nombres de campo, casa con el suyo.
  const nuestro = { id: '30th', name: '30th Anniversary Classic Collection', release_date: '2026-09-16', card_count_total: 30, tcg_online_code: '30c' }
  check('casa con el nuestro pese a llamarse distinto', casan(huellaDeSet(nuestro), h))
  const r = emparejarSets([nuestro], [suyo], { suyos: CAMPOS_SUYOS })
  check('  …y se empareja', r.pares.length === 1 && r.pares[0].suyo.id === 'me55c', JSON.stringify(r.sueltos))
}
{
  // El formato de fecha, por los dos lados y con basura.
  check('con guiones también vale', huellaDeSet({ release_date: '2024-01-26' }).fecha === '2024-01-26')
  check('con hora detrás, se recorta', huellaDeSet({ release_date: '2024/01/26T10:00:00' }).fecha === '2024-01-26')
  check('una fecha a medias no cuela', huellaDeSet({ release_date: '2024/01' }).fecha === null)
  check('ni una frase', huellaDeSet({ release_date: 'enero de 2024' }).fecha === null)
}

console.log('\n── 8. El CÓDIGO desempata antes que el nombre ──')
//
// `30C`, `PBL`: un identificador corto, no una cadena que se PAREZCA. Si
// los dos lo tienen y coincide, no hay duda. Pero no se empareja solo por
// él: el nuestro está vacío en los sets viejos, porque viene del set
// completo de TCGdex y de 2023 para atrás ni existe (la 345).
{
  const nuestros = [{ id: 'A', name: 'No se parece en nada', release_date: '2020-01-01', card_count_total: 30, tcg_online_code: 'AAA' }]
  const suyos = [
    { id: 'x', name: 'Otra cosa', release_date: '2020/01/01', total: 30, code: 'BBB' },
    { id: 'y', name: 'Tampoco',   release_date: '2020/01/01', total: 30, code: 'AAA' },
  ]
  const r = emparejarSets(nuestros, suyos, { suyos: CAMPOS_SUYOS })
  check('con nombres que no ayudan, manda el código', r.pares[0]?.suyo.id === 'y', JSON.stringify(r))
  check('  …y lo dice', r.pares[0]?.por === 'fecha+cuenta+código', r.pares[0]?.por)
  // Si NINGUNO de los dos tiene código, no se inventa: sigue el nombre y,
  // si tampoco, ambiguo.
  const sinCodigo = emparejarSets(
    [{ id: 'A', name: 'Nada', release_date: '2020-01-01', card_count_total: 30 }],
    [{ id: 'x', name: 'Uno', release_date: '2020/01/01', total: 30 }, { id: 'y', name: 'Dos', release_date: '2020/01/01', total: 30 }],
    { suyos: CAMPOS_SUYOS }
  )
  check('sin código ni nombre que ayude, AMBIGUO', sinCodigo.ambiguos.length === 1 && sinCodigo.pares.length === 0)
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
