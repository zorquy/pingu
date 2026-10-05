// Tanda 488 — los escaneos que TCGdex tiene y su API no dice, y los
// nombres con letras de aquí.
//
// PINGU: «hay un apartado donde coge las cartas de un sitio, coge los
// símbolos de otro, entonces deberíamos tenerlo todo. No sé qué se está
// haciendo mal para no traer ni las imágenes de las cartas ni los nombres».
//
// Medido el 2026-10-03 contra TCGdex de verdad: en japonés la API dice
// 3.882 cartas con imagen y en su servidor de ficheros existen 7.365.
//
// La escribió la sesión de COWORK de PINGU (una TERCERA en este repo, y la
// única con salida a TCGdex) numerada como 485; pasa a 488 porque la 485 y
// la 486 ya estaban comiteadas con sus pruebas empujadas. Octavo choque de
// números y el primero con tres sesiones.
//
// Lo que esta prueba NO cubre y vigila `test-tanda-487.mjs`: que una
// reimportación no borre lo que esta función encuentra. `cardToRow` manda
// `image_path: null` cuando la API calla, y con un `merge-duplicates` eso
// PISA la foto — así que las dos piezas van juntas o no van.
import { caminoPorPartes, urlDeEscaneo, veredicto, nombreLatino, nombreParaBuscar, esNombreAjeno } from '/home/user/pingu/netlify/lib/escaneos-asia.mjs'
import { buscarEscaneos, escribirNombres, procesar, config } from '/home/user/pingu/netlify/functions/escaneos-asia.mjs'
import { urlDeImagen } from '/home/user/pingu/js/carta-ruta.js'
import { imagePathFromUrl } from '/home/user/pingu/js/carta-detalle.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. El camino por partes ──')
{
  check('serie/set/número', caminoPorPartes('SM', 'SM1M', '001') === 'SM/SM1M/001')
  // EL INVARIANTE: lo montado a mano es lo MISMO que se recorta de la URL
  // que da la API cuando sí la da. Si no, habría dos formas de guardar una
  // foto y `urlDeImagen` solo sabría pintar una.
  check('es lo mismo que se recorta de la API',
    caminoPorPartes('SV', 'SV1a', '001') === imagePathFromUrl('https://assets.tcgdex.net/ja/SV/SV1a/001'))
  check('y la pantalla lo pinta en SU idioma',
    urlDeImagen(caminoPorPartes('SM', 'SM1M', '001'), 'low', 'JP') === 'https://assets.tcgdex.net/ja/SM/SM1M/001/low.webp')
  check('la que se pregunta es la que se pinta',
    urlDeEscaneo('SM/SM1M/001', 'ja') === urlDeImagen('SM/SM1M/001', 'low', 'JP'))
  check('sin serie no hay camino', caminoPorPartes(null, 'SM1M', '001') === null)
  check('sin número tampoco', caminoPorPartes('SM', 'SM1M', '') === null)
  check('un Unown «?» no se monta', caminoPorPartes('ex', 'exu', '?') === null)
  check('ni uno ya codificado', caminoPorPartes('ex', 'exu', '%3F') === null)
  check('ni uno con barra', caminoPorPartes('SM', 'SM1M', '1/2') === null)
  check('un set con punto sí (CS2.5)', caminoPorPartes('S', 'CS2.5', '010') === 'S/CS2.5/010')
}

console.log('\n── 2. Qué significa lo que contesta el servidor ──')
{
  check('200 → está', veredicto(200) === 'esta')
  check('404 → no está', veredicto(404) === 'no-esta')
  check('403 → no está', veredicto(403) === 'no-esta')
  check('503 → NO se sabe', veredicto(503) === 'no-se-sabe')
  check('sin respuesta → NO se sabe', veredicto(0) === 'no-se-sabe')
}

