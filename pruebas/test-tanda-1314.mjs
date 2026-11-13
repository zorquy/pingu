// Tanda 1314 — S11: descargar tus datos y borrar tu cuenta tú solo (14 días),
// y D4: la privacidad en un minuto.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, contexto, BASE } from './fixtures-app.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── el ZIP ──')
{
  const M = await import(`${REPO}/js/mis-datos.js`)
  check('CRC32 de «123456789» = cbf43926', M.crc32(new TextEncoder().encode('123456789')).toString(16) === 'cbf43926')
  const bytes = M.zip([{ nombre: 'LEEME.txt', texto: 'hola ñandú' }, { nombre: 'coleccion.csv', texto: M.aCsv([{ a: 1, b: 'x,y' }, { a: 2, c: { z: 1 } }]) }])
  const d = mkdtempSync(join(tmpdir(), 'zip-'))
  writeFileSync(join(d, 'a.zip'), bytes)
  const py = spawnSync('python3', ['-c', `import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print('|'.join(z.namelist()));print(z.read('LEEME.txt').decode());print(z.read('coleccion.csv').decode())`, join(d, 'a.zip')], { encoding: 'utf8' })
  check('un ZIP de verdad (lo abre zipfile, CRC bien, nombres y UTF-8)', py.status === 0 && py.stdout.startsWith('LEEME.txt|coleccion.csv\nhola ñandú\n'), py.stderr || py.stdout)
  check('el CSV junta columnas y entrecomilla lo que hace falta', /^a,b,c\n1,"x,y",\n2,,"\{""z"":1\}"/.test(py.stdout.split('\n').slice(2).join('\n')), py.stdout)
}

