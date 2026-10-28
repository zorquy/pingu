// Tanda 1074 — una tienda no tiene por qué tener local (PINGU: «yo soy un
// particular… me dedico a la compraventa»). Lo puro: el Instagram de lo que
// alguien escribe, la web como enlace y los dos enlaces del escaparate. Y la
// migración contra PostgreSQL: pedir sin ciudad, el Instagram en su columna,
// lo de antes («Web o Instagram») repartido, la invitación y el alta que lo
// copian, dos veces encima.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
{
  const P = await import(`${REPO}/js/tiendas-puro.js`)
  check('instagramDe: «@rincon», «instagram.com/rincon/» y con https y www', P.instagramDe('@el.rincon') === 'el.rincon' && P.instagramDe('instagram.com/el_rincon/') === 'el_rincon' && P.instagramDe('https://www.instagram.com/Rincon?igsh=abc') === 'Rincon')
  check('  …una web, un texto o nada: null', P.instagramDe('rincon.es') === null && P.instagramDe('hola que tal') === null && P.instagramDe('') === null && P.instagramDe(null) === null)
  check('  …ni un usuario de 31 letras', P.instagramDe('@' + 'a'.repeat(31)) === null)
  check('webDe: sin esquema, con https', JSON.stringify(P.webDe('rincon.es')) === '{"href":"https://rincon.es/","texto":"rincon.es"}')
  check('  …con www y ruta, se lee sin www', P.webDe('http://www.rincon.es/tienda/').texto === 'rincon.es/tienda' && P.webDe('http://www.rincon.es/tienda/').href === 'http://www.rincon.es/tienda/')
  check('  …javascript:, un @ o una palabra suelta, no', P.webDe('javascript:alert(1)') === null && P.webDe('@rincon') === null && P.webDe('rincon') === null && P.webDe('mi tienda.es') === null)
  const e = P.enlacesDeTienda({ web: 'www.rincon.es', instagram: 'el.rincon' })
  check('enlacesDeTienda: la web y luego el Instagram, con su enlace', e.map((x) => `${x.tipo}:${x.texto}:${x.href}`).join('|') === 'web:rincon.es:https://www.rincon.es/|instagram:@el.rincon:https://www.instagram.com/el.rincon/', JSON.stringify(e))
  check('  …un @ escrito en «web» (antes de la 1074) es su Instagram', JSON.stringify(P.enlacesDeTienda({ web: '@turincon' })) === '[{"tipo":"instagram","href":"https://www.instagram.com/turincon/","texto":"@turincon"}]')
  check('  …sin nada, nada', P.enlacesDeTienda({}).length === 0 && P.enlacesDeTienda(null).length === 0)
  check('validarSolicitud: sin ciudad vale; a medias, no', P.validarSolicitud({ nombre: 'Rincón', ciudad: '', email: 'a@b.es' }) === null && /ciudad/.test(P.validarSolicitud({ nombre: 'Rincón', ciudad: 'B', email: 'a@b.es' })))
}

