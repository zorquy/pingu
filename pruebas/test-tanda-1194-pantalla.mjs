// Tanda 1194 — Eventos en carteles (PINGU eligió la A de «Eventos con
// cartel»): la agenda por meses con un cartel por evento (la imagen del evento
// o su color con el logo, la pastilla de la fecha, la cuenta atrás y «Desde
// N €»); la ficha con todo lo que se lee ARRIBA, en la cabecera al lado del
// logo (PINGU: «como en las tiendas»); las entradas como entradas con
// «Comprar ›»; en /admin el cartel y el enlace de cada entrada; y la portada
// con el color del evento de fondo.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const CARTEL = 'https://img.example/cartel-ics.jpg'
const sembrar = () => {
  const x = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
  const ev = (o) => { const h = o.horario; const [a, m, d] = h[0].dia.split('-').map(Number); const [b, n, f] = h.at(-1).dia.split('-').map(Number); return { publicado: true, asistentes: [], entradas: [], empieza: new Date(a, m - 1, d, Number(h[0].desde.slice(0, 2))).toISOString(), termina: new Date(b, n - 1, f, Number(h.at(-1).hasta.slice(0, 2))).toISOString(), ...o } }
  window.__FAKE_EVENTOS__ = [
    ev({ id: 'e1', slug: 'iberian-card-show-2026', nombre: 'Iberian Card Show', tipo: 'card_show', horario: [{ dia: x(4), desde: '10:00', hasta: '20:00' }, { dia: x(5), desde: '10:00', hasta: '18:00' }], sitio: 'Pabellón Cristal', ciudad: 'Madrid', provincia: 'Madrid', color: '#1f5175', siglas: 'ICS', juegos: 'Pokémon · One Piece', web: 'iberiancardshow.es', instagram: '@iberiancardshow', tcgmap_url: 'https://tcgmapspain.com/evento/ics', descripcion: 'Más de 120 mesas de compraventa.', entradas: [{ nombre: 'General', precio: 5, nota: 'Menores de 12, gratis', url: 'https://entradas.example/ics' }, { nombre: 'VIP', precio: 15, nota: 'Sobre de regalo' }, { nombre: 'Niños', precio: 0 }], asistentes: [{ user_id: 'user-2' }] }),
    ev({ id: 'e2', slug: 'trade-night-bilbao', nombre: 'Trade Night Bilbao', tipo: 'trade_night', horario: [{ dia: x(10), desde: '19:00', hasta: '23:00' }], ciudad: 'Bilbao', color: '#c62a5c', entradas: [{ nombre: 'Entrada', precio: 0 }] }),
    ev({ id: 'e3', slug: 'gijon-trade-day', nombre: 'Gijón Trade Day', tipo: 'trade_day', horario: [{ dia: x(40), desde: '11:00', hasta: '20:00' }], ciudad: 'Gijón' }),
  ]
}
async function abrir(b, ruta, { quien = 'user-1', movil = false, antes = null } = {}) {
  const ctx = await contexto(b, movil, quien, sembrar)
  if (antes) await ctx.addInitScript(antes)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/serviceWorker' property/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  return { ctx, page, errores }
}
const b = await chromium.launch()

