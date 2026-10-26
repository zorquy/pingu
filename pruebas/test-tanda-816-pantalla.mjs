// Tanda 816 (FO1 + FO2 + FO3) — el foro en el móvil.
//   FO1. El índice: chips por sección que filtran, y los foros en baldosas
//        de dos en dos con su color y «N temas · hace…» o «Sé el primero».
//        En el ordenador, el de siempre (804).
//   FO2. Un foro: filtros Recientes / Sin respuesta / Siguiendo / Míos;
//        sin los bloques de cifras en el móvil; «Abrir un tema» en el botón
//        rosa (solo en el móvil).
//   FO3. Un tema: la hora junto al nombre, los seguidos juntos, «Reaccionar»
//        en el pie del móvil y la píldora «N nuevos».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const FORO = {
  __FAKE_SECCIONES__: [{ id: 's1', name: 'Comunidad', position: 1 }, { id: 's2', name: 'Juego', position: 2 }],
  __FAKE_FOROS__: [
    { id: 'f-pre', section_id: 's1', slug: 'presentaciones', name: 'Presentaciones', position: 1, post_policy: 'todos' },
    { id: 'f-col', section_id: 's1', slug: 'tu-coleccion', name: 'Tu colección', position: 2, post_policy: 'todos' },
    { id: 'f-reg', section_id: 's2', slug: 'dudas-de-reglas', name: 'Dudas de reglas', position: 1, post_policy: 'todos' },
  ],
  __FAKE_TEMAS__: [
    { id: 't1', board_id: 'f-reg', title: '¿Iono cuenta para Arven?', author_id: 'user-2', last_post_author_id: 'user-1', post_count: 4, last_post_at: hace(4), created_at: hace(60) },
    { id: 't2', board_id: 'f-reg', title: 'Reglas de la Estadio', author_id: 'user-1', last_post_author_id: 'user-1', post_count: 1, last_post_at: hace(90), created_at: hace(90) },
    { id: 't4', board_id: 'f-reg', title: 'Daño a la Banca con Débil', author_id: 'user-3', last_post_author_id: 'user-3', post_count: 1, last_post_at: hace(30), created_at: hace(30) },
    { id: 't3', board_id: 'f-pre', title: 'Hola desde Sevilla', author_id: 'user-3', last_post_author_id: 'user-3', post_count: 1, last_post_at: hace(200), created_at: hace(200) },
  ],
  __FAKE_MENSAJES__: [
    { id: 'm1', thread_id: 't1', author_id: 'user-2', body_html: '<p>Si juego Iono y luego Arven…</p>', created_at: hace(60) },
    { id: 'm2', thread_id: 't1', author_id: 'user-3', body_html: '<p>Solo uno por turno.</p>', created_at: hace(6) },
    { id: 'm3', thread_id: 't1', author_id: 'user-3', body_html: '<p>Y Iono ya lo gasta.</p>', created_at: hace(5) },
    { id: 'm4', thread_id: 't1', author_id: 'user-1', body_html: '<p>Gracias.</p>', created_at: hace(4) },
  ],
}
const browser = await chromium.launch()
const abrir = async (ruta, { movil = false, sesion = 'user-1', extra = {} } = {}) => {
  const ctx = await browser.newContext(movil ? { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript(([s, sem]) => { window.__FAKE_SESSION__ = s || 'none'; Object.assign(window, sem) }, [sesion, { ...FORO, ...extra }])
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, ctx, errores }
}
const visibles = (page, sel) => page.$$eval(sel, (es) => es.filter((e) => e.getBoundingClientRect().height > 0).length)

console.log('── FO1. El índice ──')
{
  const { page, ctx, errores } = await abrir('/foro.html', { movil: true })
  check('[móvil] sin errores', errores.length === 0, errores.join(' | '))
  const chips = await page.$$eval('.foro-chips-secciones [data-seccion]', (bs) => bs.map((b) => [b.textContent.trim(), b.getAttribute('aria-pressed')]))
  check('[móvil] chips: Todo y una por sección, «Todo» puesto', chips.map((c) => c[0]).join('|') === 'Todo|Comunidad|Juego' && chips[0][1] === 'true', JSON.stringify(chips))
  const rejilla = await page.$eval('.foro-seccion[data-seccion="s1"]', (s) => {
    const fs = [...s.querySelectorAll('.foro-fila')].map((f) => f.getBoundingClientRect())
    return { cols: getComputedStyle(s).gridTemplateColumns.split(' ').length, mismaFila: Math.abs(fs[0].top - fs[1].top) < 2, ancho: fs[0].width }
  })
  check('[móvil] los foros en baldosas de dos en dos', rejilla.cols === 2 && rejilla.mismaFila, JSON.stringify(rejilla))
  const resumen = await page.$$eval('.foro-fila', (fs) => fs.map((f) => [f.querySelector('h3 a').textContent.trim(), f.querySelector('.foro-fila-resumen')?.textContent.trim(), getComputedStyle(f.querySelector('.foro-fila-icono')).backgroundColor]))
  const reglas = resumen.find((r) => r[0] === 'Dudas de reglas')
  const col = resumen.find((r) => r[0] === 'Tu colección')
  check('[móvil] «N temas · hace…» y «Sé el primero» en el que no tiene', /^\d+ temas? · /.test(reglas?.[1] || '') && col?.[1] === 'Sé el primero', JSON.stringify(resumen))
  check('[móvil] cada baldosa con su color', new Set(resumen.map((r) => r[2])).size === resumen.length, JSON.stringify(resumen.map((r) => r[2])))
  await page.click('.foro-chips-secciones [data-seccion="s2"]')
  await page.waitForTimeout(150)
  const tras = { comunidad: await visibles(page, '.foro-seccion[data-seccion="s1"]'), juego: await visibles(page, '.foro-seccion[data-seccion="s2"]'), puesto: await page.getAttribute('.foro-chips-secciones [data-seccion="s2"]', 'aria-pressed') }
  check('[móvil] tocar «Juego» deja solo Juego', tras.comunidad === 0 && tras.juego === 1 && tras.puesto === 'true', JSON.stringify(tras))
  await page.click('.foro-chips-secciones [data-seccion=""]')
  await page.waitForTimeout(150)
  check('  …y «Todo» las vuelve a enseñar', (await visibles(page, 'section.foro-seccion[data-seccion]')) === 2)
  const r = await page.evaluate(() => ({ ancho: document.documentElement.scrollWidth, ventana: innerWidth }))
  check('[móvil] la página no se sale de ancho', r.ancho <= r.ventana, JSON.stringify(r))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/foro.html')
  check('[ordenador] sin chips de sección ni resumen: el índice de siempre', (await visibles(page, '.foro-chips-secciones')) === 0 && (await visibles(page, '.foro-fila-resumen')) === 0 && (await visibles(page, '.foro-fila-numeros')) >= 2)
  await ctx.close()
}

console.log('\n── FO2. Un foro ──')
{
  const { page, ctx, errores } = await abrir('/foro/dudas-de-reglas', { movil: true })
  check('[móvil] sin errores', errores.length === 0, errores.join(' | '))
  const vistas = await page.$$eval('.foro-vistas a', (as) => as.map((a) => [a.textContent.trim(), a.getAttribute('aria-current')]))
  check('[móvil] los cuatro filtros, «Recientes» puesto', vistas.map((v) => v[0]).join('|') === 'Recientes|Sin respuesta|Siguiendo|Míos' && vistas[0][1] === 'true', JSON.stringify(vistas))
  check('[móvil] sin «Por aquí hoy» ni «El foro en números»', (await visibles(page, '#foroLateral')) === 0)
  // Desde la 1021 (D4 de «PokeDoc como app») el botón rosa flotante ya no existe: «Abrir un tema» es el de la cabecera en todas las pantallas.
  check('[móvil] «Abrir un tema» en la cabecera, sin botón rosa (1021)', (await visibles(page, '#btnNuevoTema')) === 1 && (await visibles(page, '.foro-fab-foro')) === 0)
  await page.click('#btnNuevoTema')
  await page.waitForTimeout(800)
  check('  …que abre el formulario', (await visibles(page, '#temaForm')) === 1)
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/foro/dudas-de-reglas?v=sin', { movil: true })
  const titulos = await page.$$eval('.foro-tema-fila h3', (hs) => hs.map((h) => h.textContent.trim()))
  check('«Sin respuesta»: solo los de un mensaje', titulos.length === 2 && !titulos.includes('¿Iono cuenta para Arven?'), titulos.join(' | '))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/foro/dudas-de-reglas?v=mios', { movil: true })
  const titulos = await page.$$eval('.foro-tema-fila h3', (hs) => hs.map((h) => h.textContent.trim()))
  check('«Míos»: los que abriste tú', titulos.join() === 'Reglas de la Estadio', titulos.join(' | '))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/foro/dudas-de-reglas?v=sigo', { movil: true, extra: { __FAKE_SUSCRIPCIONES__: [{ user_id: 'user-1', thread_id: 't4' }] } })
  const titulos = await page.$$eval('.foro-tema-fila h3', (hs) => hs.map((h) => h.textContent.trim()))
  const vacio = await page.$eval('#foroTemas', (s) => s.textContent.replace(/\s+/g, ' ').trim())
  check('«Siguiendo»: los que sigues, o lo dice si no sigues ninguno', titulos.join() === 'Daño a la Banca con Débil' || /No sigues ningún tema/.test(vacio), titulos.join(' | ') + ' / ' + vacio.slice(0, 80))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/foro/dudas-de-reglas?v=mios', { movil: true, sesion: null })
  const vistas = await page.$$eval('.foro-vistas a', (as) => as.map((a) => a.textContent.trim()))
  const titulos = await page.$$eval('.foro-tema-fila h3', (hs) => hs.length)
  check('sin cuenta: ni «Siguiendo» ni «Míos», y ?v=mios es «Recientes»', vistas.join('|') === 'Recientes|Sin respuesta' && titulos === 3, `${vistas.join('|')} / ${titulos}`)
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/foro/dudas-de-reglas')
  check('[ordenador] «Abrir un tema» en la cabecera y SIN botón rosa', (await visibles(page, '#btnNuevoTema')) === 1 && (await visibles(page, '.foro-fab-foro')) === 0)
  check('[ordenador] los bloques de cifras siguen al lado', (await visibles(page, '#foroLateral')) === 1)
  await ctx.close()
}

console.log('\n── FO3. Un tema ──')
for (const movil of [true, false]) {
  const nombre = movil ? 'móvil' : 'ordenador'
  const { page, ctx, errores } = await abrir('/tema/t1', { movil })
  check(`[${nombre}] sin errores`, errores.length === 0, errores.join(' | '))
  const m = await page.$$eval('.foro-mensaje', (ms) => ms.map((x) => ({ id: x.dataset.mensaje, seguido: x.classList.contains('foro-mensaje-seguido'), hora: !!x.querySelector('.foro-mensaje-autor .foro-autor-hora'), autorVisible: x.querySelector('.foro-mensaje-autor').getBoundingClientRect().height > 0 })))
  check(`[${nombre}] la hora va en la línea del nombre`, m.every((x) => x.hora) && m.filter((x) => !x.seguido).every((x) => x.autorVisible), JSON.stringify(m))
  check(`[${nombre}] el segundo seguido de jesus va junto, sin repetir el nombre`, m.find((x) => x.id === 'm3')?.seguido && !m.find((x) => x.id === 'm3').autorVisible && !m.find((x) => x.id === 'm2').seguido && !m.find((x) => x.id === 'm4').seguido, JSON.stringify(m))
  if (movil) {
    // Tras el repintado del arranque (el tema se pinta dos veces al abrir).
    await page.waitForTimeout(800)
    const cab = await visibles(page, '.foro-mensaje-cabecera')
    const reac = await visibles(page, '.foro-reaccionar')
    check('[móvil] la cabecera de la burbuja no ocupa sitio y «Reaccionar» está en el pie', cab === 0 && reac === m.length, `${cab} / ${reac} de ${m.length}`)
    await page.click('[data-mensaje="m2"] .foro-reaccionar')
    await page.waitForTimeout(150)
    check('  …y saca las reacciones', (await visibles(page, '[data-mensaje="m2"] .foro-mensaje-izq')) === 1)
  } else {
    check('[ordenador] «Reaccionar» no sale (las reacciones ya están a la vista)', (await visibles(page, '.foro-reaccionar')) === 0)
  }
  await ctx.close()
}
{
  // La píldora: lo que llega mientras lees más arriba.
  const { page, ctx } = await abrir('/tema/t1', { movil: true, extra: { __FAKE_MENSAJES__: [...FORO.__FAKE_MENSAJES__, ...Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, thread_id: 't1', author_id: i % 2 ? 'user-2' : 'user-3', body_html: `<p>${'Relleno '.repeat(40)}</p>`, created_at: hace(3 - i * 0.1) }))] } })
  await page.evaluate(() => scrollTo(0, 0))
  const pintado = await page.evaluate(() => {
    // Un mensaje nuevo en la base y el aviso del tiempo real (el doble).
    window.__TABLAS__.forum_posts.push({ id: 'nuevo-1', thread_id: 't1', author_id: 'user-2', body_html: '<p>¡Otra cosa!</p>', created_at: new Date().toISOString() })
    window.__VIVO__.emitir()
    return window.__VIVO__.suscripciones.length > 0
  })
  check('el tema escucha el tiempo real', pintado)
  {
    await page.waitForTimeout(1000)
    const p = await page.evaluate(() => { const b = document.getElementById('temaNuevos'); return b && { texto: b.textContent.trim(), visible: b.getBoundingClientRect().height > 0 } })
    check('llega uno nuevo mientras lees arriba: «1 nuevo»', p?.visible && /^1 nuevo/.test(p.texto), JSON.stringify(p))
    await page.click('#temaNuevos')
    // La web baja con desplazamiento suave: se espera a que llegue.
    await page.waitForTimeout(1500)
    const tras = await page.evaluate(() => { const r = document.getElementById('mensaje-nuevo-1').getBoundingClientRect(); return { dentro: r.top >= 0 && r.bottom <= innerHeight, pildora: !!document.getElementById('temaNuevos') } })
    check('  …y tocarla te lleva a él y se va', tras.dentro && !tras.pildora, JSON.stringify(tras))
  }
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
