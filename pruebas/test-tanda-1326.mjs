// Tanda 1326 — /sobre con cifras vivas, quién lo hace, la línea del tiempo de
// /novedades y lo de prensa y tiendas (D1 del plan). Base (PostgreSQL), lo
// puro y la página en PC y móvil, con y sin la migración.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const leer = (f) => readFileSync(`${REPO}/${f}`, 'utf8')

console.log('── La base ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1326'
const q = (s, rol = null) => { const r = psql(['-At', '-d', BD, '-c', (rol ? `set role ${rol}; ` : '') + s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const mig = leer('supabase-migration-1326-sobre.sql')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
if (psql(['-c', 'select 1']).status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const U = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  const r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    grant usage on schema public to anon, authenticated;
    create table user_profiles (id uuid primary key, username text, display_name text, avatar_url text, tipo text, is_admin boolean default false, is_moderator boolean default false, is_writer boolean default false, is_banned boolean default false, email text, created_at timestamptz default now());
    create table user_collection (user_id uuid, cantidad int);
    create table forum_threads (id serial primary key);
    create table tournaments (id serial primary key, status text);
    alter table user_profiles enable row level security; alter table user_collection enable row level security;
    insert into user_profiles (id, username, display_name, is_admin, is_moderator, is_writer, tipo, is_banned, email, created_at) values
      ('${U(1)}', 'pingu', 'PINGU', true, true, false, null, false, 'secreto@x.es', now() - interval '2 years'),
      ('${U(2)}', 'ibai', 'Ibai', true, false, false, null, false, null, now() - interval '1 year'),
      ('${U(3)}', 'mod', null, false, true, true, null, false, null, now()),
      ('${U(4)}', 'tienda', 'Tienda', true, false, false, 'tienda', false, null, now()),
      ('${U(5)}', 'malo', 'Malo', false, true, false, null, true, null, now()),
      ('${U(6)}', 'ana', 'Ana', false, false, false, null, false, null, now());
    insert into user_collection values ('${U(1)}', 3), ('${U(6)}', 4);
    insert into forum_threads default values; insert into forum_threads default values;
    insert into tournaments (status) values ('finished'), ('in_progress'), ('finished'), ('cancelled');`])
  check('el andamio carga', r.status === 0, r.stderr)
  const sentencias = mig.split(/;\s*\n(?=(?:create|alter|do|grant|update|drop|insert|revoke|--|\s*$))/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let todas = true
  for (let v = 0; v < 2; v++) for (const st of sentencias) { const x = psql(['-d', BD, '-c', st.endsWith(';') ? st : st + ';']); if (x.status !== 0) { todas = false; console.log(st.slice(0, 100), x.stderr) } }
  check('la 1326 entra sentencia a sentencia y otra vez encima', todas, sentencias.length)
  const res = q('select sobre_cifras()', 'anon')
  const c = JSON.parse(res.out || '{}')
  check('sin cuenta: personas sin tiendas ni baneados (4), cartas sumando cantidades (7) aunque la RLS no deje leerlas, temas (2) y torneos terminados (2)', c.personas === 4 && c.cartas === 7 && c.temas === 2 && c.torneos === 2, res.out + res.err)
  check('el equipo: admin, moderación y redacción, admins primero y por antigüedad; ni la tienda ni el baneado ni quien no tiene papel', JSON.stringify((c.equipo || []).map((p) => p.username)) === '["pingu","ibai","mod"]', JSON.stringify(c.equipo))
  check('  …y del equipo solo lo de un perfil público (nada de correo)', !/secreto|email/.test(res.out))
  check('con cuenta también', q('select sobre_cifras() is not null', 'authenticated').out === 't')
  psql(['-c', `drop database if exists ${BD}`])
} else check('hay un PostgreSQL en /var/tmp:5433', false)

console.log('── Lo puro ──')
const m = await import(`${REPO}/js/sobre-puro.js`)
const h = m.cifrasHtml({ personas: 1234, cartas: 1, temas: 0, torneos: 56 })
check('las cifras: cuatro enlaces, con miles y singular', (h.match(/class="sobre-cifra"/g) || []).length === 4 && /1\.234<\/strong><span>personas/.test(h) && /1<\/strong><span>carta apuntada/.test(h), h)
check('  …sin datos no se pinta nada (ni un «0 personas» de lo que no se sabe)', m.cifrasHtml(null) === '' && m.cifrasHtml({ personas: 3 }) === '')
check('papeles: el más alto y Redacción aparte', JSON.stringify(m.papelesDe({ is_admin: true, is_moderator: true })) === '["Administración"]' && JSON.stringify(m.papelesDe({ is_moderator: true, is_writer: true })) === '["Moderación","Redacción"]')
const eq = m.equipoHtml([{ username: 'pi<b>', display_name: 'P', is_admin: true }, { username: 'x' }], { enlace: (p) => '/u/' + p.username })
check('el equipo: escapado, con su enlace y sin quien no tiene papel', (eq.match(/class="sobre-persona"/g) || []).length === 1 && /@pi&lt;b&gt;/.test(eq) && /href="\/u\/pi&lt;b&gt;"/.test(eq) && m.equipoHtml([]) === '')
const nov = { destacadas: [{ mes: '2026-10', titulo: 'Catálogo japonés', enlace: '/cartas?catalogo=JP' }], entradas: [
  { fecha: '2026-11-13', tipo: 'nuevo', texto: 'Dudas resueltas en el foro: la respuesta sale arriba.', enlace: '/foro' },
  { fecha: '2026-11-12', tipo: 'arreglo', texto: 'Arreglado algo.' },
  { fecha: '2026-10-20', tipo: 'nuevo', texto: 'Otra cosa.' },
] }
const lt = m.lineaDelTiempo(nov)
check('la línea del tiempo: por meses, el más nuevo arriba, con sus cambios', lt.length === 2 && lt[0].mes === '2026-11' && lt[0].cambios === 2 && lt[0].rotulo === 'noviembre de 2026', JSON.stringify(lt))
check('  …con las destacadas del mes, o lo nuevo recortado a lo de antes de los dos puntos', lt[1].hitos[0].texto === 'Catálogo japonés' && lt[0].hitos[0].texto === 'Dudas resueltas en el foro' && lt[0].hitos.length === 1, JSON.stringify(lt.map((x) => x.hitos)))
check('el fichero de verdad da meses', m.lineaDelTiempo(JSON.parse(leer('novedades.json'))).length >= 2)

console.log('── La página ──')
const html = leer('sobre.html')
check('/sobre carga su hoja y su módulo, y el bloque de prensa con el logo, el correo y el dossier', /css\/sobre\.css/.test(html) && /js\/sobre\.js/.test(html) && /info@pokedoc\.es/.test(html) && /pokedoc-para-tiendas\.pdf/.test(html) && /href="\/para-tiendas"/.test(html))
const b = await chromium.launch()
const RPC = { personas: 312, cartas: 48210, temas: 640, torneos: 18, equipo: [{ id: 'u1', username: 'pingu', display_name: 'PINGU', is_admin: true }, { id: 'u2', username: 'mod', display_name: 'Mod', is_moderator: true, is_writer: true }] }
for (const [nombre, disp] of [['PC', { viewport: { width: 1280, height: 900 } }], ['móvil', devices['iPhone 13']]]) {
  const ctx = await b.newContext({ ...disp, locale: 'es-ES' })
  await ctx.addInitScript((d) => { window.__FAKE_SESSION__ = 'none'; window.__RPC_RESPUESTAS__ = { sobre_cifras: d } }, RPC)
  const p = await ctx.newPage()
  await p.goto(`${BASE}/sobre.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.sobre-cifra', { timeout: 6000 }).catch(() => {})
  const cif = await p.locator('.sobre-cifra strong').allTextContents()
  check(`${nombre}: las cuatro cifras vivas`, JSON.stringify(cif) === '["312","48.210","640","18"]', JSON.stringify(cif))
  const filas = await p.evaluate(() => new Set([...document.querySelectorAll('.sobre-cifra')].map((x) => Math.round(x.getBoundingClientRect().top))).size)
  check(`  …en ${nombre === 'PC' ? 'una fila' : 'dos filas'}`, filas === (nombre === 'PC' ? 1 : 2), filas)
  check(`  …el equipo con su papel`, (await p.locator('.sobre-persona').count()) === 2 && /Moderación\s*Redacción/.test(await p.locator('.sobre-persona').nth(1).textContent()))
  await p.waitForSelector('.sobre-mes', { timeout: 6000 }).catch(() => {})
  check(`  …y la línea del tiempo de /novedades`, (await p.locator('.sobre-mes').count()) >= 2)
  check(`  …sin desbordar de lado`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await ctx.close()
}
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/sobre.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1500)
  check('sin la migración: ni cifras ni «Quién lo hace», y lo demás se ve', (await p.locator('#sobreCifras').isHidden()) && (await p.locator('#sobreEquipoSec').isHidden()) && (await p.locator('.sobre-prensa').isVisible()))
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
