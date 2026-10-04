// Tanda 543 — una tabla inventada en una migración.
//
// Escribí `public.user_cards` en la migración de limpieza del japonés. Esa
// tabla NO EXISTE: las de la casa son `user_collection` y `user_wants`. Me
// inventé el nombre en vez de mirarlo, y PINGU se comió el error en el SQL
// Editor: «42P01: relation "public.user_cards" does not exist».
//
// Postgres lo cantó, y eso tuvo suerte. Lo que de verdad asusta es la otra
// mitad: esa consulta era **la comprobación de seguridad** de un BORRADO —
// «¿hay cartas de alguien en estos sets?»—. Si el nombre inventado hubiera
// existido con otro contenido, habría contestado CERO por el motivo
// equivocado y yo habría dado por bueno el borrado.
//
// Así que el barrido: toda tabla que una migración NOMBRA tiene que estar
// CREADA en alguna migración del repo. Cuesta un segundo y se come esta
// familia entera.
import { readdirSync, readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 400) : ''}`)
}

const RAIZ = '/home/user/pingu'
const migraciones = readdirSync(RAIZ).filter((f) => /^supabase-.*\.sql$/.test(f))

// Las que CREA el repo, más las que existen sin que ninguna migración las
// cree. Esas últimas van DECLARADAS una a una y con su motivo, porque un
// barrido que perdona por su cuenta no vigila nada:
//
//   · `auth.users` y el `storage` los pone Supabase.
//   · `user_profiles`, `guides` y `achievement_definitions` son más VIEJAS que los ficheros de
//     migración: nacieron en el editor de Supabase cuando el repo todavía
//     no llevaba su esquema escrito. Existen, y por eso se nombran en
//     treinta migraciones sin que ninguna las cree.
//
// Si mañana alguien escribe una tabla nueva a mano en el editor y la usa
// aquí, el barrido la cantará — y eso es lo que se quiere: que la lista
// crezca a propósito y no por descuido.
const DE_LA_CASA = new Set([
  'auth.users', 'storage.objects', 'storage.buckets',
  'public.user_profiles', 'public.guides', 'public.achievement_definitions',
])

const creadas = new Set(DE_LA_CASA)
for (const f of migraciones) {
  const sql = readFileSync(`${RAIZ}/${f}`, 'utf8')
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?(?:table|view|materialized\s+view)\s+(?:if\s+not\s+exists\s+)?([a-z_]+\.)?([a-z_0-9]+)/gi)) {
    creadas.add(`${(m[1] || 'public.').toLowerCase()}${m[2].toLowerCase()}`)
  }
}

console.log('── 1. El barrido llega ──')
check('hay migraciones que mirar', migraciones.length > 20, migraciones.length)
check('y tablas creadas que conocer', creadas.size > 20, creadas.size)
// Las tres de verdad, para que no pase que el barrido no encuentre NADA y
// salga verde por vacío (la lección de la 307).
check('entre ellas las de la colección',
  creadas.has('public.user_collection') && creadas.has('public.user_wants') && creadas.has('public.tcg_cards'),
  [...creadas].filter((x) => /user_|tcg_/.test(x)).join(', '))

console.log('── 2. Ninguna migración nombra una tabla que no existe ──')
{
  const malas = []
  let miradas = 0
  for (const f of migraciones) {
    const sql = readFileSync(`${RAIZ}/${f}`, 'utf8')
    // Sin comentarios: esta misma migración EXPLICA el fallo nombrando
    // `public.user_cards`, y un nombre citado en un comentario no es una
    // consulta (la lección de la 524).
    const limpio = sql.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')
    for (const m of limpio.matchAll(/\b(?:from|join|update|insert\s+into|delete\s+from)\s+(public\.[a-z_0-9]+)(\s*\()?/gi)) {
      // UNA FUNCIÓN NO ES UNA TABLA: `from public.pokedex_resumen(...)` es
      // una llamada, y se distingue por el paréntesis que viene detrás.
      if (m[2]) continue
      const tabla = m[1].toLowerCase()
      miradas++
      if (!creadas.has(tabla)) malas.push(`${f}: ${tabla}`)
    }
  }
  check('se han mirado tablas de verdad', miradas > 50, miradas)
  check('todas están creadas en alguna migración', malas.length === 0, [...new Set(malas)].join(' | '))
}

console.log('── 3. Y la de hoy, en concreto ──')
{
  const sql = readFileSync(`${RAIZ}/supabase-migration-japones-limpiar-huecos.sql`, 'utf8')
  const limpio = sql.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')
  check('ya no consulta `user_cards`', !/\buser_cards\b/.test(limpio))
  check('mira las DOS tablas de la gente', /public\.user_collection/.test(limpio) && /public\.user_wants/.test(limpio))
  // Y el borrado sigue siendo el de siempre: solo lo que no tiene cartas.
  const borrado = limpio.slice(limpio.indexOf('delete from'))
  check('solo borra sets japoneses', /market = 'JP'/.test(borrado))
  check('  …y solo los que no tienen NI UNA carta', /not exists \(select 1 from public\.tcg_cards/.test(borrado))
  check('  …y no borra cartas ni nada de nadie', (limpio.match(/delete from/gi) || []).length === 1, String((limpio.match(/delete from/gi) || []).length))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
