// Tanda 1196 — eventos más compactos y alineados (PINGU eligió la A de «Eventos
// más compactos»: «demasiado grande… ¿para qué queremos tanto amarillo?…
// prefiero que esté bien alineada»). La franja de arriba es baja y su color
// sale del LOGO difuminado (sin cartel subido); las cajas de cada fila de la
// ficha miden lo mismo; y «Cuándo» solo sale si los días tienen horarios
// distintos (si no, ya lo dice la cabecera).
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#e4d428"/></svg>'
const sembrar = () => {
  const x = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
  const ev = (o) => { const h = o.horario; const [a, m, d] = h[0].dia.split('-').map(Number); const [b, n, f] = h.at(-1).dia.split('-').map(Number); return { publicado: true, asistentes: [], entradas: [], empieza: new Date(a, m - 1, d, Number(h[0].desde.slice(0, 2))).toISOString(), termina: new Date(b, n - 1, f, Number(h.at(-1).hasta.slice(0, 2))).toISOString(), ...o } }
  window.__FAKE_EVENTOS__ = [
    ev({ id: 'e1', slug: 'castellon', nombre: 'CASTELLON CARD SHOW', tipo: 'card_show', horario: [{ dia: x(4), desde: '10:00', hasta: '20:00' }, { dia: x(5), desde: '10:00', hasta: '20:00' }], sitio: 'Carpa Multiusos', ciudad: 'Oropesa del Mar', color: '#d4d42a', logo_url: 'https://img.example/ccs.svg', descripcion: 'Un evento de cartas.', entradas: [{ nombre: 'General', precio: 5 }, { nombre: 'VIP', precio: 25 }, { nombre: 'Rookie', precio: 0, nota: 'Menores de 5 años' }] }),
    ev({ id: 'e2', slug: 'distintos', nombre: 'Horarios distintos', tipo: 'card_show', horario: [{ dia: x(10), desde: '10:00', hasta: '20:00' }, { dia: x(11), desde: '10:00', hasta: '14:00' }], ciudad: 'Madrid', color: '#1f5175', entradas: [{ nombre: 'General', precio: 8 }] }),
    ev({ id: 'e3', slug: 'con-cartel', nombre: 'Con cartel', tipo: 'quedada', horario: [{ dia: x(12), desde: '18:00', hasta: '21:00' }], ciudad: 'Valencia', logo_url: 'https://img.example/ccs.svg', cartel_url: 'https://img.example/cartel.svg' }),
  ]
}
async function abrir(b, ruta, { movil = false } = {}) {
  const ctx = await contexto(b, movil, 'user-1', sembrar)
  await ctx.route('https://img.example/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: LOGO }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/serviceWorker' property/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  return { ctx, page, errores }
}
const b = await chromium.launch()

console.log('── 1. La agenda: franja baja con el ambiente del logo ──')
{
  const { ctx, page, errores } = await abrir(b, '/eventos')
  const c = await page.$eval('[data-ev="castellon"] .ev-cartel', (x) => ({ alto: Math.round(x.getBoundingClientRect().height), ambiente: /ccs\.svg/.test(x.querySelector('.ev-ambiente')?.style.backgroundImage || ''), logo: !!x.querySelector('.ev-logo-cartel img') }))
  check('la franja mide como mucho 96 px (antes, 16:10)', c.alto <= 96, c.alto)
  check('  …con el logo difuminado de fondo y el logo nítido encima', c.ambiente && c.logo, JSON.stringify(c))
  check('sin logo, no hay ambiente: sale el color del evento', !(await page.$('[data-ev="distintos"] .ev-ambiente')))
  check('con cartel subido, el cartel y sin ambiente', await page.$eval('[data-ev="con-cartel"] .ev-cartel', (x) => x.classList.contains('con-imagen') && !x.querySelector('.ev-ambiente')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
  const m = await abrir(b, '/eventos', { movil: true })
  check('en el móvil, también baja', (await m.page.$eval('.ev-cartel', (x) => x.getBoundingClientRect().height)) <= 96)
  await m.ctx.close()
}

console.log('── 2. La ficha: franja baja y filas igualadas ──')
{
  const { ctx, page, errores } = await abrir(b, '/eventos/castellon')
  check('la franja de arriba mide como mucho 150 px', (await page.$eval('.ev-cartel-ficha', (x) => x.getBoundingClientRect().height)) <= 150)
  const fila = await page.$$eval('.ev-rejilla > *', (l) => l.map((x) => { const r = x.getBoundingClientRect(); return { c: x.className, top: Math.round(r.top), bottom: Math.round(r.bottom) } }))
  check('Entradas y Quién va empiezan y acaban a la vez', fila[0].top === fila[1].top && fila[0].bottom === fila[1].bottom, JSON.stringify(fila))
  check('  …y Dónde va debajo, a lo ancho', /ev-r-ancha/.test(fila[2]?.c) && fila[2].top > fila[0].bottom, JSON.stringify(fila[2]))
  check('mismo horario los dos días: sin la caja «Cuándo» (lo dice la cabecera)', !(await page.$('#evCuandoT')) && /10:00 – 20:00/.test(await page.textContent('.ev-cuando-largo')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
  const d = await abrir(b, '/eventos/distintos')
  check('horarios distintos: sale «Cuándo», en la columna de Quién va', !!(await d.page.$('.ev-r-lado #evCuandoT')) && (await d.page.$$('.ev-dia')).length === 2)
  const f2 = await d.page.$$eval('.ev-rejilla > *', (l) => l.slice(0, 2).map((x) => Math.round(x.getBoundingClientRect().bottom)))
  check('  …y la fila sigue igualada', f2[0] === f2[1], JSON.stringify(f2))
  await d.ctx.close()
  const m = await abrir(b, '/eventos/castellon', { movil: true })
  check('en el móvil, la franja mide como mucho 96 px y no se sale de lado', (await m.page.$eval('.ev-cartel-ficha', (x) => x.getBoundingClientRect().height)) <= 96 && (await m.page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0)
  await m.ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
