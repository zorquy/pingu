// Tanda 848 — la analítica nueva contra PostgreSQL de verdad y sus ayudantes
// puros: origen/campaña/aparato de las visitas, las búsquedas y las páginas
// rotas, y `admin_analitica`, que lo cuenta todo para el panel.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const REPO = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Los ayudantes del navegador ──')
{
  // page-views.js importa supabase.js: se sacan las funciones puras a un
  // módulo aparte para probarlas sin navegador (las mismas líneas, no copia).
  const fuente = readFileSync(`${REPO}/js/page-views.js`, 'utf8')
  const trozo = fuente.slice(fuente.indexOf('const ORIGENES'), fuente.indexOf('export async function logPageView'))
  const dir = mkdtempSync(join(tmpdir(), 'pv848-'))
  writeFileSync(join(dir, 'f.mjs'), trozo)
  const { origenDe, campanaDe, aparatoDe } = await import(join(dir, 'f.mjs'))
  const casos = [
    ['https://www.google.es/', 'google'], ['https://l.instagram.com/?u=x', 'instagram'], ['https://t.me/pokedoc', 'telegram'],
    ['https://t.co/abc', 'x'], ['https://pokedoc.es/foro', 'interno'], ['https://www.pokedoc.es/x', 'interno'], ['', 'directo'],
    ['no es una url', 'directo'], ['https://blog.ejemplo.com/a?b=1', 'blog.ejemplo.com'],
  ]
  for (const [ref, esperado] of casos) check(`origen de «${ref || '(nada)'}» → ${esperado}`, origenDe(ref, 'pokedoc.es') === esperado, origenDe(ref, 'pokedoc.es'))
  check('el origen es solo el dominio, nunca la dirección (ni la consulta)', !/[/?]/.test(origenDe('https://otra.web/perfil/ana?q=privado', 'pokedoc.es')))
  check('campaña: utm_source limpio, en minúsculas y acotado', campanaDe('?utm_source=Telegram') === 'telegram' && campanaDe('?utm_source=<script>') === 'script' && campanaDe('?x=1') === null && campanaDe(`?utm_source=${'a'.repeat(99)}`).length === 40)
  check('aparato: móvil, tableta (táctil y mediana) y ordenador', aparatoDe(390, true) === 'movil' && aparatoDe(1024, true) === 'tablet' && aparatoDe(1024, false) === 'pc' && aparatoDe(1440, true) === 'pc')

  const ap = readFileSync(`${REPO}/js/busquedas-apunte.js`, 'utf8')
  check('las búsquedas se apuntan sin usuario', !/user_id|session|getSession/.test(ap))
  check('  …y el buscador las apunta solo si todos los grupos contestaron', /every\(\(g\) => !g\.error\)/.test(readFileSync(`${REPO}/js/buscador.js`, 'utf8')))
  const rota = readFileSync(`${REPO}/js/pagina-rota.js`, 'utf8')
  check('la 404 apunta sin la consulta y sin robots', /pathname/.test(rota) && !/location\.search/.test(rota) && /pareceRobot/.test(rota) && /pagina-rota\.js/.test(readFileSync(`${REPO}/404.html`, 'utf8')))
  check('/privacidad lo cuenta', /de qué web vienes/.test(readFileSync(`${REPO}/privacidad.html`, 'utf8')) && /sin saber quién lo ha buscado/.test(readFileSync(`${REPO}/privacidad.html`, 'utf8')))
}

