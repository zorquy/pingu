// Tanda 897 — la página también desde la caché del service worker (R5),
// atada al despliegue.
//
// Lo que se mira: lo estático (qué páginas se guardan y que un cambio vacía
// las DOS cachés); y en Chromium, con dos despliegues simulados por `route`
// (Playwright intercepta también lo que pide el worker): la tercera carga
// de /aprender llega desde el worker; tras el despliegue B se sirve una
// pantalla vieja —como mucho una— y la revisión deja guardada la nueva; y un
// cambio en un FICHERO (despliegue C) vacía también las páginas.
import { readFileSync, writeFileSync, utimesSync, unlinkSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

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
  const sw = leer('sw.js')
  check('las páginas tienen su caché y entran por la navegación', /const PAGINAS = 'pokedoc-paginas-\d+'/.test(sw) && /if \(esPaginaDeCache\(new URL\(req\.url\)\)\) \{\s*e\.respondWith\(paginaDeCasa\(req, e\)\)/.test(sw))
  check('  …solo la dirección pelada: sin consulta, un solo trozo', /if \(url\.origin !== self\.location\.origin \|\| url\.search\) return false/.test(sw) && /\^\\\/\(\[a-z0-9-\]\*\)\(\\\.html\)\?\$/.test(sw))
  for (const p of ['feria', 'sin-conexion', 'auth', 'admin', 'guia', 'carta', 'coleccion', 'curso', 'categoria']) check(`  …y /${p} se queda fuera`, new RegExp(`SIN_PAGINA = new Set\\(\\[[^\\]]*'${p}'`).test(sw))
  check('un cambio en una página o en un fichero vacía LAS DOS cachés', /if \(cambio\) await vaciarTodo\(\)/.test(sw) && /caches\.delete\(ASSETS\), caches\.delete\(PAGINAS\)/.test(sw))
  check('  …y la de páginas sobrevive al activar', /k !== PAGINAS/.test(sw))
  check('la copia guardada se sirve ya y la red va por detrás', /const guardada = await \(await caches\.open\(PAGINAS\)\)\.match\(req\.url\)[\s\S]*?if \(guardada\) \{\s*e\.waitUntil\(revision\.catch/.test(sw))
  check('  …una respuesta redirigida no se guarda', /fresca\.redirected\) return fresca/.test(sw))
}

console.log('\n── 2. En Chromium, con dos despliegues ──')
// `route` no llega a lo que pide el worker, así que los despliegues se
// escriben en el sitio servido (como hacen la 324 y la 331): una página de
// prueba con su hoja, y a cada «despliegue» se reescribe una de las dos con
// otra fecha, que es la firma que da el servidor de pruebas.
const SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
const SITIO = process.env.PD_SITIO || `${SC}/test-forum`
let reloj = Math.floor(Date.now() / 1000)
const desplegar = (fichero, texto) => {
  writeFileSync(`${SITIO}/${fichero}`, texto)
  reloj += 10
  utimesSync(`${SITIO}/${fichero}`, reloj, reloj)
}
const pagina = (v) => leer('aprender.html').replace('</head>', `<link rel="stylesheet" href="/css/t897.css"><meta name="despliegue" content="${v}"></head>`)
desplegar('css/t897.css', '/* A */')
desplegar('t897.html', pagina('A'))
const b = await chromium.launch()
{
  const ctx = await b.newContext({ locale: 'es-ES' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
  const p = await ctx.newPage()
  const marca = () => p.$eval('meta[name="despliegue"]', (m) => m.content).catch(() => 'ninguna')
  const desdeSw = async () => {
    let sw = null
    const oir = (r) => { if (/\/t897\.html$/.test(r.url())) sw = r.fromServiceWorker() }
    p.on('response', oir)
    await p.goto(`${BASE}/t897.html`, { waitUntil: 'load' })
    p.off('response', oir)
    return sw
  }
  const guardada = () => p.evaluate(async () => { const r = await caches.match('/t897.html', { cacheName: 'pokedoc-paginas-1' }); return r ? /name="despliegue" content="([A-Z])"/.exec(await r.text())?.[1] : null })
  await p.goto(`${BASE}/t897.html`, { waitUntil: 'load' })
  await p.evaluate(async () => { await navigator.serviceWorker.ready })
  // Segunda carga: ya controlada, el worker guarda la página. Tercera: de ahí.
  await desdeSw()
  await p.waitForTimeout(800)
  const tercera = await desdeSw()
  check('la tercera carga llega desde el worker, con la página del despliegue A', tercera === true && (await marca()) === 'A', `desdeSw=${tercera} marca=${await marca()}`)
  await p.waitForTimeout(800)
  check('  …guardada en la caché de páginas', (await guardada()) === 'A', await guardada())

  // Despliegue B: cambia la página.
  desplegar('t897.html', pagina('B'))
  const cuarta = await desdeSw()
  const vieja = await marca()
  check('tras el despliegue B, la primera pantalla es la guardada (vieja, una vez)', cuarta === true && vieja === 'A', `desdeSw=${cuarta} marca=${vieja}`)
  await p.waitForTimeout(1500)
  check('  …la revisión por detrás ve el cambio y deja guardada la nueva', (await guardada()) === 'B', await guardada())
  await desdeSw()
  check('  …y la siguiente ya es la del despliegue B', (await marca()) === 'B', await marca())
  await p.waitForTimeout(1500)

  // Despliegue C: cambia SOLO la hoja. Se pide desde la página, sin
  // navegación en vuelo, para que lo único que pase sea su revisión.
  desplegar('css/t897.css', '/* C */')
  await p.evaluate(async () => { await (await fetch('/css/t897.css')).text() })
  await p.waitForTimeout(1500)
  const tras = await p.evaluate(async () => ({ paginas: (await (await caches.open('pokedoc-paginas-1')).keys()).length, ficheros: (await (await caches.open('pokedoc-ficheros-1')).keys()).map((r) => new URL(r.url).pathname) }))
  check('un cambio en un FICHERO vacía también las páginas (las dos cachés van atadas)', tras.paginas === 0 && tras.ficheros.length === 1 && tras.ficheros[0] === '/css/t897.css', JSON.stringify(tras))
  await ctx.close()
}
for (const f of ['t897.html', 'css/t897.css']) try { unlinkSync(`${SITIO}/${f}`) } catch {}
await b.close()

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
