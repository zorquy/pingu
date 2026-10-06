// Tanda 631 — una migración se ejecuta sentencia a sentencia.
//
// PINGU ejecutó `supabase-migration-nombres-energias.sql` (629) en el SQL
// Editor de Supabase y le salió «ERROR: 42P01: relation "tipos_629" does
// not exist». La migración creaba una tabla TEMPORAL con la lista de tipos y
// la usaba en las sentencias siguientes; en psql (y en la prueba
// sql-nombres-energias.sql, que la carga con `\i`) todo va en la misma
// sesión y funcionaba, pero el editor no conserva la tabla temporal de una
// sentencia a la siguiente. La prueba salía verde de algo que en el sitio
// donde se ejecuta de verdad no podía ir.
//
// Lo que se prueba:
//   1. Ninguna migración crea una tabla temporal FUERA de un cuerpo de
//      función o de un `do` (dentro, es una sola sentencia y no pasa nada).
//   2. La de la 629, ejecutada como el editor —cada sentencia en su propia
//      conexión—, deja los nombres bien. Y la versión vieja, ejecutada igual,
//      falla con el mismo error que vio PINGU: el andamio imita al editor.
import { readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const PSQL = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1']

// Lo que queda de un fichero SQL sin comentarios ni cuerpos `$$…$$`.
function sinCuerpos(sql) {
  return sql
    .replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, ' ')
    .replace(/--[^\n]*/g, '')
}
// Las sentencias de primer nivel (sirve para migraciones sin cuerpos `$$`).
function sentencias(sql) {
  return sql
    .replace(/--[^\n]*/g, '')
    .split(/;\s*(?:\n|$)/)
    .map((x) => x.trim())
    .filter(Boolean)
}

console.log('\n── 1. Ninguna tabla temporal entre sentencias ──')
{
  const malas = readdirSync(RAIZ)
    .filter((f) => /^supabase-migration-.*\.sql$/.test(f))
    .filter((f) => /\bcreate\s+(temp|temporary)\s+table\b/i.test(sinCuerpos(readFileSync(`${RAIZ}/${f}`, 'utf8'))))
  check('ninguna migración crea una tabla temporal fuera de una función o un `do`', !malas.length, malas.join(', '))
  // Y el barrido ve lo que tiene que ver: la de torneos-xp la crea DENTRO de
  // una función (vale), y la versión de la 629 la creaba fuera (no vale).
  const xp = readFileSync(`${RAIZ}/supabase-migration-torneos-xp.sql`, 'utf8')
  check('  …una tabla temporal dentro de una función no cuenta', /create temp table/i.test(xp) && !/create\s+temp\s+table/i.test(sinCuerpos(xp)))
  const vieja = execFileSync('git', ['-C', RAIZ, 'show', '8018a83:supabase-migration-nombres-energias.sql'], { encoding: 'utf8' })
  check('  …y la versión de la 629 sí la habría cantado', /\bcreate\s+temp\s+table\b/i.test(sinCuerpos(vieja)))
}

console.log('\n── 2. La 629, sentencia a sentencia, como el SQL Editor ──')
const psql = (sql) => execFileSync('psql', [...PSQL, '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const leer = (sql) => execFileSync('psql', [...PSQL, '-At', '-c', sql], { encoding: 'utf8' }).trim()
const FILAS = `drop table if exists public.tcg_cards cascade;
create table public.tcg_cards (
  id text not null, market text not null default 'WEST', set_id text, local_id text,
  name text not null, name_es text, name_en text,
  primary key (id, market));
insert into public.tcg_cards (id, set_id, local_id, name, name_es, name_en) values
  ('me03-086', 'me03', '086', 'Energía Grass Creciente', 'Energía Grass Creciente', null),
  ('me03-088', 'me03', '088', 'Energía Psychic Telepática', 'Energía Psychic Telepática', null),
  ('me04-084', 'me04', '084', 'Energía Water Burbujeante', 'Energía Water Burbujeante', 'Bubbly \\[W\\] Energy'),
  ('sm8-175', 'sm8', '175', 'Fairy Charm Psychic', 'Amuleto Hada Psychic', null),
  ('mee-005', 'mee', '005', 'Energía Psíquica', 'Energía Psíquica', null);`
function aPedazos(sql) {
  execFileSync('psql', [...PSQL, '-c', FILAS], { stdio: 'ignore' })
  for (const s of sentencias(sql)) psql(s)
}
{
  const actual = readFileSync(`${RAIZ}/supabase-migration-nombres-energias.sql`, 'utf8')
  let error = ''
  try {
    aPedazos(actual)
  } catch (e) {
    error = String(e.stderr || e.message)
  }
  check('se ejecuta entera, cada sentencia en su conexión', !error, error)
  const tele = leer("select name_es || ' / ' || name || ' / ' || coalesce(name_en, '∅') from public.tcg_cards where id = 'me03-088'")
  check('la Telepática queda «Energía Psíquica Telepática» / «Telepathic Psychic Energy»', tele === 'Energía Psíquica Telepática / Energía Psíquica Telepática / Telepathic Psychic Energy', tele)
  const resto = leer("select string_agg(coalesce(name_es, '') || '|' || coalesce(name_en, ''), ', ' order by id) from public.tcg_cards where id in ('me04-084', 'sm8-175', 'mee-005')")
  check('y las demás: Agua (y Bubbly Water Energy), Amuleto Hada Psíquico, la básica igual', resto === 'Energía Agua Burbujeante|Bubbly Water Energy, Energía Psíquica|, Amuleto Hada Psíquico|', resto)

  const vieja = execFileSync('git', ['-C', RAIZ, 'show', '8018a83:supabase-migration-nombres-energias.sql'], { encoding: 'utf8' })
  let errorViejo = ''
  try {
    aPedazos(vieja)
  } catch (e) {
    errorViejo = String(e.stderr || e.message)
  }
  check('la versión de la 629 falla aquí como en el editor («tipos_629» no existe)', /relation "tipos_629" does not exist/.test(errorViejo), errorViejo.split('\n')[0])
  execFileSync('psql', [...PSQL, '-c', 'drop table if exists public.tcg_cards cascade'], { stdio: 'ignore' })
}

console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
