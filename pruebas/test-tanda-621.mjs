// Tanda 621 — el laboratorio con su propia puerta: /laboratorio.
//
// PINGU: «estaría bien hacerle un apartado al laboratorio en el menú y que
// no solo se acceda desde el constructor de mazos». Una página donde se
// elige CON QUÉ mazo —uno guardado, el que está a medias en el constructor,
// una lista pegada o uno del meta— y el laboratorio se abre encima: al
// cerrarlo se vuelve a /laboratorio, no al constructor.
//
// Lo que se prueba:
//   1. El menú de TODAS las páginas lleva «Laboratorio» (arriba y en el
//      móvil), /colabora ya no tiene la barra vieja, y el sitemap lo lista.
//   2. Sin cuenta: entrar (con vuelta a /laboratorio) y el mazo a medias
//      del constructor, que se puede probar.
//   3. Con cuenta: tus mazos; «Probar» abre el laboratorio con ESE mazo y
//      cerrarlo deja en /laboratorio; uno vacío avisa, no abre.
//   4. Una lista pegada: abre, y dice qué línea no ha encontrado.
//   5. /laboratorio?mazo=<id> abre ese mazo, y «Mis mazos» manda ahí.
//   6. Si tus mazos no se pueden leer, se dice (y se reintenta), no «no
//      tienes ninguno».
//   7. Los del meta: cada uno a su ficha, con su porcentaje en español, y
//      sin «otros» (lo que no es ningún mazo).
import { readFileSync, readdirSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const { plano } = await import(`${RAIZ}/js/constructor/nucleo.js`)
const FILAS = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
const fila = (n) => {
  const f = FILAS.find((x) => x.name === n)
  if (!f) throw new Error(`falta ${n} en la ficha de pruebas`)
  return f
}
const LISTA = [
  [4, 'Dreepy'], [4, 'Drakloak'], [3, 'Dragapult ex'], [2, 'Budew'], [1, 'Fezandipiti ex'], [1, 'Meowth ex'], [2, 'Munkidori'], [1, 'Moltres'],
  [4, 'Buddy-Buddy Poffin'], [4, 'Poké Pad'], [4, "Lillie's Determination"], [3, "Boss's Orders"], [3, 'Night Stretcher'], [3, 'Ultra Ball'],
  [4, 'Crushing Hammer'], [2, 'Crispin'], [2, 'Risky Ruins'], [1, 'Dawn'], [1, 'Judge'], [1, "Rosa's Encouragement"], [1, 'Special Red Card'], [1, 'Unfair Stamp'],
  [3, 'Fire Energy'], [3, 'Psychic Energy'], [2, 'Darkness Energy'],
]
const entradas = LISTA.map(([n, nombre]) => ({ carta: fila(nombre), n }))
const cartas = [...new Map(entradas.map((e) => [e.carta.id, { ...e.carta, market: 'WEST', name_key: plano(e.carta.name), image_path: null }])).values()]
const sets = [...new Set(cartas.map((c) => c.set_id))].map((id) => ({ id, name: id.toUpperCase(), market: 'WEST', tcg_online_code: id.toUpperCase(), release_date: '2025-01-01', card_count_official: 200 }))
const cards = entradas.map((e) => ({ id: e.carta.id, n: e.n }))
const MAZOS = [
  { id: 'mazo-1', user_id: 'user-1', name: 'Dragapult del martes', cards },
  { id: 'mazo-2', user_id: 'user-1', name: 'A medio montar', cards: cards.slice(0, 2) },
]

console.log('\n── 1. En el menú de todas las páginas ──')
{
  const paginas = readdirSync(RAIZ).filter((f) => f.endsWith('.html'))
  const conBarra = paginas.filter((p) => /<nav class="navbar"/.test(leer(p)))
  const sin = conBarra.filter((p) => {
    const nav = leer(p).split('<nav class="navbar"')[1].split('</nav>')[0]
    return (nav.match(/<a href="\/laboratorio">Laboratorio<\/a>/g) || []).length !== 2
  })
  check(`las ${conBarra.length} páginas con barra llevan «Laboratorio» arriba y en el menú del móvil`, conBarra.length > 30 && sin.length === 0, sin.join(', '))
  const viejas = conBarra.filter((p) => !/class="nav-grupo-btn"/.test(leer(p)))
  check('  …y ninguna conserva la barra vieja sin grupos (lo era /colabora)', viejas.length === 0, viejas.join(', '))
  check('el sitemap lista /laboratorio', /\['\/laboratorio'/.test(leer('netlify/functions/sitemap.mjs')))
  const h = leer('laboratorio.html')
  check('la página tiene su descripción y su canónica', /<meta name="description" content="[^"]{60,}"/.test(h) && /<link rel="canonical" href="https:\/\/pokedoc\.es\/laboratorio"/.test(h))
  check('  …y carga la hoja del laboratorio (lo que se abre encima)', /href="\/css\/laboratorio\.css"/.test(h) && /href="\/css\/laboratorio-pagina\.css"/.test(h))
  check('«Mis mazos» tiene «Probar», que manda aquí', /href="\/laboratorio\?mazo=\$\{escapeHtml\(m\.id\)\}">Probar<\/a>/.test(leer('js/mazos.js')))
}

const browser = await chromium.launch()
async function abrir({ sesion = 'user-1', mazos = MAZOS, borrador = null, url = '/laboratorio', fallarMazos = false, ancho = 1280, meta = null } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.abort())
  await page.addInitScript(({ cartas, sets, sesion, mazos, borrador, fallarMazos, meta }) => {
    if (meta) window.__RPC_RESPUESTAS__ = { meta_resumen: meta }
    window.__FAKE_SESSION__ = sesion
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_MAZOS__ = mazos
    if (fallarMazos) window.__SIN_TABLAS__ = ['user_decks']
    if (borrador) localStorage.setItem('pokedoc-constructor-borrador', JSON.stringify(borrador))
  }, { cartas, sets, sesion, mazos, borrador, fallarMazos, meta })
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  return { page, errores }
}
const labAbierto = (page) => page.waitForSelector('.lab:not([hidden]) .lab-mesa', { timeout: 8000 }).then(() => true).catch(() => false)

console.log('\n── 2. Sin cuenta ──')
{
  const { page, errores } = await abrir({ sesion: 'none', borrador: { id: null, nombre: 'Lo de anoche', cartas: cards, cambiado: true, cuando: Date.now() } })
  check('h1 «Laboratorio»', (await page.locator('h1').innerText()).trim() === 'Laboratorio')
  const entrar = await page.locator('#lpMios a', { hasText: 'Entrar' }).getAttribute('href')
  check('se puede entrar, y volver aquí', entrar === '/auth.html?volver=%2Flaboratorio', entrar)
  check('el mazo a medias del constructor sale, con su nombre y sus 60', /Lo de anoche/.test(await page.locator('#lpMios').innerText()) && /60\/60/.test(await page.locator('#lpMios').innerText()))
  await page.click('[data-probar="borrador"]')
  check('  …y «Probar» lo abre en el laboratorio', (await labAbierto(page)) && (await page.locator('#labNombre').innerText()) === 'Lo de anoche', await page.locator('#labNombre').innerText().catch(() => ''))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 3. Con cuenta: tus mazos ──')
{
  const { page, errores } = await abrir()
  const texto = await page.locator('#lpMios').innerText()
  check('salen tus mazos, con lo que llevan', /Dragapult del martes/.test(texto) && /60\/60/.test(texto) && /A medio montar/.test(texto), texto)
  check('  …y «Editar» lleva al constructor', (await page.locator('#lpMios a', { hasText: 'Editar' }).first().getAttribute('href')) === '/constructor?mazo=mazo-1')
  await page.click('[data-probar="mazo-2"]')
  await page.waitForTimeout(400)
  check('uno con menos de 13 cartas avisa y no abre', !(await page.locator('.lab:not([hidden])').count()) && /al menos 13 cartas/.test(await page.locator('.toast').last().innerText().catch(() => '')))
  await page.click('[data-probar="mazo-1"]')
  check('«Probar» abre el laboratorio con ESE mazo', (await labAbierto(page)) && (await page.locator('#labNombre').innerText()) === 'Dragapult del martes')
  await page.click('[data-accion="cerrar"]')
  await page.waitForTimeout(300)
  check('  …y al cerrarlo sigues en /laboratorio', new URL(page.url()).pathname === '/laboratorio' && (await page.locator('h1').first().isVisible()), page.url())
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 4. Una lista pegada ──')
{
  const { page, errores } = await abrir({ sesion: 'none' })
  const lineas = LISTA.map(([n, nombre]) => {
    const c = fila(nombre)
    return `${n} ${nombre} ${c.set_id.toUpperCase()} ${c.local_id}`
  })
  await page.fill('#lpLista', [...lineas, '2 Carta Que No Existe XYZ 999'].join('\n'))
  await page.click('#lpProbarLista')
  check('abre el laboratorio con la lista', (await labAbierto(page)) && (await page.locator('#labNombre').innerText()) === 'Lista pegada')
  await page.click('[data-accion="cerrar"]')
  await page.waitForTimeout(200)
  check('  …y dice la línea que no ha encontrado', /Carta Que No Existe XYZ 999/.test(await page.locator('#lpResultado').innerText()))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 5. Un mazo por la dirección ──')
{
  const { page, errores } = await abrir({ url: '/laboratorio?mazo=mazo-1' })
  check('/laboratorio?mazo=… lo abre nada más llegar', (await labAbierto(page)) && (await page.locator('#labNombre').innerText()) === 'Dragapult del martes')
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 6. Si tus mazos no se pueden leer ──')
{
  const { page } = await abrir({ fallarMazos: true })
  const texto = await page.locator('#lpMios').innerText()
  check('se dice que no se han podido cargar, no que no tienes', /No se han podido cargar tus mazos/.test(texto) && !/Todavía no tienes/.test(texto), texto)
  check('  …y se puede reintentar', (await page.locator('#lpMios [data-reintentar]').count()) === 1)
  await page.close()
}

console.log('\n── 7. Los del meta ──')
{
  const meta = [
    { arquetipo: 'dragapult-ex', nombre: 'Dragapult ex', iconos: [], mazos: 120, cuota: 12.34 },
    { arquetipo: 'other', nombre: 'Otros', iconos: [], mazos: 80, cuota: 8.1 },
    { arquetipo: 'gardevoir-ex', nombre: 'Gardevoir ex', iconos: [], mazos: 90, cuota: 9.5 },
  ]
  const { page, errores } = await abrir({ sesion: 'none', meta })
  const enlaces = await page.$$eval('#lpMeta a', (as) => as.map((a) => [a.getAttribute('href'), a.textContent.replace(/\s+/g, ' ').trim()]))
  check('cada mazo del meta lleva a su ficha', enlaces.length === 2 && enlaces[0][0] === '/meta/dragapult-ex' && enlaces[1][0] === '/meta/gardevoir-ex', JSON.stringify(enlaces))
  check('  …con su porcentaje en español', /Dragapult ex 12,3 %/.test(enlaces[0]?.[1] || ''), enlaces[0]?.[1])
  check('  …y sin «otros»', !enlaces.some(([h]) => /other/.test(h)))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} fallos.` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
