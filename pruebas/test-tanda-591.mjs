// Tanda 591 — enlaces cortos: /rep/<id> y /lab/<id>.
//
// PINGU: «los enlaces, hacerlos muchísimo más cortos». Una repetición sin
// cuenta y una posición del laboratorio llevaban la partida entera dentro
// del enlace (miles de caracteres). Ahora la carga comprimida se guarda en
// `enlaces_cortos` y el enlace lleva ocho letras.
//
//   1. La base, contra PostgreSQL (sql-enlaces-cortos.sql): crear y leer
//      por función, la forma, los topes y que nadie lista la tabla.
//   2. Las piezas (js/enlace-corto.js) y las redirecciones de netlify.toml.
//   3. La página de repeticiones: sin cuenta sale corto, el largo a un
//      botón, abrir un corto, uno que no existe, uno que no se puede leer y
//      uno de una POSICIÓN.
//   4. El laboratorio: compartir una posición da /lab/<id> y abrirlo la
//      monta igual.
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const { empaquetar } = await import(`${RAIZ}/js/repeticiones/enlace.js`)
const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
const { fotos: sacarFotos } = await import(`${RAIZ}/js/repeticiones/estado.js`)
const R481 = readFileSync(join(AQUI, 'registro-481.txt'), 'utf8')

console.log('\n── 1. La base, contra PostgreSQL ──')
{
  const ruta = join(AQUI, 'sql-enlaces-cortos.sql')
  check('sql-enlaces-cortos.sql prueba la forma, los topes y que no se lista', existsSync(ruta) && /la 31 no/.test(readFileSync(ruta, 'utf8')) && /no se pueden listar/.test(readFileSync(ruta, 'utf8')))
  spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-c', 'create database prueba_enlaces'], { encoding: 'utf8', timeout: 20000 })
  const r = spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-d', 'prueba_enlaces', '-f', ruta], { encoding: 'utf8', timeout: 60000 })
  const salida = r.error ? null : `${r.stdout || ''}${r.stderr || ''}`
  if (salida === null || /could not connect|No such file|connection to server/.test(salida)) {
    console.log('   (no hay PostgreSQL en /var/tmp:5433 — la prueba de la base NO se ha corrido aquí)')
  } else {
    const oks = (salida.match(/ {2}ok {2}/g) || []).length
    const fallos = salida.split('\n').filter((l) => /FALLA|ERROR/.test(l))
    check(`PostgreSQL: ${oks} comprobaciones, ninguna falla`, oks >= 26 && !fallos.length, fallos.slice(0, 2).join(' | '))
  }
  const SQL = leer('supabase-migration-enlaces-cortos.sql')
  check('nadie lee ni escribe la tabla: solo las dos funciones', /revoke all on table public\.enlaces_cortos from anon, authenticated/.test(SQL) && !/grant (select|insert|update|delete|all)[^;]*enlaces_cortos to/.test(SQL))
}

