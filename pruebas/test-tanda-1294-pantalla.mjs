// Tanda 1294 — la ficha de un evento como PÓSTER (la propuesta v2, PINGU:
// «haz lo recomendado»; antes «se ve muy plana»): el logo grande e inclinado
// sobre su color o su cartel difuminado, con trama de puntos y el nombre en
// grande; una barra con la cuenta atrás (días · horas · min), el «¡Voy!» y los
// atajos; tres losas iguales (Cuándo, Entrada, Dónde: solo las que tienen
// datos); y «Quién va» en una franja con las caras, los nombres y «Ver quién
// va». En el móvil, una columna. Y lo puro: `cuentaRegresiva`.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { cuentaRegresiva } from '/home/user/pingu/js/eventos-puro.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── Lo puro: la cuenta atrás ──')
{
  const ahora = new Date(2026, 10, 12, 9, 0, 0)
  const r = cuentaRegresiva({ empieza: new Date(2026, 10, 14, 10, 30).toISOString() }, ahora)
  check('2 días, 1 hora y 30 min', r && r.dias === 2 && r.horas === 1 && r.min === 30, JSON.stringify(r))
  const casi = cuentaRegresiva({ empieza: new Date(2026, 10, 12, 9, 0, 30).toISOString() }, ahora)
  check('a 30 segundos, «1 min» (no 0)', casi && casi.dias === 0 && casi.horas === 0 && casi.min === 1, JSON.stringify(casi))
  check('empezado: null', cuentaRegresiva({ empieza: new Date(2026, 10, 12, 8).toISOString() }, ahora) === null)
  check('sin fecha: null', cuentaRegresiva({}, ahora) === null)
}

const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const base = (slug, n, extra = {}) => ({ id: `id-${slug}`, slug, tipo: 'card_show', publicado: true, horario: [{ dia: dia(n), desde: '10:00', hasta: '19:00' }, { dia: dia(n + 1), desde: '10:00', hasta: '19:00' }], empieza: new Date(dia(n) + 'T10:00').toISOString(), termina: new Date(dia(n + 1) + 'T19:00').toISOString(), ...extra })
const IBERIAN = base('iberian', 2, {
  nombre: 'IBERIAN CARD SHOW', color: '#3a5fb8', logo_url: 'https://logo.test/ib.png', logo_sin_fondo: true, destacado: true,
  sitio: 'Pabellón de Cristal', direccion: 'Casa de Campo', ciudad: 'Madrid', web: 'iberiancardshow.com', juegos: 'Pokémon · One Piece',
  descripcion: 'Más de 120 mesas de compraventa.', entradas: [{ nombre: 'General', precio: 5 }, { nombre: 'VIP', precio: 15, url: 'https://entradas.test/vip' }],
  asistentes: [{ user_id: 'user-2' }, { user_id: 'mod-1' }, { user_id: 'admin-1' }, { user_id: 'user-3', oculto: true }],
})
const SOLO = base('solo', 5, { nombre: 'Trade Night', tipo: 'trade_night', siglas: 'TN', asistentes: [] })

async function abrir(movil, quien, slug) {
  const ctx = await contexto(b, movil, quien)
  await ctx.route(/logo\.test/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(PNG, 'base64') }))
  await ctx.addInitScript(`window.__FAKE_EVENTOS__ = ${JSON.stringify([IBERIAN, SOLO])}`)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/eventos/${slug}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ev-poster', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(500)
  return { ctx, page, errores }
}

