// Tandas 1065 y 1066 — la analítica que se entiende: lo puro (app o web, la
// plataforma, las marcas del navegador y la frase del Resumen) y la
// migración contra PostgreSQL de verdad (las columnas y
// `admin_analitica_resumen`), dos veces encima y sin tablas temporales.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo del navegador ──')
{
  // page-views.js importa supabase.js: se saca el trozo puro (las mismas líneas).
  const fuente = readFileSync(`${REPO}/js/page-views.js`, 'utf8')
  const trozo = fuente.slice(fuente.indexOf('export function modoDe'), fuente.indexOf('const CLAVE_VISTO'))
  const dir = mkdtempSync(join(tmpdir(), 'pv1065-'))
  writeFileSync(join(dir, 'f.mjs'), trozo)
  const { modoDe, plataformaDe, marcasDeVisita, MEDIA_HORA } = await import(join(dir, 'f.mjs'))
  const win = (standalone, iosStandalone) => ({ matchMedia: () => ({ matches: standalone }), navigator: { standalone: iosStandalone } })
  check('app: abierta desde el icono (Android/PC) o en iPhone (navigator.standalone)', modoDe(win(true, undefined)) === 'app' && modoDe(win(false, true)) === 'app')
  check('  …web si no, y web si el navegador no sabe contestar', modoDe(win(false, false)) === 'web' && modoDe({}) === 'web' && modoDe({ matchMedia: () => { throw new Error('x') } }) === 'web')
  check('plataforma: iPhone, iPad (también el que dice «Macintosh» con dedo), Android y lo demás',
    plataformaDe('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5) === 'ios' &&
    plataformaDe('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5) === 'ios' &&
    plataformaDe('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0) === 'otro' &&
    plataformaDe('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5) === 'android' &&
    plataformaDe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0) === 'otro')
  const t0 = Date.parse('2026-10-28T10:00:00Z')
  let m = marcasDeVisita(null, { hoy: '2026-10-28', ms: t0, modo: 'web' })
  check('la primera vez: primera del día y visita nueva; no es app', m.marcas.primera_del_dia && m.marcas.nueva_visita && !m.marcas.primera_en_app)
  check('  …y lo que se guarda es solo la fecha, la hora y si ya fue app', JSON.stringify(Object.keys(m.guardar).sort()) === '["app","dia","ultima"]' && m.guardar.dia === '2026-10-28' && m.guardar.app === false)
  let m2 = marcasDeVisita(m.guardar, { hoy: '2026-10-28', ms: t0 + 5 * 60e3, modo: 'web' })
  check('otra página a los 5 minutos: ni primera del día ni visita nueva', !m2.marcas.primera_del_dia && !m2.marcas.nueva_visita)
  m2 = marcasDeVisita(m.guardar, { hoy: '2026-10-28', ms: t0 + MEDIA_HORA + 1, modo: 'web' })
  check('tras media hora: visita nueva, el mismo día', !m2.marcas.primera_del_dia && m2.marcas.nueva_visita)
  m2 = marcasDeVisita(m.guardar, { hoy: '2026-10-29', ms: t0 + 864e5, modo: 'app' })
  check('al día siguiente y desde la app: primera del día y primera en app (una instalación)', m2.marcas.primera_del_dia && m2.marcas.primera_en_app && m2.guardar.app === true)
  const m3 = marcasDeVisita(m2.guardar, { hoy: '2026-10-30', ms: t0 + 2 * 864e5, modo: 'app' })
  check('  …y la siguiente vez en app ya no es una instalación', !m3.marcas.primera_en_app && m3.marcas.primera_del_dia)
  check('lo guardado roto (una cadena, un número) cuenta como nada', marcasDeVisita('x', { hoy: 'h', ms: 1, modo: 'web' }).marcas.primera_del_dia === true)
  check('si el almacenamiento falla, no se cuenta como persona (null, no true)', /primera_del_dia: null/.test(fuente))
  check('las columnas nuevas tienen su respaldo sin la migración', /COLUMNAS_1065/.test(fuente) && /for \(const c of COLUMNAS_1065\) delete fila\[c\]/.test(fuente))
  check('abrir la app no es «directo»: es «app»', /modo === 'app' && fila\.origen === 'directo'\) fila\.origen = 'app'/.test(fuente))
  check('/privacidad lo cuenta', /si es tu primera visita del día/.test(readFileSync(`${REPO}/privacidad.html`, 'utf8')))
}

console.log('── La frase del Resumen ──')
{
  const f = await import(`${REPO}/js/analitica-frase.js`)
  const r = { dias: 7, medido_desde: '2026-10-28', personas: 612, personas_antes: 537, personas_app: 208, activos: 212, activos_antes: 180, acciones: { cartas: { n: 1840, antes: 1508 }, foro: { n: 96, antes: 104 }, retos: { n: 520, antes: 397 }, deseos: { n: 5, antes: 1 } } }
  const frase = f.fraseDeResumen(r, { vuelven: 45 })
  check('personas, su variación y «1 de cada 3 desde la app»', /^Esta semana han entrado 612 personas \(\+14 %\), 1 de cada 3 desde la app\./.test(frase), frase)
  check('  …lo que vuelve', /Vuelve el 45 % de quien tiene cuenta\./.test(frase), frase)
  check('  …lo que más sube (retos +31 %) y lo que baja (el foro −8 %)', /Se han jugado 520 retos \(\+31 %\); el foro baja \(−8 %\)\./.test(frase), frase)
  check('  …y lo de menos de 10 no cuenta (deseos 1 → 5 no es «+400 %»)', !/deseos/.test(frase), frase)
  const tonos = f.trozosDeResumen(r, { vuelven: 45 }).filter((t) => t.tono).map((t) => t.tono).join()
  check('los trozos llevan su tono para el color', tonos === 'sube,sube,baja', tonos)
  check('sin medir aún (antes de la 1065), habla de las cuentas', f.fraseDeResumen({ dias: 30, medido_desde: null, activos: 20, activos_antes: 0, acciones: {} }) === 'Este mes han entrado 20 personas con cuenta.')
  check('con muy poca app no dice «1 de cada 40»', !/de cada/.test(f.fraseDeResumen({ dias: 7, medido_desde: 'x', personas: 400, personas_antes: 0, personas_app: 10 })))
  check('«nuevo» sin nada antes: no hay variación que contar', f.variacion(5, 0) === null && f.variacion(150, 100) === 50 && f.pct(1, 3) === 33 && f.pct(1, 0) === null)
  check('la frase es pura: la importa la función del lunes', /from '\.\.\/\.\.\/js\/analitica-frase\.js'/.test(readFileSync(`${REPO}/netlify/functions/lunes.mjs`, 'utf8')) && !/^import/m.test(readFileSync(`${REPO}/js/analitica-frase.js`, 'utf8')))
}

console.log('── El resumen del lunes del equipo ──')
{
  const { resumenDelEquipo } = await import(`${REPO}/netlify/functions/lunes.mjs`)
  const llamadas = []
  const rest = async (ruta, _c, op = {}) => {
    llamadas.push({ ruta, metodo: op.method || 'GET', cuerpo: op.body ? JSON.parse(op.body) : null })
    if (ruta.startsWith('rpc/admin_analitica_resumen')) return { dias: 7, medido_desde: 'x', personas: 50, personas_antes: 40, personas_app: 25, activos: 10, activos_antes: 10, acciones: {} }
    return null
  }
  const leer = async (ruta) => (ruta.startsWith('user_profiles') ? [{ id: 'a1' }, { id: 'a2' }] : ruta.startsWith('user_notifications') ? [{ recipient_id: 'a2' }] : [])
  const r = await resumenDelEquipo({ leer, rest, clave: 'k', hace6: '2026-10-22T00:00:00Z' })
  const puesto = llamadas.find((l) => l.ruta === 'user_notifications')
  check('a cada admin que no lo tenga ya esta semana (a1 sí, a2 ya)', r.avisos === 1 && puesto?.cuerpo?.length === 1 && puesto.cuerpo[0].recipient_id === 'a1', JSON.stringify(r))
  check('  …con la frase, el tipo del equipo y el enlace al panel', puesto?.cuerpo?.[0].type === 'resumen_admin' && /50 personas \(\+25 %\), 1 de cada 2 desde la app/.test(puesto.cuerpo[0].body) && puesto.cuerpo[0].link === '/admin/?ver=analytics', JSON.stringify(puesto?.cuerpo))
  const sinNadie = await resumenDelEquipo({ leer: async (ruta) => (ruta.startsWith('user_profiles') ? [{ id: 'a1' }] : [{ recipient_id: 'a1' }]), rest, clave: 'k', hace6: 'x' })
  check('  …y si ya lo tienen todos, no se pregunta nada', sinNadie.avisos === 0)
}

console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1065'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1065-analitica-app.sql`, 'utf8')
  check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0)
  if (hay.status === 0) {
    psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
    let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role; exception when duplicate_object then null; end $$;
      create schema if not exists auth; create table auth.users (id uuid primary key);
      create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
      create or replace function auth.role() returns text language sql as $f$ select nullif(current_setting('prueba.rol', true), '') $f$;
      create or replace function is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
      grant usage on schema public to anon, authenticated, service_role;
      create table user_profiles (id uuid primary key, created_at timestamptz not null default now());
      create table page_views (id uuid primary key default gen_random_uuid(), path text not null, user_id uuid, created_at timestamptz not null default now(), is_bot boolean);
      alter table page_views enable row level security;
      create policy "page_views_insert_anyone" on page_views for insert with check (true);
      grant insert on page_views to anon, authenticated;
      create table user_collection (id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz not null default now());
      create table user_wants (id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz not null default now());
      create table retos_resultados (user_id uuid, juego text, created_at timestamptz not null default now());
      create table forum_posts (id uuid primary key default gen_random_uuid(), author_id uuid, created_at timestamptz not null default now());
      create table user_progress (user_id uuid, completed_at timestamptz);
      create table match_log (id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz not null default now());
      create table client_errors (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now());
      create table page_vitals (id uuid primary key default gen_random_uuid(), lcp_ms integer, created_at timestamptz not null default now());`])
    check('el andamio carga', r.status === 0, r.stderr)
    r = psql(['-d', BD, '-c', readFileSync(`${REPO}/supabase-migration-analitica.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')])
    check('la de la 848 entra (las páginas rotas)', r.status === 0, r.stderr)
    const sinNotify = mig.replace(/notify pgrst[^;]*;/, '')
    r = psql(['-d', BD, '-c', sinNotify])
    check('la 1065 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', sinNotify]).status === 0)

    const w = q(`set role anon; insert into page_views (path, is_bot, modo, primera_del_dia, primera_en_app, nueva_visita, plataforma) values ('/', false, 'app', true, true, true, 'ios')`)
    check('cualquiera apunta una visita con las marcas nuevas', w.ok, w.err)
    check('  …un modo que no existe se rechaza', !q(`set role anon; insert into page_views (path, modo) values ('/', 'tele')`).ok)
    check('  …y una plataforma tampoco', !q(`set role anon; insert into page_views (path, plataforma) values ('/', 'nevera')`).ok)

    const A = '00000000-0000-0000-0000-0000000000a1' // alta hace 3 días que añade una carta
    const B = '00000000-0000-0000-0000-0000000000b2' // alta hace 2 días que no hace nada
    const C = '00000000-0000-0000-0000-0000000000c3' // de hace un mes, activa
    q(`insert into user_profiles (id, created_at) values ('${A}', now() - interval '3 days'), ('${B}', now() - interval '2 days'), ('${C}', now() - interval '40 days');
      -- Esta semana: 4 personas (2 desde la app, 1 de ellas instalación nueva en Android), 1 robot y cargas de más.
      insert into page_views (path, user_id, is_bot, modo, primera_del_dia, primera_en_app, nueva_visita, plataforma, created_at) values
        ('/', null, false, 'web', true, false, true, 'otro', now() - interval '1 day'),
        ('/foro', null, false, 'web', false, false, false, 'otro', now() - interval '1 day'),
        ('/', '${C}', false, 'app', true, false, true, 'ios', now() - interval '2 days'),
        ('/', '${A}', false, 'app', true, true, true, 'android', now() - interval '3 days'),
        ('/', '${B}', false, 'web', true, false, true, 'otro', now() - interval '2 days'),
        ('/', null, true, 'web', true, false, true, 'otro', now() - interval '1 day'),
        -- La semana de antes: 2 personas, ninguna en app; y C entra.
        ('/', null, false, 'web', true, false, true, 'otro', now() - interval '9 days'),
        ('/', '${C}', false, 'web', true, false, true, 'otro', now() - interval '10 days');
      insert into user_collection (user_id, created_at) values ('${A}', now() - interval '2 days'), ('${C}', now() - interval '1 day'), ('${C}', now() - interval '8 days');
      insert into user_wants (user_id, created_at) values ('${C}', now() - interval '1 day');
      insert into forum_posts (author_id, created_at) values ('${C}', now() - interval '9 days'), ('${C}', now() - interval '10 days');
      insert into client_errors (created_at) values (now() - interval '1 day'), (now() - interval '2 days');
      insert into enlaces_rotos (ruta, desde, created_at) values ('/guia/vieja', '/aprender', now() - interval '1 day'), ('/wp-admin', null, now() - interval '1 day');
      insert into page_vitals (lcp_ms, created_at) values (1000, now() - interval '1 day'), (2000, now() - interval '1 day'), (3000, now() - interval '1 day'), (4000, now() - interval '1 day');`)
    const no = q(`set prueba.admin = 'no'; set role authenticated; select admin_analitica_resumen(7)`)
    check('no se abre a quien no es del equipo', !no.ok && /equipo/.test(no.err), no.err)
    const srv = q(`set prueba.admin = 'no'; set prueba.rol = 'service_role'; set role service_role; select admin_analitica_resumen(7)`)
    check('  …pero sí a la clave de servicio (la función del lunes)', srv.ok, srv.err)
    const res = q(`set prueba.admin = 'si'; set role authenticated; select admin_analitica_resumen(7)`)
    check('el equipo lo lee', res.ok, res.err)
    const d = res.ok ? JSON.parse(res.out) : {}
    check('personas: 5 distintas (la de arriba + 4; las cargas de más y el robot no), 2 la semana anterior', d.personas === 5 && d.personas_antes === 2, JSON.stringify({ p: d.personas, a: d.personas_antes }))
    check('  …3 desde la app; ninguna antes', d.personas_app === 3 && d.personas_app_antes === 0, JSON.stringify(d))
    check('instalaciones: 1 (y 1 de la visita de la prueba de arriba), por plataforma', d.instalaciones === 2 && d.instalaciones_por?.android === 1 && d.instalaciones_por?.ios === 1, JSON.stringify(d.instalaciones_por))
    check('activos: 3 cuentas esta semana, 1 antes', d.activos === 3 && d.activos_antes === 1, JSON.stringify({ a: d.activos, b: d.activos_antes }))
    check('acciones: 2 cartas (1 antes), 1 deseo, 0 foro (2 antes)', d.acciones?.cartas?.n === 2 && d.acciones.cartas.antes === 1 && d.acciones.deseos?.n === 1 && d.acciones.foro?.n === 0 && d.acciones.foro.antes === 2, JSON.stringify(d.acciones))
    check('  …con las seis siempre, aunque estén a cero', ['cartas', 'deseos', 'retos', 'foro', 'guias', 'partidas'].every((k) => d.acciones?.[k]), Object.keys(d.acciones || {}).join())
    check('altas: 2 en el periodo, 1 hizo algo y añadió una carta, ninguna ha vuelto aún', d.altas?.n === 2 && d.altas.hacen === 1 && d.altas.carta === 1 && d.altas.vuelven === 0, JSON.stringify(d.altas))
    check('salud: 2 errores, 1 página rota NUESTRA (la de fuera no), LCP p75 3250 ms', d.salud?.errores === 2 && d.salud.rotos === 1 && Number(d.salud.lcp_p75) === 3250, JSON.stringify(d.salud))
    check('por día: 7 días, web y app de las primeras del día', d.por_dia?.length === 7 && d.por_dia.reduce((s, x) => s + x.web + x.app, 0) === 5, JSON.stringify(d.por_dia))
    check('medido_desde: la primera fila con la marca', Boolean(d.medido_desde))
    const raro = q(`set prueba.admin = 'si'; set role authenticated; select admin_analitica_resumen(0)`)
    check('un periodo raro (0) no rompe: un día', raro.ok && JSON.parse(raro.out).dias === 1, raro.err)
    psql(['-c', `drop database if exists ${BD}`])
  }
}
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
