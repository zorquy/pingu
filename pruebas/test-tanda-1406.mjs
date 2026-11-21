// Tanda 1406 — los avisos de un torneo que ya no existe.
//   · Lo puro: el slug sale del enlace y los huérfanos son los sin leer de
//     torneo cuyo torneo no está.
//   · El barredor no anuncia un torneo creado hace menos de 10 minutos.
//   · La migración, contra PostgreSQL: borra los huérfanos que ya hay, borra
//     los avisos al borrar el torneo (no el de «se ha cancelado», que enlaza
//     con /torneos) y el anuncio de apertura al cancelarlo; sin tablas
//     temporales y repetible.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const { slugDeAviso, huerfanos } = await import(`${REPO}/js/torneos/avisos-huerfanos.js`)
const { procesar } = await import(`${REPO}/netlify/functions/torneos-barredor.mjs`)
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── lo puro ──')
check('el slug sale del enlace absoluto', slugDeAviso({ link: 'https://pokedoc.es/torneo?slug=copa-de-otono' }) === 'copa-de-otono')
check('…y del relativo, sin lo que va detrás', slugDeAviso({ link: '/torneo?slug=copa&ver=jugar#mesa' }) === 'copa')
check('…y un enlace que no es de una ficha no da slug', slugDeAviso({ link: '/torneos' }) === null && slugDeAviso({ link: null }) === null)
const avisos = [
  { id: 1, type: 'torneo_apertura', link: 'https://pokedoc.es/torneo?slug=borrado', read_at: null },
  { id: 2, type: 'torneo_apertura', link: 'https://pokedoc.es/torneo?slug=copa', read_at: null },
  { id: 3, type: 'torneo_cancelado', link: 'https://pokedoc.es/torneos', read_at: null },
  { id: 4, type: 'forum_reply', link: '/torneo?slug=borrado', read_at: null },
  { id: 5, type: 'torneo_ronda', link: '/torneo?slug=borrado', read_at: '2026-11-20T10:00:00Z' },
]
check('huérfano solo el de torneo, sin leer, de un torneo que no está', JSON.stringify(huerfanos(avisos, ['copa']).map((a) => a.id)) === '[1]')

console.log('── el barredor espera 10 minutos ──')
const ahora = new Date('2026-11-21T12:00:00Z')
function mundo(creado) {
  const m = { tournaments: [{ id: 't1', slug: 'copa', name: 'Copa', status: 'registration_open', registration_notified_at: null, created_at: creado, start_at: '2026-11-28T10:00:00Z' }], user_profiles: [{ id: 'u1' }, { id: 'u2' }], site_settings: [{ key: 'push_vapid_public', value: { clave: 'p' } }], push_subscriptions: [], campanas: [], rutas: [] }
  m.rest = async (ruta, _c, op = {}) => {
    m.rutas.push(ruta)
    const [tabla, q = ''] = ruta.split('?')
    const metodo = op.method || 'GET'
    if (metodo === 'POST') { if (tabla === 'user_notifications') m.campanas.push(...JSON.parse(op.body)); return null }
    let filas = m[tabla] || []
    for (const [, col, val] of q.matchAll(/(?:^|&)(\w+)=eq\.([^&]+)/g)) filas = filas.filter((f) => String(f[col]) === decodeURIComponent(val))
    for (const [, col] of q.matchAll(/(\w+)=is\.null/g)) filas = filas.filter((f) => f[col] == null)
    for (const [, col, val] of q.matchAll(/(\w+)=lt\.([^&]+)/g)) filas = filas.filter((f) => f[col] != null && new Date(f[col]) < new Date(decodeURIComponent(val)))
    for (const [, col, vs] of q.matchAll(/(\w+)=in\.\(([^)]*)\)/g)) { const s = new Set(vs.split(',')); filas = filas.filter((f) => s.has(String(f[col]))) }
    if (metodo === 'PATCH') { filas.forEach((f) => Object.assign(f, JSON.parse(op.body))); return null }
    if (metodo === 'DELETE') return null
    return filas
  }
  return m
}
const env = { SUPABASE_SERVICE_ROLE_KEY: 'k', PUSH_VAPID_PRIVATE: 'q' }
const reciente = mundo(new Date(ahora - 3 * 60e3).toISOString())
await procesar({ env, rest: reciente.rest, enviar: () => {}, ahora }).catch((e) => check('el barredor no revienta', false, e.message))
check('creado hace 3 minutos: no se anuncia todavía', reciente.campanas.length === 0 && reciente.tournaments[0].registration_notified_at == null, JSON.stringify(reciente.campanas.slice(0, 1)))
check('…y la consulta lleva el margen', reciente.rutas.some((r) => /registration_notified_at=is\.null&created_at=lt\./.test(r)))
const viejo = mundo(new Date(ahora - 15 * 60e3).toISOString())
await procesar({ env, rest: viejo.rest, enviar: () => {}, ahora }).catch((e) => check('el barredor no revienta', false, e.message))
check('creado hace 15 minutos: se anuncia a todos', viejo.campanas.filter((c) => c.type === 'torneo_apertura').length === 2 && viejo.tournaments[0].registration_notified_at != null, viejo.campanas.length)

