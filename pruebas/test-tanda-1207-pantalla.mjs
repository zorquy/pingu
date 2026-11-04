// Tanda 1207 — la portada «A con banda» (PINGU eligió la recomendada de la
// propuesta, con las cuatro animaciones): la banda de bienvenida con las tres
// que más suben, la noticia y el foro en una fila de 392 px y las guías y la
// comunidad en otra de 348, el foro y la comunidad SIEMPRE con cuatro filas
// que se reparten la caja (sin el hueco de abajo), «Más noticias» a lo ancho
// en el PC, el color de cada sección en la cabecera de cada bloque, y las
// cajas en cascada, el brillo, el latido y las cartas que flotan, que se
// apagan con «menos movimiento».
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const sembrar = () => {
  const hace = (m) => new Date(Date.now() - m * 60000).toISOString()
  const s = (tipo, m, n, datos) => ({ tipo, fecha: hace(m), username: n.toLowerCase(), display_name: n, datos })
  window.__FAKE_COMUNIDAD_SUCESOS__ = [
    s('perfecto', 6, 'Asierasti', { dia: '2026-11-02' }), s('alta', 7, 'El Visionario', {}), s('cambio', 14, 'Sylphid', { cartas: 7 }),
    s('mazo', 56, 'Dra Valdis', { id: 'm1', nombre: 'Dragapult ex' }), s('coleccion', 90, 'Laia', { set: 'base1', market: 'WEST', nombre: 'Base Set' }),
    s('campeon', 120, 'Ibai', { slug: 'otono', nombre: 'Liga de otoño' }),
  ]
  window.__FAKE_PERFILES__ = ['Nico', 'Íbero', 'El Visionario'].map((n, i) => ({ id: `nuevo-${i}`, username: n, display_name: n, created_at: hace(30 + i * 60) }))
  window.__FAKE_NOTICIAS__ = [...(window.__FAKE_NOTICIAS__ || []), ...[5, 6, 7].map((i) => ({ id: `n-extra-${i}`, slug: `extra-${i}`, title: `Noticia de relleno ${i}`, kind: 'news', review_status: 'published', published_at: hace(i * 3000), created_at: hace(i * 3000) }))]
  // Las tres que más suben, ya guardadas (escaparate.js las guarda seis horas).
  try {
    localStorage.setItem('pd-suben-1207', JSON.stringify({ at: Date.now(), tres: [1, 2, 3].map((i) => ({ id: `sv3pt5-${i}`, sube: 0.3 - i * 0.05, carta: { id: `sv3pt5-${i}`, name: `Carta ${i}`, image_path: `sv/sv3pt5/${i}`, market: 'WEST', set_id: 'sv3pt5', local_id: String(i) } })) }))
  } catch {}
}
const caja = (page, id) => page.evaluate((id) => { const s = document.getElementById(id); if (!s || getComputedStyle(s).display === 'none' || s.classList.contains('hidden') || s.classList.contains('seccion-recogida')) return null; const r = s.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), abajo: Math.round(r.bottom + scrollY) } }, id)
// Las filas de una caja: cuántas, si miden lo mismo y cuánto sobra debajo de la última.
const filas = (page, sel, raiz) => page.evaluate(([sel, raiz]) => {
  const c = document.querySelector(raiz)
  const lis = [...c.querySelectorAll(sel)].filter((l) => l.getClientRects().length)
  const hs = lis.map((l) => Math.round(l.getBoundingClientRect().height))
  const abajo = c.getBoundingClientRect().bottom - parseFloat(getComputedStyle(c).paddingBottom)
  return { n: lis.length, hs, iguales: Math.max(...hs) - Math.min(...hs) <= 2, sobra: Math.round(abajo - Math.max(...lis.map((l) => l.getBoundingClientRect().bottom))) }
}, [sel, raiz])
async function abrir(b, movil, { quien = 'user-1', quieto = false, extra = sembrar } = {}) {
  const ctx = await contexto(b, movil, quien, extra)
  const page = await ctx.newPage()
  if (quieto) await page.emulateMedia({ reducedMotion: 'reduce' })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#aprende .pb-portada', { timeout: 10000 }).catch(() => {})
  await page.waitForSelector('#homeActivityFeed .suc', { timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(1500)
  return { ctx, page, errores }
}

const b = await chromium.launch()
console.log('── 0. Siempre cuatro sucesos (puro, en el navegador) ──')
{
  const ctx = await contexto(b, false, 'none')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  const r = await page.evaluate(async () => {
    const { cuatroSucesos } = await import('/js/portada-bloques.js')
    const s = (tipo, i) => ({ tipo, i })
    const pocos = [s('perfecto', 1), s('alta', 2), s('cambio', 3), s('alta', 4), s('alta', 5)]
    return { con: cuatroSucesos(pocos, 3).map((x) => x.tipo), sin: cuatroSucesos(pocos, 0).map((x) => x.i), uno: cuatroSucesos([s('perfecto', 1)], 0).length }
  })
  check('con gente nueva, los «se unió» solo rellenan hasta cuatro', r.con.join() === 'perfecto,cambio,alta,alta', JSON.stringify(r))
  check('sin gente nueva, los cuatro más nuevos', r.sin.join() === '1,2,3,4', JSON.stringify(r))
  check('con menos de cuatro, los que haya', r.uno === 1)
  await ctx.close()
}
console.log('── 1. El PC, con cuenta ──')
{
  const { ctx, page, errores } = await abrir(b, false)
  const banda = await page.evaluate(() => {
    const bd = document.getElementById('banda')
    const cs = getComputedStyle(bd)
    return { fondo: cs.backgroundImage !== 'none', saludo: Boolean(bd.querySelector('#bienvenida .bienvenida-texto')), hoy: Boolean(bd.querySelector('#hoyPortada')), mascota: Boolean(bd.querySelector('.banda-mascota')), cartas: [...bd.querySelectorAll('.banda-carta')].map((a) => ({ href: a.getAttribute('href'), sube: a.querySelector('.banda-sube')?.textContent, flota: getComputedStyle(a).animationName })) }
  })
  check('la banda: fondo propio, el saludo y lo de hoy dentro, y la mascota', banda.fondo && banda.saludo && banda.hoy && banda.mascota, JSON.stringify(banda))
  check('  …con las tres que más suben, cada una a su ficha y con cuánto sube', banda.cartas.length === 3 && banda.cartas.every((c) => /^\/carta\//.test(c.href) && /^\+\d+ %$/.test(c.sube)), JSON.stringify(banda.cartas))
  check('  …y flotan', banda.cartas.every((c) => c.flota === 'banda-flota'), JSON.stringify(banda.cartas))
  const [bs, n, f, g, c, m] = await Promise.all(['banda', 'noticiaPortadaSeccion', 'foroVivoSeccion', 'recientesSeccion', 'homeActivity', 'masNoticiasSeccion'].map((id) => caja(page, id)))
  check('la banda va a lo ancho de la portada, como la rejilla', bs && n && Math.abs(bs.w - m.w) <= 2, JSON.stringify([bs, m]))
  check('fila 1: la noticia (8 de 12) y el foro (4), de 392 px', n.y === f.y && n.h === 392 && f.h === 392 && Math.abs(n.w - 2 * f.w) < 60, JSON.stringify([n, f]))
  check('fila 2: las guías y la comunidad, debajo y del mismo alto (348)', g.y === c.y && g.y > n.abajo && g.h === 348 && c.h === 348 && g.x === n.x && c.x === f.x, JSON.stringify([g, c]))
  check('fila 3: «Más noticias» a lo ancho, debajo', m && m.y > g.abajo && Math.abs(m.x - n.x) <= 1, JSON.stringify(m))
  const foro = await filas(page, '.pb-foro-cuatro > li', '#foroVivo')
  check('el foro: cuatro temas en filas iguales que llenan la caja (sin hueco abajo)', foro.n === 4 && foro.iguales && foro.sobra <= 4, JSON.stringify(foro))
  const tema = await page.evaluate(() => { const a = document.querySelector('.pb-foro-cuatro .pb-hilo'); return { cara: Boolean(a.querySelector('.pb-cara')), titulo: a.querySelector('b')?.textContent.length > 0, foro: Boolean(a.querySelector('small .pb-chip')), burbuja: /\d/.test(a.querySelector('.pb-foro-n')?.textContent || '') } })
  check('  …cada uno con su cara, título, foro y la burbuja de mensajes', Object.values(tema).every(Boolean), JSON.stringify(tema))
  const com = await filas(page, '#homeActivityFeed .suc-lista > li', '#homeActivityFeed')
  check('la comunidad: cuatro sucesos en filas iguales que llenan la caja', com.n === 4 && com.iguales && com.sobra <= 4, JSON.stringify(com))
  check('  …cada uno con su dibujo a la derecha (y el 6/6 del día perfecto)', (await page.locator('#homeActivityFeed .suc-dib').count()) === 4 && /6\/6/.test(await page.locator('#homeActivityFeed .suc-dib').first().innerText()))
  check('  …y la gente nueva arriba, sin repetir los «se unió»', /\+3/.test(await page.locator('.pb-gente-nueva').innerText()) && !/se unió/.test(await page.locator('#homeActivityFeed .suc-lista').innerText()))
  const masnot = await page.$$eval('#masNoticias .pb-masnot-item', (xs) => xs.map((x) => ({ href: x.getAttribute('href'), titulo: x.querySelector('b')?.textContent })))
  const grande = await page.locator('.pb-noticia').getAttribute('href')
  check('«Más noticias»: las cuatro siguientes, sin repetir la grande', masnot.length === 4 && masnot.every((x) => x.href && x.titulo) && !masnot.some((x) => x.href === grande), JSON.stringify(masnot))
  const colores = await page.evaluate(() => Object.fromEntries(['foroVivo', 'aprende', 'homeActivityFeed', 'masNoticias'].map((id) => { const i = document.querySelector(`#${id} .pb-cab-ic`); return [id, i ? getComputedStyle(i).color : null] })))
  check('cada bloque, con el icono en el color de su sección', Object.values(colores).every(Boolean) && colores.foroVivo === colores.homeActivityFeed && colores.foroVivo !== colores.aprende && colores.aprende !== colores.masNoticias, JSON.stringify(colores))
  const anim = await page.evaluate(() => ({ seccion: getComputedStyle(document.getElementById('foroVivoSeccion')).animationName, retraso: getComputedStyle(document.getElementById('recientesSeccion')).animationDelay, brillo: getComputedStyle(document.querySelector('.pb-portada'), '::before').transitionProperty }))
  check('las cajas entran en cascada, y lo de abajo después', anim.seccion === 'portada-entra' && anim.retraso === '0.24s', JSON.stringify(anim))
  check('  …y las portadas llevan el brillo al pasar', /transform/.test(anim.brillo), JSON.stringify(anim))
  check('sin desbordar a lo ancho', (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.screenshot({ path: '/tmp/1207-pc.png', fullPage: true })
  await ctx.close()
}

console.log('── 2. Pocos sucesos: siguen siendo cuatro ──')
{
  const { ctx, page } = await abrir(b, false, {
    extra: () => {
      const hace = (m) => new Date(Date.now() - m * 60000).toISOString()
      const s = (tipo, m, n, datos) => ({ tipo, fecha: hace(m), username: n.toLowerCase(), display_name: n, datos })
      window.__FAKE_COMUNIDAD_SUCESOS__ = [s('perfecto', 6, 'Asierasti', { dia: '2026-11-02' }), s('alta', 7, 'Nico', {}), s('alta', 8, 'Íbero', {}), s('alta', 9, 'Gary', {})]
      window.__FAKE_PERFILES__ = ['Nico', 'Íbero', 'Gary'].map((n, i) => ({ id: `nuevo-${i}`, username: n, display_name: n, created_at: hace(30 + i * 60) }))
    },
  })
  const com = await filas(page, '#homeActivityFeed .suc-lista > li', '#homeActivityFeed')
  check('un suceso y tres altas: cuatro filas (las altas rellenan)', com.n === 4 && com.iguales, JSON.stringify(com))
  await ctx.close()
}

console.log('── 3. «Menos movimiento»: nada se mueve ──')
{
  const { ctx, page } = await abrir(b, false, { quieto: true })
  const a = await page.evaluate(() => ({
    seccion: getComputedStyle(document.getElementById('foroVivoSeccion')).animationName,
    carta: getComputedStyle(document.querySelector('.banda-carta') || document.body).animationName,
    vivo: document.querySelector('.pb-vivo i') ? getComputedStyle(document.querySelector('.pb-vivo i')).animationName : 'none',
    brillo: getComputedStyle(document.querySelector('.pb-portada'), '::before').transitionDuration,
  }))
  check('sin cascada, sin cartas que flotan, sin latido y sin brillo', a.seccion === 'none' && a.carta === 'none' && a.vivo === 'none' && /^0s$/.test(a.brillo), JSON.stringify(a))
  await ctx.close()
}

console.log('── 4. El móvil ──')
{
  const { ctx, page, errores } = await abrir(b, true)
  const m = await page.evaluate(() => {
    const bd = document.getElementById('banda')
    const ab = bd.querySelector('.banda-abanico').getBoundingClientRect()
    const r = bd.getBoundingClientRect()
    return { cartas: bd.querySelectorAll('.banda-carta').length, dentro: ab.right <= r.right && ab.left >= r.left, mascota: getComputedStyle(bd.querySelector('.banda-mascota')).display, masNoticias: getComputedStyle(document.getElementById('masNoticiasSeccion')).display }
  })
  check('la banda en pequeño: las tres cartas dentro, sin mascota', m.cartas === 3 && m.dentro && m.mascota === 'none', JSON.stringify(m))
  check('«Más noticias» de abajo no sale (las noticias son la tira, 1190)', m.masNoticias === 'none', JSON.stringify(m))
  check('el foro, con sus cuatro', (await page.locator('.pb-foro-cuatro > li').count()) === 4)
  check('la comunidad, con sus cuatro', (await page.locator('#homeActivityFeed .suc-lista > li').count()) === 4)
  check('sin desbordar a lo ancho', (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.screenshot({ path: '/tmp/1207-movil.png', fullPage: true })
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
