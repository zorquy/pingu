// Tanda 1244 — /tiendas, un escaparate de escaparates, y /para-tiendas aparte
// (PINGU: «que se vean bien las tiendas… el formulario lo dejaría aparte», y
// «cuidado con los botones de ver más: hazlos como en la web, redonditos»).
// Se mira:
//   · lo puro: el horario que se entiende y el que no (sin chapa), y los chips;
//   · la banda con las cifras, «Tienen algo de tu lista» arriba y «Más
//     tiendas» debajo, cada tarjeta con su nombre de tienda, su enlace a
//     /tiendas/<usuario>, ciudad, local u online, redes, cuentas, sus cuatro
//     de escaparate con precio (sin precio si no lo enseña), «Ver escaparate» y
//     «Escribir» (a registrarse sin cuenta);
//   · los chips (Online, Con local, Abiertas ahora, De tu lista, Todas, Ciudad)
//     y el buscador, que manda el texto sin acentos;
//   · «Recién llegado» con «Ver más», «Ver más tiendas», los dos en pastilla;
//   · sin la migración 1244 (lo de la 1236) y sin ninguna, y /tiendas#para-tiendas
//     → /para-tiendas;
//   · el móvil: sin salirse de ancho, la primera tienda antes de 296 px.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro ──')
{
  const P = await import(`${RAIZ}/js/tiendas-puro.js`)
  const jue12 = new Date(2026, 10, 5, 12, 0)
  const jue15 = new Date(2026, 10, 5, 15, 0)
  const sab21 = new Date(2026, 10, 7, 21, 0)
  check('«L–S · 10:30–20:30»: abierta hasta 20:30; el sábado por la noche, abre el lunes', JSON.stringify(P.estadoDeHorario('L–S · 10:30–20:30', jue12)) === '{"abierta":true,"hasta":"20:30"}' && P.estadoDeHorario('L–S · 10:30–20:30', sab21)?.abre === 'el lunes 10:30')
  check('partido: a las 15, cerrada y abre hoy 17:00', P.estadoDeHorario('L-V 10-14 y 17-20:30, S 10-14', jue15)?.abre === 'hoy 17:00')
  check('en palabras («lunes a sábado de 10:00 a 20:00»)', P.estadoDeHorario('lunes a sábado de 10:00 a 20:00', jue12)?.hasta === '20:00')
  check('lo que no se entiende no dice nada («Solo con cita», «10-20» sin días)', P.estadoDeHorario('Solo con cita', jue12) === null && P.estadoDeHorario('10-20', jue12) === null && P.estadoDeHorario('', jue12) === null)
  const A = P
  if (A.filtrarTiendas) {
    const ts = [{ con_local: true, ciudad: 'Bilbao', de_tu_lista: 1 }, { con_local: false, ciudad: 'Madrid', de_tu_lista: 0 }]
    check('los chips: online, con local, de tu lista y ciudad', A.filtrarTiendas(ts, { online: true }).length === 1 && A.filtrarTiendas(ts, { local: true })[0].ciudad === 'Bilbao' && A.filtrarTiendas(ts, { lista: true }).length === 1 && A.filtrarTiendas(ts, {}, 'madrid').length === 1)
  }
}

const SIEMPRE = 'L-D 0:00-23:59'
const T = (id, u, n, extra = {}) => ({
  user_id: id, username: u, display_name: n, avatar_url: null, banner_url: null, ciudad: 'Bilbao', con_local: true, online: false,
  horario: null, web: null, instagram: null, cartas: 10, productos: 0, de_tu_lista: 0, precios: true, destacadas: [], ...extra,
})
const TODAS = [
  T('t1', 'ryu', 'RyuCards', { de_tu_lista: 3, horario: SIEMPRE, web: 'ryucards.es', instagram: 'ryucards', cartas: 860, productos: 12, destacadas: [
    { id: 'a1', card_id: 'carta-1', market: 'WEST', precio: 45 }, { id: 'a2', card_id: 'carta-2', market: 'WEST', precio: 12 }, { id: 'a3', card_id: 'carta-3', market: 'WEST', precio: 8.5, precio_antes: 10 }, { id: 'a4', product_id: 501, precio: 64.95 }] }),
  T('t2', 'norte', 'Cartas del Norte', { de_tu_lista: 1, ciudad: 'Santander' }),
  T('t3', 'rincon', 'El Rincón', { con_local: false, online: true, ciudad: null }),
  T('t4', 'kanto', 'Kanto Cards', { ciudad: 'Madrid', precios: false, destacadas: [{ id: 'k1', card_id: 'carta-2', market: 'WEST', precio: null }] }),
  ...Array.from({ length: 12 }, (_, i) => T(`m${i}`, `mas${i}`, `Tienda ${i}`, { ciudad: 'Madrid' })),
]
const agenda = (lista) => ({ total: lista.length, ciudades: { Bilbao: 1, Madrid: 13, Santander: 1 }, cifras: { tiendas: 16, ciudades: 3, cartas: 18420 }, tiendas: lista })
const RECIEN = Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, card_id: `carta-${i % 4}`, market: 'WEST', nombre: `Carta ${i}`, precio: 10 + i, entro_el: new Date(Date.now() - i * 36e5).toISOString(), tienda: { user_id: 't1', username: 'ryu', display_name: 'RyuCards' } }))
const CARTAS = Array.from({ length: 4 }, (_, i) => ({ id: `carta-${i}`, set_id: 'set-0', local_id: String(i), name: `Carta ${i}` }))

