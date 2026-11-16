// Tanda 1379 — las jornadas jugadas de una liga cuentan como torneos (PINGU:
// «cada jornada de liga funciona como un torneo individual; si esa jornada se
// ha cerrado, la lista debería ser pública y tendría que contar como jugada»):
//   · la migración: la lista de una jornada JUGADA se lee sin cuenta (con la
//     regla de decklist_visibility); la de una jornada sin jugar o saltada, no;
//   · /meta: cada jornada jugada entra como un torneo («Liga · jornada N»),
//     con las mesas y las listas de esa jornada; la liga entera, nunca;
//   · Mis partidas: el mazo de cada uno sale de la lista de ESA jornada.
import { readFileSync } from 'fs'
import { spawnSync } from 'child_process'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const REPO = process.env.PD_RAIZ || '/home/user/pingu'

console.log('── La migración, contra PostgreSQL ──')
const mig = readFileSync(`${REPO}/supabase-migration-1379-ligas-jornadas-publicas.sql`, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1379'
const q = (s) => {
  const r = psql(['-At', '-d', BD, '-c', s])
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }
}
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`])
  psql(['-c', `create database ${BD}`])
  const L = '00000000-0000-0000-0000-0000000000a1' // liga de 2 rondas por jornada
  const N = '00000000-0000-0000-0000-0000000000a2' // liga con listas «nunca»
  const U = (n) => `00000000-0000-0000-0000-00000000000${n}`
  const r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    grant usage on schema public to anon, authenticated;
    create table tournaments (id uuid primary key, format text, rounds_per_matchday int, decklist_visibility text);
    grant select on tournaments to anon, authenticated;
    create table rounds (tournament_id uuid, round_number int, phase text, status text, started_at timestamptz);
    create table tournament_matchday_decklists (tournament_id uuid, user_id uuid, matchday int, raw_text text);
    alter table tournament_matchday_decklists enable row level security;
    grant select on tournament_matchday_decklists to authenticated;
    insert into tournaments values ('${L}', 'league', 2, 'al_terminar'), ('${N}', 'league', 1, 'nunca');
    -- J1 jugada (sus dos rondas cerradas); J2 a medias; J3 saltada (cerrada sin empezar).
    insert into rounds values ('${L}', 1, 'swiss', 'finished', now()), ('${L}', 2, 'swiss', 'finished', now()),
      ('${L}', 3, 'swiss', 'finished', now()), ('${L}', 4, 'swiss', 'active', now()),
      ('${L}', 5, 'swiss', 'finished', null), ('${L}', 6, 'swiss', 'finished', null),
      ('${N}', 1, 'swiss', 'finished', now());
    insert into tournament_matchday_decklists values ('${L}', '${U(1)}', 1, 'a'), ('${L}', '${U(2)}', 1, 'b'),
      ('${L}', '${U(1)}', 2, 'c'), ('${L}', '${U(1)}', 3, 'd'), ('${N}', '${U(1)}', 1, 'e');`])
  check('el andamio carga', r.status === 0, r.stderr)
  const sentencias = mig
    .replace(/^\s*(begin|commit);\s*$/gim, '')
    .split(/;\s*\n(?=(?:create|drop|grant|revoke|alter|--|\s*$))/i)
    .map((x) => x.trim())
    .filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let todas = true
  for (let v = 0; v < 2; v++)
    for (const st of sentencias) {
      const x = psql(['-d', BD, '-c', st.endsWith(';') ? st : st + ';'])
      if (x.status !== 0) {
        todas = false
        console.log(x.stderr)
      }
    }
  check('la 1379 entra sentencia a sentencia, y otra vez encima', todas, sentencias.length)
  const ve = (rol, t, j) => q(`set role ${rol}; select count(*) from tournament_matchday_decklists where tournament_id = '${t}' and matchday = ${j}`).out
  check('sin cuenta se leen las listas de la jornada JUGADA (las dos)', ve('anon', L, 1) === '2', ve('anon', L, 1))
  check('…y con cuenta también', ve('authenticated', L, 1) === '2')
  check('la de una jornada a medias, no', ve('anon', L, 2) === '0', ve('anon', L, 2))
  check('la de una jornada saltada (cerrada sin empezar), no', ve('anon', L, 3) === '0', ve('anon', L, 3))
  check('con «nunca», ni la de una jornada jugada', ve('anon', N, 1) === '0', ve('anon', N, 1))
  check('torneos_jornada_jugada dice lo mismo', q(`select torneos_jornada_jugada('${L}', 1), torneos_jornada_jugada('${L}', 2), torneos_jornada_jugada('${L}', 3)`).out === 't|f|f')
  psql(['-c', `drop database if exists ${BD}`])
}

