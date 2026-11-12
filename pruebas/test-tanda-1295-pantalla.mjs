// Tanda 1295 — la SALA del evento (la A de «Que se vea quién va», PINGU:
// «haz lo recomendado»): las caras de los que van amontonadas en la cabecera
// con el número en grande; los que sigues delante y en la barra («Van 2 que
// sigues»); «Eres el nº N de PokeDoc» al apuntarte, con tu cara entrando en la
// sala; y «Compártelo», la imagen «Voy a…» con el marco de redes. Y lo puro:
// `salaDe`, `miNumeroDe`, `textoDeSigues`, `textoDeVoy`.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { salaDe, miNumeroDe, textoDeSigues } from '/home/user/pingu/js/eventos-puro.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── Lo puro ──')
{
  const p = (id) => ({ id, display_name: id.toUpperCase() })
  const caras = ['a', 'b', 'c', 'yo', 'd'].map(p)
  const s = salaDe({ caras, van: 7, voy: true, yo: 'yo', sigo: new Set(['c']) })
  check('tú primero, luego los que sigues, luego por llegada', s.caras.slice(0, 3).map((c) => c.persona?.id).join() === 'yo,c,a', s.caras.map((c) => c.persona?.id || 'x').join())
  check('  …tú con tu aro y los que sigues marcados', s.caras[0].tu && s.caras[1].sigues && !s.caras[2].sigues)
  check('  …y los que van sin decirlo, como caras rayadas (2)', s.caras.filter((c) => c.oculto).length === 2)
  check('  …las tres primeras, grandes', s.caras.slice(0, 3).every((c) => c.tam === 'g') && s.caras[3].tam === 'm')
  check('  …y todas dentro de la sala', s.caras.every((c) => c.x >= 0 && c.x <= 100 && c.y >= 0 && c.y <= 100))
  const poca = salaDe({ caras: [p('a')], van: 1 })
  check('con 1, huecos hasta 5 («¿Te apuntas?»)', poca.caras.length === 5 && poca.caras.filter((c) => c.hueco).length === 4)
  const llena = salaDe({ caras: Array.from({ length: 40 }, (_, i) => p(`u${i}`)), van: 45 })
  check('con 45, 30 en la sala y «+15» fuera', llena.caras.length === 30 && llena.fuera === 15, llena.fuera)
  const cerca = (sala) => Math.max(...sala.caras.map((c) => Math.hypot(c.x - 50, c.y - 50)))
  check('con poca gente, más juntas', cerca(poca) < cerca(llena) * 0.6, `${cerca(poca).toFixed(1)} / ${cerca(llena).toFixed(1)}`)
  const yoOculto = salaDe({ caras: [p('a')], van: 2, voy: true, oculto: true, yo: 'yo' })
  check('si vas sin decirlo, tu aro va en una cara rayada', yoOculto.caras.some((c) => c.oculto && c.tu))
  check('nº: lo que dice la base (1295)', miNumeroDe({ voy: true, mi_numero: 14 }, 'yo') === 14)
  check('  …sin ella, tu puesto si todos se ven', miNumeroDe({ voy: true, van: 5, caras }, 'yo') === 4)
  check('  …y nada si alguien va sin decirlo (no se sabe seguro)', miNumeroDe({ voy: true, van: 7, caras }, 'yo') === null)
  check('  …ni si no vas', miNumeroDe({ voy: false, mi_numero: 3 }, 'yo') === null)
  check('«Va 1 que sigues: A»', textoDeSigues([p('a')]) === 'Va 1 que sigues: A')
  check('«Van 5 que sigues: A, B, C y 2 más»', textoDeSigues(['a', 'b', 'c', 'd', 'e'].map(p)) === 'Van 5 que sigues: A, B, C y 2 más')
  const { textoDeVoy } = await import('/home/user/pingu/js/eventos-puro.js')
  if (textoDeVoy) {
    const t = textoDeVoy({ nombre: 'Iberian Card Show', fecha: '14 y 15 nov', lugar: 'Madrid', numero: 14, url: 'https://pokedoc.es/eventos/ib' })
    check('el texto de compartir: evento, nº y enlace', /Voy a Iberian Card Show \(14 y 15 nov\) · Madrid/.test(t) && /nº 14 de PokeDoc/.test(t) && /pokedoc\.es\/eventos\/ib$/.test(t), t)
  }
}

