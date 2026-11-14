// Tanda 1359 — «Igualar la web, sin quitar nada» (PINGU: «adelante con todo»).
// Seis cosas en las que cada página iba por su lado:
//   A · en el PC, el mismo aire bajo la barra de arriba en todas;
//   B · lo puesto (chip, pestaña, rango), del color de su sección;
//   C · una fila de chips que no cabe se desvanece por donde sigue;
//   D · en el móvil, los filtros de Avisos, Gente, Novedades y Tiendas se
//       quedan arriba al bajar;
//   E · en el móvil, la primera línea entera: el Foro con su nombre, Avisos y
//       Meta con su tira de cifras;
//   F · en el PC, Eventos y Partidas con la banda de su sección.
// Y lo que no cambia: lo que se puede tocar en cada página es lo mismo.
import { readFileSync } from 'node:fs'
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 0. Lo puro ──')
{
  const { ladoQueSigue } = await import(`${RAIZ}/js/filas-deslizan.js`)
  check('una fila que cabe no lleva nada', ladoQueSigue({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 }) === '')
  check('al principio sigue por la derecha', ladoQueSigue({ scrollLeft: 0, scrollWidth: 500, clientWidth: 300 }) === 'derecha')
  check('en medio sigue por los dos lados', ladoQueSigue({ scrollLeft: 100, scrollWidth: 500, clientWidth: 300 }) === 'ambos')
  check('al final sigue por la izquierda', ladoQueSigue({ scrollLeft: 200, scrollWidth: 500, clientWidth: 300 }) === 'izquierda')
  check('Eventos y Partidas cargan la hoja de la banda', ['eventos.html', 'mis-partidas.html'].every((f) => /href="\/css\/seccion\.css"/.test(leer(f))))
}

const b = await chromium.launch()
const errores = []
async function abrir(ruta, movil) {
  const ctx = await contexto(b, movil, 'user-1')
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errores.push(`${ruta}: ${String(e).slice(0, 160)}`))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, ctx }
}
const LISTAS = ['/aprender', '/retos', '/guardados', '/glosario', '/noticias', '/lanzamientos', '/novedades', '/mi-coleccion', '/foro', '/usuarios', '/eventos', '/tiendas', '/avisos', '/ajustes', '/mensajes', '/torneos.html', '/meta', '/mis-partidas']

console.log('── A. El mismo aire bajo la barra en el PC ──')
{
  const huecos = {}
  for (const r of LISTAS) {
    const { page, ctx } = await abrir(r, false)
    huecos[r] = await page.evaluate(() => {
      const nav = document.getElementById('navbar').getBoundingClientRect().bottom
      const pr = [...document.querySelector('main').querySelectorAll('*')].find((e) => { const x = e.getBoundingClientRect(); return x.height > 8 && x.width > 40 })
      return Math.round(pr.getBoundingClientRect().top - nav)
    })
    await ctx.close()
  }
  const mal = Object.entries(huecos).filter(([, h]) => h !== 24)
  check('las 18 páginas de lista arrancan a 24 px de la barra (antes 14 pegadas, a 0)', !mal.length, JSON.stringify(mal))
}

console.log('── B. Lo puesto, del color de su sección ──')
{
  const casos = [['/usuarios', '.com-chip.active', 'comunidad'], ['/meta', '.seg-btn.activa, .seg-btn[aria-pressed="true"]', 'jugar'], ['/mi-coleccion', '.mc-valor-rango.activo', 'cartas'], ['/tiendas', '.tag-chip[aria-pressed="true"]', 'comunidad'], ['/aprender', '.ap-orden .seg-btn[aria-pressed="true"]', 'aprender', 'solo PC']]
  for (const movil of [true, false]) {
    for (const [r, sel, sec, soloPc] of casos) {
      if (soloPc && movil) continue
      const { page, ctx } = await abrir(r, movil)
      const v = await page.evaluate(([sel]) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const acento = getComputedStyle(document.documentElement).getPropertyValue('--acento').trim()
        const probe = document.createElement('i'); probe.style.color = acento; document.body.append(probe)
        const rgb = getComputedStyle(probe).color; probe.remove()
        const seccion = document.documentElement.dataset.seccion
        const s = getComputedStyle(el)
        // Con la píldora que se desliza (784) el fondo lo pinta ella.
        const fondo = s.backgroundColor === 'rgba(0, 0, 0, 0)' ? getComputedStyle(el.parentElement.querySelector('.pildora') || el).backgroundColor : s.backgroundColor
        return { fondo, rgb, seccion }
      }, [sel])
      check(`${movil ? 'móvil' : 'PC'} ${r}: lo puesto va en el color de ${sec}`, v && v.seccion === sec && v.fondo === v.rgb, JSON.stringify(v))
      await ctx.close()
    }
  }
}

