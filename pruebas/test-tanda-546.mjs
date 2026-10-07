// Tanda 546 — la biblioteca seguía en kanji, y el filtro de eras se quedaba
// con las del catálogo anterior.
//
// PINGU: «¿y los nombres en inglés qué? siguen saliendo los kanjis… y lo
// del filtro está fatal, debería cambiar al escoger otro idioma, porque se
// mantiene con el español/inglés y al cambiar a japo el filtro está mal».
//
// Las dos cosas tenían la misma forma: algo escrito DOS VECES, con una sola
// copia enterada.
//
//   1. `nombreDeCarta` —la única puerta por la que sale un nombre a la
//      pantalla— vivía en `js/carta-nucleo.js`, que arrastra media web. Así
//      que /mi-coleccion no lo importaba: tenía su propio `nombreDe` de una
//      línea… y otro en `albumes.js`, y otro en `pokedex.js`, y otro en
//      `tablon.js`, y otro en `lo-que-falta.js`. CINCO copias, ninguna
//      enterada de que desde la 537 hay un nombre occidental. La 537 y la
//      542 arreglaron la ficha de una carta y la biblioteca entera —que es
//      lo que PINGU mira— siguió en japonés.
//
//   2. El desplegable de eras se montaba con `if (!sel.dataset.montado)`:
//      UNA vez, y nunca más. En el catálogo japonés seguía ofreciendo
//      «Escarlata y Púrpura», que ahí no existe.
//
// Es la lección de la 471 por tercera vez: **no copiar es mejor que una
// copia vigilada**, y para no copiar hay que mudar lo puro a un módulo que
// se pueda importar desde todos lados.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { nombreDeCarta, nombresDeCartaParaBuscar, nombreDeSet } from '/home/user/pingu/js/catalogo-series.js'
import { readFileSync, readdirSync } from 'node:fs'

// Desde la 748 (la C2 de su maqueta) el buscador de la estantería sale con
// la lupa y la serie vive en la hoja de «Orden»: se abren antes de usarlos.
const abrirLupa = async (p) => { if (await p.locator('#mcEstanteriaLupa').isVisible().catch(() => false) && !(await p.locator('#mcEstanteriaBuscar').isVisible())) { await p.click('#mcEstanteriaLupa'); await p.waitForTimeout(150) } }
const abrirOrden = async (p) => { if (!(await p.locator('#mcEstanteriaSerie').isVisible())) { await p.click('#mcEstanteriaOrdenAbrir'); await p.waitForTimeout(250) } }
const cerrarOrden = async (p) => { if (await p.locator('#mcEstanteriaOrden').evaluate((d) => d.open).catch(() => false)) { await p.click('#mcEstanteriaOrdenVer'); await p.waitForTimeout(250) } }


let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. El nombre que se enseña ──')
{
  const jp = { name: 'イーブイ', name_en: 'Eevee' }
  check('una carta japonesa se enseña en occidental', nombreDeCarta(jp) === 'Eevee', nombreDeCarta(jp))
  // Y una occidental NO cambia porque exista `name_en`: eso sería cambiar
  // el catálogo entero por un dato que se trajo para otra cosa.
  check('una occidental no cambia', nombreDeCarta({ name: 'Eevee', name_en: 'Eevee', name_es: 'Eevee' }) === 'Eevee')
  check('el español manda cuando lo hay', nombreDeCarta({ name: 'Boss\'s Orders', name_es: 'Órdenes del Jefe' }) === 'Órdenes del Jefe')
  // El catálogo INGLÉS: el español deja de preferirse, pero el japonés
  // sigue leyéndose en occidental.
  check('  …y en el catálogo inglés, no', nombreDeCarta({ name: 'Boss\'s Orders', name_es: 'Órdenes del Jefe' }, { enEspanol: false }) === 'Boss\'s Orders')
  check('  …pero el japonés sigue en occidental', nombreDeCarta(jp, { enEspanol: false }) === 'Eevee')
  // Si no hay más que el español, se enseña: quedarse en blanco sería
  // peor que enseñar el que hay.
  check('y si solo hay español, ese', nombreDeCarta({ name_es: 'Órdenes del Jefe' }, { enEspanol: false }) === 'Órdenes del Jefe')
  check('sin nada, cadena vacía y no «undefined»', nombreDeCarta({}) === '' && nombreDeCarta(null) === '')
  // Lo que se BUSCA son los tres nombres: se veía «Eevee» en la pantalla y
  // escribir «Eevee» no la encontraba.
  check('se busca por los tres nombres', /イーブイ/.test(nombresDeCartaParaBuscar({ ...jp, name_es: 'Eevee' })) && /Eevee/.test(nombresDeCartaParaBuscar(jp)))
}

