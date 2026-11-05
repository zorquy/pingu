// Tanda 1246 — La actividad de la comunidad (PINGU: «en actividad las tiendas no
// tienen ni el color ni el icono de tienda… rehacer la actividad como está en el
// inicio, con los iconos de qué hace cada acción»). Se mira:
//   · `conCuentas` (puro): pone la cuenta de quien hace y de a quién sigue, y
//     quita lo de la tienda de pruebas;
//   · /usuarios → Actividad: filas con su dibujo a la derecha, en dos cajas en
//     el PC y una en el móvil; «empezó a seguir a» una tienda con su nombre de
//     tienda y el dibujo de la tienda; nada de la de pruebas;
//   · la portada, «Comunidad»: la tienda igual, y la lateral de /usuarios.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const NUEVOS = [
  { tipo: 'perfecto', fecha: hace(30), username: 'roru', display_name: 'RoRu 14', datos: {} },
  { tipo: 'sigue', fecha: hace(43), username: 'pingu', display_name: 'PINGU', is_admin: true, datos: { username: 'fdncards', display_name: 'FDN Cards' } },
  { tipo: 'sigue', fecha: hace(50), username: 'pingu', display_name: 'PINGU', is_admin: true, datos: { username: 'pruebatienda', display_name: 'Tienda de Prueba' } },
  { tipo: 'sigue', fecha: hace(60), username: 'roru', display_name: 'RoRu 14', datos: { username: 'misty', display_name: 'Misty' } },
  ...Array.from({ length: 9 }, (_, i) => ({ tipo: 'perfecto', fecha: hace(100 + i * 10), username: `p${i}`, display_name: `Persona ${i}`, datos: {} })),
]
const PERFILES = [
  { id: 'fdn', username: 'fdncards', display_name: 'FDN Cards', tipo: 'tienda' },
  { id: 'tp', username: 'pruebatienda', display_name: 'Tienda de Prueba', tipo: 'tienda' },
  { id: 'pg', username: 'pingu', display_name: 'PINGU', tipo: 'persona', is_admin: true },
  { id: 'ro', username: 'roru', display_name: 'RoRu 14', tipo: 'persona' },
  { id: 'mi', username: 'misty', display_name: 'Misty', tipo: 'persona' },
]

