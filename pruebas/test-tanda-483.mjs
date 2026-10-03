// Tanda 483 — por qué la Pokédex japonesa estaba vacía con 13.006 cartas.
//
// PINGU: «me voy a la Pokédex japonesa y ningún Pokémon tiene cartas. Está
// vacío. Entonces, ¿cuál es el problema?».
//
// No era de TCGdex, era nuestro, y de dos sitios a la vez:
//
//   · `cartas-pokedex` —la función que rellena `dex_ids`— lleva
//     `const MERCADO = 'WEST'`, así que ninguna carta asiática lo tiene.
//   · Y su mecanismo no habría servido igual: deduce la especie del
//     NOMBRE, y 「フシギダネ」 no casa con ninguna lista nuestra. Lo mismo
//     le pasa al respaldo por nombre de la pantalla (`esDeLaEspecie`).
//
// Un número de Pokédex NO depende del idioma, y TCGdex lo da en el detalle
// de cada carta (`dexId`) — nunca se lo habíamos pedido.
import { detalleDeCarta } from '/home/user/pingu/js/carta-detalle.js'
import { engordarCartas } from '/home/user/pingu/netlify/functions/catalogo-asia.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. El detalle trae de qué Pokémon es ──')
{
  const japo = detalleDeCarta({ id: 'sv1a-1', category: 'Pokemon', name: 'フシギダネ', dexId: [1], hp: 70 })
  check('de una carta japonesa, sin saber leerla', JSON.stringify(japo.dex_ids) === '[1]', JSON.stringify(japo.dex_ids))
  // Y NO toca el nombre: en un catálogo asiático el nombre japonés ES la
  // clave canónica, no una traducción (tandas 334 y 335).
  check('  …y no devuelve `name`', !('name' in japo), JSON.stringify(Object.keys(japo)))
  // Solo si VIENE: un Entrenador no tiene especie, y poner `[]` encima de
  // lo que ya dedujo el nombre borraría trabajo bueno.
  check('un Entrenador no estrena la columna', !('dex_ids' in detalleDeCarta({ category: 'Trainer' })))
  check('ni una carta sin el campo', !('dex_ids' in detalleDeCarta({ category: 'Pokemon', hp: 60 })))
  check('una lista vacía tampoco', !('dex_ids' in detalleDeCarta({ dexId: [] })))
  // Lo que llegue raro no entra: un 0 o un negativo no es un Pokémon, y
  // una cadena rompería la columna.
  check('la basura se cae', JSON.stringify(detalleDeCarta({ dexId: ['x', 0, -3, 25, 25.5] }).dex_ids) === '[25]',
    JSON.stringify(detalleDeCarta({ dexId: ['x', 0, -3, 25, 25.5] }).dex_ids))
  check('y un Pokémon de dos especies trae las dos',
    JSON.stringify(detalleDeCarta({ dexId: [79, 80] }).dex_ids) === '[79,80]')
}

console.log('\n── 2. El engorde asiático ──')
const doble = ({ pendientes = null, romper = null } = {}) => {
  const llamadas = []
  const filas = pendientes || [
    { id: 'sv1a-1', market: 'JP' },
    { id: 'sv1a-2', market: 'JP' },
    { id: 'cs1a-9', market: 'CN' },
  ]
  const pedir = async (ruta, o = {}) => {
    llamadas.push({ ruta, metodo: o.method || 'GET', cuerpo: o.body ? JSON.parse(o.body) : null })
    if (ruta.startsWith('tcg_cards?select=')) return filas
    return null
  }
  const traer = async (url) => {
    llamadas.push({ tcgdex: url })
    if (romper && url.includes(romper)) throw new Error('TCGdex 404')
    return { id: 'x', category: 'Pokemon', name: 'フシギダネ', dexId: [1], hp: 70, rarity: 'Rara', illustrator: 'Arita' }
  }
  return { pedir, traer, llamadas }
}