console.log('── C. Las filas que no caben se desvanecen ──')
{
  const { page, ctx } = await abrir('/avisos', true)
  const antes = await page.evaluate(() => { const f = document.querySelector('.av-chips'); return { lado: f.dataset.desliza, mask: getComputedStyle(f).maskImage || getComputedStyle(f).webkitMaskImage } })
  check('Avisos (móvil): la fila sigue por la derecha y se desvanece', antes.lado === 'derecha' && /gradient/.test(antes.mask), JSON.stringify(antes))
  await page.evaluate(() => { const f = document.querySelector('.av-chips'); f.scrollLeft = f.scrollWidth })
  await page.waitForTimeout(300)
  const fin = await page.evaluate(() => document.querySelector('.av-chips').dataset.desliza)
  check('al llegar al final se desvanece por la izquierda', fin === 'izquierda', fin)
  await ctx.close()
  const pc = await abrir('/avisos', false)
  const nada = await pc.page.evaluate(() => document.querySelector('.av-chips').dataset.desliza || '')
  check('en el PC, donde cabe, no lleva nada', nada === '', nada)
  await pc.ctx.close()
  const g = await abrir('/usuarios', true)
  const corta = await g.page.evaluate(() => [...document.querySelectorAll('.com-chips .com-chip')].filter((c) => c.getBoundingClientRect().right > innerWidth + 1 && c.getBoundingClientRect().left < innerWidth).map((c) => c.textContent.trim()))
  const alto = await g.page.evaluate(() => Math.round(document.querySelector('.com-chip').getBoundingClientRect().height))
  check('Gente (móvil): los chips miden lo que los demás (36 px)', alto === 36, alto)
  check('y ninguno sale cortado sin desvanecerse', !corta.length || await g.page.evaluate(() => !!document.querySelector('.com-chips').dataset.desliza), corta.join(', '))
  await g.ctx.close()
}

console.log('── D. Los filtros se quedan arriba al bajar (móvil) ──')
{
  for (const [r, sel] of [['/usuarios', '.com-chips'], ['/novedades', '.nv-filtros'], ['/avisos', '.av-chips'], ['/tiendas', '.tag-mandos']]) {
    const { page, ctx } = await abrir(r, true)
    const s = await page.evaluate((sel) => { const e = document.querySelector(sel); const c = getComputedStyle(e); return { pos: c.position, top: c.top, fondo: c.backgroundColor } }, sel)
    check(`${r}: ${sel} pegado arriba con el fondo de la página`, s.pos === 'sticky' && s.top === '70px' && s.fondo !== 'rgba(0, 0, 0, 0)', JSON.stringify(s))
    if (r === '/usuarios') {
      await page.evaluate(() => scrollTo(0, 700)); await page.waitForTimeout(700)
      const y = await page.evaluate((sel) => Math.round(document.querySelector(sel).getBoundingClientRect().top), sel)
      check('al bajar por Gente, los chips siguen arriba del todo (la barra se aparta)', y <= 70 && y >= 0, y)
    }
    await ctx.close()
  }
}

console.log('── E. La primera línea entera en el móvil ──')
{
  const f = await abrir('/foro', true)
  const foro = await f.page.evaluate(() => {
    const h = document.getElementById('foroTitulo').getBoundingClientRect()
    const e = document.getElementById('foroEscribir').getBoundingClientRect()
    return { ancho: Math.round(h.width), fila: Math.abs((h.top + h.bottom) / 2 - (e.top + e.bottom) / 2) < 12 }
  })
  check('Foro: «El foro» se ve y va en la misma fila que «Escribir»', foro.ancho > 40 && foro.fila, JSON.stringify(foro))
  await f.ctx.close()
  for (const [r, sel, boton] of [['/avisos', '.av-cab', '#avLeerTodo'], ['/meta', '.meta-cabecera', '#metaPeriodoMenu']]) {
    const { page, ctx } = await abrir(r, true)
    const v = await page.evaluate(([sel, boton]) => {
      const cab = document.querySelector(sel)
      const cif = cab.querySelector('.banda-s-cifras').getBoundingClientRect()
      const bt = document.querySelector(boton).getBoundingClientRect()
      return { fondo: getComputedStyle(cab).backgroundImage !== 'none', cifras: cif.width > 40, fila: Math.abs((cif.top + cif.bottom) / 2 - (bt.top + bt.bottom) / 2) < 16 && bt.left > cif.right - 2, alto: Math.round(cab.getBoundingClientRect().height) }
    }, [sel, boton])
    check(`${r}: la tira con sus cifras a la izquierda y su botón a la derecha`, v.fondo && v.cifras && v.fila && v.alto < 90, JSON.stringify(v))
    await ctx.close()
  }
}

console.log('── F. Eventos y Partidas con su banda en el PC (y el móvil, como estaba) ──')
{
  for (const [r, ceja] of [['/eventos', 'Comunidad · Eventos'], ['/mis-partidas', 'Jugar · Partidas']]) {
    const pc = await abrir(r, false)
    const v = await pc.page.evaluate(() => { const c = document.querySelector('main .banda-s'); return c && { ceja: c.querySelector('.banda-s-ceja')?.textContent.trim(), fondo: getComputedStyle(c).backgroundImage !== 'none', h1: c.querySelector('h1').getBoundingClientRect().width > 40, boton: !!c.querySelector('#btnApuntarPartida') } })
    check(`PC ${r}: banda con «${ceja}», su degradado y su título`, v && v.ceja === ceja && v.fondo && v.h1, JSON.stringify(v))
    if (r === '/mis-partidas') check('«Apuntar una partida» sigue en la cabecera', v?.boton)
    await pc.ctx.close()
    const m = await abrir(r, true)
    const w = await m.page.evaluate(() => { const c = document.querySelector('main .banda-s'); const s = getComputedStyle(c); return { fondo: s.backgroundImage, borde: s.borderTopWidth, ceja: c.querySelector('.banda-s-ceja').getBoundingClientRect().width, h1: c.querySelector('h1').getBoundingClientRect().width } })
    check(`móvil ${r}: sin banda, como antes`, w.fondo === 'none' && w.borde === '0px' && w.ceja === 0, JSON.stringify(w))
    if (r === '/eventos') check('móvil /eventos: su título «Eventos» se sigue viendo', w.h1 > 40, w.h1)
    await m.ctx.close()
  }
}

await b.close()
check('sin errores de página', !errores.length, errores.join(' | '))
console.log(fails ? `\n${fails} FALLA(N)` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
