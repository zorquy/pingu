// Tanda 1120 — /admin → Avisos en pantalla: el formulario con tipo, enlace,
// fechas y a quién; la vista previa que cambia mientras escribes (la MISMA
// franja de la web); guardar; «mandarlo también a la campanita»; la línea de
// «Hoy». Y en la web: la franja con su tipo y su enlace, que respeta «solo
// con cuenta» y la fecha de fin, y la versión vieja (tono) que sigue saliendo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const browser = await chromium.launch()
const errores = []
async function abrir(ruta, { sesion = 'admin-1', aviso = null, viewport = { width: 1440, height: 900 }, sin1120 = false } = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(({ s, a, sin }) => {
    if (s) window.__FAKE_SESSION__ = s
    if (a) window.__FAKE_FILAS__ = { site_settings: [{ key: 'aviso_global', value: a }] }
    if (sin) window.__SIN_1120__ = true
  }, { s: sesion, a: aviso, sin: sin1120 })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  page.on('pageerror', (e) => { if (!/serviceWorker' property from 'Navigator'/.test(String(e))) errores.push(String(e).slice(0, 180)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  return page
}

console.log('── /admin → Avisos ──')
const page = await abrir('/admin/?ver=avisos', { aviso: { texto: 'Aviso de antes', tono: 'aviso', activo: true } })
await page.waitForSelector('#avTexto', { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(300)
check('el aviso de antes se abre con su tipo («Aviso», de tono)', (await page.inputValue('#avTexto')) === 'Aviso de antes' && (await page.getAttribute('[data-av-tipo="aviso"]', 'aria-checked')) === 'true')
check('  …la vista previa lo pinta como en la web, en PC y móvil', (await page.$$eval('.av-marco .aviso-global[data-tipo="aviso"]', (els) => els.length)) === 2 && /Se ve ahora/.test(await page.textContent('#avEstado')))
await page.fill('#avTexto', 'Mantenimiento el domingo a las 22 h')
await page.click('[data-av-tipo="mantenimiento"]')
await page.fill('#avEnlace', 'javascript:alert(1)')
check('un enlace raro avisa y no sale en la vista previa', await page.isVisible('#avEnlaceNota') && !(await page.$('#avPreviaPc a')))
await page.fill('#avEnlace', '/novedades')
await page.fill('#avTextoEnlace', 'Qué cambia')
check('la vista previa cambia mientras escribes', /Mantenimiento el domingo/.test(await page.textContent('#avPreviaPc')) && (await page.getAttribute('#avPreviaPc .aviso-global', 'data-tipo')) === 'mantenimiento' && (await page.getAttribute('#avPreviaPc a', 'href')) === '/novedades' && /Qué cambia/.test(await page.textContent('#avPreviaPc a')))
await page.fill('#avDesde', '2030-01-01T10:00')
check('con «Desde» en el futuro dice «Programado»', /Programado: sale el/.test(await page.textContent('#avEstado')))
await page.fill('#avDesde', '')
await page.fill('#avHasta', '2020-01-01T10:00')
check('  …y con «Hasta» pasado, que se apagó solo', /Se apagó solo/.test(await page.textContent('#avEstado')))
await page.fill('#avHasta', '')
await page.click('[data-av-publico="cuenta"]')
check('«Solo con cuenta» lo dice en el estado', /solo con cuenta/.test(await page.textContent('#avEstado')))
await page.check('#avCampanita')
await page.click('#avGuardar')
await page.waitForTimeout(800)
const guardado = await page.evaluate(() => window.__TABLAS__.site_settings.find((f) => f.key === 'aviso_global')?.value)
check('guardar escribe tipo, enlace y a quién', guardado?.tipo === 'mantenimiento' && guardado.enlace === '/novedades' && guardado.texto_enlace === 'Qué cambia' && guardado.publico === 'cuenta' && guardado.activo === true && !guardado.desde && !guardado.hasta, JSON.stringify(guardado))
const avisos = await page.evaluate(() => window.__TABLAS__.user_notifications.filter((n) => n.type === 'aviso_equipo'))
check('  …y con la casilla, a la campanita de todas las cuentas', avisos.length > 1 && avisos.every((n) => n.title === 'Mantenimiento el domingo a las 22 h' && n.link === '/novedades'), avisos.length)
check('  …lo dice (a cuántas) y lo apunta', /mandado a \d+ personas/.test(await page.textContent('body')) && /Último a la campanita: «Mantenimiento el domingo/.test(await page.textContent('#avUltimo')))
check('  …y la casilla se desmarca (otro Guardar no lo vuelve a mandar)', !(await page.isChecked('#avCampanita')))
await page.click('.admin-nav-item[data-section="dashboard"]')
await page.waitForTimeout(200)
check('«Hoy» tiene «Poner un aviso» y dice el que hay ahora (el recién guardado)', await page.isVisible('#section-dashboard [data-ir="avisos"]') && /Aviso en la web: «Mantenimiento el domingo/.test(await page.textContent('#hoyAviso')), await page.textContent('#hoyAviso'))
await page.click('.admin-nav-item[data-section="avisos"]')
await page.waitForTimeout(200)
await page.screenshot({ path: '/tmp/1120-admin.png' })

console.log('── Sin la migración 1120 ──')
const sin = await abrir('/admin/?ver=avisos', { sin1120: true, aviso: { texto: 'Hola', activo: true } })
await sin.waitForSelector('#avTexto', { timeout: 15000 }).catch(() => {})
await sin.check('#avCampanita')
await sin.click('#avGuardar')
await sin.waitForTimeout(600)
check('guarda la franja y dice que la campanita necesita la migración', /campanita necesita supabase-migration-1120-avisos\.sql/.test(await sin.textContent('body')) && (await sin.evaluate(() => window.__TABLAS__.site_settings.find((f) => f.key === 'aviso_global')?.value?.texto)) === 'Hola')

console.log('── En la web ──')
const AV = { texto: 'Torneo el sábado', tipo: 'novedad', enlace: '/torneos', activo: true }
let w = await abrir('/foro', { sesion: 'none', aviso: AV })
await w.waitForSelector('.aviso-global', { timeout: 8000 }).catch(() => {})
check('sin cuenta: la franja con su tipo, su icono y su enlace', (await w.getAttribute('.aviso-global', 'data-tipo')) === 'novedad' && (await w.$('.aviso-global-icono svg')) !== null && (await w.getAttribute('.aviso-global-enlace', 'href')) === '/torneos')
check('  …con su hoja (no la de components.css)', await w.evaluate(() => [...document.styleSheets].some((s) => /aviso-global\.css/.test(s.href || ''))) && (await w.evaluate(() => getComputedStyle(document.querySelector('.aviso-global')).display)) === 'flex')
await w.click('.aviso-global-cerrar')
await w.reload({ waitUntil: 'domcontentloaded' })
await w.waitForTimeout(1500)
check('cerrarla la cierra para esta visita', !(await w.$('.aviso-global')))
w = await abrir('/foro', { sesion: 'none', aviso: { ...AV, publico: 'cuenta' } })
await w.waitForTimeout(2000)
check('«solo con cuenta»: sin cuenta no sale', !(await w.$('.aviso-global')))
w = await abrir('/foro', { sesion: 'user-2', aviso: { ...AV, publico: 'cuenta' } })
await w.waitForSelector('.aviso-global', { timeout: 8000 }).catch(() => {})
check('  …con cuenta, sí', (await w.$('.aviso-global')) !== null)
w = await abrir('/foro', { sesion: 'none', aviso: { ...AV, hasta: '2020-01-01T00:00:00Z' } })
await w.waitForTimeout(2000)
check('con la fecha de fin pasada, no sale', !(await w.$('.aviso-global')))
w = await abrir('/foro', { sesion: 'none', aviso: { ...AV, publico: 'movil' } })
await w.waitForTimeout(2000)
check('«solo en el móvil»: en el PC no sale', !(await w.$('.aviso-global')))
w = await abrir('/foro', { sesion: 'none', aviso: { ...AV, publico: 'movil' }, viewport: { width: 390, height: 844 } })
await w.waitForSelector('.aviso-global', { timeout: 8000 }).catch(() => {})
check('  …en el móvil, sí, y cabe', (await w.$('.aviso-global')) !== null && (await w.evaluate(() => document.documentElement.scrollWidth)) <= 392)
await w.screenshot({ path: '/tmp/1120-movil.png' })
w = await abrir('/foro', { sesion: 'none', aviso: { texto: 'De antes', tono: 'aviso', activo: true } })
await w.waitForSelector('.aviso-global', { timeout: 8000 }).catch(() => {})
check('un aviso de antes de la 1120 (tono) sigue saliendo, como «aviso»', (await w.getAttribute('.aviso-global', 'data-tipo')) === 'aviso')
check('sin errores en las páginas', !errores.length, errores.join(' | '))

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