console.log('── la migración, contra PostgreSQL ──')
const mig = readFileSync(`${REPO}/supabase-migration-1406-avisos-de-torneos-borrados.sql`, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args, input) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000, input })
const BD = 'prueba_1406'
const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const base = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    create table public.tournaments (id text primary key, slug text unique, status text);
    create table public.user_notifications (id serial primary key, recipient_id text, type text, link text, read_at timestamptz);
    insert into public.tournaments values ('t1', 'copa', 'registration_open'), ('t2', 'liga', 'registration_open'), ('t3', 'mini', 'registration_open');
    insert into public.user_notifications (recipient_id, type, link) values
      ('u1', 'torneo_apertura', 'https://pokedoc.es/torneo?slug=borrado'),
      ('u2', 'torneo_apertura', 'https://pokedoc.es/torneo?slug=borrado'),
      ('u1', 'torneo_apertura', 'https://pokedoc.es/torneo?slug=copa'),
      ('u1', 'torneo_ronda', 'https://pokedoc.es/torneo?slug=copa&ver=jugar'),
      ('u1', 'torneo_cancelado', 'https://pokedoc.es/torneos'),
      ('u1', 'torneo_apertura', 'https://pokedoc.es/torneo?slug=liga'),
      ('u1', 'torneo_ronda', 'https://pokedoc.es/torneo?slug=liga'),
      ('u1', 'forum_reply', '/foro/tema?id=1');`])
  check('la base de prueba se monta', base.status === 0, base.stderr)
  // Sentencia a sentencia NO hace falta trocearla: no hay temporales; se
  // ejecuta entera dos veces, como en el SQL Editor.
  const r1 = psql(['-d', BD, '-f', '-'], mig)
  check('la migración entra', r1.status === 0, r1.stderr)
  const r2 = psql(['-d', BD, '-f', '-'], mig)
  check('…y repetirla no hace daño', r2.status === 0, r2.stderr)
  const quedan = () => q(`select string_agg(type || ':' || coalesce(nullif(split_part(link, 'slug=', 2), ''), link), ',' order by id) from public.user_notifications`).out
  check('fuera los huérfanos que ya había, lo demás se queda', quedan() === 'torneo_apertura:copa,torneo_ronda:copa&ver=jugar,torneo_cancelado:https://pokedoc.es/torneos,torneo_apertura:liga,torneo_ronda:liga,forum_reply:/foro/tema?id=1', quedan())
  q(`update public.tournaments set status = 'cancelled' where id = 't2'`)
  check('cancelar uno quita su anuncio de apertura y deja lo demás', quedan() === 'torneo_apertura:copa,torneo_ronda:copa&ver=jugar,torneo_cancelado:https://pokedoc.es/torneos,torneo_ronda:liga,forum_reply:/foro/tema?id=1', quedan())
  q(`delete from public.tournaments where id = 't1'`)
  check('borrar uno quita los avisos de su ficha (no el de «se ha cancelado»)', quedan() === 'torneo_cancelado:https://pokedoc.es/torneos,torneo_ronda:liga,forum_reply:/foro/tema?id=1', quedan())
  const ajeno = q(`update public.tournaments set status = 'finished' where id = 't3'; select count(*) from public.user_notifications`)
  check('otro cambio de estado no borra nada', ajeno.ok && ajeno.out.endsWith('3'), ajeno.out + ajeno.err)
  const sec = q(`select prosecdef, array_to_string(proconfig, ',') from pg_proc where proname = 'torneos_limpiar_avisos'`)
  check('la función del disparador es SECURITY DEFINER con search_path', sec.out === 't|search_path=public', sec.out)
  psql(['-c', `drop database if exists ${BD}`])
}

console.log(fails ? `    ❌ ${fails} fallan` : '    ✅ todo en verde')
process.exit(fails ? 1 : 0)
