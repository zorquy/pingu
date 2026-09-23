// Tanda 345 — los códigos de TCG LIVE, que TCGdex ya no da.
//
// PINGU: «el TCG Online es lo antiguo, ahora es el TCG Live». Ahí está
// por qué la 343 no arregló lo que yo dije que arreglaría: la tarea
// visitó los 220 sets y 98 siguieron sin código, TODOS los modernos
// entre ellos. `codigoLiveDeSet` lee `set.tcgOnline` —el código de la
// plataforma VIEJA, que cerró en 2023— y TCGdex dejó de rellenarlo
// entonces. El dato no existe arriba.
import { readFileSync } from 'node:fs'
import { codigoLiveDeSet } from '/home/user/pingu/js/tcgdex.js'
import { nombreDeSetLive } from '/home/user/pingu/js/torneos/comun.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 180) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const sql = leer('supabase-migration-codigos-live.sql')
const pares = [...sql.matchAll(/\('([^']+)',\s*'([A-Z0-9]{2,6})'\)/g)].map((m) => [m[1], m[2]])

console.log('\n── 1. Lo que TCGdex ya no da ──')
{
  check('un set sin el campo no da código', codigoLiveDeSet({ id: 'me05' }) === null)
  check('…y con él, sí', codigoLiveDeSet({ tcgOnline: 'obf' }) === 'OBF')
  // Que quede dicho en el código: si no, la siguiente persona vuelve a
  // pensar que curando más sets se arregla.
  check('el porqué está escrito donde se lee', /plataforma vieja, que cerró en 2023/.test(leer('js/tcgdex.js')))
}

console.log('\n── 2. La siembra ──')
{
  check('hay códigos que sembrar', pares.length >= 20, String(pares.length))
  check('todos con forma de código', pares.every(([, c]) => /^[A-Z0-9]{2,6}$/.test(c)))
  const codigos = pares.map(([, c]) => c)
  check('sin repetidos', new Set(codigos).size === codigos.length,
    codigos.filter((c, i) => codigos.indexOf(c) !== i).join(', '))
  const ids = pares.map(([i]) => i)
  check('sin sets repetidos', new Set(ids).size === ids.length)
  // Lo que NO puede hacer: pisar un código que TCGdex sí dio en su día.
  check('solo escribe donde está vacío', /and s\.tcg_online_code is null/.test(sql))
  check('y solo en el catálogo occidental', /s\.market = 'WEST'/.test(sql))
}

console.log('\n── 3. Y el lector de decklists los conoce ──')
{
  // El código de la base se prueba PRIMERO, así que sembrarlo arregla
  // también el lector. `SETS_LIVE` es el respaldo de antes de ejecutar
  // la migración — y si un código sembrado no estuviera ahí, entre el
  // despliegue y la migración una decklist con ese set no resolvería.
  const sinRespaldo = pares.filter(([, c]) => !nombreDeSetLive(c)).map(([, c]) => c)
  check('todos los sembrados tienen respaldo en SETS_LIVE', sinRespaldo.length === 0,
    sinRespaldo.join(', '))
  // Y el nombre del respaldo es el de NUESTRA base, porque se resuelve
  // con un `.eq('name', …)` exacto. Por eso MEP no es «Mega Promos».
  check('MEP usa el nombre de nuestra base',
    nombreDeSetLive('MEP') === 'MEP Black Star Promos', nombreDeSetLive('MEP'))
  check('el resolutor casa por nombre exacto',
    /\.eq\('name', nombre\)/.test(leer('js/torneos/cartas-decklist.js')))
}

console.log('\n── 4. Y /admin es donde se apuntan ──')
{
  const js = leer('admin/js/admin.js')
  const html = leer('admin/index.html')
  const css = leer('admin/css/admin.css').replace(/\/\*[\s\S]*?\*\//g, '')
  // Lo que había: el mapa de mano iba solo a `site_settings`, así que
  // arreglaba las decklists y dejaba la etiqueta de /cartas en «ME05».
  check('guardar escribe también la columna del set', /volcarCodigosEnLosSets\(\)/.test(js))
  const volcar = js.slice(js.indexOf('async function volcarCodigosEnLosSets'))
    .slice(0, js.slice(js.indexOf('async function volcarCodigosEnLosSets')).indexOf('\n}\n'))
  check('…y la escribe en tcg_sets', /from\('tcg_sets'\)/.test(volcar) &&
    /update\(\{ tcg_online_code: codigo \}\)/.test(volcar))
  check('…solo en el catálogo occidental', /\.eq\('market', 'WEST'\)/.test(volcar))
  check('…y no reescribe lo que ya está', /fila\.tcg_online_code === codigo/.test(volcar))
  // Y que la pantalla no siga diciendo la mentira que me la coló a mí:
  // «lo trae TCGdex solo» y «los sets antiguos no tienen».
  check('la tarjeta ya no promete que se rellene solo',
    !/guarda su código solo/.test(html) && !/anteriores a TCG Live no tienen código/.test(html))
  check('…y dice por qué', /cerró en 2023/.test(html))
  check('el mensaje de «ningún código» no culpa a la edad del set',
    !/Los sets antiguos no tienen: TCG Live no existía/.test(js))
  // Apuntar a mano dejó de ser «avanzado»: es el único camino.
  check('el bloque de mano no está plegado', /class="admin-bloque-mano"/.test(html))
  check('…y su clase tiene estilo', /\.admin-bloque-mano\s*\{/.test(css))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
