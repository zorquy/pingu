// Tanda 1118 — el panel de Logros de /admin: lo puro (familias, tipos,
// «cómo se consigue» a mano) y la migración contra PostgreSQL de verdad
// (dar y quitar a mano, con la XP del logro, el aviso y el registro), dos
// veces encima y sin tablas temporales.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
{
  const m = await import(`${REPO}/js/logro-objetivo.js`)
  const tipos = new Set(m.TIPOS.map((t) => t.tipo))
  check('cada tipo con frase está en la lista del panel (y con su familia)', m.TIPOS_CON_FRASE.every((t) => tipos.has(t)) && m.TIPOS.every((t) => t.familia in m.FAMILIAS), m.TIPOS_CON_FRASE.filter((t) => !tipos.has(t)).join())
  check('los de los retos y los de invitar están (el desplegable viejo no los tenía)', ['retos_racha', 'caro_perfectos', 'referrals_count', 'primeros_pasos'].every((t) => tipos.has(t)))
  check('«cómo se consigue» escrito a mano manda; vacío, la frase automática', m.objetivoDeLogro({ objetivo: 'Gana el sorteo de Navidad.', condition: { type: 'manual' } }) === 'Gana el sorteo de Navidad.' && m.objetivoDeLogro({ objetivo: '  ', condition: { type: 'total_xp', count: 500 } }) === 'Llega a 500 XP.')
  check('  …y el panel enseña siempre la automática', m.objetivoAutomatico({ objetivo: 'otra', condition: { type: 'forum_posts_count', count: 50 } }) === 'Escribe 50 mensajes en el foro.')
  check('familias: por el tipo, y los de torneo por su id', m.familiaDeLogro({ condition: { type: 'retos_racha' } }) === 'retos' && m.familiaDeLogro({ id: 'torneo_campeon', condition: { type: 'manual' } }) === 'torneos' && m.familiaDeLogro({ condition: { type: 'trades_done_count' } }) === 'coleccion')
  const admin = readFileSync(`${REPO}/admin/js/admin.js`, 'utf8')
  check('el formulario viejo se fue de admin.js', !/openAchievementModal|CONDITION_LABELS/.test(admin) && /import\('\.\/logros-admin\.js'\)/.test(admin))
}

console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1118'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1118-logros-admin.sql`, 'utf8')
  check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
  if (hay.status === 0) {
    psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
    const ADMIN = '00000000-0000-0000-0000-00000000ad01'
    const ANE = '00000000-0000-0000-0000-0000000000a1'
    let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
      create schema if not exists auth; create table auth.users (id uuid primary key);
      grant usage on schema auth to anon, authenticated;
      create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
      create or replace function is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
      grant usage on schema public to anon, authenticated;
      create or replace function nivel_de_xp(p_xp int) returns text language sql immutable as $f$ select case when p_xp >= 250 then 'Entrenador' else 'Novato' end $f$;
      create table achievement_definitions (id text primary key, title text not null, description text, emoji text, rarity text, xp_reward int, is_active boolean default true, condition jsonb);
      grant select, insert, update, delete on achievement_definitions to authenticated;
      create table user_profiles (id uuid primary key, username text, achievements text[] default '{}', total_xp int default 0, level text, showcase_achievement text);
      grant select on user_profiles to anon, authenticated;
      create table user_notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null, type text not null, title text not null, body text, link text, created_at timestamptz not null default now());
      insert into auth.users values ('${ADMIN}'), ('${ANE}');
      insert into user_profiles (id, username, achievements, total_xp, level) values ('${ADMIN}', 'pingu', '{}', 0, 'Novato'), ('${ANE}', 'ane', '{coleccion_100}', 240, 'Novato');
      insert into achievement_definitions (id, title, xp_reward, condition) values ('sorteo', 'Ganó el sorteo', 30, '{"type":"manual"}'), ('coleccion_100', 'Cien cartas', 25, '{"type":"collection_cards_count","count":100}');`])
    check('el andamio carga', r.status === 0, r.stderr)
    const sinNotify = mig.replace(/notify pgrst[^;]*;/, '')
    r = psql(['-d', BD, '-c', sinNotify])
    check('la 1118 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', sinNotify]).status === 0)
    check('la columna «objetivo» está', q(`select count(*) from information_schema.columns where table_name = 'achievement_definitions' and column_name = 'objetivo'`).out === '1')

    const comoAdmin = `set prueba.uid = '${ADMIN}'; set prueba.admin = 'si'; set role authenticated;`
    const comoAne = `set prueba.uid = '${ANE}'; set prueba.admin = 'no'; set role authenticated;`
    let x = q(`${comoAdmin} select admin_logro_dar('${ANE}', 'sorteo', 'Ganó el sorteo de octubre')`)
    check('dar: un admin se lo da', x.ok && JSON.parse(x.out).xp === 30, x.err)
    check('  …lo tiene, con la XP del logro y su nivel', q(`select array_to_string(achievements, ','), total_xp, level from user_profiles where id = '${ANE}'`).out === 'coleccion_100,sorteo|270|Entrenador')
    check('  …le llega el aviso, con el motivo', q(`select type, title, body, link from user_notifications where recipient_id = '${ANE}'`).out === 'logro|Tienes un logro nuevo: Ganó el sorteo|Ganó el sorteo de octubre|/perfil?ver=logros')
    check('  …y queda escrito quién y por qué', q(`select accion, motivo, por from logros_a_mano where logro_id = 'sorteo'`).out === `dar|Ganó el sorteo de octubre|${ADMIN}`)
    x = q(`${comoAdmin} select admin_logro_dar('${ANE}', 'sorteo', null)`)
    check('dárselo otra vez no suma nada («ya»)', x.ok && JSON.parse(x.out).ya === true && q(`select total_xp from user_profiles where id = '${ANE}'`).out === '270')
    check('un logro que no existe, no', /ese logro no existe/.test(q(`${comoAdmin} select admin_logro_dar('${ANE}', 'nada', null)`).err))
    check('alguien que no es admin, no', /solo el equipo/.test(q(`${comoAne} select admin_logro_dar('${ANE}', 'sorteo', null)`).err))
    check('  …ni sin sesión (anon no puede llamarla)', /permission denied/.test(q(`set role anon; select admin_logro_dar('${ANE}', 'sorteo', null)`).err))
    check('el registro solo lo lee el equipo', q(`${comoAne} select count(*) from logros_a_mano`).out === '0' && q(`${comoAdmin} select count(*) from logros_a_mano`).out === '1')

    q(`update user_profiles set showcase_achievement = 'coleccion_100', total_xp = 10 where id = '${ANE}'`)
    x = q(`${comoAdmin} select admin_logro_quitar('${ANE}', 'coleccion_100', 'Fue un error')`)
    check('quitar: deja de tenerlo, la XP baja sin pasar de cero y deja de ser el destacado', x.ok && q(`select array_to_string(achievements, ','), total_xp, coalesce(showcase_achievement, '-') from user_profiles where id = '${ANE}'`).out === 'sorteo|0|-', x.err)
    check('  …y queda escrito', q(`select accion, motivo from logros_a_mano where logro_id = 'coleccion_100'`).out === 'quitar|Fue un error')
    check('  …sin aviso a la persona', q(`select count(*) from user_notifications where recipient_id = '${ANE}'`).out === '1')
    check('quitar uno que no tiene: «ya», sin tocar nada', JSON.parse(q(`${comoAdmin} select admin_logro_quitar('${ANE}', 'coleccion_100', null)`).out).ya === true)
    psql(['-c', `drop database if exists ${BD}`])
  }
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
