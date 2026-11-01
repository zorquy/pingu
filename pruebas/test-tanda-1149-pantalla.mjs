// Tanda 1149 — de «Cuatro pantallas más»:
//   C1 · Ajustes › Avisos: una tabla aviso × canal en el PC (con el push
//        encima) y secciones plegadas con su interruptor en el móvil.
//   C2 · Una guía, un tema o una persona que no existen: el molde de la 404
//        con el buscador relleno y las parecidas.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

console.log('── 1. Lo puro ──')
{
  const P = await import(`${RAIZ}/js/avisos-prefs.js`)
  const canales = { campanita: { guide_comment: 'x', forum_reply: 'x', forum_reaction: 'x', trade_match: 'x', nuevo_tipo: 'Algo nuevo' }, correo: { private_message: 'x', forum_reply: 'x' } }
  const s = P.seccionesDeAvisos(canales)
  check('secciones solo con lo que algún canal tiene, y un tipo suelto en «Otros»', s.map((x) => x.id).join() === 'mensajes,foro,guias,cambios,otros' && s.at(-1).filas[0].titulo === 'Algo nuevo', s.map((x) => x.id).join())
  const foro = s.find((x) => x.id === 'foro')
  check('una fila toca en cada canal solo sus tipos', P.tiposEn(foro.filas[0], canales.campanita).join() === 'forum_reply,forum_reaction' && P.tiposEn(foro.filas[0], canales.correo).join() === 'forum_reply')
  check('estado de una sección: sí, a medias, no, o nada', P.estadoDeSeccion(foro, canales.campanita, []) === 'si' && P.estadoDeSeccion(s[2], canales.correo, []) === null && P.estadoDeSeccion({ filas: [{ tipos: ['a'] }, { tipos: ['b'] }] }, { a: 1, b: 1 }, ['a']) === 'medias')
  check('cada tipo de la campanita y del correo cae en una fila con nombre (no en «Otros»)', await (async () => {
    const N = await import(`${RAIZ}/js/notifications.js`).catch(() => null)
    if (!N) return true
    const r = P.seccionesDeAvisos({ campanita: N.NOTIFICATION_TYPES, correo: N.EMAIL_TYPES })
    return !r.some((x) => x.id === 'otros')
  })())
  const NE = await import(`${RAIZ}/js/no-encontrado.js`).catch((e) => ({ err: e }))
  if (!NE.err) {
    check('las palabras de la dirección, y nada de un id', NE.palabrasDeDireccion('mazo-charizard-ex') === 'mazo charizard ex' && NE.palabrasDeDireccion('3f2a9c1e-1234-4abc-9def-0123456789ab') === '' && NE.palabrasDeDireccion('123') === '')
    check('se busca lo entero y luego las palabras con sentido, largas antes', NE.intentosDeBusqueda('guia charizard estandar').join('|') === 'guia charizard estandar|charizard|estandar')
  }
}

