// Tanda 545 — traer SUS cartas de los sets que solo tiene él.
//
// PINGU: «quiero que calques toda la base de datos de sets y de cartas de
// Scrydex y mostremos eso».
//
// La 540 trae sus SETS, y los trae bien. Pero el relleno solo ENRIQUECE —
// `if (!nuestra) { sinCartaNuestra++; continue }`—, así que un set traído de
// su catálogo se queda con CERO cartas: una colección vacía en la
// biblioteca, que es exactamente el hueco del que acabamos de borrar 68.
//
// Y no cuesta un crédito más: el barrido ya está pagando esas páginas y esas
// cartas vienen dentro. Lo único que hacía falta era dejar de tirarlas.
//
// LO QUE MÁS VIGILA ESTA PRUEBA es lo único que aquí se paga caro: que la
// misma carta acabe DOS VECES con dos identificadores. De un set de TCGdex
// no se inserta nada, porque su número y el nuestro se escriben distinto
// (`001` contra `1`) y eso sale en la cara de la biblioteca.
import { filaDeCartaSuya } from '/home/user/pingu/netlify/lib/scrydex.mjs'
import { procesar } from '/home/user/pingu/netlify/functions/scrydex-relleno.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ENV = { SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't', SUPABASE_SERVICE_ROLE_KEY: 's' }

// Copiada de su respuesta de verdad (la de `test-tanda-502.mjs`), con el
// idioma japonés encima: `name` en japonés y el occidental en `translation`.
const SUYA = {
  id: 'mf_ja-1', number: '001', name: 'イーブイ', supertype: 'Pokémon',
  rarity: 'Double Rare', rarity_code: 'RR', artist: 'Mitsuhiro Arita',
  national_pokedex_numbers: [133], hp: '70',
  translation: { en: { name: 'Eevee' } },
  images: [{ type: 'back', large: 'https://images.scrydex.com/pokemon/reverso/large' },
           { type: 'front', large: 'https://images.scrydex.com/pokemon/mf_ja-1-front/large' }],
  expansion: { id: 'mf_ja' },
}

console.log('── 1. La fila entera, con las tres que son `not null` ──')
{
  const f = filaDeCartaSuya(SUYA, { setId: 'mf_ja', market: 'JP' })
  // `id`, `set_id`, `local_id` y `name` son las que no pueden faltar: un
  // upsert FORMA la fila antes de ver que ya existe, y una que no se puede
  // formar tira la sentencia ENTERA con 23502 (la lección de la 526, que
  // costó una noche a cero cartas).
  for (const k of ['id', 'set_id', 'local_id', 'name']) {
    check(`\`${k}\` va puesta`, f[k] !== null && f[k] !== undefined && f[k] !== '', JSON.stringify(f[k]))
  }
  check('con SU identificador, tal cual', f.id === 'mf_ja-1', f.id)
  check('el número IMPRESO, sin tocar los ceros', f.local_id === '001', f.local_id)
  check('el nombre japonés en `name`, que es el de verdad', f.name === 'イーブイ', f.name)
  check('  …y el occidental al lado', f.name_en === 'Eevee', f.name_en)
  check('en el mercado japonés', f.market === 'JP', f.market)
  // La imagen, POR `type` y sin la calidad pegada: guardar «large» dejaría
  // la miniatura pintando la ficha grande para siempre.
  check('la imagen es la CARA', /mf_ja-1-front$/.test(f.image_scrydex || ''), f.image_scrydex)
  check('  …y sin la calidad pegada', !/\/large$/.test(f.image_scrydex || ''), f.image_scrydex)
  check('la rareza suya, en su columna', f.rarity_en === 'Double Rare' && f.rarity_code === 'RR', JSON.stringify([f.rarity_en, f.rarity_code]))
  check('la Pokédex, que la 483 tuvo que ir a buscar carta a carta', JSON.stringify(f.dex_ids) === '[133]', JSON.stringify(f.dex_ids))
  check('los PS, como número', f.hp === 70, JSON.stringify(f.hp))
  check('el ilustrador', f.illustrator === 'Mitsuhiro Arita', f.illustrator)
  // `supertype` viene con acento y la web compara contra `Pokemon`.
  check('la categoría, traducida a lo que la web espera', f.category === 'Pokemon', f.category)
  // NO se escribe `types`: en su respuesta japonesa no he visto ese campo, y
  // llenar una columna que FILTRA con algo que no sé en qué idioma viene es
  // peor que dejarla vacía (la lección de la 484).
  // Desde la 547 la ficha viene entera de Scrydex, tipos incluidos (los
  // vigila test-tanda-547): aquí solo se mira que estén.
  check('y se escriben los `types` (547)', 'types' in f, JSON.stringify(Object.keys(f)))
}

