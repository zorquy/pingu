// Tanda 894 — lo último que viste, pintado ya (R2) y consultas en paralelo
// (R3) de la propuesta «Rápida y limpia».
//
// Lo que se mira: el ayudante puro (guardar, leer, caducar, no guardar lo
// que no cabe, olvidar al salir); que las seis listas —foro, meta,
// noticias, lanzamientos, torneos y el Panel de Mi colección— GUARDEN lo
// que pintan; que al volver se pinte lo guardado ANTES de que conteste la
// base, con el punto de «pidiendo lo nuevo» encendido, y que lo de ahora
// lo sustituya y apague el punto; que la clave lleve a quien mira; y que el
// foro y los torneos pidan a la vez lo que no depende entre sí.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro ──')
{
  const uv = await import(`${RAIZ}/js/ultima-vista.js`)
  const almacen = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size } } }
  const docDe = (ids) => { const els = Object.fromEntries(ids.map((id) => [id, { innerHTML: '', hidden: false, classList: { _s: new Set(), contains(c) { return this._s.has(c) }, toggle(c, f) { f ? this._s.add(c) : this._s.delete(c) }, add(c) { this._s.add(c) }, remove(c) { this._s.delete(c) } } }])); return { getElementById: (id) => els[id] || null, documentElement: { classList: { _s: new Set(), add(c) { this._s.add(c) }, remove(c) { this._s.delete(c) }, contains(c) { return this._s.has(c) } } }, els } }
  const st = almacen()
  check('la clave lleva la página y a quien mira (sin nadie, «anon»)', uv.claveDeVista('foro', 'u1') === 'pokedoc-uv-foro|u1' && uv.claveDeVista('meta:todos:14') === 'pokedoc-uv-meta:todos:14|anon')
  const d1 = docDe(['a', 'b'])
  d1.els.a.innerHTML = '<p>hola</p>'; d1.els.b.classList.add('hidden')
  const partes = uv.tomarPartes(['a', 'b', 'noexiste'], d1)
  const vis = uv.visiblesDe(['a', 'b'], d1)
  check('tomarPartes y visiblesDe leen lo que hay (y se saltan lo que no existe)', partes.a === '<p>hola</p>' && partes.b === '' && !('noexiste' in partes) && vis.a === true && vis.b === false)
  const K = uv.claveDeVista('x', 'u')
  check('guardar y leer', uv.guardarVista(K, partes, { visibles: vis, storage: st, ahora: 1000 }) && uv.leerVista(K, { storage: st, ahora: 2000 })?.partes.a === '<p>hola</p>')
  check('caduca a la semana', uv.leerVista(K, { storage: st, ahora: 1000 + uv.TTL_MS + 1 }) === null && uv.leerVista(K, { storage: st, ahora: 1000 + uv.TTL_MS - 1 }) !== null)
  check('lo que no cabe no se guarda', uv.guardarVista('grande', { a: 'x'.repeat(uv.MAX_CARACTERES) }, { storage: st }) === false && st.getItem('grande') === null)
  check('basura guardada no revienta: null', (st.setItem('rota', '{no es json'), uv.leerVista('rota', { storage: st }) === null) && (st.setItem('vieja', JSON.stringify({ partes: 'x' })), uv.leerVista('vieja', { storage: st }) === null))
  const d2 = docDe(['a', 'b'])
  const pintado = uv.pintarUltimaVista(K, { doc: d2, storage: st, ahora: 2000 })
  check('pintar: mete el HTML, aplica lo escondido y enciende el punto', pintado && d2.els.a.innerHTML === '<p>hola</p>' && d2.els.b.classList.contains('hidden') && d2.documentElement.classList.contains('uv-actualizando'))
  uv.vistaAlDia(d2)
  check('  …y vistaAlDia lo apaga', !d2.documentElement.classList.contains('uv-actualizando'))
  check('sin nada guardado, pintar devuelve null y no toca nada', uv.pintarUltimaVista('nada', { doc: docDe(['a']), storage: st }) === null)
  st.setItem('otra-cosa', '1')
  check('olvidarVistas quita SOLO las nuestras (al salir de la cuenta)', uv.olvidarVistas(st) >= 1 && st.getItem(K) === null && st.getItem('otra-cosa') === '1')
}

