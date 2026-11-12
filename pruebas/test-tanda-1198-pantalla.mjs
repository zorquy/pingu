// Tanda 1198 — tres arreglos de PINGU sobre los eventos:
//   · Los atajos (Compartir, Calendario, Cómo llegar, Foro) van al PIE de la
//     cabecera, a la derecha de los datos (sitio, web, Instagram), no pegados
//     al «Voy».
//   · Las caras de «Quién va» y de la tarjeta de la agenda cargan su foto
//     entera (les faltaba `background-size`).
//   · El hilo de un evento lo firma PokeDoc, no la cuenta de quien lo guarda:
//     `evento_hilo` (migración 1198) deja el hilo y su primer mensaje sin
//     autor con `de_pokedoc`, y la web pinta «PokeDoc» con el logo y sin
//     enlace. Y el hilo índice de «Eventos y quedadas», fijado.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const FOTO = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#2a7"/><circle cx="200" cy="200" r="120" fill="#fff"/></svg>'

const sembrar = () => {
  const x = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
  const ev = (o) => { const h = o.horario; const [a, m, d] = h[0].dia.split('-').map(Number); const [b, n, f] = h.at(-1).dia.split('-').map(Number); return { publicado: true, asistentes: [], entradas: [], empieza: new Date(a, m - 1, d, Number(h[0].desde.slice(0, 2))).toISOString(), termina: new Date(b, n - 1, f, Number(h.at(-1).hasta.slice(0, 2))).toISOString(), ...o } }
  window.__FAKE_EVENTOS__ = [
    ev({ id: 'e1', slug: 'castellon', nombre: 'CASTELLON CARD SHOW', tipo: 'card_show', horario: [{ dia: x(4), desde: '10:00', hasta: '20:00' }], sitio: 'Carpa Multiusos', direccion: 'Calle Mayor 1', ciudad: 'Oropesa del Mar', web: 'https://castelloncardshow.es', instagram: 'castelloncardshow', hilo_id: 'tema-ev', entradas: [{ nombre: 'General', precio: 5 }], asistentes: [{ user_id: 'user-2' }] }),
  ]
  // Misty con foto (una de 400 px: sin `background-size` se vería una esquina).
  const misty = (window.__FAKE_PERFILES__ || []).find?.((p) => p.id === 'user-2')
  if (misty) misty.avatar_url = 'https://img.example/misty.svg'
  const hace = (m) => new Date(Date.now() - m * 60000).toISOString()
  window.__FAKE_FOROS__.push({ id: 'foro-ev', slug: 'eventos', name: 'Eventos y quedadas', description: 'Un hilo por evento', section_id: 'seccion-1', position: 2, post_policy: 'staff' })
  window.__FAKE_TEMAS__.push(
    { id: 'tema-ev', board_id: 'foro-ev', title: 'CASTELLON CARD SHOW · 7 de noviembre', prefix: 'Card show', author_id: 'admin-1', post_count: 1, view_count: 3, last_post_at: hace(30), last_post_author_id: 'admin-1', created_at: hace(30) },
    { id: 'tema-pd', board_id: 'foro-ev', title: 'Trade Night Bilbao · 9 de noviembre', prefix: 'Trade night', author_id: null, de_pokedoc: true, post_count: 2, view_count: 3, last_post_at: hace(5), last_post_author_id: 'user-2', created_at: hace(60) },
    { id: 'tema-indice', board_id: 'foro-ev', title: 'Índice de eventos: cuéntanos los que conozcas', prefix: 'Agenda', author_id: null, de_pokedoc: true, is_pinned: true, post_count: 1, view_count: 3, last_post_at: hace(1), last_post_author_id: null, created_at: hace(1) },
    { id: 'tema-huerfano', board_id: 'foro-2', title: 'Un tema de una cuenta borrada', author_id: null, post_count: 1, view_count: 3, last_post_at: hace(500), last_post_author_id: null, created_at: hace(500) },
  )
  window.__FAKE_MENSAJES__.push(
    { id: 'msg-ev', thread_id: 'tema-ev', author_id: 'admin-1', body_html: '<p>Viejo</p>', created_at: hace(30) },
    { id: 'msg-pd1', thread_id: 'tema-pd', author_id: null, body_html: '<p>El hilo de la Trade Night.</p>', created_at: hace(60) },
    { id: 'msg-pd2', thread_id: 'tema-pd', author_id: 'user-2', body_html: '<p>¡Yo voy!</p>', created_at: hace(5) },
    { id: 'msg-ind', thread_id: 'tema-indice', author_id: null, body_html: '<p>Contadnos los eventos.</p>', created_at: hace(1) },
    { id: 'msg-hue', thread_id: 'tema-huerfano', author_id: null, body_html: '<p>Hola.</p>', created_at: hace(500) },
  )
}
async function abrir(b, ruta, { quien = 'user-1', movil = false, antes = null } = {}) {
  const ctx = await contexto(b, movil, quien, sembrar)
  if (antes) await ctx.addInitScript(antes)
  await ctx.route('https://img.example/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: FOTO }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/serviceWorker' property/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  return { ctx, page, errores }
}
const b = await chromium.launch()

console.log('── 1. La ficha: los atajos al pie de la cabecera ──')
for (const movil of [false, true]) {
  const { ctx, page, errores } = await abrir(b, '/eventos/castellon', { movil })
  const r = await page.evaluate(() => {
    const pie = document.querySelector('.ev-cab-pie')
    const datos = pie?.querySelector('.ev-datos')?.getBoundingClientRect()
    const atajos = pie?.querySelector('.ev-atajos')?.getBoundingClientRect()
    const voy = document.querySelector('.ev-acciones .ev-voy')?.getBoundingClientRect()
    const cab = document.querySelector('.ev-cab').getBoundingClientRect()
    return {
      enPie: !!datos && !!atajos,
      enAcciones: !!document.querySelector('.ev-acciones .ev-atajos'),
      atajos: [...(pie?.querySelectorAll('.ev-atajo') || [])].map((a) => a.textContent.trim()),
      datos: datos && { top: Math.round(datos.top), right: Math.round(datos.right), bottom: Math.round(datos.bottom) },
      at: atajos && { top: Math.round(atajos.top), left: Math.round(atajos.left), right: Math.round(atajos.right), bottom: Math.round(atajos.bottom) },
      voy: voy && Math.round(voy.bottom),
      cabRight: Math.round(cab.right),
      ancho: document.documentElement.scrollWidth - innerWidth,
    }
  })
  const lado = movil ? 'móvil' : 'PC'
  check(`${lado}: los datos y los atajos, en el pie de la cabecera (y no bajo el Voy)`, r.enPie && !r.enAcciones, JSON.stringify(r))
  check(`${lado}: con Compartir, Calendario, Cómo llegar y Foro`, ['Compartir', 'Calendario', 'Cómo llegar'].every((t) => r.atajos.includes(t)) && r.atajos.some((t) => /^Foro/.test(t)), r.atajos.join(' · '))
  check(`${lado}: el pie va debajo del Voy`, r.at && r.voy && r.at.top > r.voy, JSON.stringify(r))
  if (!movil) {
    check('PC: los atajos a la DERECHA de los datos, en la misma franja', r.at.left >= r.datos.right && r.at.top < r.datos.bottom && r.at.bottom > r.datos.top, JSON.stringify(r))
    check('PC: …pegados al borde derecho de la tarjeta', r.cabRight - r.at.right <= 40, r.cabRight - r.at.right)
  } else {
    check('móvil: los atajos debajo de los datos y sin salirse de lado', r.at.top >= r.datos.bottom && r.ancho <= 0, JSON.stringify(r))
  }
  // La cara de Misty, con su foto entera.
  const cara = await page.$eval('.ev-gente .ev-cara', (c) => { const s = getComputedStyle(c); return { tam: s.backgroundSize, pos: s.backgroundPosition, img: s.backgroundImage } })
  check(`${lado}: la cara de «Quién va» lleva la foto entera (cover, centrada)`, cara.tam === 'cover' && cara.pos === '50% 50%' && /misty\.svg/.test(cara.img), JSON.stringify(cara))
  check(`${lado}: sin errores`, !errores.length, errores.join(' | '))
  if (!movil) await page.screenshot({ path: '/tmp/1198-ficha-pc.png', fullPage: false })
  else await page.screenshot({ path: '/tmp/1198-ficha-movil.png', fullPage: false })
  await ctx.close()
}
{
  const { ctx, page } = await abrir(b, '/eventos')
  const cara = await page.$eval('.ev-caras .ev-cara', (c) => getComputedStyle(c).backgroundSize).catch(() => null)
  check('la cara de la tarjeta de la agenda, también', cara === 'cover', cara)
  await ctx.close()
}

console.log('── 2. El foro: lo que firma PokeDoc ──')
{
  const { ctx, page, errores } = await abrir(b, '/tema/tema-pd')
  await page.waitForSelector('.foro-mensaje', { timeout: 8000 }).catch(() => {})
  const m = await page.$$eval('.foro-mensaje', (l) => l.map((a) => ({
    nombre: a.querySelector('.foro-autor-nombre')?.textContent.trim(),
    enlace: !!a.querySelector('.foro-autor-nombre a, .foro-mensaje-autor a.mini-avatar'),
    foto: a.querySelector('.foro-mensaje-autor .mini-avatar')?.getAttribute('style') || '',
    oficial: /Cuenta oficial/.test(a.querySelector('.foro-mensaje-autor')?.textContent || ''),
  })))
  check('el primer mensaje lo firma PokeDoc, con el logo y sin enlace a un perfil', m[0]?.nombre === 'PokeDoc' && !m[0].enlace && /icon-192\.png/.test(m[0].foto), JSON.stringify(m[0]))
  check('  …con «Cuenta oficial» en vez del nivel', m[0]?.oficial)
  check('  …y la respuesta de Misty sigue siendo de Misty', m[1]?.nombre && m[1].nombre !== 'PokeDoc' && m[1].enlace && !m[1].oficial, JSON.stringify(m[1]))
  check('la cabecera del tema, «PokeDoc»', /PokeDoc/.test(await page.textContent('.tema-firma')))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.goto(`${BASE}/tema/tema-huerfano`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.foro-mensaje', { timeout: 8000 }).catch(() => {})
  check('un mensaje sin autor de un tema normal sigue siendo «Alguien»', (await page.textContent('.foro-mensaje .foro-autor-nombre')).trim() === 'Alguien')
  await page.goto(`${BASE}/foro/eventos`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.foro-tema-fila', { timeout: 8000 }).catch(() => {})
  const filas = await page.$$eval('.foro-tema-fila', (l) => Object.fromEntries(l.map((f) => [f.dataset.tema, f.querySelector('.mini-avatar')?.getAttribute('style') || ''])))
  check('en la lista, el índice (un solo mensaje) lleva el logo de PokeDoc', /icon-192\.png/.test(filas['tema-indice'] || ''), JSON.stringify(filas))
  check('  …y el hilo con respuesta, la cara de quien escribió lo último', !/icon-192/.test(filas['tema-pd'] || 'x'))
  await page.goto(`${BASE}/foro.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.foro-fila[data-foro="foro-ev"]', { timeout: 8000 }).catch(() => {})
  const ult = await page.$eval('.foro-fila[data-foro="foro-ev"] .foro-ultimo', (u) => ({ t: u.textContent.replace(/\s+/g, ' ').trim(), foto: u.querySelector('.mini-avatar')?.getAttribute('style') || '' })).catch((e) => ({ e: String(e) }))
  check('en el índice del foro, «Eventos y quedadas» dice PokeDoc al lado del índice', /PokeDoc/.test(ult.t || '') && /icon-192/.test(ult.foto || ''), JSON.stringify(ult))
  await ctx.close()
}

console.log('── 3. /admin: el hilo lo abre PokeDoc (y pasa a PokeDoc el de antes) ──')
{
  const { ctx, page, errores } = await abrir(b, '/admin/?ver=eventos', { quien: 'admin-1' })
  await page.waitForSelector('#evNuevo', { timeout: 8000 })
  await page.click('#evNuevo')
  await page.fill('#evf-nombre', 'Quedada Zaragoza')
  await page.selectOption('#evf-tipo', 'quedada')
  const dia = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 6); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` })
  if (!(await page.$(`[data-cal-dia="${dia}"]`))) await page.click('[data-cal-mes="1"]')
  await page.click(`[data-cal-dia="${dia}"]`)
  await page.fill('#evf-ciudad', 'Zaragoza')
  await page.check('#evf-hilo') // desmarcada desde la 1292
  await page.click('#evfGuardar')
  await page.waitForTimeout(900)
  const r = await page.evaluate(async () => {
    const e = window.__FAKE_EVENTOS__.find((x) => x.nombre === 'Quedada Zaragoza')
    const { supabase } = await import('/js/supabase.js')
    const { data: t } = await supabase.from('forum_threads').select('*').eq('id', e?.hilo_id || 'nada')
    const { data: p } = await supabase.from('forum_posts').select('*').eq('thread_id', e?.hilo_id || 'nada')
    return { hilo: t?.[0], posts: p }
  })
  check('el hilo nuevo, sin autor y de PokeDoc', r.hilo && r.hilo.author_id === null && r.hilo.de_pokedoc === true && r.hilo.board_id === 'foro-ev', JSON.stringify(r.hilo))
  check('  …y su primer mensaje, sin autor', r.posts?.length === 1 && r.posts[0].author_id === null && /pokedoc\.es\/eventos\//.test(r.posts[0].body_html), JSON.stringify(r.posts))
  await page.click('[data-ev-editar="e1"]')
  await page.fill('#evf-descripcion', 'Ahora con descripción.')
  await page.click('#evfGuardar')
  await page.waitForTimeout(900)
  const viejo = await page.evaluate(async () => {
    const { supabase } = await import('/js/supabase.js')
    const { data: t } = await supabase.from('forum_threads').select('*').eq('id', 'tema-ev')
    const { data: p } = await supabase.from('forum_posts').select('*').eq('id', 'msg-ev')
    return { t: t?.[0], p: p?.[0] }
  })
  check('el hilo que abrió tu cuenta pasa a PokeDoc al guardar el evento', viejo.t?.author_id === null && viejo.t?.de_pokedoc === true && viejo.p?.author_id === null && /Ahora con descripción/.test(viejo.p?.body_html || ''), JSON.stringify(viejo))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
  const sin = await abrir(b, '/admin/?ver=eventos', { quien: 'admin-1', antes: () => { window.__SIN_1198__ = true } })
  await sin.page.waitForSelector('#evNuevo', { timeout: 8000 })
  await sin.page.click('#evNuevo')
  await sin.page.fill('#evf-nombre', 'Sin la 1198')
  if (!(await sin.page.$(`[data-cal-dia="${dia}"]`))) await sin.page.click('[data-cal-mes="1"]')
  await sin.page.click(`[data-cal-dia="${dia}"]`)
  await sin.page.check('#evf-hilo')
  await sin.page.click('#evfGuardar')
  await sin.page.waitForTimeout(900)
  const s = await sin.page.evaluate(async () => {
    const e = window.__FAKE_EVENTOS__.find((x) => x.nombre === 'Sin la 1198')
    const { supabase } = await import('/js/supabase.js')
    const { data: t } = await supabase.from('forum_threads').select('*').eq('id', e?.hilo_id || 'nada')
    return t?.[0]
  })
  check('sin la migración 1198, el hilo se abre como en la 1197 (con tu cuenta)', s?.author_id === 'admin-1', JSON.stringify(s))
  await sin.ctx.close()
}

console.log('── 4. La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1198'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const como = (uid, s) => q(`begin; set local role authenticated; set local prueba.uid = '${uid}'; ${s}; commit;`)
  const sentenciasDe = (texto) => {
    const resto = texto.replace(/^--[^\n]*$/gm, '')
    const re = /\$\$[\s\S]*?\$\$|;/g
    const lista = []
    let m, desde = 0
    while ((m = re.exec(resto))) if (m[0] === ';') { lista.push(resto.slice(desde, m.index).trim()); desde = m.index + 1 }
    return lista.filter(Boolean)
  }
  if (psql(['-c', 'select 1']).status !== 0) check('hay un PostgreSQL en /var/tmp:5433', false)
  else {
    psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
    const A = '00000000-0000-0000-0000-0000000000a1', U = '00000000-0000-0000-0000-0000000000b2'
    const and = q(`create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('prueba.uid', true), '')::uuid $$;
      do $$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if; if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; end $$;
      grant usage on schema public, auth to authenticated, anon;
      create table public.user_profiles (id uuid primary key, username text, display_name text, avatar_url text, level int, total_xp int, hide_activity boolean default false, is_admin boolean not null default false, is_moderator boolean not null default false, forum_read_all_at timestamptz);
      create function public.is_admin() returns boolean language sql stable security definer as $$ select coalesce((select is_admin from public.user_profiles where id = auth.uid()), false) $$;
      create table public.forum_sections (id uuid primary key default gen_random_uuid(), name text, position int default 0);
      create table public.forum_boards (id uuid primary key default gen_random_uuid(), section_id uuid, parent_id uuid, name text, slug text unique, description text, position int default 0, post_policy text default 'todos', is_hidden boolean not null default false);
      create table public.forum_threads (id uuid primary key default gen_random_uuid(), board_id uuid not null references public.forum_boards on delete cascade, author_id uuid references auth.users on delete set null, title text not null, prefix text, is_pinned boolean not null default false, is_locked boolean not null default false, view_count int not null default 0, post_count int not null default 0, last_post_at timestamptz not null default now(), last_post_author_id uuid, created_at timestamptz not null default now());
      create table public.forum_posts (id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.forum_threads on delete cascade, author_id uuid references auth.users on delete set null, body_html text not null, created_at timestamptz not null default clock_timestamp(), edited_at timestamptz);
      create table public.forum_thread_reads (user_id uuid, thread_id uuid, last_read_at timestamptz);
      create table public.eventos (id uuid primary key default gen_random_uuid(), slug text, hilo_id uuid references public.forum_threads on delete set null);
      alter table public.forum_threads enable row level security;
      create policy hilos_ver on public.forum_threads for select using (true);
      create policy hilos_abrir on public.forum_threads for insert to authenticated with check (auth.uid() = author_id);
      create policy hilos_editar on public.forum_threads for update to authenticated using (auth.uid() = author_id or public.is_admin()) with check (auth.uid() = author_id or public.is_admin());
      grant select, insert, update on public.forum_threads to authenticated;
      grant select on public.forum_posts, public.eventos, public.user_profiles to authenticated;
      insert into auth.users values ('${A}'), ('${U}');
      insert into public.user_profiles (id, username, is_admin) values ('${A}', 'pingu', true), ('${U}', 'misty', false);
      insert into public.forum_sections (name, position) values ('Comunidad', 1);
      insert into public.forum_boards (section_id, name, slug, position, post_policy) select id, 'Eventos y quedadas', 'eventos', 2, 'staff' from public.forum_sections;
      insert into public.forum_boards (section_id, name, slug, position) select id, 'General', 'general', 3 from public.forum_sections;`)
    check('el andamio carga', and.ok, and.err)
    // El disparador de verdad que lleva las cuentas del hilo, y la vista del índice.
    const leer = (f) => readFileSync(`${REPO}/${f}`, 'utf8')
    const ult = leer('supabase-migration-foro-ultimo-autor.sql')
    const i = ult.indexOf('create or replace function public.forum_recontar_tema()')
    const fin = ult.indexOf('for each row execute function public.forum_recontar_tema();', i) + 'for each row execute function public.forum_recontar_tema();'.length
    const disp = q(ult.slice(i, fin))
    check('  …con forum_recontar_tema de verdad', disp.ok, disp.err)
    const foro = leer('supabase-migration-foro.sql')
    const v = foro.indexOf('create or replace view public.forum_boards_resumen')
    const vista = q(foro.slice(v, foro.indexOf(') u on true;', v) + ') u on true;'.length) + ' grant select on public.forum_boards_resumen, public.forum_boards, public.forum_sections, public.forum_thread_reads to authenticated, anon;')
    check('  …y la vista forum_boards_resumen de verdad', vista.ok, vista.err)
    // Un evento con hilo abierto con la cuenta de PINGU (como la 1197), con una respuesta.
    const ev1 = q(`with t as (insert into public.forum_threads (board_id, author_id, title, prefix) select id, '${A}', 'Castellón', 'Card show' from public.forum_boards where slug = 'eventos' returning id)
      insert into public.eventos (slug, hilo_id) select 'castellon', id from t returning hilo_id`).out
    q(`insert into public.forum_posts (thread_id, author_id, body_html) values ('${ev1}', '${A}', '<p>Primero</p>')`)
    q(`insert into public.forum_posts (thread_id, author_id, body_html) values ('${ev1}', '${U}', '<p>Voy</p>')`)
    const ev2 = q(`insert into public.eventos (slug) values ('bilbao') returning id`).out
    const sentencias = sentenciasDe(leer('supabase-migration-1198-hilos-de-pokedoc.sql'))
    for (const vuelta of [1, 2]) {
      const malas = sentencias.map((s) => [s, q(s)]).filter(([, x]) => !x.ok)
      check(`la 1198, sentencia a sentencia (vuelta ${vuelta})`, !malas.length, malas.map(([s, x]) => `${s.slice(0, 60)}: ${x.err}`).join(' | '))
    }
    const viejo = q(`select coalesce(t.author_id::text, 'null') || ',' || t.de_pokedoc || ',' || (select coalesce(p.author_id::text, 'null') from public.forum_posts p where p.thread_id = t.id order by created_at limit 1) || ',' || (select p.author_id from public.forum_posts p where p.thread_id = t.id order by created_at desc limit 1) || ',' || t.last_post_author_id from public.forum_threads t where t.id = '${ev1}'`).out
    check('el hilo abierto con la cuenta de PINGU pasa a PokeDoc (hilo y primer mensaje), y la respuesta sigue siendo de Misty', viejo === `null,true,null,${U},${U}`, viejo)
    const ind = q(`select t.is_pinned || ',' || t.de_pokedoc || ',' || coalesce(t.author_id::text, 'null') || ',' || t.post_count || ',' || (select count(*) from public.forum_posts p where p.thread_id = t.id) || ',' || (select count(*) from public.forum_threads x where x.title = t.title) from public.forum_threads t where t.title like 'Índice de eventos%'`).out
    check('el hilo índice, fijado, de PokeDoc, con su mensaje y UNA sola vez tras dos vueltas', ind === 'true,true,null,1,1,1', ind)
    check('  …y su mensaje lleva el enlace a /eventos', /pokedoc\.es\/eventos/.test(q(`select body_html from public.forum_posts p join public.forum_threads t on t.id = p.thread_id where t.title like 'Índice de eventos%'`).out))
    // La función: solo el admin.
    const noAdmin = como(U, `select public.evento_hilo('${ev2}', 'Bilbao', '<p>x</p>', 'Quedada')`)
    check('evento_hilo, solo el equipo', !noAdmin.ok && /Solo el equipo/.test(noAdmin.err), noAdmin.err)
    const nuevo = como(A, `select public.evento_hilo('${ev2}', 'Quedada Bilbao · 9 de noviembre', '<p>Hola</p>', 'Quedada')`)
    check('el admin abre el hilo de un evento sin hilo', nuevo.ok && /^[0-9a-f-]{36}$/.test(nuevo.out.split('\n').find((l) => /-/.test(l)) || ''), nuevo.err || nuevo.out)
    const h = q(`select coalesce(t.author_id::text, 'null') || ',' || t.de_pokedoc || ',' || t.prefix || ',' || t.post_count || ',' || coalesce(t.last_post_author_id::text, 'null') || ',' || (select coalesce(p.author_id::text, 'null') from public.forum_posts p where p.thread_id = t.id) || ',' || (e.hilo_id = t.id) from public.eventos e join public.forum_threads t on t.id = e.hilo_id where e.slug = 'bilbao'`).out
    check('  …sin autor, de PokeDoc, en «Eventos y quedadas», con su mensaje sin autor y apuntado en el evento', h === 'null,true,Quedada,1,null,null,true', h)
    const otra = como(A, `select public.evento_hilo('${ev2}', 'Quedada Bilbao · 10 de noviembre', '<p>Cambiado</p>', 'Quedada')`)
    const h2 = q(`select count(*) || ',' || max(t.title) || ',' || (select p.body_html from public.forum_posts p where p.thread_id = max(t.id::text)::uuid) || ',' || (select p.edited_at is not null from public.forum_posts p where p.thread_id = max(t.id::text)::uuid) from public.forum_threads t where t.title like 'Quedada Bilbao%'`).out
    check('  …y la segunda vez lo pone al día sin abrir otro', otra.ok && h2 === '1,Quedada Bilbao · 10 de noviembre,<p>Cambiado</p>,false', h2 + ' ' + otra.err)
    // La marca no se la pone nadie a sí mismo.
    const mio = como(U, `insert into public.forum_threads (board_id, author_id, title) select id, '${U}', 'Mío' from public.forum_boards where slug = 'general' returning id`)
    const tid = mio.out.split('\n').find((l) => /-/.test(l))
    const marca = como(U, `update public.forum_threads set de_pokedoc = true where id = '${tid}'`)
    check('nadie se pone «de PokeDoc» en su propio hilo (la restricción)', mio.ok && !marca.ok && /forum_threads_de_pokedoc_sin_autor/.test(marca.err), marca.err)
    // foro_resumen: el índice dice qué foros llevan lo último de PokeDoc.
    const res = como(A, `select public.foro_resumen()::text`)
    const j = JSON.parse(res.out.split('\n').find((l) => l.startsWith('{')) || '{}')
    const idEv = q(`select id from public.forum_boards where slug = 'eventos'`).out
    check('foro_resumen marca «Eventos y quedadas» como de PokeDoc (lo último es el hilo de Bilbao)', res.ok && Array.isArray(j.pokedoc) && j.pokedoc.includes(idEv) && j.pokedoc.length === 1, res.err || JSON.stringify(j.pokedoc))
    q(`insert into public.forum_posts (thread_id, author_id, body_html) select e.hilo_id, '${U}', '<p>Yo</p>' from public.eventos e where e.slug = 'bilbao'`)
    const res2 = JSON.parse(como(A, `select public.foro_resumen()::text`).out.split('\n').find((l) => l.startsWith('{')) || '{}')
    check('  …y deja de hacerlo cuando contesta alguien', Array.isArray(res2.pokedoc) && !res2.pokedoc.length && res2.perfiles?.[U], JSON.stringify(res2.pokedoc))
    psql(['-c', `drop database if exists ${BD}`])
  }
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