console.log('\n── 3. La fase de escaneos ──')
const doble = (filas, estados = {}) => {
  const llamadas = []
  const pedir = async (ruta, o = {}) => {
    llamadas.push({ ruta, metodo: o.method || 'GET', cuerpo: o.body ? JSON.parse(o.body) : null })
    if (ruta.startsWith('tcg_cards?select=')) return filas
    return null
  }
  const mirar = async (url) => {
    llamadas.push({ head: url })
    for (const [trozo, estado] of Object.entries(estados)) if (url.includes(trozo)) return estado
    return 200
  }
  return { pedir, mirar, llamadas }
}
{
  const d = doble(
    [
      { id: 'SM1M-001', market: 'JP', set_id: 'SM1M', local_id: '001', tcg_sets: { serie_id: 'SM' } },
      { id: 'SM1M-073', market: 'JP', set_id: 'SM1M', local_id: '073', tcg_sets: { serie_id: 'SM' } },
      { id: 'SV8-001', market: 'CN', set_id: 'SV8', local_id: '001', tcg_sets: { serie_id: 'SV' } },
      { id: 'SV4a-030', market: 'TW', set_id: 'SV4a', local_id: '030', tcg_sets: { serie_id: 'SV' } },
      { id: 'XX-1', market: 'JP', set_id: 'XX', local_id: '1', tcg_sets: null },
      { id: 'M2-005', market: 'JP', set_id: 'M2', local_id: '005', tcg_sets: { serie_id: 'M' } },
    ],
    { 'SM1M/073': 404, '/zh-cn/': 404, 'M/M2/005': 503 }
  )
  const r = await buscarEscaneos(d.pedir, d.mirar, () => 1e12, 2e12)
  check('cuenta lo que hizo', r.miradas === 6 && r.encontradas === 2 && r.sinFoto === 3 && r.dudosas === 1, JSON.stringify(r))

  const consulta = d.llamadas[0].ruta
  check('pide SOLO las que no tienen foto', /image_path=is\.null/.test(consulta), consulta)
  // Desde la 547 el japonés es de Scrydex: TCGdex solo trae escaneos de CN y TW.
  check('  …de los catálogos asiáticos de TCGdex (CN y TW)', /market=in\.\(CN,TW\)/.test(consulta) && !/WEST/.test(consulta) && !/JP/.test(consulta), consulta)
  check('  …las no miradas o las de hace más de un mes', /or=\(escaneo_buscado_at\.is\.null,escaneo_buscado_at\.lt\./.test(consulta), consulta)
  check('  …primero las que no se han mirado nunca', /order=escaneo_buscado_at\.asc\.nullsfirst/.test(consulta), consulta)

  const heads = d.llamadas.filter((l) => l.head).map((l) => l.head)
  check('cada carta se pregunta en SU idioma',
    heads.includes('https://assets.tcgdex.net/ja/SM/SM1M/001/low.webp') &&
    heads.includes('https://assets.tcgdex.net/zh-cn/SV/SV8/001/low.webp') &&
    heads.includes('https://assets.tcgdex.net/zh-tw/SV/SV4a/030/low.webp'), heads.join(' | '))
  check('la que no tiene serie no se pregunta', heads.length === 5, String(heads.length))

  const patches = d.llamadas.filter((l) => l.metodo === 'PATCH')
  const fotos = patches.filter((p) => p.cuerpo.image_path)
  check('se guardan las dos que existen', fotos.length === 2, String(fotos.length))
  check('  …con el camino sin idioma', fotos.some((p) => p.cuerpo.image_path === 'SM/SM1M/001') && fotos.some((p) => p.cuerpo.image_path === 'SV/SV4a/030'))
  check('  …y la marca en la MISMA sentencia', fotos.every((p) => p.cuerpo.escaneo_buscado_at))
  check('  …con el mercado en el filtro', fotos.every((p) => /&market=eq\.(JP|TW)/.test(p.ruta)), fotos.map((p) => p.ruta).join(' | '))
  // No pisa una foto que haya llegado por otro lado entre la consulta y
  // la escritura.
  check('  …y solo si sigue sin foto', fotos.every((p) => /image_path=is\.null/.test(p.ruta)))

  const marcas = patches.filter((p) => !p.cuerpo.image_path)
  check('las que no tienen se marcan sin foto', marcas.every((p) => !('image_path' in p.cuerpo) && p.cuerpo.escaneo_buscado_at))
  const rutas = marcas.map((p) => decodeURIComponent(p.ruta)).join(' | ')
  check('  …por mercado, nunca mezcladas (y las JP ya no se tocan)', !/market=eq\.JP/.test(rutas) && /market=eq\.CN&id=in\.\("SV8-001"\)/.test(rutas), rutas)
  // EL QUE IMPORTA: un 503 no es «no tiene foto». Marcarla la dejaría un
  // mes sin mirar por un mal rato del servidor.
  check('la del 503 NO se marca', !JSON.stringify(patches).includes('M2-005'))
}
{
  // Sin tiempo no se pregunta ni se escribe nada.
  const d = doble([{ id: 'SM1M-001', market: 'JP', set_id: 'SM1M', local_id: '001', tcg_sets: { serie_id: 'SM' } }])
  const r = await buscarEscaneos(d.pedir, d.mirar, () => 10, 5)
  check('con el reloj agotado no hace nada', r.encontradas === 0 && !d.llamadas.some((l) => l.head || l.metodo === 'PATCH'), JSON.stringify(r))
}

console.log('\n── 4. El nombre con letras de aquí ──')
{
  check('リザードン → Charizard', nombreLatino('リザードン', [6]) === 'Charizard', nombreLatino('リザードン', [6]))
  check('con su ex', nombreLatino('リザードンex', [6]) === 'Charizard ex')
  check('con su V', nombreLatino('ピカチュウV', [25]) === 'Pikachu V')
  check('VMAX antes que V', nombreLatino('ピカチュウVMAX', [25]) === 'Pikachu VMAX')
  check('VSTAR', nombreLatino('アルセウスVSTAR', [493]) === 'Arceus VSTAR')
  check('GX con guion, como aquí', nombreLatino('カプ・コケコGX', [785]) === 'Tapu Koko-GX', nombreLatino('カプ・コケコGX', [785]))
  check('TAG TEAM: las dos especies', nombreLatino('フェローチェ&マッシブーンGX', [795, 794]) === 'Pheromosa & Buzzwole-GX', nombreLatino('フェローチェ&マッシブーンGX', [795, 794]))
  check('Mega', nombreLatino('メガゲッコウガex', [658]) === 'Mega Greninja ex', nombreLatino('メガゲッコウガex', [658]))
  // メガニウム y メガヤンマ empiezan por «メガ» y NO son megas.
  check('Meganium no es una Mega', nombreLatino('メガニウム', [154]) === 'Meganium', nombreLatino('メガニウム', [154]))
  check('  …pero Mega Meganium sí', nombreLatino('メガメガニウムex', [154]) === 'Mega Meganium ex', nombreLatino('メガメガニウムex', [154]))
  check('Yanmega tampoco', nombreLatino('メガヤンマ', [469]) === 'Yanmega', nombreLatino('メガヤンマ', [469]))
  check('regional', nombreLatino('アローラロコン', [37]) === 'Alolan Vulpix', nombreLatino('アローラロコン', [37]))
  check('chino también', nombreLatino('熱帶龍', [357]) === 'Tropius')
  check('sin especie no se inventa', nombreLatino('ハイパーボール', null) === null && nombreLatino('ハイパーボール', []) === null)
  check('una especie que no conocemos tampoco', nombreLatino('？？？', [99999]) === null)

  check('japonés es ajeno', esNombreAjeno('トロピウス') && esNombreAjeno('熱帶龍') && esNombreAjeno('샤이니'))
  check('«Pokémon GO» no', !esNombreAjeno('Pokémon GO') && !esNombreAjeno("Farfetch'd") && !esNombreAjeno('Koffing'))

  // Nunca null con nombre: una carta sin escribir volvería a la cola en
  // cada pasada para siempre (el cerrojo de la 333).
  check('la que ya está en latino se queda como está', nombreParaBuscar({ name: 'Koffing', dex_ids: [109] }) === 'Koffing')
  check('la que no se puede traducir sale de la cola igual', nombreParaBuscar({ name: 'ハイパーボール', dex_ids: [] }) === 'ハイパーボール')
  check('la que sí, traducida', nombreParaBuscar({ name: 'トロピウス', dex_ids: [357] }) === 'Tropius')
}

console.log('\n── 5. La fase de nombres ──')
{
  const d = doble([
    { id: 'SV1a-001', market: 'JP', name: 'トロピウス', dex_ids: [357] },
    { id: 'E1-001', market: 'JP', name: 'Koffing', dex_ids: [109] },
    { id: 'SV1a-001', market: 'TW', name: '熱帶龍', dex_ids: [357] },
  ])
  const r = await escribirNombres(d.pedir, () => 0, 99)
  check('escribe los tres y cuenta los traducidos', r.escritos === 3 && r.traducidos === 2, JSON.stringify(r))
  const consulta = d.llamadas[0].ruta
  check('solo las que tienen especie y no tienen nombre', /name_es=is\.null/.test(consulta) && /dex_ids=not\.is\.null/.test(consulta), consulta)
  check('  …asiáticas de TCGdex (CN y TW; el JP es de Scrydex desde la 547)', /market=in\.\(CN,TW\)/.test(consulta) && !/WEST/.test(consulta))
  const patches = d.llamadas.filter((l) => l.metodo === 'PATCH')
  check('va a `name_es`', patches[0].cuerpo.name_es === 'Tropius', JSON.stringify(patches[0].cuerpo))
  // LA REGLA DE LA CASA (334 y 335): el nombre japonés es la clave.
  check('  …y NUNCA a `name`', patches.every((p) => !('name' in p.cuerpo)))
  check('  …con el mercado en el filtro (el id no es único)', /SV1a-001&market=eq\.JP/.test(patches[0].ruta) && /SV1a-001&market=eq\.TW/.test(patches[2].ruta))
  check('  …y sin pisar un nombre que ya esté', patches.every((p) => /name_es=is\.null/.test(p.ruta)))
}

console.log('\n── 6. La pasada entera ──')
{
  check('sin la clave no arranca', (await procesar({ env: {} })).ok === false)
  // Sin la migración, los escaneos se saltan y los NOMBRES SIGUEN.
  const llamadas = []
  const r = await procesar({
    env: { SUPABASE_SERVICE_ROLE_KEY: 'x' },
    fetchImpl: async (ruta, o = {}) => {
      llamadas.push({ ruta, metodo: o.method || 'GET' })
      if (/escaneo_buscado_at/.test(ruta)) throw new Error('Supabase 400: {"code":"42703","message":"column tcg_cards.escaneo_buscado_at does not exist"}')
      if (ruta.startsWith('tcg_cards?select=')) return [{ id: 'SV1a-001', market: 'JP', name: 'トロピウス', dex_ids: [357] }]
      return null
    },
    mirarImpl: async () => 200,
  })
  check('sin la migración no es un fallo', r.ok === true && /migration-escaneo-buscado/.test(r.escaneos?.saltado || ''), JSON.stringify(r))
  check('  …y los nombres salen igual', r.nombres?.escritos === 1, JSON.stringify(r.nombres))
  check('va programada', /^\S+ \* \* \* \*$/.test(config.schedule), config.schedule)
}

console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