console.log('\n── 2. Lo estático ──')
{
  check('foro: el rol y las marcas, a la vez; los perfiles y la franja, a la vez; la lateral desde el principio', /Promise\.all\(\[rolEnElEquipo\(sesion\), marcasDeLectura\(/.test(leer('js/foro.js')) && /Promise\.all\(\[perfilesPorId\([^\n]*loQueSeHabla\(/.test(leer('js/foro.js')) && /const lateralLista = panelDeNumerosHtml\(\)/.test(leer('js/foro.js')))
  const t = leer('js/torneos/torneos.js')
  check('torneos: torneos e inscripciones a la vez; rondas y perfiles a la vez', /Promise\.all\(\[\s*supabase\s*\.from\('tournaments'\)[\s\S]*?\.from\('tournament_registrations'\)/.test(t) && /const \[rondasRes, perfilesRes\] = await Promise\.all/.test(t))
  check('al salir de la cuenta se olvidan las vistas', /signOut\(\) \{[\s\S]*?olvidarVistas\(\)/.test(leer('js/app.js')))
  check('el punto junto al título, y quieto con «menos movimiento»', /html\.uv-actualizando \.page-content h1::after \{[^}]*animation: uv-late/.test(leer('css/style.css')) && /prefers-reduced-motion: reduce\) \{ html\.uv-actualizando \.page-content h1::after \{ animation: none/.test(leer('css/style.css')))
  check('las seis guardan y pintan', ['js/foro.js', 'js/meta.js', 'js/noticias.js', 'js/lanzamientos.js', 'js/torneos/torneos.js', 'js/mi-coleccion.js'].every((f) => /pintarUltimaVista\(/.test(leer(f)) && /guardarVista\(/.test(leer(f))))
}

const b = await chromium.launch()
const nuevo = async (init) => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(() => { try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {} })
  if (init) await ctx.addInitScript(init)
  return ctx
}
const claves = (p) => p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('pokedoc-uv-')))

console.log('\n── 3. Las seis guardan lo que pintan ──')
{
  const ctx = await nuevo('window.__FAKE_SECCIONES__ = [{}]; window.__FAKE_FOROS__ = [{}, {}, {}]; window.__FAKE_NOTICIAS__ = [{}, {}, {}]')
  const p = await ctx.newPage()
  const esperadas = [
    ['foro.html', 'pokedoc-uv-foro|admin-1', 'foroPrincipal', 'foro-fila'],
    ['meta.html?dias=30', 'pokedoc-uv-meta:todos:30|anon', 'metaRanking', ''],
    ['noticias.html', 'pokedoc-uv-noticias|anon', 'noticiasRejilla', 'noticia'],
    ['lanzamientos.html', 'pokedoc-uv-lanzamientos:WEST|anon', 'listaPasados', ''],
    ['torneos.html', 'pokedoc-uv-torneos|admin-1', 'listaTorneos', ''],
    ['mi-coleccion.html?ver=resumen', 'pokedoc-uv-panel|admin-1', 'mcVistazos', 'mc-vistazo'],
  ]
  for (const [ruta, clave, parte, huella] of esperadas) {
    await p.goto(`${BASE}/${ruta}`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(2500)
    const r = await p.evaluate(({ clave, parte }) => { const v = JSON.parse(localStorage.getItem(clave) || 'null'); return v ? { t: v.t, tiene: typeof v.partes?.[parte] === 'string', largo: (v.partes?.[parte] || '').length, huella: v.partes?.[parte] || '', punto: document.documentElement.classList.contains('uv-actualizando') } : null }, { clave, parte })
    check(`/${ruta}: guarda «${clave}» con #${parte}${huella ? ` (lleva «${huella}»)` : ''}, y el punto apagado`, r && r.tiene && (!huella || r.huella.includes(huella)) && !r.punto, JSON.stringify(r && { ...r, huella: r.huella.slice(0, 60) }))
  }
  await ctx.close()
}

console.log('\n── 4. Al volver se pinta lo guardado antes de que conteste la base ──')
{
  // Se siembra una vista con una MARCA y se mira si la marca llegó a verse
  // (un observador la apunta en cuanto aparece): así no depende de cuánto
  // tarde la base del doble en contestar.
  const sembrar = (clave, partes, visibles) => `
    localStorage.setItem(${JSON.stringify(clave)}, JSON.stringify({ t: Date.now(), partes: ${JSON.stringify(partes)}, visibles: ${JSON.stringify(visibles || null)} }))
    window.__uvVisto = false
    const obs = new MutationObserver(() => { if (document.getElementById('uvMarca')) window.__uvVisto = true })
    // Al correr esto todavía no hay <html>: se engancha en cuanto lo haya.
    const arrancar = () => (document.documentElement ? obs.observe(document.documentElement, { childList: true, subtree: true }) : setTimeout(arrancar, 0))
    arrancar()
  `
  const casos = [
    ['foro.html', 'pokedoc-uv-foro|admin-1', { foroPrincipal: '<div class="foro-fila" id="uvMarca">de la última vez</div>' }, null, { forum_boards_resumen: 1500, forum_sections: 1500, foro_resumen: 1500 }, '#foroPrincipal .foro-fila'],
    ['meta.html?dias=30', 'pokedoc-uv-meta:todos:30|anon', { metaRanking: '<li id="uvMarca">de la última vez</li>', metaTotales: 'x' }, { metaCabeceraTabla: true }, null, '#metaRanking'],
    ['noticias.html', 'pokedoc-uv-noticias|anon', { noticiasRejilla: '<p id="uvMarca">de la última vez</p>' }, null, { guides: 1500 }, '#noticiasRejilla'],
    ['lanzamientos.html', 'pokedoc-uv-lanzamientos:WEST|anon', { listaPasados: '<p id="uvMarca">de la última vez</p>' }, { seccionPasados: true }, { tcg_sets: 1500 }, '#listaPasados'],
    ['torneos.html', 'pokedoc-uv-torneos|admin-1', { listaTorneos: '<p id="uvMarca">de la última vez</p>' }, null, { tournaments: 1500 }, '#listaTorneos'],
    ['mi-coleccion.html?ver=resumen', 'pokedoc-uv-panel|admin-1', { mcVistazos: '<section class="mc-vistazo" id="uvMarca">de la última vez</section>' }, null, { user_collection: 1500 }, '#mcVistazos'],
  ]
  for (const [ruta, clave, partes, visibles, retraso, caja] of casos) {
    // El índice del foro llega por `foro_resumen()` desde la 1017: el retraso vale para las tablas y para las funciones.
    const ctx = await nuevo((retraso ? `window.__FAKE_RETRASO__ = ${JSON.stringify(retraso)}; window.__RPC_RETRASO__ = ${JSON.stringify(retraso)}\n` : '') + 'window.__FAKE_SECCIONES__ = [{}]; window.__FAKE_FOROS__ = [{}, {}, {}]; window.__FAKE_NOTICIAS__ = [{}, {}, {}]\n' + sembrar(clave, partes, visibles))
    const p = await ctx.newPage()
    await p.goto(`${BASE}/${ruta}`, { waitUntil: 'domcontentloaded' })
    // Mientras la base tarda: la marca a la vista y el punto encendido.
    let enMedio = null
    if (retraso) {
      await p.waitForTimeout(700)
      enMedio = await p.evaluate(() => ({ marca: !!document.getElementById('uvMarca') && document.getElementById('uvMarca').getBoundingClientRect().height > 0, punto: document.documentElement.classList.contains('uv-actualizando'), esqueleto: !!document.querySelector('.skeleton, .esq-linea, .esq-meta') }))
    }
    await p.waitForTimeout(retraso ? 2800 : 2500)
    const despues = await p.evaluate(({ clave, caja }) => ({ visto: window.__uvVisto, marcaAun: !!document.getElementById('uvMarca'), punto: document.documentElement.classList.contains('uv-actualizando'), guardadoSinMarca: !(localStorage.getItem(clave) || '').includes('uvMarca'), algo: (document.querySelector(caja)?.innerHTML || '').length > 20 }), { clave, caja })
    if (retraso) check(`/${ruta}: con la base tardando, se ve lo de la última vez (sin esqueleto) y el punto encendido`, enMedio && enMedio.marca && enMedio.punto, JSON.stringify(enMedio))
    check(`/${ruta}: la marca llegó a verse, lo de ahora la sustituyó, el punto se apagó y lo guardado ya es lo nuevo`, despues.visto && !despues.marcaAun && !despues.punto && despues.guardadoSinMarca, JSON.stringify(despues))
    await ctx.close()
  }
}

console.log('\n── 5. Lo guardado es de quien mira ──')
{
  const ctx = await nuevo('window.__FAKE_SESSION__ = "none"')
  const p = await ctx.newPage()
  await p.goto(`${BASE}/foro.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2000)
  const k = await claves(p)
  check('sin cuenta, el foro se guarda bajo «anon», no bajo nadie', k.includes('pokedoc-uv-foro|anon') && !k.some((x) => x.includes('admin-1')), k.join())
  await p.goto(`${BASE}/torneos.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2000)
  const borradas = await p.evaluate(async () => { const m = await import('/js/ultima-vista.js'); return m.olvidarVistas() })
  check('olvidarVistas en el navegador quita las que había', borradas >= 2 && (await claves(p)).length === 0, String(borradas))
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