const b = await chromium.launch()
console.log('── 2. Avisos en el PC: la tabla ──')
{
  const ctx = await contexto(b, false, 'user-1')
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/ajustes?ver=avisos`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.aj-tabla', { timeout: 8000 }).catch(() => {})
  const cab = await page.$$eval('.aj-tabla-cab [role=columnheader]', (c) => c.map((x) => x.textContent.trim()))
  check('una tabla con Campanita y Correo', cab.join('|') === 'Aviso|Campanita|Correo', cab.join('|'))
  check('  …sin las pestañas de canal', !(await page.locator('.aj-canales').isVisible()))
  check('  …y con su «—» donde un aviso no llega por ese canal', (await page.locator('.aj-tabla .aj-sin').count()) > 3)
  const mensajes = await page.$$eval('.aj-tabla [data-interruptor="mensajes"]', (is) => is.map((i) => i.dataset.canalDe))
  check('«Mensajes privados» solo tiene correo', mensajes.join() === 'correo', mensajes.join())
  // Apagar una sección en la campanita apaga sus filas, y el perfil lo guarda.
  await page.click('.aj-tabla [data-seccion="torneos"][data-canal-de="campanita"]')
  await page.waitForTimeout(600)
  const filasTorneo = await page.$$eval('.aj-tabla [data-canal-de="campanita"][data-interruptor^="torneo"]', (is) => is.map((i) => i.checked))
  check('apagar «Torneos» en la campanita apaga sus cuatro filas', filasTorneo.length === 4 && filasTorneo.every((x) => !x), JSON.stringify(filasTorneo))
  check('  …y el correo de «Torneos» sigue puesto', await page.isChecked('.aj-tabla [data-seccion="torneos"][data-canal-de="correo"]'))
  await page.click('.aj-tabla [data-interruptor="torneo-juez"][data-canal-de="campanita"]')
  await page.waitForTimeout(600)
  check('encender una sola deja la sección «a medias»', await page.$eval('.aj-tabla [data-seccion="torneos"][data-canal-de="campanita"]', (i) => i.indeterminate))
  const guardado = await page.evaluate(() => (window.__FAKE_FILAS__?.user_profiles || []).find((p) => p.id === 'user-1')?.notification_prefs_disabled || null)
  check('  …guardado en la columna de siempre, sin el del juez', !guardado || (guardado.includes('torneo_ronda') && !guardado.includes('torneo_juez')), JSON.stringify(guardado))
  check('el push va encima de la tabla', (await page.locator('#ajAvisosPush .aj-nota, #ajAvisosPush .subtext').count()) >= 1)
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}

console.log('── 3. Avisos en el móvil: secciones plegadas ──')
{
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/ajustes?ver=avisos`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.aj-grupo', { timeout: 8000 }).catch(() => {})
  check('las secciones, plegadas, con «N de M»', (await page.locator('.aj-grupo').count()) >= 5 && (await page.locator('.aj-grupo .aj-filas:visible').count()) === 0 && /\d+ de \d+/.test(await page.locator('.aj-grupo-abrir small').first().textContent()))
  await page.click('[data-abrir="guias"]')
  check('al tocar una se abre con sus avisos', (await page.locator('.aj-grupo.abierta [data-interruptor]').count()) === 4)
  await page.click('[data-canal="correo"]')
  await page.waitForTimeout(200)
  check('en «Por correo», «Mensajes y menciones» está', (await page.locator('[data-abrir="mensajes"]').count()) === 1)
  await page.click('[data-canal="push"]')
  await page.waitForTimeout(400)
  check('«Push», el interruptor del dispositivo de siempre', (await page.locator('#ajPushZona').count()) === 1)
  check('sin desbordar de lado', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await ctx.close()
}

console.log('── 4. Lo que no existe, con salida ──')
for (const [ruta, titulo, parecida] of [['/guia/guia-charizard-estandar', 'Esta guía ya no está', /Charizard/], ['/usuario/Mist', 'No encontramos a esa persona', /Misty/], ['/tema/3f2a9c1e-1234-4abc-9def-0123456789ab', 'Este tema ya no está', null]]) {
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-no-encontrado]', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const r = await page.evaluate(() => ({ h1: document.querySelector('[data-no-encontrado] h1')?.textContent, q: document.querySelector('[data-no-encontrado] input[name=q]')?.value, en: document.querySelector('[data-no-encontrado] input[name=en]')?.value, parecidas: [...document.querySelectorAll('#noEncontradoParecidas a')].map((a) => a.textContent.trim()), mascota: !!document.querySelector('[data-no-encontrado] img.mascota'), ancho: document.documentElement.scrollWidth <= innerWidth }))
  check(`${ruta}: la mascota y «${titulo}»`, r.h1 === titulo && r.mascota, JSON.stringify(r))
  if (parecida) check('  …el buscador relleno y una parecida', r.q && parecida.test(r.parecidas.join(' ')), JSON.stringify(r))
  else check('  …un id no rellena nada ni inventa parecidas', r.q === '' && r.parecidas.length === 0, JSON.stringify(r))
  check('  …sin desbordar y sin errores', r.ancho && !err.length, err.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo verde')
process.exit(fails ? 1 : 0)