console.log('── la migración, contra PostgreSQL ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1314'
const q = (s, rol = null, uid = '') => { const r = psql(['-At', '-d', BD, '-c', (rol ? `set prueba.uid = '${uid}'; set role ${rol}; ` : '') + s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const mig = readFileSync(`${REPO}/supabase-migration-1314-borrar-cuenta.sql`, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
if (psql(['-c', 'select 1']).status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const U = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  const r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    grant usage on schema public to anon, authenticated;
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
    grant usage on schema auth to anon, authenticated; grant execute on all functions in schema auth to anon, authenticated;
    create table auth.users (id uuid primary key, email text, encrypted_password text, phone text, raw_user_meta_data jsonb, banned_until timestamptz);
    create table auth.identities (id serial, user_id uuid); create table auth.sessions (id serial, user_id uuid);
    create table user_profiles (id uuid primary key references auth.users(id), username text, display_name text, avatar_url text, bio text, tipo text, hide_activity boolean default false);
    create table user_collection (id serial, user_id uuid references auth.users(id), card_id text);
    create table user_follows (follower_id uuid, following_id uuid);
    create table forum_posts (id serial, author_id uuid references user_profiles(id), body_html text);
    create table private_messages (id serial, sender_id uuid, body text, adjuntos jsonb, deleted_at timestamptz);
    create table account_deletion_requests (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) not null, reason text, status text not null default 'pending' check (status in ('pending', 'done', 'dismissed')), created_at timestamptz not null default now());
    alter table account_deletion_requests enable row level security;
    insert into auth.users values ('${U(1)}', 'misty@x.es', 'hash', '600', '{"name":"Misty"}', null), ('${U(2)}', 'brock@x.es', 'hash', null, '{}', null), ('${U(3)}', 'tienda@x.es', 'hash', null, '{}', null);
    insert into user_profiles values ('${U(1)}', 'misty', 'Misty', 'https://a/b.png', 'Agua', null), ('${U(2)}', 'brock', 'Brock', null, null, null), ('${U(3)}', 'la-tienda', 'La Tienda', null, null, 'tienda');
    insert into user_collection (user_id, card_id) values ('${U(1)}', 'a'), ('${U(1)}', 'b'), ('${U(2)}', 'c');
    insert into user_follows values ('${U(1)}', '${U(2)}'), ('${U(2)}', '${U(1)}');
    insert into forum_posts (author_id, body_html) values ('${U(1)}', '<p>hola</p>');
    insert into private_messages (sender_id, body, adjuntos) values ('${U(1)}', 'mi secreto', '[{"x":1}]'), ('${U(2)}', 'respuesta', '[]');
    insert into auth.identities (user_id) values ('${U(1)}'); insert into auth.sessions (user_id) values ('${U(1)}');`])
  check('el andamio carga', r.status === 0, r.stderr)
  const sentencias = mig.replace(/notify pgrst[^;]*;/g, '').split(/;\s*\n(?=(?:create|alter|do|grant|update|drop|insert|revoke|--|\s*$))/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let todas = true
  for (let v = 0; v < 2; v++) for (const st of sentencias) { const x = psql(['-d', BD, '-c', st.endsWith(';') ? st : st + ';']); if (x.status !== 0) { todas = false; console.log(st.slice(0, 100), x.stderr) } }
  check('la 1314 entra sentencia a sentencia y otra vez encima', todas, sentencias.length)
  const pedida = q(`select (cuenta_pedir_borrado('me voy') - now()) between interval '13 days 23 hours' and interval '14 days 1 hour'`, 'authenticated', U(1))
  check('pedirlo: se borrará en 14 días', pedida.out === 't', pedida.out + pedida.err)
  check('  …y se ve como pendiente', q(`select count(*) from cuenta_borrado_pendiente()`, 'authenticated', U(1)).out === '1')
  check('  …pedirlo otra vez no duplica', q(`select cuenta_pedir_borrado(null)`, 'authenticated', U(1)).ok && q(`select count(*) from account_deletion_requests where status = 'pending' and user_id = '${U(1)}'`).out === '1')
  check('cancelarlo', q(`select cuenta_cancelar_borrado()`, 'authenticated', U(1)).out === 't' && q(`select count(*) from cuenta_borrado_pendiente()`, 'authenticated', U(1)).out === '0')
  check('una tienda: sin fecha (lo revisa el equipo)', q(`select coalesce(cuenta_pedir_borrado(null)::text, 'sin fecha')`, 'authenticated', U(3)).out === 'sin fecha')
  check('nadie desde la web llama al borrado directo ni al cron', !q(`select cuenta_borrar('${U(2)}')`, 'authenticated', U(1)).ok && !q(`select cuentas_borrar_vencidas()`, 'authenticated', U(1)).ok)
  // Pedido de nuevo, y con la fecha ya pasada.
  q(`select cuenta_pedir_borrado(null)`, 'authenticated', U(1))
  q(`update account_deletion_requests set borrar_at = now() - interval '1 minute' where user_id = '${U(1)}' and status = 'pending'`)
  check('el cron borra la vencida (y no la tienda sin fecha)', q(`select cuentas_borrar_vencidas()`).out === '1' && q(`select count(*) from account_deletion_requests where user_id = '${U(3)}' and status = 'pending'`).out === '1')
  check('  …su colección y sus seguidos, fuera; la de Brock, intacta', q(`select count(*) filter (where user_id = '${U(1)}') || ':' || count(*) filter (where user_id = '${U(2)}') from user_collection`).out === '0:1' && q(`select count(*) from user_follows`).out === '0')
  check('  …sus mensajes, vacíos y marcados; los de Brock, igual', q(`select string_agg(sender_id::text || ':' || body || ':' || adjuntos::text || ':' || (deleted_at is not null), ',' order by id) from private_messages`).out === `${U(1)}::[]:true,${U(2)}:respuesta:[]:false`)
  check('  …el perfil, «Usuario borrado» sin foto ni bio y escondido', q(`select username || '|' || display_name || '|' || coalesce(avatar_url, '-') || '|' || coalesce(bio, '-') || '|' || hide_activity from user_profiles where id = '${U(1)}'`).out === `borrado-0000000000|Usuario borrado|-|-|true`)
  check('  …su tema del foro sigue (firmado por el perfil anónimo)', q(`select count(*) from forum_posts where author_id = '${U(1)}'`).out === '1')
  check('  …y no puede entrar: email inventado, sin contraseña, sin Google ni sesiones', q(`select email || '|' || coalesce(encrypted_password, '-') || '|' || coalesce(phone, '-') || '|' || raw_user_meta_data::text || '|' || (banned_until = 'infinity') from auth.users where id = '${U(1)}'`).out === 'borrado+00000000000000000000000000000001@pokedoc.invalid|-|-|{}|true' && q(`select count(*) from auth.identities`).out === '0' && q(`select count(*) from auth.sessions`).out === '0')
  check('  …y la solicitud, hecha', q(`select status from account_deletion_requests where user_id = '${U(1)}' order by created_at desc limit 1`).out === 'done')
  psql(['-c', `drop database if exists ${BD}`])
} else check('hay un PostgreSQL en /var/tmp:5433', false)

console.log('── en el navegador ──')
const b = await chromium.launch()
{
  const ctx = await contexto(b, false, 'user-1')
  await ctx.addInitScript(() => { window.__RPC_RESPUESTAS__ = { cuenta_borrado_pendiente: [], cuenta_pedir_borrado: new Date(Date.now() + 14 * 864e5).toISOString() } })
  const page = await ctx.newPage(); const err = []
  page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/ajustes.html?ver=datos`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#ajDescargar', { timeout: 8000 }).catch(() => {})
  const descarga = page.waitForEvent('download', { timeout: 15000 }).catch(() => null)
  await page.click('#ajDescargar')
  const d = await descarga
  check('«Descargar» baja un ZIP con tu nombre', d && /^pokedoc-.+-\d{4}-\d\d-\d\d\.zip$/.test(d.suggestedFilename()), d?.suggestedFilename())
  if (d) {
    const ruta = await d.path()
    const py = spawnSync('python3', ['-c', `import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print('|'.join(z.namelist()))`, ruta], { encoding: 'utf8' })
    check('  …con LEEME, cuenta y perfil (y lo que haya)', /^LEEME\.txt\|cuenta\.json\|perfil\.json/.test(py.stdout), py.stdout + py.stderr)
  }
  await page.goto(`${BASE}/ajustes.html?ver=borrar`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#ajBorrarSig', { timeout: 8000 }).catch(() => {})
  check('Borrar: paso 1, el motivo (opcional) y un enlace a descargar antes', await page.isVisible('#ajBorrarMotivo') && (await page.getAttribute('#ajBorrarCaja a[href="/ajustes?ver=datos"]', 'href')) !== null)
  await page.fill('#ajBorrarMotivo', 'ya no juego'); await page.click('#ajBorrarSig')
  check('  …paso 2, qué se borra, qué queda y los 14 días', /Esto se borra/.test(await page.textContent('#ajBorrarCaja')) && /14 días/.test(await page.textContent('#ajBorrarCaja')))
  await page.click('#ajBorrarSig')
  check('  …paso 3, el botón no se enciende sin tu usuario', await page.isDisabled('#ajBorrarYa'))
  const usuario = (await page.textContent('#ajBorrarCaja strong')).trim()
  await page.fill('#ajBorrarUsuario', usuario.toUpperCase())
  check('  …y con él (sin importar mayúsculas), sí', !(await page.isDisabled('#ajBorrarYa')), usuario)
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
{
  const ctx = await contexto(b, true, 'none')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/privacidad.html`, { waitUntil: 'domcontentloaded' })
  const t = await page.$$eval('.pv-tarjeta h3', (x) => x.map((h) => h.textContent))
  check('Privacidad: seis tarjetas arriba, antes del texto', t.join('|') === 'Qué guardamos|Para qué|Quién lo ve|Cuánto tiempo|Lo que nunca hacemos|Tus derechos', t.join('|'))
  check('  …con «Qué ha cambiado» y lo nuevo (tiendas, direcciones, borrado en 14 días)', (await page.isVisible('.pv-cambios summary')) && /14 días/.test(await page.textContent('main')) && /Bizum o PayPal/.test(await page.textContent('main')) && /tienda/.test(await page.textContent('main')))
  check('  …y sin «pestaña Acerca» (ya no existe)', !/pestaña "Acerca"/.test(await page.textContent('main')))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
