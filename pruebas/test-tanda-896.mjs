// Tanda 896 — pantallas cortas (I5) y botones que cambian antes de que
// conteste el servidor (R6), de la propuesta «Rápida y limpia».
//
// Lo que se mira: /retos en el móvil es una rejilla de dos columnas (sin
// párrafo ni chips por reto) y mide la mitad; /glosario lleva índice de
// letras y buscador pegados arriba, los términos plegados en el móvil y
// abiertos en el PC, buscar filtra y abre, llegar por ancla abre; en
// /comunidad del móvil la gente va antes que las cifras; «Marcar todo como
// leído» y «Guardar» de una guía cambian en el acto y deshacen si falla;
// «La quiero» y el check-in del torneo, igual.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo estático ──')
{
  // Desde la 989 las baldosas ya no llevan párrafo ni chips en ningún ancho.
  check('retos.css: dos columnas en el móvil', /max-width: 760px\) \{\n  \.rt-lista \{\n    grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/.test(leer('css/retos.css')) && !/rj-chips/.test(leer('retos.html')))
  check('comunidad.css: en el móvil las cifras van al final', /\.com-cifras \{ order: 10/.test(leer('css/comunidad.css')))
  const gl = leer('js/glosario.js')
  check('glosario: índice de letras, buscador, <details> por término (abiertos en el PC) y la ancla abre', /export function pintarMandos\(/.test(gl) && /<details class="glosario-termino"/.test(gl) && /abiertos: !window\.matchMedia\?\.\('\(max-width: 900px\)'\)\.matches/.test(gl) && /hashchange/.test(gl) && /enterkeyhint="search" id="glosarioBuscar"/.test(leer('glosario.html')))
  check('foro: «Marcar todo como leído» cambia ya y recarga solo si falla', /boton\.remove\(\)\n    for \(const el of document\.querySelectorAll\('\.foro-punto-nuevo, \.foro-chapa-nuevos'\)\) el\.remove\(\)/.test(leer('js/foro.js')) && /if \(ok\) return\n    showToast\('No se ha podido marcar como leído\.'\)\n    setTimeout\(\(\) => window\.location\.reload\(\), 900\)/.test(leer('js/foro.js')))
  check('guía: «Guardar» pinta ya y deshace si falla', /pintarGuardada\(btn, !estaba\)/.test(leer('js/guia.js')) && /if \(error\) \{\n    pintarGuardada\(btn, estaba\)/.test(leer('js/guia.js')))
  const deseos = leer('js/mi-coleccion/deseos.js')
  check('«La quiero»: la carta entra (y sale) de la lista antes de que conteste la base, y vuelve si falla', /provisional/.test(deseos) && /ctx\.deseos = ctx\.deseos\.filter\(\(x\) => x !== provisional\)/.test(deseos) && /const quitadas = ctx\.deseos\.filter/.test(deseos))
  check('torneo: el check-in se marca al pulsar y vuelve si falla', /btn\.textContent = 'Participación confirmada'/.test(leer('js/torneos/torneo.js')) && /btn\.disabled = false\n      btn\.textContent = antes/.test(leer('js/torneos/torneo.js')))
  check('meter las marcadas en un álbum cierra el diálogo y sale del modo en el acto', /\$\('mcElegirAlbum'\)\.close\(\)\n  modoMarcar\(false\)\n  try \{\n    const r = await albumes\.meterCartas/.test(leer('js/mi-coleccion.js')))
}

const b = await chromium.launch()
const movil = async (init) => { const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' }); await ctx.addInitScript(() => { try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {} }); if (init) await ctx.addInitScript(init); return ctx }
const pc = async (init) => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' }); if (init) await ctx.addInitScript(init); return ctx }
const abrir = async (ctx, ruta, ms = 1800) => { const p = await ctx.newPage(); const errores = []; p.on('pageerror', (e) => errores.push(e.message)); await p.goto(`${BASE}/${ruta}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(ms); p.errores = errores; return p }

console.log('\n── 2. Retos y Comunidad en el iPhone ──')
{
  const ctx = await movil()
  const p = await abrir(ctx, 'retos.html')
  const r = await p.evaluate(() => { const retos = [...document.querySelectorAll('.rt-reto')]; const tops = retos.map((x) => Math.round(x.getBoundingClientRect().top)); return { n: retos.length, enParejas: tops[0] === tops[1] && tops[2] === tops[3] && tops[4] === tops[5], subtextos: retos.filter((x) => x.querySelector('.rt-cuerpo > .subtext')?.getBoundingClientRect().height > 0).length, alto: document.documentElement.scrollHeight, botones: retos.every((x) => x.tagName === 'A' && x.getBoundingClientRect().height >= 44) } })
  // Desde la 989 la baldosa entera es el enlace.
  check('los seis retos en parejas, sin párrafo, que se tocan enteros y la página por debajo de 2.000 px (era 3.100)', r.n === 6 && r.enParejas && r.subtextos === 0 && r.alto < 2000 && r.botones && !p.errores.length, JSON.stringify(r))
  const u = await abrir(ctx, 'usuarios.html')
  const o = await u.evaluate(() => ({ cifras: Math.round(document.querySelector('.com-cifras').getBoundingClientRect().top), gente: Math.round(document.querySelector('.com-dos').getBoundingClientRect().top) }))
  check('en Comunidad la gente va antes que las cifras', o.gente < o.cifras, JSON.stringify(o))
  await ctx.close()
}

console.log('\n── 3. El glosario ──')
{
  const ctx = await movil()
  const p = await abrir(ctx, 'glosario.html')
  const g = await p.evaluate(() => { const ds = [...document.querySelectorAll('details.glosario-termino')]; const m = document.getElementById('glosarioMandos'); return { n: ds.length, abiertos: ds.filter((d) => d.open).length, letras: document.querySelectorAll('#glosarioLetras a').length, pegado: getComputedStyle(m).position === 'sticky', alto: document.documentElement.scrollHeight, titulosLetra: document.querySelectorAll('.glosario-letra').length } })
  check(`en el móvil: ${g.n} términos plegados, ${g.letras} letras en el índice pegado arriba, página por debajo de 4.500 px (era 7.000)`, g.n >= 30 && g.abiertos === 0 && g.letras >= 10 && g.pegado && g.alto < 4500 && g.titulosLetra >= 10 && !p.errores.length, JSON.stringify(g))
  await p.fill('#glosarioBuscar', 'banca')
  await p.waitForTimeout(200)
  const f = await p.evaluate(() => { const vis = [...document.querySelectorAll('details.glosario-termino')].filter((d) => !d.hidden); return { visibles: vis.length, abiertos: vis.filter((d) => d.open).length, letrasVisibles: [...document.querySelectorAll('.glosario-letra')].filter((h) => !h.hidden).length } })
  check('buscar «banca» deja pocos términos, abiertos, y solo sus letras', f.visibles >= 1 && f.visibles <= 4 && f.abiertos === f.visibles && f.letrasVisibles <= f.visibles, JSON.stringify(f))
  await p.fill('#glosarioBuscar', '')
  await p.waitForTimeout(200)
  check('vaciar devuelve la lista entera', (await p.$$eval('details.glosario-termino', (ds) => ds.filter((d) => !d.hidden).length)) >= 30)
  await p.goto(`${BASE}/glosario.html#sir`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1200)
  check('llegar por ancla (#sir) abre ese término', await p.$eval('#sir', (d) => d.open && d.getBoundingClientRect().top < innerHeight))
  await ctx.close()
  const c2 = await pc()
  const q = await abrir(c2, 'glosario.html')
  check('en el PC los términos salen abiertos', (await q.$$eval('details.glosario-termino', (ds) => ds.length >= 30 && ds.every((d) => d.open))))
  await c2.close()
}

console.log('\n── 4. Botones que cambian ya ──')
{
  // Guardar una guía con la base tardando: el marcador cambia en el acto.
  const ctx = await pc("window.__FAKE_GUIAS__ = [{ id: 'g1', slug: 'g1', title: 'Guía uno', status: 'published' }]; window.__FAKE_RETRASO__ = { user_profiles: 1500 }")
  const p = await abrir(ctx, 'guia.html?slug=g1', 2500)
  const antes = await p.getAttribute('#btnSave', 'aria-label')
  await p.click('#btnSave')
  await p.waitForTimeout(150)
  const enElActo = await p.getAttribute('#btnSave', 'aria-label')
  await p.waitForTimeout(2200)
  const despues = await p.getAttribute('#btnSave', 'aria-label')
  check('«Guardar» de una guía cambia a los 150 ms, antes de que conteste la base, y se queda', antes === 'Guardar' && enElActo !== 'Guardar' && despues === enElActo && !p.errores.length, JSON.stringify({ antes, enElActo, despues, errores: p.errores }))
  await ctx.close()
  // Marcar todo como leído en el índice del foro, con la base tardando.
  const c2 = await pc("window.__FAKE_SECCIONES__ = [{}]; window.__FAKE_FOROS__ = [{}, {}]; window.__FAKE_TEMAS__ = [{ board_id: 'foro-1' }, { board_id: 'foro-2' }]; window.__FAKE_RETRASO__ = { forum_read_marks: 1500 }")
  const f = await abrir(c2, 'foro.html', 2500)
  const hayBoton = await f.locator('#btnMarcarLeido').count()
  if (hayBoton) {
    const nuevosAntes = await f.locator('.foro-punto-nuevo, .foro-chapa-nuevos').count()
    await f.click('#btnMarcarLeido')
    await f.waitForTimeout(150)
    const enElActo = await f.evaluate(() => ({ puntos: document.querySelectorAll('.foro-punto-nuevo, .foro-chapa-nuevos').length, boton: !!document.getElementById('btnMarcarLeido'), leidas: document.querySelectorAll('.foro-fila-leida').length }))
    check('«Marcar todo como leído» quita los puntos y el botón a los 150 ms', nuevosAntes > 0 && enElActo.puntos === 0 && !enElActo.boton && enElActo.leidas > 0, JSON.stringify({ nuevosAntes, enElActo }))
  } else {
    check('el índice del foro enseña «Marcar todo como leído» con temas sin leer', false, 'sin #btnMarcarLeido')
  }
  await c2.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
