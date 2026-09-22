// Tanda 327 — lo que se rompió al salir a producción.
//
// PINGU: «está roto, se ve horrible». Y lo estaba: /coleccion/tr y
// /carta/… salían SIN CSS y SIN JavaScript.
//
// LA CAUSA. Las tres páginas del catálogo cargaban sus hojas con rutas
// RELATIVAS (`href="css/style.css"`), copiadas de lanzamientos.html. En
// /cartas eso resuelve a /css/style.css y funciona; en /coleccion/tr el
// navegador resuelve contra /coleccion/ y pide /coleccion/css/style.css,
// que es un 404. La página se sirve igual, con su contenido y todo, solo
// que en crudo.
//
// POR QUÉ NO LO VIO NADIE. Las pruebas de la 324 y la 326 abrían
// /carta.html?id=… y /coleccion.html?set=…, que son las direcciones
// PLANAS. Y el servidor de pruebas no hacía las reescrituras de Netlify,
// así que la dirección bonita ni siquiera existía aquí.
//
// Por eso esta prueba se escribe contra LA FORMA: no comprueba mis tres
// páginas, comprueba TODAS las que netlify.toml sirve desde una
// dirección con barra. La próxima que se añada entra sola.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { esDelTCG, ID_DE_POCKET, SERIES_FUERA } from '/home/user/pingu/js/catalogo-series.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const browser = await chromium.launch()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Toda página con dirección bonita usa rutas absolutas ──')
{
  // La lista NO se escribe a mano: sale de netlify.toml. Una prueba
  // contra el caso que acabas de arreglar no vale (la lección de la
  // 303); contra la forma, la siguiente entra sola.
  const toml = leer('netlify.toml')
  const conBarra = [...toml.matchAll(/from\s*=\s*"\/([^"*]*)\/(?:\*|:[^"]+)"[\s\S]{0,80}?to\s*=\s*"\/([^"?]+\.html)/g)]
    .map((m) => ({ prefijo: `/${m[1]}/`, fichero: m[3] }))
  check('se han encontrado las reescrituras', conBarra.length >= 5, JSON.stringify(conBarra.map((x) => x.prefijo)))

  // Y además de las que netlify.toml sirve con barra, las TRES del
  // catálogo, aunque /cartas no tenga sub-ruta y una relativa suya
  // funcione hoy. Son una sola plantilla, dos de ellas ya mordieron, y
  // quien copie la tercera para la siguiente página se lleva el fallo
  // puesto. Aquí es un pretil declarado, no un fallo vivo.
  const familia = [
    { prefijo: '(familia del catálogo)', fichero: 'carta.html' },
    { prefijo: '(familia del catálogo)', fichero: 'coleccion.html' },
    { prefijo: '(familia del catálogo)', fichero: 'cartas.html' },
  ]
  const malas = []
  for (const { prefijo, fichero } of [...conBarra, ...familia]) {
    let html
    try {
      html = leer(fichero)
    } catch {
      continue
    }
    // Cualquier href/src que no empiece por /, http, #, mailto: o data:
    // se resolvería contra el prefijo y daría un 404.
    for (const m of html.matchAll(/\b(?:href|src)="(?!\/|https?:|#|mailto:|data:)([^"]+)"/g)) {
      malas.push(`${fichero} (${prefijo}) → ${m[1]}`)
    }
  }
  check('ninguna carga nada con ruta relativa', malas.length === 0, malas.slice(0, 6).join(' · '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Y se comprueba DE VERDAD, abriéndolas ──')
{
  // Mirar el fichero no basta: el servidor de pruebas tampoco hacía las
  // reescrituras, y esa es la otra mitad de por qué no se vio. Aquí se
  // abre la dirección bonita y se mira si llegó alguna hoja.
  const rutas = ['/carta/dark-magneton-tr-11', '/coleccion/tr', '/cartas']
  for (const ruta of rutas) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const rotos = []
    page.on('response', (r) => {
      if (!r.ok() && r.url().startsWith(BASE)) rotos.push(new URL(r.url()).pathname)
    })
    await page.addInitScript(() => {
      window.__FAKE_SETS__ = [{ id: 'tr', name: 'Team Rocket', market: 'WEST', serie_id: null,
        release_date: '2000-04-24', card_count_official: 82 }]
      window.__FAKE_CARTAS__ = [{ id: 'tr-11', set_id: 'tr', market: 'WEST', local_id: '11',
        name: 'Dark Magneton', image_path: 'base/tr/11', category: 'Pokemon', hp: 60, detalle_at: 'x' }]
    })
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1600)
    const hojas = await page.evaluate(() => document.styleSheets.length)
    // El fondo del sitio. Sin CSS el navegador pinta blanco puro; con
    // CSS es --bg. Es la comprobación que ve lo que ve una persona.
    const fondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    check(`${ruta} carga sus hojas`, hojas >= 3, `${hojas} hojas`)
    check(`  …y tiene el fondo del sitio`, fondo === 'rgb(246, 248, 250)', fondo)
    check(`  …sin ningún 404`, rotos.length === 0, [...new Set(rotos)].join(', '))
    await page.close()
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Pokémon TCG Pocket es otro juego ──')
{
  check('la serie está declarada fuera', SERIES_FUERA.includes('tcgp'))
  check('un set del TCG entra', esDelTCG({ id: 'sv5', serie_id: 'sv' }))
  // Las colecciones viejas de Wizards traen `serie_id` vacío y son el
  // TCG más TCG que hay: null NO es motivo para echar a nadie.
  check('…y uno sin serie también', esDelTCG({ id: 'base1', serie_id: null }) && esDelTCG({ id: 'tr' }))
  check('uno de Pocket por su serie, no', !esDelTCG({ id: 'x', serie_id: 'tcgp' }))

  // ── Y LOS DE VERDAD ──
  //
  // Esta es la comprobación que faltaba y por la que el filtro no valía
  // para nada. En la base de PokeDoc los CATORCE sets de Pocket tienen
  // `serie_id` a NULL, así que mirar solo la serie no echaba a ninguno.
  // La prueba pasaba en verde porque el fixture lo había escrito yo con
  // la serie puesta: probaba el código contra mi invento y no contra los
  // datos. Aquí van los catorce tal y como están, sacados de la consulta
  // que ejecutó PINGU.
  const DE_POCKET = ['B2a', 'B2', 'B1a', 'B1', 'A4a', 'A4', 'A3b', 'A3a', 'A3', 'A2b', 'A2a', 'A2', 'A1a', 'A1']
  const colados = DE_POCKET.filter((id) => esDelTCG({ id, serie_id: null }))
  check('los catorce de Pocket se van, con la serie vacía', colados.length === 0, colados.join(', '))
  check('…y se reconocen por su identificador', DE_POCKET.every((id) => ID_DE_POCKET.test(id)))

  // Y el otro lado, que es el que hace daño si se pasa de listo: ningún
  // set del TCG puede caer por el patrón. Los de mesa llevan SIEMPRE dos
  // letras o más antes del número.
  const DEL_TCG = ['base1', 'base2', 'swsh3', 'sv5', 'sv3.5', 'xy7', 'hgss2', 'col1', 'pl1',
    'ex14', 'bw11', 'sm9', 'dp3', '30C', 'PBL', 'tr', 'me01', 'sv10.5b']
  const echados = DEL_TCG.filter((id) => !esDelTCG({ id, serie_id: null }))
  check('y ningún set del TCG se va por delante', echados.length === 0, echados.join(', '))

  // Y la columna PEDIDA en cada consulta: sin ella el filtro recibe
  // undefined y deja pasar todo SIN DAR ERROR.
  for (const f of ['js/cartas.js', 'js/coleccion.js', 'netlify/edge-functions/meta-social.js',
                   'netlify/functions/sitemap.mjs']) {
    check(`${f} pide serie_id`, /select=?[^'"]*serie_id|'[^']*serie_id/.test(leer(f)), 'el filtro recibiría undefined')
  }

  // En la página, de verdad.
  const page = await browser.newPage()
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [
      { id: 'sv5', name: 'Fuerzas Temporales', market: 'WEST', serie_id: 'sv', release_date: '2024-03-22' },
      // Sin serie, como está de verdad en la base.
      { id: 'A1', name: 'Genetic Apex', market: 'WEST', serie_id: null, release_date: '2024-10-30' },
    ]
  })
  await page.goto(`${BASE}/cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  const nombres = await page.locator('.serie-nombre').allTextContents()
  check('el índice no enseña las de Pocket', !nombres.includes('Genetic Apex'), nombres.join(' | '))
  check('…y sí las del TCG', nombres.includes('Fuerzas Temporales'), nombres.join(' | '))
  await page.close()

  const p2 = await browser.newPage()
  await p2.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'A1', name: 'Genetic Apex', market: 'WEST', serie_id: null }]
  })
  await p2.goto(`${BASE}/coleccion/A1`, { waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(1800)
  check('una colección de Pocket no tiene página',
    !((await p2.locator('#coleccionError').getAttribute('class')) || '').includes('hidden'))
  await p2.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. El punto de corte de la barra se MIDE ──')
{
  // La lección de la 320, que volvió a picar: un enlace más en la barra
  // cambia lo que la barra PIDE, y un corte heredado es una afirmación
  // sobre un ancho que ya no existe. El síntoma no canta — el logo es
  // hijo de flex y cede.
  const page = await browser.newPage({ viewport: { width: 1600, height: 800 } })
  await page.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1' })
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  const pide = await page.evaluate(() => {
    const inner = document.querySelector('.nav-inner')
    const cs = getComputedStyle(inner)
    const piezas = [...inner.children].filter((n) => n.offsetParent)
    const suma = piezas.reduce((a, n) => a + n.getBoundingClientRect().width, 0)
    return Math.round(suma + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) +
      (parseFloat(cs.gap) || 0) * (piezas.length - 1))
  })
  await page.close()

  const corte = Number((leer('css/style.css').match(/@media \(min-width: (\d+)px\) \{\s*\.nav-links/) || [])[1])
  check('el corte existe y está escrito', Number.isFinite(corte), String(corte))
  check('…y es MAYOR que lo que la barra pide', corte >= pide,
    `la barra pide ${pide} px y el corte está en ${corte}`)
  // Y no tan alto que esconda el menú donde cabría de sobra.
  check('…sin pasarse', corte - pide <= 120, `${corte - pide} px de sobra`)

  // ── Con el chip de torneo ──
  //
  // Aquí no vale mirar si algo desborda: `.nav-links` es hijo de flex y
  // CEDE, así que cuando no cabe no se sale — se APRIETA, en silencio.
  // Es la trampa de la 320 un piso más abajo, y es lo que llevaba meses
  // pasando sin que ninguna prueba se quejara.
  //
  // Lo que se comprueba es que, con el chip puesto, o los enlaces están
  // escondidos o están a su ancho NATURAL. Apretados, no.
  const ahora = Date.now()
  const TORNEO = [{ id: 't1', slug: 'p', name: 'Pachanga de inauguración de PokeDoc con un nombre larguísimo',
    status: 'in_progress', format: 'standard', starts_at: new Date(ahora - 3600e3).toISOString(),
    start_at: new Date(ahora - 3600e3).toISOString(), max_players: 32, created_by: 'admin-1' }]
  const INSCRIPCION = [{ id: 'i1', tournament_id: 't1', user_id: 'admin-1', status: 'active' }]
  const apretados = []
  for (const w of [1160, 1200, 1280, 1400, 1600, 1920]) {
    const pc = await browser.newPage({ viewport: { width: w, height: 800 } })
    await pc.addInitScript(([t, i]) => {
      window.__FAKE_SESSION__ = 'admin-1'; window.__FAKE_RETOS__ = []
      window.__FAKE_TORNEOS__ = t; window.__FAKE_INSCRIPCIONES__ = i
    }, [TORNEO, INSCRIPCION])
    await pc.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
    await pc.waitForTimeout(2200)
    const r = await pc.evaluate(() => ({
      visible: !!document.querySelector('.nav-links')?.offsetParent,
      doc: document.documentElement.scrollWidth,
      ventana: window.innerWidth,
    }))
    // MEDIDO, no supuesto: al probarlo resultó que `.nav-links` NO se
    // aprieta —se queda a su ancho natural— y quien paga es la PÁGINA,
    // que se desborda en horizontal y saca barra de desplazamiento.
    // Mi primera versión miraba `scrollWidth` de los enlaces y por eso
    // el rigor se le escapó: comprobaba el síntoma equivocado.
    if (r.doc > r.ventana) apretados.push(`${w} (la página se sale ${r.doc - r.ventana}px, enlaces ${r.visible ? 'a la vista' : 'en el menú'})`)
    await pc.close()
  }
  check('con el chip, la página no se desborda a ningún ancho', apretados.length === 0, apretados.join(' · '))

  // Y el logo, que es quien paga la factura cuando no cabe.
  const p2 = await browser.newPage({ viewport: { width: corte, height: 800 } })
  await p2.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1' })
  await p2.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(2200)
  const logo = await p2.evaluate(() => Math.round(document.querySelector('.nav-logo').getBoundingClientRect().width))
  check('justo en el corte, el logo no se aplasta', logo >= 120, `${logo} px`)
  await p2.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Se llega al catálogo sin saberse la URL ──')
{
  // Era la pregunta de PINGU: «/cartas existe pero no se puede llegar».
  const paginas = ['index.html', 'aprender.html', 'foro.html', 'torneo.html', 'carta.html']

  // El trozo se RECORTA antes de buscar dentro. Con un `[\s\S]*?` suelto
  // el motor se salta el `</div>` del bloque y encuentra el enlace en el
  // menú del móvil, así que quitarlo de la barra no se notaba: la
  // prueba seguía verde. Es la trampa de la 312 —comprobar un trozo en
  // vez de la cosa entera— con otra cara.
  const trozo = (html, desde, hasta) => {
    const i = html.indexOf(desde)
    if (i < 0) return ''
    const j = html.indexOf(hasta, i + desde.length)
    return j < 0 ? '' : html.slice(i, j)
  }
  const sinBarra = paginas.filter(
    (f) => !trozo(leer(f), '<div class="nav-links">', '</div>').includes('href="/cartas"')
  )
  check('«Cartas» está en la barra de arriba', sinBarra.length === 0, sinBarra.join(', '))
  const sinMovil = paginas.filter(
    (f) => !trozo(leer(f), '<div class="nav-menu-mobile"', '</div>').includes('href="/cartas"')
  )
  check('…y en el menú del móvil', sinMovil.length === 0, sinMovil.join(', '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. La lista de colecciones se lee de un vistazo ──')
{
  // Esto era «una colección sin logo no descuadra la rejilla». La 328 se
  // llevó la rejilla por delante: eran tarjetas con logo, y la mitad de
  // las colecciones no tiene logo en TCGdex. Ahora es una lista con el
  // CÓDIGO delante —que es como la gente las nombra— y el problema
  // desaparece de raíz: todas las filas se ven iguales.
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [
      { id: 'sv8', name: 'Surging Sparks', market: 'WEST', serie_id: 'sv', serie_name: 'Escarlata y Púrpura',
        tcg_online_code: 'SSP', logo_path: 'sv/sv8/logo', release_date: '2024-11-08', card_count_official: 252 },
      { id: 'tr', name: 'Team Rocket', market: 'WEST', serie_id: null, serie_name: null,
        tcg_online_code: null, logo_path: null, release_date: '2000-04-24', card_count_official: 82 },
    ]
  })
  await page.goto(`${BASE}/cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)

  const codigos = (await page.locator('.serie-codigo').allTextContents()).map((t) => t.trim())
  check('la que tiene código lo enseña', codigos.includes('SSP'), codigos.join(' | '))
  // La que no tiene código cae al identificador. Lo que NO puede pasar
  // es que se quede sin insignia: entonces la columna se descuadra y la
  // lista deja de leerse en vertical, que es para lo que existe.
  check('la que no lo tiene cae al identificador', codigos.includes('TR'), codigos.join(' | '))
  check('ninguna fila se queda sin insignia', codigos.length === 2 && codigos.every(Boolean), codigos.join(' | '))

  // Y el orden, que lo pidió PINGU: series de la más nueva a la más
  // vieja, y dentro igual. Sale del orden en que llegan las filas, sin
  // una segunda ordenación que pudiera decir otra cosa.
  const series = await page.locator('.serie-titulo').allTextContents()
  check('la serie más nueva va primero', series[0] === 'Escarlata y Púrpura', series.join(' | '))
  await page.close()
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