console.log('── Los ayudantes del panel ──')
{
  // analitica.js importa app.js (que toca el DOM al cargarse): igual, aparte.
  const fuente = readFileSync(`${REPO}/admin/js/analitica.js`, 'utf8')
  const trozo = fuente.slice(fuente.indexOf('export const fmt'), fuente.indexOf('// ── Piezas ──'))
  const dir = mkdtempSync(join(tmpdir(), 'an848-'))
  writeFileSync(join(dir, 'f.mjs'), trozo)
  const m = await import(join(dir, 'f.mjs'))
  check('delta: +50 %, −25 %, igual, «nuevo» sin nada antes y nada sin nada', m.deltaDe(150, 100).texto === '+50 %' && m.deltaDe(75, 100).tipo === 'baja' && m.deltaDe(5, 5).tipo === 'igual' && m.deltaDe(3, 0).tipo === 'nuevo' && m.deltaDe(0, 0) === null)
  const t = m.ticksLimpios(87)
  check('marcas del eje limpias que cubren el máximo', t[0] === 0 && t[t.length - 1] >= 87 && t.every((v, i) => !i || v > t[i - 1]) && t.length <= 6, t.join(','))
  check('  …también con un máximo de 1', m.ticksLimpios(1).at(-1) >= 1)
  check('hora punta dicha en palabras', m.horaPunta([{ dia: 4, hora: 21, n: 9 }, { dia: 1, hora: 10, n: 3 }])?.texto === 'los jueves a las 21 h' && m.horaPunta([]) === null)
  check('retención: % de quien volvió, y nada si la semana sigue en curso', m.retencionPct({ activos: 8, vuelven: 2 }) === 25 && m.retencionPct({ activos: 8, vuelven: null }) === null && m.retencionPct({ activos: 0, vuelven: 0 }) === null)
  check('compacto: 950, 1,2 mil, 12 mil', m.compacto(950) === '950' && m.compacto(1200) === '1,2 mil' && m.compacto(12400) === '12 mil')
  check('los textos que vienen de fuera (búsquedas, dominios) se escapan', (fuente.match(/escapeHtml\(f\.nombre\)/g) || []).length >= 1 && /escapeHtml\(x\.ruta\)/.test(fuente))
}

