// Tanda 471 — el catálogo japonés y los dos chinos, que se llenan solos.
//
// Sin red y sin base: `procesar` recibe el cliente de Supabase y el de
// TCGdex por parámetro, igual que las otras funciones programadas. Lo
// que se afirma aquí es QUÉ PETICIONES se hacen y en qué orden, que es
// justo lo que no se puede leer en el código de un tirón.
//
// Las respuestas de ejemplo están escritas con la forma que documenta
// TCGdex. **No se han comprobado contra la API de verdad** (este
// contenedor no sale a internet), así que esto afirma que mapeamos bien
// LO QUE CREEMOS que llega. La primera pasada real confirma la otra
// mitad.
import { procesar, hayQueVisitar, visitarSet } from '/home/user/pingu/netlify/functions/catalogo-asia.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}

// ── Los sets de ejemplo ──
//
// Los tres estados que importan, porque cada uno pide otra cosa:
const SIN_CARTAS = {
  id: 'sv1a', market: 'JP', name: 'Triplete Beat', imported_at: null, imported_cards: null,
  release_date: '2023-03-10', serie_id: null, serie_name: null, tcg_online_code: null,
  logo_path: null, symbol_url: null, card_count_official: null, card_count_total: null,
  curado_at: null, curado_v: 0,
}
const SIN_CURAR = {
  id: 's12a', market: 'JP', name: 'VSTAR Universe', imported_at: '2026-01-01T00:00:00Z', imported_cards: 300,
  release_date: null, serie_id: null, serie_name: null, tcg_online_code: null,
  logo_path: null, symbol_url: null, card_count_official: null, card_count_total: null,
  curado_at: null, curado_v: 0,
}
const HECHO = {
  id: 'cs1a', market: 'CN', name: 'Hecho', imported_at: '2026-01-01T00:00:00Z', imported_cards: 10,
  release_date: '2022-01-01', serie_id: 'cs', serie_name: 'CS', tcg_online_code: null,
  logo_path: 'cs/cs1a/logo', symbol_url: 'x', card_count_official: 10, card_count_total: 10,
  curado_at: '2026-01-01T00:00:00Z', curado_v: 1,
}

const SET_COMPLETO = {
  id: 'sv1a', name: 'Triplete Beat', releaseDate: '2023-03-10',
  serie: { id: 'sv', name: 'Scarlet & Violet' },
  logo: 'https://assets.tcgdex.net/ja/sv/sv1a/logo', symbol: 'https://assets.tcgdex.net/univ/sv/sv1a/symbol.png',
  cardCount: { total: 73, official: 64 },
  cards: [
    { id: 'sv1a-1', localId: '1', name: 'フシギダネ', image: 'https://assets.tcgdex.net/ja/sv/sv1a/1' },
    // La MISMA otra vez: el catálogo trae repetidos, y dos con la misma
    // clave en una sentencia la parten («cannot affect row a second time»).
    { id: 'sv1a-1', localId: '1', name: 'repetida' },
    // Sin escaneo: `image_path` a null, que es un valor y no un fallo.
    { id: 'sv1a-2', localId: '2', name: 'フシギソウ', image: null },
  ],
}

function doble({ sets = [SIN_CARTAS, SIN_CURAR, HECHO], nuestros = ['sv1a', 's12a'], listado = null, romper = null } = {}) {
  const llamadas = []
  const pedir = async (ruta, o = {}) => {
    llamadas.push({ ruta, metodo: o.method || 'GET', cuerpo: o.body ? JSON.parse(o.body) : null })
    if (ruta.startsWith('tcg_sets?select=id&market=')) return nuestros.map((id) => ({ id }))
    if (ruta.startsWith('tcg_sets?select=')) return sets
    return null
  }
  const traer = async (url) => {
    llamadas.push({ tcgdex: url })
    // `endsWith` y no `includes`: con `includes`, romper '/sets' habría
    // roto también '/sets/sv1a' y el doble habría probado otra cosa
    // de la que dice. Es la trampa de siempre — al barrer por una
    // cadena, todo lo que la CONTIENE cuenta.
    if (romper && url.endsWith(romper)) throw new Error('TCGdex 503')
    if (url.endsWith('/sets')) return listado ?? [
      { id: 'sv1a', name: 'Triplete Beat', logo: 'https://assets.tcgdex.net/ja/sv/sv1a/logo', cardCount: { total: 73, official: 64 } },
      { id: 'sv8', name: 'Recién salido', logo: 'https://assets.tcgdex.net/ja/sv/sv8/logo', cardCount: { total: 100, official: 90 } },
      // Pokémon TCG Pocket: una letra y un número. No es el juego de
      // mesa y no debe entrar (tanda 328).
      { id: 'A1', name: 'Genetic Apex' },
    ]
    if (url.includes('/sets/sv1a')) return SET_COMPLETO
    if (url.includes('/sets/s12a')) return {
      id: 's12a', name: 'VSTAR Universe', releaseDate: '2022-12-02',
      serie: { id: 'sws', name: 'Sword & Shield' },
      logo: 'https://assets.tcgdex.net/ja/sws/s12a/logo',
      cardCount: { total: 300, official: 172 },
      cards: [{ id: 's12a-1', localId: '1', name: 'no debe entrar' }],
    }
    throw new Error('TCGdex 404')
  }
  return { pedir, traer, llamadas }
}

