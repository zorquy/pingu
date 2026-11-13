// Tanda 1306 — el perfil público, solo con lo que se enseña (S3 del plan).
//  · `email_unsubscribe_token`, `saved_guides` y `referred_by` se mudan a
//    `user_privado` (solo su dueño); lo de otros, por funciones.
//  · `latido_en_linea` no apunta quién eres si escondes tu actividad.
//  · Gente no cuenta ni nombra «Hoy por aquí» a quien la esconde.
//  · Ajustes › Privacidad: «Ver mi perfil como un desconocido» (la página sin
//    tu sesión, de verdad).
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chromium, contexto, BASE } from './fixtures-app.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── lo puro de js/perfil-privado.js, con un doble ──')
const P = await import(`${REPO}/js/perfil-privado.js`)
function doble({ privado = undefined, perfil = null, perfilError = null, rpc = {} } = {}) {
  const hecho = []
  const from = (tabla) => {
    const api = {
      select: () => api, eq: () => api, order: () => api, limit: () => api, is: () => api,
      maybeSingle: async () => {
        if (tabla === 'user_privado') return privado === 'sin-tabla' ? { data: null, error: { code: '42P01' } } : { data: privado || null, error: null }
        return perfilError ? { data: null, error: perfilError } : { data: perfil, error: null }
      },
      update: (f) => { hecho.push(['update', tabla, f]); return { eq: () => ({ then: (r) => r({ error: null }), is: async () => ({ error: null }) }) } },
    }
    return api
  }
  return { sb: { from, rpc: async (n) => rpc[n] || { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } } }, hecho }
}
{
  const d = doble({ privado: { saved_guides: ['g1'], referred_by: 'u9' } })
  const r = await P.leerPrivado(d.sb, 'u1')
  check('con su fila privada, lee de user_privado', r.privado && r.saved_guides[0] === 'g1' && r.referred_by === 'u9', JSON.stringify(r))
  await P.cambiarGuardada(d.sb, 'u1', 'g2', true)
  check('…y escribe allí (con los dos guardados)', d.hecho[0][1] === 'user_privado' && d.hecho[0][2].saved_guides.join() === 'g1,g2', JSON.stringify(d.hecho))
}
{
  const d = doble({ privado: 'sin-tabla', perfil: { saved_guides: ['g7'], referred_by: null } })
  const r = await P.leerPrivado(d.sb, 'u1')
  check('sin la migración, del perfil como antes', !r.privado && r.saved_guides[0] === 'g7' && !r.error, JSON.stringify(r))
  await P.cambiarGuardada(d.sb, 'u1', 'g7', false)
  check('…y escribe en el perfil', d.hecho[0][1] === 'user_profiles' && d.hecho[0][2].saved_guides.length === 0, JSON.stringify(d.hecho))
}
{
  const d = doble({ privado: null, perfilError: { code: '42703', message: 'column saved_guides does not exist' } })
  const r = await P.leerPrivado(d.sb, 'u1')
  check('con la migración y sin fila: nada, sin error (no «no se ha podido»)', !r.error && r.saved_guides.length === 0, JSON.stringify(r))
}
{
  const d = doble({ privado: 'sin-tabla', perfilError: { code: 'XX', message: 'red caída' } })
  check('si no contesta nadie, es un error', !!(await P.leerPrivado(d.sb, 'u1')).error)
}
{
  const d = doble({ rpc: { mis_invitados: { data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], error: null } } })
  const r = await P.misInvitados(d.sb, 'u1', { limite: 2 })
  check('mis_invitados: el total y las caras con su tope', r.total === 3 && r.lista.length === 2, JSON.stringify(r))
  const d2 = doble({ rpc: { poner_padrino: { data: true, error: null } } })
  check('poner_padrino por su función', (await P.ponerPadrino(d2.sb, 'u1', 'u2')) === true && !d2.hecho.length)
  const d3 = doble()
  check('…sin la migración, el update de antes', (await P.ponerPadrino(d3.sb, 'u1', 'u2')) === true && d3.hecho[0][1] === 'user_profiles' && d3.hecho[0][2].referred_by === 'u2', JSON.stringify(d3.hecho))
}

