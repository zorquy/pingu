// Tanda 989 — Retos, más limpios (2.ª): «Parejas» sustituye a «El reto de
// hoy», el menú de /retos en una pantalla y la liga de la semana al acabar.
//
// PINGU: «sí, me gustan las parejas. Adelante con todo lo recomendado».
//   1. Lo puro: la mesa del día (cada carta dos veces, la misma para todos),
//      un movimiento, la XP por movimientos y el texto que se comparte.
//   2. La migración contra PostgreSQL: acepta 'parejas' y más de diez
//      movimientos, y `retos_xp` dice lo mismo que js/retos-xp.js.
//   3. La función: seis cartas de nombres distintos, la del día guardada y
//      la libre sin tocar la tabla.
//   4. La pantalla: se juega entera (un fallo se vuelve a tapar), el final
//      dice los movimientos, no se guarda nada sin cuenta, la libre no pisa
//      la de hoy, y con cuenta guarda con sus movimientos y dice la liga.
//   5. El menú: seis baldosas que son enlaces, «Nuevo» en Parejas, la
//      píldora, la barra y el historial plegado que se pide al abrirlo.
//   6. El cuestionario ya no está en la portada.
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const AQUI = new URL('.', import.meta.url).pathname
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hoy = new Date().toISOString().slice(0, 10)

console.log('── 1. Lo puro ──')
const P = await import(`${RAIZ}/js/parejas.js`)
const X = await import(`${RAIZ}/js/retos-xp.js`)
const L = await import(`${RAIZ}/js/retos-libre.js`)
{
  const mesa = P.mesaDelDia(hoy)
  const cuenta = mesa.reduce((m, c) => ({ ...m, [c]: (m[c] || 0) + 1 }), {})
  check('la mesa: doce huecos, cada carta dos veces', mesa.length === 12 && Object.keys(cuenta).length === 6 && Object.values(cuenta).every((n) => n === 2), mesa.join(','))
  check('  …la misma para todos (sale de la fecha)', P.mesaDelDia(hoy).join() === mesa.join())
  const otras = new Set(Array.from({ length: 20 }, (_, i) => P.mesaDelDia(L.diaLibre(i + 1)).join()))
  check('  …y otro día, otra (casi siempre)', otras.size >= 18, String(otras.size))
  const a = mesa.indexOf(0)
  const b = mesa.indexOf(0, a + 1)
  const c = mesa.findIndex((x) => x !== 0)
  let e = { dia: hoy, movimientos: 0, hechas: [], tira: [] }
  let r = P.mover(e, a, c, mesa)
  check('un movimiento sin pareja: cuenta, no empareja y apunta rojo', !r.pareja && r.estado.movimientos === 1 && !r.estado.hechas.length && r.estado.tira.join() === 'false')
  r = P.mover(r.estado, a, b, mesa)
  check('  …con pareja: empareja la carta y apunta verde', r.pareja && r.estado.hechas.join() === '0' && r.estado.tira.join() === 'false,true')
  check('  …y no se puede emparejar un hueco consigo mismo', !P.mover(e, a, a, mesa).pareja)
  check('la XP: 6–7 → 30, ≤10 → 20, ≤14 → 10, más → 5', [6, 7, 8, 10, 11, 14, 15, 30].map(P.xpDeMovimientos).join() === '30,30,20,20,10,10,5,5')
  check('  …es la de retos-xp.js (una sola tabla)', P.xpDeMovimientos === X.xpDeMovimientos && X.xpDe('parejas', { intentos: 9 }) === 20)
  check('lo que vale todavía: los que llevas más uno por pareja que falta', P.xpQueQueda(0, 0) === 30 && P.xpQueQueda(3, 2) === 30 && P.xpQueQueda(5, 2) === 20)
  check('resumenLocal: a medias, hecho y nada', X.resumenLocal('parejas', { dia: hoy, movimientos: 3, hechas: [1, 2] }, hoy)?.texto === '2 de 6 parejas' && X.resumenLocal('parejas', { dia: hoy, movimientos: 9, hechas: [0, 1, 2, 3, 4, 5] }, hoy)?.xp === 20 && X.resumenLocal('parejas', { dia: hoy, movimientos: 0, hechas: [] }, hoy) === null)
  check('resumenDeBase: «9 movimientos»', X.resumenDeBase('parejas', { intentos: 9, xp: 20 })?.texto === '9 movimientos')
  const t = P.textoParaCompartir({ dia: hoy, movimientos: 8, tira: [true, false, true] })
  check('el texto: «PokeDoc #N · Parejas · 8 movimientos», la tira y el enlace', t === `PokeDoc #${P.numeroDelDia(hoy)} · Parejas · 8 movimientos\n🟩🟥🟩\npokedoc.es/parejas`, t)
  check('RETOS: los seis, sin el cuestionario y con Parejas al final', X.RETOS.map((r) => r.juego).join() === 'carta,caro,silueta,ordena,expansion,parejas')
}