const correr = (opciones = {}, reloj = () => 0) => {
  const d = doble(opciones)
  return procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, fetchImpl: d.pedir, traerImpl: d.traer, reloj })
    .then((r) => ({ r, llamadas: d.llamadas }))
}

console.log('── 1. Quién hay que visitar ──')
check('un set sin cartas, sí', hayQueVisitar(SIN_CARTAS))
check('un set con cartas pero sin curar, sí', hayQueVisitar(SIN_CURAR))
check('uno hecho del todo, NO', !hayQueVisitar(HECHO))
// Esto es el cerrojo de la tanda 333 dicho en una prueba: si un set
// hecho volviera, la cola no se vaciaría nunca y la función estaría
// pidiéndole a TCGdex los mismos 550 sets cada seis minutos para siempre.
check('sin la migración de curado_at se mira la serie', hayQueVisitar({ imported_at: 'x', serie_id: null }))
check('y con serie y nombre de serie, ya no', !hayQueVisitar({ imported_at: 'x', serie_id: 'sv', serie_name: 'SV' }))

console.log('\n── 2. Sin la clave de servicio no se hace nada ──')
const sinClave = await procesar({ env: {} })
check('se dice y no se revienta', sinClave.ok === false && /SERVICE_ROLE/.test(sinClave.error), JSON.stringify(sinClave))

console.log('\n── 3. Una pasada entera ──')
const { r, llamadas } = await correr()
check('sale bien', r.ok === true, JSON.stringify(r))
check('visita los dos que lo necesitan y no el tercero', r.setsVisitados === 2, String(r.setsVisitados))
check('trae las cartas del que no tenía ninguna', r.cartas === 2, String(r.cartas))
check('y cura los dos', r.setsCurados === 2, String(r.setsCurados))
check('sin fallos', r.conFallo === 0, JSON.stringify(r.fallos))

const aTcgdex = llamadas.filter((l) => l.tcgdex).map((l) => l.tcgdex)
check('pide un listado y dos sets, nada más', aTcgdex.length === 3, aTcgdex.join(' | '))
check('el listado va en el idioma del mercado', /\/v2\/(ja|zh-cn|zh-tw)\/sets$/.test(aTcgdex[0]), aTcgdex[0])
// Los sets sin NI UNA carta primero: un set vacío es una pantalla vacía,
// y un set sin serie es un logo que no sale. Lo primero molesta más.
check('el que no tiene cartas va antes', aTcgdex[1].includes('sv1a'), aTcgdex.join(' | '))

console.log('\n── 4. El listado solo INSERTA lo que no tenemos ──')
// Y esto no es cosmética: un `merge-duplicates` con lo que da el listado
// escribiría NULL encima del logo, la serie, la fecha y las cuentas que
// la visita acaba de curar. El listado es un «SetResume» y no trae
// ninguna de las cuatro — pisar lo bueno con lo que no se sabe no daría
// ningún error, dejaría la estantería como el primer día.
const insertados = llamadas.filter((l) => l.ruta === 'tcg_sets' && l.metodo === 'POST')
check('una sola sentencia de inserción', insertados.length === 1, String(insertados.length))
const nuevos = insertados[0]?.cuerpo || []
check('solo el set nuevo', nuevos.length === 1 && nuevos[0].id === 'sv8', JSON.stringify(nuevos.map((x) => x.id)))
check('no es un upsert', !llamadas.some((l) => l.ruta?.startsWith('tcg_sets?on_conflict')))
check('y Pokémon TCG Pocket se queda fuera', !nuevos.some((x) => x.id === 'A1'), JSON.stringify(nuevos.map((x) => x.id)))
check('el set nuevo lleva su mercado', nuevos[0]?.market === 'JP', String(nuevos[0]?.market))

