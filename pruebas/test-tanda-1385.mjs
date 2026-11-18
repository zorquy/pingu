// Tanda 1385 — los errores, agrupados y sin el ruido del antivirus (PINGU:
// «tenemos más de 9k errores en el panel de admin, ¿cómo los puedo
// exportar?… necesito arreglarlos»):
//   · la migración: `errores_agrupados` (uno por mensaje, con veces, personas,
//     páginas, primero, último y traza), `descartar_errores` (un grupo de una
//     vez) y la limpieza de los informes CSP de nsvcs.net;
//   · la web ya no apunta un aviso de CSP que no lanza nuestro código, y el
//     mismo error una sola vez por visita;
//   · el panel agrupa, descarta por grupo y exporta CSV.
import { readFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── La migración, contra PostgreSQL ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1385'
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`])
  psql(['-c', `create database ${BD}`])
  const r = psql(['-d', BD, '-c', `do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    create table client_errors (id uuid default gen_random_uuid() primary key, user_id uuid, message text not null, stack text, page_url text, user_agent text, status text not null default 'new', created_at timestamptz not null default now());
    insert into client_errors (message, page_url, user_agent, created_at, stack) select 'CSP (informe) connect-src: https://ingesteer.services-prod.nsvcs.net', '/foro', 'ua' || g, now() - g * interval '1 minute', null from generate_series(1, 40) g;
    insert into client_errors (message, page_url, user_id, created_at, stack) values
      ('TypeError: x is undefined', '/carta', '00000000-0000-0000-0000-000000000001', now() - interval '2 hour', 'vieja'),
      ('TypeError: x is undefined', '/carta', '00000000-0000-0000-0000-000000000001', now() - interval '1 hour', 'nueva'),
      ('TypeError: x is undefined', '/mazos', '00000000-0000-0000-0000-000000000002', now() - interval '3 hour', null),
      ('Failed to fetch', '/retos', null, now(), null);
    insert into client_errors (message, status) values ('TypeError: x is undefined', 'reviewed');`])
  check('el andamio carga', r.status === 0, r.stderr)
  const mig = readFileSync(`${REPO}/supabase-migration-1385-errores-agrupados.sql`, 'utf8')
  check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  const cuerpo = mig.replace(/^\s*(begin|commit);\s*$/gim, '')
  const sentencias = cuerpo.split(/;\s*\n(?=create|grant|delete|drop|comment)/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let bien = true
  for (let v = 0; v < 2; v++) for (const st of sentencias) {
    const x = psql(['-d', BD, '-c', st.endsWith(';') ? st : st + ';'])
    if (x.status !== 0) { bien = false; console.log(x.stderr) }
  }
  check('la 1385 entra sentencia a sentencia, y otra vez encima', bien, sentencias.length)
  const q = (s) => psql(['-At', '-F', '|', '-d', BD, '-c', s]).stdout.trim()
  check('la limpieza se llevó los 40 informes del antivirus', q(`select count(*) from client_errors where message like '%nsvcs%'`) === '0')
  const filas = q(`select mensaje, veces, personas, array_to_string(paginas, ','), traza from errores_agrupados()`).split('\n')
  check('dos grupos nuevos, el más repetido primero', filas.length === 2 && filas[0].startsWith('TypeError: x is undefined|3|2|'), filas.join(' / '))
  check('  …con sus páginas y la traza más reciente', /\/carta/.test(filas[0]) && /\/mazos/.test(filas[0]) && filas[0].endsWith('|nueva'), filas[0])
  check('  …sin el ya revisado', !filas.some((f) => f.includes('|4|')))
  check('descartar un grupo cambia sus nuevas de golpe', q(`select descartar_errores('TypeError: x is undefined')`) === '3' && q(`select count(*) from client_errors where status = 'new'`) === '1')
  psql(['-c', `drop database if exists ${BD}`])
}

console.log('── La web: el filtro de CSP y una vez por visita ──')
{
  const b = await chromium.launch()
  const page = await b.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  const r = await page.evaluate(async () => {
    const m = await import('/js/error-log.js')
    const o = 'https://pokedoc.es'
    return {
      nuestra: m.cspEsNuestra('https://pokedoc.es/js/app.js', o),
      pagina: m.cspEsNuestra('https://pokedoc.es', o),
      extension: m.cspEsNuestra('chrome-extension://abc/content.js', o),
      vacia: m.cspEsNuestra('', o),
      parecida: m.cspEsNuestra('https://pokedoc.es.evil.com/x.js', o),
    }
  })
  check('un aviso de CSP de nuestro código sí se apunta', r.nuestra && r.pagina)
  check('el de una extensión, uno sin fichero o de un dominio parecido, no', !r.extension && !r.vacia && !r.parecida, JSON.stringify(r))
  await b.close()
  const s = readFileSync(`${REPO}/js/error-log.js`, 'utf8')
  check('el mismo error, una vez por visita (sessionStorage)', /yaEnEstaVisita\(clave\)/.test(s) && /sessionStorage/.test(s))
  check('el oyente de CSP pasa por cspEsNuestra', /securitypolicyviolation[\s\S]{0,80}cspEsNuestra\(e\.sourceFile\b/.test(s))
}

console.log('── El panel ──')
{
  const s = readFileSync(`${REPO}/admin/js/admin.js`, 'utf8')
  check('pide los errores agrupados y, sin la migración, la lista de antes', /rpc\('errores_agrupados'/.test(s) && /loadClientErrorsSueltos\(\)/.test(s))
  check('descarta un grupo y exporta CSV', /rpc\('descartar_errores'/.test(s) && /Exportar CSV/.test(s) && /csvDeErrores/.test(s))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
