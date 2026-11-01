// Tanda 1152 — de «Cinco pantallas que se leen de un vistazo» (ronda 6):
//   D1 · Noticias por semanas y, en el móvil, en filas.
//   D2 · Lanzamientos: «Ya en tiendas» en filas con tu progreso
//        (`coleccion_por_set`, migración 1152) y lo que viene en una tira.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

console.log('── 1. Lo puro ──')
{
  // noticias.js pinta al importarse: lo puro vive en noticias-grupos.js.
  const N = await import(`${RAIZ}/js/noticias-grupos.js`)
  {
    const ahora = new Date('2026-11-01T12:00:00') // domingo
    const g = (iso) => N.grupoDeNoticia(iso, ahora)?.rotulo
    check('el lunes de esta semana es «Esta semana»', g('2026-10-26T09:00:00') === 'Esta semana')
    check('el domingo de antes, «La semana pasada»', g('2026-10-25T20:00:00') === 'La semana pasada' && g('2026-10-19T08:00:00') === 'La semana pasada')
    check('lo de antes, por mes; con el año si no es este', g('2026-10-12T08:00:00') === 'Octubre' && g('2025-12-30T08:00:00') === 'Diciembre de 2025')
    check('una fecha que no se lee no tiene grupo', N.grupoDeNoticia('x', ahora) === null)
    const lista = [
      { slug: 'a', title: 'A', published_at: '2026-10-30T10:00:00' },
      { slug: 'b', title: 'B', published_at: '2026-10-27T10:00:00' },
      { slug: 'c', title: 'C', published_at: '2026-10-20T10:00:00' },
    ]
    const pintar = (n) => `<a class="noticia-tarjeta">${n.title}</a>`
    const r = N.tarjetasPorGrupo(lista, null, pintar, ahora)
    check('un rótulo por grupo, delante de su primera', (r.html.match(/noticias-grupo/g) || []).length === 2 && r.html.indexOf('Esta semana') < r.html.indexOf('noticia-tarjeta') && r.ultimo === 's1', r.ultimo)
    const mas = N.tarjetasPorGrupo([{ slug: 'd', title: 'D', published_at: '2026-10-19T10:00:00' }], r.ultimo, pintar, ahora)
    check('«Ver más» no repite el rótulo del grupo en que se quedó', !/noticias-grupo/.test(mas.html))
  }
  const L = await import(`${RAIZ}/js/lanzamientos.js`)
  const C = await import(`${RAIZ}/js/catalogo-series.js`)
  C.registrarEpisodios([{ id: '30th', tcggo_id: 552, card_count_official: 25 }, { id: '30th-c', tcggo_id: 552, card_count_official: 30 }])
  const p = L.progresoPorSet([{ set_id: '30th', distintas: 3 }, { set_id: '30th-c', distintas: 4 }, { set_id: 'sv8', distintas: 14 }, { set_id: null, distintas: 9 }])
  check('el progreso suma los hermanos en el padre (como pliega la lista)', p.get('30th-c') === 7 && !p.has('30th') && p.get('sv8') === 14 && p.size === 2, JSON.stringify([...p]))
  C.registrarEpisodios([])
}

