// Tanda 1454–1456 — /torneos como agenda (propuesta «Los torneos, de un
// vistazo»; PINGU: «¿qué pasa con los terminados?» y «los borradores solo
// deberían salir a los que lo han creado»):
//   1. Una fila por torneo, por días: Hoy · Esta semana · Más adelante, por
//      fecha; lo tuyo dice «Inscrito»; en persona con plaza a pedir, «Pedir
//      plaza»; ni una pestaña de estado.
//   2. Lo tuyo en una pieza: jugando, el combate lleva tu mesa y contra quién,
//      y el siguiente va en la línea «Después» (en persona, «entrada en la
//      puerta»); sin jugar, el cartel del próximo dice «entrada en la puerta»
//      y no «check-in desde».
//   3. Filtros: Los míos, Online, En persona ▾ con las ciudades (se recuerda
//      la elegida), Oficiales, Ligas y el buscador.
//   4. Terminados: no se mezclan; abajo los tres últimos y su vista propia
//      (chip, botón o #terminados) por meses, con quién ganó y tu puesto.
//   5. Borradores: los tuyos arriba; los de otra persona no salen ni a un admin.
//   6. Móvil: sin desbordar y con la fila de filtros deslizándose.
// Desde la 1472 (Arena limpia), sobre la lista nueva: pestañas, filas `.tf`
// por meses y el destacado.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const dia = (d, h = 17) => { const x = new Date(Date.now() + d * 86400e3); x.setHours(h, 0, 0, 0); return x.toISOString() }
const T = (id, name, status, start, extra = {}) => ({ id, slug: id, name, status, admin_id: 'admin-1', swiss_rounds: 5, top_cut_size: 8, max_players: 32, start_at: start, format: 'standard', checkin_minutes: 10, round_time_minutes: 50, modalidad: 'online', is_official: false, ...extra })
const hoy23 = new Date().getHours() >= 22 ? dia(0, 23) : dia(0, 22)
const TORNEOS = [
  T('vivo', 'Tardeo de Testeo', 'in_progress', dia(0, 0)),
  T('noche', 'Noche de Expanded', 'registration_open', hoy23),
  T('bilbao', 'Copa Cartas Bilbao', 'registration_open', dia(2), { modalidad: 'presencial', lugar: 'Cartas Bilbao', direccion: 'Calle Ercilla 12, 48009 Bilbao', inscripcion: 'pedir' }),
  T('liga', 'Liga PokeDoc', 'registration_open', dia(4), { is_official: true, format: 'league' }),
  T('madrid', 'Torneo Madrid', 'registration_open', dia(10), { modalidad: 'presencial', lugar: 'Dragón de Papel', direccion: 'Gran Vía 30, Madrid', inscripcion: 'pedir' }),
  T('otono', 'Copa de Otoño', 'finished', dia(-3), { champion_id: 'u1', podium: ['u1', 'u2', 'user-1'] }),
  T('expanded', 'Domingo Expanded', 'finished', dia(-7), { champion_id: 'user-1', podium: ['user-1'] }),
  T('octubre', 'Liga de Octubre', 'finished', dia(-35), { champion_id: 'u2', podium: ['u2'] }),
  T('halloween', 'Pachanga de Halloween', 'finished', dia(-28), { champion_id: 'u1', podium: ['u1'] }),
  T('borr-mio', 'Pachanga del jueves', 'draft', dia(12), { admin_id: 'user-1' }),
  T('borr-otro', 'Borrador ajeno', 'draft', dia(14), { admin_id: 'u9' }),
]
const INSC = [
  ...['vivo', 'bilbao', 'otono', 'expanded'].map((t, i) => ({ id: `m${i}`, tournament_id: t, user_id: 'user-1', status: 'active', tcg_live_username: 'yo' })),
  { id: 'x1', tournament_id: 'vivo', user_id: 'u2', status: 'active', tcg_live_username: 'r' },
]
const PERFILES = [{ id: 'user-1', username: 'pingu', is_admin: true }, { id: 'u1', username: 'ikergbt' }, { id: 'u2', username: 'rubengp' }, { id: 'u9', username: 'otra' }, { id: 'admin-1', username: 'pokedoc', is_admin: true }]
const RONDAS = [{ id: 'r1', tournament_id: 'vivo', round_number: 2, status: 'active', phase: 'swiss', started_at: new Date(Date.now() - 6e5).toISOString(), ends_at: new Date(Date.now() + 18e5).toISOString() }]
const MESAS = [{ id: 'mm', round_id: 'r1', table_number: 7, player_a_id: 'user-1', player_b_id: 'u2', status: 'active' }]

