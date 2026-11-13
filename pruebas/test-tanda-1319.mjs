// Tanda 1319 — «Respuesta útil» en el foro (P4 del plan): +15 XP y aviso a
// quien la escribió (una vez por tema, contra PostgreSQL), la caja arriba bajo
// la pregunta, el filtro «Resueltas» y la QAPage para Google.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const leer = (f) => readFileSync(`${REPO}/${f}`, 'utf8')

console.log('── La base: +15 XP una vez por tema ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1319'
const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const mig = leer('supabase-migration-1319-respuesta-util.sql')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
if (psql(['-c', 'select 1']).status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const U = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  const T = '10000000-0000-0000-0000-000000000001'
  const P = (n) => `20000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  const r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    create table user_profiles (id uuid primary key, total_xp int default 0, level int default 1);
    create function nivel_de_xp(x int) returns int language sql immutable as $f$ select 1 + x / 100 $f$;
    create table forum_threads (id uuid primary key, author_id uuid, title text, solved_post_id uuid);
    create table forum_posts (id uuid primary key, thread_id uuid references forum_threads(id), author_id uuid);
    create table user_notifications (id serial primary key, recipient_id uuid, type text, title text, body text, link text);
    insert into user_profiles (id) values ('${U(1)}'), ('${U(2)}'), ('${U(3)}');
    insert into forum_threads values ('${T}', '${U(1)}', '¿Budew bloquea objetos?', null);
    insert into forum_posts values ('${P(1)}', '${T}', '${U(1)}'), ('${P(2)}', '${T}', '${U(2)}'), ('${P(3)}', '${T}', '${U(3)}'), ('${P(4)}', '${T}', '${U(1)}');`])
  check('el andamio carga', r.status === 0, r.stderr)
  const sentencias = mig.split(/;\s*\n(?=(?:create|alter|do|grant|update|drop|insert|revoke|--|\s*$))/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let todas = true
  for (let v = 0; v < 2; v++) for (const st of sentencias) { const x = psql(['-d', BD, '-c', st.endsWith(';') ? st : st + ';']); if (x.status !== 0) { todas = false; console.log(st.slice(0, 100), x.stderr) } }
  check('la 1319 entra sentencia a sentencia y otra vez encima', todas, sentencias.length)
  const xp = (n) => q(`select total_xp || ':' || level from user_profiles where id = '${U(n)}'`).out
  q(`update forum_threads set solved_post_id = '${P(2)}' where id = '${T}'`)
  check('marcar la respuesta de otro: +15 XP para quien la escribió (con su nivel)', xp(2) === '15:1', xp(2))
  const aviso = q(`select type || '|' || title || '|' || body || '|' || link from user_notifications where recipient_id = '${U(2)}'`).out
  check('  …y su aviso, que lleva al mensaje', aviso === `forum_solucion|Tu respuesta resolvió una duda|¿Budew bloquea objetos? · +15 XP|/tema/${T}#mensaje-${P(2)}`, aviso)
  q(`update forum_threads set solved_post_id = null where id = '${T}'`)
  q(`update forum_threads set solved_post_id = '${P(2)}' where id = '${T}'`)
  check('quitar y volver a poner no cobra otra vez', xp(2) === '15:1' && q(`select count(*) from user_notifications`).out === '1')
  q(`update forum_threads set solved_post_id = '${P(3)}' where id = '${T}'`)
  check('  …ni pasarla a otra respuesta (una vez por tema)', xp(3) === '0:1' && xp(2) === '15:1')
  q(`insert into forum_threads values ('${T.replace(/1$/, '2')}', '${U(1)}', 'Otro', null); insert into forum_posts values ('${P(9)}', '${T.replace(/1$/, '2')}', '${U(1)}')`)
  q(`update forum_threads set solved_post_id = '${P(9)}' where id = '${T.replace(/1$/, '2')}'`)
  check('marcar tu propia respuesta no da nada', xp(1) === '0:1')
  check('el registro no se lee desde la web', !q(`set role anon; select * from forum_solucion_xp`).ok)
  psql(['-c', `drop database if exists ${BD}`])
} else check('hay un PostgreSQL en /var/tmp:5433', false)