const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
const ev = (asistentes) => ({ id: 'id-ib', slug: 'iberian', nombre: 'IBERIAN CARD SHOW', tipo: 'card_show', publicado: true, color: '#3a5fb8', ciudad: 'Madrid', sitio: 'Pabellón de Cristal',
  horario: [{ dia: dia(3), desde: '10:00', hasta: '19:00' }], empieza: new Date(dia(3) + 'T10:00').toISOString(), termina: new Date(dia(3) + 'T19:00').toISOString(), asistentes })
const MUCHOS = [{ user_id: 'user-1' }, { user_id: 'mod-1' }, { user_id: 'user-2' }, ...Array.from({ length: 20 }, (_, i) => ({ user_id: `extra-${i}` })), { user_id: 'oc-1', oculto: true }, { user_id: 'oc-2', oculto: true }]

async function abrir({ movil = false, quien = 'admin-1', asistentes = MUCHOS, sin1295 = false } = {}) {
  const ctx = await contexto(b, movil, quien)
  await ctx.addInitScript(`window.__FAKE_EVENTOS__ = ${JSON.stringify([ev(asistentes)])}; window.__FAKE_SEGUIDOS__ = [{}, {}]; ${sin1295 ? 'window.__SIN_1295__ = true;' : ''}`)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/eventos/iberian`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ev-sala', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(700)
  return { ctx, page, errores }
}
const leer = (page) => page.evaluate(() => {
  const caras = [...document.querySelectorAll('.ev-sala-cara')]
  const caja = document.querySelector('.ev-sala-caras')?.getBoundingClientRect()
  return {
    num: document.querySelector('.ev-sala-num b')?.textContent,
    lema: document.querySelector('.ev-sala-num span')?.textContent,
    caras: caras.length,
    rayadas: caras.filter((c) => c.classList.contains('oculto')).length,
    sigues: caras.filter((c) => c.classList.contains('sigues')).length,
    tu: caras.filter((c) => c.classList.contains('tu')).length,
    entra: !!document.querySelector('.ev-sala-cara.entra'),
    dentro: !!caja && caras.every((c) => { const r = c.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; return cx >= caja.left - 2 && cx <= caja.right + 2 && cy >= caja.top - 2 && cy <= caja.bottom + 2 }),
    enlaces: caras.filter((c) => c.tagName === 'A' && (c.getAttribute('href') || '').length > 1).length,
    barraSigues: document.querySelector('.ev-sala .ev-sigues')?.textContent.replace(/\s+/g, ' ').trim() || '',
    lineaNumero: !!document.querySelector('.ev-numero'),
    ocultoEnQuien: !!document.querySelector('.ev-quien #evOculto'),
    compartirVoy: !!document.querySelector('.ev-barra .ev-atajos [data-compartir-voy]'),
    numero: document.querySelector('.ev-sala-tu')?.textContent.replace(/\s+/g, ' ').trim() || '',
    salaAlLado: (() => { const i = document.querySelector('.ev-poster-info')?.getBoundingClientRect(); const s = document.querySelector('.ev-sala')?.getBoundingClientRect(); return i && s ? s.left >= i.right - 4 : false })(),
    ancho: document.documentElement.scrollWidth <= innerWidth,
  }
})

const b = await chromium.launch()
for (const movil of [false, true]) {
  console.log(`── La sala, ${movil ? 'móvil' : 'PC'} (25 van, 2 sin decirlo, sigues a 2) ──`)
  const { ctx, page, errores } = await abrir({ movil })
  let r = await leer(page)
  check('el número en grande: 25, «de PokeDoc van · 2 sin decirlo»', r.num === '25' && /van · 2 sin decirlo/.test(r.lema), `${r.num} ${r.lema}`)
  check('las caras en la sala, las rayadas incluidas', r.caras === 25 && r.rayadas === 2, `${r.caras} / ${r.rayadas}`)
  check('  …todas dentro de su caja', r.dentro)
  check('  …y cada cara lleva a su perfil', r.enlaces === 23, r.enlaces)
  check('los 2 que sigues, marcados en la sala y bajo su número', r.sigues === 2 && /Van 2 que sigues: Ash y Misty/.test(r.barraSigues), r.barraSigues)
  if (!movil) check('en el PC la sala va AL LADO del nombre', r.salaAlLado)
  check('no se sale de lado', r.ancho)
  check('sin ir, ni aro ni número', r.tu === 0 && !r.numero)
  await page.screenshot({ path: `/tmp/1295-${movil ? 'movil' : 'pc'}.png`, fullPage: !movil })
  await page.click('.ev-acciones [data-voy]')
  await page.waitForTimeout(900)
  r = await leer(page)
  check('«¡Voy!»: entras en la sala con tu aro (y entrando)', r.tu === 1 && r.entra && r.num === '26', `${r.tu} ${r.entra} ${r.num}`)
  check('  …y «Tú eres el nº 26» en la sala, sin otra línea en la barra (1295b)', r.numero === 'Tú eres el nº 26' && !r.lineaNumero, r.numero)
  check('  …«Compartir» de la barra abre «Voy a…», e «Ir sin decirlo» va en «Quién va»', r.compartirVoy && r.ocultoEnQuien)
  if (!movil) await page.locator('.ev-poster').screenshot({ path: '/tmp/1295-pc-voy.png' })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── «Compártelo»: la imagen «Voy a…» ──')
{
  const { ctx, page, errores } = await abrir({ asistentes: [{ user_id: 'user-1' }, { user_id: 'admin-1' }] })
  check('ya vas: «Tú eres el nº 2»', /Tú eres el nº 2/.test(await page.textContent('.ev-sala-tu')))
  await page.click('[data-compartir-voy]')
  await page.waitForSelector('dialog[open]', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const hoja = await page.evaluate(() => {
    const d = document.querySelector('dialog[open]')
    const lienzo = d?.querySelector('canvas')
    const img = d?.querySelector('img')
    return { abierta: !!d, texto: d?.textContent.replace(/\s+/g, ' ').slice(0, 200) || '', ancho: lienzo?.width || img?.naturalWidth || 0 }
  })
  check('abre la hoja de compartir con su imagen', hoja.abierta && hoja.ancho >= 1000, JSON.stringify(hoja))
  const png = await page.evaluate(async () => {
    const { pintarVoy } = await import('/js/evento-compartir.js')
    const ev = window.__FAKE_EVENTOS__[0]
    const c = await pintarVoy(document.createElement('canvas'), { evento: { ...ev, van: 2, caras: [{ id: 'admin-1', display_name: 'PINGU' }, { id: 'user-1', display_name: 'Ash' }] }, numero: 2, yo: 'admin-1', formato: 'historia' })
    return { w: c.width, h: c.height, url: c.toDataURL('image/png').slice(0, 30) }
  })
  check('la imagen se pinta (1080×1350) y se puede exportar', png.w === 1080 && png.h === 1350 && /^data:image\/png/.test(png.url), JSON.stringify(png))
  await page.evaluate(async () => {
    const { pintarVoy } = await import('/js/evento-compartir.js')
    const ev = window.__FAKE_EVENTOS__[0]
    const c = await pintarVoy(document.createElement('canvas'), { evento: { ...ev, van: 2, caras: [{ id: 'admin-1', display_name: 'PINGU' }, { id: 'user-1', display_name: 'Ash' }] }, numero: 2, yo: 'admin-1', formato: 'historia' })
    window.__VOY_PNG__ = c.toDataURL('image/png')
  })
  const datos = await page.evaluate(() => window.__VOY_PNG__)
  const { writeFileSync } = await import('node:fs')
  writeFileSync('/tmp/1295-voy.png', Buffer.from(datos.split(',')[1], 'base64'))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── Sin la migración 1295 ──')
{
  const todos = await abrir({ sin1295: true, asistentes: [{ user_id: 'user-1' }, { user_id: 'admin-1' }] })
  check('si todos se ven, el número igual (por orden)', /Tú eres el nº 2/.test(await todos.page.textContent('.ev-sala-tu')))
  await todos.ctx.close()
  const conOcultos = await abrir({ sin1295: true, asistentes: [{ user_id: 'oc-1', oculto: true }, { user_id: 'admin-1' }] })
  const t = await conOcultos.page.textContent('.ev-sala')
  check('si alguien va sin decirlo, sin número (no se sabe seguro)', !/nº/.test(t) && !!(await conOcultos.page.$('.ev-atajos [data-compartir-voy]')), t)
  check('sin errores', !conOcultos.errores.length, conOcultos.errores.join(' | '))
  await conOcultos.ctx.close()
}

console.log('── Nadie todavía y sin cuenta ──')
{
  const { ctx, page, errores } = await abrir({ quien: 'none', asistentes: [] })
  const r = await leer(page)
  check('«Sé el primero de PokeDoc», con 5 huecos', !r.num && /Sé el primero de PokeDoc/.test(r.lema) && r.caras === 5, JSON.stringify(r))
  check('sin cuenta, ni «que sigues» ni número', !r.barraSigues && !r.numero)
  await page.locator('.ev-poster').screenshot({ path: '/tmp/1295-vacio.png' })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