console.log('── nadie lee esas columnas del perfil por otro camino ──')
{
  // Lo que lee o escribe esas columnas en el perfil desde el navegador, fuera
  // del módulo (que es el único que sabe caer al perfil sin la migración).
  const r = spawnSync('grep', ['-rnE', "user_profiles.*(saved_guides|referred_by)|(saved_guides|referred_by).*user_profiles|\\.eq\\('referred_by'", `${REPO}/js`, `${REPO}/admin/js`, '--include=*.js'], { encoding: 'utf8' })
  const malas = r.stdout.split('\n').filter(Boolean).filter((l) => !/js\/perfil-privado\.js/.test(l) && !/^[^:]+:\d+:\s*\/\//.test(l))
  check('fuera de perfil-privado.js nadie pide esas columnas al perfil', !malas.length, malas.join(' | '))
  const gam = readFileSync(`${REPO}/js/gamification.js`, 'utf8')
  check('los logros ya no piden referred_by al perfil (con la migración, la consulta entera fallaría)', !/select\('total_xp, achievements, quiz_correct_count, referred_by'\)/.test(gam))
}

console.log('── la migración, contra PostgreSQL ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1306'
const q = (s, rol = null, uid = '') => { const pre = rol ? `set prueba.uid = '${uid}'; set role ${rol}; ` : ''; const r = psql(['-At', '-d', BD, '-c', pre + s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const mig = readFileSync(`${REPO}/supabase-migration-1306-perfil-privado.sql`, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const U = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  const G = (n) => `10000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  const T = (n) => `20000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  const r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    grant usage on schema public to anon, authenticated;
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
    create table auth.users (id uuid primary key);
    create table user_profiles (id uuid primary key, username text, display_name text, avatar_url text, created_at timestamptz default now(), hide_activity boolean default false,
      saved_guides uuid[] default '{}', referred_by uuid references auth.users(id) on delete set null,
      email_unsubscribe_token uuid not null default gen_random_uuid(), notification_email_disabled text[] not null default '{}');
    create index user_profiles_referred_by on user_profiles (referred_by) where referred_by is not null;
    alter table user_profiles enable row level security;
    create policy user_profiles_public_read on user_profiles for select using (true);
    create policy user_profiles_own on user_profiles for update to authenticated using (id = auth.uid());
    grant select on user_profiles to anon, authenticated; grant update on user_profiles to authenticated;
    create or replace function is_admin() returns boolean language sql stable as $f$ select false $f$;
    create table guides (id uuid primary key, slug text, title text, published_at timestamptz, created_at timestamptz default now(), view_count int, author_id uuid);
    create table user_progress (user_id uuid, guide_id uuid, read_at timestamptz);
    create table guide_comments (id serial, guide_id uuid); create table guide_helpful (id serial, guide_id uuid); create table guide_reviews (id serial, guide_id uuid, rating int);
    create table forum_threads (id uuid primary key);
    create table online_now (token text primary key, user_id uuid references auth.users(id) on delete cascade, thread_id uuid, last_seen timestamptz not null default now());
    alter table online_now enable row level security; create policy online_now_select on online_now for select using (true);
    grant select on online_now to anon, authenticated;
    insert into auth.users values ('${U(1)}'), ('${U(2)}'), ('${U(3)}');
    insert into user_profiles (id, username, hide_activity, saved_guides, referred_by, email_unsubscribe_token) values
      ('${U(1)}', 'ash', false, array['${G(1)}','${G(2)}']::uuid[], null, '${T(1)}'),
      ('${U(2)}', 'misty', true, '{}', '${U(1)}', '${T(2)}'),
      ('${U(3)}', 'brock', false, array['${G(1)}']::uuid[], '${U(1)}', '${T(3)}');
    insert into guides (id, slug, title, author_id) values ('${G(1)}', 'g1', 'Guía 1', '${U(1)}');
    insert into forum_threads values ('${G(9)}');
    insert into online_now (token, user_id, thread_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '${U(2)}', '${G(9)}');`])
  check('el andamio (perfil con las tres columnas a la vista) carga', r.status === 0, r.stderr)
  check('antes: cualquiera sin cuenta lee el token de baja de los demás', q(`select email_unsubscribe_token from user_profiles where username = 'misty'`, 'anon').out === T(2))
  const sentencias = mig.replace(/notify pgrst[^;]*;/g, '').split(/;\s*\n(?=(?:create|alter|do|grant|update|drop|insert|--|\s*$))/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let todas = true
  for (let v = 0; v < 2; v++) for (const st of sentencias) { const x = psql(['-d', BD, '-c', st.endsWith(';') ? st : st + ';']); if (x.status !== 0) { todas = false; console.log(st.slice(0, 120), x.stderr) } }
  check('la 1306 entra sentencia a sentencia, cada una en su conexión, y otra vez encima', todas, sentencias.length)
  check('después: el perfil ya no tiene ninguna de las tres', ['email_unsubscribe_token', 'saved_guides', 'referred_by'].every((c) => !q(`select ${c} from user_profiles limit 1`).ok))
  check('…y select * del perfil sigue funcionando sin cuenta', q(`select count(*) from (select * from user_profiles) x`, 'anon').out === '3')
  check('lo de antes, en user_privado, con sus tokens', q(`select string_agg(email_unsubscribe_token::text, ',' order by user_id) from user_privado`).out === [T(1), T(2), T(3)].join(','))
  check('…los guardados y los padrinos, intactos', q(`select array_length(saved_guides, 1) || ':' || coalesce(referred_by::text, '-') from user_privado where user_id = '${U(1)}'`).out === '2:-' && q(`select referred_by from user_privado where user_id = '${U(3)}'`).out === U(1))
  check('anon no lee user_privado', !q(`select * from user_privado`, 'anon').ok)
  check('otra persona: cero filas', q(`select count(*) from user_privado`, 'authenticated', U(2)).out === '1' && q(`select user_id from user_privado`, 'authenticated', U(2)).out === U(2))
  check('tu fila: guardar guías sí', q(`update user_privado set saved_guides = '{}' where user_id = '${U(1)}'`, 'authenticated', U(1)).ok && q(`select array_length(saved_guides,1) from user_privado where user_id = '${U(1)}'`).out === '')
  check('…cambiarte el token o el padrino, no', !q(`update user_privado set email_unsubscribe_token = gen_random_uuid() where user_id = '${U(1)}'`, 'authenticated', U(1)).ok && !q(`update user_privado set referred_by = '${U(3)}' where user_id = '${U(1)}'`, 'authenticated', U(1)).ok)
  check('…ni tocar la fila de otro (cero filas cambiadas)', q(`with c as (update user_privado set saved_guides = '{}' where user_id = '${U(3)}' returning 1) select count(*) from c`, 'authenticated', U(1)).out === '0')
  check('un perfil nuevo nace con su fila privada y su token', q(`insert into user_profiles (id, username) values ('${U(4)}', 'dawn')`).ok && /^[0-9a-f-]{36}$/.test(q(`select email_unsubscribe_token from user_privado where user_id = '${U(4)}'`).out))
  check('mis_invitados: los dos que trajo ash, con lo público', q(`select string_agg(username, ',' order by username) from mis_invitados()`, 'authenticated', U(1)).out === 'brock,misty')
  check('…y a misty no le salen los de nadie', q(`select count(*) from mis_invitados()`, 'authenticated', U(2)).out === '0')
  check('…anon no puede llamarla', !q(`select * from mis_invitados()`, 'anon').ok)
  check('poner_padrino: una vez', q(`select poner_padrino('${U(3)}')`, 'authenticated', U(4)).out === 't' && q(`select poner_padrino('${U(1)}')`, 'authenticated', U(4)).out === 'f' && q(`select referred_by from user_privado where user_id = '${U(4)}'`).out === U(3))
  check('…nunca a uno mismo', q(`select poner_padrino('${U(1)}')`, 'authenticated', U(1)).out === 'f')
  check('las cifras del autor cuentan los guardados de user_privado', q(`select guardados from guide_author_stats('${U(1)}')`, 'authenticated', U(1)).out === '1')
  check('lo que ya estaba en línea de quien se esconde, sin nombre ni tema', q(`select coalesce(user_id::text,'-') || ':' || coalesce(thread_id::text,'-') from online_now`, 'anon').out === '-:-')
  q(`select latido_en_linea('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '${G(9)}')`, 'authenticated', U(2))
  q(`select latido_en_linea('cccccccc-cccc-cccc-cccc-cccccccccccc', '${G(9)}')`, 'authenticated', U(1))
  check('latido de quien se esconde: cuenta, sin nombre ni tema', q(`select coalesce(user_id::text,'-') || ':' || coalesce(thread_id::text,'-') from online_now where token like 'b%'`).out === '-:-')
  check('…el de quien no, con nombre y tema', q(`select user_id || ':' || thread_id from online_now where token like 'c%'`).out === `${U(1)}:${G(9)}`)
  q(`update user_profiles set hide_activity = true where id = '${U(1)}'`)
  q(`select latido_en_linea('cccccccc-cccc-cccc-cccc-cccccccccccc', null)`, 'authenticated', U(1))
  check('…y si se esconde a mitad, su pestaña deja de llevar su nombre', q(`select coalesce(user_id::text,'-') from online_now where token like 'c%'`).out === '-')
  psql(['-c', `drop database if exists ${BD}`])
}

console.log('── el servidor busca el token en su sitio nuevo ──')
{
  const s = readFileSync(`${REPO}/netlify/functions/send-emails.mjs`, 'utf8')
  const b = readFileSync(`${REPO}/netlify/functions/baja-correo.mjs`, 'utf8')
  check('send-emails: user_privado primero y el perfil de respaldo', /user_privado\?user_id=eq\.\$\{userId\}&select=email_unsubscribe_token/.test(s) && /user_profiles\?id=eq\.\$\{userId\}&select=email_unsubscribe_token/.test(s))
  check('baja-correo: igual', /user_privado\?email_unsubscribe_token=eq\./.test(b) && /user_profiles\?email_unsubscribe_token=eq\./.test(b))
}

console.log('── en el navegador ──')
const b = await chromium.launch()
{
  // Guardados con la fila privada: lee de ahí y escribe ahí; el perfil ni se toca.
  const ctx = await contexto(b, false, 'user-1', () => { window.__FAKE_FILAS__ = { user_privado: [{ user_id: 'user-1', saved_guides: [], referred_by: null }] }; window.__FAKE_SUSCRIPCIONES__ = [] })
  const page = await ctx.newPage(); const err = []
  page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/guardados`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#gdParaEmpezar [data-guardar]', { timeout: 10000 }).catch(() => {})
  const antes = await page.evaluate(() => JSON.stringify(window.__TABLAS__.user_profiles.find((p) => p.id === 'user-1')?.saved_guides ?? null))
  const id = await page.getAttribute('#gdParaEmpezar [data-guardar]', 'data-guardar')
  await page.click('#gdParaEmpezar [data-guardar]')
  await page.waitForTimeout(800)
  const t = await page.evaluate(() => ({ privado: window.__TABLAS__.user_privado.find((f) => f.user_id === 'user-1')?.saved_guides, perfil: JSON.stringify(window.__TABLAS__.user_profiles.find((p) => p.id === 'user-1')?.saved_guides ?? null) }))
  check('con la fila privada: guardar va a user_privado y el perfil no cambia', (t.privado || []).includes(id) && t.perfil === antes && !err.length, JSON.stringify(t) + err.join(' | '))
  await ctx.close()
}
{
  const ctx = await contexto(b, false, 'user-1')
  const page = await ctx.newPage(); const err = []
  page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/ajustes.html?ver=privacidad`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-ver-desconocido]', { timeout: 10000 }).catch(() => {})
  const href = await page.getAttribute('[data-ver-desconocido]', 'href').catch(() => null)
  check('Ajustes › Privacidad: «Ver mi perfil como un desconocido» a tu perfil', /^\/(usuario|tiendas)\/[^?]+\?como=desconocido$/.test(href || ''), href)
  check('…y dice qué no ve nadie', /Nunca tu cumpleaños con el año, tus guardados, quién te invitó/.test(await page.textContent('#ajPanel, main').catch(() => '')))
  if (href) {
    await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#comoDesconocido', { timeout: 8000 }).catch(() => {})
    const m = await page.evaluate(async () => {
      const { supabase } = await import('/js/supabase.js')
      return { franja: document.getElementById('comoDesconocido')?.textContent || '', sesion: !!(await supabase.auth.getSession()).data.session, volver: document.querySelector('#comoDesconocido a')?.getAttribute('href') }
    })
    check('la página va SIN tu sesión, con la franja que lo dice', /sin cuenta/.test(m.franja) && !m.sesion && !/como=/.test(m.volver || 'como='), JSON.stringify(m))
    check('…sin errores', !err.length, err.join(' | '))
  }
  await ctx.close()
}
{
  const usu = readFileSync(`${REPO}/js/usuarios.js`, 'utf8')
  check('Gente: «Hoy por aquí» no sale de quien esconde su actividad', /p\.last_active_date === hoy && !p\.hide_activity\) return 'Hoy por aquí'/.test(usu) && /\.or\('hide_activity\.is\.null,hide_activity\.eq\.false'\)/.test(usu))
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