console.log('── La QAPage ──')
{
  const { qaDeTema } = await import(`${REPO}/netlify/edge-functions/meta-social.js`)
  const qa = qaDeTema({
    tema: { title: '¿Budew bloquea objetos?', created_at: '2026-11-01T10:00:00Z', solved_post_id: 'p2' },
    primero: { body_html: '<p>Si mi rival ya jugó uno…</p>', author_id: 'a' },
    util: { body_html: '<p>No: el efecto solo mira el turno siguiente.</p>', author_id: 'b', created_at: '2026-11-01T11:00:00Z' },
    nombres: { a: 'leo_tcg', b: 'Marta' },
    canonica: 'https://pokedoc.es/tema/x',
    respuestas: 4,
  })
  check('una pregunta con su respuesta aceptada, con autores y fechas', qa['@type'] === 'QAPage' && qa.mainEntity['@type'] === 'Question' && qa.mainEntity.name === '¿Budew bloquea objetos?' && qa.mainEntity.answerCount === 4 && qa.mainEntity.author.name === 'leo_tcg' && qa.mainEntity.acceptedAnswer.author.name === 'Marta' && /turno siguiente/.test(qa.mainEntity.acceptedAnswer.text) && qa.mainEntity.acceptedAnswer.url === 'https://pokedoc.es/tema/x#mensaje-p2', JSON.stringify(qa).slice(0, 300))
  check('meta-social la usa solo en un tema resuelto', /util \? qaDeTema\(/.test(leer('netlify/edge-functions/meta-social.js')))
}

console.log('── En el navegador ──')
const b = await chromium.launch()
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_SECCIONES__ = [{}]
    window.__FAKE_FOROS__ = [{}]
    window.__FAKE_TEMAS__ = [{ post_count: 3, solved_post_id: 'msg-3', title: '¿Budew bloquea objetos?' }, { post_count: 1 }]
    window.__FAKE_MENSAJES__ = [{ body_html: '<p>¿Budew bloquea objetos si mi rival ya jugó uno?</p>' }, { author_id: 'user-2', body_html: '<p>Creo que sí</p>' }, { author_id: 'user-3', body_html: '<p>No: el efecto mira el turno siguiente.</p>' }]
  })
  const p = await ctx.newPage(); const err = []
  p.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}/tema.html?t=tema-1`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.foro-util', { timeout: 8000 }).catch(() => {})
  const u = await p.evaluate(() => {
    const c = document.querySelector('.foro-util')
    return c && { texto: c.textContent.replace(/\s+/g, ' ').trim(), despuesDelPrimero: c.previousElementSibling?.id === 'mensaje-msg-1', ir: c.querySelector('.foro-util-ir')?.getAttribute('href') }
  })
  check('la respuesta útil, arriba: justo debajo de la pregunta', u?.despuesDelPrimero, JSON.stringify(u))
  check('  …con su texto, de quién es y un salto a su sitio en el hilo', /Respuesta útil/.test(u?.texto || '') && /turno siguiente/.test(u?.texto || '') && u?.ir === '#mensaje-msg-3', JSON.stringify(u))
  check('  …sin errores', !err.length, err.join(' | '))
  await p.goto(`${BASE}/foro.html?f=foro-1`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2000)
  check('la lista del foro tiene «Resueltas»', (await p.locator('.foro-vistas a', { hasText: 'Resueltas' }).count()) === 1)
  await p.goto(`${BASE}/foro.html?f=foro-1&v=resueltas`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2000)
  const temas = await p.$$eval('[data-tema]', (xs) => xs.map((x) => x.dataset.tema))
  check('  …y enseña solo las dudas resueltas', JSON.stringify(temas) === '["tema-1"]', JSON.stringify(temas))
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