console.log('\n── 2. La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1']
  const psql = (args, input) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000, input })
  const BD = 'prueba_1152'
  const A = '00000000-0000-0000-0000-0000000000a1'
  const B = '00000000-0000-0000-0000-0000000000b2'
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 160))
  if (hay.status === 0) {
    psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
    let r = psql(['-d', BD], `
      create schema if not exists auth;
      create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('prueba.uid', true), '')::uuid $$;
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      end $$;
      grant usage on schema public, auth to authenticated, anon;
      create table public.tcg_cards (id text, market text not null default 'WEST', set_id text, local_id text, primary key (id, market));
      create table public.user_collection (id serial primary key, user_id uuid not null, card_id text not null, market text not null default 'WEST', variante text default 'normal', cantidad int default 1);
      alter table public.user_collection enable row level security;
      create policy propias on public.user_collection for select to authenticated using (user_id = auth.uid());
      grant select on public.tcg_cards, public.user_collection to authenticated, anon;
      insert into public.tcg_cards (id, market, set_id) values ('sv8-1','WEST','sv8'), ('sv8-2','WEST','sv8'), ('sv7-1','WEST','sv7'), ('M1-1','JP','M1'), ('sv8-1','JP','OTRO');
      insert into public.user_collection (user_id, card_id, market, variante, cantidad) values
        ('${A}','sv8-1','WEST','normal',2), ('${A}','sv8-1','WEST','reverse',1), ('${A}','sv8-2','WEST','normal',1), ('${A}','sv7-1','WEST','normal',1),
        ('${A}','M1-1','JP','normal',1), ('${A}','huerfana','WEST','normal',1), ('${B}','sv8-1','WEST','normal',5);`)
    check('el andamio carga', r.status === 0, r.stderr)
    // Como el SQL Editor: sentencia a sentencia (631), respetando los `$$`.
    const texto = readFileSync(`${RAIZ}/supabase-migration-1152-coleccion-por-set.sql`, 'utf8').replace(/^--[^\n]*$/gm, '')
    const re = /\$\$[\s\S]*?\$\$|;/g
    const sentencias = []
    let m, desde = 0
    while ((m = re.exec(texto))) if (m[0] === ';') { sentencias.push(texto.slice(desde, m.index).trim()); desde = m.index + 1 }
    const errores = sentencias.filter(Boolean).map((s) => [s, psql(['-d', BD, '-c', s])]).filter(([, x]) => x.status !== 0).map(([s, x]) => `${s.slice(0, 60)} → ${x.stderr.slice(0, 160)}`)
    check('la 1152 pasa sentencia a sentencia', !errores.length, errores.join(' || '))
    r = psql(['-d', BD, '-f', `${RAIZ}/supabase-migration-1152-coleccion-por-set.sql`])
    check('  …y otra vez encima', r.status === 0, r.stderr)
    const como = (uid, s, rol = 'authenticated') => {
      const x = psql(['-t', '-A', '-d', BD, '-c', `begin; set local role ${rol}; ${uid ? `set local prueba.uid = '${uid}';` : ''} ${s}; commit;`])
      return { ok: x.status === 0, out: (x.stdout || '').trim().split('\n').filter((l) => l && !/^(BEGIN|SET|COMMIT)$/.test(l)).join(';'), err: x.stderr }
    }
    const occ = como(A, `select set_id || ':' || distintas from public.coleccion_por_set('WEST') order by set_id`)
    check('cuenta cartas DISTINTAS por set (dos versiones de la 1 son una)', occ.ok && occ.out === 'sv7:1;sv8:2', occ.out + occ.err)
    const jp = como(A, `select set_id || ':' || distintas from public.coleccion_por_set('JP')`)
    check('  …del catálogo pedido (la JP con el mismo id es otra carta)', jp.ok && jp.out === 'M1:1', jp.out + jp.err)
    const def = como(A, `select count(*) from public.coleccion_por_set()`)
    check('  …y sin catálogo, el occidental', def.ok && def.out === '2', def.out + def.err)
    const b = como(B, `select set_id || ':' || distintas from public.coleccion_por_set('WEST')`)
    check('cada uno ve lo SUYO', b.ok && b.out === 'sv8:1', b.out + b.err)
    const anon = como(null, `select count(*) from public.coleccion_por_set('WEST')`, 'anon')
    check('sin cuenta no se puede llamar', !anon.ok && /permission denied/.test(anon.err), anon.err.slice(0, 120))
  }
}

const b = await chromium.launch()
console.log('\n── 3. Noticias en el móvil ──')
{
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/noticias`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const m = await page.evaluate(() => {
    const t = [...document.querySelectorAll('#noticiasRejilla .noticia-tarjeta')]
    return {
      grupos: [...document.querySelectorAll('#noticiasRejilla .noticias-grupo')].map((g) => g.textContent),
      altos: t.map((x) => Math.round(x.getBoundingClientRect().height)),
      fila: t[0] ? getComputedStyle(t[0]).gridTemplateColumns : '',
      resumen: t[0] ? getComputedStyle(t[0].querySelector('p')).display : '',
      titular: Math.round(document.querySelector('.noticia-titular .noticia-portada')?.getBoundingClientRect().height || 0),
      anchoTit: Math.round(document.querySelector('.noticia-titular .noticia-portada')?.getBoundingClientRect().width || 0),
      primeroEsRotulo: document.querySelector('#noticiasRejilla > *')?.classList.contains('noticias-grupo'),
    }
  })
  check('la rejilla empieza con su rótulo de semana', m.primeroEsRotulo && m.grupos.length >= 1, JSON.stringify(m.grupos))
  check('cada noticia es una fila baja (miniatura al lado, sin resumen)', m.altos.length >= 2 && m.altos.every((h) => h < 120) && /^88px/.test(m.fila) && m.resumen === 'none', JSON.stringify(m))
  check('el titular, con la foto a 2:1', m.titular && Math.abs(m.anchoTit / m.titular - 2) < 0.05, `${m.anchoTit}x${m.titular}`)
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}

console.log('\n── 4. Noticias en el PC: la rejilla de siempre con sus rótulos ──')
{
  const ctx = await contexto(b, false, 'user-1')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/noticias`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const m = await page.evaluate(() => ({
    cols: getComputedStyle(document.getElementById('noticiasRejilla')).gridTemplateColumns.split(' ').length,
    rotuloAncho: Math.round(document.querySelector('.noticias-grupo')?.getBoundingClientRect().width || 0),
    rejilla: Math.round(document.getElementById('noticiasRejilla').getBoundingClientRect().width),
    resumen: getComputedStyle(document.querySelector('.noticia-tarjeta p')).display,
  }))
  check('tres columnas, el rótulo cruza la fila y el resumen sigue', m.cols === 3 && m.rotuloAncho === m.rejilla && m.resumen !== 'none', JSON.stringify(m))
  await ctx.close()
}