console.log('── /meta: cada jornada jugada, un torneo ──')
{
  const { procesar, nombreDeJornada } = await import(`${REPO}/netlify/functions/meta-pokedoc.mjs`)
  check('el nombre: «Liga · jornada 6», sin repetir la del nombre', nombreDeJornada('Liga FDN [Oct–Dic] · jornada 3', 6) === 'Liga FDN [Oct–Dic] · jornada 6' && nombreDeJornada('Liga X', 2) === 'Liga X · jornada 2')
  const L = 'liga-1'
  const dia = 86400e3
  const ahora = new Date('2026-11-16T12:00:00Z')
  const liga = { id: L, slug: 'liga-fdn', name: 'Liga FDN', start_at: new Date(ahora - 30 * dia).toISOString(), swiss_rounds: 6, rounds_per_matchday: 2, matchday_dates: [new Date(ahora - 14 * dia).toISOString(), new Date(ahora - 7 * dia).toISOString(), new Date(ahora + 7 * dia).toISOString()] }
  const rondas = [1, 2, 3, 4].map((n) => ({ id: `r${n}`, round_number: n, phase: 'swiss', status: n <= 3 ? 'finished' : 'active', started_at: 'x', closed_at: n <= 3 ? new Date(ahora - (16 - n) * dia).toISOString() : null }))
  const mesas = [
    { id: 'm1', round_id: 'r1', player_a_id: 'u1', player_b_id: 'u2', is_bye: false, status: 'finished' },
    { id: 'm2', round_id: 'r2', player_a_id: 'u1', player_b_id: 'u2', is_bye: false, status: 'finished' },
    { id: 'm3', round_id: 'r3', player_a_id: 'u1', player_b_id: 'u2', is_bye: false, status: 'finished' },
  ]
  const listas = { 1: [{ user_id: 'u1', parsed_cards: { pokemon: [{ name: 'Charizard ex', quantity: 3 }] } }, { user_id: 'u2', parsed_cards: { pokemon: [{ name: 'Dragapult ex', quantity: 3 }] } }] }
  const pedidas = []
  const ingeridos = []
  const json = (x) => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } })
  const fetchImpl = async (url, op = {}) => {
    const u = new URL(url)
    const ruta = u.pathname.replace('/rest/v1/', '')
    pedidas.push(decodeURIComponent(ruta + u.search))
    if (ruta === 'rpc/meta_resumen') return json([])
    if (ruta === 'rpc/meta_ingerir_torneo') {
      ingeridos.push(JSON.parse(op.body))
      return json({ ok: true })
    }
    const p = u.searchParams
    if (ruta === 'tournaments') return json(p.get('format') === 'eq.league' ? [liga] : [])
    if (ruta === 'meta_torneos') return json([])
    if (ruta === 'tcg_archetypes') return json([])
    if (ruta === 'rounds') return json(rondas)
    if (ruta === 'tournament_matchday_decklists') return json(listas[p.get('matchday').replace('eq.', '')] || [])
    if (ruta === 'tournament_matches') {
      const ids = p.get('round_id').replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/"/g, ''))
      return json(mesas.filter((m) => ids.includes(m.round_id)))
    }
    if (ruta === 'match_results') return json([{ match_id: 'm1', result: 'a_wins' }, { match_id: 'm2', result: 'a_wins' }])
    if (ruta === 'user_profiles') return json([{ id: 'u1', username: 'ash' }, { id: 'u2', username: 'misty' }])
    return json([])
  }
  const r = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'x' }, fetchImpl, ahora })
  check('la pasada va bien', r.ok, JSON.stringify(r))
  const ids = ingeridos.map((i) => i.p_torneo.id)
  check('entra la jornada 1 (jugada y con listas) como su propio torneo', ids.join() === `pokedoc-${L}-j1`, ids.join())
  const j1 = ingeridos[0]
  check('…con su nombre, la fecha de la jornada y fuente PokeDoc', j1 && j1.p_torneo.name === 'Liga FDN · jornada 1' && j1.p_torneo.date === liga.matchday_dates[0] && j1.p_torneo.fuente === 'pokedoc', JSON.stringify(j1?.p_torneo))
  const ash = j1?.p_clasificacion.find((c) => c.name === 'ash')
  check('…y con SOLO las mesas de esa jornada (ash 2-0, no 2-0 + la R3)', ash && ash.record.wins === 2 && ash.record.losses === 0 && ash.placing === 1, JSON.stringify(ash))
  check('la jornada 2 (a medias) no entra', !ids.some((x) => x.endsWith('-j2')))
  check('las listas se piden por jornada (matchday=eq.1)', pedidas.some((p) => /tournament_matchday_decklists\?.*matchday=eq\.1/.test(p)))
  check('la liga entera no entra como torneo (los torneos de un día piden format=eq.standard)', pedidas.some((p) => /tournaments\?status=eq\.finished&format=eq\.standard/.test(p)) && !ids.includes(`pokedoc-${L}`))
}

console.log('── Mis partidas: el mazo de cada jornada ──')
{
  const s = readFileSync(`${REPO}/js/mis-partidas.js`, 'utf8')
  check('lee las listas por jornada de las ligas', /from\('tournament_matchday_decklists'\)\.select\('tournament_id, user_id, matchday, parsed_cards'\)/.test(s))
  check('y el mazo de una mesa de liga sale de la lista de SU jornada', /mazoEn\(torneoId, yo, m\)/.test(s) && /mazoEn\(torneoId, rivalId, m\)/.test(s) && /\|j\$\{jornada\}/.test(s))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
