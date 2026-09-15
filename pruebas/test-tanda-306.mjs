import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

// Tanda 306: la ficha de una persona deja de ser tres cajas sueltas
// —cabecera, botones flotando y una rejilla de tarjetas— y pasa a ser
// UNA tarjeta con una tira de cifras al pie. Y la lista de inscritos de
// un torneo pasa a tener caras.
//
// De dónde viene: PINGU, «alguno me ha preguntado, oye, ¿esto está hecho
// con IA?… quiero una interfaz más moderna, que no se vea tan pocho», y
// en la misma lista «la lista de inscritos y cosas así» y «además ibas a
// mejorar los perfiles, ¿verdad?».

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const LOGROS = [
  { id: 'torneo_jugado', title: 'Competidor', description: 'Jugaste un torneo.', emoji: 'medal', rarity: 'bronze' },
  { id: 'torneo_campeon', title: 'Campeón de torneo', description: 'Ganaste un torneo.', emoji: 'crown', rarity: 'gold' },
]

const abrir = async (ruta, { sesion = 'user-1', ancho = 1100, alto = 1100, semillas = {} } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, { __FAKE_SESSION__: sesion, __FAKE_LOGROS__: LOGROS, ...semillas })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Un perfil es UNA tarjeta, no tres cajas ──')
{
  // Lo que había: la cabecera, debajo un <div> con estilos EN LÍNEA con
  // los botones de Seguir/Mensaje flotando, y debajo otra rejilla con
  // tres a cinco tarjetas con borde. Ocho cifras de la misma persona en
  // dos sitios distintos.
  for (const f of ['usuario.html', 'perfil.html']) {
    const src = leer(f)
    check(`${f}: ya no hay rejilla de tarjetas de estadística`, !/stats-row|stat-card/.test(src))
    // La tira y las acciones van DENTRO de la tarjeta: se comprueba que
    // no queda nada entre el cierre de .profile-hero y las pestañas.
    const entre = src.slice(src.indexOf('</div>\n\n    <div class="tabs"'), src.indexOf('<div class="tabs"'))
    check(`${f}: entre la tarjeta y las pestañas no queda nada suelto`, !/<button|<a class="btn/.test(entre), entre.trim().slice(0, 80))
  }
  check('ninguna hoja define ya .stat-card',
    !readdirSync(`${RAIZ}/css`).some((f) => f.endsWith('.css') && /\.stat-card\b/.test(leer(`css/${f}`))))
  // Y nadie lo pinta desde JavaScript, que es por donde se colaría.
  const jsSueltos = readdirSync(`${RAIZ}/js`).filter((f) => f.endsWith('.js')).filter((f) => /stat-card|stats-row/.test(leer(`js/${f}`)))
  check('  …ni ningún módulo lo pinta', jsSueltos.length === 0, jsSueltos.join(', '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Las cifras van todas en la MISMA fila ──')
{
  // La tira mezcla lo que pinta el JS (#profileStats) con los tres
  // contadores que ya vienen en el HTML. Si `display: contents` fallara,
  // el lote sería una caja y las cifras saldrían en dos bloques.
  for (const [ruta, sesion, cuantas] of [['/usuario?u=Ash', 'user-2', 5], ['/perfil', 'user-1', 7]]) {
    const { page, errores } = await abrir(ruta, { sesion })
    check(`${ruta}: sin errores de JavaScript`, errores.length === 0, errores[0] || '')
    const n = await page.locator('.perfil-cifra').count()
    check(`${ruta}: salen las ${cuantas} cifras`, n === cuantas, String(n))
    // Todas dentro de la tira, y el lote SIN caja propia: si alguien le
    // quitara el `display: contents`, las cifras que pinta el JS se
    // agruparían en un bloque aparte y la fila se partiría en dos.
    const dentroTodas = await page.locator('.perfil-cifra').evaluateAll((ns) => ns.every((x) => x.closest('.perfil-cifras')))
    check(`${ruta}: todas viven dentro de la tira`, dentroTodas)
    const sinCaja = await page.locator('.perfil-cifras-lote').evaluate((n) => getComputedStyle(n).display)
    check(`${ruta}: y el lote del JS no hace caja`, sinCaja === 'contents', sinCaja)
    const filas = await page.locator('.perfil-cifra').evaluateAll((ns) => [...new Set(ns.map((x) => Math.round(x.getBoundingClientRect().top)))])
    check(`${ruta}: en escritorio caben en un solo renglón`, filas.length === 1, `${filas.length} renglones`)
    // La tarjeta las contiene: si la tira se saliera, esto cambiaría.
    const dentro = await page.evaluate(() => !!document.querySelector('.profile-hero .perfil-cifras'))
    check(`${ruta}: la tira va dentro de la tarjeta`, dentro)
    await page.close()
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Nada más puede colarse dentro de la tira ──')
{
  // LA FORMA DEL FALLO, no el caso: `display: contents` convierte a
  // cualquier hermano del lote en una celda más de la fila. El panel de
  // «Invita a un amigo» se colgaba de #profileStats con `.after()` y
  // aterrizaba en medio de los números como si fuera una cifra.
  //
  // Así que la regla no es «el panel de invitar va fuera», es: dentro de
  // .perfil-cifras SOLO hay cifras. Cualquier cosa que alguien cuelgue
  // ahí en el futuro la caza esto.
  const { page } = await abrir('/perfil', { sesion: 'user-1' })
  const intrusos = await page.evaluate(() =>
    [...document.querySelectorAll('.perfil-cifras > *')]
      .filter((n) => !n.classList.contains('perfil-cifra') && !n.classList.contains('perfil-cifras-lote'))
      .map((n) => n.id || n.className)
  )
  check('en la tira solo hay cifras', intrusos.length === 0, intrusos.join(', '))
  const invitarFuera = await page.evaluate(() => {
    const p = document.getElementById('panelInvitar')
    return !p || !p.closest('.perfil-cifras')
  })
  check('  …y el panel de invitar cae fuera', invitarFuera)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. El banner sin foto sigue midiendo 96 px ──')
{
  // LA FORMA DEL FALLO de mudar una hoja: `.profile-hero-banner-vacio`
  // ya vivía en perfil.css y `.profile-hero-banner` llegó DESPUÉS desde
  // components.css. Misma especificidad, así que ganó la última y el
  // banner vacío volvió a los 160 px — sin que nada diera error.
  //
  // Se mide el resultado y no el orden de las reglas: da igual cómo se
  // arregle mientras el banner vacío mida lo que tiene que medir.
  for (const [ruta, sesion] of [['/perfil', 'user-1'], ['/usuario?u=Ash', 'user-2']]) {
    const { page } = await abrir(ruta, { sesion })
    const alto = await page.locator('#heroBanner').evaluate((n) => n.getBoundingClientRect().height)
    check(`${ruta}: sin foto el banner mide 96`, alto === 96, String(alto))
    await page.close()
  }
  // Y con foto se queda en los 160: si alguien «arreglara» lo de arriba
  // bajando la regla base, esto lo cazaría.
  const { page } = await abrir('/usuario?u=Ash', {
    sesion: 'user-2',
    semillas: { __FAKE_PERFILES__: [{ id: 'user-1', banner_url: 'https://ejemplo/x.png' }] },
  })
  const alto = await page.locator('#heroBanner').evaluate((n) => n.getBoundingClientRect().height)
  check('con foto se queda en 160', alto === 160, String(alto))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. El rango sube a la fila de chapas ──')
{
  const { page } = await abrir('/usuario?u=Ash', { sesion: 'user-2' })
  check('sale la chapa de rango', (await page.locator('.perfil-rango').count()) === 1)
  const juntos = await page.evaluate(() => !!document.querySelector('.perfil-chapas .profile-level') && !!document.querySelector('.perfil-chapas .perfil-rango'))
  check('  …junto al nivel, en la misma fila', juntos)
  // Y sigue abriendo la escalera de rangos: era un botón y tiene que
  // seguir siéndolo.
  await page.locator('.perfil-rango').click()
  await page.waitForTimeout(400)
  check('  …y al pulsarla se abre la escalera', await page.locator('#profileModal .ladder-list').isVisible())
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Los inscritos tienen cara ──')
{
  const TORNEO = { id: 'torneo-1', slug: 'copa', name: 'Copa', status: 'registration_open',
    admin_id: 'admin-1', max_players: 4, swiss_rounds: 3 }
  const INSC = [
    { id: 'ins-1', tournament_id: 'torneo-1', user_id: 'user-1', status: 'active', tcg_live_username: 'AshKetchum' },
    { id: 'ins-2', tournament_id: 'torneo-1', user_id: 'user-2', status: 'active', tcg_live_username: 'MistyW' },
    { id: 'ins-3', tournament_id: 'torneo-1', user_id: 'user-3', status: 'active' },
    { id: 'ins-4', tournament_id: 'torneo-1', user_id: 'mod-1', status: 'active' },
    { id: 'ins-5', tournament_id: 'torneo-1', user_id: 'admin-1', status: 'waitlisted' },
  ]
  const semillas = { __FAKE_TORNEOS__: [TORNEO], __FAKE_INSCRIPCIONES__: INSC }

  // Quien ORGANIZA es quien ve la fila más cargada: nombre, TCG Live,
  // dos chapas y el botón de expulsar.
  const { page, errores } = await abrir('/torneo?slug=copa', { sesion: 'admin-1', semillas })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const caras = await page.locator('#listaInscritos .mini-avatar').count()
  check('cada inscrito tiene su cara (lista de espera incluida)', caras === 5, String(caras))
  // Sin foto, la inicial: nunca un círculo vacío.
  const inicial = await page.locator('#listaInscritos .mini-avatar').first().textContent()
  check('  …y sin foto sale su inicial', (inicial || '').trim().length === 1, JSON.stringify(inicial))

  // LA FORMA DEL FALLO de la rejilla: la fila tenía CUATRO columnas y
  // quien organiza mete CINCO celdas, así que el botón de expulsar se
  // caía a un segundo renglón y allí, solo, se estiraba a lo ancho de
  // media lista. No se cuentan columnas: se mira si la fila cabe en un
  // renglón, que es lo que se ve.
  // Se comparan los CENTROS y no los bordes de arriba: las celdas van
  // centradas entre sí y miden distinto, así que sus `top` no coinciden
  // aunque estén en el mismo renglón.
  const renglones = await page.locator('.torneo-inscrito').first().evaluate((f) =>
    [...new Set([...f.children].filter((c) => c.offsetParent !== null).map((c) => {
      const r = c.getBoundingClientRect()
      return Math.round(r.top + r.height / 2)
    }))].length
  )
  check('la fila del organizador cabe en un renglón', renglones === 1, `${renglones} renglones`)
  const altoFila = await page.locator('.torneo-inscrito').first().evaluate((f) => f.getBoundingClientRect().height)
  // Una fila con su botón mide unos 59 px; con el botón caído al
  // segundo renglón medía unos 91. El listón va en medio.
  check('  …y por eso no mide el doble', altoFila < 75, `${Math.round(altoFila)}px`)

  // El avatar no cuesta una consulta más: viene en el MISMO select.
  // La propiedad es «en el MISMO select»: el que ya traía los nombres
  // tiene que traer también la foto. Buscar `avatar_url` a secas no
  // valdría — lo pide media web por su cuenta y el check pasaría igual
  // aunque la lista de inscritos se hubiera quedado sin él.
  const cols = await page.evaluate(() => (window.__CONSULTAS__?.columnas?.user_profiles || []))
  const juntos = cols.filter((c) => /username/.test(c) && /avatar_url/.test(c))
  check('el avatar viene en el select que ya traía los nombres', juntos.length >= 1, JSON.stringify(cols))
  check('  …y no hay un select suelto solo para avatares',
    !cols.some((c) => /avatar_url/.test(c) && !/username/.test(c) && !/^\*$/.test(c)), JSON.stringify(cols))
  await page.close()

  // Sin cuenta también hay caras: la ficha es el escaparate.
  const { page: anon } = await abrir('/torneo?slug=copa', { sesion: 'none', ancho: 393, semillas })
  check('sin cuenta también se ven las caras', (await anon.locator('#listaInscritos .mini-avatar').count()) === 5)
  check('  …y sin el usuario de TCG Live de nadie', !(await anon.locator('#listaInscritos').textContent())?.includes('TCG Live'))
  await anon.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. El CSS de los perfiles deja de bajarlo todo el mundo ──')
{
  const comp = leer('css/components.css')
  const perfil = leer('css/perfil.css')
  check('components.css ya no lleva la cabecera de perfil', !/\n\.profile-hero[\s{,-]/.test(comp))
  check('  …y perfil.css sí', /\n\.profile-hero\s*\{/.test(perfil))
  // El mismo @media que rompió el foro en la tanda 299: uno que se quede
  // atrás en components.css pierde contra su base, que ahora carga
  // después. Aquí no puede quedar NINGUNO de perfil.
  const enMedia = []
  for (const m of comp.matchAll(/@media[^{]*\{/g)) {
    let i = m.index + m[0].length
    let nivel = 1
    while (i < comp.length && nivel > 0) {
      if (comp[i] === '{') nivel++
      else if (comp[i] === '}') nivel--
      i++
    }
    for (const c of comp.slice(m.index + m[0].length, i - 1).matchAll(/\.(profile-hero[\w-]*|profile-bio|profile-level|profile-xp-bar|perfil-[\w-]+|achievement-tile[\w-]*|achievements-grid|accordion[\w-]*)/g)) enMedia.push(c[1])
  }
  check('  …ni queda ningún @media suyo en components.css', enMedia.length === 0, [...new Set(enMedia)].join(', '))

  const gz = (t) => gzipSync(Buffer.from(t)).length
  check('components.css baja de 31 KB gzip', gz(comp) < 31 * 1024, `${(gz(comp) / 1024).toFixed(1)} KB`)

  // Y LA FORMA DEL FALLO de mudar una hoja (tandas 299 y 303): ninguna
  // página puede usar una clase cuya única regla vive en una hoja que
  // esa página NO carga. Se barre la web entera, no la pantalla que
  // acabo de mirar — eso es justo lo que dejó tema.html sin foro.css.
  const clasesDeTexto = (txt) => {
    const fuera = new Set()
    for (const m of txt.matchAll(/class="([^"$]*)"/g)) {
      for (const c of m[1].split(/\s+/)) if (/^[a-zA-Z][\w-]*$/.test(c)) fuera.add(c)
    }
    return fuera
  }
  const reglasDe = (rutas) => {
    const fuera = new Set()
    for (const r of rutas) {
      if (!existsSync(`${RAIZ}/${r}`)) continue
      for (const m of leer(r).matchAll(/\.([a-zA-Z][\w-]*)/g)) fuera.add(m[1])
    }
    return fuera
  }
  const hojas = readdirSync(`${RAIZ}/css`).filter((f) => f.endsWith('.css')).map((f) => `css/${f}`)
  const paginas = readdirSync(RAIZ).filter((f) => f.endsWith('.html'))
  const rotas = []
  for (const pagina of paginas) {
    const fuente = leer(pagina)
    const suyas = [...fuente.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1].replace(/^\//, ''))
    let usadas = clasesDeTexto(fuente)
    // El JS de la página Y lo que ese JS importa: .achievement-tile y
    // .perfil-cifra los pinta un módulo, no el HTML.
    const pendientes = [...fuente.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1].replace(/^\//, ''))
    const vistos = new Set()
    while (pendientes.length) {
      const js = pendientes.shift()
      if (vistos.has(js) || !existsSync(`${RAIZ}/${js}`)) continue
      vistos.add(js)
      const txt = leer(js)
      usadas = new Set([...usadas, ...clasesDeTexto(txt)])
      const dir = js.slice(0, js.lastIndexOf('/') + 1)
      for (const imp of txt.matchAll(/from\s+'([^']+\.js)'/g)) {
        const destino = new URL(imp[1], `file:///${dir}`).pathname.replace(/^\//, '')
        pendientes.push(destino)
      }
    }
    const tiene = reglasDe(suyas)
    const enOtra = reglasDe(hojas.filter((h) => !suyas.includes(h)))
    const huerfanas = [...usadas].filter((c) => !tiene.has(c) && enOtra.has(c))
    if (huerfanas.length) rotas.push(`${pagina}: ${huerfanas.slice(0, 6).join(', ')}`)
  }
  check(`ninguna de las ${paginas.length} páginas usa clases de una hoja que no carga`, rotas.length === 0, rotas.join(' | '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. Nada se sale de la pantalla ──')
{
  for (const ancho of [320, 393, 1280]) {
    for (const [ruta, sesion] of [['/perfil', 'user-1'], ['/usuario?u=Ash', 'user-2']]) {
      const { page } = await abrir(ruta, { sesion, ancho })
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      check(`${ancho}px ${ruta}: sin scroll lateral`, desborde <= 1, `sobran ${desborde}px`)
      await page.close()
    }
  }
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