console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_848'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0)
  if (hay.status === 0) {
    psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
    let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
      create schema if not exists auth; create table auth.users (id uuid primary key);
      create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
      create or replace function is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
      grant usage on schema public to anon, authenticated;
      create table user_profiles (id uuid primary key, created_at timestamptz not null default now());
      create table page_views (id uuid primary key default gen_random_uuid(), path text not null, user_id uuid, created_at timestamptz not null default now(), is_bot boolean);
      alter table page_views enable row level security;
      create policy "page_views_insert_anyone" on page_views for insert with check (true);
      create policy "page_views_admin_select" on page_views for select using (is_admin());
      grant insert on page_views to anon, authenticated; grant select on page_views to authenticated;`])
    check('el andamio carga', r.status === 0, r.stderr)
    const mig = readFileSync(`${REPO}/supabase-migration-analitica.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')
    r = psql(['-d', BD, '-c', mig])
    check('la migración entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', mig]).status === 0)

    const U1 = '00000000-0000-0000-0000-0000000000a1'
    const U2 = '00000000-0000-0000-0000-0000000000b2'
    // Hoy: 3 visitas de personas (2 desde fuera: google y telegram; 1 interna), 1 robot.
    // La semana pasada, U1 y U2 entraron; esta semana solo vuelve U1.
    let w = q(`set role anon; insert into page_views (path, origen, campana, aparato, is_bot) values
      ('/', 'google', null, 'movil', false), ('/aprender.html', 'telegram', 'telegram', 'movil', false), ('/foro', 'interno', null, 'pc', false), ('/x', 'google', null, 'pc', true);`)
    check('cualquiera apunta una visita con origen, campaña y aparato', w.ok, w.err)
    check('  …un aparato que no existe se rechaza', !q(`set role anon; insert into page_views (path, aparato) values ('/', 'nevera')`).ok)
    check('  …y un origen larguísimo también', !q(`set role anon; insert into page_views (path, origen) values ('/', '${'a'.repeat(61)}')`).ok)
    q(`insert into user_profiles (id, created_at) values ('${U1}', now() - interval '20 days'), ('${U2}', now());
       insert into page_views (path, user_id, is_bot, created_at, origen) values
       ('/', '${U1}', false, date_trunc('week', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid' - interval '3 days', 'directo'),
       ('/', '${U2}', false, date_trunc('week', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid' - interval '3 days', 'directo'),
       ('/', '${U1}', false, date_trunc('week', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid' + interval '1 hour', 'interno');`)
    w = q(`set role anon; insert into busquedas (q, resultados, donde) values ('charizard', 4, '/buscar'), ('charizard', 4, '/buscar'), ('sobre falso', 0, '/'), ('sobre falso', 0, '/'), ('mew', 2, '/');`)
    check('cualquiera apunta una búsqueda', w.ok, w.err)
    check('  …vacía o larguísima, no', !q(`set role anon; insert into busquedas (q) values ('a')`).ok && !q(`set role anon; insert into busquedas (q) values ('${'x'.repeat(81)}')`).ok)
    w = q(`set role anon; insert into enlaces_rotos (ruta, desde) values ('/guia/vieja', '/aprender'), ('/guia/vieja', '/aprender'), ('/guia/vieja', 'google'), ('/wp-admin', null);`)
    check('cualquiera apunta una página rota', w.ok, w.err)
    const lee = q(`set role anon; select count(*) from busquedas`)
    check('  …pero nadie de fuera lee lo apuntado', !lee.ok || lee.out === '0', lee.out + lee.err)
    const noAdmin = q(`set prueba.admin = 'no'; set role authenticated; select admin_analitica(7)`)
    check('el panel no se abre a quien no es del equipo', !noAdmin.ok && /equipo/.test(noAdmin.err), noAdmin.err)
    const res = q(`set prueba.admin = 'si'; set role authenticated; select admin_analitica(7)`)
    check('el equipo lo lee', res.ok, res.err)
    const d = res.ok ? JSON.parse(res.out) : {}
    const rs = d.resumen || {}
    check('resumen: las personas sin el robot, y el robot aparte', rs.robots === 1 && rs.personas === (d.por_dia || []).reduce((s, x) => s + x.personas, 0), JSON.stringify(rs))
    check('  …las entradas son las que llegan de fuera: 6 personas menos las 2 internas', rs.entradas === 4 && rs.personas === 6, JSON.stringify(rs))
    check('por día: tantos días como el periodo, en orden', d.por_dia?.length === 7 && d.por_dia.every((x, i, a) => !i || x.dia > a[i - 1].dia))
    const orig = Object.fromEntries((d.origenes || []).map((o) => [o.origen, o.n]))
    check('orígenes: google 1, telegram 1, sin «interno» y sin el robot', orig.google === 1 && orig.telegram === 1 && !('interno' in orig), JSON.stringify(d.origenes))
    check('campañas: telegram 1', d.campanas?.[0]?.campana === 'telegram' && d.campanas[0].n === 1, JSON.stringify(d.campanas))
    const ap = Object.fromEntries((d.aparatos || []).map((a) => [a.aparato, a.n]))
    check('aparatos: 2 móvil y 1 ordenador (el robot no)', ap.movil === 2 && ap.pc === 1, JSON.stringify(d.aparatos))
    check('páginas: «/aprender.html» se cuenta como «/aprender»', (d.paginas || []).some((p) => p.ruta === '/aprender') && !(d.paginas || []).some((p) => p.ruta.endsWith('.html')), JSON.stringify(d.paginas))
    const ret = d.retencion || []
    const pasada = ret[ret.length - 2]
    const esta = ret[ret.length - 1]
    check('retención: ocho semanas', ret.length === 8, ret.length)
    check('  …la pasada, 2 con cuenta y 1 volvió', pasada?.activos === 2 && pasada.vuelven === 1, JSON.stringify(pasada))
    check('  …y la de ahora, en curso (sin «vuelven»)', esta?.vuelven === null && esta.activos >= 1, JSON.stringify(esta))
    check('horas: con día de la semana (1–7) y hora (0–23)', (d.horas || []).length > 0 && d.horas.every((h) => h.dia >= 1 && h.dia <= 7 && h.hora >= 0 && h.hora <= 23))
    const b = d.busquedas || {}
    check('búsquedas: 5, 2 sin resultado, y lo más buscado con sus vacías', b.total === 5 && b.vacias === 2 && b.top?.[0]?.n === 2 && b.top.find((x) => x.q === 'sobre falso')?.vacias === 2, JSON.stringify(b))
    check('  …y «sin resultado» solo las que no encontraron nada', b.sin_resultado?.length === 1 && b.sin_resultado[0].q === 'sobre falso')
    const rot = (d.rotos || []).find((x) => x.ruta === '/guia/vieja')
    check('rotas: 3 veces y «desde» la que más se repite (un enlace nuestro)', rot?.n === 3 && rot.desde === '/aprender', JSON.stringify(d.rotos))
    const vacio = q(`set prueba.admin = 'si'; set role authenticated; select admin_analitica(0)`)
    check('un periodo raro (0) no rompe: se queda en un día', vacio.ok && JSON.parse(vacio.out).dias === 1, vacio.err)
    psql(['-c', `drop database if exists ${BD}`])
  }
}
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