const browser = await chromium.launch()
async function abrir({ hash = '', torneos = TORNEOS, movil = false, ciudad = null } = {}) {
  const page = await browser.newPage(movil ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/sprite\/|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  await page.addInitScript(([t, i, p, r, m, c]) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = t
    window.__FAKE_INSCRIPCIONES__ = i
    window.__FAKE_PERFILES__ = p
    window.__FAKE_RONDAS__ = r
    window.__FAKE_MESAS__ = m
    try {
      localStorage.setItem('pokedoc-instalar-no', String(Date.now()))
      localStorage.removeItem('pokedoc-torneos-vista')
      if (c) localStorage.setItem('pokedoc-torneos-ciudad', c)
      else localStorage.removeItem('pokedoc-torneos-ciudad')
    } catch {}
  }, [torneos, INSC, PERFILES, RONDAS, MESAS, ciudad])
  await page.goto(`${BASE}/torneos${hash}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}
// Desde la 1472 (Arena limpia) cada torneo es una fila `.tf`, y arriba de
// Próximos va el destacado (`.tdest`). Lo que se juega va en su pestaña (En
// juego) y los terminados en la suya (Terminados).
const filas = (page) => page.evaluate(() => [...document.querySelectorAll('#torneosAgenda .tf, #torneosAgenda .tdest')].map((f) => f.dataset.torneoId))
const tramos = (page) => page.evaluate(() => [...document.querySelectorAll('#torneosAgenda .torneos-tramo-cab')].map((h) => h.firstChild.textContent.trim()))
const MES = /^[A-ZÁÉÍÓÚ][a-záéíóú]+( \d{4})?$/

console.log('── 1. La agenda (Próximos) ──')
{
  const { page, errores } = await abrir()
  check('sin errores de JavaScript', !errores.length, errores.join(' | '))
  const tr = await tramos(page)
  check('los tramos: tus borradores y luego por meses (1472)', tr[0] === 'Tus borradores' && tr.slice(1).length >= 1 && tr.slice(1).every((m) => MES.test(m)), tr.join('|'))
  const f = await filas(page)
  check('por fecha: tu borrador, tu próximo (destacado) y lo que viene; ni lo que se juega ni lo terminado', f.join() === 'borr-mio,bilbao,noche,liga,madrid', f.join())
  check('ni una pestaña de estado vieja (Abiertas…): tres pestañas, Próximos · En juego · Terminados', !(await page.$('[data-grupo]')) && (await page.$$('.tseg-btn')).length === 3)
  const bilbao = await page.$eval('.tdest[data-torneo-id="bilbao"]', (a) => ({ motivo: a.querySelector('.tdest-motivo')?.textContent.trim(), der: a.querySelector('.torneo-pie-accion').textContent.trim(), donde: a.querySelector('.tdest-quien').textContent.trim() }))
  check('tu próximo va destacado arriba y dice que estás dentro', bilbao.motivo === 'Tu próximo torneo' && /Estás dentro/.test(bilbao.der), JSON.stringify(bilbao))
  check('en persona dice el sitio y la ciudad', /Cartas Bilbao/.test(bilbao.donde) && /Bilbao/.test(bilbao.donde), bilbao.donde)
  check('en persona con plaza a pedir: «Pedir plaza»', (await page.$eval('[data-torneo-id="madrid"] .torneo-pie-accion', (a) => a.textContent.trim())) === 'Pedir plaza')
  check('online abierto: «Apuntarme»', (await page.$eval('[data-torneo-id="noche"] .torneo-pie-accion', (a) => a.textContent.trim())) === 'Apuntarme')
  check('la fila enseña quién organiza', /Organiza PokeDoc|Organiza pokedoc/.test(await page.$eval('[data-torneo-id="noche"] .tf-sub', (a) => a.textContent)))

  console.log('── 2. Lo tuyo en una pieza ──')
  const vivo = await page.$eval('#torneoVivo', (v) => v.textContent.replace(/\s+/g, ' '))
  check('el combate lleva tu mesa y contra quién', /Mesa 7 · contra rubengp/.test(vivo), vivo)
  check('y el siguiente en la línea «Después», con la puerta', /Después: Copa Cartas Bilbao/.test(vivo) && /entrada en la puerta/.test(vivo) && /Tu entrada/.test(vivo), vivo)
  await page.click('[data-vista-lista="vivo"]')
  await page.waitForTimeout(300)
  const v = await page.$eval('[data-torneo-id="vivo"]', (a) => a.querySelector('.torneo-pie-accion').textContent.trim() + '|' + (a.querySelector('.chapa-tipo[data-tipo-torneo="vivo"]') ? 'vivo' : ''))
  check('En juego: el que juegas, con «Ir a mi mesa» y la chapa roja', v === 'Ir a mi mesa|vivo', v)
  await page.click('[data-vista-lista="proximos"]')
  await page.waitForTimeout(300)

  console.log('── 3. Filtros ──')
  check('ni «Los míos» ni «Oficiales» en la fila', !(await page.$('[data-filtro-lista="mios"]')) && !(await page.$('[data-filtro-lista="oficiales"]')))
  await page.click('[data-filtro-lista="online"]')
  check('Online: sin los de en persona', !(await filas(page)).some((id) => ['bilbao', 'madrid'].includes(id)))
  await page.click('details.torneos-ciudad > summary')
  await page.waitForTimeout(250)
  const menu = await page.$$eval('#torneosCiudadMenu [data-ciudad]', (bs) => bs.map((b) => b.textContent.replace(/\s+/g, ' ').trim()))
  check('«En persona ▾» abre las ciudades con su cuenta', menu.join('|') === 'Todas las ciudades 2|Bilbao 1|Madrid 1', menu.join('|'))
  await page.click('#torneosCiudadMenu [data-ciudad="Madrid"]')
  await page.waitForTimeout(200)
  check('elegida una ciudad, solo sus torneos (sin destacado con un filtro puesto)', (await filas(page)).join() === 'madrid', (await filas(page)).join())
  check('el chip dice la ciudad', /En persona · Madrid/.test(await page.$eval('details.torneos-ciudad > summary', (s) => s.textContent)))
  check('la ciudad se recuerda', (await page.evaluate(() => localStorage.getItem('pokedoc-torneos-ciudad'))) === 'Madrid')
  check('el menú se cierra al elegir', !(await page.$('#torneosCiudadMenu')))
  await page.click('[data-filtro-lista="todos"]')
  await page.fill('#torneosBuscar', 'dragon')
  await page.waitForTimeout(150)
  check('el buscador, sin tildes (busca también el sitio), y sin perder el foco', (await filas(page)).join() === 'madrid' && (await page.evaluate(() => document.activeElement?.id)) === 'torneosBuscar', (await filas(page)).join())
  await page.fill('#torneosBuscar', 'zzzz')
  await page.waitForTimeout(150)
  check('sin nada: lo dice y ofrece quitar los filtros', Boolean(await page.$('#torneosAgenda [data-quitar-filtros]')))
  await page.click('#torneosAgenda [data-quitar-filtros]')
  check('«Quitar los filtros» vuelve a todo', (await filas(page)).length === 5 && (await page.$eval('#torneosBuscar', (i) => i.value)) === '')

  console.log('── 4. Terminados ──')
  await page.click('[data-vista-lista="hechos"]')
  await page.waitForTimeout(200)
  check('su pestaña: #terminados', (await page.evaluate(() => location.hash)) === '#terminados')
  check('por meses, del último al primero', (await tramos(page)).length === 2 && (await filas(page)).join() === 'otono,expanded,halloween,octubre', (await tramos(page)).join('|') + ' ' + (await filas(page)).join())
  const otono = await page.$eval('[data-torneo-id="otono"]', (f) => f.textContent.replace(/\s+/g, ' '))
  check('cada uno dice quién ganó y tu puesto', /ikergbt/.test(otono) && /Quedaste 3\.º/.test(otono), otono)
  check('el que ganaste dice «Campeón»', /Campeón/.test(await page.$eval('[data-torneo-id="expanded"] .tf-chapa.oro', (f) => f.textContent)))
  check('en Terminados no hay nada de lo que viene', !(await filas(page)).includes('noche'))
  await page.click('[data-vista-lista="proximos"]')
  check('«Próximos» vuelve', (await page.evaluate(() => location.hash)) === '' && (await filas(page)).includes('noche'))
  await page.close()
}
{
  const { page } = await abrir({ hash: '#terminados' })
  check('/torneos#terminados abre directamente los terminados', (await filas(page)).join() === 'otono,expanded,halloween,octubre', (await filas(page)).join())
  await page.close()
}

console.log('── 5. Borradores ──')
{
  const { page } = await abrir()
  const f = await filas(page)
  check('el tuyo sale (arriba), el de otra persona no, aunque seas admin', f[0] === 'borr-mio' && !f.includes('borr-otro'), f.join())
  check('el borrador dice «solo los ves tú» y «Editar»', /solo los ves tú/.test(await page.$eval('.torneos-tramo-borradores', (s) => s.textContent)) && (await page.$eval('[data-torneo-id="borr-mio"] .torneo-pie-accion', (a) => a.textContent.trim())) === 'Editar')
  await page.close()
}

console.log('── 2b. Sin jugar: tu próximo, destacado ──')
{
  const { page } = await abrir({ torneos: TORNEOS.filter((t) => t.id !== 'vivo') })
  const d = await page.$eval('.tdest', (c) => c.textContent.replace(/\s+/g, ' '))
  check('arriba, tu próximo torneo', /Tu próximo torneo/.test(d) && /Copa Cartas Bilbao/.test(d), d)
  check('sin la barra del combate', await page.$eval('#torneoVivo', (v) => v.classList.contains('hidden')))
  await page.close()
}

console.log('── 3b. La ciudad recordada ──')
{
  const { page } = await abrir({ ciudad: 'Bilbao' })
  await page.click('details.torneos-ciudad > summary')
  await page.waitForTimeout(250)
  check('al abrir las ciudades, la última elegida va marcada', (await page.$eval('#torneosCiudadMenu .activa', (b) => b.dataset.ciudad).catch(() => null)) === 'Bilbao')
  await page.close()
}

console.log('── 6. Móvil ──')
{
  const { page, errores } = await abrir({ movil: true })
  check('sin errores', !errores.length, errores.join(' | '))
  check('sin desbordar de lado', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  check('la fila de filtros se desliza (no salta de línea)', await page.$eval('.torneos-filtros', (n) => getComputedStyle(n).flexWrap === 'nowrap' && n.scrollWidth > n.clientWidth))
  check('la fecha no ocupa la fila: va en la línea de abajo', await page.$eval('[data-torneo-id="madrid"] .tf-fecha', (p) => getComputedStyle(p).display === 'none'))
  const alto = await page.$eval('[data-torneo-id="madrid"]', (f) => f.getBoundingClientRect().height)
  check('una fila mide menos de 80 px', alto < 80, alto)
  await page.click('details.torneos-ciudad > summary')
  await page.waitForTimeout(250)
  const tocable = await page.evaluate(() => { const b = document.querySelector('#torneosCiudadMenu [data-ciudad="Bilbao"]'); const r = b.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b })
  check('el menú de ciudades se puede tocar (la fila que se desliza no lo recorta)', tocable)
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
