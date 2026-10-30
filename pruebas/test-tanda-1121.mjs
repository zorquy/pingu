// Tanda 1121 — Usuarios: lo puro (filtros, buscador, orden, la frase de una
// moderación), la función programada que levanta lo caducado (con dobles) y
// la migración contra PostgreSQL de verdad: silenciar y banear con motivo y
// duración, solo el equipo y a uno mismo no, quitar, y que lo vencido se
// levante solo sin tocar lo que no tiene fila. Dos veces encima y sin tablas
// temporales.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
{
  // usuarios-admin.js importa supabase.js: lo puro se lee con un doble mínimo.
  const fuente = readFileSync(`${REPO}/admin/js/usuarios-admin.js`, 'utf8')
  check('Pro se fue de Usuarios', !/is_pro|Hacer Pro/.test(fuente) && !/data-toggle-pro/.test(readFileSync(`${REPO}/admin/js/admin.js`, 'utf8')))
  const { FILTROS, filtrarUsuarios, fraseDeModeracion } = await import(`data:text/javascript,${encodeURIComponent(
    fuente
      .replace(/^import .*$/gm, '')
      .replace(/^/, 'const escapeHtml = (s) => String(s); const icons = new Proxy({}, { get: () => () => "" });\n')
  )}`)
  const L = [
    { id: 'a', display_name: 'Ánder', username: 'ander', is_admin: true, total_xp: 50, created_at: '2026-01-01' },
    { id: 'b', display_name: 'Bea', username: 'bea_tcg', is_muted: true, total_xp: 900, created_at: '2026-03-01' },
    { id: 'c', display_name: 'Cartas Norte', username: 'cartasnorte', tipo: 'tienda', total_xp: 10, created_at: '2026-02-01' },
  ]
  check('ocho filtros, con Tiendas', FILTROS.map((f) => f.id).join() === 'todos,equipo,moderacion,torneos,noticias,silenciados,baneados,tiendas')
  check('el buscador, sin acentos y con @', filtrarUsuarios(L, { texto: 'ander' }).map((u) => u.id).join() === 'a' && filtrarUsuarios(L, { texto: '@BEA' }).map((u) => u.id).join() === 'b')
  check('los chips filtran', filtrarUsuarios(L, { filtro: 'silenciados' }).map((u) => u.id).join() === 'b' && filtrarUsuarios(L, { filtro: 'tiendas' }).map((u) => u.id).join() === 'c' && filtrarUsuarios(L, { filtro: 'equipo' }).map((u) => u.id).join() === 'a')
  check('el orden: las más nuevas, más XP o por nombre', filtrarUsuarios(L).map((u) => u.id).join() === 'b,c,a' && filtrarUsuarios(L, { orden: 'xp' }).map((u) => u.id).join() === 'b,a,c' && filtrarUsuarios(L, { orden: 'nombre' }).map((u) => u.id).join() === 'a,b,c')
  check('la frase de una moderación', /^Silencio hasta el .* · «spam»$/.test(fraseDeModeracion({ que: 'silencio', hasta: '2026-11-05T10:00:00Z', motivo: 'spam' })) && fraseDeModeracion({ que: 'baneo' }) === 'Baneo sin fecha de fin')
  const sem = await import(`${REPO}/admin/js/semaforo.js`)
  check('la pasada nueva está en el semáforo', sem.PASADAS.some(([k]) => k === 'moderacion_al_dia'))
}

console.log('── La función programada ──')
{
  const { procesar, config } = await import(`${REPO}/netlify/functions/moderacion-al-dia.mjs`)
  const llamadas = []
  const doble = (respuesta) => async (url, op) => {
    llamadas.push({ url, body: op?.body })
    if (/scrydex_estado/.test(url)) return new Response('', { status: 201 })
    return respuesta()
  }
  let r = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, fetchImpl: doble(() => new Response('3', { status: 200 })) })
  const estado = JSON.parse(llamadas.find((l) => /scrydex_estado/.test(l.url)).body)[0]
  check('levanta lo caducado y lo apunta en el estado', r.ok && r.levantadas === 3 && estado.clave === 'moderacion_al_dia' && estado.valor.levantadas === 3 && estado.valor.hecho === true, JSON.stringify(estado))
  llamadas.length = 0
  r = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, fetchImpl: doble(() => new Response('{"code":"PGRST202","message":"Could not find the function"}', { status: 404 })) })
  check('sin la migración: «todavía no», sin gritar', r.ok && /1121/.test(r.saltado))
  llamadas.length = 0
  r = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, fetchImpl: doble(() => new Response('boom', { status: 500 })) })
  const e2 = JSON.parse(llamadas.find((l) => /scrydex_estado/.test(l.url)).body)[0]
  check('un error va al estado (el semáforo lo ve)', !r.ok && /500/.test(e2.valor.ultimoError?.error || ''))
  check('cada hora, y no en punto', /^\d+ \* \* \* \*$/.test(config.schedule) && !/^0 /.test(config.schedule), config.schedule)
}

