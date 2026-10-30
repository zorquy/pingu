// Tanda 1120 — los avisos del equipo: lo puro (tipo, desde y hasta, a quién,
// el enlace, la huella del cierre) y la migración contra PostgreSQL de verdad
// («mandarlo también a la campanita»: a todas las cuentas menos a quien lo
// apagó, solo el equipo, sin doble envío), dos veces encima y sin tablas
// temporales.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
{
  const m = await import(`${REPO}/js/aviso-puro.js`)
  const ahora = new Date('2026-11-01T12:00:00Z')
  const a = (x) => ({ texto: 'Torneo el sábado', activo: true, ...x })
  check('sin texto no hay aviso; apagado, tampoco', m.estadoDeAviso({ activo: true, texto: '  ' }, ahora) === 'vacio' && m.estadoDeAviso(a({ activo: false }), ahora) === 'apagado')
  check('desde y hasta: programado, activo y caducado', m.estadoDeAviso(a({ desde: '2026-11-02T00:00:00Z' }), ahora) === 'programado' && m.estadoDeAviso(a({ desde: '2026-10-30T00:00:00Z', hasta: '2026-11-03T00:00:00Z' }), ahora) === 'activo' && m.estadoDeAviso(a({ hasta: '2026-11-01T11:59:00Z' }), ahora) === 'caducado')
  check('a quién: con cuenta y en el móvil', m.seVeAviso(a({ publico: 'cuenta' }), { ahora }) === false && m.seVeAviso(a({ publico: 'cuenta' }), { ahora, conCuenta: true }) === true && m.seVeAviso(a({ publico: 'movil' }), { ahora }) === false && m.seVeAviso(a({ publico: 'movil' }), { ahora, movil: true }) === true && m.seVeAviso(a({}), { ahora }) === true)
  check('los avisos de antes (tono) siguen: «aviso» es aviso y lo demás, novedad', m.tipoDeAviso({ tono: 'aviso' }) === 'aviso' && m.tipoDeAviso({ tono: 'info' }) === 'novedad' && m.tipoDeAviso({ tipo: 'mantenimiento', tono: 'aviso' }) === 'mantenimiento')
  check('el enlace: de la casa o https; javascript: y // no', m.enlaceDeAviso({ enlace: '/torneos' }) === '/torneos' && m.enlaceDeAviso({ enlace: 'https://x.com/pokedoc_es' }) === 'https://x.com/pokedoc_es' && m.enlaceDeAviso({ enlace: 'javascript:alert(1)' }) === '' && m.enlaceDeAviso({ enlace: '//malo.com' }) === '' && m.enlaceDeAviso({ enlace: 'http://x.com' }) === '')
  const f = m.franjaHtml(a({ texto: '<b>ojo</b>', tipo: 'mantenimiento', enlace: 'https://pokedoc.es/x', texto_enlace: 'Más' }))
  check('la franja: su tipo, el texto escapado, el enlace fuera en otra pestaña', /data-tipo="mantenimiento"/.test(f) && /&lt;b&gt;ojo/.test(f) && /href="https:\/\/pokedoc\.es\/x" target="_blank" rel="noopener">Más</.test(f) && /aviso-global-cerrar/.test(f))
  check('  …y sin enlace válido, sin enlace', !/<a /.test(m.franjaHtml(a({ enlace: 'javascript:x' }))))
  check('la huella cambia con otro texto o con otra fecha de salida (vuelve a salir)', m.huellaDeAviso(a({})) !== m.huellaDeAviso(a({ texto: 'Otro' })) && m.huellaDeAviso(a({})) !== m.huellaDeAviso(a({ desde: '2026-11-05T10:00:00Z' })) && m.huellaDeAviso(a({})) === m.huellaDeAviso(a({ publico: 'movil' })))
  const prefs = await import(`${REPO}/js/avisos-prefs.js`)
  check('«Novedades y avisos del equipo» se puede apagar en Ajustes', prefs.GRUPOS_CAMPANITA.some((g) => g.tipos.includes('aviso_equipo')) && /aviso_equipo:/.test(readFileSync(`${REPO}/js/notifications.js`, 'utf8')))
  check('la franja salió de components.css y va en su hoja', !/\.aviso-global/.test(readFileSync(`${REPO}/css/components.css`, 'utf8')) && /hojaInyectada\('css\/aviso-global\.css'\)/.test(readFileSync(`${REPO}/js/aviso-global.js`, 'utf8')))
}

