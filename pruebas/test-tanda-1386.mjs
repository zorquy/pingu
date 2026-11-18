// Tanda 1386 — arreglar los errores del panel (PINGU, con el CSV agrupado de
// la 1385 delante: «necesito arreglarlos»):
//   · el ruido ajeno no se apunta: el script de analítica de Netlify (4.194
//     «Failed to fetch»), extensiones y navegadores de dentro de otra app,
//     transiciones, ResizeObserver, fallos de red sin fichero nuestro, la
//     CSP de connect.facebook.net y las visitas que no se apuntan por la red;
//   · los desajustes de despliegue vistos por un namespace recargan;
//   · los fallos de verdad: Ajustes pintaba en una caja que ya no estaba,
//     la carrera de premios con un solo punto, «Tienes N», la franja de
//     compartir y el botón del nivel;
//   · la migración borra el ruido guardado y ordena lo demás.
import { readFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── La migración, contra PostgreSQL ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1386'
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`])
  psql(['-c', `create database ${BD}`])
  const filas = [
    // [mensaje, traza, lo que debe quedar: borrada | new | dismissed | reviewed]
    ['Failed to fetch', 'TypeError: Failed to fetch\n    at https://pokedoc.es/.netlify/scripts/rum:1:9', 'borrada'],
    ['Load failed', null, 'borrada'],
    ['TypeError: Failed to fetch', '[en línea: sí]\nat cargar (https://pokedoc.es/js/foro.js:10:3)', 'new'],
    ['Script error.', null, 'borrada'],
    ['Skipping view transition because skipTransition() was called.', null, 'borrada'],
    ['Old view transition aborted by new view transition.', null, 'borrada'],
    ['ResizeObserver loop completed with undelivered notifications.', null, 'borrada'],
    ["TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')", null, 'borrada'],
    ["Cannot read properties of undefined (reading 'M_ID')", 'at chrome-extension://abc/content.js:1:1', 'borrada'],
    ['Talisman extension has not been configured yet. Please continue with onboarding.', null, 'borrada'],
    ['No se pudo registrar la visita: JWT expired', 'PGRST303', 'borrada'],
    ['No se pudo registrar la visita: permission denied for table page_views', '42501', 'new'],
    ['CSP (informe) connect-src: https://connect.facebook.net', 'https://pokedoc.es/?fbclid=x:1', 'borrada'],
    ['CSP (informe) img-src: https://otra.com', 'https://pokedoc.es/js/x.js:3', 'new'],
    ["SyntaxError: Importing binding name 'idiomasDeLaVersion' is not found.", null, 'dismissed'],
    ["icons.gift is not a function. (In 'icons.gift(20)', 'icons.gift' is undefined)", null, 'dismissed'],
    ["Cannot set properties of null (setting 'innerHTML')", 'at pintarla (https://pokedoc.es/js/ajustes.js:335:5)', 'reviewed'],
    ["Cannot set properties of null (setting 'innerHTML')", 'at pintar (https://pokedoc.es/js/foro.js:5:5)', 'new'],
    ["Uncaught TypeError: Cannot read properties of undefined (reading 'premios')", null, 'reviewed'],
    ['Vuelta de Supabase con fallo: server_error · unexpected_failure · Database error saving new user', null, 'reviewed'],
    ['TypeError: algo nuestro de verdad', 'at f (https://pokedoc.es/js/mazos.js:1:1)', 'new'],
  ]
  const lit = (x) => (x === null ? 'null' : `'${x.replace(/'/g, "''")}'`)
  const r = psql(['-d', BD, '-c', `create table client_errors (id uuid default gen_random_uuid() primary key, user_id uuid, message text not null, stack text, page_url text, user_agent text, status text not null default 'new', created_at timestamptz not null default now(), esperado text);
    insert into client_errors (message, stack, esperado) values ${filas.map(([m, s, e]) => `(${lit(m)}, ${lit(s)}, '${e}')`).join(',\n')};
    insert into client_errors (message, status, esperado) values ('Load failed', 'reviewed', 'borrada');`])
  check('el andamio carga', r.status === 0, r.stderr)
  const mig = readFileSync(`${REPO}/supabase-migration-1386-errores-limpieza.sql`, 'utf8')
  check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  // Sentencia a sentencia, cada una en su conexión (tanda 631), y dos veces.
  const sentencias = mig.split(/;\s*\n(?=\s*(?:--[^\n]*\n\s*)*(?:delete|update|create|grant))/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let bien = true
  for (let v = 0; v < 2; v++) for (const st of sentencias) {
    const x = psql(['-d', BD, '-c', st.endsWith(';') ? st : st + ';'])
    if (x.status !== 0) { bien = false; console.log(x.stderr) }
  }
  check('la 1386 entra sentencia a sentencia, y otra vez encima', bien && sentencias.length === 3, sentencias.length)
  const q = (s) => psql(['-At', '-F', '|', '-d', BD, '-c', s]).stdout.trim()
  const malas = q(`select esperado || ' ≠ ' || status || ' · ' || left(message, 60) from client_errors where esperado <> status`)
  check('borra el ruido y deja como nuevo lo nuestro', !/borrada ≠/.test(malas) && q(`select count(*) from client_errors where esperado = 'borrada'`) === '0', malas)
  check('desajustes descartados, arreglados revisados y lo de verdad sigue nuevo', !malas, malas)
  psql(['-c', `drop database if exists ${BD}`])
}

const browser = await chromium.launch()

