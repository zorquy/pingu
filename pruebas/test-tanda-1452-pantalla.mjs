// Tanda 1452 — Torneos en persona: el creador, la lista y la ficha (propuesta
// «Torneos en persona»; PINGU: las tres maneras de apuntarse a elegir, quien
// llega sin cuenta se la hace en la puerta, los crea todo el mundo):
//   1. El creador pregunta «¿Dónde se juega?»; en persona, el sitio y la
//      dirección, las tres maneras de apuntarse (pedir plaza, recomendada) y
//      sin check-in; lo guarda con modalidad, lugar, dirección e inscripción.
//   2. /torneos: la chapa «En persona».
//   3. La ficha: el sitio con «Cómo llegar»; «Pedir plaza» sin TCG Live (la
//      base recibe ''); inscrito, tu entrada con su QR; con «solo el
//      organizador», nadie se apunta solo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const dentroDe = (dias) => new Date(Date.now() + dias * 86400e3).toISOString()
const T = (extra = {}) => ({ id: 'torneo-1', slug: 'copa', name: 'Copa de la Tienda', status: 'registration_open', admin_id: 'admin-1', swiss_rounds: 4, top_cut_size: 0, max_players: 16, start_at: dentroDe(3), format: 'standard', checkin_minutes: 0, round_time_minutes: 50, modalidad: 'presencial', lugar: 'Cartas Bilbao', direccion: 'Calle Ercilla 12, Bilbao', inscripcion: 'pedir', ...extra })

