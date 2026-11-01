// Tanda 1153 — de «Cinco pantallas que se leen de un vistazo» (ronda 6):
//   D3 · Colabora: cada puesto con su botón («Me apunto» marca su casilla y
//        baja; «Crear uno» va al formulario de torneo) y los temas del foro
//        que esperan respuesta.
//   D4 · Guardados vacío: tres guías para empezar, con su marcador que guarda.
//   D5 · El meta nunca en blanco: sin torneos en el periodo, pasa solo al
//        primero más largo que tenga, y lo dice; si lo eliges tú, te quedas.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const b = await chromium.launch()
const abrir = async (movil, quien, ruta, extra = null) => {
  const ctx = await contexto(b, movil, quien, extra)
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2300)
  return { ctx, page, err }
}

console.log('── D3 · Colabora ──')
{
  const { ctx, page, err } = await abrir(true, 'user-1', '/colabora')
  const botones = await page.$$eval('.colabora-puesto', (xs) => xs.map((li) => li.querySelector('.colabora-accion')?.textContent.trim() || ''))
  check('cada puesto lleva su botón', botones.length === 6 && botones.every(Boolean), JSON.stringify(botones))
  check('«Crear uno» va al formulario de torneo', (await page.getAttribute('#colaboraCrearTorneo', 'href')) === '/torneos.html?crear=1')
  await page.click('[data-apuntar="guias"]')
  await page.waitForTimeout(600)
  const m = await page.evaluate(() => ({
    marcada: document.querySelector('#colaboraRoles input[value="guias"]')?.checked,
    otras: [...document.querySelectorAll('#colaboraRoles input:checked')].map((i) => i.value),
    formArriba: Math.round(document.getElementById('colaboraForm').getBoundingClientRect().top),
    vh: innerHeight,
  }))
  check('«Me apunto» marca su casilla y baja al formulario', m.marcada && m.otras.join() === 'guias' && m.formArriba < m.vh / 2, JSON.stringify(m))
  const alto = await page.$$eval('.colabora-puesto', (xs) => xs.filter((x) => !x.querySelector('#colaboraSinRespuesta:not([hidden])')).map((x) => Math.round(x.getBoundingClientRect().height)))
  check('en el móvil, cada puesto es una fila baja con el botón al lado', alto.every((h) => h < 130), JSON.stringify(alto))
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
{
  // Los temas sin respuesta del último mes, del foro de verdad (el doble).
  const { ctx, page, err } = await abrir(false, 'user-1', '/colabora')
  const caja = await page.evaluate(() => {
    const c = document.getElementById('colaboraSinRespuesta')
    return { hidden: c.hidden, enlaces: [...c.querySelectorAll('a')].map((a) => a.getAttribute('href')) }
  })
  // Sea cual sea la semilla, o no hay ninguno y no se pinta, o se pintan
  // como mucho tres, enlazando a su tema.
  check('los temas sin respuesta: nada, o hasta tres enlaces a su tema', (caja.hidden && !caja.enlaces.length) || (caja.enlaces.length >= 1 && caja.enlaces.length <= 3 && caja.enlaces.every((h) => /^\/tema\//.test(h))), JSON.stringify(caja))
  check('  …y sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
{
  // Con temas: los del último mes sin respuestas, como mucho tres, los más nuevos primero.
  const { ctx, page } = await abrir(false, 'user-1', '/colabora', () => {
    const hace = (d) => new Date(Date.now() - d * 864e5).toISOString()
    window.__FAKE_TEMAS__ = [
      { id: 'sola-1', board_id: 'foro-1', title: 'Sin respuesta 1', author_id: 'user-2', post_count: 1, created_at: hace(1), last_post_at: hace(1) },
      { id: 'con-resp', board_id: 'foro-1', title: 'Con respuesta', author_id: 'user-2', post_count: 3, created_at: hace(0.5), last_post_at: hace(0.5) },
      { id: 'sola-2', board_id: 'foro-1', title: 'Sin respuesta 2', author_id: 'user-2', post_count: 1, created_at: hace(3), last_post_at: hace(3) },
      { id: 'vieja', board_id: 'foro-1', title: 'Vieja sin respuesta', author_id: 'user-2', post_count: 1, created_at: hace(60), last_post_at: hace(60) },
      { id: 'sola-3', board_id: 'foro-1', title: 'Sin respuesta 3', author_id: 'user-2', post_count: 1, created_at: hace(5), last_post_at: hace(5) },
      { id: 'sola-4', board_id: 'foro-1', title: 'Sin respuesta 4', author_id: 'user-2', post_count: 1, created_at: hace(7), last_post_at: hace(7) },
    ]
  })
  const enlaces = await page.$$eval('#colaboraSinRespuesta a', (as) => as.map((a) => a.getAttribute('href')))
  check('con temas: los tres más nuevos sin respuesta del último mes', enlaces.join() === '/tema/sola-1,/tema/sola-2,/tema/sola-3' && await page.isVisible('#colaboraSinRespuesta'), enlaces.join())
  await ctx.close()
}
{
  const { ctx, page, err } = await abrir(true, 'none', '/colabora')
  check('sin cuenta, «Crear uno» pasa por el registro y vuelve al formulario', /^\/auth\.html\?registro=1&volver=%2Ftorneos\.html%3Fcrear%3D1$/.test(await page.getAttribute('#colaboraCrearTorneo', 'href')), await page.getAttribute('#colaboraCrearTorneo', 'href'))
  await page.click('[data-apuntar="redes"]')
  await page.waitForTimeout(500)
  const href = await page.getAttribute('#colaboraEntrarBtn', 'href')
  check('  …y «Me apunto» lleva lo elegido en la vuelta del registro', /quiere%3Dredes/.test(href || ''), href)
  check('  …sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir(false, 'user-1', '/colabora?quiere=torneos')
  check('al volver con ?quiere=, la casilla ya está marcada', await page.isChecked('#colaboraRoles input[value="torneos"]'))
  await ctx.close()
}
{
  const { ctx, page, err } = await abrir(false, 'user-1', '/torneos.html?crear=1')
  check('/torneos.html?crear=1 abre el formulario de crear', await page.isVisible('#torneoForm') && await page.evaluate(() => document.activeElement?.id) === 'torneoNombre', await page.evaluate(() => document.activeElement?.id))
  check('  …sin errores', !err.length, err.join(' | '))
  await ctx.close()
  const r = await abrir(false, 'user-1', '/torneos.html')
  check('  …y sin el parámetro sigue cerrado', !(await r.page.isVisible('#torneoForm')))
  await r.ctx.close()
}

console.log('\n── D4 · Guardados vacío ──')
{
  const { ctx, page, err } = await abrir(true, 'user-1', '/guardados')
  // La semilla de user-1 puede traer guardadas: se vacía en el doble.
  await page.evaluate(async () => {
    const { supabase } = await import('/js/supabase.js')
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('user_profiles').update({ saved_guides: [] }).eq('id', session.user.id)
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const m = await page.evaluate(() => ({
    filas: document.querySelectorAll('#gdParaEmpezar .guia-fila').length,
    botones: [...document.querySelectorAll('#gdParaEmpezar [data-guardar]')].map((x) => x.getAttribute('aria-pressed')),
    titulo: document.querySelector('.gd-empezar-titulo')?.textContent,
  }))
  check('vacío: «Para empezar» con hasta tres guías y su marcador', m.titulo === 'Para empezar' && m.filas >= 1 && m.filas <= 3 && m.botones.length === m.filas && m.botones.every((x) => x === 'false'), JSON.stringify(m))
  const id = await page.getAttribute('#gdParaEmpezar [data-guardar]', 'data-guardar')
  await page.click('#gdParaEmpezar [data-guardar]')
  await page.waitForTimeout(700)
  const guardadas = await page.evaluate(async () => {
    const { supabase } = await import('/js/supabase.js')
    const { data: { session } } = await supabase.auth.getSession()
    const { data } = await supabase.from('user_profiles').select('saved_guides').eq('id', session.user.id).single()
    return data.saved_guides
  })
  check('tocar el marcador la guarda (y se ve marcado)', (await page.getAttribute('#gdParaEmpezar [data-guardar]', 'aria-pressed')) === 'true' && guardadas.includes(id), JSON.stringify(guardadas))
  await page.click('#gdParaEmpezar [data-guardar]')
  await page.waitForTimeout(700)
  const despues = await page.evaluate(async () => {
    const { supabase } = await import('/js/supabase.js')
    const { data: { session } } = await supabase.auth.getSession()
    const { data } = await supabase.from('user_profiles').select('saved_guides').eq('id', session.user.id).single()
    return data.saved_guides
  })
  check('  …y tocarlo otra vez la quita', (await page.getAttribute('#gdParaEmpezar [data-guardar]', 'aria-pressed')) === 'false' && !despues.includes(id), JSON.stringify(despues))
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}

console.log('\n── D5 · El meta nunca en blanco ──')
const conTorneos = (desde) => `window.__RPC_RESPUESTAS__ = Object.assign(window.__RPC_RESPUESTAS__ || {}, {
  meta_totales: (a) => (a.p_dias >= ${desde} ? [{ torneos: 2, jugadores: 1840, oficiales: 2, online: 0, pokedoc: 0, ultima_lectura: new Date().toISOString() }] : []),
  meta_resumen: (a) => (a.p_dias >= ${desde} ? [{ arquetipo: 'charizard-ex', nombre: 'Charizard ex', iconos: ['charizard'], mazos: 40, cuota: 0.2, cuota_anterior: 0.18, victorias: 50, derrotas: 30, empates: 2, porcentaje_victorias: 0.61 }] : []),
})`
{
  const { ctx, page, err } = await abrir(false, 'user-1', '/meta?fuente=oficial&dias=7', new Function(conTorneos(30)))
  const m = await page.evaluate(() => ({
    aviso: document.getElementById('metaAviso')?.textContent.trim(),
    pulsado: document.querySelector('#metaPeriodo [aria-pressed="true"]')?.dataset.dias,
    url: location.search,
    filas: document.querySelectorAll('#metaRanking li').length,
  }))
  check('7 días sin oficiales: pasa solo a 30 y lo dice', m.pulsado === '30' && /dias=30/.test(m.url) && /En 7 días no hubo torneos oficiales; te enseño los últimos 30 \(2 torneos\)/.test(m.aviso) && m.filas >= 1, JSON.stringify(m))
  // Elegirlo tú: te quedas en el vacío, con la frase verdadera y sin la caja.
  await page.click('#metaPeriodo [data-dias="7"]')
  await page.waitForTimeout(900)
  const v = await page.evaluate(() => ({
    aviso: document.getElementById('metaAviso')?.textContent.trim(),
    pulsado: document.querySelector('#metaPeriodo [aria-pressed="true"]')?.dataset.dias,
    alto: Math.round(document.getElementById('metaRanking').getBoundingClientRect().height),
  }))
  check('si eliges 7 tú, te quedas: el vacío dice la verdad y no guarda una caja', v.pulsado === '7' && /No hubo torneos oficiales en estos 7 días/.test(v.aviso) && !/primera carga/.test(v.aviso) && v.alto === 0, JSON.stringify(v))
  check('de dónde salen los datos, plegado', await page.evaluate(() => !document.querySelector('.meta-fuente-plegada')?.open && document.querySelector('.meta-fuente-plegada summary')?.textContent === '¿De dónde salen estos datos?'))
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
{
  // Sin torneos en ningún periodo: el vacío, sin salto y sin bucle.
  const { ctx, page, err } = await abrir(true, 'user-1', '/meta?dias=7', new Function(conTorneos(9999)))
  const m = await page.evaluate(() => ({
    aviso: document.getElementById('metaAviso')?.textContent.trim(),
    pulsado: document.querySelector('#metaPeriodo [aria-pressed="true"]')?.dataset.dias,
    pedidas: (window.__RPCS__ || []).filter((r) => r.nombre === 'meta_totales').map((r) => r.args.p_dias),
  }))
  check('sin torneos en ninguno: se queda en el pedido, lo dice, y no da vueltas (cada periodo una vez)', m.pulsado === '7' && /No hubo torneos en estos 7 días/.test(m.aviso) && m.pedidas.length <= 4, JSON.stringify(m))
  check('  …sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
{
  // Con torneos en el pedido: ni salto ni aviso.
  const { ctx, page } = await abrir(false, 'user-1', '/meta?dias=14', new Function(conTorneos(7)))
  const m = await page.evaluate(() => ({ aviso: document.getElementById('metaAviso')?.textContent.trim(), pulsado: document.querySelector('#metaPeriodo [aria-pressed="true"]')?.dataset.dias }))
  check('con torneos en el periodo pedido, nada cambia', m.pulsado === '14' && !m.aviso, JSON.stringify(m))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
