// Tanda 1262 — Un trato anulado dejaba el número puesto (PINGU: «se me ha
// quedado la notificación en comunidad y en deseos y cambios, pero no hay
// nada. Y no se quita»). El aviso de un trato apunta a Cruces
// (`/mi-coleccion?ver=cambios#oferta-…`) y solo se daba por leído AL CARGAR
// esa dirección; Deseos y cambios abre en Mercado y Cruces se abre sin
// recargar, así que nunca casaba. Ahora cambiar de vista lanza
// `pd-ruta-cambiada`, la campanita vuelve a mirar, y Cruces lleva el número.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

console.log('── 1. Lo puro ──')
{
  const N = await import(`${RAIZ}/js/numeros-seccion.js`)
  const c = N.cuentasDeSecciones([
    { type: 'cambio_anulado', link: '/mi-coleccion?ver=cambios#oferta-9' },
    { type: 'trade_match', link: '/mi-coleccion?ver=mercado' },
  ])
  check('Colección 2, y Cruces 1 (lo que apunta a ver=cambios)', c['Colección'] === 2 && c.paginas.cambios === 2 && c.paginas.cruces === 1, JSON.stringify(c.paginas))
  check('  …Comunidad no cuenta un trato', c.Comunidad === 0)
  const el = (ds) => ({ getAttribute: () => null, dataset: ds })
  check('el botón Cruces es la página «cruces»', N.paginaDeEnlace(el({ deseosVista: 'cruces' })) === 'cruces' && N.paginaDeEnlace(el({ pestania: 'mercado' })) === 'cambios')
}

const conTrato = () => {
  const quien = window.__FAKE_SESSION__
  window.__FAKE_NOTIFICACIONES__ = [
    ...(window.__FAKE_NOTIFICACIONES__ || []),
    { recipient_id: quien, type: 'cambio_anulado', title: 'Ash ha anulado la propuesta', link: '/mi-coleccion?ver=cambios#oferta-x', created_at: new Date(Date.now() - 60000).toISOString() },
  ]
}

const b = await chromium.launch()
for (const movil of [true, false]) {
  console.log(`── 2. ${movil ? 'Móvil' : 'PC'}: de Mercado a Cruces sin recargar ──`)
  const ctx = await contexto(b, movil, 'user-1', conTrato)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mi-coleccion?ver=mercado`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const sinLeer = () => page.evaluate(() => (window.__TABLAS__?.user_notifications || []).find((a) => a.type === 'cambio_anulado')?.read_at || null)
  check('en Mercado el aviso sigue sin leer', !(await sinLeer()))
  const pest = await page.$eval('.mc-pestania[data-pestania="mercado"] .sec-num', (e) => e.textContent).catch(() => '')
  check('la pestaña Deseos y cambios dice 1', pest === '1', pest)
  const cruces = '.mc-deseos-seg:not(.hidden) [data-deseos-vista="cruces"]'
  const enCruces = await page.$$eval('.mc-deseos-seg [data-deseos-vista="cruces"]', (bs) => bs.filter((b) => b.offsetParent).map((b) => b.querySelector('.sec-num')?.textContent || ''))
  check('  …y el botón Cruces también', enCruces.includes('1'), JSON.stringify(enCruces))
  const chapaBusca = await page.$$eval('.mc-chapa-gente .sec-num', (es) => es.length)
  check('  …y no en las chapas «Buscan N»', chapaBusca === 0, chapaBusca)
  await page.locator('[data-deseos-vista="cruces"]:visible').first().click()
  await page.waitForTimeout(2000)
  check('al abrir Cruces queda leído en la base', Boolean(await sinLeer()))
  // (Los fixtures traen además un aviso del foro: ese es de Comunidad y se queda.)
  const despues = await page.$$eval('.sec-num', (es) => es.filter((e) => e.offsetParent && e.textContent.trim() && !/foro|Comunidad/.test(e.parentElement.outerHTML.slice(0, 200))).map((e) => e.parentElement.outerHTML.slice(0, 120)))
  check('  …y Colección, Deseos y cambios y Cruces se quedan sin número', !despues.length, JSON.stringify(despues))
  check('  …en la dirección de Cruces', /ver=cambios/.test(page.url()), page.url())
  await page.screenshot({ path: `/tmp/1262-${movil ? 'movil' : 'pc'}.png` })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
