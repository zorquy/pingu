// Tandas 1304 y 1305 — seguridad de la noche del 13 de noviembre.
//  1304: la fecha de nacimiento deja de ser pública (tabla privada
//        `user_cumple`; en el perfil solo el mes y el día).
//  1305: lo que no es la web no se publica (función de borde), cabeceras de
//        seguridad, y los cubos viejos de fotos con tope de tamaño y tipo.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chromium, contexto, BASE } from './fixtures-app.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── 1304: lo puro de js/cumple.js, con un doble ──')
const { leerCumple, guardarCumple } = await import(`${REPO}/js/cumple.js`)
function doble({ sinTabla = false, fila = null } = {}) {
  const hecho = []
  const q = (tabla) => {
    const api = {
      select: () => api, eq: () => api,
      maybeSingle: async () => (sinTabla && tabla === 'user_cumple' ? { data: null, error: { code: '42P01' } } : { data: fila, error: null }),
      upsert: async (f, o) => { hecho.push(['upsert', tabla, f, o]); return { error: null } },
      update: (f) => { hecho.push(['update', tabla, f]); return { eq: async () => ({ error: null }) } },
      delete: () => ({ eq: async () => { hecho.push(['delete', tabla]); return { error: null } } }),
    }
    return api
  }
  return { sb: { from: q }, hecho }
}
{
  const d = doble({ fila: { birthday: '2010-03-04' } })
  const r = await leerCumple(d.sb, 'u1', { birthday: '1999-01-01' })
  check('con la migración, la fecha sale de la tabla privada (no del perfil)', r.privado && r.fecha === '2010-03-04', JSON.stringify(r))
  await guardarCumple(d.sb, 'u1', '2011-05-06', true)
  await guardarCumple(d.sb, 'u1', '', true)
  check('…guardar es un upsert por user_id y borrar es un delete; el perfil ni se toca', d.hecho[0][0] === 'upsert' && d.hecho[0][1] === 'user_cumple' && d.hecho[0][3]?.onConflict === 'user_id' && d.hecho[1][0] === 'delete' && !d.hecho.some((h) => h[1] === 'user_profiles'), JSON.stringify(d.hecho))
}
{
  const d = doble({ sinTabla: true })
  const r = await leerCumple(d.sb, 'u1', { birthday: '1999-01-01' })
  await guardarCumple(d.sb, 'u1', '2000-02-02', r.privado)
  check('sin la migración, el camino de antes (perfil) sin romper Ajustes', !r.privado && r.fecha === '1999-01-01' && d.hecho[0][0] === 'update' && d.hecho[0][1] === 'user_profiles', JSON.stringify([r, d.hecho]))
}
const js = ['js/ajustes.js', 'js/constructor/hoja-oficial.js', 'js/foro.js', 'netlify/edge-functions/meta-social.js'].map((f) => readFileSync(`${REPO}/${f}`, 'utf8')).join('\n')
check('la web ya no pide ni escribe `birthday` en user_profiles fuera del respaldo', !/user_profiles'\)\.update\(\{ birthday/.test(js) && !/\.update\(\{ birthday/.test(readFileSync(`${REPO}/js/ajustes.js`, 'utf8')))
check('Ajustes dice que el año no se enseña', /nunca el año/.test(readFileSync(`${REPO}/js/ajustes.js`, 'utf8')))

console.log('── 1304: la migración, contra PostgreSQL ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1304'
const q = (s, rol = null, uid = '') => { const pre = rol ? `set prueba.uid = '${uid}'; set role ${rol}; ` : ''; const r = psql(['-At', '-d', BD, '-c', pre + s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const mig = readFileSync(`${REPO}/supabase-migration-1304-cumple-privado.sql`, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const U = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  const r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    grant usage on schema public to anon, authenticated;
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
    create table user_profiles (id uuid primary key, username text, birthday date);
    alter table user_profiles add column birthday_md text generated always as (case when birthday is null then null else lpad(extract(month from birthday)::int::text, 2, '0') || '-' || lpad(extract(day from birthday)::int::text, 2, '0') end) stored;
    alter table user_profiles enable row level security;
    create policy user_profiles_public_read on user_profiles for select using (true);
    create policy user_profiles_own on user_profiles for update to authenticated using (id = auth.uid());
    grant select on user_profiles to anon, authenticated; grant update on user_profiles to authenticated;
    insert into user_profiles (id, username, birthday) values ('${U(1)}', 'ash', '2011-08-21'), ('${U(2)}', 'misty', null), ('${U(3)}', 'brock', '1990-12-01');`])
  check('el andamio (perfil con birthday público y birthday_md generada) carga', r.status === 0, r.stderr)
  check('antes: anon lee la fecha ENTERA con el año', q(`select birthday from user_profiles where username = 'ash'`, 'anon').out === '2011-08-21')
  const sentencias = mig.replace(/notify pgrst[^;]*;/g, '').split(/;\s*\n(?=(?:create|alter|do|grant|update|drop|insert|--|\s*$))/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let todas = true
  for (let v = 0; v < 2; v++) for (const st of sentencias) { const x = psql(['-d', BD, '-c', st.endsWith(';') ? st : st + ';']); if (x.status !== 0) { todas = false; console.log(x.stderr) } }
  check('la 1304 entra sentencia a sentencia, y otra vez encima', todas, sentencias.length)
  check('después: la columna `birthday` ya no existe en el perfil', !q(`select birthday from user_profiles limit 1`).ok)
  check('…el mes y el día siguen públicos para el foro', q(`select string_agg(username || ':' || coalesce(birthday_md, '-'), ',' order by username) from user_profiles`, 'anon').out === 'ash:08-21,brock:12-01,misty:-')
  check('…las fechas se mudaron a user_cumple', q(`select count(*) from user_cumple`).out === '2')
  check('…anon no lee user_cumple', !q(`select * from user_cumple`, 'anon').ok || q(`select count(*) from user_cumple`, 'anon').out === '0')
  check('…otra persona tampoco (cero filas)', q(`select count(*) from user_cumple`, 'authenticated', U(2)).out === '0')
  check('…su dueño sí, con el año', q(`select birthday from user_cumple`, 'authenticated', U(1)).out === '2011-08-21')
  check('poner tu cumpleaños pone el mes y día en el perfil (disparador)', q(`insert into user_cumple (user_id, birthday) values ('${U(2)}', '2005-02-03')`, 'authenticated', U(2)).ok && q(`select birthday_md from user_profiles where id = '${U(2)}'`).out === '02-03')
  check('…cambiarlo lo cambia', q(`update user_cumple set birthday = '2005-06-07' where user_id = '${U(2)}'`, 'authenticated', U(2)).ok && q(`select birthday_md from user_profiles where id = '${U(2)}'`).out === '06-07')
  check('…quitarlo lo quita', q(`delete from user_cumple where user_id = '${U(2)}'`, 'authenticated', U(2)).ok && q(`select coalesce(birthday_md, 'null') from user_profiles where id = '${U(2)}'`).out === 'null')
  check('nadie pone el cumpleaños de otro', !q(`insert into user_cumple (user_id, birthday) values ('${U(3)}', '2000-01-01')`, 'authenticated', U(2)).ok)
  psql(['-c', `drop database if exists ${BD}`])
}

console.log('── 1305: lo interno no se publica, cabeceras y cubos ──')
const internos = await import(`${REPO}/netlify/edge-functions/internos.js`)
// Netlify casa el `path` de una función de borde con URLPattern; Node 22 no
// lo trae, Chromium sí: se mira allí.
const nav = await chromium.launch(); const pg0 = await nav.newPage()
const TAPAR = ['/SCHEMA.md', '/CLAUDE.md', '/BITACORA.md', '/supabase-migration-1304-cumple-privado.sql', '/netlify/functions/tarjeta.mjs', '/herramientas/copia-seguridad.sh', '/package.json', '/netlify.toml']
const DEJAR = ['/', '/index.html', '/js/supabase.js', '/js/app.js', '/css/style.css', '/foro', '/manifest.webmanifest', '/novedades.json', '/assets/app-icon-192.png', '/descargas/pokedoc-para-tiendas.pdf', '/sw.js', '/admin/', '/tiendas/ash']
const casan = await pg0.evaluate(({ rutas, pats }) => rutas.map((r) => pats.some((p) => new URLPattern({ pathname: p }).test({ pathname: r }))), { rutas: [...TAPAR, ...DEJAR], pats: internos.config.path })
await nav.close()
check('se tapan SCHEMA.md, CLAUDE.md, BITACORA.md, las migraciones, el código del servidor y herramientas', casan.slice(0, TAPAR.length).every(Boolean), TAPAR.filter((_, i) => !casan[i]).join(','))
check('…y nada de la web', !casan.slice(TAPAR.length).some(Boolean), DEJAR.filter((_, i) => casan[TAPAR.length + i]).join(','))
const toml = readFileSync(`${REPO}/netlify.toml`, 'utf8')
check('las cuatro cabeceras de seguridad para toda la web', /for = "\/\*"[\s\S]*X-Frame-Options = "SAMEORIGIN"[\s\S]*X-Content-Type-Options = "nosniff"[\s\S]*Referrer-Policy = "strict-origin-when-cross-origin"[\s\S]*Permissions-Policy = "camera=\(self\)/.test(toml))
const m5 = readFileSync(`${REPO}/supabase-migration-1305-cubos-limites.sql`, 'utf8')
check('los cubos avatars y guide-images con 5 MB y solo fotos (sin SVG)', /5242880/.test(m5) && /'avatars', 'guide-images'/.test(m5) && !/svg/i.test(m5.replace(/--[^\n]*/g, '')))
const app = readFileSync(`${REPO}/js/app.js`, 'utf8')
check('la web rechaza un SVG antes de subirlo', /TIPOS_DE_FOTO = \[[^\]]*\]/.test(app) && !/svg/.test(app.match(/TIPOS_DE_FOTO = \[[^\]]*\]/)[0]))

console.log('── 1304: Ajustes en el navegador ──')
const b = await chromium.launch()
for (const sin of [false, true]) {
  const ctx = await contexto(b, false, 'user-1', sin ? () => { window.__SIN_TABLAS__ = ['user_cumple'] } : () => { window.__FAKE_CUMPLE__ = 1 })
  const page = await ctx.newPage()
  const err = []
  page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/ajustes.html?ver=cuenta`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelector('#ajCumple') && !document.querySelector('#ajCumple').disabled, null, { timeout: 10000 }).catch(() => {})
  await page.fill('#ajCumple', '2009-04-05')
  await page.dispatchEvent('#ajCumple', 'change')
  await page.waitForTimeout(800)
  const t = await page.evaluate(() => ({ cumple: window.__TABLAS__.user_cumple, perfil: window.__TABLAS__.user_profiles.find((p) => p.id === 'user-1')?.birthday }))
  if (!sin) check('con la migración: va a user_cumple y no al perfil', t.cumple?.[0]?.birthday === '2009-04-05' && !t.perfil && !err.length, JSON.stringify(t) + err.join(' | '))
  else check('sin la migración: al perfil, como antes, sin errores', t.perfil === '2009-04-05' && !err.length, JSON.stringify(t) + err.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