console.log('── 2. Lo que no se puede formar, no se forma ──')
{
  check('sin número, nada', filaDeCartaSuya({ ...SUYA, number: null }, { setId: 'mf_ja' }) === null)
  check('sin id suyo, nada', filaDeCartaSuya({ ...SUYA, id: null }, { setId: 'mf_ja' }) === null)
  check('sin set nuestro, nada', filaDeCartaSuya(SUYA, {}) === null)
  check('sin nombre de ninguna clase, nada', filaDeCartaSuya({ ...SUYA, name: '', translation: {} }, { setId: 'mf_ja' }) === null)
  // Y si solo trae el occidental, ese vale: `name` es `not null`.
  check('con solo el occidental, ese es el nombre', filaDeCartaSuya({ ...SUYA, name: '' }, { setId: 'mf_ja' })?.name === 'Eevee')
  // Un supertipo que no conocemos se queda a null, no se adivina.
  check('un supertipo raro no se inventa', filaDeCartaSuya({ ...SUYA, supertype: 'Vehículo' }, { setId: 'mf_ja' })?.category === null)
}

// ── El doble de una pasada ──
function doble({ cartas = [SUYA], nuestras = [], sets = null } = {}) {
  const escrito = []
  const restImpl = async (ruta) => {
    if (/scrydex_estado/.test(ruta)) return [{ valor: { pagina: 1 } }]
    if (/scrydex_at=is\.null/.test(ruta)) return [{ id: 'x' }]
    if (/tcg_sets/.test(ruta)) {
      return sets || [
        // Uno traído de su catálogo: ahí sí se insertan sus cartas.
        { id: 'mf_ja', scrydex_id: 'mf_ja', scrydex_por: 'importado de Scrydex' },
        // Y uno de TCGdex, emparejado: ahí NO.
        { id: 'SV1a', scrydex_id: 'sv1a_ja', scrydex_por: 'el código del set' },
      ]
    }
    if (/tcg_cards/.test(ruta)) return nuestras
    return []
  }
  let paginas = 0
  const fetchImpl = async () => {
    paginas++
    return { ok: true, json: async () => ({ data: paginas === 1 ? cartas : [], page: paginas, page_size: 250, total_count: cartas.length }) }
  }
  return { restImpl, fetchImpl, escribirImpl: async (tabla, filas) => { escrito.push({ tabla, filas }) }, escrito }
}
const correr = (d) => procesar({
  env: ENV, paginas: 1, mercado: 'JP', idioma: 'ja', claveEstado: 'cartas-jp',
  restImpl: d.restImpl, fetchImpl: d.fetchImpl, escribirImpl: d.escribirImpl, guardarEstadoImpl: async () => {},
})