console.log('── 2. LA GUARDA: ningún módulo elige el nombre a mano ──')
{
  // Esto es lo que de verdad impide que vuelva a pasar. Cinco copias de
  // «name_es || name» es lo que dejó la biblioteca en kanji, y el barrido
  // de la 299 no mira esto: una copia no es una clase de CSS.
  //
  // Lo que NO es elegir un nombre para la pantalla va declarado uno por
  // uno con su motivo (la norma de la 524).
  const PERMITIDOS = {
    'js/catalogo-series.js': 'es LA puerta: aquí vive la regla',
    'js/carta-detalle.js': 'compara contra los nombres de las energías básicas, no enseña nada',
    'js/carta-mercado.js': 'busca la ESPECIE para el sprite; una especie no se traduce',
    'js/carta-ruta.js': 'monta la DIRECCIÓN de la carta, que es una clave y no un rótulo',
    'js/carta.js': 'mezcla la ficha que llega de TCGdex con la fila, antes de enseñar nada',
    'js/carta-nucleo.js': 'las CLAVES de juego con las que se cruzan las decklists',
    'js/repeticiones.js': 'saca la letra de una energía del nombre, para el registro de la partida',
    'js/constructor/datos.js': 'cruza decklists por la clave inglesa (tandas 334 y 335)',
    'js/constructor/posicion-compartida.js': 'SERIALIZA una posición en un enlace: lleva los dos nombres a propósito, no elige uno',
  }
  const aMano = []
  const barrer = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const ruta = `${dir}/${e.name}`
      if (e.isDirectory()) { barrer(ruta); continue }
      if (!e.name.endsWith('.js')) continue
      const rel = ruta.replace('/home/user/pingu/', '')
      if (PERMITIDOS[rel]) continue
      const fuente = readFileSync(ruta, 'utf8')
      // Sin comentarios: un ejemplo dentro de un porqué no es código (la
      // trampa de la 524).
      const codigo = fuente.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
      if (/name_es\s*(\|\||\?\?)/.test(codigo)) aMano.push(rel)
    }
  }
  barrer('/home/user/pingu/js')
  check('ningún módulo se monta su propio nombre', aMano.length === 0, aMano.join(', '))
  // Y que la guarda LLEGUE: de un barrido que no encuentra nada no se
  // puede decir que no haya nada (la lección de la 307).
  const puerta = readFileSync('/home/user/pingu/js/catalogo-series.js', 'utf8')
  check('  …y el barrido llega: la puerta sí lo tiene', /name_es/.test(puerta))
}

console.log('── 3. Y ninguna consulta se deja `name_en` fuera ──')
{
  // La columna que nadie pide llega `undefined`, y `undefined || otra` es
  // una expresión perfectamente válida: no hay error que mirar, hay una
  // pantalla que dice lo de antes (la lección de la 523).
  const malas = []
  const barrer = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const ruta = `${dir}/${e.name}`
      if (e.isDirectory()) { barrer(ruta); continue }
      if (!e.name.endsWith('.js')) continue
      const fuente = readFileSync(ruta, 'utf8')
      for (const linea of fuente.split('\n')) {
        if (!/select|COLUMNAS|tcg_sets\(/.test(linea)) continue
        if (!/\bname_es\b/.test(linea) || /\bname_en\b/.test(linea)) continue
        // El constructor cruza por la clave inglesa y no enseña nombres.
        if (/constructor/.test(ruta)) continue
        malas.push(`${ruta.replace('/home/user/pingu/', '')}: ${linea.trim().slice(0, 80)}`)
      }
    }
  }
  barrer('/home/user/pingu/js')
  barrer('/home/user/pingu/netlify')
  check('toda lista de columnas que pide `name_es` pide `name_en`', malas.length === 0, malas.join(' | '))
}