console.log('\n── 2. Las piezas ──')
{
  const toml = leer('netlify.toml')
  const rep = toml.indexOf('from = "/rep/:id"')
  const lab = toml.indexOf('from = "/lab/:id"')
  const comodin = toml.search(/from = "\/\*"/)
  check('netlify.toml: /rep/:id → /repeticiones?r=:id y /lab/:id → /constructor?pos=:id, con 302', /from = "\/rep\/:id"\s+to = "\/repeticiones\?r=:id"\s+status = 302/.test(toml) && /from = "\/lab\/:id"\s+to = "\/constructor\?pos=:id"\s+status = 302/.test(toml))
  check('  …antes de cualquier comodín', rep > 0 && lab > 0 && (comodin < 0 || (rep < comodin && lab < comodin)))
  const servidor = readFileSync('/home/claude/pruebas/herramientas/servir.py', 'utf8')
  check('  …y el servidor de pruebas hace lo mismo', /\^\/rep\//.test(servidor) && /\^\/lab\//.test(servidor))
  // El módulo importa supabase.js: aquí solo las reglas que no lo tocan.
  const EC = leer('js/enlace-corto.js')
  check('una repetición GUARDADA también va por /rep/', /export const enlaceCorto = \(id, origen = location\.origin\) => `\$\{origen\}\/rep\/\$\{encodeURIComponent\(id\)\}`/.test(leer('js/repeticiones/datos.js')))
  check('el id corto: ocho letras sin las que se confunden (ni 0, o, 1, l, i)', /\^\[a-z2-9\]\{8\}\$/.test(EC) && /'abcdefghjkmnpqrstuvwxyz23456789'/.test(leer('supabase-migration-enlaces-cortos.sql')))
}

console.log('\n── 3. Repeticiones ──')
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/></svg>'
const browser = await chromium.launch()
async function pagina(url, { antes = {}, cartas = [], sets = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(({ antes, cartas, sets }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_SETS__ = sets
    window.__PROYECTAR__ = ['tcg_cards']
    for (const [k, v] of Object.entries(antes)) window[k] = v
  }, { antes, cartas, sets })
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  return { page, ctx, errores }
}
const sala = (page) => page.waitForSelector('#repSala:not(.hidden)', { timeout: 8000 }).then(() => true).catch(() => false)
const pausar = (page) =>
  page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b?.getAttribute('aria-label') === 'Pausa') b.click()
  })