console.log('── Lo que se apunta y lo que no ──')
{
  const page = await browser.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  const r = await page.evaluate(async () => {
    const m = await import('/js/error-log.js')
    const pv = await import('/js/page-views.js')
    const E = (stack) => ({ stack })
    const ruido = [
      ['Failed to fetch', E('TypeError: Failed to fetch\n at https://pokedoc.es/.netlify/scripts/rum:1:2')],
      ['Load failed', E('')],
      ["TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')", E('global code@https://pokedoc.es/foro:2:30')],
      ["TypeError: undefined is not an object (evaluating 'window._META.IABInnerFrame')", null],
      ["ReferenceError: Can't find variable: __firefox__", null],
      ["Cannot read properties of undefined (reading 'M_ID')", E('at chrome-extension://abc/js/content.js:1:1')],
      ['Failed to connect to MetaMask', E('at Object.connect (chrome-extension://nkbih/inpage.js:1:1)')],
      ['Uncaught Error: Error invoking postMessage: Java exception was raised during method invocation', null],
      ['Skipping view transition because skipTransition() was called.', null],
      ['Old view transition aborted by new view transition.', null],
      ['ResizeObserver loop completed with undelivered notifications.', null],
    ].filter(([msg, e]) => !m.esRuido(msg, e)).map(([msg]) => msg)
    const nuestros = [
      ['TypeError: Failed to fetch', E('TypeError: Failed to fetch\n at cargar (https://pokedoc.es/js/foro.js:10:3)')],
      ["Cannot set properties of null (setting 'innerHTML')", E('at pintarla (https://pokedoc.es/js/ajustes.js:335:5)')],
      ['x', E('at f (https://pokedoc.es/js/a.js:1:1)\n at chrome-extension://abc/x.js:1:1')],
    ].filter(([msg, e]) => m.esRuido(msg, e)).map(([msg]) => msg)
    const o = 'https://pokedoc.es'
    return {
      ruido,
      nuestros,
      desajuste: ["icons.gift is not a function. (In 'icons.gift(20)')", 'datos.firmaDeLineas is not a function', 'ctx.filaDeSetHtml is not a function', "SyntaxError: Indirectly exported binding name 'sinReglas' is not found.", "'text/html' is not a valid JavaScript MIME type."].every((x) => m.DESAJUSTE.test(x)),
      noDesajuste: !m.DESAJUSTE.test('foo.bar is not a function') && !m.DESAJUSTE.test("Cannot read properties of undefined (reading 'premios')"),
      facebook: m.cspEsNuestra('https://pokedoc.es/?fbclid=1', o, 'https://connect.facebook.net/es_ES/sdk.js'),
      otra: m.cspEsNuestra('https://pokedoc.es/js/a.js', o, 'https://otra.com/x.png'),
      enLinea: m.cspEsNuestra('https://pokedoc.es/js/a.js', o, 'inline'),
      visitaRed: ['Failed to fetch', 'TypeError: Load failed', 'JWT expired', 'NetworkError when attempting to fetch resource.'].some((x) => pv.esFalloDeVerdad({ message: x })),
      visitaBase: pv.esFalloDeVerdad({ message: 'permission denied for table page_views', code: '42501' }),
    }
  })
  check('el ruido del CSV no se apunta', r.ruido.length === 0, r.ruido.join(' | '))
  check('lo nuestro (con su fichero en la traza) sí, aunque sea de red', r.nuestros.length === 0, r.nuestros.join(' | '))
  check('los desajustes por namespace y por un módulo borrado recargan', r.desajuste && r.noDesajuste)
  check('la CSP del navegador de Facebook no, la de otro host desde lo nuestro sí', !r.facebook && r.otra && r.enLinea, JSON.stringify(r))
  check('una visita que no entra por la red o por la sesión no se apunta; por la base, sí', !r.visitaRed && r.visitaBase)
  await page.close()
}

console.log('── Ajustes: cambiar de apartado a medio cargar ──')
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_PERFILES__ = [{ id: 'user-1', username: 'misty' }]
  })
  // Los módulos de la dirección llegan tarde: da tiempo a irse.
  await ctx.route(/\/js\/(cambio-direccion|cambio-propuesta-puro|cumple|play-pokemon)\.js/, async (rt) => {
    await new Promise((res) => setTimeout(res, 900))
    await rt.continue()
  })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/ajustes?ver=direccion`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#ajLista a[data-ver="privacidad"]', { timeout: 10000 }).catch(() => {})
  await page.click('#ajLista a[data-ver="privacidad"]').catch(() => {})
  await page.waitForTimeout(2500)
  check('se va a Privacidad sin esperar y no salta ningún error', errores.length === 0, errores.join(' | '))
  check('  …y se queda en Privacidad', /Privacidad/.test(await page.textContent('#ajPanel h2').catch(() => '')))
  await page.goto(`${BASE}/ajustes?ver=direccion`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  check('esperando, la dirección se pinta como siempre', (await page.$('#ajDireccion form, #ajDireccion .aj-nota')) !== null)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── Los demás arreglos, en el código ──')
{
  const leer = (f) => readFileSync(`${REPO}/${f}`, 'utf8')
  check('la carrera de premios no pasa del último punto', /Math\.min\(turnoEn\(ev\), carrera\.length - 1\)/.test(leer('js/repeticiones/carrera.js')))
  check('«Tienes N» no repinta una ficha que ya no está', /if \(!\$\('cartaAcciones'\) \|\| !\$\('cmAnadir'\)\) return/.test(leer('js/carta-mercado.js')))
  check('la franja de compartir, sin HTML, no para la página', /if \(!esMia \|\| !\$\('mcPublicaEstado'\)\) return/.test(leer('js/mi-coleccion.js')))
  check('el botón del nivel, con ?.', /getElementById\('btnLevelInfo'\)\?\.addEventListener/.test(leer('js/usuario.js')) && /getElementById\('btnLevelInfo'\)\?\.addEventListener/.test(leer('js/perfil.js')))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
