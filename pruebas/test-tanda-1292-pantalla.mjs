// Tanda 1292 — /admin → Eventos: el hilo del foro DESMARCADO por defecto
// (PINGU: «por ahora no abriría post»), «Destacado» (uno solo: lo dice la
// nota y lo hace el disparador) y «Logo sin fondo», que se marca SOLO al subir
// un PNG con las esquinas transparentes y se puede cambiar a mano. Sin la
// migración, dice cuál falta y guarda lo demás.
import { deflateSync } from 'node:zlib'
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

// Un PNG RGBA de 32×32 hecho a mano: `alfa(x, y)` dice la transparencia.
function png(alfa, lado = 32) {
  const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)) } return ~c >>> 0 }
  const trozo = (tipo, datos) => { const t = Buffer.from(tipo); const l = Buffer.alloc(4); l.writeUInt32BE(datos.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, datos]))); return Buffer.concat([l, t, datos, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(lado, 0); ihdr.writeUInt32BE(lado, 4); ihdr[8] = 8; ihdr[9] = 6
  const filas = []
  for (let y = 0; y < lado; y++) { const f = Buffer.alloc(1 + lado * 4); for (let x = 0; x < lado; x++) f.set([200, 30, 90, alfa(x, y)], 1 + x * 4); filas.push(f) }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', ihdr), trozo('IDAT', deflateSync(Buffer.concat(filas))), trozo('IEND', Buffer.alloc(0))])
}
const RECORTADO = png((x, y) => ((x - 16) ** 2 + (y - 16) ** 2 < 150 ? 255 : 0))
const CUADRADO = png(() => 255)

const sembrar = () => {
  const x = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString() }
  const ymd = (dias) => x(dias).slice(0, 10)
  window.__FAKE_EVENTOS__ = [
    { id: 'e1', slug: 'iberian', nombre: 'Iberian Card Show', tipo: 'card_show', publicado: true, empieza: x(30), termina: x(31), horario: [], entradas: [], asistentes: [], destacado: true },
    { id: 'e2', slug: 'castellon', nombre: 'Castellón Card Show', tipo: 'card_show', publicado: true, empieza: x(4), termina: x(4), horario: [{ dia: ymd(4), desde: '10:00', hasta: '20:00' }], entradas: [], asistentes: [] },
  ]
}
async function abrir(b, { antes = null } = {}) {
  const ctx = await contexto(b, false, 'admin-1', sembrar)
  if (antes) await ctx.addInitScript(antes)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/serviceWorker' property/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}/admin/?ver=eventos`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-ev-editar="e2"]', { timeout: 8000 })
  return { ctx, page, errores }
}
const b = await chromium.launch()

console.log('── 1. La lista y el formulario ──')
{
  const { ctx, page, errores } = await abrir(b)
  check('el destacado lleva su chapa en la lista', /Destacado/.test(await page.textContent('.evadm-fila:has([data-ev-editar="e1"])')) && !/Destacado/.test(await page.textContent('.evadm-fila:has([data-ev-editar="e2"])')))
  await page.click('#evNuevo')
  check('«Abrir el hilo en el foro», DESMARCADA', (await page.$('#evf-hilo')) && !(await page.isChecked('#evf-hilo')))
  check('«Destacado», sin marcar, y dice cuál lo es ahora', !(await page.isChecked('#evf-destacado')) && /ahora lo es «Iberian Card Show»/.test(await page.textContent('label:has(#evf-destacado)')))
  check('«Logo sin fondo», sin marcar', !(await page.isChecked('#evf-logo_sin_fondo')))

  await page.setInputFiles('#evf-logo', { name: 'tradeito.png', mimeType: 'image/png', buffer: RECORTADO })
  await page.waitForFunction(() => document.querySelector('#evf-logo_url').value !== '', null, { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(300)
  check('un PNG recortado: «Logo sin fondo» se marca SOLO', await page.isChecked('#evf-logo_sin_fondo'))
  check('  …y la vista previa lo pinta sin caja', await page.$eval('#evfLogoVista', (v) => v.classList.contains('sin-fondo') && getComputedStyle(v).backgroundColor === 'rgba(0, 0, 0, 0)'))
  await page.setInputFiles('#evf-logo', { name: 'cuadrado.png', mimeType: 'image/png', buffer: CUADRADO })
  await page.waitForTimeout(600)
  check('un logo cuadrado (opaco): se desmarca', !(await page.isChecked('#evf-logo_sin_fondo')))
  check('  …y vuelve su caja de color', !(await page.$eval('#evfLogoVista', (v) => v.classList.contains('sin-fondo'))))
  await page.check('#evf-logo_sin_fondo')
  check('y se puede cambiar a mano (la vista previa lo sigue)', await page.$eval('#evfLogoVista', (v) => v.classList.contains('sin-fondo')))
  await page.screenshot({ path: '/tmp/1292-admin.png', fullPage: false })

  await page.fill('#evf-nombre', 'Tradeito')
  await page.evaluate(() => {
    const d = new Date(); d.setDate(d.getDate() + 6); const p = (n) => String(n).padStart(2, '0')
    window.__DIA__ = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  })
  const dia = await page.evaluate(() => window.__DIA__)
  if (!(await page.$(`[data-cal-dia="${dia}"]`))) await page.click('[data-cal-mes="1"]')
  await page.click(`[data-cal-dia="${dia}"]`)
  await page.check('#evf-destacado')
  await page.click('#evfGuardar')
  await page.waitForTimeout(900)
  const g = await page.evaluate(() => window.__FAKE_EVENTOS__.find((e) => e.nombre === 'Tradeito'))
  check('se guarda destacado y con el logo sin fondo', g?.destacado === true && g?.logo_sin_fondo === true, JSON.stringify(g && { d: g.destacado, s: g.logo_sin_fondo }))
  check('  …y sin hilo en el foro (no se marcó)', !g?.hilo_id)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Sin la migración 1292 ──')
{
  const { ctx, page, errores } = await abrir(b, { antes: () => { window.__SIN_COLUMNAS__ = { eventos: ['destacado', 'logo_sin_fondo'] } } })
  await page.click('[data-ev-editar="e2"]')
  check('dice qué migración falta y no ofrece las casillas', /1292/.test(await page.textContent('#evForm')) && !(await page.$('#evf-destacado')) && !(await page.$('#evf-logo_sin_fondo')))
  await page.fill('#evf-ciudad', 'Oropesa')
  await page.click('#evfGuardar')
  await page.waitForTimeout(700)
  const g = await page.evaluate(() => window.__FAKE_EVENTOS__.find((e) => e.id === 'e2'))
  check('  …y guarda lo demás sin mandar las columnas nuevas', g.ciudad === 'Oropesa' && !('logo_sin_fondo' in g), JSON.stringify(g))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
