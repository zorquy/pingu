// Tanda 1308 — frenos contra el spam (S4).
//  · Ritmo por persona (temas, respuestas, mensajes, seguir, denuncias).
//  · Cuentas de menos de 24 h: sin enlaces de fuera, 3 temas, 5 conversaciones.
//  · Tres denuncias de cuentas con más de una semana esconden un mensaje.
//  · El equipo no tiene freno y decide con `foro_spam_revisar`.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chromium, contexto, BASE } from './fixtures-app.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── la migración, contra PostgreSQL ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1308'
const q = (s, rol = null, uid = '') => { const pre = rol ? `set prueba.uid = '${uid}'; set role ${rol}; ` : ''; const r = psql(['-At', '-d', BD, '-c', pre + s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const mig = readFileSync(`${REPO}/supabase-migration-1308-frenos.sql`, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const U = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  const C = (n) => `40000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  // 1 vieja, 2 nueva (hoy), 3 moderadora, 4-6 viejas que denuncian, 7 nueva que denuncia
  const r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    grant usage on schema public to anon, authenticated;
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
    create table auth.users (id uuid primary key, created_at timestamptz);
    insert into auth.users values ('${U(1)}', now() - interval '30 days'), ('${U(2)}', now() - interval '2 hours'), ('${U(3)}', now() - interval '90 days'),
      ('${U(4)}', now() - interval '20 days'), ('${U(5)}', now() - interval '20 days'), ('${U(6)}', now() - interval '20 days'), ('${U(7)}', now() - interval '1 day' + interval '1 hour');
    create table user_profiles (id uuid primary key, is_moderator boolean default false);
    insert into user_profiles select id, id = '${U(3)}' from auth.users;
    create or replace function public.is_admin() returns boolean language sql stable as $f$ select false $f$;
    create table forum_threads (id uuid primary key default gen_random_uuid(), author_id uuid, title text, created_at timestamptz not null default now());
    create table forum_posts (id uuid primary key default gen_random_uuid(), thread_id uuid, author_id uuid, body_html text, created_at timestamptz not null default now());
    create table private_messages (id uuid primary key default gen_random_uuid(), conversation_id uuid, sender_id uuid, body text, created_at timestamptz not null default now());
    create table user_follows (follower_id uuid, following_id uuid, created_at timestamptz not null default now());
    create table content_reports (id uuid primary key default gen_random_uuid(), reporter_id uuid, content_type text, content_id uuid, reason text, status text not null default 'pending', created_at timestamptz not null default now());
    alter table forum_posts enable row level security;
    create policy fp_leer on forum_posts for select using (true);
    create policy fp_escribir on forum_posts for insert to authenticated with check (author_id = auth.uid());
    create policy fp_editar on forum_posts for update to authenticated using (author_id = auth.uid());
    alter table forum_threads enable row level security; create policy ft_todo on forum_threads for all to authenticated using (true) with check (author_id = auth.uid());
    alter table private_messages enable row level security; create policy pm_todo on private_messages for all to authenticated using (true) with check (sender_id = auth.uid());
    alter table user_follows enable row level security; create policy uf_todo on user_follows for all to authenticated using (true) with check (follower_id = auth.uid());
    alter table content_reports enable row level security; create policy cr_poner on content_reports for insert to authenticated with check (reporter_id = auth.uid());
    grant select, insert, update, delete on forum_threads, forum_posts, private_messages, user_follows, content_reports to authenticated; grant select on forum_posts to anon;`])
  check('el andamio carga', r.status === 0, r.stderr)
  const sentencias = mig.replace(/notify pgrst[^;]*;/g, '').split(/;\s*\n(?=(?:create|alter|do|grant|update|drop|insert|--|\s*$))/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let todas = true
  for (let v = 0; v < 2; v++) for (const st of sentencias) { const x = psql(['-d', BD, '-c', st.endsWith(';') ? st : st + ';']); if (x.status !== 0) { todas = false; console.log(st.slice(0, 100), x.stderr) } }
  check('la 1308 entra sentencia a sentencia y otra vez encima', todas, sentencias.length)

  // Ritmo: 6 respuestas por minuto pasan, la 7.ª no.
  const T = q(`insert into forum_threads (author_id, title) values ('${U(1)}', 'Tema') returning id`, 'authenticated', U(1)).out
  let pasan = 0
  for (let i = 0; i < 7; i++) if (q(`insert into forum_posts (thread_id, author_id, body_html) values ('${T}', '${U(1)}', '<p>hola ${i}</p>')`, 'authenticated', U(1)).ok) pasan++
  const septima = q(`insert into forum_posts (thread_id, author_id, body_html) values ('${T}', '${U(1)}', '<p>otra</p>')`, 'authenticated', U(1))
  check('ritmo: 6 respuestas en un minuto pasan, la siguiente no', pasan === 6 && !septima.ok, pasan)
  check('…con su código y una frase para la web', /PD429|Vas muy rápido/.test(septima.err), septima.err)
  check('…lo de hace más de una hora no cuenta', q(`update forum_posts set created_at = now() - interval '2 hours'`).ok && q(`insert into forum_posts (thread_id, author_id, body_html) values ('${T}', '${U(1)}', '<p>ya</p>')`, 'authenticated', U(1)).ok)
  let mod = 0
  for (let i = 0; i < 10; i++) if (q(`insert into forum_threads (author_id, title) values ('${U(3)}', 'M${i}')`, 'authenticated', U(3)).ok) mod++
  check('la moderación no tiene freno', mod === 10)
  let segs = 0
  for (let i = 0; i < 21; i++) if (q(`insert into user_follows (follower_id, following_id) values ('${U(4)}', gen_random_uuid())`, 'authenticated', U(4)).ok) segs++
  check('seguir: 20 por minuto', segs === 20, segs)
  check('lo que escribe el servidor (sin auth.uid) no lleva freno', [...Array(25)].every(() => q(`insert into user_follows (follower_id, following_id) values ('${U(4)}', gen_random_uuid())`).ok))

  // Cuenta nueva.
  check('cuenta nueva: sin enlaces a otras webs en el foro', !q(`insert into forum_posts (thread_id, author_id, body_html) values ('${T}', '${U(2)}', '<p>compra en <a href="https://timo.example">aquí</a></p>')`, 'authenticated', U(2)).ok)
  check('…los de pokedoc.es sí', q(`insert into forum_posts (thread_id, author_id, body_html) values ('${T}', '${U(2)}', '<p>mira <a href="https://pokedoc.es/carta/sv1-1">esta</a></p>')`, 'authenticated', U(2)).ok)
  check('…la cuenta vieja, enlaces libres', q(`insert into forum_posts (thread_id, author_id, body_html) values ('${T}', '${U(4)}', '<p>https://www.pokemon.com</p>')`, 'authenticated', U(4)).ok)
  check('…tampoco en los mensajes privados', !q(`insert into private_messages (conversation_id, sender_id, body) values ('${C(1)}', '${U(2)}', 'www.timo.example')`, 'authenticated', U(2)).ok)
  let temas = 0
  for (let i = 0; i < 4; i++) { q(`update forum_threads set created_at = created_at - interval '2 minutes' where author_id = '${U(2)}'`); if (q(`insert into forum_threads (author_id, title) values ('${U(2)}', 'N${i}')`, 'authenticated', U(2)).ok) temas++ }
  check('…3 temas el primer día', temas === 3, temas)
  let convs = 0
  for (let i = 1; i <= 6; i++) { q(`update private_messages set created_at = created_at - interval '2 minutes' where sender_id = '${U(2)}'`); if (q(`insert into private_messages (conversation_id, sender_id, body) values ('${C(i)}', '${U(2)}', 'hola')`, 'authenticated', U(2)).ok) convs++ }
  check('…5 conversaciones nuevas el primer día', convs === 5, convs)
  check('…pero en una que ya tenía, sigue hablando', q(`insert into private_messages (conversation_id, sender_id, body) values ('${C(1)}', '${U(2)}', 'sigo')`, 'authenticated', U(2)).ok)

  // Denuncias.
  const P = q(`select id from forum_posts where author_id = '${U(4)}' limit 1`).out
  const denunciar = (n) => q(`insert into content_reports (reporter_id, content_type, content_id) values ('${U(n)}', 'forum_post', '${P}')`, 'authenticated', U(n)).ok
  denunciar(7); denunciar(1); denunciar(5)
  check('dos cuentas viejas y una de menos de una semana: no se esconde', q(`select coalesce(oculto_spam_at::text, 'no') from forum_posts where id = '${P}'`).out === 'no')
  denunciar(6)
  check('la tercera cuenta vieja lo esconde', q(`select oculto_spam_at is not null from forum_posts where id = '${P}'`).out === 't')
  check('el autor no se quita la marca editando', q(`update forum_posts set oculto_spam_at = null, body_html = '<p>editado</p>' where id = '${P}'`, 'authenticated', U(4)).ok && q(`select (oculto_spam_at is not null) || ':' || body_html from forum_posts where id = '${P}'`).out === 'true:<p>editado</p>')
  check('foro_spam_revisar: solo el equipo', !q(`select foro_spam_revisar('${P}', false)`, 'authenticated', U(1)).ok)
  check('…devolverlo lo enseña y cierra sus denuncias', q(`select foro_spam_revisar('${P}', false)`, 'authenticated', U(3)).out === 't' && q(`select coalesce(oculto_spam_at::text, 'no') from forum_posts where id = '${P}'`).out === 'no' && q(`select count(*) from content_reports where status = 'pending'`).out === '0')
  psql(['-c', `drop database if exists ${BD}`])
}

console.log('── en el navegador ──')
const b = await chromium.launch()
{
  // Un mensaje escondido: la gente ve el aviso; el equipo, el mensaje y los botones.
  for (const [quien, equipo] of [['user-2', false], ['admin-1', true]]) {
    // Un foro, un tema y dos mensajes: el segundo, escondido por denuncias.
    const ctx = await contexto(b, false, quien, () => {
      window.__FAKE_SECCIONES__ = [{}]
      window.__FAKE_FOROS__ = [{}]
      window.__FAKE_TEMAS__ = [{ post_count: 2 }]
      window.__FAKE_MENSAJES__ = [{}, { author_id: 'user-3', body_html: '<p>Compra seguidores en http://spam.example</p>', oculto_spam_at: new Date().toISOString() }]
    })
    const page = await ctx.newPage(); const err = []
    page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
    const tema = 'tema-1'
    await page.goto(`${BASE}/tema.html?t=${tema}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-spam-oculto]', { timeout: 8000 }).catch(() => {})
    const m = await page.evaluate(() => ({ aviso: document.querySelector('[data-spam-oculto]')?.textContent || '', botones: document.querySelectorAll('[data-spam-revisar]').length }))
    if (!equipo) check('la gente ve «escondido mientras lo revisa el equipo», sin botones', /lo revisa el equipo/.test(m.aviso) && m.botones === 0, JSON.stringify(m))
    else check('el equipo lo ve con «Devolver» y «Borrar»', m.botones === 2, JSON.stringify(m))
    check('…sin errores', !err.length, err.join(' | '))
    await ctx.close()
  }
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