console.log('── 3. En un set suyo, la carta que falta se TRAE ──')
{
  const d = doble()
  const r = await correr(d)
  const todas = d.escrito.flatMap((x) => x.filas)
  check('se escribe la carta', todas.some((f) => f.id === 'mf_ja-1'), JSON.stringify(todas.map((f) => f.id)))
  check('  …en `tcg_cards`', d.escrito.every((x) => x.tabla === 'tcg_cards'), JSON.stringify(d.escrito.map((x) => x.tabla)))
  check('y el informe lo cuenta', r.cuerpo.insertadas === 1, JSON.stringify([r.cuerpo.insertadas, r.cuerpo.sinCartaNuestra]))
  // PostgREST exige las MISMAS claves en todos los objetos de una
  // sentencia: una fila nueva trae columnas que el enriquecido no manda,
  // así que no pueden ir juntas.
  for (const sentencia of d.escrito) {
    const claves = sentencia.filas.map((f) => Object.keys(f).sort().join(','))
    check('  …y cada sentencia lleva las mismas columnas', new Set(claves).size <= 1, JSON.stringify([...new Set(claves)]))
  }
}

console.log('── 4. En un set de TCGdex, NO ──')
{
  // La misma carta, pero su expansión es la emparejada con un set nuestro
  // de TCGdex. Insertarla podría dejar la misma carta dos veces: `001` y
  // `1` son el mismo número escrito distinto.
  const d = doble({ cartas: [{ ...SUYA, id: 'sv1a_ja-1', expansion: { id: 'sv1a_ja' } }] })
  const r = await correr(d)
  const todas = d.escrito.flatMap((x) => x.filas)
  // Desde la 547 el japonés se calca de Scrydex ENTERO, también en los sets
  // que vinieron de TCGdex: la carta que falta se escribe, y se dice.
  check('desde la 547 sí se escribe', todas.length === 1 && todas[0].id === 'sv1a_ja-1', JSON.stringify(todas.map((f) => f.id)))
  check('  …y se cuenta', r.cuerpo.insertadas === 1, JSON.stringify([r.cuerpo.sinCartaNuestra, r.cuerpo.insertadas]))
}

console.log('── 5. Y la que ya tenemos se enriquece, no se duplica ──')
{
  // Segunda pasada: la carta que la primera insertó ya está, así que entra
  // por el camino de siempre.
  const d = doble({ nuestras: [{ id: 'mf_ja-1', market: 'JP', set_id: 'mf_ja', local_id: '001', name: 'イーブイ' }] })
  const r = await correr(d)
  const todas = d.escrito.flatMap((x) => x.filas)
  check('solo una fila para esa carta', todas.filter((f) => f.id === 'mf_ja-1').length === 1, JSON.stringify(todas.map((f) => f.id)))
  check('y ya no cuenta como insertada', r.cuerpo.insertadas === 0 && r.cuerpo.escritas === 1, JSON.stringify([r.cuerpo.insertadas, r.cuerpo.escritas]))
}

console.log('── 6. Dos veces la misma clave en una sentencia, no ──')
{
  // Postgres corta con «ON CONFLICT DO UPDATE command cannot affect row a
  // second time» y se lleva la página entera (la lección del catálogo
  // chino, tanda 333).
  const d = doble({ cartas: [SUYA, { ...SUYA }] })
  const r = await correr(d)
  const todas = d.escrito.flatMap((x) => x.filas)
  check('el repetido se queda fuera', todas.filter((f) => f.id === 'mf_ja-1').length === 1, JSON.stringify(todas.map((f) => f.id)))
  check('y se cuenta una', r.cuerpo.insertadas === 1, String(r.cuerpo.insertadas))
}

console.log('── 7. Un set sin emparejar sigue sin tocarse ──')
{
  // Un par falso metería las cartas de otro set dentro del nuestro sin dar
  // error, que es lo que costaron las tandas 504 y 505. El relleno solo
  // mira sets con `scrydex_id`, y esto lo deja escrito.
  const fuente = readFileSync('/home/user/pingu/netlify/functions/scrydex-relleno.mjs', 'utf8')
  check('solo pide sets emparejados', /tcg_sets\?select=[^`]*scrydex_id=not\.is\.null/.test(fuente))
  // (El rótulo «importado de Scrydex» se fue con la 547: ahora todo el JP es suyo.)
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