const b = await chromium.launch()
for (const movil of [false, true]) {
  console.log(`── El póster, ${movil ? 'móvil' : 'PC'} ──`)
  const { ctx, page, errores } = await abrir(movil, 'user-1', 'iberian')
  const r = await page.evaluate(() => {
    const q = (s) => document.querySelector(s)
    const caja = (s) => { const el = q(s); if (!el) return null; const x = el.getBoundingClientRect(); return { x: Math.round(x.left), y: Math.round(x.top + scrollY), w: Math.round(x.width), h: Math.round(x.height) } }
    const logo = q('.ev-logo-flota')
    return {
      h1: q('.ev-poster h1')?.textContent,
      h1px: parseFloat(getComputedStyle(q('.ev-poster h1')).fontSize),
      destacado: q('.ev-poster')?.classList.contains('destacado'),
      anima: getComputedStyle(q('.ev-poster')).animationName,
      chapa: q('.ev-poster .ev-chapa-destacado')?.textContent.trim(),
      giro: logo ? getComputedStyle(logo).transform : '',
      logoW: logo?.getBoundingClientRect().width,
      sinFondo: logo?.classList.contains('sin-fondo'),
      trama: getComputedStyle(q('.ev-poster-fondo'), '::after').backgroundImage,
      cuenta: q('.ev-poster-cuenta')?.textContent,
      regresiva: [...document.querySelectorAll('.ev-regresiva > span')].map((s) => s.textContent.replace(/\s+/g, ' ').trim()),
      voy: !!q('.ev-barra .ev-acciones .ev-voy'),
      atajos: document.querySelectorAll('.ev-barra .ev-atajo').length,
      losas: [...document.querySelectorAll('.ev-losas > .ev-losa h2')].map((h) => h.textContent),
      anchos: [...document.querySelectorAll('.ev-losas > .ev-losa')].map((l) => Math.round(l.getBoundingClientRect().width)),
      altos: [...document.querySelectorAll('.ev-losas > .ev-losa')].map((l) => Math.round(l.getBoundingClientRect().height)),
      quien: q('.ev-quien .ev-cuantos')?.textContent.replace(/\s+/g, ' ').trim(),
      caras: document.querySelectorAll('.ev-quien-caras .ev-cara').length,
      nombres: q('.ev-quien-nombres')?.textContent,
      gente: document.querySelectorAll('.ev-gente li').length,
      genteVisible: (() => { const l = q('.ev-gente'); return !!l && l.getBoundingClientRect().height > 0 })(),
      quienAlto: caja('.ev-quien')?.h,
      sobre: q('.ev-sobre .ev-desc')?.textContent,
      datos: document.querySelectorAll('.ev-sobre .ev-datos li').length,
      ancho: document.documentElement.scrollWidth <= innerWidth,
    }
  })
  check('el nombre en grande', r.h1 === 'IBERIAN CARD SHOW' && r.h1px >= (movil ? 22 : 30), `${r.h1px}px`)
  check('el logo flota, grande e inclinado, sin caja (no tiene fondo)', r.giro && r.giro !== 'none' && r.logoW >= (movil ? 60 : 105) && r.sinFondo, `${r.giro} · ${r.logoW}`)
  check('trama de puntos en el fondo', /radial-gradient/.test(r.trama), r.trama)
  check('destacado: chapa y la luz dorada', r.destacado && r.chapa === 'Destacado' && r.anima === 'ev-giro')
  check('la cuenta atrás en la esquina y en casillas (días · horas · min)', /Faltan 2 días|Faltan 1 día/.test(r.cuenta || '') && r.regresiva.length === 3 && /días?$/.test(r.regresiva[0]) && /horas$/.test(r.regresiva[1]) && /min$/.test(r.regresiva[2]), JSON.stringify([r.cuenta, r.regresiva]))
  check('el «¡Voy!» y los atajos, en la barra', r.voy && r.atajos >= 3, r.atajos)
  check('tres losas: Cuándo, Entradas, Dónde', r.losas.join() === 'Cuándo,Entradas,Dónde', r.losas.join())
  if (movil) check('  …en el móvil, una debajo de otra', new Set(r.anchos).size === 1, r.anchos.join())
  else check('  …del mismo ancho y del mismo alto', new Set(r.anchos).size === 1 && new Set(r.altos).size === 1, `${r.anchos} / ${r.altos}`)
  check('Quién va: franja con caras, «4 personas van (1 sin decirlo)» y los nombres', r.caras === 3 && /4 personas van/.test(r.quien) && /1 sin decirlo/.test(r.quien) && r.nombres?.split(',').length === 3, JSON.stringify([r.quien, r.nombres]))
  check('  …una franja baja, con la lista plegada', r.quienAlto <= (movil ? 160 : 100) && r.gente === 3 && !r.genteVisible, `${r.quienAlto}px`)
  check('la descripción y los datos, debajo', r.sobre === 'Más de 120 mesas de compraventa.' && r.datos >= 2)
  check('nada se sale de la pantalla', r.ancho)
  await page.screenshot({ path: `/tmp/1294-${movil ? 'movil' : 'pc'}.png`, fullPage: true })
  await page.click('[data-ver-quien]')
  await page.waitForTimeout(200)
  check('«Ver quién va» despliega la lista', await page.$eval('.ev-gente', (l) => l.getBoundingClientRect().height > 0))
  await page.click('.ev-acciones [data-voy]')
  await page.waitForTimeout(500)
  check('«¡Voy!» desde el póster: 5 van y sales en la franja', /5 personas van/.test(await page.textContent('.ev-quien .ev-cuantos')) && !!(await page.$('#evOculto')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── Sin datos: solo las losas que hay, y nadie todavía ──')
{
  const { ctx, page, errores } = await abrir(false, 'none', 'solo')
  const r = await page.evaluate(() => ({
    losas: [...document.querySelectorAll('.ev-losas > .ev-losa h2')].map((h) => h.textContent),
    anchoLosa: document.querySelector('.ev-losa')?.getBoundingClientRect().width,
    anchoPoster: document.querySelector('.ev-poster')?.getBoundingClientRect().width,
    quien: document.querySelector('.ev-quien .ev-cuantos')?.textContent,
    lista: !!document.querySelector('[data-ver-quien]'),
    siglas: document.querySelector('.ev-logo-flota b')?.textContent,
    destacado: document.querySelector('.ev-poster').classList.contains('destacado'),
    voy: document.querySelector('.ev-acciones .ev-voy')?.getAttribute('href') || '',
  }))
  check('solo «Cuándo» (sin entradas ni sitio), a lo ancho', r.losas.join() === 'Cuándo' && Math.abs(r.anchoLosa - r.anchoPoster) < 4, `${r.losas} · ${r.anchoLosa}/${r.anchoPoster}`)
  check('nadie va: «¡Sé el primero!» y sin lista', /Sé el primero/.test(r.quien) && !r.lista)
  check('sin logo, sus siglas', r.siglas === 'TN')
  check('sin destacar, sin luz', !r.destacado)
  check('sin cuenta, «¡Voy!» lleva a registrarse', /registro=1/.test(r.voy))
  await page.screenshot({ path: '/tmp/1294-solo.png', fullPage: true })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