console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1121'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1121-moderacion.sql`, 'utf8')
  check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
  if (hay.status === 0) {
    psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
    const ADMIN = '00000000-0000-0000-0000-00000000ad01'
    const ANE = '00000000-0000-0000-0000-0000000000a1'
    const JON = '00000000-0000-0000-0000-0000000000a2'
    const VIEJO = '00000000-0000-0000-0000-0000000000a3'
    let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role; exception when duplicate_object then null; end $$;
      create schema if not exists auth; create table auth.users (id uuid primary key);
      grant usage on schema auth to anon, authenticated;
      create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
      create or replace function is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
      grant usage on schema public to anon, authenticated, service_role;
      create table user_profiles (id uuid primary key, username text, is_muted boolean not null default false, is_banned boolean not null default false);
      grant select on user_profiles to anon, authenticated;
      insert into auth.users values ('${ADMIN}'), ('${ANE}'), ('${JON}'), ('${VIEJO}');
      insert into user_profiles (id, username, is_muted) values ('${ADMIN}', 'pingu', false), ('${ANE}', 'ane', false), ('${JON}', 'jon', false), ('${VIEJO}', 'viejo', true);`])
    check('el andamio carga', r.status === 0, r.stderr)
    const sinNotify = mig.replace(/notify pgrst[^;]*;/, '')
    r = psql(['-d', BD, '-c', sinNotify])
    check('la 1121 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', sinNotify]).status === 0)

    const comoAdmin = `set prueba.uid = '${ADMIN}'; set prueba.admin = 'si'; set role authenticated;`
    const comoAne = `set prueba.uid = '${ANE}'; set prueba.admin = 'no'; set role authenticated;`
    let x = q(`${comoAdmin} select admin_moderar('${ANE}', 'silencio', 'Spam en el foro', 7)`)
    check('silenciar con motivo y siete días', x.ok && JSON.parse(x.out).hasta && q(`select is_muted from user_profiles where id = '${ANE}'`).out === 't', x.err)
    check('  …queda escrito: qué, motivo, hasta y quién', q(`select que, motivo, (hasta between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour'), por from moderaciones where user_id = '${ANE}'`).out === `silencio|Spam en el foro|t|${ADMIN}`)
    x = q(`${comoAdmin} select admin_moderar('${ANE}', 'silencio', 'Otra vez', null)`)
    check('volver a silenciar cierra el anterior (manda el último, sin fecha)', x.ok && q(`select count(*) filter (where quitada_at is null), count(*) from moderaciones where user_id = '${ANE}'`).out === '1|2' && q(`select hasta is null from moderaciones where user_id = '${ANE}' and quitada_at is null`).out === 't')
    x = q(`${comoAdmin} select admin_moderar('${JON}', 'baneo', null, 1)`)
    check('banear un día', x.ok && q(`select is_banned from user_profiles where id = '${JON}'`).out === 't')
    check('a uno mismo, no', /a ti no/.test(q(`${comoAdmin} select admin_moderar('${ADMIN}', 'baneo', null, null)`).err))
    check('alguien que no es del equipo, no', /solo el equipo/.test(q(`${comoAne} select admin_moderar('${JON}', 'silencio', null, null)`).err))
    check('  …ni sin sesión', /permission denied/.test(q(`set role anon; select admin_moderar('${JON}', 'silencio', null, null)`).err))
    check('el registro solo lo lee el equipo', q(`${comoAne} select count(*) from moderaciones`).out === '0' && q(`${comoAdmin} select count(*) from moderaciones`).out === '3')

    // El baneo de Jon vence; el silencio de Ane (sin fecha) no; el del viejo (sin fila) tampoco.
    q(`update moderaciones set hasta = now() - interval '1 minute' where user_id = '${JON}'`)
    x = q(`set role service_role; select moderacion_al_dia()`)
    check('lo vencido se levanta (una fila)', x.ok && x.out === '1', x.err || x.out)
    check('  …Jon ya no está baneado y su fila queda cerrada', q(`select is_banned from user_profiles where id = '${JON}'`).out === 'f' && q(`select quitada_at is not null from moderaciones where user_id = '${JON}'`).out === 't')
    check('  …Ane sigue silenciada (sin fecha) y el viejo también (no tiene fila)', q(`select string_agg(username || ':' || is_muted, ',' order by username) from user_profiles where id in ('${ANE}', '${VIEJO}')`).out === 'ane:true,viejo:true')
    check('  …y otra vez no hace nada', q(`${comoAdmin} select moderacion_al_dia()`).out === '0')
    // Un silencio que vence mientras está baneado: se levanta el silencio, no el baneo.
    q(`${comoAdmin} select admin_moderar('${JON}', 'baneo', 'Fuera', null)`)
    q(`${comoAdmin} select admin_moderar('${JON}', 'silencio', null, 3)`)
    q(`update moderaciones set hasta = now() - interval '1 minute' where user_id = '${JON}' and que = 'silencio' and quitada_at is null`)
    q(`set role service_role; select moderacion_al_dia()`)
    check('al vencer el silencio se levanta el silencio y el baneo sigue', q(`select is_muted || ':' || is_banned from user_profiles where id = '${JON}'`).out === 'false:true')
    x = q(`${comoAdmin} select admin_moderar_quitar('${ANE}', 'silencio')`)
    check('quitar: deja de estar silenciada y la fila se cierra', x.ok && q(`select is_muted from user_profiles where id = '${ANE}'`).out === 'f' && q(`select count(*) from moderaciones where user_id = '${ANE}' and quitada_at is null`).out === '0')
    check('  …sin sesión, no', /permission denied/.test(q(`set role anon; select moderacion_al_dia()`).err))
    psql(['-c', `drop database if exists ${BD}`])
  }
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
