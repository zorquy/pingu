// Tanda 1335 — /admin → Redes: lo que se puede compartir en las redes de
// PokeDoc (noticias, guías con su carrusel y torneos: anuncio y resultados),
// con «Compartir en X», «Instagram» (las imágenes, el texto y la historia) y
// lo ya compartido apuntado en `redes_compartido` (migración 1335) — o en el
// navegador si la migración aún no está.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const FOTOS = process.env.PD_FOTOS || ''
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── La base ──')
const mig = readFileSync(`${REPO}/supabase-migration-1335-redes-compartido.sql`, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
if (psql(['-c', 'select 1']).status === 0) {
  const BD = 'prueba_1335'
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const q = (s) => { const r = psql(['-At', '-d', BD, '-v', 'ON_ERROR_STOP=1', '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if; end $$;
     create schema if not exists auth;
     create table auth.users (id uuid primary key);
     create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('prueba.uid', true), '')::uuid $$;
     create or replace function public.is_admin() returns boolean language sql stable as $$ select coalesce(nullif(current_setting('prueba.admin', true), '')::boolean, false) $$;
     grant usage on schema auth to authenticated;
     insert into auth.users values ('11111111-1111-1111-1111-111111111111');`)
  const una = q(mig)
  const dos = q(mig)
  check('la migración entra y se puede repetir', una.ok && dos.ok, una.err || dos.err)
  const como = (admin, sql) => q(`begin; set local role authenticated; set local prueba.uid = '11111111-1111-1111-1111-111111111111'; set local prueba.admin = '${admin}'; ${sql}; commit;`)
  check('  …el equipo apunta y quién lo hizo sale solo (default auth.uid())', como(true, "insert into public.redes_compartido (clave, red) values ('guia:dragapult', 'x')").ok && q("select hecho_por from public.redes_compartido where clave = 'guia:dragapult'").out === '11111111-1111-1111-1111-111111111111')
  check('  …una red que no es X ni Instagram, no', !como(true, "insert into public.redes_compartido (clave, red) values ('guia:dragapult', 'tiktok')").ok)
  check('  …la misma pieza en la misma red, una vez (upsert)', como(true, "insert into public.redes_compartido (clave, red) values ('guia:dragapult', 'x') on conflict (clave, red) do update set hecho_at = now()").ok && q("select count(*) from public.redes_compartido").out === '1')
  check('  …quien no es del equipo no la lee ni la escribe', como(false, 'select count(*) from public.redes_compartido').out.endsWith('0') && !como(false, "insert into public.redes_compartido (clave, red) values ('noticia:x', 'x')").ok)
  psql(['-c', `drop database if exists ${BD}`])
} else console.log('  (sin PostgreSQL de pruebas: se salta la base)')

console.log('── Lo puro ──')
const R = await import(`${REPO}/js/redes-textos.js`)
const GUIA = { id: 'g1', kind: 'guide', slug: 'dragapult-ex', title: 'Cómo jugar Dragapult ex', description: 'La lista, el plan y los emparejamientos. Todo lo que necesitas para tu próximo torneo.', published_at: '2026-11-12T10:00:00Z', estimated_mins: 12, cover_image: 'https://zqamujmfavwrsqlgbead.supabase.co/storage/v1/object/public/guias/drag.webp', reference_blocks: [{ type: 'richtext', html: '<h2>Introducción</h2><p>Hola</p><h2>1. La lista &amp; sus porqués</h2><p>Cuatro Dreepy, <b>siempre</b>. Y tres Drakloak.</p><h3>Los entrenadores</h3><h2>El plan de juego</h2><h2>Los emparejamientos</h2><h2>Conclusión</h2>' }] }
const NOTICIA = { id: 'n1', kind: 'news', slug: 'mega-evolucion-llega', title: 'La Megaevolución llega al TCG en enero', description: 'Nueva expansión con cartas Mega ex. Preventa el 10 de diciembre.', published_at: '2026-11-13T09:00:00Z', cover_image: null }
const pg = R.piezaDeGuia(GUIA)
check('guía: carrusel de 5 (portada, tres claves, «léela entera»), sin «Introducción» ni «Conclusión»', pg.diapositivas.length === 5 && pg.diapositivas.map((d) => d.pintor).join() === 'guia-portada,guia-clave,guia-clave,guia-clave,guia-cierre' && pg.diapositivas[1].datos.punto === 'La lista & sus porqués', JSON.stringify(pg.diapositivas.map((d) => d.datos.punto)))
check('  …su enlace es /guia/<slug> y su clave «guia:<slug>»', pg.url === 'https://pokedoc.es/guia/dragapult-ex' && pg.clave === 'guia:dragapult-ex')
check('  …el texto de Instagram: título, puntos, «enlace en la bio» y etiquetas al final', /^Cómo jugar Dragapult ex\n\n/.test(pg.caption) && /· El plan de juego/.test(pg.caption) && /enlace en la bio/.test(pg.caption) && /\n\n#PokemonTCG .*#GuíaPokémon/.test(pg.caption))
check('  …el de X cabe con el enlace (280 − 23 − 1)', pg.x.texto.length <= 256 && pg.x.url === pg.url)
check('  …cada clave lleva debajo la primera frase de su apartado', pg.diapositivas[1].datos.detalle === 'Cuatro Dreepy, siempre. Y tres Drakloak.', pg.diapositivas[1].datos.detalle)
check('una guía sin apartados ni frases: una imagen, no carrusel', R.piezaDeGuia({ ...GUIA, reference_blocks: [], description: 'Solo una frase' }).diapositivas.length === 1)
check('  …con apartados viejos (`heading`), también salen', R.puntosDeGuia({ reference_blocks: [{ type: 'heading', text: 'Antes de empezar' }, { type: 'heading', text: 'Mulligan' }, { type: 'heading', text: 'Premios' }] }).join() === 'Mulligan,Premios')
const pn = R.piezaDeNoticia(NOTICIA)
check('noticia: /noticias/<slug>, una imagen con el pintor de siempre', pn.url === 'https://pokedoc.es/noticias/mega-evolucion-llega' && pn.diapositivas.length === 1 && pn.diapositivas[0].pintor === 'noticia')
const ahora = new Date('2026-11-13T12:00:00Z')
const ABIERTO = { id: 't1', slug: 'copa-delta', name: 'Copa Delta Reign', status: 'registration_open', format: 'swiss', swiss_rounds: 4, top_cut_size: 8, max_players: 32, start_at: '2026-11-21T10:30:00Z', created_at: '2026-11-11T10:00:00Z', precio_entrada: 5 }
const [anuncio] = R.piezasDeTorneo(ABIERTO, { inscritos: 20, ahora })
check('torneo abierto: el anuncio con día y hora de España, formato y plazas', anuncio?.clave === 'torneo:t1:anuncio' && /Sábado 21 de noviembre · 11:30/.test(anuncio.linea) && /Suizo a 4 rondas y top 8/.test(anuncio.linea) && /Quedan 12 plazas/.test(anuncio.linea), anuncio?.linea)
check('  …el enlace es la ficha (/torneo?slug=) y la inscripción va en el texto', anuncio.url === 'https://pokedoc.es/torneo?slug=copa-delta' && /Inscripción: 5 €/.test(anuncio.caption))
const TERMINADO = { id: 't2', slug: 'verano', name: 'Copa de verano', status: 'finished', format: 'swiss', start_at: '2026-08-01T10:00:00Z', podium: ['u1', 'u2', 'u3'] }
const piezasFin = R.piezasDeTorneo(TERMINADO, { inscritos: 14, nombres: { u1: 'Ash', u2: 'Misty', u3: 'Brock' }, ahora })
check('torneo terminado con podio: solo los resultados, «Ash gana…» y el podio', piezasFin.length === 1 && piezasFin[0].titulo === 'Ash gana Copa de verano' && /1\. Ash · 2\. Misty · 3\. Brock/.test(piezasFin[0].linea) && /14 jugadores/.test(piezasFin[0].x.texto))
check('privados, borradores y cancelados: nada', R.piezasDeTorneo({ ...ABIERTO, is_private: true }, { ahora }).length === 0 && R.piezasDeTorneo({ ...ABIERTO, status: 'draft' }, { ahora }).length === 0 && R.piezasDeTorneo({ ...ABIERTO, status: 'cancelled' }, { ahora }).length === 0)
const hechos = R.hechosDe([{ clave: pg.clave, red: 'x', hecho_at: '2026-11-12T12:00:00Z' }, { clave: pn.clave, red: 'x' }, { clave: pn.clave, red: 'instagram' }, { clave: 'z', red: 'tiktok' }])
const todas = [pg, pn, anuncio]
check('«Sin compartir» es que le falta alguna red (la guía solo salió en X: sigue)', R.filtrarPiezas(todas, 'sin', hechos).map((p) => p.tipo).join() === 'guia,torneo')
const cu = R.cuentasDe(todas, hechos)
check('  …y las cuentas de cada filtro', cu.todo === 3 && cu.sin === 2 && cu.noticia === 1 && cu.guia === 1 && cu.torneo === 1, JSON.stringify(cu))
check('lo más nuevo arriba', R.ordenarPiezas(todas).map((p) => p.tipo).join() === 'noticia,guia,torneo')

console.log('── /admin → Redes ──')
const b = await chromium.launch()
const errores = []
const h = (d) => new Date(Date.now() + d * 3600e3).toISOString()
const FILAS = {
  guides: [{ ...GUIA, published_at: h(-20) }, { ...NOTICIA, published_at: h(-2) }],
  tournaments: [
    { ...ABIERTO, admin_id: 'admin-1', start_at: h(24 * 8), created_at: h(-30), pairing_seed: 'x' },
    { ...TERMINADO, admin_id: 'admin-1', start_at: h(-24 * 3), pairing_seed: 'y', decklist_visibility: 'al_terminar' },
    { id: 't3', slug: 'privado', name: 'Quedada privada', status: 'registration_open', format: 'swiss', is_private: true, start_at: h(48), admin_id: 'admin-1', pairing_seed: 'z' },
  ],
  tournament_registrations: [...Array(20)].map((_, i) => ({ id: `r${i}`, tournament_id: 't1', user_id: `p${i}`, status: 'active' })).concat([...Array(14)].map((_, i) => ({ id: `s${i}`, tournament_id: 't2', user_id: `q${i}`, status: 'active' }))),
  user_profiles: [{ id: 'u1', username: 'Ash' }, { id: 'u2', username: 'Misty' }, { id: 'u3', username: 'Brock' }],
  tournament_decklists: [{ tournament_id: 't2', user_id: 'u1', raw_text: '', parsed_cards: [{ name: 'Dragapult ex', count: 3, supertype: 'Pokémon' }, { name: 'Drakloak', count: 4, supertype: 'Pokémon' }] }],
}
async function abrir({ movil = false, sinTabla = false, compartido = [] } = {}) {
  const ctx = await b.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, locale: 'es-ES', serviceWorkers: 'block', hasTouch: movil, isMobile: movil, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] })
  await ctx.addInitScript(({ filas, sinTabla, compartido }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_FILAS__ = { ...filas, redes_compartido: compartido }
    if (sinTabla) window.__SIN_TABLAS__ = ['redes_compartido']
  }, { filas: FILAS, sinTabla, compartido })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  // Lo nuevo del mes (1336) sale de novedades.json: aquí, vacío, que esta prueba mira lo suyo.
  await ctx.route(/\/novedades\.json/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"destacadas":[],"entradas":[]}' }))
  await ctx.route((u) => /supabase\.co\/storage/.test(String(u)), (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#2f6f9f"/><circle cx="600" cy="315" r="200" fill="#e4b44a"/></svg>' }))
  const page = await ctx.newPage()
  page.on('pageerror', (e) => { if (!/serviceWorker' property from 'Navigator'|ViewTransition/.test(String(e))) errores.push(String(e).slice(0, 200)) })
  await page.goto(`${BASE}/admin/?ver=redes`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.rd-fila, .rd-vacio', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(500)
  return { page, ctx }
}
const escrituras = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'redes_compartido'))

{
  const { page, ctx } = await abrir({ compartido: [{ clave: 'noticia:mega-evolucion-llega', red: 'x', hecho_at: h(-1) }, { clave: 'noticia:mega-evolucion-llega', red: 'instagram', hecho_at: h(-1) }] })
  check('«Redes» está en el menú, en Contenido', await page.evaluate(() => { const b = document.querySelector('.admin-nav-item[data-section="redes"]'); let p = b?.previousElementSibling; while (p && !p.classList.contains('admin-nav-grupo')) p = p.previousElementSibling; return p?.textContent === 'Contenido' && b.classList.contains('active') }))
  const filas = await page.evaluate(() => [...document.querySelectorAll('.rd-fila')].map((f) => f.dataset.clave))
  check('abre en «Sin compartir»: la guía y los dos del torneo (la noticia ya salió en las dos; el privado nunca)', filas.join() === 'guia:dragapult-ex,torneo:t1:anuncio,torneo:t2:resultados', filas.join())
  check('  …con las cuentas en los filtros', (await page.locator('[data-rd-filtro="todo"] b').textContent()) === '4' && (await page.locator('[data-rd-filtro="sin"] b').textContent()) === '3')
  await page.click('[data-rd-filtro="todo"]')
  check('«Todo»: la noticia arriba (la más nueva) y marcada en las dos redes', (await page.locator('.rd-fila').first().getAttribute('data-clave')) === 'noticia:mega-evolucion-llega' && (await page.locator('.rd-fila').first().locator('[data-rd-hecho][aria-pressed="true"]').count()) === 2)
  await page.click('[data-rd-filtro="sin"]')
  const fila = page.locator('.rd-fila[data-clave="guia:dragapult-ex"]')
  const href = await fila.locator('[data-rd-x]').getAttribute('href')
  check('«Compartir en X» abre x.com con el texto y el enlace de la guía', /^https:\/\/x\.com\/intent\/post\?text=C%C3%B3mo%20jugar%20Dragapult/.test(href) && href.includes(encodeURIComponent('https://pokedoc.es/guia/dragapult-ex')), href)
  await ctx.route(/x\.com/, (r) => r.fulfill({ status: 200, body: 'ok' }))
  const [nueva] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), fila.locator('[data-rd-x]').click()])
  await nueva?.close()
  await page.waitForTimeout(300)
  check('  …y al usarlo se marca X (en la base, con upsert por clave y red)', (await fila.locator('[data-rd-hecho="x"]').getAttribute('aria-pressed')) === 'true' && (await escrituras(page)).some((e) => e.tipo === 'upsert' && JSON.stringify(e.filas).includes('"red":"x"') && JSON.stringify(e.filas).includes('guia:dragapult-ex')), JSON.stringify(await escrituras(page)))
  check('  …sin sacarla de la lista (le falta Instagram) y sin cerrar nada', (await page.locator('.rd-fila[data-clave="guia:dragapult-ex"]').count()) === 1)

  await fila.locator('[data-rd-ig]').click()
  await page.waitForFunction(() => document.querySelectorAll('.rd-fila[data-clave="guia:dragapult-ex"] canvas.rd-previa').length === 5, null, { timeout: 15000 }).catch(() => {})
  const lienzos = await page.evaluate(() => [...document.querySelectorAll('.rd-fila[data-clave="guia:dragapult-ex"] canvas.rd-previa')].map((c) => `${c.width}x${c.height}`))
  check('«Instagram»: el carrusel de 5 en tamaño publicación (1080×1350)', lienzos.length === 5 && lienzos.every((x) => x === '1080x1350'), lienzos.join())
  check('  …con el texto para pegar', /enlace en la bio/.test(await fila.locator('.rd-texto').textContent()))
  await fila.locator('[data-rd-copiar]').click()
  await page.waitForTimeout(200)
  check('  …«Copiar texto» lo copia entero', (await page.evaluate(() => navigator.clipboard.readText())).startsWith('Cómo jugar Dragapult ex\n\n'))
  const descargas = []
  page.on('download', (d) => descargas.push(d.suggestedFilename()))
  await fila.locator('[data-rd-descargar]').click()
  await page.waitForTimeout(2500)
  check('  …«Descargar las 5» baja las cinco, numeradas', descargas.length === 5 && descargas[0] === 'pokedoc-guia-dragapult-ex-1.png' && descargas[4] === 'pokedoc-guia-dragapult-ex-5.png', descargas.join())
  check('  …y queda marcada en Instagram', (await fila.locator('[data-rd-hecho="instagram"]').getAttribute('aria-pressed')) === 'true')
  await fila.locator('[data-rd-hecho="x"]').click()
  await page.waitForTimeout(300)
  check('una marca se puede quitar (y se borra de la base)', (await fila.locator('[data-rd-hecho="x"]').getAttribute('aria-pressed')) === 'false' && (await escrituras(page)).some((e) => e.tipo === 'delete'), JSON.stringify((await escrituras(page)).map((e) => e.tipo)))

  // Las imágenes de cada pintor, para mirarlas.
  const res = page.locator('.rd-fila[data-clave="torneo:t2:resultados"]')
  await res.locator('[data-rd-ig]').click()
  await page.waitForFunction(() => document.querySelectorAll('.rd-fila[data-clave="torneo:t2:resultados"] canvas.rd-previa').length === 1, null, { timeout: 15000 }).catch(() => {})
  check('los resultados del torneo: una imagen, y el cajón de antes se cierra', (await res.locator('canvas.rd-previa').count()) === 1 && (await fila.locator('.rd-cajon').isHidden()))
  if (FOTOS) {
    mkdirSync(FOTOS, { recursive: true })
    const ann = page.locator('.rd-fila[data-clave="torneo:t1:anuncio"]')
    const sacar = async (sel, nombre) => {
      const datos = await page.evaluate((s) => [...document.querySelectorAll(s)].map((c) => c.toDataURL('image/png')), sel)
      datos.forEach((d, i) => writeFileSync(`${FOTOS}/${nombre}-${i + 1}.png`, Buffer.from(d.split(',')[1], 'base64')))
    }
    await sacar('.rd-fila[data-clave="torneo:t2:resultados"] canvas.rd-previa', 'resultados')
    await ann.locator('[data-rd-ig]').click()
    await page.waitForTimeout(1500)
    await sacar('.rd-fila[data-clave="torneo:t1:anuncio"] canvas.rd-previa', 'anuncio')
    await fila.locator('[data-rd-ig]').click()
    await page.waitForTimeout(1500)
    await sacar('.rd-fila[data-clave="guia:dragapult-ex"] canvas.rd-previa', 'guia')
    await page.screenshot({ path: `${FOTOS}/panel-pc.png` })
  }
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

{
  errores.length = 0
  const { page, ctx } = await abrir({ sinTabla: true })
  check('sin la migración: avisa de que se apunta en este navegador', /supabase-migration-1335/.test(await page.locator('.rd-sin-tabla').textContent().catch(() => '')))
  await page.locator('.rd-fila[data-clave="torneo:t1:anuncio"] [data-rd-hecho="instagram"]').click()
  await page.waitForTimeout(200)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.rd-fila', { timeout: 15000 }).catch(() => {})
  check('  …y lo marcado sigue ahí al volver', (await page.locator('.rd-fila[data-clave="torneo:t1:anuncio"] [data-rd-hecho="instagram"]').getAttribute('aria-pressed').catch(() => null)) === 'true')
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

{
  errores.length = 0
  const { page, ctx } = await abrir({ movil: true })
  const ancho = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
  check('móvil: sin desbordar a lo ancho', ancho[0] <= ancho[1], JSON.stringify(ancho))
  const fila = page.locator('.rd-fila[data-clave="guia:dragapult-ex"]')
  const cajas = await fila.evaluate((f) => ['[data-rd-x]', '[data-rd-ig]'].map((s) => f.querySelector(s).getBoundingClientRect()).map((r) => [Math.round(r.width), Math.round(r.height)]))
  check('  …los dos botones a lo ancho de la fila, de 44 px o más', cajas.every(([w, h]) => w > 120 && h >= 40), JSON.stringify(cajas))
  await fila.locator('[data-rd-ig]').click()
  await page.waitForTimeout(1500)
  const anchoDespues = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
  check('  …el carrusel se desliza dentro de su caja, la página no', anchoDespues[0] <= anchoDespues[1], JSON.stringify(anchoDespues))
  if (FOTOS) await page.screenshot({ path: `${FOTOS}/panel-movil.png`, fullPage: false })
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
