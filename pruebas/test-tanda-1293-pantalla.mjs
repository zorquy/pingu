// Tanda 1293 — el evento de Inicio como franja FINA (la A «Limpio» de la
// propuesta v2, PINGU: «haz lo recomendado») y el DESTACADO (1292).
// · Inicio: logo sin caja, hojita de calendario, nombre, caras + «N van» +
//   «faltan N días», «¡Voy!» que funciona desde aquí y toda la franja a la
//   FICHA. Sale el destacado si no ha pasado (esté cuando esté); si no, el
//   siguiente de dos semanas. El destacado lleva estrella y la luz dorada.
//   En el móvil, la fecha baja a la línea y la hojita se va.
// · Agenda: el destacado en su sitio y a su tamaño, con la luz y la chapa.
// · Un logo sin fondo se pinta sin caja.
// · Lo puro: `eventoDePortada`, `cuentaAtras` con tope, `esquinasTransparentesDe`.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { eventoDePortada, cuentaAtras, esquinasTransparentesDe } from '/home/user/pingu/js/eventos-puro.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
const ev = (slug, n, extra = {}) => ({ id: `id-${slug}`, slug, nombre: slug.toUpperCase(), tipo: 'card_show', publicado: true, empieza: new Date(dia(n) + 'T10:00').toISOString(), termina: new Date(dia(n) + 'T20:00').toISOString(), horario: [{ dia: dia(n), desde: '10:00', hasta: '20:00' }], ...extra })

console.log('── Lo puro ──')
{
  const cerca = ev('cerca', 3)
  const lejos = ev('lejos', 40, { destacado: true })
  const viejo = ev('viejo', -10, { destacado: true })
  check('sin destacado, el siguiente de dos semanas', eventoDePortada([lejos, cerca].map((e) => ({ ...e, destacado: false })))?.slug === 'cerca')
  check('con destacado, el destacado aunque falten 40 días', eventoDePortada([cerca, lejos])?.slug === 'lejos')
  check('un destacado que ya pasó no cuenta', eventoDePortada([cerca, viejo])?.slug === 'cerca')
  check('nada cerca y sin destacado: nada', eventoDePortada([{ ...lejos, destacado: false }]) === null)
  check('la cuenta atrás calla a los 40 días…', cuentaAtras(lejos) === '')
  check('  …salvo sin tope (el destacado)', cuentaAtras(lejos, new Date(), Infinity) === 'Faltan 40 días', cuentaAtras(lejos, new Date(), Infinity))
  const lado = 16
  const px = (relleno) => { const d = new Uint8ClampedArray(lado * lado * 4); for (let y = 0; y < lado; y++) for (let x = 0; x < lado; x++) d[(y * lado + x) * 4 + 3] = relleno(x, y); return d }
  check('un PNG recortado (esquinas transparentes): sin fondo', esquinasTransparentesDe(px((x, y) => ((x - 8) ** 2 + (y - 8) ** 2 < 40 ? 255 : 0)), lado, lado) === true)
  check('un logo con fondo (opaco): con fondo', esquinasTransparentesDe(px(() => 255), lado, lado) === false)
  check('una sola esquina opaca basta para que tenga fondo', esquinasTransparentesDe(px((x, y) => (x > 12 && y > 12 ? 255 : 0)), lado, lado) === false)
  check('un borde suavizado a medias no engaña', esquinasTransparentesDe(px((x, y) => (x === 0 && y === 0 ? 10 : 0)), lado, lado) === true)
  check('lo que no se puede leer, con fondo', esquinasTransparentesDe(null, 0, 0) === false)
}

const b = await chromium.launch()
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const IBERIAN = ev('iberian', 30, { nombre: 'IBERIAN CARD SHOW', color: '#c62a5c', logo_url: 'https://logo.test/iberian.png', logo_sin_fondo: true, destacado: true, asistentes: [{ user_id: 'user-2' }, { user_id: 'mod-1' }] })
const CASTELLON = ev('castellon', 4, { nombre: 'CASTELLON CARD SHOW', color: '#8a8a14', logo_url: 'https://logo.test/ccs.png', asistentes: [] })

async function abrir(movil, quien, eventos, ruta = '/') {
  const ctx = await contexto(b, movil, quien)
  await ctx.route(/logo\.test/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(PNG, 'base64') }))
  await ctx.addInitScript(`window.__FAKE_EVENTOS__ = ${JSON.stringify(eventos)}`)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  return { ctx, page, errores }
}