console.log('── 1. La agenda en carteles ──')
{
  const { ctx, page, errores } = await abrir(b, '/eventos')
  const meses = await page.$$eval('.ev-mes', (h) => h.map((x) => x.textContent))
  check('agrupada por meses («Noviembre 2026»…)', meses.length >= 2 && meses.every((m) => /^[A-ZÁÉÍÓÚ][a-záéíóú]+ \d{4}$/.test(m)), JSON.stringify(meses))
  const t = await page.$eval('[data-ev="iberian-card-show-2026"]', (li) => ({
    pastilla: li.querySelector('.ev-pastilla')?.textContent.replace(/\s+/g, ''),
    cuenta: li.querySelector('.ev-cuenta')?.textContent,
    logo: li.querySelector('.ev-logo-cartel')?.textContent.trim(),
    desde: li.querySelector('.ev-desde')?.textContent,
    color: getComputedStyle(li.querySelector('.ev-cartel')).getPropertyValue('--ev-color').trim(),
  }))
  check('el cartel: su color, su logo, la pastilla de los dos días y la cuenta atrás', t.color === '#1f5175' && t.logo === 'ICS' && /^[A-ZÁÉÍÓÚ]{3}–[A-ZÁÉÍÓÚ]{3}\d+–\d+$/.test(t.pastilla) && /^Faltan 4 días$/.test(t.cuenta), JSON.stringify(t))
  check('«Desde 5 €»: la gratis de los niños no la baja a 0 €', t.desde === 'Desde 5 €', t.desde)
  check('una gratis entera dice «Gratis»', (await page.textContent('[data-ev="trade-night-bilbao"] .ev-desde')) === 'Gratis')
  check('lejos (40 días) no hay cuenta atrás', !(await page.$('[data-ev="gijon-trade-day"] .ev-cuenta')))
  const ancho = await page.$$eval('.ev-carteles:first-of-type .ev-tarjeta', (l) => l.map((x) => Math.round(x.getBoundingClientRect().top)))
  check('en el PC, varios carteles en la misma fila', ancho.length >= 2 && ancho[0] === ancho[1], JSON.stringify(ancho))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
  const m = await abrir(b, '/eventos', { movil: true })
  const mandos = await m.page.$eval('.ev-mandos', (x) => ({ alto: x.getBoundingClientRect().height, sobra: x.scrollWidth > x.clientWidth }))
  check('en el móvil, los filtros en UNA fila que se desliza', mandos.alto < 60, JSON.stringify(mandos))
  check('  …y la página no se sale de lado', (await m.page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0)
  await m.ctx.close()
}

console.log('── 2. Con cartel: la imagen, sin el logo encima ──')
{
  const r = await abrir(b, '/eventos', { antes: `window.__FAKE_EVENTOS__[0].cartel_url = ${JSON.stringify(CARTEL)}` })
  const c = await r.page.$eval('[data-ev="iberian-card-show-2026"] .ev-cartel', (x) => ({ img: x.classList.contains('con-imagen') && /url\(/.test(x.style.backgroundImage), logo: !!x.querySelector('.ev-logo-cartel'), pastilla: !!x.querySelector('.ev-pastilla') }))
  check('con cartel: la imagen de fondo, la pastilla encima y sin el logo', c.img && !c.logo && c.pastilla, JSON.stringify(c))
  await r.ctx.close()
}

console.log('── 3. La ficha: todo lo que se lee, arriba ──')
{
  const { ctx, page, errores } = await abrir(b, '/eventos/iberian-card-show-2026')
  const cab = await page.$eval('.ev-cab', (h) => ({
    desc: h.querySelector('.ev-desc')?.textContent,
    datos: [...h.querySelectorAll('.ev-datos li')].map((li) => li.textContent.trim()),
    logo: !!h.querySelector('.ev-logo.grande'),
    voy: !!h.querySelector('[data-voy]'),
  }))
  check('la cabecera lleva el logo, la descripción, dónde, juegos, web, @ y TCG Map Spain', cab.logo && cab.voy && cab.desc === 'Más de 120 mesas de compraventa.' && cab.datos.some((d) => /Pabellón Cristal/.test(d)) && cab.datos.includes('iberiancardshow.es') && cab.datos.includes('@iberiancardshow') && cab.datos.includes('Ver en TCG Map Spain') && cab.datos.some((d) => /One Piece/.test(d)), JSON.stringify(cab))
  const pliegue = await page.evaluate(() => { const d = document.querySelector('.ev-datos'); return d.getBoundingClientRect().bottom <= innerHeight })
  check('  …y se ve sin bajar (PC)', pliegue)
  check('el tipo sale una vez (en la cabecera, no en el cartel)', (await page.$$('.ev-cartel-ficha .ev-tipo')).length === 0 && /Card show/i.test(await page.textContent('.ev-cab .ev-chapa')))
  check('la cuenta atrás, en el cartel', (await page.textContent('.ev-cartel-ficha .ev-cuenta')) === 'Faltan 4 días')
  const ent = await page.$$eval('.ev-entrada', (l) => l.map((x) => ({ c: x.className, comprar: x.querySelector('.ev-comprar')?.href || '' })))
  check('las entradas: la VIP en dorado, la gratis en verde, «Comprar ›» solo donde hay enlace', ent.length === 3 && /vip/.test(ent[1].c) && /gratis/.test(ent[2].c) && ent[0].comprar === 'https://entradas.example/ics' && !ent[1].comprar, JSON.stringify(ent))
  check('los días, cada uno con su horario', (await page.$$('.ev-dia')).length === 2 && /10:00 – 18:00/.test(await page.textContent('.ev-dias')))
  check('«Dónde» con «Cómo llegar» al mapa', /google\.com\/maps/.test(await page.getAttribute('.ev-llegar', 'href')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
  const m = await abrir(b, '/eventos/iberian-card-show-2026', { movil: true })
  check('en el móvil la descripción también va arriba, antes de las entradas', await m.page.evaluate(() => document.querySelector('.ev-desc').getBoundingClientRect().top < document.querySelector('.ev-entradas').getBoundingClientRect().top))
  check('  …y no se sale de lado', (await m.page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0)
  await m.ctx.close()
}

console.log('── 4. /admin: el cartel y el enlace de cada entrada ──')
{
  const { ctx, page, errores } = await abrir(b, '/admin/?ver=eventos', { quien: 'admin-1' })
  await page.waitForSelector('[data-ev-editar="e1"]', { timeout: 8000 })
  await page.click('[data-ev-editar="e1"]')
  check('la vista previa del cartel, con las clases de la agenda', !!(await page.$('#evfCartelVista .ev-cartel .ev-logo-cartel')) && /Iberian Card Show/.test(await page.textContent('#evfCartelVista')))
  const enlace = await page.inputValue('[data-entrada="0"] [data-campo="url"]')
  check('el enlace de compra de la entrada, en su campo', enlace === 'https://entradas.example/ics', enlace)
  await page.fill('[data-entrada="1"] [data-campo="url"]', 'entradas.example/vip')
  await page.fill('[data-entrada="2"] [data-campo="url"]', 'javascript:alert(1)')
  await page.click('#evfGuardar')
  check('un enlace que no es web no se guarda y lo dice', /no es una dirección web/.test(await page.textContent('#evfError')))
  await page.fill('[data-entrada="2"] [data-campo="url"]', '')
  await page.evaluate(() => { document.querySelector('#evf-cartel_url').value = 'https://img.example/cartel.jpg' })
  await page.click('#evfGuardar')
  await page.waitForTimeout(600)
  const g = await page.evaluate(() => window.__FAKE_EVENTOS__.find((e) => e.id === 'e1'))
  check('guarda el cartel y los enlaces (con https://)', g.cartel_url === 'https://img.example/cartel.jpg' && g.entradas[1].url === 'https://entradas.example/vip' && g.entradas[2].url === '', JSON.stringify([g.cartel_url, g.entradas]))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
  const sin = await abrir(b, '/admin/?ver=eventos', { quien: 'admin-1', antes: () => { window.__SIN_COLUMNAS__ = { eventos: ['cartel_url'] } } })
  await sin.page.waitForSelector('[data-ev-editar="e1"]', { timeout: 8000 })
  await sin.page.click('[data-ev-editar="e1"]')
  check('sin la migración 1194, el cartel dice qué falta y se guarda lo demás', /1194/.test(await sin.page.textContent('#evForm')) && !(await sin.page.$('#evf-cartel')))
  await sin.page.click('#evfGuardar')
  await sin.page.waitForTimeout(600)
  check('  …sin errores al guardar (el formulario se cierra)', !(await sin.page.$('#evForm')) && !sin.errores.length, sin.errores.join(' | '))
  await sin.ctx.close()
}

console.log('── 5. La portada: con el color del evento ──')
{
  const { ctx, page, errores } = await abrir(b, '/')
  await page.waitForTimeout(1000)
  const c = await page.$eval('#eventoPortada .portada-evento', (a) => getComputedStyle(a).getPropertyValue('--ev-color').trim())
  check('el bloque del próximo evento lleva su color', c === '#1f5175', c)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
