// Tanda 1197 — PINGU eligió lo recomendado de «Voy, botones y foro»: el «Voy»
// es una ENTRADA (muescas y talón con cuántos van); Compartir, Calendario,
// Cómo llegar y Foro son una fila de iconos redondos; «Cómo llegar» en
// «Dónde» es una tarjeta-enlace; «Añadir al calendario» baja un .ics; y al
// publicar un evento desde /admin se abre su hilo en el foro «Eventos y
// quedadas» (solo el equipo abre temas ahí), cuyo primer mensaje se pinta con
// la tarjeta del evento. Y la migración, contra PostgreSQL.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const sembrar = () => {
  const x = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
  const ev = (o) => { const h = o.horario; const [a, m, d] = h[0].dia.split('-').map(Number); const [b, n, f] = h.at(-1).dia.split('-').map(Number); return { publicado: true, asistentes: [], entradas: [], empieza: new Date(a, m - 1, d, Number(h[0].desde.slice(0, 2))).toISOString(), termina: new Date(b, n - 1, f, Number(h.at(-1).hasta.slice(0, 2))).toISOString(), ...o } }
  window.__FAKE_EVENTOS__ = [
    ev({ id: 'e1', slug: 'castellon', nombre: 'CASTELLON CARD SHOW', tipo: 'card_show', horario: [{ dia: x(4), desde: '10:00', hasta: '20:00' }, { dia: x(5), desde: '10:00', hasta: '20:00' }], sitio: 'Carpa Multiusos', ciudad: 'Oropesa del Mar', color: '#d4d42a', descripcion: 'Un evento de cartas.', hilo_id: 'tema-ev', entradas: [{ nombre: 'General', precio: 5 }], asistentes: [{ user_id: 'user-2' }, { user_id: 'mod-1' }] }),
    ev({ id: 'e2', slug: 'sin-nadie', nombre: 'Sin nadie', tipo: 'quedada', horario: [{ dia: x(9), desde: '18:00', hasta: '21:00' }], ciudad: 'Valencia' }),
  ]
  window.__FAKE_FILAS__ = {
    forum_boards: [{ id: 'b-eventos', section_id: 's1', parent_id: null, name: 'Eventos y quedadas', slug: 'eventos', position: 2, post_policy: 'staff', is_hidden: false }],
    forum_threads: [{ id: 'tema-ev', board_id: 'b-eventos', author_id: 'admin-1', title: 'CASTELLON CARD SHOW · 7 y 8 de noviembre', post_count: 3, last_post_at: new Date().toISOString(), created_at: new Date().toISOString() }],
    forum_posts: [{ id: 'p-1', thread_id: 'tema-ev', author_id: 'admin-1', body_html: '<p>Viejo</p>', created_at: new Date(Date.now() - 3600e3).toISOString() }],
  }
}
async function abrir(b, ruta, { quien = 'user-1', movil = false, antes = null } = {}) {
  const ctx = await contexto(b, movil, quien, sembrar)
  if (antes) await ctx.addInitScript(antes)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/serviceWorker' property/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  return { ctx, page, errores }
}
const b = await chromium.launch({ acceptDownloads: true })

console.log('── 1. El «Voy» es una entrada ──')
{
  const { ctx, page, errores } = await abrir(b, '/eventos')
  const t = await page.$eval('[data-ev="castellon"] .ev-voy', (x) => ({ txt: x.querySelector('.ev-voy-cuerpo').textContent.trim(), talon: x.querySelector('.ev-voy-talon')?.textContent, mascara: getComputedStyle(x).maskImage || getComputedStyle(x).webkitMaskImage, peq: x.classList.contains('peq') }))
  check('en la agenda: «¡Voy!» con el talón de cuántos van, con muescas, en pequeño', t.txt === '¡Voy!' && t.talon === '2' && /radial-gradient/.test(t.mascara) && t.peq, JSON.stringify(t))
  check('sin nadie todavía, sin talón (un «0» no anima)', !(await page.$('[data-ev="sin-nadie"] .ev-voy-talon')))
  await page.click('[data-ev="castellon"] .ev-voy')
  await page.waitForTimeout(400)
  const v = await page.$eval('[data-ev="castellon"] .ev-voy', (x) => ({ p: x.getAttribute('aria-pressed'), txt: x.textContent.replace(/\s+/g, ' ').trim(), color: getComputedStyle(x).color }))
  check('al pulsar: «Vas», el talón suma uno y se pone en verde', v.p === 'true' && /^Vas\s*3$/.test(v.txt), JSON.stringify(v))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
  const anon = await abrir(b, '/eventos', { quien: 'none' })
  check('sin cuenta, la misma entrada lleva a registrarse', /registro=1/.test(await anon.page.getAttribute('[data-ev="castellon"] a.ev-voy', 'href')) && (await anon.page.textContent('[data-ev="castellon"] a.ev-voy .ev-voy-cuerpo')).trim() === '¡Voy!')
  await anon.ctx.close()
}

