// Tanda 1083 — las cifras del Panel de una tienda: lo más vendido del
// periodo (por carta o por expansión), lo que no rota (con el enlace al
// stock filtrado) y el valor del stock en el tiempo, cuya foto del día se
// apunta ANTES de pedir las cifras. Con un solo punto no hay curva (se
// explica); sin la migración, el bloque no sale.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const dia = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)
const CIFRAS = {
  cartas: [{ card_id: 'carta-1', market: 'WEST', nombre: 'Pikachu ex', set_id: 'set-0', numero: '238', unidades: 6, importe: 1494 }, { product_id: 501, nombre: 'ETB de prueba', unidades: 2, importe: 129.9 }],
  sets: [{ set_id: 'set-0', market: 'WEST', nombre: 'Obsidian Flames', unidades: 9, importe: 1591.5, cartas: 2 }],
  quietas: { lineas: 3, unidades: 4, valor: 285, filas: [{ id: 'q1', card_id: 'carta-3', nombre: 'Gengar ex', set_id: 'set-0', numero: '3', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 2, precio: 120, entro_el: new Date(Date.now() - 140 * 864e5).toISOString() }] },
  valor: [{ dia: dia(10), valor: 1000, cm: 1100 }, { dia: dia(5), valor: 900, cm: 1000 }, { dia: dia(0), valor: 1200, cm: 1300 }],
}
const HOY = { actual: { importe: 0, ventas: 0 }, anterior: null, serie: [], stock: {}, avisos: {}, demanda: [], visitas: {} }
const b = await chromium.launch()
async function abrir({ cifras = CIFRAS, sinMigracion = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }
    localStorage.setItem('pd-tienda', '{"u":"rincon","id":"user-2"}')
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda' }]
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2' }] }
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__ORDEN__ = []
    window.__RPC_RESPUESTAS__ = {
      tienda_hoy: d.HOY,
      tienda_ventas_lista: { total: 0, filas: [] },
      tienda_stock_lista: { total: 0, en_stock: 0, sumas: {}, facetas: {}, filas: [] },
      ...(d.sinMigracion ? {} : {
        tienda_apuntar_valor: () => { window.__ORDEN__.push('apuntar'); return {} },
        tienda_cifras: (a) => { window.__ORDEN__.push('cifras'); window.__CIFRAS_ARGS__ = a; return d.cifras },
      }),
    }
  }, { cifras, sinMigracion, HOY })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}/tienda.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { p, ctx, errs }
}

{
  const { p, ctx, errs } = await abrir()
  check('las tres tarjetas, después de apuntar la foto del día', !errs.length && (await p.isVisible('.tdh-tres')) && (await p.locator('.tdh-tres .tdh-tarjeta').count()) === 3 && (await p.evaluate(() => window.__ORDEN__.join())) === 'apuntar,cifras', errs.join(' | ') || await p.evaluate(() => window.__ORDEN__.join()))
  check('  …con el periodo del Panel', await p.evaluate(() => Boolean(window.__CIFRAS_ARGS__?.p_desde && window.__CIFRAS_ARGS__?.p_hasta)))
  const top = await p.locator('.tdh-top li').allTextContents()
  check('lo más vendido por carta: Pikachu (6 uds.) y la caja, en orden', top.length === 2 && /Pikachu ex.*6 uds\..*1\.494,00/.test(top[0]) && /ETB de prueba.*Sellado/.test(top[1]), top.join(' | '))
  await p.click('[data-top="sets"]')
  check('  …y por expansión', /Obsidian Flames.*2 cartas distintas.*9 uds\./.test(await p.textContent('.tdh-top')) && (await p.getAttribute('[data-top="sets"]', 'aria-pressed')) === 'true')
  check('lo que no rota: lo parado, cada línea con sus días, y al stock con «más de 90 días»', /285,00.*parados en 3 líneas \(4 uds\.\)/.test(await p.textContent('.tdh-quietas-total')) && /140 días/.test(await p.textContent('.tdh-quietas')) && (await p.getAttribute('.tdh-tres a[data-filtro="viejas"]', 'href')) === '/tienda?ver=stock&filtro=viejas')
  check('el valor: hoy, +20 % desde el primero, y la curva con tres puntos', /1200,00/.test((await p.textContent('.tdh-valor-hoy')).replace(/\./g, '')) && /\+20 %/.test(await p.textContent('.tdh-valor-hoy')) && (await p.getAttribute('.tdh-valor-linea', 'points')).split(' ').length === 3)
  await p.click('.tdh-tres a[data-filtro="viejas"]'); await p.waitForTimeout(800)
  check('«Verlas en el stock» abre el Stock con ese filtro', (await p.isVisible('[data-td-hoja="stock"]')) && new URL(p.url()).searchParams.get('ver') === 'stock')
  await ctx.close()
}
{
  const { p, ctx } = await abrir({ cifras: { cartas: [], sets: [], quietas: { lineas: 0 }, valor: [{ dia: dia(0), valor: 500 }] } })
  check('sin ventas, sin parados y con un solo punto: cada tarjeta lo dice', /Sin ventas en este periodo/.test(await p.textContent('.tdh-tres')) && /Todo rota/.test(await p.textContent('.tdh-tres')) && /500,00/.test(await p.textContent('.tdh-valor-hoy')) && /en unos días verás/.test(await p.textContent('.tdh-tres')) && (await p.locator('.tdh-valor-linea').count()) === 0)
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir({ sinMigracion: true })
  check('sin la migración, el bloque no sale (y el resto del Panel sí)', !errs.length && (await p.isHidden('.tdh-tres')) && (await p.isVisible('.tdh-cifras')), errs.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