console.log('── 3b. Y el buscador de la BASE, que es la otra mitad ──')
{
  // La pantalla ya rotula «Eevee»; si `name_search` no lo lleva, escribir
  // «Eevee» da cero resultados con la carta delante. Es la lección de la
  // 447: una frase de la interfaz es una AFIRMACIÓN sobre lo que hace el
  // código.
  const mig = readFileSync('/home/user/pingu/supabase-migration-cartas-buscar-en.sql', 'utf8')
  const gen = mig.split('add column name_search')[1]?.split('stored')[0] || ''
  for (const col of ['name,', 'name_es,', 'name_en,']) {
    check(`\`name_search\` se genera con ${col.replace(',', '')}`, gen.includes(`coalesce(${col.replace(',', '')}, '')`), gen.replace(/\s+/g, ' ').slice(0, 160))
  }
  // Y `name_key` NO: es la clave con la que se cruzan las decklists y
  // meterle un nombre más la rompe igual que la rompió el español.
  const sinComentarios = mig.replace(/--[^\n]*/g, '')
  check('y `name_key` no se toca', !/name_key/.test(sinComentarios), sinComentarios.match(/[^\n]*name_key[^\n]*/)?.[0] || '')
  // Si la base la genera, el doble la genera (la lección de la 447): un
  // doble que la escribe a mano dice lo que quiera quien escriba el fixture.
  const doble = readFileSync('/tmp/wt-pruebas/herramientas/stub-supabase.js', 'utf8')
  const linea = doble.split('\n').find((l) => /name_search:\s*normalizeSearch/.test(l)) || ''
  check('el doble la genera con los tres', ['name', 'name_es', 'name_en'].every((c) => linea.includes(`fila.${c}`)), linea.trim().slice(0, 140))
}

// ── Y ahora la pantalla, que es donde PINGU lo vio ──
const browser = await chromium.launch()
const SIEMBRA = () => {
  window.__FAKE_SETS__ = [
    { id: 'sv8', name: 'Evolución Mega', serie_id: 'sv', serie_name: 'Escarlata y Púrpura', market: 'WEST', card_count_official: 1, card_count_total: 1, logo_path: 'x/l', release_date: '2026-09-26' },
    // El japonés tal como está en la base: `name` en kanji y el occidental
    // al lado, que es lo que la 532 trajo de Scrydex.
    { id: 'm6a_ja', name: '30th セレブレーション', name_en: '30th Celebration', serie_id: 'mega-evolution', serie_name: null, serie_name_en: 'Mega Evolution', market: 'JP', card_count_official: 1, card_count_total: 1, logo_path: null, release_date: '2026-09-16' },
  ]
  window.__FAKE_CARTAS__ = [
    { id: 'sv8-1', market: 'WEST', set_id: 'sv8', local_id: '1', name: 'Bulbasaur', name_es: 'Bulbasaur', image_path: 'x/1', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } },
    { id: 'm6a_ja-1', market: 'JP', set_id: 'm6a_ja', local_id: '001', name: 'イーブイ', name_en: 'Eevee', image_scrydex: 'https://images.scrydex.com/pokemon/m6a_ja-1-front', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } },
  ]
  window.__FAKE_COLECCION__ = [
    { id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: new Date().toISOString() },
    { id: 'l2', card_id: 'm6a_ja-1', market: 'JP', cantidad: 1, idioma: 'ja', estado: 'NM', variante: 'normal', created_at: new Date().toISOString() },
  ]
}
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
await page.route('**assets.tcgdex.net/**', (r) => r.abort())
await page.route('**images.scrydex.com/**', (r) => r.abort())
await page.route('**limitlesstcg**', (r) => r.abort())
await page.addInitScript(SIEMBRA)
await page.goto(BASE + '/mi-coleccion.html', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)
await page.click('[data-pestania="album"]')
await page.waitForTimeout(1500)