console.log('\n── 5. Las cartas ──')
const cartas = llamadas.filter((l) => l.ruta?.startsWith('tcg_cards'))
check('van en un upsert por (id, mercado)', cartas.length === 1 && cartas[0].ruta.includes('on_conflict=id,market'), cartas.map((c) => c.ruta).join(' | '))
const filasCarta = cartas[0]?.cuerpo || []
check('la repetida se cae', filasCarta.length === 2, JSON.stringify(filasCarta.map((c) => c.id)))
check('con el mercado dentro', filasCarta.every((c) => c.market === 'JP'))
check('el nombre es el JAPONÉS, que es el catálogo', filasCarta[0]?.name === 'フシギダネ', filasCarta[0]?.name)
check('la imagen se guarda sin el idioma', filasCarta[0]?.image_path === 'sv/sv1a/1', filasCarta[0]?.image_path)
check('una sin escaneo se guarda a null, no se inventa', filasCarta[1]?.image_path === null, String(filasCarta[1]?.image_path))
// `name_search` y `name_key` las CALCULA la base (columnas generadas) y
// en Postgres no se pueden escribir: mandarlas tumbaría la sentencia.
check('no se manda ninguna columna generada',
  !filasCarta.some((c) => 'name_search' in c || 'name_key' in c))
// Y las cartas de un set YA importado no se vuelven a subir: un
// `merge-duplicates` escribiría null encima de las imágenes que el
// engorde haya encontrado, y un set que TCGdex declara más largo de lo
// que publica volvería en cada pasada para siempre (el cerrojo de la 333).
check('no se tocan las cartas de un set ya importado',
  !filasCarta.some((c) => c.set_id === 's12a'), JSON.stringify(filasCarta.map((c) => c.set_id)))

console.log('\n── 6. Lo que se le escribe al set ──')
const parches = llamadas.filter((l) => l.metodo === 'PATCH')
check('un PATCH por set visitado', parches.length === 2, String(parches.length))
const porSet = Object.fromEntries(parches.map((p) => [p.ruta.match(/id=eq\.([^&]+)/)[1], p.cuerpo]))
check('el PATCH lleva el mercado en el filtro', parches.every((p) => /&market=eq\.(JP|CN|TW)/.test(p.ruta)), parches.map((p) => p.ruta).join(' | '))
// LA SERIE es el dato que faltaba y que nadie echaba de menos: sin ella
// `urlDeLogoPorPartes` devuelve null y el logo del set no se dibuja. Por
// eso «no hay logos japoneses» y «no hay fotos japonesas» eran el mismo
// agujero visto dos veces.
check('se cura la serie', porSet.sv1a?.serie_id === 'sv' && porSet.sv1a?.serie_name === 'Scarlet & Violet', JSON.stringify(porSet.sv1a))
check('y el logo', porSet.sv1a?.logo_path === 'sv/sv1a/logo', String(porSet.sv1a?.logo_path))
// Y las CUENTAS, que son con las que la estantería mide el progreso: sin
// ellas decía «0 de 0» con las cartas delante.
check('y las dos cuentas', porSet.sv1a?.card_count_total === 73 && porSet.sv1a?.card_count_official === 64, JSON.stringify(porSet.sv1a))
check('las cartas y su marca van en el MISMO PATCH', porSet.sv1a?.imported_cards === 2 && !!porSet.sv1a?.imported_at, JSON.stringify(porSet.sv1a))
// Nunca se escribe null encima de algo que ya estaba bien: sv1a ya tenía
// fecha, así que no se vuelve a mandar.
check('una fecha que ya estaba no se reescribe', !('release_date' in (porSet.sv1a || {})), JSON.stringify(porSet.sv1a))
check('la que faltaba sí', porSet.s12a?.release_date === '2022-12-02', JSON.stringify(porSet.s12a))
// La marca de visita se escribe SIEMPRE, también en el set al que no le
// faltaba nada que curar: sin ella volvería en cada pasada.
check('la marca de visita va en los dos', !!porSet.sv1a?.curado_at && !!porSet.s12a?.curado_at)
check('con la versión del curador', porSet.sv1a?.curado_v === 1 && porSet.s12a?.curado_v === 1)
check('al set ya hecho no se le escribe nada', !porSet.cs1a)

