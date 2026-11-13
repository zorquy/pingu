// Tanda 1307 — doble factor para el equipo (S6) y sesiones abiertas (S12).
//  · `is_admin()` = lo de antes (copiado tal cual a `is_admin_base()`) Y la
//    sesión ha pasado el código si esa persona tiene el doble factor puesto.
//  · `mis_sesiones()` y `cerrar_sesion()`; «Cerrar las demás» por Supabase.
//  · La web: Ajustes › Seguridad, el código al entrar con contraseña y la
//    puerta de /admin.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chromium, contexto, BASE } from './fixtures-app.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── lo puro de js/doble-factor.js ──')
const D = await import(`${REPO}/js/doble-factor.js`)
check('limpiarCodigo deja seis cifras', D.limpiarCodigo('12 34-56 7') === '123456')
check('falta el código: con factor y en aal1', D.faltaCodigo({ factores: [{ id: 'f' }], actual: 'aal1' }) && !D.faltaCodigo({ factores: [{ id: 'f' }], actual: 'aal2' }) && !D.faltaCodigo({ factores: [], actual: 'aal1' }))
check('el error de un código malo, en cristiano', /no vale/.test(D.textoDeError({ message: 'Invalid TOTP code entered' })))
check('nombre de un navegador', D.nombreDeNavegador('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1') === 'iPhone · Safari' && D.nombreDeNavegador('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36') === 'Windows · Chrome' && D.nombreDeNavegador('') === 'Un navegador')
check('sin `mfa` en el cliente, nada puesto (no rompe)', (await D.estadoMfa({ auth: {} })).factores.length === 0)