console.log('\n── 2. La migración ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_989'
const sql = (s) => { const r = psql(['-t', '-A', '-d', BD, '-c', s]); return (r.stdout || '').trim() + (r.status ? ` ERROR ${r.stderr}` : '') }
const A = '00000000-0000-0000-0000-0000000000a1'
const como = (uid, s) => { const r = psql(['-t', '-A', '-d', BD, '-c', `begin; set local role authenticated; set local prueba.uid = '${uid}'; ${s}; commit;`]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
if (psql(['-c', 'select 1']).status === 0) {
  psql(['-c', `drop database if exists ${BD}`])
  psql(['-c', `create database ${BD}`])
  let r = psql(['-d', BD, '-f', join(AQUI, 'sql-tanda-835.sql')])
  r = psql(['-d', BD, '-f', join(RAIZ, 'supabase-migration-retos-xp.sql')])
  check('la de la 835 carga', r.status === 0, r.stderr)
  let g = como(A, `select public.retos_guardar('parejas', current_date, 6, 6, 9, true, null)`)
  check('sin la 989, Parejas no se guarda (la base no conoce el juego)', !g.ok && /retos_resultados_juego/.test(g.err), g.err)
  r = psql(['-d', BD, '-f', join(RAIZ, 'supabase-migration-989-parejas.sql')])
  check('la 989 carga', r.status === 0, r.stderr)
  r = psql(['-d', BD, '-f', join(RAIZ, 'supabase-migration-989-parejas.sql')])
  check('  …y se puede ejecutar otra vez', r.status === 0, r.stderr)
  // Y sentencia a sentencia, cada una en su conexión (la 631).
  const sentencias = readFileSync(join(RAIZ, 'supabase-migration-989-parejas.sql'), 'utf8').replace(/^--.*$/gm, '').split(/;\s*\n(?=alter|create)/).map((x) => x.trim()).filter(Boolean)
  const solas = sentencias.map((s) => psql(['-d', BD, '-c', s.endsWith(';') ? s : `${s};`]))
  check(`  …y sus ${sentencias.length} sentencias, cada una por su lado`, solas.every((x) => x.status === 0), solas.map((x) => x.stderr).filter(Boolean).join(' | '))
  g = como(A, `select public.retos_guardar('parejas', current_date, 6, 6, 9, true, array[true,false,true,true,false,true,true,true,true]::boolean[])`)
  check('con la 989, se guarda: 9 movimientos dan 20 XP', g.ok && JSON.parse(g.out.split('\n').find((l) => l.startsWith('{'))).xp === 20, g.out + g.err)
  sql(`delete from retos_resultados where user_id = '${A}'`)
  g = como(A, `select public.retos_guardar('parejas', current_date, 6, 6, 23, true, null)`)
  check('  …y más de diez movimientos se aceptan (23 → 5 XP)', g.ok && JSON.parse(g.out.split('\n').find((l) => l.startsWith('{'))).xp === 5, g.out + g.err)
  const casos = Array.from({ length: 40 }, (_, i) => i)
  const base = sql(casos.map((m) => `select public.retos_xp('parejas', 6, 6, ${m}, true, null)`).join(' union all ')).split('\n').map(Number)
  const distintos = casos.filter((m, k) => X.xpDe('parejas', { intentos: m }) !== base[k])
  check('la XP de Parejas es la misma en la base y en retos-xp.js (0–39 movimientos)', base.length === casos.length && !distintos.length, distintos.join(','))
  const resto = [['carta', 0, 0, 3, true], ['silueta', 0, 0, 1, true], ['caro', 4, 5, null, false], ['ordena', 0, 0, 2, true], ['expansion', 3, 5, null, false]]
  const rb = sql(resto.map(([j, a, t, i, ac]) => `select public.retos_xp('${j}', ${a}, ${t}, ${i ?? 'null'}, ${ac}, null)`).join(' union all ')).split('\n').map(Number)
  check('  …y la de los demás sigue igual', resto.every(([j, a, t, i, ac], k) => X.xpDe(j, { aciertos: a, total: t, intentos: i, acertada: ac }) === rb[k]), rb.join(','))
  psql(['-c', `drop database if exists ${BD}`])
} else check('hay un PostgreSQL en /var/tmp:5433 donde probar', false)

console.log('\n── 3. La función ──')
{
  const F = await import(`${RAIZ}/netlify/functions/parejas.mjs`)
  const nombres = ['Pikachu', 'Pikachu ex', 'Charmander', 'Squirtle', 'Bulbasaur', 'Mewtwo', 'Machop', 'Eevee', 'Snorlax']
  const doble = (guardada = null) => {
    const pedidas = []
    const guardadas = []
    return {
      pedidas, guardadas,
      pedir: async (ruta) => {
        pedidas.push(ruta)
        if (ruta.startsWith('retos_reto_del_dia')) return { datos: guardada ? [{ datos: { card_ids: guardada } }] : [] }
        if (/^tcg_cards\?select=id&.*limit=1$/.test(ruta)) return { datos: [], total: 90 }
        const off = ruta.match(/offset=(\d+)/)
        if (off) return { datos: [{ id: `c-${off[1]}` }] }
        const ids = ruta.match(/id=in\.\(([^)]*)\)/)
        if (ids) return { datos: ids[1].split(',').map((x) => { const id = x.replace(/"/g, ''); return { id, name: nombres[Number(id.slice(2)) % nombres.length], image_path: 'x/1', tcg_sets: {} } }) }
        return { datos: [] }
      },
      guardar: async (t, f) => { guardadas.push([t, f]) },
    }
  }
  const d = doble()
  const r = await F.elegirParejas({ dia: hoy, ...d })
  const claves = r.cartas?.map((c) => c.name.replace(/ ex$/, ''))
  check('elige seis cartas de nombres distintos («Pikachu ex» cuenta como Pikachu)', r.cartas?.length === 6 && new Set(claves).size === 6, JSON.stringify(r.cartas?.map((c) => c.name)))
  check('  …y las guarda como las del día', d.guardadas.length === 1 && d.guardadas[0][0] === 'retos_reto_del_dia' && d.guardadas[0][1].juego === 'parejas' && d.guardadas[0][1].datos.card_ids.length === 6)
  const d2 = doble(['c-1', 'c-2', 'c-3', 'c-4', 'c-5', 'c-6'])
  const r2 = await F.elegirParejas({ dia: hoy, ...d2 })
  check('si ya están elegidas, son esas y no se vuelve a elegir', r2.cartas.map((c) => c.id).join() === 'c-1,c-2,c-3,c-4,c-5,c-6' && !d2.pedidas.some((p) => /offset/.test(p)) && !d2.guardadas.length)
  const d3 = doble(['c-1', 'c-2', 'c-3', 'c-4', 'c-5', 'c-6'])
  const r3 = await F.elegirParejas({ dia: hoy, libre: 7, ...d3 })
  check('una libre no lee ni escribe la tabla del día', r3.libre === 7 && r3.dia === L.diaLibre(7) && !d3.pedidas.some((p) => p.startsWith('retos_reto_del_dia')) && !d3.guardadas.length && r3.cartas.length === 6)
  // 990: las candidatas se piden A LA VEZ (eran 24 viajes seguidos) y la
  // cuenta de cartas se reusa en una función ya caliente.
  F.olvidarCuenta()
  let enVuelo = 0, maxEnVuelo = 0
  const lento = doble()
  const pedirLento = lento.pedir
  lento.pedir = async (ruta) => { enVuelo++; maxEnVuelo = Math.max(maxEnVuelo, enVuelo); await new Promise((r) => setTimeout(r, 5)); try { return await pedirLento(ruta) } finally { enVuelo-- } }
  await F.elegirParejas({ dia: hoy, libre: 9, ...lento })
  check('las candidatas se piden a la vez, no una detrás de otra (990)', maxEnVuelo >= 10, `a la vez como mucho: ${maxEnVuelo}`)
  const otra = doble()
  await F.elegirParejas({ dia: hoy, libre: 10, ...otra })
  check('  …y la cuenta de cartas no se vuelve a pedir en la misma función', !otra.pedidas.some((p) => /^tcg_cards\?select=id&.*limit=1$/.test(p)), otra.pedidas.slice(0, 3).join(' | '))
  F.olvidarCuenta()
  check('las del día van con cabecera de CDN hasta medianoche; las libres, con las suyas (990)', /'netlify-cdn-cache-control': `public, durable, max-age=\$\{hasta\}`/.test(leer('netlify/functions/parejas.mjs')))
  check('el sitemap y las tarjetas sociales la conocen', /\['\/parejas'/.test(leer('netlify/functions/sitemap.mjs')) && /'\/parejas': 'parejas'/.test(leer('netlify/edge-functions/meta-social.js')))
}

const browser = await chromium.launch()
const COLORES = ['#f7d354', '#e0582a', '#2a8fd6', '#3fa65a', '#8e5bd6', '#b46a2e']
const CARTAS = COLORES.map((c, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: ['Pikachu', 'Charmander', 'Squirtle', 'Bulbasaur', 'Mewtwo', 'Machop'][i], image_path: `sv/sv8/${i + 1}`, tcg_sets: { name: 'Surging Sparks', tcg_online_code: 'SSP' } }))
async function abrirParejas(ruta = '/parejas.html', { sesion = 'none', init = null, movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1200, height: 900 } })
  const pedidas = []
  await ctx.route('**/.netlify/functions/parejas**', (r) => {
    pedidas.push(r.request().url())
    const libre = new URL(r.request().url()).searchParams.get('libre')
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(libre ? { dia: L.diaLibre(Number(libre)), libre: Number(libre), cartas: [...CARTAS].reverse() } : { dia: hoy, numero: P.numeroDelDia(hoy), cartas: CARTAS }) })
  })
  await ctx.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#ccc"/></svg>' }))
  await ctx.route(/limitlesstcg|pokemontcg\.io|images\.tcggo|scrydex/, (r) => r.abort())
  await ctx.addInitScript(([s]) => { window.__FAKE_SESSION__ = s; try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {} }, [sesion])
  if (init) await ctx.addInitScript(init)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  return { ctx, page, errores, pedidas }
}
// Juega la mesa del día `dia`: un fallo y luego todo bien.
async function jugar(page, dia) {
  const mesa = P.mesaDelDia(dia)
  const otra = mesa.findIndex((x) => x !== mesa[0])
  await page.click('[data-hueco="0"]')
  await page.click(`[data-hueco="${otra}"]`)
  await page.waitForTimeout(250)
  const vueltas = await page.locator('.pa-carta.vuelta').count()
  await page.waitForTimeout(1100)
  const tapadas = await page.locator('.pa-carta.vuelta').count()
  for (let c = 0; c < 6; c++) {
    const [a, b] = mesa.map((x, i) => [x, i]).filter(([x]) => x === c).map(([, i]) => i)
    await page.click(`[data-hueco="${a}"]`)
    await page.click(`[data-hueco="${b}"]`)
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(800)
  return { vueltas, tapadas }
}

console.log('\n── 4. La pantalla de Parejas ──')
{
  const { ctx, page, errores } = await abrirParejas('/parejas.html', { movil: true })
  check('doce cartas boca abajo, cuatro por fila en el móvil', (await page.locator('.pa-carta').count()) === 12 && (await page.locator('.pa-carta.vuelta').count()) === 0 && (await page.$$eval('.pa-carta', (cs) => cs.filter((c) => Math.round(c.getBoundingClientRect().top) === Math.round(cs[0].getBoundingClientRect().top)).length)) === 4)
  check('  …de 44 px o más, y con su proporción de carta', await page.$$eval('.pa-carta', (cs) => cs.every((c) => { const r = c.getBoundingClientRect(); return r.width >= 44 && Math.abs(r.height - (r.width * 342) / 245) < 2 })))
  check('  …«Con cuenta, ahora vale +30 XP»', /\+30 XP/.test(await page.locator('#paBote').innerText()))
  const { vueltas, tapadas } = await jugar(page, hoy)
  check('un fallo: se ven las dos y se vuelven a tapar', vueltas === 2 && tapadas === 0, `${vueltas} → ${tapadas}`)
  check('al acabar: «¡Hecho en 7 movimientos!» y las seis cartas, que llevan a su ficha', /¡Hecho en 7 movimientos!/.test(await page.locator('#paFinal').innerText()) && (await page.locator('.pa-repaso a[href*="/carta/"]').count()) === 6)
  check('  …sin cuenta, lo que habría dado (+30)', /\+30 XP/.test(await page.locator('#paPremios').innerText()) && /Crea tu cuenta/.test(await page.locator('#paPremios').innerText()))
  const salidas = await page.locator('#paFinal .rj-salidas a, #paFinal .rj-salidas button').evaluateAll((es) => es.map((e) => e.innerText.trim()))
  check('  …las tres salidas (988)', salidas.length === 3 && /^Siguiente: /.test(salidas[0]) && salidas[1] === 'Compartir' && salidas[2] === 'Jugar otra vez', JSON.stringify(salidas))
  const g = JSON.parse(await page.evaluate(() => localStorage.getItem('pokedoc-parejas')))
  check('  …la partida en el navegador: 7 movimientos, seis parejas, su tira', g?.dia === hoy && g.movimientos === 7 && g.hechas.length === 6 && g.tira.length === 7 && g.tira[0] === false)
  check('  …y sin cuenta no se llama a la base', !(await page.evaluate(() => (window.__RPCS__ || []).some((r) => r.nombre === 'retos_guardar'))))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  check('al volver, sigue resuelta (todas a la vista y el final)', (await page.locator('.pa-carta.hecha').count()) === 12 && !(await page.locator('#paFinal').evaluate((e) => e.classList.contains('hidden'))))
  check('sin errores', !errores.length, errores.join(' | '))
  // Compartir: el texto con la tira.
  await page.evaluate(() => { navigator.share = async (d) => { window.__compartido = d; return true }; navigator.canShare = () => true })
  await page.click('#paCompartir')
  await page.waitForTimeout(1200)
  await page.click('[data-ch-red="x"]')
  await page.waitForTimeout(900)
  check('se comparte «PokeDoc #N · Parejas · 7 movimientos» con la tira', (await page.locator('#chTextoX').innerText()).startsWith(`PokeDoc #${P.numeroDelDia(hoy)} · Parejas · 7 movimientos\n🟥🟩🟩🟩🟩🟩🟩`), await page.locator('#chTextoX').innerText())
  await page.click('[data-ch-cerrar]')
  // La libre: otra mesa, sin tocar la de hoy.
  const hecha = await page.evaluate(() => localStorage.getItem('pokedoc-parejas'))
  await page.locator('#paFinal .rj-otra').click()
  await page.waitForURL(/libre=\d+/)
  await page.waitForTimeout(1500)
  const n = Number(new URL(page.url()).searchParams.get('libre'))
  check('«Jugar otra vez»: libre, con su aviso y boca abajo', (await page.locator('.rj-libre').count()) === 1 && (await page.locator('.pa-carta.vuelta').count()) === 0 && (await page.locator('#paBote').isHidden()))
  await jugar(page, L.diaLibre(n))
  check('  …se juega entera y acaba con «Otra más», sin Compartir', /Hecho en 7/.test(await page.locator('#paFinal').innerText()) && (await page.locator('#paCompartir').count()) === 0 && /Otra más/.test(await page.locator('#paFinal .rj-otra').innerText()))
  check('  …y la de hoy, intacta', (await page.evaluate(() => localStorage.getItem('pokedoc-parejas'))) === hecha)
  await ctx.close()
}
{
  // Con cuenta: guarda con sus movimientos y dice la liga.
  const { ctx, page, errores } = await abrirParejas('/parejas.html', {
    sesion: 'admin-1',
    init: () => {
      let n = 0
      // Antes de guardar vas 5.º; después, 3.º.
      window.__RPC_RESPUESTAS__ = { retos_guardar: { nuevo: true, xp: 30, perfecto: false, juegosHoy: 1 } }
      Object.defineProperty(window, '__FAKE_CLASIFICACION__', { get: () => ({ tu: { puesto: n++ === 0 ? 5 : 3, xp: 90 } }) })
    },
  })
  await jugar(page, hoy)
  await page.waitForTimeout(800)
  const g = await page.evaluate(() => (window.__RPCS__ || []).find((r) => r.nombre === 'retos_guardar')?.args)
  check('con cuenta, guarda Parejas con sus 7 movimientos y la tira', g?.p_juego === 'parejas' && g.p_intentos === 7 && g.p_aciertos === 6 && g.p_acertada === true && g.p_tira?.length === 7, JSON.stringify(g))
  check('  …enseña la XP que da la base', /\+30 XP/.test(await page.locator('#paPremios').innerText()))
  const liga = page.locator('.rj-liga')
  check('  …y la liga: «¡Subes del 5.º al 3.º en la liga de la semana!», a la clasificación', (await liga.count()) === 1 && /Subes del 5\.º al 3\.º/.test(await liga.innerText()) && (await liga.getAttribute('href')) === '/#clasificacion', await page.locator('#paPremios').innerText())
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

{
  // 990: la mesa sale tapada desde el HTML, antes de que lleguen las cartas.
  const ctx = await browser.newContext({ ...devices['iPhone 13'] })
  const page = await ctx.newPage()
  await page.route('**/.netlify/functions/parejas*', async (r) => { await new Promise((x) => setTimeout(x, 2500)); r.fulfill({ status: 503, body: '{"error":"lenta"}', contentType: 'application/json' }) })
  await page.goto(`${BASE}/parejas.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  const tapadas = await page.evaluate(() => ({ n: document.querySelectorAll('#paMesa .pa-carta .pa-dorso').length, alto: document.getElementById('paMesa').getBoundingClientRect().height, ocupada: document.getElementById('paMesa').getAttribute('aria-busy') }))
  check('mientras llegan las cartas, la mesa ya está: doce boca abajo (990)', tapadas.n === 12 && tapadas.alto > 300 && tapadas.ocupada === 'true', JSON.stringify(tapadas))
  await ctx.close()
}

console.log('\n── 5. El menú de /retos ──')
for (const movil of [true, false]) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript((hoy) => {
    window.__FAKE_SESSION__ = 'admin-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    window.__FAKE_RETOS_NUMEROS__ = { hoy: { parejas: { aciertos: 6, total: 6, intentos: 9, acertada: true, xp: 20 } }, racha: 2, dias: { [hoy]: 1 }, jugados: 4, mejorRacha: 2, diasPerfectos: 0, xpHoy: 20 }
    window.__FAKE_CLASIFICACION__ = { tu: { puesto: 4, xp: 120 } }
  }, hoy)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/retos.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  const que = movil ? 'móvil' : 'PC'
  // «Se ven todas sin bajar»: por encima de lo que flota abajo en el móvil
  // (la barra de secciones y la burbuja de la sección).
  const vista = await page.evaluate(() => {
    const r = [...document.querySelectorAll('.rt-reto')].map((a) => a.getBoundingClientRect())
    const tapa = [...document.querySelectorAll('.bm, .bm-burbuja > *')].map((e) => e.getBoundingClientRect()).filter((x) => x.height > 0 && x.top > innerHeight / 2)
    return { n: r.length, porFila: r.filter((x) => Math.round(x.top) === Math.round(r[0].top)).length, abajo: Math.round(Math.max(...r.map((x) => x.bottom))), alto: Math.round(Math.min(innerHeight, ...tapa.map((x) => x.top))) }
  })
  check(`${que}: las seis, ${movil ? 'dos' : 'tres'} por fila`, vista.n === 6 && vista.porFila === (movil ? 2 : 3), JSON.stringify(vista))
  check(`  …y se ven todas sin bajar`, vista.abajo <= vista.alto, JSON.stringify(vista))
  // En el móvil la XP de cada reto no cabe y ya suma en la píldora.
  const estadoParejas = await page.locator('#rtParejasEstado').innerText()
  check(`  …Parejas: «Nuevo», su sello y «9 movimientos${movil ? '' : ' · +20 XP'}»`, (await page.locator('#rtParejas .rt-nuevo').count()) === (hoy <= '2026-10-30' ? 1 : 0) && (await page.locator('#rtSello-parejas.ok').count()) === 1 && (movil ? /9 movimientos$/.test(estadoParejas.trim()) : /9 movimientos · \+20 XP/.test(await page.locator('#rtParejasEstado').textContent())), estadoParejas)
  check('  …la píldora', /1\/6 hoy/.test(await page.locator('#rtDia').innerText()) && /\+20 XP/.test(await page.locator('#rtDia').innerText()))
  check('  …el historial, plegado y sin pedir nada todavía', !(await page.locator('#rtHistorial').evaluate((d) => d.open)) && !(await page.evaluate(() => (window.__RPCS__ || []).some((r) => r.nombre === 'portada_clasificacion' || r.nombre === 'retos_comunidad'))))
  await page.click('#rtHistorial summary')
  await page.waitForTimeout(900)
  check('  …al abrirlo, la liga: «Vas 4.º … con 120 XP» y a la clasificación', /Vas 4\.º en la liga de la semana, con 120 XP/.test(await page.locator('#rtLiga').innerText()) && (await page.locator('#rtLiga a').getAttribute('href')) === '/#clasificacion')
  check('  …y el calendario', await page.locator('#rtCalendario').isVisible())
  check('  …sin salirse de la pantalla', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 6. El cuestionario, fuera ──')
{
  check('/reto lleva al menú (301)', /from = "\/reto"\s*\n\s*to = "\/retos"\s*\n\s*status = 301/.test(leer('netlify.toml')))
  check('la portada ya no pregunta por el cuestionario', !/daily_challenge_results/.test(leer('js/hoy.js')) && !/daily_challenge_results/.test(leer('js/portada-retos.js')))
  check('  …ni sus fichas hablan de «cinco preguntas»', !/Cinco preguntas/.test(leer('js/hoy.js')) && !/Cinco preguntas al día/.test(leer('js/home.js')))
  check('la bienvenida manda a /retos', /data-ir="\/retos" data-para="jugar"/.test(leer('onboarding.html')))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
