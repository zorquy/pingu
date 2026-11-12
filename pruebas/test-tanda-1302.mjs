// Tanda 1302 — los avisos de cada JORNADA de una liga (la J1 que eligió
// PINGU): la víspera a Telegram y a la campanita de los inscritos, y al
// cerrarse, los tres primeros a Telegram. Una vez cada uno, y nada si la
// tabla que lo apunta no existe todavía.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const { jornadasDeLiga, jornadaDeVispera, jornadaRecienTerminada, clasificacionDeLiga, campanitaDeVispera, nombreCorto } = await import(`${REPO}/js/torneos/liga-en-curso.js`)
const { mensajeDeJornada, mensajeDeResultados, diaRelativoEs } = await import(`${REPO}/netlify/lib/telegram.mjs`)
const { procesar } = await import(`${REPO}/netlify/functions/ligas-jornadas.mjs`)

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 400) : ''}`) }

// La Liga FDN a mitad: 10 jornadas de una ronda, la 5 cerrada ayer a las 22:40,
// la 6 mañana a las 19:00 (Madrid).
const AHORA = new Date('2026-11-12T20:00:00Z')
const fechas = Array.from({ length: 10 }, (_, i) => new Date(Date.parse('2026-10-09T18:00:00Z') + i * 7 * 864e5).toISOString())
const LIGA = { id: 'L1', slug: 'liga-fdn', name: 'Liga FDN [Oct–Dic]', format: 'league', status: 'in_progress', swiss_rounds: 10, rounds_per_matchday: 1, matchday_dates: fechas, pairing_seed: 'semilla', banner_url: null, is_private: false }
// fechas[5] = 13 nov 18:00 UTC (19:00 en Madrid)
const ronda = (n, extra = {}) => ({ id: `r${n}`, round_number: n, phase: 'swiss', status: 'finished', started_at: fechas[n - 1], closed_at: fechas[n - 1], ...extra })
const RONDAS = [1, 2, 3, 4].map((n) => ronda(n)).concat([ronda(5, { closed_at: '2026-11-11T21:40:00Z' })])

console.log('── Lo puro ──')
const j = jornadasDeLiga(LIGA, RONDAS)
check('cinco hechas de diez, y la siguiente es la 6 con su fecha', j.hechas === 5 && j.total === 10 && j.siguiente?.n === 6 && j.siguiente.fecha === fechas[5], JSON.stringify(j.siguiente))
check('la víspera de la 6: a menos de 24 h y sin empezar', jornadaDeVispera(LIGA, RONDAS, AHORA.getTime())?.n === 6)
check('…a dos días, todavía no', jornadaDeVispera(LIGA, RONDAS, Date.parse('2026-11-11T12:00:00Z')) === null)
check('…ya empezada, no se anuncia', jornadaDeVispera(LIGA, [...RONDAS, { id: 'r6', round_number: 6, phase: 'swiss', status: 'active', started_at: fechas[5] }], Date.parse('2026-11-13T17:00:00Z')) === null)
check('la 5 terminó hace menos de un día', jornadaRecienTerminada(LIGA, RONDAS, AHORA.getTime())?.n === 5)
check('…dos días después ya no se cuenta', jornadaRecienTerminada(LIGA, RONDAS, Date.parse('2026-11-14T12:00:00Z')) === null)
const saltada = [...RONDAS.slice(0, 4), ronda(5, { started_at: null, closed_at: '2026-11-11T21:40:00Z' })]
check('una jornada saltada no tiene resultados', jornadaRecienTerminada(LIGA, saltada, AHORA.getTime()) === null && jornadasDeLiga(LIGA, saltada).lista[4].estado === 'saltada')
const tres = { ...LIGA, swiss_rounds: 9, rounds_per_matchday: 3 }
const r3 = [1, 2, 3].map((n) => ronda(n)).concat([{ ...ronda(4), status: 'active' }])
check('con tres rondas por jornada: la 1 hecha, la 2 en juego', jornadasDeLiga(tres, r3).lista.map((x) => x.estado).join(',') === 'hecha,en_juego,pendiente')

const P = (n) => `00000000-0000-0000-0000-00000000000${n}`
const insc = [1, 2, 3, 4].map((n) => ({ user_id: P(n), status: n === 4 ? 'dropped' : 'active' }))
const partidas = [
  { id: 'm1', round_id: 'r1', table_number: 1, player_a_id: P(1), player_b_id: P(2), status: 'finished' },
  { id: 'm2', round_id: 'r1', table_number: 2, player_a_id: P(3), player_b_id: P(4), status: 'finished' },
  { id: 'm3', round_id: 'r2', table_number: 1, player_a_id: P(1), player_b_id: P(3), status: 'finished' },
  { id: 'm4', round_id: 'r2', table_number: 2, player_a_id: P(2), player_b_id: null, status: 'bye' },
]
const resultados = [{ match_id: 'm1', result: 'a_wins' }, { match_id: 'm2', result: 'b_wins' }, { match_id: 'm3', result: 'draw' }]
const tabla = clasificacionDeLiga(LIGA, { inscripciones: insc, rondas: RONDAS, partidas, resultados })
check('la clasificación: P1 4 pts, P2 3 (bye), P3 1; sin el que se dio de baja', tabla.map((e) => `${e.playerId.slice(-1)}:${e.matchPoints}`).join(' ') === '1:4 2:3 3:1', tabla.map((e) => `${e.playerId.slice(-1)}:${e.matchPoints}`).join(' '))
check('el nombre corto quita la temporada', nombreCorto('Liga FDN [Oct–Dic]') === 'Liga FDN')
const c1 = campanitaDeVispera(LIGA, { n: 6 }, { conLista: false, hora: '19:00' })
const c2 = campanitaDeVispera(LIGA, { n: 6 }, { conLista: true, hora: '19:00', dia: 'Hoy' })
check('campanita sin lista: que la mande', c1.title === 'Mañana, jornada 6 de la Liga FDN' && /Manda tu lista/.test(c1.body), JSON.stringify(c1))
check('…con lista: la hora', c2.title.startsWith('Hoy,') && c2.body === 'Ya tienes tu lista. Se juega a las 19:00.', JSON.stringify(c2))

console.log('── Los textos de Telegram ──')
check('«Mañana» por el día de Madrid', diaRelativoEs(fechas[5], AHORA) === 'Mañana' && diaRelativoEs(fechas[5], new Date('2026-11-13T08:00:00Z')) === 'Hoy' && diaRelativoEs(fechas[5], new Date('2026-11-10T08:00:00Z')) === null)
const mj = mensajeDeJornada(LIGA, { n: 6, total: 10, fecha: fechas[5] }, { ahora: AHORA })
check('la víspera: liga, jornada N de M, «Mañana, viernes 13… 19:00», lista y enlace', /<b>Liga FDN \[Oct–Dic\]<\/b> · Jornada 6 de 10/.test(mj) && /Mañana, viernes 13 de noviembre a las 19:00/.test(mj) && /Manda tu lista/.test(mj) && /slug=liga-fdn/.test(mj), mj)
const mr = mensajeDeResultados(LIGA, 5, [{ nombre: 'mansow', puntos: 15 }, { nombre: 'a<b', puntos: 13 }, { nombre: 'x', puntos: 12 }, { nombre: 'cuarto', puntos: 1 }])
check('los resultados: tres filas, escapadas', /Jornada 5 terminada/.test(mr) && /1\. mansow — 15 pts/.test(mr) && /a&lt;b/.test(mr) && !/cuarto/.test(mr), mr)

console.log('── La función, con dobles ──')
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'k', TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CANAL_NOTICIAS: '@canal', TELEGRAM_TEMA_TORNEOS: '7' }
function mundo({ sinTabla = false, avisos = [], liga = LIGA, telegramOk = true } = {}) {
  const m = { campanas: [], avisos: [...avisos], telegram: [], estado: null }
  m.rest = async (ruta, _k, o = {}) => {
    const [tabla, q = ''] = ruta.split('?')
    if (tabla === 'scrydex_estado') { m.estado = JSON.parse(o.body)[0].valor; return null }
    if (tabla === 'tournament_matchday_avisos') {
      if (sinTabla) throw new Error('Supabase 404: relation "tournament_matchday_avisos" does not exist')
      if (o.method === 'POST') {
        const f = JSON.parse(o.body)[0]
        if (m.avisos.some((a) => a.matchday === f.matchday && a.canal === f.canal)) return []
        m.avisos.push(f); return [f]
      }
      return m.avisos
    }
    if (tabla === 'user_notifications') { m.campanas.push(...JSON.parse(o.body)); return null }
    if (tabla === 'tournaments') return [liga]
    if (tabla === 'rounds') return RONDAS
    if (tabla === 'tournament_registrations') return /status=eq\.active/.test(q) ? insc.filter((i) => i.status === 'active') : insc
    if (tabla === 'user_profiles') return /notification_prefs_disabled/.test(q) ? [{ id: P(1) }, { id: P(2), notification_prefs_disabled: ['torneo_jornada'] }, { id: P(3) }] : [{ id: P(1), username: 'mansow' }, { id: P(2), username: 'jesus' }, { id: P(3), username: 'alex' }]
    if (tabla === 'tournament_matchday_decklists') return [{ user_id: P(3) }]
    if (tabla === 'tournament_matches') return partidas
    if (tabla === 'match_results') return resultados
    return []
  }
  m.fetchImpl = async (url, o = {}) => {
    m.telegram.push(JSON.parse(o.body))
    return new Response(JSON.stringify({ ok: telegramOk, description: telegramOk ? '' : 'chat not found' }), { status: 200 })
  }
  return m
}
{
  const m = mundo()
  const r = await procesar({ env: ENV, rest: m.rest, fetchImpl: m.fetchImpl, ahora: AHORA })
  const textos = m.telegram.map((x) => x.text || x.caption || '')
  check('una pasada: la víspera de la 6 y los resultados de la 5 a Telegram, al tema de torneos', textos.length === 2 && /Jornada 6 de 10/.test(textos[0]) && /Jornada 5 terminada/.test(textos[1]) && m.telegram.every((x) => String(x.message_thread_id) === '7'), JSON.stringify(textos))
  check('…con el podio de verdad', /1\. mansow — 4 pts/.test(textos[1]) && /2\. jesus — 3 pts/.test(textos[1]), textos[1])
  check('…campanita a los inscritos que no la han apagado (P2 sí), con su texto', m.campanas.length === 2 && m.campanas.every((c) => c.type === 'torneo_jornada' && c.pushed_at === null && /#torneoMisJornadas$/.test(c.link)) && /Ya tienes tu lista/.test(m.campanas.find((c) => c.recipient_id === P(3)).body) && /Manda tu lista/.test(m.campanas.find((c) => c.recipient_id === P(1)).body), JSON.stringify(m.campanas))
  check('…apuntado lo de los tres canales', ['6:campanita', '6:telegram', '5:resultados'].every((k) => m.avisos.some((a) => `${a.matchday}:${a.canal}` === k)) && r.ok, JSON.stringify(m.avisos))
  check('…y el estado, para /admin', m.estado && m.estado.telegram.length === 1 && m.estado.resultados.length === 1 && m.estado.ultimaPasada, JSON.stringify(m.estado))
  const n = m.telegram.length
  await procesar({ env: ENV, rest: m.rest, fetchImpl: m.fetchImpl, ahora: new Date(AHORA.getTime() + 15 * 60e3) })
  check('la pasada siguiente no repite nada', m.telegram.length === n && m.campanas.length === 2)
}
{
  const m = mundo({ sinTabla: true })
  await procesar({ env: ENV, rest: m.rest, fetchImpl: m.fetchImpl, ahora: AHORA })
  check('sin la migración: ni Telegram ni campanita, y /admin lo dice (parado)', m.telegram.length === 0 && m.campanas.length === 0 && /migración 1302/.test(m.estado?.parado?.motivo || ''), JSON.stringify(m.estado))
}
{
  const m = mundo({ telegramOk: false })
  await procesar({ env: ENV, rest: m.rest, fetchImpl: m.fetchImpl, ahora: AHORA })
  check('si Telegram falla no se apunta (se reintenta), pero la campanita sale una vez', !m.avisos.some((a) => a.canal === 'telegram') && m.campanas.length === 2 && m.estado?.ultimoError, JSON.stringify(m.avisos))
}
{
  const m = mundo({ liga: { ...LIGA, is_private: true } })
  await procesar({ env: ENV, rest: m.rest, fetchImpl: m.fetchImpl, ahora: AHORA })
  check('una liga con código no sale en Telegram, pero sus inscritos sí reciben la campanita', m.telegram.length === 0 && m.campanas.length === 2)
}
{
  const m = mundo()
  await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, rest: m.rest, fetchImpl: m.fetchImpl, ahora: AHORA })
  check('sin las llaves de Telegram, la campanita sale igual', m.telegram.length === 0 && m.campanas.length === 2 && m.estado?.sinTelegram?.length)
}

console.log('── El tipo nuevo en los avisos ──')
const prefs = readFileSync(`${REPO}/js/avisos-prefs.js`, 'utf8')
const notif = readFileSync(`${REPO}/js/notifications.js`, 'utf8')
check('torneo_jornada en las tres tablas de Ajustes y en las dos listas de la campanita', (prefs.match(/'torneo_jornada'/g) || []).length === 3 && (notif.match(/torneo_jornada:/g) || []).length === 2)
check('y su pasada en el semáforo de /admin', /\['ligas_jornadas',/.test(readFileSync(`${REPO}/admin/js/semaforo.js`, 'utf8')))

console.log('── La migración, contra PostgreSQL ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1302'
const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const mig = readFileSync(`${REPO}/supabase-migration-1302-ligas-jornadas.sql`, 'utf8')
check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const T = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  const r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    grant usage on schema public to anon, authenticated;
    create table user_profiles (id uuid primary key);
    create table tournaments (id uuid primary key);
    create table tournament_registrations (tournament_id uuid, user_id uuid, status text);
    create table tournament_matchday_decklists (tournament_id uuid, user_id uuid, matchday int, raw_text text);
    alter table tournament_matchday_decklists enable row level security;
    insert into tournaments values ('${T(90)}');
    insert into user_profiles select ('00000000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid from generate_series(1, 4) g;
    insert into tournament_registrations values ('${T(90)}', '${T(1)}', 'active'), ('${T(90)}', '${T(2)}', 'active'), ('${T(90)}', '${T(3)}', 'dropped');
    insert into tournament_matchday_decklists values ('${T(90)}', '${T(1)}', 6, 'x'), ('${T(90)}', '${T(3)}', 6, 'x'), ('${T(90)}', '${T(2)}', 5, 'x');`])
  check('el andamio carga', r.status === 0, r.stderr)
  const sentencias = mig.split(/;\s*\n(?=(?:create|alter|do|grant|--|\s*$))/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let todas = true
  for (let v = 0; v < 2; v++) for (const st of sentencias) { const x = psql(['-d', BD, '-c', st.endsWith(';') ? st : st + ';']); if (x.status !== 0) { todas = false; console.log(x.stderr) } }
  check('la 1302 entra sentencia a sentencia, y otra vez encima', todas, sentencias.length)
  check('la cuenta de listas: solo los inscritos activos de esa jornada', q(`set role anon; select liga_listas_jornada('${T(90)}', 6)`).out === '1' && q(`set role authenticated; select liga_listas_jornada('${T(90)}', 5)`).out === '1')
  check('nadie de fuera lee los avisos apuntados (RLS sin políticas)', q(`insert into tournament_matchday_avisos values ('${T(90)}', 6, 'telegram'); grant select on tournament_matchday_avisos to anon; set role anon; select count(*) from tournament_matchday_avisos`).out === '0')
  check('un aviso por liga, jornada y canal', !q(`insert into tournament_matchday_avisos values ('${T(90)}', 6, 'telegram')`).ok && !q(`insert into tournament_matchday_avisos values ('${T(90)}', 6, 'otro')`).ok)
  psql(['-c', `drop database if exists ${BD}`])
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
