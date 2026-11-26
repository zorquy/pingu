// Tanda 1457 — Torneos que se repiten, contra PostgreSQL de verdad:
//  · la columna y su `check` (solo de un día, solo semanal/quincenal);
//  · al TERMINAR uno que se repite, sale el siguiente: abierto, a la misma
//    hora de Madrid 7 (o 14) días después —también cruzando el cambio de
//    hora—, con lo mismo y su código; él también se repite;
//  · cancelar no crea nada; uno que no se repite, tampoco;
//  · terminar dos veces (o llamar dos veces) no crea dos;
//  · si se terminó tarde, salta a la siguiente fecha que venga;
//  · «Dejar de repetir» (repite = null) para la serie;
//  · la migración corre dos veces y sin tablas temporales; nadie puede llamar
//    a la función que crea.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000, env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' } })
const BD = 'prueba_1457'
const MIG = `${REPO}/supabase-migration-1457-torneos-que-se-repiten.sql`
const sql = readFileSync(MIG, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(sql))
if (psql(['-c', 'select 1']).status !== 0) { check('hay un PostgreSQL en /var/tmp:5433', false); process.exit(1) }
psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
const q = (s) => { const r = psql(['-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }

const ORG = '00000000-0000-0000-0000-000000000008'
const base = q(`do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin create role anon; exception when duplicate_object then null; end $$;
  create table tournaments (
    id uuid primary key default gen_random_uuid(), slug text unique not null, admin_id uuid not null, name text not null, description text,
    start_at timestamptz not null, status text not null default 'draft', max_players int, swiss_rounds int not null,
    round_time_minutes int not null default 30, checkin_minutes int not null default 5, swiss_bo int not null default 1,
    top_cut_bo int not null default 3, top_cut_size int not null default 0, current_round_id uuid, pairing_seed text not null,
    format text not null default 'standard', show_opponent_decklists boolean not null default false, image_url text,
    decklist_visibility text not null default 'al_terminar', banner_url text, is_official boolean not null default false,
    is_private boolean not null default false, prizes jsonb, rounds_per_matchday int not null default 1, precio_entrada numeric(8,2),
    registration_notified_at timestamptz, modalidad text not null default 'online', lugar text, direccion text, inscripcion text not null default 'libre');
  create table tournament_join_codes (tournament_id uuid primary key, code text not null);`)
check('el esquema de prueba se monta', base.ok, base.err)

const correr = () => {
  // Sentencia a sentencia NO hace falta aquí (no hay temporales), pero sí dos veces.
  const r = spawnSync('psql', [...PG, '-d', BD, '-f', MIG], { encoding: 'utf8', env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' } })
  return { ok: r.status === 0, err: r.stderr }
}
const m1 = correr()
check('la migración corre', m1.ok, m1.err)
const m2 = correr()
check('y corre dos veces', m2.ok, m2.err)

// Un viernes a las 18:00 de Madrid, en el pasado reciente (hace 2 días).
const ins = (id, extra = '') => q(`insert into tournaments (id, slug, admin_id, name, start_at, status, swiss_rounds, pairing_seed, max_players, modalidad, lugar, inscripcion, precio_entrada, prizes ${extra ? ', ' + extra.split('|')[0] : ''})
  values ('${id}', 'viernes-${id.slice(-4)}-abc123', '${ORG}', 'Liga del viernes', (date_trunc('day', (now() - interval '2 days') at time zone 'Europe/Madrid') + interval '18 hours') at time zone 'Europe/Madrid',
  'in_progress', 4, 'semilla', 16, 'presencial', 'Cartas Bilbao', 'pedir', 5, '[{"puesto":"1º","premio":"Caja"}]' ${extra ? ', ' + extra.split('|')[1] : ''})`)

const A = '00000000-0000-0000-0000-0000000000a1'
check('un torneo semanal se crea', ins(A, 'repite|\'semanal\'').ok)
const malo = ins('00000000-0000-0000-0000-0000000000b1', 'repite, format|\'diario\', \'standard\'')
check('«diario» no vale', !malo.ok)
const liga = ins('00000000-0000-0000-0000-0000000000b2', 'repite, format|\'semanal\', \'league\'')
check('una liga no se repite', !liga.ok)
q(`insert into tournament_join_codes values ('${A}', 'PIKACHU')`)

q(`update tournaments set status = 'finished' where id = '${A}'`)
const sig = q(`select id || '|' || status || '|' || to_char(start_at at time zone 'Europe/Madrid', 'HH24:MI') || '|' || extract(dow from start_at at time zone 'Europe/Madrid')
  || '|' || round(extract(epoch from start_at - (select start_at from tournaments where id = '${A}')) / 86400) || '|' || repite || '|' || serie_id || '|' || lugar || '|' || precio_entrada || '|' || (pairing_seed <> 'semilla') || '|' || slug
  from tournaments where id <> '${A}' and serie_id = '${A}'`).out.split('\n').filter(Boolean)
check('al terminar sale UNO siguiente', sig.length === 1, sig.join(' / '))
const [idB, estado, hora, , dias, repite, serie, lugar, precio, semillaNueva, slug] = (sig[0] || '').split('|')
check('abierto a inscripciones', estado === 'registration_open', estado)
check('a la misma hora de Madrid (18:00)', hora === '18:00', hora)
check('7 días después', dias === '7', dias)
check('se sigue repitiendo y es de la misma serie', repite === 'semanal' && serie === A)
check('con lo mismo (sitio, precio)', lugar === 'Cartas Bilbao' && Number(precio) === 5, `${lugar} ${precio}`)
check('con semilla nueva y slug nuevo del mismo nombre', semillaNueva === 'true' && /^viernes-00a1-[0-9a-f]{8}$/.test(slug), slug)
check('y el mismo código', q(`select code from tournament_join_codes where tournament_id = '${idB}'`).out === 'PIKACHU')
check('el primero queda marcado como de la serie', q(`select serie_id from tournaments where id = '${A}'`).out === A)

q(`update tournaments set status = 'in_progress' where id = '${A}'`)
q(`update tournaments set status = 'finished' where id = '${A}'`)
check('terminarlo otra vez no crea otro', q(`select count(*) from tournaments where serie_id = '${A}'`).out === '2')
check('llamar a la función otra vez devuelve el mismo', q(`select torneos_crear_siguiente('${A}')`).out === idB)

// Cancelar y no repetirse.
const C = '00000000-0000-0000-0000-0000000000c1'
ins(C, 'repite|\'semanal\'')
q(`update tournaments set status = 'cancelled' where id = '${C}'`)
check('cancelar no crea el siguiente', q(`select count(*) from tournaments where serie_id = '${C}'`).out === '0')
const D = '00000000-0000-0000-0000-0000000000d1'
ins(D)
q(`update tournaments set status = 'finished' where id = '${D}'`)
check('uno que no se repite, al terminar, nada', q(`select count(*) from tournaments where name = 'Liga del viernes' and id not in ('${A}', '${C}', '${D}', '${idB}')`).out === '0')

// Quincenal y terminado tarde: salta a la siguiente fecha que venga.
const E = '00000000-0000-0000-0000-0000000000e1'
q(`insert into tournaments (id, slug, admin_id, name, start_at, status, swiss_rounds, pairing_seed, repite)
  values ('${E}', 'tarde-xyz123', '${ORG}', 'Tarde', now() - interval '40 days', 'in_progress', 3, 's', 'quincenal')`)
q(`update tournaments set status = 'finished' where id = '${E}'`)
const tarde = q(`select (start_at > now()) || '|' || (start_at < now() + interval '15 days') || '|' || (round(extract(epoch from start_at - (select start_at from tournaments where id = '${E}')) / 86400)::int % 14 = 0)
  from tournaments where serie_id = '${E}' and id <> '${E}'`).out
check('terminado tarde: la siguiente fecha que viene, en pasos de 14 días', tarde === 'true|true|true', tarde)

// El cambio de hora: un viernes 18:00 antes del 25 de octubre de 2026.
const h = q(`select to_char(torneos_fecha_siguiente('2026-10-23 18:00 Europe/Madrid'::timestamptz, 'semanal', '2026-10-24'::timestamptz) at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI')`).out
check('cruzando el cambio de hora sigue a las 18:00', h === '2026-10-30 18:00', h)

// Dejar de repetir: el que viene, sin `repite`, al terminar no crea más.
q(`update tournaments set repite = null where id = '${idB}'`)
q(`update tournaments set status = 'finished' where id = '${idB}'`)
check('«Dejar de repetir» para la serie', q(`select count(*) from tournaments where serie_id = '${A}'`).out === '2')

// Nadie la llama desde fuera.
const priv = q(`select has_function_privilege('authenticated', 'torneos_crear_siguiente(uuid)', 'execute')`).out
check('la función que crea no la puede llamar nadie', priv === 'f', priv)

psql(['-c', `drop database if exists ${BD}`])
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