console.log('\n── 7. Sin la migración de curado, no se manda la columna ──')
// Pedirle a PostgREST una columna que no está no devuelve null: devuelve
// un 400, y como el PATCH lleva también la serie y el logo se llevaría
// por delante la cura entera, no solo la marca.
const viejo = { id: 'sv1a', market: 'JP', imported_at: null, serie_id: null }
const d7 = doble()
await visitarSet(d7.pedir, d7.traer, viejo)
const p7 = d7.llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo || {}
check('ni curado_at ni curado_v', !('curado_at' in p7) && !('curado_v' in p7), JSON.stringify(p7))
check('pero sí la serie y el logo', p7.serie_id === 'sv' && p7.logo_path === 'sv/sv1a/logo', JSON.stringify(p7))

console.log('\n── 8. Un set que falla no para los otros ──')
const { r: r8 } = await correr({ romper: '/sets/sv1a' })
check('sale bien de todas formas', r8.ok === true, JSON.stringify(r8))
check('se visita el otro', r8.setsVisitados === 1, String(r8.setsVisitados))
check('y el fallo se cuenta y se dice cuál', r8.conFallo === 1 && /JP\/sv1a/.test(r8.fallos[0]), JSON.stringify(r8.fallos))

console.log('\n── 9. Si TCGdex no contesta al listado, la pasada sigue ──')
// El listado es lo accesorio: sirve para que un set NUEVO aparezca solo.
// Lo importante son las cartas, y no pueden depender de él.
const { r: r9 } = await correr({ romper: '/sets' })
check('las cartas se traen igual', r9.ok === true && r9.setsVisitados === 2, JSON.stringify(r9))
check('y el fallo del listado se dice', /listado/.test(r9.fallos.join(' ')), JSON.stringify(r9.fallos))

console.log('\n── 10. El presupuesto de tiempo ──')
// Netlify mata una función programada a los 30 s sin avisar. Pararse
// antes deja la pasada cerrada en orden; lo que no dé tiempo sigue sin
// marcar y lo coge la pasada siguiente.
let t = 0
const { r: r10 } = await correr({}, () => (t += 60000))
check('con el reloj pasado, no se visita nada', r10.setsVisitados === 0, JSON.stringify(r10))
check('pero la pasada sale bien', r10.ok === true, JSON.stringify(r10))

console.log('\n── 11. Los mercados ──')
// El mercado de la pasada sale del reloj, no del azar: así los tres se
// repasan por turnos. Con tres mercados, tres minutos seguidos tocan los
// tres idiomas distintos.
const idiomas = new Set()
for (let m = 0; m < 3; m++) {
  const { llamadas: l } = await correr({}, () => m * 60000)
  idiomas.add(l.find((x) => x.tcgdex?.endsWith('/sets'))?.tcgdex)
}
check('tres pasadas seguidas repasan tres catálogos', idiomas.size === 3, [...idiomas].join(' | '))
// Y el occidental NO: lo lleva `cartas-detalle`, y traer sus 23.000
// cartas otra vez no arreglaría nada.
check('ninguna pide el inglés', ![...idiomas].some((u) => u.includes('/en/')), [...idiomas].join(' | '))

console.log('\n── 12. Un listado vacío no borra nada ──')
const { llamadas: l12 } = await correr({ listado: [] })
check('no se inserta ningún set', !l12.some((x) => x.ruta === 'tcg_sets' && x.metodo === 'POST'))
check('y las visitas siguen', l12.filter((x) => x.metodo === 'PATCH').length === 2)

console.log('\n── 13. Un mercado VACÍO se llena el primero (tanda 479) ──')
// Un mercado con CERO sets es el tapón de todo lo demás: sin sus filas en
// `tcg_sets`, la fase de las cartas no tiene a quién visitar y la pasada
// entera no hace nada. Con el turno por el reloj, llenar el japés dependía
// de que le tocara.
{
  // `nuestros: []` = ese mercado está a cero. El reloj dice que tocaría
  // otro, así que si sale el vacío es porque manda el vacío.
  const { llamadas } = await correr({ nuestros: [], sets: [] }, () => 60000)
  const pedido = llamadas.find((x) => x.tcgdex?.endsWith('/sets'))?.tcgdex
  check('se pide el listado del primero que esté a cero', /\/v2\/ja\/sets$/.test(pedido || ''), String(pedido))
  // Y sin reloj: traer ~400 sets de un catálogo vacío es una petición
  // gorda y cuatro inserciones, y cortarlo a los cinco segundos dejaba la
  // pasada siguiente empezándolo otra vez desde el principio.
  const { r } = await correr({ nuestros: [], sets: [] }, () => 60000)
  check('  …y se insertan sus sets', r.setsNuevos > 0, JSON.stringify(r))
  check('  …y se dice cuál se está arrancando', r.arrancando === 'JP', JSON.stringify(r))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
