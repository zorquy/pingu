// Tanda 391 — la Pokédex llevaba desde la 381 sin rellenar NI UNA carta.
//
// PINGU: «la Pokédex dice que está vacío el catálogo; entro en Bulbasaur
// y no hay nada». Y no era la pantalla: `cartas-pokedex.mjs` guardaba con
// un UPSERT parcial de PostgREST, que se traduce a `INSERT … ON CONFLICT
// DO UPDATE` — y el INSERT se evalúa PRIMERO, así que reventaba contra
// los NOT NULL de `set_id`, `local_id` y `name`:
//
//     null value in column "set_id" violates not-null constraint
//
// Cada diez minutos, en silencio, durante toda la vida de la función.
//
// **Un UPSERT no es un UPDATE con otro nombre.** Para tocar una columna
// de una fila que ya existe hace falta un UPDATE.
import { readFileSync, readdirSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('\n── 1. Nadie hace un UPSERT parcial sobre una tabla con NOT NULL ──')
{
  // La FORMA del fallo: un `on_conflict` manda un INSERT, así que el
  // cuerpo tiene que traer TODAS las columnas obligatorias de esa tabla.
  // Las obligatorias se leen de las migraciones, no de una lista aquí.
  const obligatorias = (tabla) => {
    for (const f of readdirSync(RAIZ).filter((x) => /^supabase-migration-.*\.sql$/.test(x))) {
      const t = leer(f)
      const m = new RegExp(`create table (?:if not exists )?(?:public\\.)?${tabla} \\(([\\s\\S]*?)\\n\\);`).exec(t)
      if (!m) continue
      return m[1]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /\bnot null\b/i.test(l) && !/^(primary|unique|constraint|foreign|check)/i.test(l))
        .map((l) => l.split(/\s+/)[0])
        .filter((c) => !/default/i.test(l0(m[1], c)))
    }
    return null
  }
  // ¿esa columna trae `default`? Entonces el INSERT no la necesita.
  function l0(bloque, col) {
    return bloque.split('\n').find((l) => l.trim().startsWith(col + ' ')) || ''
  }

  const malos = []
  for (const f of readdirSync(`${RAIZ}/netlify/functions`).filter((x) => x.endsWith('.mjs'))) {
    const t = leer(`netlify/functions/${f}`)
    for (const m of t.matchAll(/['"`]([\w]+)\?on_conflict=([\w,]+)['"`]/g)) {
      const tabla = m[1]
      const req = obligatorias(tabla)
      if (!req || !req.length) continue
      // Las claves que manda: se busca el objeto que se construye cerca.
      const trozo = t.slice(Math.max(0, m.index - 1200), m.index + 400)
      const faltan = req.filter((c) => !new RegExp(`\\b${c}\\b`).test(trozo))
      if (faltan.length) malos.push(`${f}: upsert a ${tabla} sin ${faltan.join(', ')}`)
    }
  }
  check('ningún upsert se deja una columna obligatoria', malos.length === 0, malos.join(' | '))

  // Y el caso concreto, nombrado: la Pokédex escribe por su función.
  const pk = leer('netlify/functions/cartas-pokedex.mjs')
  check('la Pokédex guarda por rpc/pokedex_marcar', /rpc\/pokedex_marcar/.test(pk))
  // Sin comentarios: arriba se EXPLICA el fallo y la palabra aparece en
  // la explicación. Al barrer código buscando una cadena, todo lo que la
  // CONTIENE cuenta (la trampa de la 312, que ya picó en la 388).
  const pkCodigo = pk.replace(/\/\/[^\n]*/g, '')
  check('  …y ya no hace ningún upsert', !/on_conflict/.test(pkCodigo))
}

console.log('\n── 2. El centinela se respeta ──')
{
  // `{}` es «mirada y no lleva ningún Pokémon», y es lo que hace que la
  // cola se vacíe: si volviera null, esas cartas volverían en cada
  // pasada para siempre (tandas 333, 380 y 381).
  const sql = leer('supabase-migration-pokedex-marcar.sql')
  check('la función no puede devolver null', /coalesce\(\s*\n?\s*\(select array_agg/.test(sql) && /'\{\}'::int\[\]/.test(sql))
  check('y es un UPDATE, no un INSERT', /update public\.tcg_cards/.test(sql) && !/insert into public\.tcg_cards/.test(sql))
  // El permiso, que es lo que costó la 388.
  check('se le da a service_role', /grant execute on function public\.pokedex_marcar\(jsonb\) to service_role/.test(sql))
  check('y se le quita a quien tiene sesión', /revoke all on function public\.pokedex_marcar\(jsonb\) from public, anon, authenticated/.test(sql))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