const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-2', movil = false, rpc = null } = {}) {
  const ctx = await b.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), serviceWorkers: 'block' })
  const respuestas = rpc === null ? { tiendas_agenda: agenda(TODAS), tiendas_recien: RECIEN } : rpc
  await ctx.addInitScript(([s, r, c, todas]) => {
    window.__FAKE_SESSION__ = s
    const resp = { ...r }
    // El texto lo filtra la base: aquí, por nombre y por la carta «charizard» (RyuCards).
    if (r.tiendas_agenda && todas) resp.tiendas_agenda = (a) => {
      const q = a.p_texto || ''
      const sin = (x) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const v = todas.filter((t) => !q || sin(t.display_name).includes(q) || (q === 'charizard' && t.username === 'ryu'))
      return { ...r.tiendas_agenda, total: v.length, tiendas: v.slice(a.p_desde || 0, (a.p_desde || 0) + (a.p_cuantas || 24)) }
    }
    if (r.tiendas_recien) resp.tiendas_recien = (a) => r.tiendas_recien.slice(0, a.p_cuantas || 8)
    window.__RPC_RESPUESTAS__ = resp
    window.__FAKE_CARTAS__ = c
    window.__FAKE_FILAS__ = { tcg_products: [{ id: 501, name: 'ETB de prueba', image: null }] }
    try { localStorage.setItem('pd-bienvenida-comunidad', '1') } catch {}
  }, [sesion, respuestas, CARTAS, respuestas.tiendas_agenda?.tiendas ? respuestas.tiendas_agenda.tiendas : null])
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex|pokemontcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2600)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => (r.nombre || r.name) === nombre).map((r) => r.args), n)
const tarjetas = (p, sel) => p.$$eval(`${sel} .tag-tarjeta`, (xs) => xs.map((x) => ({
  nombre: x.querySelector('.tag-nombre')?.textContent, tienda: x.querySelector('.tag-nombre')?.hasAttribute('data-nombre-tienda'),
  href: x.querySelector('.tag-nombre-enlace')?.getAttribute('href'), linea: x.querySelector('.tag-linea')?.innerText.replace(/\s+/g, ' '),
  datos: x.querySelector('.tag-datos')?.innerText.replace(/\s+/g, ' '), estado: x.querySelector('.tag-estado')?.textContent || null,
  cartas: [...x.querySelectorAll('.tag-carta')].map((c) => (c.querySelector('.tag-precio')?.textContent || '').replace(/\s/g, ' ')),
  escribir: x.querySelector('.tag-botones a.btn-secondary')?.getAttribute('href') || null,
})))
const pastilla = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e && !e.hidden && e.classList.contains('btn-secondary') && parseFloat(getComputedStyle(e).borderTopLeftRadius) >= 20 && e.getBoundingClientRect().height >= 40 }, sel)