console.log('── la migración, contra PostgreSQL ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1307'
// La sesión: quién (`prueba.uid`), su nivel (`prueba.aal`) y su id (`prueba.sid`).
const q = (s, rol = null, uid = '', aal = 'aal1', sid = '') => { const pre = rol ? `set prueba.uid = '${uid}'; set prueba.aal = '${aal}'; set prueba.sid = '${sid}'; set role ${rol}; ` : ''; const r = psql(['-At', '-d', BD, '-c', pre + s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const mig = readFileSync(`${REPO}/supabase-migration-1307-doble-factor.sql`, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const U = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  const S = (n) => `30000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  // is_admin «de antes» escrito como en producción (plpgsql y con su search_path):
  // la migración lo copia sin saber cómo es por dentro.
  const r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    grant usage on schema public to anon, authenticated;
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
    create or replace function auth.jwt() returns jsonb language sql stable as $f$ select jsonb_build_object('aal', coalesce(nullif(current_setting('prueba.aal', true), ''), 'aal1'), 'session_id', nullif(current_setting('prueba.sid', true), '')) $f$;
    grant usage on schema auth to anon, authenticated; grant execute on all functions in schema auth to anon, authenticated;
    create type auth.factor_status as enum ('unverified', 'verified');
    create type auth.aal_level as enum ('aal1', 'aal2', 'aal3');
    create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid, status auth.factor_status);
    create table auth.sessions (id uuid primary key, user_id uuid, created_at timestamptz default now(), updated_at timestamptz default now(), refreshed_at timestamp, user_agent text, aal auth.aal_level, not_after timestamptz);
    create table user_profiles (id uuid primary key, username text, is_admin boolean default false);
    create or replace function public.is_admin() returns boolean language plpgsql stable security definer set search_path = public as $f$
      begin return exists (select 1 from user_profiles where id = auth.uid() and is_admin); end $f$;
    grant execute on function public.is_admin() to anon, authenticated;
    create table secreto (id int); alter table secreto enable row level security;
    create policy solo_admin on secreto for select using (public.is_admin()); grant select on secreto to authenticated; insert into secreto values (1);
    insert into user_profiles values ('${U(1)}', 'pingu', true), ('${U(2)}', 'ibai', true), ('${U(3)}', 'ash', false);
    insert into auth.mfa_factors (user_id, status) values ('${U(1)}', 'verified'), ('${U(2)}', 'unverified');
    insert into auth.sessions (id, user_id, user_agent, aal) values ('${S(1)}', '${U(1)}', 'iPhone Safari', 'aal2'), ('${S(2)}', '${U(1)}', 'Windows Chrome', 'aal1'), ('${S(3)}', '${U(3)}', 'Android', 'aal1');`])
  check('el andamio carga', r.status === 0, r.stderr)
  check('antes: pingu ve lo del admin sin el código', q(`select count(*) from secreto`, 'authenticated', U(1), 'aal1').out === '1')
  const sentencias = mig.replace(/notify pgrst[^;]*;/g, '').split(/;\s*\n(?=(?:create|alter|do|grant|update|drop|insert|--|\s*$))/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let todas = true
  for (let v = 0; v < 2; v++) for (const st of sentencias) { const x = psql(['-d', BD, '-c', st.endsWith(';') ? st : st + ';']); if (x.status !== 0) { todas = false; console.log(st.slice(0, 100), x.stderr) } }
  check('la 1307 entra sentencia a sentencia y otra vez encima', todas, sentencias.length)
  check('is_admin_base es la de antes, copiada tal cual', /exists \(select 1 from user_profiles where id = auth\.uid\(\) and is_admin\)/.test(q(`select pg_get_functiondef('public.is_admin_base()'::regprocedure)`).out))
  check('pingu (con doble factor) SIN el código: ya no es admin para la base', q(`select count(*) from secreto`, 'authenticated', U(1), 'aal1').out === '0' && q(`select public.is_admin()`, 'authenticated', U(1), 'aal1').out === 'f')
  check('…CON el código, sí', q(`select count(*) from secreto`, 'authenticated', U(1), 'aal2').out === '1')
  check('ibai (factor a medio dar de alta) sigue como antes', q(`select public.is_admin()`, 'authenticated', U(2), 'aal1').out === 't')
  check('ash no es admin con ni sin código', q(`select public.is_admin()`, 'authenticated', U(3), 'aal2').out === 'f')
  check('la política de siempre (por el nombre) usa la función nueva', q(`select count(*) from secreto`, 'authenticated', U(1), 'aal1').out === '0')
  const ms = q(`select string_agg(navegador || ':' || esta || ':' || con_codigo, ',' order by navegador) from mis_sesiones()`, 'authenticated', U(1), 'aal2', S(1)); check('mis_sesiones: las mías, con la de ahora marcada y sin IP', ms.out.split(',').sort().join() === 'Windows Chrome:false:false,iPhone Safari:true:true', ms.out + ms.err)
  check('…ni una de otro', q(`select count(*) from mis_sesiones()`, 'authenticated', U(3), 'aal1', S(3)).out === '1')
  check('cerrar_sesion: la de ahora no', q(`select cerrar_sesion('${S(1)}')`, 'authenticated', U(1), 'aal2', S(1)).out === 'f')
  check('…la de otro no', q(`select cerrar_sesion('${S(3)}')`, 'authenticated', U(1), 'aal2', S(1)).out === 'f' && q(`select count(*) from auth.sessions where id = '${S(3)}'`).out === '1')
  check('…otra tuya sí', q(`select cerrar_sesion('${S(2)}')`, 'authenticated', U(1), 'aal2', S(1)).out === 't' && q(`select count(*) from auth.sessions where id = '${S(2)}'`).out === '0')
  check('anon no ve sesiones', !q(`select * from mis_sesiones()`, 'anon').ok)
  psql(['-c', `drop database if exists ${BD}`])
}

console.log('── en el navegador ──')
const b = await chromium.launch()
const abrir = async (ruta, mfa, quien = 'user-1') => {
  const ctx = await contexto(b, false, quien, mfa ? new Function(`window.__FAKE_MFA__ = ${JSON.stringify(mfa)}`) : undefined)
  const page = await ctx.newPage(); const err = []
  page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  return { ctx, page, err }
}
{
  const { ctx, page, err } = await abrir('/ajustes.html?ver=seguridad', { factores: [], nivel: 'aal1', codigo: '123456' })
  await page.waitForSelector('[data-df-activar]', { timeout: 10000 }).catch(() => {})
  check('Ajustes › Seguridad sin doble factor: «Activar»', await page.isVisible('[data-df-activar]'))
  await page.click('[data-df-activar]')
  await page.waitForSelector('#ajDfCodigo', { timeout: 5000 }).catch(() => {})
  check('…enseña el QR y la clave', await page.isVisible('.aj-seg-qr') && /JBSWY3DPEHPK3PXP/.test(await page.textContent('.aj-seg-clave')))
  await page.fill('#ajDfCodigo', '000000'); await page.click('[data-df-confirmar]'); await page.waitForTimeout(400)
  check('…un código malo lo dice', /no vale/.test(await page.textContent('.aj-seg-error')))
  await page.fill('#ajDfCodigo', '123456'); await page.click('[data-df-confirmar]')
  await page.waitForSelector('[data-df-quitar]', { timeout: 5000 }).catch(() => {})
  check('…el bueno lo activa', await page.isVisible('[data-df-quitar]'))
  check('sin la migración, «Cerrar todas menos esta» y el aviso de la lista', await page.isVisible('[data-cerrar-otras]'))
  await page.click('[data-cerrar-otras]'); await page.waitForTimeout(400)
  check('…que cierra las demás con Supabase', (await page.evaluate(() => window.__AUTH__ || [])).some((a) => a.que === 'signOut' && a.scope === 'others'))
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, err } = await abrir('/ajustes.html?ver=seguridad', null)
  await page.addInitScript(() => { window.__RPC_RESPUESTAS__ = { mis_sesiones: [{ id: 's1', navegador: 'Mozilla/5.0 (iPhone) Safari/604', creada: new Date().toISOString(), ultima: new Date().toISOString(), esta: true }, { id: 's2', navegador: 'Windows NT 10.0 Chrome/120', creada: '2026-10-01T10:00:00Z', ultima: '2026-11-10T10:00:00Z', esta: false }], cerrar_sesion: true } })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.aj-seg-sesion', { timeout: 10000 }).catch(() => {})
  const filas = await page.$$eval('.aj-seg-sesion', (xs) => xs.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
  check('con la migración, la lista: «Esta» sin botón y la otra con «Cerrar»', filas.length === 2 && /iPhone · Safari Esta/.test(filas[0]) && /Windows · Chrome/.test(filas[1]) && (await page.$$('[data-cerrar-sesion]')).length === 1, JSON.stringify(filas))
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
{
  // Entrar con contraseña y doble factor: pide el código antes de seguir.
  const { ctx, page, err } = await abrir('/auth.html', { factores: [{ id: 'f1', status: 'verified' }], nivel: 'aal1', codigo: '123456' }, 'none')
  await page.addInitScript(() => { window.__FAKE_AUTH__ = { signInWithPassword: { data: { user: { id: 'user-1' }, session: { user: { id: 'user-1' } } }, error: null } } })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#loginEmail, input[type=email]', { timeout: 8000 }).catch(() => {})
  const email = (await page.$('#loginEmail')) ? '#loginEmail' : 'input[type=email]'
  const clave = (await page.$('#loginPassword')) ? '#loginPassword' : 'input[type=password]'
  await page.fill(email, 'ash@pruebas.test'); await page.fill(clave, 'unaclavelarga')
  // Al pasar el código la página se va a la portada y `__AUTH__` se pierde:
  // lo apuntado se guarda también en sessionStorage, que sobrevive al salto.
  await page.evaluate(() => { const A = window.__AUTH__; const push = A.push.bind(A); A.push = (...x) => { const r = push(...x); try { sessionStorage.setItem('pd-auth-prueba', JSON.stringify(A)) } catch {} return r } })
  await page.click('#btnLogin')
  await page.waitForSelector('.df-dialogo', { timeout: 6000 }).catch(() => {})
  check('al entrar con contraseña y doble factor, pide el código', await page.isVisible('.df-dialogo'))
  await page.fill('#dfCodigo', '123456')
  await page.waitForTimeout(800)
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  const auth = await page.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('pd-auth-prueba') || '[]') } catch { return [] } })
  check('…y lo comprueba contra su factor', auth.some((a) => a.que === 'mfa.verify' && a.factorId === 'f1' && a.code === '123456'), JSON.stringify(auth.map((a) => a.que)))
  // La transición entre páginas que Chromium corta al navegar no es nuestra.
  const propios = err.filter((e) => !/Transition was aborted/.test(e))
  check('sin errores', !propios.length, propios.join(' | '))
  await ctx.close()
}
{
  const ad = readFileSync(`${REPO}/admin/js/admin.js`, 'utf8')
  check('/admin pasa por el código antes de abrir el panel', /asegurarCodigo\(/.test(ad))
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