console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1074'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const m1067 = readFileSync(`${REPO}/supabase-migration-1067-tiendas.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')
  const mig = readFileSync(`${REPO}/supabase-migration-1074-tienda-sin-local.sql`, 'utf8')
  check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0)
  if (hay.status === 0) {
    psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
    let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role; exception when duplicate_object then null; end $$;
      create schema if not exists auth; create table auth.users (id uuid primary key);
      grant usage on schema auth to anon, authenticated, service_role;
      create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
      create or replace function auth.role() returns text language sql as $f$ select nullif(current_setting('prueba.rol', true), '') $f$;
      create or replace function auth.email() returns text language sql as $f$ select nullif(current_setting('prueba.email', true), '') $f$;
      create or replace function is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
      grant usage on schema public to anon, authenticated, service_role;
      create table user_profiles (id uuid primary key, username text, display_name text, is_admin boolean not null default false, onboarding_completed boolean, created_at timestamptz not null default now());
      create unique index on user_profiles (lower(username));
      grant select, insert, update on user_profiles to anon, authenticated;
      create table user_notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null, type text not null, title text not null, body text, link text, created_at timestamptz not null default now());
      insert into auth.users values ('00000000-0000-0000-0000-00000000ad01'), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000e1'), ('00000000-0000-0000-0000-0000000000e2'), ('00000000-0000-0000-0000-0000000000e3');
      insert into user_profiles (id, username, is_admin, onboarding_completed) values ('00000000-0000-0000-0000-00000000ad01', 'pingu', true, true);`])
    check('el andamio carga', r.status === 0, r.stderr)
    r = psql(['-d', BD, '-c', m1067])
    check('la 1067 entra', r.status === 0, r.stderr)
    // Lo de antes: tiendas con «Web o Instagram» y una solicitud pendiente.
    r = psql(['-d', BD, '-c', `insert into tiendas (user_id, ciudad, web) values
        ('00000000-0000-0000-0000-0000000000e1', 'Bilbao', '@turincon'),
        ('00000000-0000-0000-0000-0000000000e2', null, 'https://www.Instagram.com/Otra.Tienda/?igsh=1'),
        ('00000000-0000-0000-0000-0000000000e3', 'Getxo', 'rincon.es');
      insert into tienda_solicitudes (nombre, ciudad, email, web) values ('Vieja', 'Bilbao', 'vieja@ejemplo.es', '@lavieja');`])
    check('lo de antes se siembra', r.status === 0, r.stderr)
    r = psql(['-d', BD, '-c', mig])
    check('la 1074 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', mig]).status === 0)
    const filas = q(`select coalesce(web, '-') || '/' || coalesce(instagram, '-') from tiendas order by user_id`).out
    check('un @ o un enlace de Instagram en «web» pasa a «instagram» (sin @, con sus mayúsculas); una web se queda', filas === '-/turincon\n-/Otra.Tienda\nrincon.es/-', filas)
    check('  …y en la solicitud pendiente, igual', q(`select coalesce(web, '-'), instagram from tienda_solicitudes where email = 'vieja@ejemplo.es'`).out === '-|lavieja')
    check('tienda_pedir: una sola, la de siete (la de seis se quita)', q(`select string_agg(pronargs::text, ',') from pg_proc where proname = 'tienda_pedir'`).out === '7')

    const ANON = 'set role anon;'
    const p1 = q(`${ANON} select tienda_pedir('Cartas de Ane', null, 'ane@ejemplo.es', null, null, 'poca', 'instagram.com/cartas.ane')`)
    check('pedir SIN ciudad (vende desde casa), con su Instagram', p1.ok && JSON.parse(p1.out).ok === true, p1.err)
    check('  …se guarda sin ciudad y el Instagram como usuario', q(`select coalesce(ciudad, '-'), instagram from tienda_solicitudes where email = 'ane@ejemplo.es'`).out === '-|cartas.ane')
    check('  …y la campanita no dice « · » de una ciudad que no hay', q(`select body from user_notifications order by created_at desc limit 1`).out === 'Cartas de Ane')
    check('  …con ciudad, como antes', q(`${ANON} select tienda_pedir('El Rincón', 'Bilbao', 'rincon@ejemplo.es', 'Ane', 'rincon.es', 'media', '@el.rincon')`).ok && q(`select ciudad, web, instagram from tienda_solicitudes where email = 'rincon@ejemplo.es'`).out === 'Bilbao|rincon.es|el.rincon')
    check('  …una ciudad de una letra, no', /ciudad entera/.test(q(`${ANON} select tienda_pedir('Otra', 'B', 'otra@ejemplo.es')`).err))
    check('  …un Instagram que no es un usuario, no', /no parece un usuario/.test(q(`${ANON} select tienda_pedir('Otra', null, 'otra@ejemplo.es', null, null, null, 'mi tienda guay')`).err))
    check('  …y sin Instagram, null', q(`${ANON} select tienda_pedir('Otra más', '', 'otra2@ejemplo.es')`).ok && q(`select coalesce(ciudad, '-'), coalesce(instagram, '-') from tienda_solicitudes where email = 'otra2@ejemplo.es'`).out === '-|-')

    const ADMIN = `set prueba.uid = '00000000-0000-0000-0000-00000000ad01'; set prueba.admin = 'si'; set role authenticated;`
    const id = q(`select id from tienda_solicitudes where email = 'ane@ejemplo.es'`).out
    check('el equipo la acepta', q(`${ADMIN} select tienda_decidir('${id}', true) ->> 'estado'`).out === 'aceptada')
    const token = q(`select token from tienda_solicitudes where id = '${id}'`).out
    const inv = JSON.parse(q(`${ANON} select tienda_invitacion('${token}')`).out || '{}')
    check('tienda_invitacion dice también su Instagram (y la ciudad, vacía)', inv.valida === true && inv.instagram === 'cartas.ane' && inv.ciudad === null, JSON.stringify(inv))
    const B = '00000000-0000-0000-0000-0000000000b1'
    const alta = q(`set prueba.uid = '${B}'; set prueba.email = 'ane@ejemplo.es'; set role authenticated; select tienda_alta('${token}', 'cartas-ane', 'Cartas de Ane', '', null, null)`)
    check('tienda_alta sin ciudad ni dirección: ya es tienda', alta.ok && JSON.parse(alta.out).username === 'cartas-ane', alta.err)
    check('  …su fila sin ciudad, sin web y con el Instagram de la solicitud', q(`select coalesce(ciudad, '-'), coalesce(direccion, '-'), coalesce(web, '-'), instagram from tiendas where user_id = '${B}'`).out === '-|-|-|cartas.ane')
    const COMO_B = `set prueba.uid = '${B}'; set role authenticated;`
    check('la tienda cambia su Instagram', q(`${COMO_B} update tiendas set instagram = 'ane.cartas' where user_id = '${B}' returning instagram`).out === 'ane.cartas')
    check('  …pero no con forma de enlace (la web lo guarda como usuario)', !q(`${COMO_B} update tiendas set instagram = '@ane' where user_id = '${B}'`).ok)
    check('  …y no el de otra tienda (0 filas, RLS)', q(`${COMO_B} update tiendas set instagram = 'otra' where user_id = '00000000-0000-0000-0000-0000000000e3' returning 1`).out === '')
  }
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