const cambiar = async (id) => {
  await page.locator('.mc-mercado:visible').first().selectOption(id)
  await page.waitForTimeout(2200)
}
const eras = () => page.evaluate(() => {
  const el = document.getElementById('mcEstanteriaSerie')
  return { valor: el?.value, opciones: [...(el?.options || [])].map((o) => o.value) }
})

console.log('── 4. El filtro de eras, al cambiar de catálogo ──')
{
  const a = await eras()
  check('en español ofrece las eras occidentales', a.opciones.includes('sv'), JSON.stringify(a))
  check('  …y NO una era japonesa', !a.opciones.includes('mega-evolution'), JSON.stringify(a))
  // LO QUE PINGU VIO: se elige una era y se cambia de catálogo.
  await abrirOrden(page)
  await page.selectOption('#mcEstanteriaSerie', 'sv')
  await cerrarOrden(page)
  await page.waitForTimeout(900)
  await cambiar('ja')
  const b = await eras()
  check('en japonés ofrece las SUYAS', b.opciones.includes('mega-evolution'), JSON.stringify(b))
  check('  …y ya no las occidentales', !b.opciones.includes('sv'), JSON.stringify(b))
  // Y la otra mitad: la era elegida no sobrevive al cambio. Si sobrevive,
  // la estantería se queda vacía filtrando por una era que ahí no existe
  // mientras el desplegable dice «Todas las series» — dos cosas distintas
  // en pantalla a la vez, y ninguna es la verdad.
  check('la era elegida no sobrevive al cambio', b.valor === '', JSON.stringify(b))
  const cuantas = await page.locator('.mc-set-tarjeta, .mc-set').count()
  check('  …así que la colección japonesa SE VE', cuantas >= 1, String(cuantas))
}

console.log('── 5. Y los nombres, en la pantalla ──')
{
  const texto = await page.locator('#mcEstanteriaRejilla').innerText()
  check('la colección se rotula en occidental', /30th Celebration/.test(texto), texto.slice(0, 200))
  check('  …y no en kanji', !/セレブレーション/.test(texto), texto.slice(0, 200))
  const titulo = await page.locator('.mc-estanteria-titulo').first().innerText()
  // En mayúsculas desde la 748 (el rótulo de era de su maqueta, C2).
  check('y su era también', /Mega Evolution/i.test(titulo), titulo)
}

console.log('── 6. La carta japonesa, por su nombre ──')
{
  // Se abre la colección japonesa desde la estantería. La pestaña «Cartas»
  // ya no existe —la 408 juntó los dos buscadores y la 447 la sacó del
  // menú—, así que las cartas se ven dentro de su álbum.
  await page.locator('#mcEstanteriaRejilla').getByText('30th Celebration').first().click()
  await page.waitForTimeout(1800)
  const texto = await page.locator('body').innerText()
  check('la carta se enseña como «Eevee»', /Eevee/.test(texto), texto.slice(0, 400))
  check('  …y no en kanji', !/イーブイ/.test(texto), texto.slice(0, 400))
  // Y se ENCUENTRA por ese nombre. Hasta la 546 se veía «Eevee» en la
  // pantalla y escribirlo no daba nada, porque el filtro cruzaba contra
  // `name` y `name_es` y no contra `name_en`: la pantalla ofrecía algo que
  // no funcionaba, que es la lección de la 447.
  const caja = page.locator('#mcAlbumBuscar')
  if (await caja.count()) {
    await caja.fill('Eevee')
    await page.waitForTimeout(1200)
    check('y se encuentra escribiendo «Eevee»', /Eevee/.test(await page.locator('body').innerText()))
    await caja.fill('')
    await page.waitForTimeout(600)
  } else {
    check('y se encuentra escribiendo «Eevee»', false, 'no está #mcAlbumBuscar')
  }
}

check('sin errores de JavaScript en toda la pasada', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