console.log('── 2. /tiendas en el PC ──')
{
  const { p, ctx, errs } = await abrir('/tiendas')
  check('sin errores; el <h1> de la banda y sus cifras', !errs.length && /Tiendas de cartas/.test(await p.textContent('h1')) && /16\s*tiendas/.test((await p.textContent('#tagCifras')).replace(/\s+/g, ' ').replace(/tiendas\s*16/, '16 tiendas')) && /18\.420/.test(await p.textContent('#tagCifras')), errs.join(' | '))
  const tuyas = await tarjetas(p, '#tagRejillaTuyas')
  check('«Tienen algo de tu lista»: RyuCards y Cartas del Norte', tuyas.map((t) => t.nombre).join('|') === 'RyuCards|Cartas del Norte', JSON.stringify(tuyas.map((t) => t.nombre)))
  const ryu = tuyas[0] || {}
  check('RyuCards: nombre de tienda, a /tiendas/ryu con lo de tu lista', ryu.tienda && ryu.href === '/tiendas/ryu?lista=1', JSON.stringify(ryu))
  check('  …Bilbao, con local, su web y su Instagram', /Bilbao/.test(ryu.linea) && /Con local/.test(ryu.linea) && /ryucards\.es/.test(ryu.linea) && /@ryucards/.test(ryu.linea), ryu.linea)
  check('  …3 de tu lista, 860 cartas y 12 productos', /3 de tu lista/.test(ryu.datos) && /860 cartas/.test(ryu.datos) && /12 productos/.test(ryu.datos), ryu.datos)
  check('  …abierta ahora (su horario)', /^Abierta · hasta 23:59$/.test(ryu.estado || ''), ryu.estado)
  check('  …sus cuatro de escaparate con precio', ryu.cartas?.length === 4 && ryu.cartas[0] === '45,00 €' && ryu.cartas[3] === '64,95 €', JSON.stringify(ryu.cartas))
  check('  …y «Escribir» a sus mensajes', ryu.escribir === '/mensajes.html?with=t1', ryu.escribir)
  const resto = await tarjetas(p, '#tagRejilla')
  check('«Más tiendas»: las demás, 12 a la vista', (await p.textContent('#tagTituloTodas')) === 'Más tiendas' && resto.length === 12 && !resto.some((t) => t.nombre === 'RyuCards'), resto.length)
  const kanto = resto.find((t) => t.nombre === 'Kanto Cards')
  check('Kanto no enseña precios: su carta, sin precio; sin horario, sin chapa', kanto && kanto.cartas.length === 1 && kanto.cartas[0] === '' && kanto.estado === null, JSON.stringify(kanto))
  check('El Rincón, online', /Online/.test(resto.find((t) => t.nombre === 'El Rincón')?.linea || ''))
  check('«Ver más tiendas» en pastilla, y enseña las que faltan', await pastilla(p, '#tagMas'))
  await p.click('#tagMas'); await p.waitForTimeout(300)
  check('  …las 14', (await p.locator('#tagRejilla .tag-tarjeta').count()) === 14 && await p.evaluate(() => document.getElementById('tagMas').hidden))
  check('«Recién llegado»: ocho, con su tienda y su precio', (await p.locator('#tagTira .tag-nov').count()) === 8 && (await p.locator('#tagTira .tag-nov small[data-nombre-tienda]').count()) === 8 && /10,00\s€/.test(await p.textContent('#tagTira')))
  check('  …su enlace, al escaparate con la carta', (await p.getAttribute('#tagTira .tag-nov', 'href')) === '/tiendas/ryu?carta=carta-0')
  check('  …y «Ver más» en pastilla', await pastilla(p, '#tagRecienMas'))
  await p.click('#tagRecienMas'); await p.waitForTimeout(500)
  check('  …que pide más', (await llamadas(p, 'tiendas_recien')).at(-1)?.p_cuantas === 24)
  check('la invitación a las tiendas, abajo, a /para-tiendas', (await p.getAttribute('.tag-cta a', 'href')) === '/para-tiendas')
  if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/1244-pc.png`, fullPage: true })

  console.log('── 3. Los chips y el buscador ──')
  const nombres = () => p.$$eval('#tagRejilla .tag-nombre', (xs) => xs.map((x) => x.textContent))
  await p.click('[data-tag-filtro="online"]'); await p.waitForTimeout(300)
  check('Online: solo El Rincón, y sin el bloque de tu lista ni la tira', (await nombres()).join('|') === 'El Rincón' && await p.evaluate(() => document.getElementById('tagTuyas').hidden && document.getElementById('tagRecien').hidden) && (await p.getAttribute('[data-tag-filtro="online"]', 'aria-pressed')) === 'true')
  await p.click('[data-tag-filtro="local"]'); await p.waitForTimeout(300)
  check('Con local quita Online (una tienda es una de las dos)', (await p.getAttribute('[data-tag-filtro="online"]', 'aria-pressed')) === 'false' && !(await nombres()).includes('El Rincón'))
  await p.click('[data-tag-filtro="todas"]'); await p.waitForTimeout(300)
  check('«Todas» quita los filtros', (await p.getAttribute('[data-tag-filtro="todas"]', 'aria-pressed')) === 'true' && !(await p.evaluate(() => document.getElementById('tagTuyas').hidden)))
  check('«Abiertas ahora» sale (hay un horario que se entiende)', await p.isVisible('[data-tag-filtro="abiertas"]'))
  await p.click('[data-tag-filtro="abiertas"]'); await p.waitForTimeout(300)
  check('  …y deja solo RyuCards', (await nombres()).join('|') === 'RyuCards')
  await p.click('[data-tag-filtro="todas"]'); await p.waitForTimeout(300)
  await p.selectOption('#tagCiudad', 'Santander'); await p.waitForTimeout(300)
  check('la ciudad: Cartas del Norte', (await nombres()).join('|') === 'Cartas del Norte')
  await p.selectOption('#tagCiudad', ''); await p.waitForTimeout(300)
  await p.fill('#tagBusca', 'Rincón'); await p.waitForTimeout(700)
  check('buscar manda el texto sin acentos y en minúsculas', (await llamadas(p, 'tiendas_agenda')).at(-1)?.p_texto === 'rincon' && (await nombres()).join('|') === 'El Rincón', JSON.stringify((await llamadas(p, 'tiendas_agenda')).at(-1)))
  await p.fill('#tagBusca', 'charizard'); await p.waitForTimeout(700)
  check('  …y por carta (lo decide la base)', (await nombres()).join('|') === 'RyuCards')
  await p.fill('#tagBusca', 'zzz'); await p.waitForTimeout(700)
  check('ninguna: lo dice, con «Quitar los filtros»', /Ninguna tienda cumple esto/.test(await p.textContent('#tagRejilla')))
  await p.click('[data-tag-limpiar]'); await p.waitForTimeout(700)
  check('  …que lo vuelve a enseñar todo', (await p.inputValue('#tagBusca')) === '' && (await p.locator('#tagRejillaTuyas .tag-tarjeta').count()) === 2)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tiendas', { sesion: 'none' })
  const t = await tarjetas(p, '#tiendasAgenda')
  check('sin cuenta: «Escribir» lleva a registrarse y vuelve; sin «De tu lista»', /^\/auth\.html\?registro=1&volver=%2Fmensajes\.html%3Fwith%3Dt1/.test(t.find((x) => x.nombre === 'RyuCards')?.escribir || '') && !(await p.isVisible('[data-tag-filtro="lista"]')), JSON.stringify(t[0]))
  await ctx.close()
}

console.log('── 4. Sin la migración, sin respuesta y la dirección vieja ──')
{
  // Lo de la 1236: sin cifras, horario, destacadas ni «Recién llegado».
  const vieja = { total: 2, ciudades: { Bilbao: 2 }, tiendas: [{ user_id: 't1', username: 'ryu', display_name: 'RyuCards', ciudad: 'Bilbao', con_local: true, cartas: 3, productos: 0, de_tu_lista: 0 }, { user_id: 't2', username: 'norte', display_name: 'Norte', ciudad: 'Bilbao', con_local: false, cartas: 0, productos: 0, de_tu_lista: 0 }] }
  const { p, ctx, errs } = await abrir('/tiendas', { rpc: { tiendas_agenda: vieja } })
  check('con la 1236: las tarjetas, sin cifras, sin chapa, sin cartas y sin tira', !errs.length && (await p.locator('#tagRejilla .tag-tarjeta').count()) === 2 && !(await p.isVisible('#tagCifras')) && (await p.locator('.tag-estado, .tag-carta').count()) === 0 && !(await p.isVisible('#tagRecien')) && !(await p.isVisible('[data-tag-filtro="abiertas"]')), errs.join(' | '))
  check('  …y «Aún sin cartas a la vista» en la que no tiene', /Aún sin cartas a la vista/.test(await p.textContent('#tagRejilla')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tiendas', { rpc: {} })
  check('sin respuesta: lo dice, con «Probar otra vez»', /No hemos podido traer las tiendas/.test(await p.textContent('#tagRejilla')) && await p.isVisible('[data-tag-otra]'))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tiendas#para-tiendas')
  check('/tiendas#para-tiendas (un enlace viejo) va a /para-tiendas', new URL(p.url()).pathname.replace(/\.html$/, '') === '/para-tiendas' && await p.isVisible('#tiendasForm'), p.url())
  await ctx.close()
}

console.log('── 5. El móvil ──')
{
  const { p, ctx } = await abrir('/tiendas', { movil: true })
  const m = await p.evaluate(() => ({
    ancho: document.documentElement.scrollWidth,
    primera: Math.round(document.querySelector('.tag-tarjeta:not(.skeleton)')?.getBoundingClientRect().top ?? 9999),
    chips: new Set([...document.querySelectorAll('.tag-chips > :not([hidden])')].map((x) => Math.round(x.getBoundingClientRect().top + x.getBoundingClientRect().height / 2))).size,
    titulo: Math.round(document.querySelector('.tag-banda-texto').getBoundingClientRect().width),
    tira: getComputedStyle(document.getElementById('tagTira')).overflowX,
  }))
  check('sin salirse de ancho, la primera tienda antes de 296 px', m.ancho <= 390 && m.primera <= 296, JSON.stringify(m))
  check('  …los chips en una fila, el título para el lector y la tira de lado', m.chips === 1 && m.titulo <= 1 && m.tira === 'auto', JSON.stringify(m))
  if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/1244-movil.png` })
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
