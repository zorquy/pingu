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
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = 'http://localhost:8892'
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
const abrirGrupo = async (page, texto) => {
  const chips = page.locator('.torneo-pestana')
  for (let i = 0; i < (await chips.count()); i++) {
    if (((await chips.nth(i).textContent()) || '').includes(texto)) {
      await chips.nth(i).click()
      await page.waitForTimeout(400)
      return true
    }
  }
  return false
}
const tarjetaDe = (page, nombre) => page.locator('.torneo-tarjeta').filter({ hasText: nombre }).first()

console.log('\n── 1. Una tarjeta por torneo, y UNA acción ──')
{
  const { page, errores } = await abrir()
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  check('se abre el grupo de abiertas', await abrirGrupo(page, 'Abiert'))
  check('hay dos tarjetas', (await page.locator('.torneo-tarjeta').count()) === 2,
    String(await page.locator('.torneo-tarjeta').count()))

  const copa = tarjetaDe(page, 'Copa de Invierno')
  check('cada tarjeta tiene UNA acción', (await copa.locator('.torneo-pie-accion').count()) === 1)
  // user-1 está inscrito en la Copa: no se le ofrece apuntarse otra vez.
  check('inscrito → «Ver el torneo»', (await copa.locator('.torneo-pie-accion').textContent()) === 'Ver el torneo')
  check('  …y se le marca que está dentro', (await copa.locator('.torneo-mio').count()) === 1)
  // Y el enlace de la tarjeta y el del botón van al MISMO sitio: si se
  // separan, pulsar el botón te lleva a otro torneo.
  const hrefTarjeta = await copa.locator('.torneo-tarjeta-enlace').getAttribute('href')
  const hrefBoton = await copa.locator('.torneo-pie-accion').getAttribute('href')
  check('el botón lleva al mismo torneo que la tarjeta', hrefTarjeta === hrefBoton && /slug=copa-invierno/.test(hrefTarjeta), `${hrefTarjeta} / ${hrefBoton}`)
  await page.close()
}

console.log('\n── 2. La acción dice la verdad según el estado ──')
{
  const { page } = await abrir({ sesion: 'user-2' })
  // Misty no está en «Casi llena», sí en la Copa: las dos tarjetas, una
  // al lado de la otra, tienen que decir cosas distintas.
  await abrirGrupo(page, 'Abiert')
  check('no inscrito y abierto → «Apuntarme»',
    (await tarjetaDe(page, 'Casi llena').locator('.torneo-pie-accion').textContent()) === 'Apuntarme')
  // «Apuntarme» va en verde: es la única acción de la sección que suma
  // gente y tiene que distinguirse de «ver» a un metro.
  check('  …y va en verde', await tarjetaDe(page, 'Casi llena').locator('.torneo-btn-apuntarse').count() === 1)
  check('  …y el de al lado, donde SÍ está, no lo ofrece',
    (await tarjetaDe(page, 'Copa de Invierno').locator('.torneo-pie-accion').textContent()) === 'Ver el torneo')
  check('en juego → «Ver el directo»', await abrirGrupo(page, 'En juego') &&
    (await tarjetaDe(page, 'Pachanga').locator('.torneo-pie-accion').textContent()) === 'Ver el directo')
  check('terminado → «Resultados y mazos»', await abrirGrupo(page, 'Terminad') &&
    (await tarjetaDe(page, 'Inaugural').locator('.torneo-pie-accion').textContent()) === 'Resultados y mazos')
  // En un torneo terminado la ocupación no dice nada: lo que se quiere
  // saber es quién ganó.
  const fin = tarjetaDe(page, 'Inaugural')
  check('y en vez de las plazas, el campeón', (await fin.locator('.torneo-campeon').textContent())?.includes('Ash'),
    await fin.locator('.torneo-campeon').textContent())
  check('  …sin barra de ocupación', (await fin.locator('.torneo-ocupacion').count()) === 0)
  await page.close()
}

console.log('\n── 3. Quién va apuntado ──')
{
  const { page } = await abrir()
  await abrirGrupo(page, 'Abiert')
  const copa = tarjetaDe(page, 'Copa de Invierno')
  // Cinco inscritos, cuatro caras y un «+1»: pedir el perfil de los 32
  // de cada torneo por enseñar cuatro sería tirar la consulta.
  check('como mucho cuatro caras', (await copa.locator('.torneo-caras > .torneo-cara:not(.torneo-cara-mas)').count()) === 4,
    String(await copa.locator('.torneo-cara').count()))
  check('  …y el resto se cuenta en el «+N»', (await copa.locator('.torneo-cara-mas').textContent()) === '+1')
  // La barra naranja es lo que convierte «7/8» en «corre, que se llena».
  const casi = tarjetaDe(page, 'Casi llena')
  check('la barra se pone apurada al 80%', (await casi.locator('.torneo-ocupacion-barra.apurada').count()) === 1)
  check('  …y la de la Copa (5/32) no', (await copa.locator('.torneo-ocupacion-barra.apurada').count()) === 0)
  check('la cifra dice cuántos de cuántos', (await casi.locator('.torneo-ocupacion-cifra').textContent()) === '4/5',
    await casi.locator('.torneo-ocupacion-cifra').textContent())
  await page.close()
}