const browser = await chromium.launch()
async function abrir(ruta, { sesion = 'user-1', torneos = [T()], inscripciones = [], movil = false } = {}) {
  const page = await browser.newPage(movil ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/sprite\/|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  await page.addInitScript(([s, t, i]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = t
    window.__FAKE_INSCRIPCIONES__ = i
    window.__FAKE_PERFILES__ = [{ id: 'user-1', username: 'pingu', display_name: 'pingu' }, { id: 'admin-1', username: 'tienda', display_name: 'tienda' }]
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, [sesion, torneos, inscripciones])
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}
const visible = (page) => page.evaluate(() => [...document.querySelectorAll('#torneoCrear [data-pregunta]')].filter((s) => !s.hidden).map((s) => s.dataset.pregunta).join())
const espera = (page, ms = 320) => page.waitForTimeout(ms)

console.log('── 1. El creador ──')
{
  const { page, errores } = await abrir('/torneos', { torneos: [] })
  await page.click('#btnNuevoTorneo')
  await page.waitForSelector('#torneoCrear[open]')
  await page.fill('#torneoNombre', 'Copa de la Tienda')
  await page.keyboard.press('Enter')
  await espera(page)
  check('tras el nombre, «¿Dónde se juega…?» con Online y En persona', (await visible(page)) === 'donde' && (await page.locator('[data-campo="torneoModalidad"]').count()) === 2, await visible(page))
  await page.click('.tc-opcion[data-campo="torneoModalidad"][data-valor="presencial"]')
  await espera(page)
  check('En persona pregunta el sitio', (await visible(page)) === 'lugar', await visible(page))
  await page.click('#btnPasoSiguiente')
  await espera(page)
  check('sin sitio no se avanza', (await visible(page)) === 'lugar')
  await page.fill('#torneoLugar', 'Cartas Bilbao')
  await page.fill('#torneoDireccion', 'Calle Ercilla 12, Bilbao')
  await page.click('#btnPasoSiguiente')
  await espera(page)
  check('…y luego el tipo, como siempre', (await visible(page)) === 'tipo', await visible(page))
  // Al resto, por el camino corto: lo que ya se probó en la 1434.
  await page.click('.tc-opcion[data-campo="torneoTipo"][data-valor="standard"]')
  await espera(page)
  await page.click('[data-chips="dia"] [data-dia]:nth-child(2)')
  await page.click('#btnPasoSiguiente'); await espera(page)
  await page.click('.tc-opcion[data-campo="torneoPlazas"][data-valor="16"]'); await espera(page)
  await page.click('#btnPasoSiguiente'); await espera(page)
  await page.click('.tc-opcion[data-campo="torneoMinutos"][data-valor="50"]'); await espera(page)
  const entrada = await page.evaluate(() => ({
    titulo: document.querySelector('[data-titulo="entrada"]')?.textContent,
    opciones: [...document.querySelectorAll('[data-pregunta="entrada"] .tc-opcion')].filter((o) => o.checkVisibility()).map((o) => o.dataset.valor),
    reco: document.querySelector('.tc-opcion[data-valor="pedir"] .tc-reco')?.textContent,
  }))
  check('«¿Cómo se apunta la gente?» con las tres maneras, sin las de online', entrada.titulo === '¿Cómo se apunta la gente?' && entrada.opciones.join() === 'pedir,organizador,libre', JSON.stringify(entrada))
  check('…y «Piden plaza» recomendada', entrada.reco === 'Recomendada')
  await page.click('.tc-opcion[data-campo="torneoInscripcion"][data-valor="pedir"]'); await espera(page)
  await page.click('.tc-opcion[data-campo="torneoListasModo"][data-valor="al_terminar"]'); await espera(page)
  check('en los extras no está el check-in', !(await page.locator('[data-extra="checkin"]').isVisible()))
  await page.click('#btnPasoSiguiente'); await espera(page)
  const resumen = (await page.textContent('#wizardResumen')).replace(/\s+/g, ' ')
  check('el resumen dice dónde y cómo se apunta', /En persona · Cartas Bilbao, Calle Ercilla 12, Bilbao/.test(resumen) && /Piden plaza · entrada en la puerta/.test(resumen), resumen)
  await page.click('#btnCrearTorneo')
  await page.waitForTimeout(1500)
  const fila = await page.evaluate(() => (window.__TABLAS__?.tournaments || []).find((t) => t.name === 'Copa de la Tienda'))
  check('se guarda en persona, con el sitio, la manera y sin check-in', fila?.modalidad === 'presencial' && fila?.lugar === 'Cartas Bilbao' && fila?.direccion === 'Calle Ercilla 12, Bilbao' && fila?.inscripcion === 'pedir' && fila?.checkin_minutes === 0 && fila?.is_private === false, JSON.stringify(fila))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 2. La lista ──')
{
  const { page, errores } = await abrir('/torneos', { torneos: [T(), T({ id: 'torneo-2', slug: 'online', name: 'Copa Online', modalidad: 'online', lugar: null })] })
  // Desde la 1454 la lista es una agenda: «dónde» va en la segunda línea de
  // cada fila (la ciudad en persona, «Online» si no).
  // Desde la 1463 los primeros van en cartel: ahí lo dice su color de tipo y
  // la línea de debajo del nombre («Cartas Bilbao · Bilbao»).
  const chapas = await page.evaluate(() => [...document.querySelectorAll('.torneo-fila, .t-cartel')].map((t) => t.classList.contains('t-cartel')
    ? `${t.dataset.torneoId}:${t.dataset.tipoTorneo === 'persona' ? (/Bilbao/.test(t.querySelector('.t-cartel-sub')?.textContent || '') ? 'Bilbao' : '?') : 'Online'}`
    : `${t.dataset.torneoId}:${t.querySelector('.torneo-fila-donde')?.classList.contains('persona') ? t.querySelector('.torneo-fila-donde').textContent.trim() : 'Online'}`))
  check('en persona dice la ciudad; online, «Online»', chapas.sort().join() === 'torneo-1:Bilbao,torneo-2:Online', chapas.join())
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 3. La ficha ──')
{
  const { page, errores } = await abrir('/torneo?slug=copa&ver=torneo')
  const sitio = await page.evaluate(() => ({ texto: document.getElementById('torneoSitio')?.textContent.replace(/\s+/g, ' ').trim(), href: document.querySelector('#torneoSitio a')?.href }))
  check('el sitio con su dirección y «Cómo llegar»', /Cartas Bilbao/.test(sitio.texto || '') && /Ercilla/.test(sitio.texto || '') && /google\.com\/maps\/search.*Cartas%20Bilbao/.test(sitio.href || ''), JSON.stringify(sitio))
  const form = await page.evaluate(() => ({ tcg: Boolean(document.getElementById('inscripcionTcgLive')), boton: document.getElementById('btnInscribirme')?.textContent.trim() }))
  check('sin TCG Live y con «Pedir plaza»', !form.tcg && form.boton === 'Pedir plaza', JSON.stringify(form))
  await page.evaluate(() => document.getElementById('formInscripcion').requestSubmit())
  await page.waitForTimeout(800)
  const rpc = await page.evaluate(() => (window.__RPCS__ || []).find((r) => r.nombre === 'torneos_inscribirse'))
  check('pide plaza por la RPC, con el usuario de TCG Live vacío', rpc && rpc.args.p_tcg_live === '' && rpc.args.p_torneo === 'torneo-1', JSON.stringify(rpc))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  const { page, errores } = await abrir('/torneo?slug=copa&ver=torneo', { inscripciones: [{ id: 'i1', tournament_id: 'torneo-1', user_id: 'user-1', status: 'active', tcg_live_username: '', registered_at: dentroDe(-1) }] })
  const billete = await page.evaluate(() => ({ qr: Boolean(document.querySelector('.torneo-billete-qr svg')), texto: document.querySelector('.torneo-billete')?.textContent.replace(/\s+/g, ' '), tcg: /TCG Live:/.test(document.getElementById('miPlazaContenido')?.textContent || '') }))
  check('la sala de Info dice «En persona», no «Online» (1454b; desde la 1465, en su casilla del sitio)', await page.evaluate(() => /En persona/i.test(document.querySelector('.sala-sitio')?.textContent || '') && !/·\s*Online/i.test(document.querySelector('.sala-sitio')?.textContent || '')))
  check('inscrito: tu entrada con su QR, para la puerta', billete.qr && /TU ENTRADA/.test(billete.texto || '') && /Cartas Bilbao/.test(billete.texto || ''), JSON.stringify(billete))
  check('…y ni rastro de TCG Live', !billete.tcg)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  const { page, errores } = await abrir('/torneo?slug=copa&ver=torneo', { torneos: [T({ inscripcion: 'organizador' })] })
  const r = await page.evaluate(() => ({ form: Boolean(document.getElementById('formInscripcion')), texto: document.getElementById('miPlazaContenido')?.textContent.replace(/\s+/g, ' ') }))
  check('«Solo tú los apuntas»: sin formulario, y dice que te apuntan allí', !r.form && /te apunta quien lo organiza/.test(r.texto || ''), JSON.stringify(r))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