const b = await chromium.launch()
async function abrir(ruta, { movil = false } = {}) {
  const ctx = await b.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), serviceWorkers: 'block' })
  await ctx.addInitScript(([n, p]) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFILES__ = p
    window.__FAKE_COMUNIDAD_SUCESOS__ = n
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'tp', de_pruebas: true }, { user_id: 'fdn', de_pruebas: false }] }
    try { localStorage.setItem('pd-bienvenida-comunidad', '1'); localStorage.setItem('pd-bienvenida-inicio', '1') } catch {}
  }, [NUEVOS, PERFILES])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2800)
  return { p, ctx, errs }
}
// Lo que se ve de cada fila de una lista: el texto, el dibujo de la derecha y,
// si sigue a alguien, cómo va su nombre.
const filas = (p, sel) => p.$$eval(`${sel} .suc`, (xs) => xs.map((x) => {
  const a = [...x.querySelectorAll('p a')].find((y) => y.closest('.suc-quien') === null && y.getAttribute('href')?.match(/^\/(tiendas|usuario)\//))
  return {
    texto: x.querySelector('p')?.textContent.replace(/\s+/g, ' ').trim(),
    dibujo: x.querySelector('.suc-dib svg')?.innerHTML.slice(0, 30) || x.querySelector('.suc-dib b')?.textContent || null,
    a: a && { href: a.getAttribute('href'), tienda: a.hasAttribute('data-nombre-tienda'), color: getComputedStyle(a).color },
  }
}))
const { icons } = await import(`${process.env.PD_RAIZ || '/home/user/pingu'}/js/icons.js`)
const trazo = (n) => icons[n](16).match(/<svg[^>]*>(.*)<\/svg>/s)[1].slice(0, 30)

console.log('── 1. Lo puro ──')
{
  const { p, ctx } = await abrir('/usuarios')
  const r = await p.evaluate(async ([n, pf]) => { const m = await import('/js/comunidad-sucesos.js'); return m.conCuentas(n, pf, new Set(['tp'])) }, [NUEVOS, PERFILES])
  const fdn = r.find((e) => e.datos?.username === 'fdncards')
  check('a quién sigue: la tienda lleva tipo «tienda», la persona «persona»', fdn?.datos.tipo === 'tienda' && r.find((e) => e.datos?.username === 'misty')?.datos.tipo === 'persona', JSON.stringify(fdn))
  check('quien hace lleva su cuenta', r.find((e) => e.username === 'pingu')?.cuenta === 'persona')
  check('lo de la tienda de pruebas, fuera', !r.some((e) => e.datos?.username === 'pruebatienda') && r.length === NUEVOS.length - 1)
  const sin = await p.evaluate(async (n) => { const m = await import('/js/comunidad-sucesos.js'); return m.conCuentas(n, [], new Set()).length }, NUEVOS)
  check('sin perfiles (la consulta falló): todo como venía', sin === NUEVOS.length)
  await ctx.close()
}

console.log('── 2. /usuarios → Actividad, en el PC ──')
{
  const { p, ctx, errs } = await abrir('/usuarios#activity')
  await p.click('[data-tab="activity"], [data-ctab="activity"], #tab-activity').catch(() => {})
  await p.waitForSelector('#activityFeed .suc-cajas', { timeout: 6000 }).catch(() => {})
  const cajas = await p.$$eval('#activityFeed .suc-cajas > .suc-lista', (xs) => xs.map((x) => { const r = x.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), borde: getComputedStyle(x).borderTopWidth, n: x.children.length } }))
  check('dos cajas lado a lado, cada una con su borde', cajas.length === 2 && cajas[0].y === cajas[1].y && cajas[0].x < cajas[1].x && cajas.every((c) => c.borde === '1px'), JSON.stringify(cajas))
  const f = await filas(p, '#activityFeed')
  check('cada fila con su dibujo a la derecha', f.length >= 10 && f.every((x) => x.dibujo), JSON.stringify(f.filter((x) => !x.dibujo)))
  const fdn = f.find((x) => /FDN Cards/.test(x.texto))
  check('«empezó a seguir a FDN Cards»: a /tiendas/fdncards, nombre de tienda en su verde', fdn?.a?.href === '/tiendas/fdncards' && fdn.a.tienda && fdn.a.color === 'rgb(10, 116, 128)', JSON.stringify(fdn))
  check('  …y el dibujo es la tienda', fdn?.dibujo === trazo('store'), fdn?.dibujo)
  const misty = f.find((x) => /Misty/.test(x.texto))
  check('a una persona: a /usuario/, sin icono de tienda y el dibujo de gente', misty?.a?.href === '/usuario/misty' && !misty.a.tienda && misty.dibujo === trazo('users'), JSON.stringify(misty))
  check('nada de la tienda de pruebas', !f.some((x) => /Tienda de Prueba/.test(x.texto)))
  check('los filtros siguen', (await p.locator('#activityFeed [data-suc-filtro]').count()) >= 3)
  if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/1246-actividad-pc.png` })
  await p.click('#activityFeed [data-suc-filtro="gente"]'); await p.waitForTimeout(200)
  check('  …«Gente» deja los dos «empezó a seguir», en una caja a lo ancho', (await filas(p, '#activityFeed')).length === 2 && (await p.locator('#activityFeed .suc-cajas.una > .suc-lista').count()) === 1)
  check('sin errores', !errs.length, errs.join(' | '))
  const lat = await filas(p, '#comUltimo')
  check('«Lo que acaba de pasar»: la tienda, igual', lat.some((x) => x.a?.tienda && x.a.href === '/tiendas/fdncards'), JSON.stringify(lat.map((x) => x.texto)))
  await ctx.close()
}

console.log('── 3. En el móvil, una caja ──')
{
  const { p, ctx } = await abrir('/usuarios#activity', { movil: true })
  await p.click('[data-tab="activity"], [data-ctab="activity"], #tab-activity').catch(() => {})
  await p.waitForSelector('#activityFeed .suc-cajas', { timeout: 6000 }).catch(() => {})
  const m = await p.evaluate(() => {
    const c = document.querySelector('#activityFeed .suc-cajas')
    const l = [...c.querySelectorAll(':scope > .suc-lista')]
    return { ancho: document.documentElement.scrollWidth, borde: getComputedStyle(c).borderTopWidth, listas: l.map((x) => getComputedStyle(x).borderTopWidth), x: l.map((x) => Math.round(x.getBoundingClientRect().left)) }
  })
  check('una sola caja (las listas sin borde propio, una debajo de otra), sin salirse', m.borde === '1px' && m.listas.every((b) => b === '0px') && new Set(m.x).size === 1 && m.ancho <= 390, JSON.stringify(m))
  if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/1246-actividad-movil.png`, fullPage: true })
  await ctx.close()
}

console.log('── 4. La portada ──')
{
  const { p, ctx, errs } = await abrir('/')
  await p.waitForSelector('#homeActivityFeed .suc', { timeout: 8000 }).catch(() => {})
  const f = await filas(p, '#homeActivityFeed')
  const fdn = f.find((x) => /FDN Cards/.test(x.texto))
  check('«Comunidad»: FDN Cards con nombre de tienda y su dibujo', fdn?.a?.tienda && fdn.dibujo === trazo('store'), JSON.stringify(f))
  check('  …y nada de la de pruebas', !f.some((x) => /Tienda de Prueba/.test(x.texto)))
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