console.log('\n── 4. La portada no cambia de color en cada recarga ──')
{
  // Se elige por el slug y no al azar. Si fuera aleatorio, la lista
  // parpadearía de colores en cada refresco del sondeo.
  const clase = async () => {
    const { page } = await abrir()
    await abrirGrupo(page, 'Abiert')
    const c = await tarjetaDe(page, 'Copa de Invierno').locator('.torneo-arte').getAttribute('class')
    await page.close()
    return c
  }
  const a = await clase()
  const b = await clase()
  check('el mismo torneo, el mismo arte en dos cargas', a === b, `${a} / ${b}`)
  check('  …y es uno de los seis', /torneo-arte-[1-6]\b/.test(a), a)
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
  check('  …y el enlace a TU torneo', /slug=pachanga/.test((await vivo.locator('a').getAttribute('href')) || ''))
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
  await abrirGrupo(page, 'Abiert')
  check('  …y «Apuntarme» sigue saliendo', (await page.locator('.torneo-btn-apuntarse').count()) > 0)
  await page.close()
}

console.log('\n── 7. Lo que el rediseño ARREGLA del HTML ──')
{
  // Hasta la 297 los botones de duplicar y borrar vivían DENTRO del <a>
  // de la tarjeta, que no es HTML válido, y se apañaba con
  // preventDefault. Ahora el enlace cubre portada y cuerpo, y el pie
  // queda fuera.
  const { page } = await abrir()
  await abrirGrupo(page, 'Terminad')
  const dentro = await page.evaluate(() =>
    document.querySelectorAll('.torneo-tarjeta-enlace button, .torneo-tarjeta-enlace a').length)
  check('ningún botón ni enlace dentro del enlace de la tarjeta', dentro === 0, String(dentro))
  check('y «Duplicar» sigue estando, en el pie',
    (await page.locator('.torneo-pie .torneo-duplicar').count()) === 1)
  await page.close()
}

console.log('\n── 8. La rejilla y las chips ──')
{
  check('la lista es una rejilla', /\.torneos-lista \{[^}]*display: grid/.test(CSS))
  check('  …con un mínimo por tarjeta', /minmax\(330px, 1fr\)/.test(CSS))
  // Sin esto, las pestañas se colocarían como si fueran una tarjeta más.
  check('  …y las pestañas la cruzan entera', /\.torneos-lista > \.torneo-pestanas[\s\S]{0,80}grid-column: 1 \/ -1/.test(CSS))
  // Las de la FICHA se quedan como estaban: allí son navegación, no
  // filtros. Por eso el estilo de chip va en una clase aparte.
  check('las chips son de la lista, no de la ficha', /\.torneo-pestanas-chips/.test(CSS) && JS_LISTA.includes('torneo-pestanas torneo-pestanas-chips'))
  // Y el bloque de chips va DESPUÉS de la regla base: las dos son de una
  // sola clase, así que a igualdad de especificidad manda la última. Con
  // el bloque arriba, el `border-bottom: none` se lo comía la regla de
  // siempre y bajo los filtros seguía saliendo el subrayado.
  check('  …y pisan a la regla base, no al revés',
    CSS.indexOf('\n.torneo-pestanas {') < CSS.indexOf('.torneo-pestanas-chips {'))
  const { page } = await abrir()
  // Ojo con el selector: el PRIMER .torneo-pestanas de la página es el
  // conmutador Lista/Calendario, que sí lleva su subrayado. Los filtros
  // son los que llevan además la clase de chips.
  const subrayados = await page.evaluate(() => ({
    filtros: parseFloat(getComputedStyle(document.querySelector('.torneo-pestanas-chips')).borderBottomWidth),
    conmutador: parseFloat(getComputedStyle(document.querySelector('.torneo-vista-conmutador')).borderBottomWidth),
  }))
  check('  …así que los filtros no llevan subrayado debajo', subrayados.filtros === 0, JSON.stringify(subrayados))
  check('  …y el conmutador Lista/Calendario sí conserva el suyo', subrayados.conmutador >= 2, JSON.stringify(subrayados))
  const cuantas = await page.evaluate(() => getComputedStyle(document.querySelector('.torneos-lista')).gridTemplateColumns.split(' ').length)
  check('a 1280 px caben tres columnas', cuantas === 3, String(cuantas))
  // En un móvil estrecho lo que importa no es cuántas columnas hay —una,
  // seguro— sino que la tarjeta NO se salga: con `minmax(330px, 1fr)` y
  // un contenedor de 290 px, la rejilla mantiene la pista en 330 y la
  // página se va de lado. Por eso la media query fija `1fr`, y por eso
  // se mide el desbordamiento y no el número de columnas.
  const estrecho = await abrir({ ancho: 320 })
  const desborde = await estrecho.page.evaluate(() => {
    const l = document.querySelector('.torneos-lista')
    return { lista: l.scrollWidth - l.clientWidth, pagina: document.documentElement.scrollWidth - document.documentElement.clientWidth }
  })
  check('a 320 px la rejilla no se sale', desborde.lista <= 1, JSON.stringify(desborde))
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
    const n = document.querySelector('.torneo-pestanas')
    if (!n) return null
    const b = n.querySelector('.torneo-pestana')
    const e = getComputedStyle(n)
    return { anchoDelSubrayado: parseFloat(e.borderBottomWidth), radioDeLaPestana: b ? getComputedStyle(b).borderRadius : '' }
  })
  check('la ficha sigue teniendo sus pestañas', nav !== null)
  check('  …con el subrayado de siempre', (nav?.anchoDelSubrayado || 0) >= 2, JSON.stringify(nav))
  check('  …y no convertidas en píldoras', !/999px/.test(nav?.radioDeLaPestana || ''), JSON.stringify(nav))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