const leerFranja = (page) => page.$eval('#eventoPortada .portada-evento', (a) => {
  const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0
  const cs = getComputedStyle(a)
  return {
    alto: Math.round(a.getBoundingClientRect().height),
    href: a.querySelector('.pe-nombre')?.getAttribute('href'),
    nombre: a.querySelector('.pe-nombre')?.textContent.trim(),
    linea: a.querySelector('.pe-linea')?.textContent.replace(/\s+/g, ' ').trim(),
    caras: a.querySelectorAll('.pe-caras .pb-cara').length,
    cal: vis(a.querySelector('.pe-cal')),
    fechaEnLinea: vis(a.querySelector('.pe-fecha')),
    estrella: vis(a.querySelector('.pe-estrella')),
    destacado: a.classList.contains('destacado'),
    anima: cs.animationName,
    sinFondo: a.querySelector('.pe-logo')?.classList.contains('sin-fondo'),
    fondoLogo: getComputedStyle(a.querySelector('.pe-logo')).backgroundColor,
    voy: a.querySelector('.pe-voy')?.textContent.replace(/\s+/g, ' ').trim(),
    voyTag: a.querySelector('.pe-voy')?.tagName,
    voyHref: a.querySelector('.pe-voy')?.getAttribute('href') || '',
    pulsado: a.querySelector('.pe-voy')?.getAttribute('aria-pressed'),
  }
})

