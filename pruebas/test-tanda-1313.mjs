// Tanda 1313 — S7 topes por persona en las funciones caras, S8 la analítica y
// los errores con freno (PostgreSQL), S9 la CSP en modo informe y S10 la
// copia diaria y probada.
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const leer = (f) => readFileSync(`${REPO}/${f}`, 'utf8')

console.log('── S7: topes por persona ──')
for (const [f, n] of [['tarjeta', 120], ['reto-foto', 120], ['leer-carta', 20], ['leer-lista', 20], ['cardmarket-buscar', 30], ['tcggo-historial', 30], ['tcggo-versiones-ahora', 30]]) {
  const s = leer(`netlify/functions/${f}.mjs`)
  check(`${f}: ${n} por minuto y por IP`, new RegExp(`export const config = \\{ rateLimit: \\{ windowLimit: ${n}, windowSize: 60, aggregateBy: \\['ip', 'domain'\\] \\} \\}`).test(s))
}

console.log('── S8: el freno de la analítica, contra PostgreSQL ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1313'
const q = (s, rol = null, uid = '') => { const r = psql(['-At', '-d', BD, '-c', (rol ? `set prueba.uid = '${uid}'; set role ${rol}; ` : '') + s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const mig = leer('supabase-migration-1313-telemetria-freno.sql')
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
    create table page_views (id uuid primary key default gen_random_uuid(), path text not null, user_id uuid, created_at timestamptz not null default now());
    alter table page_views enable row level security; create policy ins on page_views for insert with check (true); grant insert on page_views to anon, authenticated;
    create table client_errors (id uuid primary key default gen_random_uuid(), user_id uuid, message text not null, stack text, page_url text, user_agent text, status text not null default 'new', created_at timestamptz not null default now());
    alter table client_errors enable row level security; create policy ins on client_errors for insert with check (true); grant insert on client_errors to anon, authenticated;`])
  check('el andamio carga', r.status === 0, r.stderr)
  const sentencias = mig.split(/;\s*\n(?=(?:create|alter|do|grant|update|drop|insert|revoke|--|\s*$))/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let todas = true
  for (let v = 0; v < 2; v++) for (const st of sentencias) { const x = psql(['-d', BD, '-c', st.endsWith(';') ? st : st + ';']); if (x.status !== 0) { todas = false; console.log(st.slice(0, 100), x.stderr) } }
  check('la 1313 entra sentencia a sentencia y otra vez encima', todas, sentencias.length)
  q(`insert into page_views (path, user_id) values ('/', '${U(2)}')`, 'authenticated', U(1))
  q(`insert into page_views (path, user_id) values ('/foro', '${U(2)}')`, 'anon')
  check('nadie apunta una visita a nombre de otro (con cuenta, la suya; sin cuenta, ninguna)', q(`select string_agg(path || ':' || coalesce(user_id::text, '-'), ',' order by path) from page_views`).out === `/:${U(1)},/foro:-`)
  q(`insert into client_errors (message, stack, status) values (repeat('x', 5000), repeat('y', 9000), 'reviewed')`, 'anon')
  check('los textos largos se recortan (no se rechazan) y el estado es siempre «new»', q(`select length(message) || ':' || length(stack) || ':' || status from client_errors`).out === '600:4000:new')
  // El tope: 60 errores por minuto; del 61 en adelante se descartan sin error.
  const bucle = q(`do $$ begin for i in 1..80 loop insert into client_errors (message) values ('bucle ' || i); end loop; end $$`, 'anon')
  check('un bucle de 80 errores no da error…', bucle.ok, bucle.err)
  check('  …y solo entran 60 en el minuto (con el de antes)', q(`select count(*) from client_errors`).out === '60', q(`select count(*) from client_errors`).out)
  check('las visitas tienen su propio tope (300), y no lo gastan los errores', q(`select count(*) from page_views`).out === '2')
  check('el contador no se lee desde la web', !q(`select * from telemetria_ritmo`, 'anon').ok)
  psql(['-c', `drop database if exists ${BD}`])
} else check('hay un PostgreSQL en /var/tmp:5433', false)

console.log('── S9: la CSP, en informe ──')
{
  const toml = leer('netlify.toml')
  const csp = (toml.match(/Content-Security-Policy-Report-Only = "([^"]+)"/) || [])[1] || ''
  check('va en informe (no bloquea) y para toda la web', Boolean(csp) && !/^\s*Content-Security-Policy = /m.test(toml))
  check('  …con Supabase (también el vivo), Turnstile, YouTube y sin objetos', /zqamujmfavwrsqlgbead\.supabase\.co wss:\/\/zqamujmfavwrsqlgbead/.test(csp) && /challenges\.cloudflare\.com/.test(csp) && /youtube-nocookie/.test(csp) && /object-src 'none'/.test(csp) && /frame-ancestors 'self'/.test(csp))
  check('lo que bloquearía llega a los errores del panel', /securitypolicyviolation/.test(leer('js/error-log.js')))
}

console.log('── S10: la copia diaria ──')
{
  const y = leer('.github/workflows/copia-base.yml')
  check('cada noche, y a mano', /cron: '23 3 \* \* \*'/.test(y) && /workflow_dispatch/.test(y))
  check('copia, restaura en un Postgres de prueba y comprueba', /copia-seguridad\.sh/.test(y) && /probar-copia\.sh/.test(y) && /image: postgres:17/.test(y))
  check('se guarda CIFRADA (sin la frase, no se guarda)', /gpg .*--symmetric --cipher-algo AES256/.test(y) && /Falta el secreto COPIA_CLAVE/.test(y) && /rm -f "\$COPIA"/.test(y))
  check('las claves, solo como secretos', /secrets\.SUPABASE_DB_URL/.test(y) && !/postgresql:\/\/postgres\.[a-z]/.test(y))
  check('/.github no se publica', /'\/\.github\/\*'/.test(leer('netlify/edge-functions/internos.js')))
  check('probar-copia.sh existe y se puede ejecutar', existsSync(`${REPO}/herramientas/probar-copia.sh`) && (spawnSync('test', ['-x', `${REPO}/herramientas/probar-copia.sh`]).status === 0))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
