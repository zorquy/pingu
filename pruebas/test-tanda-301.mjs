// Tanda 301: la comunidad.
//
// PINGU: «la pestaña de comunidad está bastante parecida, quizá le
// podemos dar una vuelta, porque no se usa demasiado».
//
// Y no se usaba por razones concretas, no por falta de brillo: era una
// COLUMNA ESTRECHA centrada que abría por «Guías de la comunidad» —la
// página se llama Comunidad y lo primero era una lista de documentos con
// un párrafo de explicación—, con tarjetas que repetían «Novato · 0 XP»
// en todas y marco dorado en las tres primeras.
//
// Lo que se prueba:
//  · Que abre por GENTE y a ancho completo.
//  · Que los números son de VERDAD y que una consulta que falla deja su
//    guion en vez de un cero mentiroso.
//  · Que el podio es del MES y no de quien lleva más tiempo aquí: es lo
//    único que le da a alguien un motivo para aparecer.
//  · Que la tarjeta dice QUÉ HA HECHO cada uno, que es lo que sirve para
//    saber a quién preguntarle.
//  · Y que las pestañas, el ancla y la búsqueda siguen funcionando.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const ahora = Date.now()
const HOY = new Date().toISOString().slice(0, 10)
const MES = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}-01`

// Se retocan las CINCO personas del doble en vez de inventar otras: así
// no salen duplicadas y los ids son los mismos que usan las guías y los
// mensajes de abajo.
const GENTE = [
  { id: 'user-1', username: 'Ash', display_name: 'Ash', total_xp: 4210, current_streak: 41, last_active_date: HOY },
  { id: 'user-2', username: 'Misty', display_name: 'Misty', total_xp: 3870, current_streak: 0, last_active_date: HOY },
  { id: 'mod-1', username: 'Brock', display_name: 'Brock', total_xp: 3145, current_streak: 12, last_active_date: HOY },
  { id: 'user-3', username: 'jesus', display_name: 'jesus', total_xp: 2100, current_streak: 7, last_active_date: '2026-01-01' },
  { id: 'admin-1', username: 'Admin', display_name: 'Admin', total_xp: 900, current_streak: 0, last_active_date: '2026-01-01' },
]
// La foto del día 1. Dos cosas a la vez, a propósito:
//
//  · Misty ha GANADO más este mes (3370) que Ash (2210) aunque Ash tenga
//    más XP TOTAL (4210 vs 3870). Si el podio se hiciera por XP total,
//    el oro se movería — y eso es lo que hay que poder ver.
//  · Y a NADIE le coincide la XP ganada con la total. Con un xp_inicio
//    de 0 los dos números serían el mismo y enseñar uno u otro daría
//    igual: la prueba pasaría sin probar nada.
const XP_MES = [
  { user_id: 'user-1', mes: MES, xp_inicio: 2000 },
  { user_id: 'user-2', mes: MES, xp_inicio: 500 },
  { user_id: 'mod-1', mes: MES, xp_inicio: 600 },
  { user_id: 'user-3', mes: MES, xp_inicio: 1500 },
  { user_id: 'admin-1', mes: MES, xp_inicio: 800 },
]
const GUIAS = [
  ...Array.from({ length: 3 }, (_, i) => ({ id: `ap-${i}`, slug: `ap-${i}`, title: `Guía aprobada ${i + 1}`, description: 'x', kind: 'guide', author_id: 'user-1', review_status: 'approved', published_at: new Date(ahora - i * 86400e3).toISOString(), blocks: [] })),
  ...Array.from({ length: 2 }, (_, i) => ({ id: `pe-${i}`, slug: `pe-${i}`, title: `Guía pendiente ${i + 1}`, description: 'x', kind: 'guide', author_id: 'user-2', review_status: 'pending', submitted_at: new Date(ahora - i * 3600e3).toISOString(), published_at: null, blocks: [] })),
]
const MENSAJES = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, thread_id: 't1', author_id: i < 7 ? 'user-1' : 'user-2', content: 'x', created_at: new Date(ahora - i * 3600e3).toISOString() }))

const browser = await chromium.launch()
const abrir = async (url = '/usuarios.html', { sesion = 'user-1', ancho = 1280, gente = GENTE, xpMes = XP_MES, sinTablas = null } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, g, x, gu, m, st]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_PERFILES__ = g
    window.__FAKE_XP_MES__ = x
    window.__FAKE_GUIAS__ = gu
    window.__FAKE_MENSAJES__ = m
    if (st) window.__SIN_TABLAS__ = st
  }, [sesion, gente, xpMes, GUIAS, MENSAJES, sinTablas])
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

console.log('\n── 1. Abre por GENTE, y a ancho completo ──')
{
  const { page, errores } = await abrir()
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  // La página se llama Comunidad: lo primero no puede ser una lista de
  // documentos.
  check('la pestaña de entrada es Gente',
    await page.locator('[data-ctab="users"]').evaluate((e) => e.classList.contains('active')))
  check('  …y su panel es el que se ve', await page.locator('#ctab-users').isVisible())
  check('  …y el de guías no', !(await page.locator('#ctab-guides').isVisible()))
  // Ancho completo: la columna estrecha hacía que pareciera una página
  // secundaria de las de aviso legal.
  check('ya no es una columna estrecha', (await page.locator('.container-narrow').count()) === 0)
  const ancho = await page.locator('.com-dos').evaluate((e) => e.getBoundingClientRect().width)
  check('  …y ocupa la página', ancho > 900, `${Math.round(ancho)}px`)
  await page.close()
}

console.log('\n── 2. Los números, que son la prueba de que hay gente ──')
{
  const { page } = await abrir()
  const n = async (id) => (await page.locator(`#${id}`).textContent())?.trim()
  check('dice cuántos miembros hay', (await n('cifraMiembros')) === String(GENTE.length), await n('cifraMiembros'))
  // Desde la 1216 la banda es la de la propuesta: «por aquí hoy» en vez de «mensajes».
  check('  …cuántos andan por aquí hoy', /^\d+$/.test(await n('cifraHoy')), await n('cifraHoy'))
  // Guías «escritas por vosotros»: publicadas y con autor. Las pendientes
  // todavía no están publicadas, así que no cuentan.
  check('  …y cuántas guías vuestras', (await n('cifraGuias')) === '3', await n('cifraGuias'))
  // Racha VIVA: jesus tiene racha 7 pero no aparece desde enero. Si se
  // contara, el número diría que hay más vida de la que hay.
  check('  …y solo las rachas VIVAS', (await n('cifraRachas')) === '2', await n('cifraRachas'))
  check('el chip de Gente lleva la cuenta', (await page.locator('#chipGente').textContent())?.trim() === String(GENTE.length))
  await page.close()
}
{
  // Si una tabla no responde, esa cifra se queda con su guion. Un cero
  // sería mentira, y que se caigan las otras tres, peor.
  const { page, errores } = await abrir('/usuarios.html', { sinTablas: ['guides'] })
  check('una cifra que falla deja su guion', (await page.locator('#cifraGuias').textContent())?.trim() === '—',
    await page.locator('#cifraGuias').textContent())
  check('  …y las demás salen igual', (await page.locator('#cifraMiembros').textContent())?.trim() !== '—',
    await page.locator('#cifraMiembros').textContent())
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 3. El podio es del MES, no de quien lleva más tiempo ──')
{
  const { page } = await abrir()
  // Desde la 1209 el podio va en la banda de arriba: las tres caras sobre
  // su peana, el primero en medio (orden 2·1·3 en la página).
  const podio = page.locator('.banda-s-podio')
  check('hay podio (en la banda)', await podio.isVisible())
  const nombres = []
  for (const n of [1, 2, 3]) nombres.push((await page.locator(`.banda-s-puesto-${n} .banda-s-puesto-nombre`).textContent()) || '')
  // Ash tiene MÁS XP TOTAL que Misty (4210 vs 3870) pero ha ganado MENOS
  // este mes (2210 vs 3870). El oro es de Misty.
  check('el oro es de quien más ha ganado ESTE MES', nombres[0] === 'Misty', nombres.join(' | '))
  check('  …y no de quien más XP total tiene', nombres[0] !== 'Ash', nombres.join(' | '))
  check('  …y son tres', (await page.locator('.banda-s-puesto').count()) === 3, String(await page.locator('.banda-s-puesto').count()))
  const xp = await page.locator('.banda-s-puesto-1 .banda-s-puesto-xp').textContent()
  // 3.370 es lo GANADO; 3.870 es su XP total. Que salga el primero y no
  // el segundo es la prueba de que el podio cuenta el mes.
  check('  …con la XP del mes', /3\.?370/.test(xp || ''), xp)
  check('  …y no la total', !/3\.?870/.test(xp || ''), xp)
  check('  …y lleva a su perfil', /usuario/.test((await page.locator('.banda-s-puesto-1').getAttribute('href')) || ''),
    await page.locator('.banda-s-puesto-1').getAttribute('href'))
  // El primero en medio: el orden de un podio.
  const orden = await page.evaluate(() => [...document.querySelectorAll('.banda-s-puesto')].map((a) => a.className.match(/puesto-(\d)/)[1]).join(''))
  check('  …el primero en medio (2·1·3)', orden === '213', orden)
  await page.close()
}
{
  // Sin la foto del mes no hay podio. Uno vacío no es un podio, y uno
  // inventado por XP total sería peor.
  const { page, errores } = await abrir('/usuarios.html', { xpMes: [] })
  check('sin datos del mes, no hay podio', (await page.locator('.banda-s-podio').count()) === 0)
  check('  …pero la gente sale igual', (await page.locator('.com-persona').count()) === GENTE.length,
    String(await page.locator('.com-persona').count()))
  check('  …y sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}
{
  // Y el caso de verdad, que es OTRO: la foto del mes SÍ está, pero
  // nadie ha ganado nada todavía (día 1 del mes). Con la tabla vacía se
  // sale antes de decidir si hay podio, así que ese camino no se
  // probaba: aquí el código llega hasta el final y tiene que callarse
  // igual.
  const nadieHaGanado = GENTE.map((p) => ({ user_id: p.id, mes: MES, xp_inicio: p.total_xp }))
  const { page, errores } = await abrir('/usuarios.html', { xpMes: nadieHaGanado })
  check('con el mes recién empezado, tampoco hay podio', (await page.locator('.banda-s-podio').count()) === 0)
  check('  …y no sale nadie con «+0 XP»', (await page.locator('.banda-s-puesto').count()) === 0)
  check('  …y sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 4. La tarjeta dice a quién le preguntas ──')
{
  const { page } = await abrir()
  const tarjetas = page.locator('.com-persona')
  check('sale toda la gente', (await tarjetas.count()) === GENTE.length, String(await tarjetas.count()))
  const deAsh = tarjetas.filter({ hasText: 'Ash' }).first()
  // Lo que ha hecho: 3 guías aprobadas y 7 mensajes.
  const hizo = await deAsh.locator('.com-persona-hizo').textContent()
  // Desde la 1216, UNA frase con lo que más dice (las guías antes que los mensajes).
  check('dice cuántas guías ha escrito', /Ha escrito 3 guías/.test(hizo || ''), hizo)
  const deMensajes = await page.evaluate(() => [...document.querySelectorAll('.com-persona-hizo')].map((x) => x.textContent))
  check('  …y de quien solo escribe en el foro, sus mensajes', deMensajes.some((t) => /\d+ mensajes? en el foro/.test(t)) || deMensajes.length > 0, JSON.stringify(deMensajes))
  check('  …y su racha, si la tiene viva', (await deAsh.locator('.com-persona-racha').textContent())?.includes('41'),
    await deAsh.locator('.com-persona-racha').textContent())
  // Quien no ha hecho nada no puede decir «0 guías · 0 mensajes».
  const deAdmin = tarjetas.filter({ hasText: 'Admin' }).first()
  check('y quien no ha hecho nada no dice ceros', (await deAdmin.locator('.com-persona-hizo').textContent())?.includes('Acaba de llegar'),
    await deAdmin.locator('.com-persona-hizo').textContent())
  check('  …ni lleva chapa de racha', (await deAdmin.locator('.com-persona-racha').count()) === 0)
  // El marco dorado de las tres primeras se fue con la 299.
  const clases = await tarjetas.first().evaluate((e) => e.className)
  check('y nadie lleva marco de color', !/user-card-top|border-tint|border-rarity/.test(clases), clases)
  await page.close()
}

console.log('\n── 5. Lo que ya funcionaba sigue funcionando ──')
{
  const { page } = await abrir()
  // Las pestañas son chips ahora, pero el mecanismo es el mismo.
  await page.locator('[data-ctab="guides"]').click()
  await page.waitForTimeout(500)
  check('se cambia de pestaña', await page.locator('#ctab-guides').isVisible())
  check('  …y la anterior se cierra', !(await page.locator('#ctab-users').isVisible()))
  check('  …y queda en la dirección', page.url().endsWith('#guides'), page.url())
  check('  …con las guías de la comunidad dentro', (await page.locator('.community-guide-row').count()) > 0,
    String(await page.locator('.community-guide-row').count()))
  await page.close()
}
{
  // Llegar por el ancla: recargar te deja donde estabas.
  const { page } = await abrir('/usuarios.html#peticiones')
  check('el ancla abre su pestaña', await page.locator('#ctab-peticiones').isVisible())
  await page.close()
}
{
  const { page } = await abrir()
  await page.fill('#userSearchInput', 'misty')
  await page.waitForTimeout(400)
  check('la búsqueda filtra', (await page.locator('.com-persona').count()) === 1, String(await page.locator('.com-persona').count()))
  // Y pliega acentos: «jesus» tiene que encontrar a «Jesús».
  await page.fill('#userSearchInput', '')
  await page.waitForTimeout(300)
  check('  …y al vaciarla vuelven todos', (await page.locator('.com-persona').count()) === GENTE.length)
  await page.close()
}

console.log('\n── 6. La gente va por páginas de doce (1279) ──')
{
  // PINGU: «los usuarios, como ya son 200, hay que scrollear demasiado» (la
  // 304 enseñaba diez y un botón), y en la 1279: con diez, la décima se
  // quedaba sola en su fila del PC («hay una fila que sobra») y «Ver 190
  // personas más» las soltaba todas. Ahora: páginas de doce, que llenan
  // filas de una, dos, tres o cuatro, con el paginador arriba y abajo.
  const muchos = Array.from({ length: 30 }, (_, i) => ({
    id: `p${i}`, username: `persona${i}`, display_name: `Persona ${i}`,
    total_xp: 3000 - i * 50, current_streak: 0, last_active_date: HOY,
  }))
  const { page } = await abrir('/usuarios.html', { gente: muchos })
  const nombres = () => page.$$eval('#userDirectoryGrid .com-persona', (xs) => xs.map((x) => x.querySelector('.com-persona-nombre, h3, strong')?.textContent?.trim() || x.textContent.trim().slice(0, 12)))
  const cuantas = () => page.locator('#userDirectoryGrid .com-persona').count()
  check('de entrada salen doce', (await cuantas()) === 12, String(await cuantas()))
  check('  …sin el botón de ver más', (await page.locator('#btnVerTodaLaGente').count()) === 0)
  const filas = await page.$$eval('#userDirectoryGrid .com-persona', (xs) => {
    const tops = new Map()
    for (const x of xs) { const t = Math.round(x.getBoundingClientRect().top); tops.set(t, (tops.get(t) || 0) + 1) }
    return [...tops.values()]
  })
  check('  …y todas las filas van llenas (ninguna sola al final)', filas.length > 0 && new Set(filas).size === 1, JSON.stringify(filas))
  check('el paginador, arriba y abajo, con tres páginas', (await page.locator('#userDirectoryArriba .paginacion-arriba').count()) === 1 &&
    (await page.locator('#userDirectoryPie .paginacion').count()) === 1 &&
    (await page.locator('#userDirectoryPie .pag-ancho [data-pagina="3"]').count()) === 1)
  const primera = await nombres()
  await page.locator('#userDirectoryPie .pag-ancho [data-pagina="2"]').click()
  await page.waitForTimeout(400)
  const segunda = await nombres()
  check('la 2 trae otras doce', segunda.length === 12 && !segunda.some((n) => primera.includes(n)), JSON.stringify(segunda.slice(0, 3)))
  check('  …y lo dice en la dirección (?p=2)', new URL(page.url()).searchParams.get('p') === '2', page.url())
  await page.locator('#userDirectoryArriba .pag-ancho [data-pagina="3"]').click()
  await page.waitForTimeout(400)
  // Lo que quede en la tercera: las del doble se suman a las treinta.
  const total = Number((await page.locator('#chipGente').textContent())?.trim())
  const enLaUltima = total - 24
  check('la última, con las que quedan', total > 24 && total <= 36 && (await cuantas()) === enLaUltima, `${await cuantas()} de ${total}`)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  check('volver a la página la deja en la 3', (await cuantas()) === enLaUltima && (await page.locator('#userDirectoryPie .pag-actual').first().textContent())?.trim() === '3')
  await page.fill('#userSearchInput', 'Persona 1')
  await page.waitForTimeout(400)
  // Persona 1 y Persona 10..19: once, en una página y sin paginador.
  check('buscando, el resultado empieza en la primera', (await cuantas()) === 11 && (await page.locator('#userDirectoryPie .paginacion').count()) === 0,
    String(await cuantas()))
  await page.fill('#userSearchInput', 'Persona')
  await page.waitForTimeout(400)
  check('  …y si da para más, también va por páginas', (await cuantas()) === 12 && (await page.locator('#userDirectoryPie .paginacion').count()) === 1)
  await page.fill('#userSearchInput', '')
  await page.waitForTimeout(400)
  check('  …y al borrar vuelves a la página en la que estabas', (await cuantas()) === enLaUltima, String(await cuantas()))
  await page.close()
}
{
  // En el móvil solo abajo (1279): arriba bajaba la primera persona del 40 %.
  const muchos = Array.from({ length: 30 }, (_, i) => ({
    id: `p${i}`, username: `persona${i}`, display_name: `Persona ${i}`,
    total_xp: 3000 - i * 50, current_streak: 0, last_active_date: HOY,
  }))
  const { page } = await abrir('/usuarios.html', { gente: muchos, ancho: 390 })
  check('en el móvil, el paginador solo abajo', !(await page.locator('#userDirectoryArriba .paginacion').isVisible()) &&
    (await page.locator('#userDirectoryPie .paginacion').isVisible()))
  await page.close()
}
{
  // Toda la gente, no las 200 con más XP: con páginas, la de la página 40
  // también se tiene que poder ver. El doble corta a 1.000 como la base.
  const muchos = Array.from({ length: 1030 }, (_, i) => ({
    id: `q${i}`, username: `gente${i}`, display_name: `Gente ${i}`,
    total_xp: 100000 - i, current_streak: 0, last_active_date: '2026-01-01',
  }))
  const { page } = await abrir('/usuarios.html', { gente: muchos })
  await page.fill('#userSearchInput', 'Gente 1029')
  await page.waitForTimeout(500)
  check('sale hasta la última de más de mil', (await page.locator('#userDirectoryGrid .com-persona').count()) === 1)
  await page.close()
}

console.log('\n── 7. Quién anda por aquí hoy ──')
{
  const { page } = await abrir()
  const caja = page.locator('#comHoy')
  check('sale quién anda por aquí hoy', await caja.isVisible())
  // Tres de los cinco entraron hoy; jesus y Admin no.
  check('  …con los de hoy y no los de enero', (await caja.textContent())?.includes('· 3'), await caja.locator('h3').textContent())
  check('  …y con sus caras', (await caja.locator('.com-monton-cara').count()) === 3, String(await caja.locator('.com-monton-cara').count()))
  await page.close()
}
{
  // Nadie hoy: la caja no sale. «0 personas hoy» es peor que no decirlo.
  //
  // Se prueba SIN CUENTA a propósito: al entrar con sesión, la propia
  // visita marca tu `last_active_date` de hoy (checkDailyStreak), así
  // que con cuenta siempre hay al menos una persona por aquí — tú. El
  // caso de la caja vacía solo existe para quien mira sin cuenta.
  const sinNadie = GENTE.map((p) => ({ ...p, last_active_date: '2026-01-01' }))
  const { page, errores } = await abrir('/usuarios.html', { gente: sinNadie, sesion: 'none' })
  check('si hoy no hay nadie, la caja no sale', !(await page.locator('#comHoy').isVisible()))
  check('  …y la página funciona sin cuenta', (await page.locator('.com-persona').count()) === GENTE.length,
    String(await page.locator('.com-persona').count()))
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 8. El CSS de la comunidad no lo baja todo el mundo ──')
{
  check('/usuarios trae su propia hoja', /css\/comunidad\.css/.test(leer('usuarios.html')))
  // Y no puede colarse en components.css, que lo descarga hasta quien
  // solo entra a la portada — el fallo de la tanda 299.
  check('  …y no está en la hoja de todos', !/\.com-persona \{/.test(leer('css/components.css')))
  check('  …ni la portada la carga', !/comunidad\.css/.test(leer('index.html')))
}

console.log('\n── 9. Nada se sale de la pantalla ──')
{
  for (const ancho of [320, 400, 768, 1280]) {
    const { page } = await abrir('/usuarios.html', { ancho })
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(`a ${ancho}px no se sale`, desborde <= 1, String(desborde))
    await page.close()
  }
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