console.log('── 2. La ficha: atajos, calendario y Cómo llegar ──')
{
  const { ctx, page, errores } = await abrir(b, '/eventos/castellon')
  await page.waitForTimeout(500)
  const atajos = await page.$$eval('.ev-atajos .ev-atajo', (l) => l.map((x) => x.textContent.trim()))
  check('Compartir, Calendario, Cómo llegar y Foro (con sus mensajes)', JSON.stringify(atajos) === JSON.stringify(['Compartir', 'Calendario', 'Cómo llegar', 'Foro · 3']), JSON.stringify(atajos))
  check('  …el de Foro lleva a su hilo', (await page.getAttribute('.ev-atajo[href^="/tema/"]', 'href')) === '/tema/tema-ev')
  const alto = await page.$$eval('.ev-atajo-ic', (l) => l.map((x) => Math.round(x.getBoundingClientRect().height)))
  check('  …círculos de 44 px', alto.every((h) => h === 44), JSON.stringify(alto))
  const filas = await page.$$eval('.ev-atajo', (l) => new Set(l.map((x) => Math.round(x.getBoundingClientRect().top))).size)
  check('  …los cuatro en una fila en el PC', filas === 1, filas)
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('#evCalendario')])
  let ics = ''
  if (descarga) { const ruta = await descarga.path(); ics = readFileSync(ruta, 'utf8') }
  check('«Calendario» baja un .ics con los dos días', descarga && /castellon\.ics$/.test(descarga.suggestedFilename()) && (ics.match(/BEGIN:VEVENT/g) || []).length === 2 && /SUMMARY:CASTELLON CARD SHOW/.test(ics), descarga ? descarga.suggestedFilename() : 'sin descarga')
  const llegar = await page.$eval('.ev-donde .ev-llegar', (a) => ({ href: a.href, txt: a.textContent.replace(/\s+/g, ' ').trim() }))
  check('en «Dónde», «Cómo llegar» es una tarjeta-enlace a Google Maps', /google\.com\/maps/.test(llegar.href) && /Cómo llegar\s*Abrir en Google Maps/.test(llegar.txt), JSON.stringify(llegar))
  await page.click('.ev-acciones .ev-voy')
  await page.waitForTimeout(500)
  check('al ir: sale «Modo evento» en los atajos e «Ir sin decirlo»', (await page.$$eval('.ev-atajo', (l) => l.map((x) => x.textContent.trim()))).includes('Modo evento') && !!(await page.$('#evOculto')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
  const m = await abrir(b, '/eventos/castellon', { movil: true })
  check('en el móvil no se sale de lado', (await m.page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0)
  await m.ctx.close()
}

console.log('── 3. El primer mensaje del hilo se pinta como la tarjeta del evento ──')
{
  const { ctx, page, errores } = await abrir(b, '/eventos')
  const r = await page.evaluate(async () => {
    const m = await import('/js/enlaces-internos.js')
    const div = document.createElement('div')
    div.innerHTML = '<p><a href="https://pokedoc.es/eventos/castellon">https://pokedoc.es/eventos/castellon</a></p><p><a href="https://pokedoc.es/eventos/borrado">https://pokedoc.es/eventos/borrado</a></p><p><a href="https://pokedoc.es/eventos/castellon">míralo aquí</a></p>'
    document.body.appendChild(div)
    await m.enriquecerEnlacesInternos(div)
    const as = [...div.querySelectorAll('a')]
    return as.map((a) => ({ c: a.className, t: a.textContent.replace(/\s+/g, ' ').trim() }))
  })
  check('el enlace «a pelo» a un evento es su tarjeta: nombre, tipo, fecha y cuántos van', /enlace-evento/.test(r[0].c) && /CASTELLON CARD SHOW/.test(r[0].t) && /Card show/.test(r[0].t) && /2 van/.test(r[0].t), JSON.stringify(r[0]))
  check('un evento que ya no está lo dice', /Este evento ya no está en la agenda/.test(r[1].t), JSON.stringify(r[1]))
  check('un enlace con texto del autor no se toca', r[2].t === 'míralo aquí' && !r[2].c, JSON.stringify(r[2]))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. /admin: el hilo se abre al publicar y se pone al día al editar ──')
{
  const { ctx, page, errores } = await abrir(b, '/admin/?ver=eventos', { quien: 'admin-1' })
  await page.waitForSelector('#evNuevo', { timeout: 8000 })
  await page.click('#evNuevo')
  // Desde la 1292 va DESMARCADA (PINGU: «por ahora no abriría post»): se marca a mano.
  check('la casilla «Abrir el hilo en el foro», desmarcada (1292)', !(await page.isChecked('#evf-hilo')))
  await page.check('#evf-hilo')
  await page.fill('#evf-nombre', 'Trade Night Bilbao')
  await page.selectOption('#evf-tipo', 'trade_night')
  const dia = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 6); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` })
  if (!(await page.$(`[data-cal-dia="${dia}"]`))) await page.click('[data-cal-mes="1"]')
  await page.click(`[data-cal-dia="${dia}"]`)
  await page.fill('#evf-ciudad', 'Bilbao')
  await page.click('#evfGuardar')
  await page.waitForTimeout(900)
  const r = await page.evaluate(() => {
    const e = window.__FAKE_EVENTOS__.find((x) => x.nombre === 'Trade Night Bilbao')
    return { e: e && { hilo: e.hilo_id, slug: e.slug } }
  })
  check('el evento nuevo queda con su hilo apuntado', !!r.e?.hilo, JSON.stringify(r))
  // El doble guarda lo insertado en su tabla: se mira por la página del hilo.
  const temas = await page.evaluate(async () => {
    const { supabase } = await import('/js/supabase.js')
    const { data: t } = await supabase.from('forum_threads').select('*').eq('board_id', 'b-eventos')
    const { data: p } = await supabase.from('forum_posts').select('*')
    return { t, p }
  })
  const hilo = temas.t.find((t) => /Trade Night Bilbao/.test(t.title))
  const msg = hilo && temas.p.find((p) => p.thread_id === hilo.id)
  check('  …en «Eventos y quedadas», con el título y la fecha', hilo && hilo.board_id === 'b-eventos' && / · \d+ de /.test(hilo.title) && hilo.prefix === 'Trade night', JSON.stringify(hilo))
  check('  …y el primer mensaje lleva el enlace «a pelo» a su ficha', msg && new RegExp(`<a href="https://pokedoc.es/eventos/${r.e.slug}">https://pokedoc.es/eventos/${r.e.slug}</a>`).test(msg.body_html), msg?.body_html)
  // Editar el que ya tiene hilo: el primer mensaje se pone al día, y no se abre otro.
  await page.click('[data-ev-editar="e1"]')
  check('el que ya tiene hilo enlaza a él y no ofrece abrir otro', !(await page.$('#evf-hilo')) && !!(await page.$('#evForm a[href="/tema/tema-ev"]')))
  await page.fill('#evf-descripcion', 'Descripción nueva para el hilo.')
  await page.click('#evfGuardar')
  await page.waitForTimeout(900)
  const despues = await page.evaluate(async () => {
    const { supabase } = await import('/js/supabase.js')
    const { data: p } = await supabase.from('forum_posts').select('*').eq('id', 'p-1')
    const { data: t } = await supabase.from('forum_threads').select('*').eq('board_id', 'b-eventos')
    return { p: p?.[0], n: t.length }
  })
  check('  …su primer mensaje se pone al día', /Descripción nueva para el hilo\./.test(despues.p?.body_html || '') && !!despues.p?.edited_at, JSON.stringify(despues.p))
  check('  …y no se abre un hilo nuevo', despues.n === 2, despues.n)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
  const sin = await abrir(b, '/admin/?ver=eventos', { quien: 'admin-1', antes: () => { window.__SIN_COLUMNAS__ = { eventos: ['hilo_id'] } } })
  await sin.page.waitForSelector('#evNuevo', { timeout: 8000 })
  await sin.page.click('#evNuevo')
  check('sin la migración 1197, dice cuál falta y no ofrece el hilo', /1197/.test(await sin.page.textContent('#evForm')) && !(await sin.page.$('#evf-hilo')))
  await sin.ctx.close()
}

console.log('── 5. La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1197'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  if (psql(['-c', 'select 1']).status !== 0) check('hay un PostgreSQL en /var/tmp:5433', false)
  else {
    psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
    q(`create table forum_sections (id uuid primary key default gen_random_uuid(), name text, position int);
       create table forum_boards (id uuid primary key default gen_random_uuid(), section_id uuid references forum_sections, parent_id uuid, name text, slug text unique, description text, position int, post_policy text default 'todos', is_hidden boolean default false);
       create table forum_threads (id uuid primary key default gen_random_uuid(), board_id uuid references forum_boards on delete cascade, title text);
       create table eventos (id uuid primary key default gen_random_uuid(), slug text);
       insert into forum_sections (name, position) values ('Comunidad', 1), ('Café', 3);
       insert into forum_boards (section_id, name, slug, position, post_policy) select id, 'Anuncios', 'anuncios', 1, 'staff' from forum_sections where name = 'Comunidad';
       insert into forum_boards (section_id, name, slug, position) select id, 'Presentaciones', 'presentaciones', 2 from forum_sections where name = 'Comunidad';
       insert into forum_boards (section_id, name, slug, position) select id, 'Sugerencias', 'sugerencias', 3 from forum_sections where name = 'Comunidad';
       insert into forum_boards (section_id, name, slug, position) select id, 'General', 'general', 1 from forum_sections where name = 'Café';`)
    const mig = readFileSync(`${REPO}/supabase-migration-1197-eventos-foro.sql`, 'utf8')
    const sentencias = mig.replace(/--[^\n]*/g, '').split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)
    for (const vuelta of [1, 2]) {
      const malas = sentencias.map((s) => [s, q(s)]).filter(([, x]) => !x.ok)
      check(`la 1197, sentencia a sentencia (vuelta ${vuelta})`, !malas.length, malas.map(([s, x]) => `${s.slice(0, 50)}: ${x.err}`).join(' | '))
    }
    const orden = q(`select string_agg(b.slug || ':' || b.position, ',' order by b.position) from forum_boards b join forum_sections s on s.id = b.section_id where s.name = 'Comunidad'`).out
    check('«Eventos y quedadas» detrás de Anuncios, y lo demás un puesto abajo (una sola vez)', orden === 'anuncios:1,eventos:2,presentaciones:3,sugerencias:4', orden)
    check('  …solo el equipo abre temas ahí', q(`select post_policy from forum_boards where slug = 'eventos'`).out === 'staff')
    check('  …y Café no se ha movido', q(`select position from forum_boards where slug = 'general'`).out === '1')
    const t = q(`insert into forum_threads (board_id, title) select id, 'Hilo' from forum_boards where slug = 'eventos' returning id`).out
    check('el evento apunta a su hilo', q(`insert into eventos (slug, hilo_id) values ('x', '${t}') returning slug`).ok)
    check('  …y si se borra el hilo, el evento sigue (sin hilo)', q(`delete from forum_threads where id = '${t}'`).ok && q(`select coalesce(hilo_id::text, 'null') from eventos where slug = 'x'`).out === 'null')
    psql(['-c', `drop database if exists ${BD}`])
  }
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