for (const movil of [false, true]) {
  console.log(`── Inicio, destacado, ${movil ? 'móvil' : 'PC'} ──`)
  const { ctx, page, errores } = await abrir(movil, 'user-1', [CASTELLON, IBERIAN])
  await page.waitForSelector('#eventoPortada .portada-evento', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(500)
  let r = await leerFranja(page)
  check('sale el DESTACADO aunque falte un mes (y no el siguiente)', r.nombre === 'IBERIAN CARD SHOW', r.nombre)
  check('  …con su estrella y la luz dorada', r.destacado && r.estrella && r.anima === 'pe-giro', JSON.stringify([r.destacado, r.estrella, r.anima]))
  check('toda la franja va a la FICHA, no a la agenda', r.href === '/eventos/iberian', r.href)
  check('la línea no empieza por un «·» suelto', !/^·/.test(r.linea), r.linea)
  check('caras, «2 van» y «faltan 30 días»', r.caras === 2 && /2 van/.test(r.linea) && /faltan 30 días/.test(r.linea), r.linea)
  check('el logo sin fondo, sin caja', r.sinFondo && r.fondoLogo === 'rgba(0, 0, 0, 0)', r.fondoLogo)
  check('«¡Voy!» con el talón de los que van', r.voyTag === 'BUTTON' && /¡Voy!/.test(r.voy) && r.pulsado === 'false', r.voy)
  if (movil) {
    check('en el móvil la fecha baja a la línea y la hojita se va', !r.cal && r.fechaEnLinea)
    check('  …y la franja sigue siendo fina (≤ 80 px)', r.alto <= 80, r.alto)
  } else {
    check('en el PC, la hojita de calendario', r.cal && !r.fechaEnLinea)
    check('  …y la franja es fina (64–72 px)', r.alto >= 60 && r.alto <= 72, r.alto)
  }
  await page.$eval('#eventoPortada', (el) => el.scrollIntoView({ block: 'center' }))
  if (!movil) await page.locator('#eventoPortada').screenshot({ path: '/tmp/1293-pc.png' })
  else await page.locator('#eventoPortada').screenshot({ path: '/tmp/1293-movil.png' })

  // «¡Voy!» desde Inicio: cambia ya, se guarda, y no navega.
  await page.click('#eventoPortada .pe-voy')
  await page.waitForTimeout(400)
  r = await leerFranja(page)
  check('«¡Voy!» desde Inicio: «Vas», 3 van, sin salir de la portada', /Vas/.test(r.voy) && r.pulsado === 'true' && /3 van/.test(r.linea) && new URL(page.url()).pathname === '/', `${r.voy} · ${r.linea} · ${page.url()}`)
  const guardado = await page.evaluate(() => window.__FAKE_EVENTOS__.find((e) => e.slug === 'iberian').asistentes.some((a) => a.user_id === 'user-1'))
  check('  …y queda apuntado de verdad', guardado)
  if (!movil) await page.locator('#eventoPortada').screenshot({ path: '/tmp/1293-pc-vas.png' })
  await page.click('#eventoPortada .pe-voy')
  await page.waitForTimeout(400)
  r = await leerFranja(page)
  check('  …y se desmarca', /¡Voy!/.test(r.voy) && /2 van/.test(r.linea), r.linea)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── Inicio sin destacado y sin sesión ──')
{
  const { ctx, page, errores } = await abrir(false, 'none', [{ ...IBERIAN, destacado: false }, CASTELLON])
  await page.waitForSelector('#eventoPortada .portada-evento', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(500)
  const r = await leerFranja(page)
  check('sin destacado, el siguiente (Castellón, a 4 días)', r.nombre === 'CASTELLON CARD SHOW' && !r.destacado && !r.estrella && r.anima === 'none', r.nombre)
  check('  …«Sé el primero» y «faltan 4 días»', /Sé el primero/.test(r.linea) && /faltan 4 días/.test(r.linea), r.linea)
  check('  …el logo con fondo, en su cuadradito', !r.sinFondo)
  check('sin sesión, «¡Voy!» lleva a registrarse y vuelve a la ficha', r.voyTag === 'A' && /registro=1/.test(r.voyHref) && r.voyHref.includes(encodeURIComponent('/eventos/castellon')), r.voyHref)
  await page.locator('#eventoPortada').screenshot({ path: '/tmp/1293-pc-normal.png' })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── Inicio con «menos movimiento» ──')
{
  const ctx = await contexto(b, false, 'user-1')
  await ctx.addInitScript(`window.__FAKE_EVENTOS__ = ${JSON.stringify([IBERIAN])}`)
  const page = await ctx.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#eventoPortada .portada-evento', { timeout: 15000 }).catch(() => {})
  const anima = await page.$eval('#eventoPortada .portada-evento', (a) => getComputedStyle(a).animationName).catch(() => '?')
  check('la luz dorada se queda quieta', anima === 'none', anima)
  await ctx.close()
}

for (const movil of [false, true]) {
  console.log(`── La agenda, ${movil ? 'móvil' : 'PC'} ──`)
  const { ctx, page, errores } = await abrir(movil, 'user-1', [CASTELLON, IBERIAN, ev('trade', 8, { nombre: 'TRADE NIGHT', tipo: 'trade_night', siglas: 'TN' })], '/eventos')
  await page.waitForSelector('.ev-tarjeta', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(500)
  const r = await page.$$eval('.ev-tarjeta', (ts) => ts.map((t) => ({
    slug: t.dataset.ev,
    destacado: t.classList.contains('destacado'),
    anima: getComputedStyle(t).animationName,
    chapa: t.querySelector('.ev-chapa-destacado')?.textContent.trim() || '',
    ancho: Math.round(t.getBoundingClientRect().width),
    alto: Math.round(t.getBoundingClientRect().height),
    sinFondo: !!t.querySelector('.ev-logo.sin-fondo'),
    fondoLogo: t.querySelector('.ev-logo') ? getComputedStyle(t.querySelector('.ev-logo')).backgroundColor : '',
  })))
  const orden = r.map((x) => x.slug).join()
  check('el destacado se queda EN SU SITIO (por fecha, el último)', orden === 'castellon,trade,iberian', orden)
  const d = r.find((x) => x.slug === 'iberian')
  const otra = r.find((x) => x.slug === 'castellon')
  check('  …con la luz dorada y la chapa «Destacado»', d.destacado && d.anima === 'ev-giro' && d.chapa === 'Destacado', JSON.stringify(d))
  check('  …y del MISMO tamaño que las demás', Math.abs(d.ancho - otra.ancho) <= 1 && Math.abs(d.alto - otra.alto) <= 6, `${d.ancho}×${d.alto} / ${otra.ancho}×${otra.alto}`)
  check('las demás, ni luz ni chapa', !otra.destacado && otra.anima === 'none' && !otra.chapa)
  check('el logo sin fondo de Iberian, sin caja; el de Castellón, con su caja', d.sinFondo && d.fondoLogo === 'rgba(0, 0, 0, 0)' && !otra.sinFondo, `${d.fondoLogo}`)
  await page.screenshot({ path: `/tmp/1293-agenda-${movil ? 'movil' : 'pc'}.png`, fullPage: false })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
