// Tanda 1245 — La tienda de pruebas no se ve, y las tarjetas de /tiendas miden
// lo mismo (lo de la agenda lo mira test-tanda-1244-pantalla; lo de la base,
// test-tanda-1245 contra PostgreSQL). Aquí, lo que sale de `user_profiles` a
// pelo y no pasa por la base:
//   · `sinFantasmas` (lo puro): fuera las de pruebas, salvo la propia;
//   · Gente no la enseña, el buscador tampoco;
//   · sin la columna (sin la migración), no se esconde a nadie ni se rompe;
//   · /admin → Tiendas: las cuentas de tienda con «De pruebas», marcada la que
//     lo es, y marcar llama a `admin_tienda_de_pruebas`.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── 1. Lo puro ──')
{
  const { sinFantasmas } = await import(`${RAIZ}/js/tiendas-puro.js`)
  const ps = [{ id: 'a' }, { id: 'tp' }, { id: 'tr' }]
  check('fuera la de pruebas', sinFantasmas(ps, new Set(['tp'])).map((p) => p.id).join() === 'a,tr')
  check('salvo para ella misma', sinFantasmas(ps, new Set(['tp']), 'tp').length === 3)
  check('sin lista, nadie fuera; sin perfiles, vacío', sinFantasmas(ps, new Set()).length === 3 && sinFantasmas(null, new Set(['tp'])).length === 0)
}

const PERFILES = [
  { id: 'tp', username: 'pruebatienda', display_name: 'Tienda de Prueba', tipo: 'tienda', total_xp: 9000, level: 5 },
  { id: 'tr', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda', total_xp: 8000, level: 5 },
]
const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-2', filas = {}, sinColumna = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
  await ctx.addInitScript(([s, perfiles, f]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_PERFILES__ = perfiles
    window.__FAKE_FILAS__ = f
    try { localStorage.setItem('pd-bienvenida-comunidad', '1') } catch {}
  }, [sesion, PERFILES, filas])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  // Sin la migración: el filtro por `de_pruebas` contesta 42703, como la base.
  if (sinColumna) await p.route(/\/rest\/v1\/tiendas\?.*de_pruebas/, (r) => r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: '42703', message: 'column tiendas.de_pruebas does not exist' }) }))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { p, ctx, errs }
}
const MARCAS = { tiendas: [{ user_id: 'tp', de_pruebas: true }, { user_id: 'tr', de_pruebas: false }] }
const enGente = (p) => p.$$eval('#userDirectoryGrid .com-persona', (xs) => xs.map((x) => x.dataset.userId))

console.log('── 2. Gente y el buscador ──')
{
  const { p, ctx, errs } = await abrir('/usuarios', { filas: MARCAS })
  const ids = await enGente(p)
  check('Gente: El Rincón sí, la de pruebas no', ids.includes('tr') && !ids.includes('tp'), ids.join())
  const busca = await p.evaluate(async () => {
    const m = await import('/js/buscador.js')
    const ids = async (t) => JSON.stringify(await m.buscarTodo(t, { grupos: ['gente'] }))
    return { rincon: await ids('rincon'), prueba: await ids('pruebatienda') }
  })
  check('el buscador encuentra El Rincón y no la de pruebas, ni por su usuario', busca.rincon.includes('"tr"') && !busca.prueba.includes('"tp"'), JSON.stringify(busca).slice(0, 300))
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}
{
  // Sin la migración la consulta falla: se ve todo, como antes.
  const { p, ctx, errs } = await abrir('/usuarios', { sinColumna: true })
  const ids = await enGente(p)
  check('sin la migración: se ven las dos, sin errores', ids.includes('tr') && ids.includes('tp') && !errs.length, ids.join() + errs.join(' | '))
  await ctx.close()
}

console.log('── 3. /admin → Tiendas ──')
{
  const { p, ctx, errs } = await abrir('/admin/?ver=tiendas', { sesion: 'admin-1', filas: { ...MARCAS, tienda_solicitudes: [] } })
  await p.waitForTimeout(800)
  const filas = await p.$$eval('#tiendasCuentas [data-tienda-pruebas]', (xs) => xs.map((x) => ({ id: x.dataset.tiendaPruebas, marcada: x.checked, alto: Math.round(x.closest('label').getBoundingClientRect().height), texto: x.closest('label').textContent.replace(/\s+/g, ' ').trim() })))
  const tp = filas.find((f) => f.id === 'tp'), tr = filas.find((f) => f.id === 'tr')
  check('las cuentas de tienda, con la de pruebas marcada', tp?.marcada === true && tr?.marcada === false && /Tienda de Prueba/.test(tp.texto) && tp.alto >= 44, JSON.stringify(filas))
  await p.click('#tiendasCuentas [data-tienda-pruebas="tr"]'); await p.waitForTimeout(500)
  const llamada = await p.evaluate(() => (window.__RPCS__ || []).filter((r) => (r.nombre || r.name || r[0]) === 'admin_tienda_de_pruebas').map((r) => r.args || r[1]))
  check('marcar El Rincón llama a admin_tienda_de_pruebas', JSON.stringify(llamada).includes('"p_tienda":"tr"') && JSON.stringify(llamada).includes('"p_si":true'), JSON.stringify(llamada))
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
