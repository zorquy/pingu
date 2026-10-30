// Tanda 345 — los códigos de TCG LIVE, que TCGdex ya no da.
//
// PINGU: «el TCG Online es lo antiguo, ahora es el TCG Live». Ahí está
// por qué la 343 no arregló lo que yo dije que arreglaría: la tarea
// visitó los 220 sets y 98 siguieron sin código, TODOS los modernos
// entre ellos. `codigoLiveDeSet` lee `set.tcgOnline` —el código de la
// plataforma VIEJA, que cerró en 2023— y TCGdex dejó de rellenarlo
// entonces. El dato no existe arriba.
import { readFileSync } from 'node:fs'
// Mudado a `js/catalogo-tcgdex.js` en la tanda 471 (puro, sin
// dependencias, lo usan el navegador y el servidor).
import { codigoLiveDeSet } from '/home/user/pingu/js/catalogo-tcgdex.js'
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
  check('el porqué está escrito donde se lee', /plataforma vieja, que cerró en 2023/.test(leer('js/catalogo-tcgdex.js')))
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
  // El resolutor vive en js/lista-canonica.js desde la tanda 413.
  check('el resolutor casa por nombre exacto',
    /\.eq\('name', nombre\)/.test(leer('js/lista-canonica.js')))
}

console.log('\n── 4. Y /admin es donde se apuntan ──')
{
  // Desde la 1123 (la limpieza de Cartas, PINGU dijo «adelante»), el código
  // de un set se apunta en Colecciones, en la ficha del set, como corrección
  // (`tcg_online_code`, que también es la etiqueta de /cartas). La tarjeta de
  // «Códigos de set de TCG Live» se fue; el mapa viejo de site_settings se
  // sigue leyendo, así que lo apuntado antes no se pierde.
  const html = leer('admin/index.html')
  const col = leer('admin/js/colecciones.js')
  check('la tarjeta de los códigos a mano se fue de Cartas', !/admin-bloque-mano|setLiveCodigo|btnTraerCodigos/.test(html))
  check('el código se corrige en la ficha del set (Colecciones)', /Código \(TCG Live\)/.test(col) && /'tcg_online_code'/.test(col))
  check('lo apuntado antes se sigue leyendo', /'torneos_sets_live'/.test(leer('js/lista-canonica.js')))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