{
  const d = doble()
  const r = await engordarCartas(d.pedir, d.traer, () => 0, 999999)
  check('engorda las tres', r.hechas === 3, JSON.stringify(r))
  check('  …y cuenta cuántas traen especie', r.conEspecie === 3, JSON.stringify(r))

  // Se pide SOLO lo que falta, y de los mercados asiáticos.
  const consulta = d.llamadas.find((l) => l.ruta?.startsWith('tcg_cards?select='))?.ruta
  check('pide las que no tienen detalle', /detalle_at=is\.null/.test(consulta), consulta)
  check('  …de los tres catálogos asiáticos', /market=in\.\(JP,CN,TW\)/.test(consulta), consulta)
  check('  …y sin el occidental, que ya lo hace `cartas-detalle`', !/WEST/.test(consulta), consulta)

  // CADA CARTA EN SU IDIOMA: pedir la japonesa a la carpeta inglesa es un
  // 404 por carta (la lección de la 438 con `js/carta-ruta.js`).
  const urls = d.llamadas.filter((l) => l.tcgdex).map((l) => l.tcgdex)
  check('cada carta se pide en SU idioma', /\/v2\/ja\/cards\/sv1a-1$/.test(urls[0]) && /\/v2\/zh-cn\/cards\/cs1a-9$/.test(urls[2]),
    urls.join(' | '))

  const patches = d.llamadas.filter((l) => l.metodo === 'PATCH')
  check('se escribe una por carta', patches.length === 3, String(patches.length))
  check('  …con su mercado en el filtro', patches.every((p) => /&market=eq\.(JP|CN|TW)/.test(p.ruta)), patches.map((p) => p.ruta).join(' | '))
  check('  …y con la especie dentro', JSON.stringify(patches[0].cuerpo.dex_ids) === '[1]', JSON.stringify(patches[0].cuerpo))
  // La marca va en la MISMA sentencia que los datos: si fueran dos, un
  // corte entre ellas dejaría la carta engordada y sin marcar, y la pasada
  // siguiente la repetiría. Con 21.000 por delante eso es no acabar nunca.
  check('  …y la marca en la misma sentencia', Boolean(patches[0].cuerpo.detalle_at), JSON.stringify(patches[0].cuerpo))
  // LO QUE NO PUEDE TOCAR: el nombre. En un catálogo asiático el japonés
  // ES la clave canónica (tandas 334 y 335).
  check('  …y NUNCA el nombre', patches.every((p) => !('name' in p.cuerpo) && !('name_es' in p.cuerpo)),
    JSON.stringify(patches[0].cuerpo))
  // De paso trae la rareza y el ilustrador, que es lo que deja los filtros
  // de una expansión japonesa sin nada que filtrar.
  check('  …pero sí la rareza y el ilustrador',
    patches[0].cuerpo.rarity === 'Rara' && patches[0].cuerpo.illustrator === 'Arita', JSON.stringify(patches[0].cuerpo))
}

console.log('\n── 3. Una carta que falla se marca igual ──')
// Si no, volvería en cada pasada para siempre: es el cerrojo de la 333.
{
  const d = doble({ romper: 'sv1a-1' })
  const r = await engordarCartas(d.pedir, d.traer, () => 0, 999999)
  check('las otras dos siguen', r.hechas === 2, JSON.stringify(r))
  const malo = d.llamadas.filter((l) => l.metodo === 'PATCH').find((p) => p.ruta.includes('sv1a-1'))
  check('la que falla se marca igual', Boolean(malo?.cuerpo?.detalle_at), JSON.stringify(malo?.cuerpo))
  check('  …y se guarda el porqué en la fila', /404/.test(malo?.cuerpo?.detalle_error || ''), malo?.cuerpo?.detalle_error)
  check('  …sin escribirle datos a medias', !('rarity' in (malo?.cuerpo || {})), JSON.stringify(malo?.cuerpo))
}

console.log('\n── 4. El presupuesto de tiempo manda ──')
// Netlify mata una función programada a los 30 s. Lo que no dé tiempo
// sigue con `detalle_at` a null y lo coge la pasada siguiente.
{
  const d = doble()
  let t = 0
  const r = await engordarCartas(d.pedir, d.traer, () => (t += 1000), 1500)
  check('se para al acabarse', r.hechas < 3, JSON.stringify(r))
  check('  …y lo que no dio tiempo no se marca', d.llamadas.filter((l) => l.metodo === 'PATCH').length < 3,
    String(d.llamadas.filter((l) => l.metodo === 'PATCH').length))
}

console.log('\n── 5. Sin nada que engordar, no cuesta nada ──')
{
  const d = doble({ pendientes: [] })
  const r = await engordarCartas(d.pedir, d.traer, () => 0, 999999)
  check('ni una petición a TCGdex', !d.llamadas.some((l) => l.tcgdex), JSON.stringify(r))
  check('  …y lo dice', r.hechas === 0 && r.pedidas === 0, JSON.stringify(r))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