const pasos = (page) => page.evaluate(() => Number(document.getElementById('repProgreso')?.max || 0))
let guardada = null
{
  const { page, ctx, errores } = await pagina('/repeticiones.html')
  await page.fill('#repTexto', R481)
  await page.click('#repFormulario button[type=submit]')
  await sala(page)
  await pausar(page)
  const maximo = await pasos(page)
  await page.click('[data-accion="compartir"]')
  await page.waitForFunction(() => document.getElementById('repEnlace')?.value, null, { timeout: 8000 })
  const url = await page.inputValue('#repEnlace')
  const rpc = await page.evaluate(() => (window.__RPCS__ || []).find((r) => r.nombre === 'enlace_corto_crear')?.args)
  check('sin cuenta, el enlace es CORTO: /rep/ y ocho letras', new RegExp(`^${BASE}/rep/[a-z2-9]{8}$`).test(url), url)
  check('  …guardando la partida COMPRIMIDA, la misma carga del enlace largo', rpc?.p_tipo === 'repeticion' && rpc.p_carga === (await empaquetar(R481)), JSON.stringify(rpc)?.slice(0, 80))
  check('  …y lo dice: se guarda en PokeDoc, sin ningún dato tuyo', /se guarda en PokeDoc \(sin ningún dato tuyo\)/.test(await page.textContent('#repCompartirNota')))
  await page.click('[data-dlg="copiar"]')
  await page.waitForTimeout(200)
  check('«Copiar» copia el corto', (await page.evaluate(() => navigator.clipboard.readText())) === url)
  await page.click('[data-dlg="largo"]')
  const largo = await page.inputValue('#repEnlace')
  check('«Usar el enlace largo» lo cambia por el de siempre, con la partida dentro', largo === `${BASE}/repeticiones#${await empaquetar(R481)}` && (await page.locator('[data-dlg="largo"]').count()) === 0)
  check('  …y la nota ya no dice que se guarda', /lleva la partida DENTRO/.test(await page.textContent('#repCompartirNota')) && !/se guarda en PokeDoc/.test(await page.textContent('#repCompartirNota')))
  await page.click('[data-dlg="copiar"]')
  await page.waitForTimeout(200)
  check('  …y «Copiar» copia el largo', (await page.evaluate(() => navigator.clipboard.readText())) === largo)
  guardada = { id: url.split('/rep/')[1], carga: rpc?.p_carga, maximo }
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  // Abrirlo en otra pestaña, por la redirección.
  const { page, ctx, errores } = await pagina(`/rep/${guardada.id}`, { antes: { __FAKE_ENLACES_CORTOS__: [{ id: guardada.id, tipo: 'repeticion', carga: guardada.carga }] } })
  check('abrir /rep/<id> abre la partida', await sala(page))
  await pausar(page)
  check('  …LA MISMA (las mismas jugadas)', (await pasos(page)) === guardada.maximo && guardada.maximo > 100, `${await pasos(page)} / ${guardada.maximo}`)
  check('  …y la dirección se queda en el enlace corto', new URL(page.url()).search === `?r=${guardada.id}`, page.url())
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { page, ctx } = await pagina('/rep/zzzzzzzz')
  await page.waitForFunction(() => document.getElementById('repError')?.textContent, null, { timeout: 8000 }).catch(() => null)
  check('un enlace corto que no existe lo DICE', /Este enlace no existe/.test(await page.textContent('#repError')) && (await page.isHidden('#repSala')))
  await ctx.close()
}
{
  const { page, ctx } = await pagina('/rep/zzzzzzzz', { antes: { __RPC_ERRORES__: { enlace_corto_leer: { code: 'XX000', message: 'algo' } } } })
  await page.waitForFunction(() => document.getElementById('repError')?.textContent, null, { timeout: 8000 }).catch(() => null)
  check('  …y uno que no se ha podido PREGUNTAR dice otra cosa', /No se ha podido abrir el enlace/.test(await page.textContent('#repError')) && !/no existe/.test(await page.textContent('#repError')))
  await ctx.close()
}
{
  const { page, ctx } = await pagina('/rep/zzzzzzzz', { antes: { __RPC_ERRORES__: { enlace_corto_leer: { code: 'PGRST202', message: 'Could not find the function public.enlace_corto_leer' } } } })
  await page.waitForFunction(() => document.getElementById('repError')?.textContent, null, { timeout: 8000 }).catch(() => null)
  check('  …y sin la migración, qué fichero falta', /supabase-migration-enlaces-cortos\.sql/.test(await page.textContent('#repError')))
  await ctx.close()
}
{
  // Sin la migración, compartir da el largo sin asustar a nadie.
  const { page, ctx } = await pagina('/repeticiones.html', { antes: { __SIN_RPC__: ['enlace_corto_crear'] } })
  await page.fill('#repTexto', R481)
  await page.click('#repFormulario button[type=submit]')
  await sala(page)
  await page.click('[data-accion="compartir"]')
  await page.waitForFunction(() => document.getElementById('repEnlace')?.value, null, { timeout: 8000 })
  check('sin la migración, el largo de siempre (y sin el botón del largo)', /#p=/.test(await page.inputValue('#repEnlace')) && (await page.locator('[data-dlg="largo"]').count()) === 0 && !/supabase|migraci/i.test(await page.textContent('#repCompartirNota')))
  await ctx.close()
}

console.log('\n── 4. El laboratorio ──')
const PARTIDARIOS = new Set(['Determinación de Lylia', 'Órdenes de Jefes', 'Erin', 'Maya', 'Liza'])
const lectura = leerRegistro(R481)
const fs = sacarFotos(lectura)
const catalogo = (() => {
  const enJuego = new Set()
  for (const s of fs) for (const p of Object.values(s.jugadores)) for (const x of [p.activo, ...p.banca].filter(Boolean)) x.cartas.forEach((c) => enJuego.add(c))
  const nombres = new Set()
  for (const e of lectura.eventos) for (const k of ['carta', 'pokemon', 'objetivo', 'sube', 'baja', 'a', 'de']) if (e[k] && e[k] !== '?') nombres.add(e[k])
  for (const e of lectura.eventos) for (const c of e.cartas || []) nombres.add(c)
  return [...nombres].map((n, i) => ({
    id: `fk-${i + 1}`, set_id: 'fk', local_id: String(i + 1), market: 'WEST', image_path: null, regulation_mark: 'H',
    name: n, name_es: n,
    category: enJuego.has(n) ? 'Pokemon' : /^Energ/.test(n) ? 'Energy' : 'Trainer',
    stage: enJuego.has(n) ? 'Basic' : null,
    hp: enJuego.has(n) ? 999 : null,
    trainer_type: PARTIDARIOS.has(n) ? 'Supporter' : enJuego.has(n) || /^Energ/.test(n) ? null : 'Item',
  }))
})()
const SETS = [{ id: 'fk', name: 'FK', market: 'WEST', tcg_online_code: 'FK', release_date: '2025-01-01', card_count_official: 999 }]
const manoDe = (page) => page.evaluate(() => [...document.querySelectorAll('#labMano [data-uid]')].map((b) => b.getAttribute('aria-label').replace(' (nueva)', '')))
{
  const { page, ctx, errores } = await pagina('/repeticiones.html', { cartas: catalogo, sets: SETS })
  await page.fill('#repTexto', R481)
  await page.click('#repFormulario button[type=submit]')
  await sala(page)
  await pausar(page)
  await page.evaluate(() => {
    const r = document.getElementById('repProgreso')
    r.value = '120'
    r.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.click('[data-accion="jugar"]')
  await page.waitForSelector('#laboratorio:not([hidden]) .lab-mesa', { timeout: 10000 })
  const mano = await manoDe(page)
  await page.click('#laboratorio [data-accion="compartir"]')
  await page.waitForFunction(() => document.getElementById('labEnlace')?.value, null, { timeout: 8000 }).catch(() => null)
  const url = await page.inputValue('#labEnlace').catch(() => '')
  const texto = (await page.textContent('#labDialogo')).replace(/\s+/g, ' ')
  check('compartir una posición da /lab/ y ocho letras', new RegExp(`^${BASE}/lab/[a-z2-9]{8}$`).test(url), url)
  check('  …y dice que la mesa se guarda en PokeDoc (no que «no se guarda en ningún sitio»)', /se guarda en PokeDoc/.test(texto) && !/no se guarda en ningún sitio/.test(texto), texto.slice(0, 200))
  const fila = await page.evaluate(() => (window.__TABLAS__?.enlaces_cortos || [])[0])
  check('  …con la carga de la posición (pos=…)', fila?.tipo === 'posicion' && /^pos=/.test(fila.carga))
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()

  const otra = await pagina(`/lab/${url.split('/lab/')[1]}`, { cartas: catalogo, sets: SETS, antes: { __FAKE_ENLACES_CORTOS__: [{ id: fila?.id, tipo: 'posicion', carga: fila?.carga }] } })
  const abre = await otra.page.waitForSelector('#laboratorio:not([hidden]) .lab-mesa', { timeout: 10000 }).then(() => true).catch(() => false)
  check('abrir /lab/<id> monta el laboratorio', abre)
  await otra.page.waitForTimeout(300)
  check('  …con la MISMA mano', JSON.stringify(await manoDe(otra.page)) === JSON.stringify(mano) && mano.length > 0)
  check('  …sin errores', !otra.errores.length, otra.errores.join(' | '))
  await otra.ctx.close()

  // Una posición abierta por /rep/ (alguien cambió la ruta a mano) va al
  // laboratorio, que es lo suyo.
  const cruzada = await pagina(`/rep/${fila?.id}`, { cartas: catalogo, sets: SETS, antes: { __FAKE_ENLACES_CORTOS__: [{ id: fila?.id, tipo: 'posicion', carga: fila?.carga }] } })
  await cruzada.page.waitForURL(/\/constructor#pos=/, { timeout: 8000 }).catch(() => null)
  check('una POSICIÓN abierta por /rep/ se va al laboratorio', /\/constructor#pos=/.test(cruzada.page.url()), cruzada.page.url().slice(0, 80))
  await cruzada.ctx.close()
}
{
  const { page, ctx } = await pagina('/constructor?pos=zzzzzzzz')
  const toast = await page.waitForFunction(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' '), null, { timeout: 8000 }).then((h) => h.jsonValue()).catch(() => '')
  check('una posición corta que no existe lo dice, sin abrir una mesa a medias', /Este enlace no existe/.test(toast) && (await page.locator('#laboratorio:not([hidden])').count()) === 0, toast)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
