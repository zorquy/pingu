// Tanda 1330 — Latinoamérica (G9 del plan): precios en tu moneda al cambio del
// día (con «≈»: Cardmarket cobra en euros) y un foro para México.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
const m = await import(`${REPO}/js/moneda.js`)
const c = { fecha: '2026-11-13', tasas: { MXN: 20.1534, CLP: 1012.4, USD: 1.08 } }
check('a pesos mexicanos, con «≈» y dos decimales', m.enMoneda(12.5, 'MXN', c) === '≈ MX$ 251.92', m.enMoneda(12.5, 'MXN', c))
check('el chileno sin decimales', m.enMoneda(12.5, 'CLP', c) === '≈ CLP$ 12.655', m.enMoneda(12.5, 'CLP', c))
check('en euros, sin cambio de esa moneda o sin número: null (se pinta el euro)', m.enMoneda(5, 'EUR', c) === null && m.enMoneda(5, 'COP', c) === null && m.enMoneda(null, 'MXN', c) === null)
check('un cambio de otro día está viejo', m.cambioViejo(c, '2026-11-14') && !m.cambioViejo(c, '2026-11-13') && m.cambioViejo(null))
const cm = await import(`${REPO}/js/cardmarket.js`)
const blanco = (t) => String(t).replace(/\s/g, ' ')
check('euros() sigue en euros sin moneda elegida', blanco(cm.euros(12.5)) === '12,50 €', cm.euros(12.5))

console.log('── La función ──')
const f = await import(`${REPO}/netlify/functions/cambio.mjs`)
const ok = (j) => ({ ok: true, json: async () => j })
let pedidas = []
let r = await f.responder(new Request('https://x/.netlify/functions/cambio'), { fetchImpl: async (u) => { pedidas.push(u); return ok({ rates: { USD: 1.08, MXN: 20.1, CLP: 1012, ARS: 1100, COP: 4500, JPY: 160 } }) }, ahora: new Date('2026-11-13T10:00:00Z') })
let j = await r.json()
check('trae las de Latinoamérica (sin las que no se ofrecen) y se cachea en la CDN', j.fecha === '2026-11-13' && j.tasas.MXN === 20.1 && !('JPY' in j.tasas) && /s-maxage=43200/.test(r.headers.get('netlify-cdn-cache-control')), JSON.stringify(j))
pedidas = []
r = await f.responder(new Request('https://x/'), { fetchImpl: async (u) => { pedidas.push(u); return /er-api/.test(u) ? { ok: false } : ok({ rates: { USD: 1.07, MXN: 20 } }) } })
j = await r.json()
check('si la primera no contesta, el BCE', j.fuente === 'BCE' && j.tasas.MXN === 20 && pedidas.length === 2)
r = await f.responder(new Request('https://x/'), { fetchImpl: async () => ({ ok: false }) })
check('sin ninguna, 503 y sin caché (la web sigue en euros)', r.status === 503 && r.headers.get('cache-control') === 'no-store')

console.log('── La página ──')
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1' })
await ctx.route('**/.netlify/functions/cambio*', (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), tasas: { MXN: 20, USD: 1.1 } }) }))
const p = await ctx.newPage()
await p.goto(`${BASE}/ajustes.html?ver=apariencia`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('#ajMoneda', { timeout: 8000 }).catch(() => {})
check('Ajustes › Apariencia: «Moneda», en euros de entrada', (await p.inputValue('#ajMoneda').catch(() => '')) === 'EUR')
await p.selectOption('#ajMoneda', 'MXN')
await p.waitForFunction(() => /1 € ≈ MX\$ 20/.test(document.getElementById('ajMonedaNota')?.textContent || ''), null, { timeout: 5000 }).catch(() => {})
check('elegir pesos trae el cambio y lo dice («1 € ≈ MX$ 20,00»), orientativo', /1 € ≈ MX\$ 20\.00 · cambio del/.test(await p.textContent('#ajMonedaNota')) && /orientativo/.test(await p.textContent('#ajMonedaNota')), await p.textContent('#ajMonedaNota'))
const enOtra = await p.evaluate(async () => (await import('/js/cardmarket.js')).euros(12.5))
check('y desde entonces euros() pinta pesos, con «≈»', enOtra === '≈ MX$ 250.00', enOtra)
await p.selectOption('#ajMoneda', 'EUR')
check('volver a euros', blanco(await p.evaluate(async () => (await import('/js/cardmarket.js')).euros(12.5))) === '12,50 €')
await b.close()

console.log('── El foro ──')
const mig = readFileSync(`${REPO}/supabase-migration-1330-latam.sql`, 'utf8')
check('la sección «Latinoamérica» y el foro «México», sin repetirse', /'Latinoamérica'/.test(mig) && /'mexico'/.test(mig) && (mig.match(/not exists/g) || []).length >= 2 && !/create\s+temp/i.test(mig))
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (a) => spawnSync('psql', [...PG, ...a], { encoding: 'utf8' })
if (psql(['-c', 'select 1']).status === 0) {
  const BD = 'prueba_1330'
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  psql(['-d', BD, '-c', `create table forum_sections (id uuid primary key default gen_random_uuid(), name text not null, position int not null default 0);
    create table forum_boards (id uuid primary key default gen_random_uuid(), section_id uuid not null references forum_sections(id), parent_id uuid, name text not null, slug text not null unique, description text, position int not null default 0, post_policy text not null default 'todos', is_hidden boolean not null default false);
    insert into forum_sections (name, position) values ('General', 1), ('Jugar', 2);`])
  for (let v = 0; v < 2; v++) psql(['-d', BD, '-f', `${REPO}/supabase-migration-1330-latam.sql`])
  const out = psql(['-At', '-d', BD, '-c', `select s.name, s.position, b.slug from forum_boards b join forum_sections s on s.id = b.section_id`]).stdout.trim()
  check('en la base: una sección al final y un foro, aunque se ejecute dos veces', out === 'Latinoamérica|3|mexico', out)
  psql(['-c', `drop database if exists ${BD}`])
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