console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1120'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1120-avisos.sql`, 'utf8')
  check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
  if (hay.status === 0) {
    psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
    const ADMIN = '00000000-0000-0000-0000-00000000ad01'
    const ANE = '00000000-0000-0000-0000-0000000000a1'
    const JON = '00000000-0000-0000-0000-0000000000a2'
    const HUERFANO = '00000000-0000-0000-0000-0000000000a3'
    let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
      create schema if not exists auth; create table auth.users (id uuid primary key);
      grant usage on schema auth to anon, authenticated;
      create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
      create or replace function is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
      grant usage on schema public to anon, authenticated;
      create table user_profiles (id uuid primary key, username text, notification_prefs_disabled text[] not null default '{}');
      grant select on user_profiles to anon, authenticated;
      create table user_notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null, type text not null, title text not null, body text, link text, created_at timestamptz not null default now());
      insert into auth.users values ('${ADMIN}'), ('${ANE}'), ('${JON}');
      insert into user_profiles (id, username, notification_prefs_disabled) values ('${ADMIN}', 'pingu', '{}'), ('${ANE}', 'ane', '{forum_reply}'), ('${JON}', 'jon', '{aviso_equipo}'), ('${HUERFANO}', 'borrado', '{}');`])
    check('el andamio carga', r.status === 0, r.stderr)
    const sinNotify = mig.replace(/notify pgrst[^;]*;/, '')
    r = psql(['-d', BD, '-c', sinNotify])
    check('la 1120 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', sinNotify]).status === 0)

    const comoAdmin = `set prueba.uid = '${ADMIN}'; set prueba.admin = 'si'; set role authenticated;`
    const comoAne = `set prueba.uid = '${ANE}'; set prueba.admin = 'no'; set role authenticated;`
    let x = q(`${comoAdmin} select admin_aviso_campanita('  Torneo el sábado  ', null, '/torneos')`)
    check('el equipo lo manda: a dos (el admin y Ane)', x.ok && JSON.parse(x.out).personas === 2, x.err || x.out)
    check('  …con su tipo, su texto limpio y su enlace', q(`select string_agg(u.username || ':' || n.type || ':' || n.title || ':' || coalesce(n.link, ''), ',' order by u.username) from user_notifications n join user_profiles u on u.id = n.recipient_id`).out === 'ane:aviso_equipo:Torneo el sábado:/torneos,pingu:aviso_equipo:Torneo el sábado:/torneos')
    check('  …a Jon no (lo apagó) ni a un perfil sin cuenta', q(`select count(*) from user_notifications where recipient_id in ('${JON}', '${HUERFANO}')`).out === '0')
    check('  …y queda apuntado', q(`select titulo, enlace, personas, por from avisos_enviados`).out === `Torneo el sábado|/torneos|2|${ADMIN}`)
    x = q(`${comoAdmin} select admin_aviso_campanita('Torneo el sábado', null, '/torneos')`)
    check('el mismo en menos de una hora no sale dos veces («ya»)', x.ok && JSON.parse(x.out).ya === true && q(`select count(*) from user_notifications`).out === '2')
    x = q(`${comoAdmin} select admin_aviso_campanita('Torneo el sábado', null, '/foro')`)
    check('  …con otro enlace sí es otro aviso', x.ok && JSON.parse(x.out).personas === 2)
    check('un enlace raro, no', /tiene que empezar/.test(q(`${comoAdmin} select admin_aviso_campanita('Hola', null, 'javascript:alert(1)')`).err))
    check('sin texto, no', /necesita un texto/.test(q(`${comoAdmin} select admin_aviso_campanita('   ', null, null)`).err))
    check('alguien que no es del equipo, no', /solo el equipo/.test(q(`${comoAne} select admin_aviso_campanita('Spam', null, null)`).err))
    check('  …ni sin sesión (anon no puede llamarla)', /permission denied/.test(q(`set role anon; select admin_aviso_campanita('Spam', null, null)`).err))
    check('lo enviado solo lo lee el equipo', q(`${comoAne} select count(*) from avisos_enviados`).out === '0' && q(`${comoAdmin} select count(*) from avisos_enviados`).out === '2')
    psql(['-c', `drop database if exists ${BD}`])
  }
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
