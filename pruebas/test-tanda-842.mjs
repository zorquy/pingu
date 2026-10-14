// Tanda 842 — «Hoy en PokeDoc»: lo de todos de hoy, con nombre solo quien no
// haya pedido no salir. Contra PostgreSQL de verdad, sobre el andamio de la 835.
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
const AQUI = new URL('.', import.meta.url).pathname
const REPO = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_842'
const A = '00000000-0000-0000-0000-0000000000a1'
const B = '00000000-0000-0000-0000-0000000000b2'
const C = '00000000-0000-0000-0000-0000000000c3'
const como = (uid, s, rol = 'authenticated') => {
  const r = psql(['-t', '-A', '-d', BD, '-c', `begin; set local role ${rol}; ${uid ? `set local prueba.uid = '${uid}';` : ''} ${s}; commit;`])
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }
}
const json = (g) => JSON.parse(g.out.split('\n').find((l) => l.startsWith('{')) || '{}')
const sql = (s) => { const r = psql(['-t', '-A', '-d', BD, '-c', s]); return (r.stdout || '').trim() + (r.status ? ` ERROR ${r.stderr}` : '') }

const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  let r = psql(['-d', BD, '-f', join(AQUI, 'sql-tanda-835.sql')])
  // Lo que la base de verdad ya tiene en user_profiles y el andamio no.
  r = psql(['-d', BD, '-c', `alter table public.user_profiles add column username text, add column display_name text, add column avatar_url text, add column hide_activity boolean not null default false;
    update public.user_profiles set username = case id when '${A}' then 'ash' when '${B}' then 'misty' else 'brock' end;`])
  r = psql(['-d', BD, '-f', join(REPO, 'supabase-migration-retos-xp.sql')])
  check('la 835 carga', r.status === 0, r.stderr)
  r = psql(['-d', BD, '-f', join(REPO, 'supabase-migration-retos-comunidad.sql')])
  check('la 842 carga', r.status === 0, r.stderr)
  r = psql(['-d', BD, '-f', join(REPO, 'supabase-migration-retos-comunidad.sql')])
  check('  …y otra vez encima', r.status === 0, r.stderr)

  for (const [u, j, ac, i] of [[A, 'carta', true, 2], [A, 'silueta', true, 1], [B, 'carta', true, 1], [B, 'silueta', false, 3], [B, 'ordena', true, 1], [C, 'carta', false, 6]]) {
    como(u, `select public.retos_guardar('${j}', current_date, 0, 0, ${i}, ${ac}, null)`)
  }
  sql(`insert into retos_resultados (user_id, juego, day, aciertos, total, xp) values ('${A}', 'carta', current_date - 1, 0, 1, 5)`)
  let g = como(null, `select public.retos_comunidad(current_date)`, 'anon')
  let d = json(g)
  check('sin cuenta se ve: 3 han jugado hoy, 1 ayer', g.ok && d.jugadores === 3 && d.ayer === 1, g.out + g.err)
  check('  …el primero es quien más XP lleva (misty: 50 + 0 + 25)', d.ranking?.[0]?.username === 'misty' && d.ranking[0].xp === 75 && d.ranking[0].juegos === 3, JSON.stringify(d.ranking))
  check('  …cada reto con cuántos jugaron y cuántos acertaron', d.porJuego?.carta?.jugadores === 3 && d.porJuego.carta.acertaron === 2 && d.porJuego.silueta.acertaron === 1)
  check('  …los 14 días, el último hoy', d.dias?.length === 14 && d.dias.at(-1).n === 3 && d.dias.at(-2).n === 1)
  check('  …y sin cuenta no hay «tú»', d.tu === null)
  g = como(A, `select public.retos_comunidad(current_date)`)
  d = json(g)
  check('con cuenta, tu puesto y tus XP', d.tu?.puesto === 2 && d.tu.juegos === 2 && d.ranking.find((x) => x.username === 'ash')?.tu === true, JSON.stringify(d.tu))
  sql(`update user_profiles set retos_oculto = true where id = '${B}'`)
  sql(`update user_profiles set hide_activity = true where id = '${C}'`)
  d = json(como(A, `select public.retos_comunidad(current_date)`))
  check('quien pide no salir no sale con nombre (ni quien oculta su actividad)', !JSON.stringify(d.ranking).includes('misty') && !JSON.stringify(d.caras).includes('misty') && !JSON.stringify(d.ranking).includes('brock'), JSON.stringify(d.ranking))
  check('  …pero se cuenta igual en el número y en los retos', d.jugadores === 3 && d.porJuego.carta.jugadores === 3)
  check('  …y a ti te dice tu puesto aunque estés oculto', json(como(B, `select public.retos_comunidad(current_date)`)).tu?.puesto === 1 && json(como(B, `select public.retos_comunidad(current_date)`)).oculto === true)
  d = json(como(null, `select public.retos_comunidad(current_date - 30)`, 'anon'))
  check('no es un histórico: un día viejo devuelve hoy', d.dia === sql('select current_date'))
  g = como(A, `update public.user_profiles set retos_oculto = true where id = '${A}'`)
  check('la columna existe y es un booleano que vale false por defecto', sql(`select column_default from information_schema.columns where table_name = 'user_profiles' and column_name = 'retos_oculto'`) === 'false')
  psql(['-c', `drop database if exists ${BD}`])
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\nTODO OK')
process.exit(fails ? 1 : 0)