console.log('\n── 5. Lanzamientos: ya en tiendas, en filas con tu progreso ──')
for (const movil of [true, false]) {
  const ctx = await contexto(b, movil, 'user-1')
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/lanzamientos`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const m = await page.evaluate(() => {
    const filas = [...document.querySelectorAll('#listaPasados .lanz-fila')]
    return {
      n: filas.length,
      altos: filas.map((f) => Math.round(f.getBoundingClientRect().height)),
      progs: filas.map((f) => f.querySelector('.lanz-fila-prog')).filter((p) => !p.hidden).map((p) => p.textContent),
      barra: filas.map((f) => f.querySelector('.lanz-fila-barra i')?.style.width),
      sub: filas.filter((f) => !f.querySelector('.lanz-fila-sub').hidden).length,
      enlace: filas[0]?.tagName === 'A' && /set=/.test(filas[0].getAttribute('href') || ''),
      cols: getComputedStyle(document.getElementById('listaPasados')).gridTemplateColumns.split(' ').length,
      rpc: (window.__RPCS__ || []).filter((r) => r.nombre === 'coleccion_por_set').map((r) => r.args.p_market),
    }
  })
  const q = movil ? 'móvil' : 'PC'
  check(`${q}: filas de 64 px como mucho, y la fila entera es el enlace`, m.n >= 3 && m.altos.every((h) => h <= 64) && m.enlace, JSON.stringify(m.altos))
  check(`${q}: con cuenta, «n/total» en cada una, con su barra`, m.progs.length === m.n && m.progs.every((t) => /^\d+\/\d+$/.test(t)) && m.progs.some((t) => !t.startsWith('0/')) && m.barra.every(Boolean) && m.sub === 0, JSON.stringify(m.progs) + JSON.stringify(m.barra))
  check(`${q}: preguntado UNA vez, del catálogo que se mira`, m.rpc.length === 1 && m.rpc[0] === 'WEST', JSON.stringify(m.rpc))
  check(`${q}: ${movil ? 'una columna' : 'dos columnas'}`, m.cols === (movil ? 1 : 2), m.cols)
  check(`${q}: sin errores`, !err.length, err.join(' | '))
  await ctx.close()
}
{
  // Sin cuenta, y sin la migración: ningún número (no es «0 de 191»).
  for (const [nombre, quien, extra] of [['sin cuenta', 'none', null], ['sin la migración', 'user-1', () => { window.__SIN_1152__ = true }]]) {
    const ctx = await contexto(b, true, quien, extra)
    const page = await ctx.newPage()
    const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
    await page.goto(`${BASE}/lanzamientos`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2200)
    const m = await page.evaluate(() => ({
      n: document.querySelectorAll('#listaPasados .lanz-fila').length,
      progs: [...document.querySelectorAll('#listaPasados .lanz-fila-prog')].filter((p) => !p.hidden).length,
      barras: [...document.querySelectorAll('#listaPasados .lanz-fila-barra')].filter((p) => !p.hidden).length,
      sub: [...document.querySelectorAll('#listaPasados .lanz-fila-sub')].filter((p) => !p.hidden && p.textContent).length,
    }))
    check(`${nombre}: las filas, con «N cartas» y sin progreso`, m.n >= 3 && m.progs === 0 && m.barras === 0 && m.sub === m.n, JSON.stringify(m))
    check(`  …y sin errores`, !err.length, err.join(' | '))
    await ctx.close()
  }
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
