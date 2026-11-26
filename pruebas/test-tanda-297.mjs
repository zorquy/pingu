// Tanda 297 (A): la lista de torneos, en tarjetas.
//
// PINGU: «me gustaría simplificar y hacerlo todo más visual, empezando
// por la parte de los torneos».
//
// Hasta hoy cada torneo era UNA LÍNEA de texto. Lo que se prueba aquí
// no es que quede bonito —eso se mira— sino lo que el rediseño PROMETE:
// una acción por tarjeta y que diga la verdad según el estado, la barra
// del torneo que estás jugando, y que la portada de un torneo no cambie
// de color en cada recarga.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Desde la 1221 el botón dice «Ver» y lo largo («Ver el torneo», «Resultados
// y mazos») va en su aria-label, antes de los dos puntos con el nombre.
const accionDe = (a) => (a.getAttribute('aria-label') || a.textContent).split(':')[0].trim()
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const JS_LISTA = readFileSync('/home/user/pingu/js/torneos/torneos.js', 'utf8')
const CSS = readFileSync('/home/user/pingu/css/torneos.css', 'utf8')
const ahora = Date.now()

const TORNEOS = [
  { id: 'torneo-1', slug: 'pachanga', name: 'La Pachanga de Otoño', status: 'in_progress',
    admin_id: 'admin-1', max_players: 16, swiss_rounds: 3, swiss_bo: 3, top_cut_size: 4,
    start_at: new Date(ahora - 3600e3).toISOString(), is_official: true },
  { id: 'torneo-2', slug: 'copa-invierno', name: 'Copa de Invierno', status: 'registration_open',
    admin_id: 'admin-1', max_players: 32, swiss_rounds: 5, swiss_bo: 3, top_cut_size: 8,
    start_at: new Date(ahora + 5 * 86400e3).toISOString(), is_official: true },
  { id: 'torneo-3', slug: 'casi-llena', name: 'Casi llena', status: 'registration_open',
    admin_id: 'user-3', max_players: 5, swiss_rounds: 3, swiss_bo: 1, top_cut_size: null,
    start_at: new Date(ahora + 2 * 86400e3).toISOString() },
  { id: 'torneo-4', slug: 'copa-inaugural', name: 'Copa Inaugural', status: 'finished',
    admin_id: 'admin-1', max_players: 16, swiss_rounds: 4, swiss_bo: 3, top_cut_size: 4,
    start_at: new Date(ahora - 20 * 86400e3).toISOString(), champion_id: 'user-1', is_official: true },
]
// MISTY (user-2) se queda FUERA de todo a propósito: es quien prueba lo
// que ve alguien que no está apuntado —«Apuntarme», y sin barra de «estás
// jugando»—. Los cinco de la Copa son para el «+1» (cuatro caras y uno
// más); los cuatro de «Casi llena», de cinco plazas, para la barra
// naranja del 80%.
const GENTE = ['user-1', 'user-3', 'mod-1', 'admin-1']
const INSCRIPCIONES = [
  ...GENTE.map((u, i) => ({ id: `p${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active' })),
  ...[...GENTE, 'user-2'].map((u, i) => ({ id: `c${i}`, tournament_id: 'torneo-2', user_id: u, status: 'active' })),
  ...GENTE.map((u, i) => ({ id: `l${i}`, tournament_id: 'torneo-3', user_id: u, status: 'active' })),
  ...GENTE.slice(1, 4).map((u, i) => ({ id: `f${i}`, tournament_id: 'torneo-4', user_id: u, status: 'active' })),
]
const RONDAS = [
  { id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, status: 'finished' },
  { id: 'ronda-2', tournament_id: 'torneo-1', round_number: 2, status: 'active',
    ends_at: new Date(ahora + 9 * 60000).toISOString() },
]

const browser = await chromium.launch()
const abrir = async ({ sesion = 'user-1', torneos = TORNEOS, inscripciones = INSCRIPCIONES, ancho = 1280 } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript(([s, t, i, r]) => {
    // 'none' es como el doble dice «sin cuenta».
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = t
    window.__FAKE_INSCRIPCIONES__ = i
    window.__FAKE_RONDAS__ = r
  }, [sesion, torneos, inscripciones, RONDAS])
  await page.goto(`${BASE}/torneos`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}
const tarjetaDe = (page, nombre) => page.locator('.torneo-tarjeta').filter({ hasText: nombre }).first()

// Desde la 1454 cada torneo es una FILA de la agenda (sin portada ni caras):
// lo que la 297 prometía —una acción que dice la verdad según el estado, las
// plazas que avisan, el enlace bien hecho— se sigue probando aquí.
console.log('\n── 1. Una fila por torneo, y UNA acción ──')
{
  const { page, errores } = await abrir()
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  check('los cuatro torneos, cada uno en su fila', (await page.locator('.torneo-tarjeta.torneo-fila').count()) === 4,
    String(await page.locator('.torneo-tarjeta').count()))
  const copa = tarjetaDe(page, 'Copa de Invierno')
  check('cada fila tiene UNA acción', (await copa.locator('.torneo-pie-accion').count()) === 1)
  // user-1 está inscrito en la Copa: no se le ofrece apuntarse otra vez.
  check('inscrito → «Inscrito», que lleva a ver el torneo', (await copa.locator('.torneo-pie-accion').evaluate(accionDe)) === 'Estás inscrito')
  check('  …y se le marca que está dentro', await copa.evaluate((f) => f.classList.contains('torneo-tarjeta-mia')))
  const hrefTarjeta = await copa.locator('.torneo-tarjeta-enlace').getAttribute('href')
  const hrefBoton = await copa.locator('.torneo-pie-accion').getAttribute('href')
  check('el botón lleva al mismo torneo que la fila', hrefTarjeta === hrefBoton && /slug=copa-invierno/.test(hrefTarjeta), `${hrefTarjeta} / ${hrefBoton}`)
  await page.close()
}

console.log('\n── 2. La acción dice la verdad según el estado ──')
{
  const { page } = await abrir({ sesion: 'user-2' })
  check('no inscrito y abierto → «Apuntarme»',
    (await tarjetaDe(page, 'Casi llena').locator('.torneo-pie-accion').evaluate(accionDe)) === 'Apuntarme')
  check('  …y va en verde', await tarjetaDe(page, 'Casi llena').locator('.torneo-btn-apuntarse').count() === 1)
  check('  …y el de al lado, donde SÍ está, no lo ofrece',
    (await tarjetaDe(page, 'Copa de Invierno').locator('.torneo-pie-accion').evaluate(accionDe)) === 'Estás inscrito')
  check('en juego → «Ver el directo»', (await tarjetaDe(page, 'Pachanga').locator('.torneo-pie-accion').evaluate(accionDe)) === 'Ver el directo')
  check('terminado → «Resultados y mazos»', (await tarjetaDe(page, 'Inaugural').locator('.torneo-pie-accion').evaluate(accionDe)) === 'Ver resultados y mazos')
  const fin = tarjetaDe(page, 'Inaugural')
  check('y en vez de las plazas, el campeón', (await fin.locator('.torneo-campeon').textContent())?.includes('Ash'),
    await fin.locator('.torneo-campeon').textContent())
  check('  …sin barra de ocupación', (await fin.locator('.torneo-ocupacion').count()) === 0)
  await page.close()
}

console.log('\n── 3. Las plazas ──')
{
  const { page } = await abrir()
  const copa = tarjetaDe(page, 'Copa de Invierno')
  const casi = tarjetaDe(page, 'Casi llena')
  check('la barra se pone apurada al 80%', (await casi.locator('.torneo-ocupacion-barra.apurada').count()) === 1)
  check('  …y la de la Copa (5/32) no', (await copa.locator('.torneo-ocupacion-barra.apurada').count()) === 0)
  check('la cifra dice cuántos de cuántos', (await casi.locator('.torneo-ocupacion-cifra').textContent()) === '4/5',
    await casi.locator('.torneo-ocupacion-cifra').textContent())
  await page.close()
}

console.log('\n── 5. La barra del torneo que estás jugando ──')
{
  const { page } = await abrir()
  const vivo = page.locator('#torneoVivo')
  check('sale si estás jugando algo', await vivo.isVisible())
  check('  …y dice cuál', (await vivo.textContent())?.includes('La Pachanga de Otoño'))
  check('  …y por qué ronda va', (await vivo.textContent())?.includes('Ronda 2 de 3'), await vivo.textContent())
  check('  …con el reloj corriendo', /^\d+:\d{2}$/.test((await page.locator('#torneoVivoReloj').textContent()) || ''),
    await page.locator('#torneoVivoReloj').textContent())
  check('  …y el enlace a TU torneo', /slug=pachanga/.test((await vivo.locator('.torneo-vivo-der a').getAttribute('href')) || ''))
  await page.close()

  // Y quien no juega nada no la ve: una barra vacía ocupando el sitio
  // del primer torneo sería peor que no tenerla.
  const otro = await abrir({ sesion: 'user-2' })
  check('quien no juega nada no la ve', !(await otro.page.locator('#torneoVivo').isVisible()))
  await otro.page.close()
}

console.log('\n── 6. Sin cuenta ──')
{
  // La sección es el ESCAPARATE (tanda 252): la lista se ve entera sin
  // cuenta. «Apuntarme» sale igual y lleva a la ficha, que es la que
  // manda al registro — el botón no miente, solo no hace el trabajo.
  const { page, errores } = await abrir({ sesion: 'none' })
  check('la lista se ve sin cuenta', (await page.locator('.torneo-tarjeta').count()) > 0)
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  check('  …y no hay barra de «estás jugando»', !(await page.locator('#torneoVivo').isVisible()))
  check('  …y «Apuntarme» sigue saliendo', (await page.locator('.torneo-btn-apuntarse').count()) > 0)
  await page.close()
}

console.log('\n── 7. Lo que el rediseño ARREGLA del HTML ──')
{
  // Ningún botón dentro del <a> de la fila (no es HTML válido): el «⋯» y la
  // acción van fuera, a la derecha.
  const { page } = await abrir()
  const dentro = await page.evaluate(() =>
    document.querySelectorAll('.torneo-tarjeta-enlace button, .torneo-tarjeta-enlace a').length)
  check('ningún botón ni enlace dentro del enlace de la fila', dentro === 0, String(dentro))
  check('y «Duplicar» sigue estando, en el «⋯» del terminado',
    (await tarjetaDe(page, 'Inaugural').locator('.torneo-fila-der .torneo-duplicar').count()) === 1)
  await page.close()
}

console.log('\n── 8. Los filtros son chips; Lista/Calendario, la cápsula ──')
{
  check('los filtros son chips de la casa', JS_LISTA.includes('class="torneo-pestanas-chips torneos-filtros"') && JS_LISTA.includes('class="chip-filtro'))
  check('  …y el subrayado de pestaña se fue de torneos.css', !/\n\.torneo-pestanas \{/.test(CSS) && !/\n\.torneo-pestana \{/.test(CSS))
  const { page } = await abrir()
  const subrayados = await page.evaluate(() => ({
    filtros: parseFloat(getComputedStyle(document.querySelector('.torneo-pestanas-chips')).borderBottomWidth),
    chip: getComputedStyle(document.querySelector('.torneo-pestanas-chips .chip-filtro')).borderRadius,
    conmutador: document.querySelector('.torneo-vista-conmutador')?.classList.contains('seg'),
    conmutadorBoton: document.querySelector('.torneo-vista-conmutador .seg-btn.activa')?.textContent.trim(),
  }))
  check('  …sin subrayado debajo', subrayados.filtros === 0, JSON.stringify(subrayados))
  check('  …y redondos', /px/.test(subrayados.chip || '') && parseFloat(subrayados.chip) >= 16, JSON.stringify(subrayados))
  check('  …y el conmutador Lista/Calendario es la cápsula compartida', subrayados.conmutador === true && subrayados.conmutadorBoton === 'Lista', JSON.stringify(subrayados))
  const estrecho = await abrir({ ancho: 320 })
  const desborde = await estrecho.page.evaluate(() => {
    // La fila de filtros sangra a propósito hasta el borde (se desliza de
    // lado); lo que no puede salirse es la agenda ni la página.
    const l = document.querySelector('#torneosAgenda')
    return { lista: l.scrollWidth - l.clientWidth, pagina: document.documentElement.scrollWidth - document.documentElement.clientWidth }
  })
  check('a 320 px la agenda no se sale', desborde.lista <= 1, JSON.stringify(desborde))
  check('  …ni la página entera', desborde.pagina <= 1, JSON.stringify(desborde))
  await page.close()
  await estrecho.page.close()
}

console.log('\n── 9. Y la FICHA se queda como estaba ──')
{
  // Las pestañas son un componente COMPARTIDO desde la tanda 210. En la
  // lista son filtros (chips); en la ficha son navegación y siguen
  // siendo subrayado. Si el estilo de chip se escribiera sobre la clase
  // compartida, la ficha cambiaría de cara sin que nadie lo pidiera —y
  // esta tanda solo toca la lista.
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  await page.addInitScript((t) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = t
  }, TORNEOS)
  await page.goto(`${BASE}/torneo?slug=copa-invierno`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  const nav = await page.evaluate(() => {
    const n = document.querySelector('#torneoPestanas')
    return n ? { clases: n.className } : null
  })
  check('la ficha sigue teniendo sus pestañas', nav !== null)
  // La tanda 298 le dio a la ficha SU propio estilo (pastillas). Lo que
  // esta comprobación guarda sigue siendo lo mismo: que cada pantalla
  // tenga el suyo y que el de la lista no se cuele aquí. Si las chips se
  // escribieran sobre la clase compartida, esto lo cantaría.
  check('  …con el suyo: la cápsula compartida (678), marcada como la de la ficha', /torneo-pestanas-pastillas/.test(nav?.clases || '') && /\bseg\b/.test(nav?.clases || ''), nav?.clases)
  check('  …y no con las chips de la lista', !/torneo-pestanas-chips/.test(nav?.clases || ''), nav?.clases)
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
