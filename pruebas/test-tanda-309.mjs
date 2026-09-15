import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'
import { cuerpoDeArticulo } from '/home/user/pingu/netlify/edge-functions/meta-social.js'

// Tanda 309: el destello al abrir una guía, la marca de sección del menú,
// el desplegable del perfil y la escala de bordes.
//
// De dónde viene: PINGU, «primero carga el texto sin formato y de
// repente ¡pum!», «¿el menú tendría que tener los botones diferenciados?»
// y «el desplegable es demasiado extenso».

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const BLOQUES = [
  { type: 'richtext', html: '<h2>Primera parte</h2><p>Un párrafo con <strong>negrita</strong> dentro.</p><ul><li>Uno</li><li>Dos</li></ul>' },
]
const GUIA = {
  id: 'g-1', slug: 'mi-guia', title: 'Empezar en el TCG', description: 'Lo básico.',
  kind: 'guide', review_status: 'published', published_at: '2026-08-01T10:00:00Z',
  reference_blocks: BLOQUES, category_id: 'cat-1',
}

const abrir = async (ruta, { sesion = 'user-1', semillas = {}, ancho = 1100 } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, { __FAKE_SESSION__: sesion, __FAKE_CATEGORIAS__: [{ id: 'cat-1', name: 'Básico', slug: 'basico' }], ...semillas })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Lo que pinta el servidor se ve como lo que pinta el cliente ──')
{
  // EL FALLO: guia.html la pre-rellena una función de servidor para que
  // Google y quien comparte el enlace vean el texto. Metía el `<h1>` y
  // los bloques SUELTOS dentro de <article>, y toda la tipografía del
  // artículo cuelga de `.article-body`. O sea que el primer pintado
  // salía sin interlineado, sin márgenes y con las listas sin viñetas; y
  // cuando llegaba el JavaScript, sustituía todo y pegaba el salto.
  //
  // No se comprueba «lleva tal clase»: se MIDE que un párrafo se vea
  // igual pintado por uno que por el otro. Así da igual cómo se arregle
  // mientras las dos mitades coincidan, que es lo único que importa.
  const { page, errores } = await abrir('/guia?slug=mi-guia', { semillas: { __FAKE_GUIAS__: [GUIA] } })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')

  const estiloDe = (sel) =>
    page.locator(sel).first().evaluate((n) => {
      const c = getComputedStyle(n)
      return { alto: c.lineHeight, margen: c.marginBottom, tam: c.fontSize, ancho: Math.round(n.getBoundingClientRect().width) }
    })

  const delCliente = await estiloDe('.article-body p')
  // El TÍTULO también, no solo el párrafo: el cuerpo lleva dos
  // envoltorios —.article-header y .article-body— y midiendo solo el
  // segundo, quitar el primero pasaba desapercibido. Lo cazó el rigor.
  const tituloCliente = await estiloDe('.article-header h1')
  // Ahora se pone en la página EXACTAMENTE lo que manda el servidor.
  const delServidor = cuerpoDeArticulo({ titulo: GUIA.title, entradilla: GUIA.description, bloques: BLOQUES })
  await page.evaluate((html) => {
    document.getElementById('articleMain').innerHTML = html
  }, delServidor)
  await page.waitForTimeout(150)
  const servidor = await estiloDe('.article-body p')

  const tituloServidor = await estiloDe('.article-header h1')
  check('el título del servidor se ve igual que el del cliente',
    tituloServidor.tam === tituloCliente.tam && tituloServidor.margen === tituloCliente.margen,
    `${JSON.stringify(tituloServidor)} vs ${JSON.stringify(tituloCliente)}`)
  check('el párrafo del servidor tiene el mismo interlineado', servidor.alto === delCliente.alto, `${servidor.alto} vs ${delCliente.alto}`)
  check('  …el mismo margen', servidor.margen === delCliente.margen, `${servidor.margen} vs ${delCliente.margen}`)
  check('  …y el mismo tamaño', servidor.tam === delCliente.tam, `${servidor.tam} vs ${delCliente.tam}`)
  // Y las listas con sus viñetas, que es lo que más cantaba.
  const vinetas = await page.locator('.article-body ul').first().evaluate((n) => getComputedStyle(n).listStyleType)
  check('  …y las listas con viñeta', vinetas !== 'none', String(vinetas))
  await page.close()

  // El texto tiene que seguir estando: si alguien «arregla» esto
  // quitando el cuerpo, los buscadores vuelven a ver una página vacía.
  check('el servidor sigue mandando el texto del artículo', /Primera parte/.test(delServidor))
  check('  …y el título', /Empezar en el TCG/.test(delServidor))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El menú dice en qué sección estás ──')
{
  // Ya había una marca… que solo se encendía en la portada: comparaba el
  // último trozo de la URL con el href TAL CUAL, y desde que hay
  // direcciones limpias `'noticias' === '/noticias'` es falso. Por eso
  // el menú parecía texto plano: el estado que lo diferenciaba no
  // llegaba a existir nunca.
  const esperado = [
    ['/index.html', 'Inicio'], ['/', 'Inicio'], ['/noticias', 'Noticias'],
    ['/aprender', 'Aprender'], ['/foro', 'Foro'], ['/usuarios', 'Comunidad'], ['/torneos', 'Jugar'],
  ]
  for (const [ruta, cual] of esperado) {
    const { page } = await abrir(ruta)
    const act = await page.locator('.nav-links a.active').allTextContents()
    check(`${ruta}: marca «${cual}»`, act.length === 1 && act[0].trim() === cual, JSON.stringify(act))
    await page.close()
  }

  // Y leer algo también es estar en su sección: una guía es Aprender.
  const { page: g } = await abrir('/guia?slug=mi-guia', { semillas: { __FAKE_GUIAS__: [GUIA] } })
  check('leyendo una guía se marca «Aprender»',
    (await g.locator('.nav-links a.active').textContent())?.trim() === 'Aprender',
    JSON.stringify(await g.locator('.nav-links a.active').allTextContents()))
  await g.close()

  // La marca se VE, no solo está puesta: fondo distinto del de al lado.
  const { page: v } = await abrir('/foro')
  const colores = await v.locator('.nav-links a').evaluateAll((ns) =>
    ns.map((n) => ({ t: n.textContent.trim(), fondo: getComputedStyle(n).backgroundColor }))
  )
  const activo = colores.find((c) => c.t === 'Foro')
  const otro = colores.find((c) => c.t === 'Inicio')
  check('la marca se ve: el activo tiene fondo y el resto no',
    activo.fondo !== otro.fondo && !/rgba\(0, 0, 0, 0\)/.test(activo.fondo), JSON.stringify([activo, otro]))
  await v.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. El desplegable del perfil, más corto ──')
{
  const { page } = await abrir('/foro', { sesion: 'admin-1' })
  await page.locator('#navUserBtn').click()
  await page.waitForTimeout(300)
  const opciones = (await page.locator('.nav-user-links a, .nav-user-links button').allTextContents()).map((t) => t.trim())
  check('quedan cinco opciones', opciones.length === 5, JSON.stringify(opciones))
  check('  …y «Mis torneos» ya no está', !opciones.some((o) => /mis torneos/i.test(o)), JSON.stringify(opciones))
  check('  …ni «Enviar feedback»', !opciones.some((o) => /feedback/i.test(o)), JSON.stringify(opciones))
  // Ni siquiera al admin, que era el único al que le salía «Mis torneos».
  check('  …y sigue estando lo que sí se usa',
    ['Mi perfil', 'Guardados', 'Mis partidas', 'Escribir una guía', 'Cerrar sesión'].every((x) => opciones.includes(x)),
    JSON.stringify(opciones))
  // «Cerrar sesión» separado por una raya: es lo que evita pulsarlo
  // yendo a por lo de arriba.
  const separado = await page.locator('#navUserSignOut').evaluate((n) => getComputedStyle(n).borderTopWidth)
  check('  …y «Cerrar sesión» va separado por una raya', separado !== '0px', String(separado))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. El feedback no se pierde: se va al pie ──')
{
  // Quitar el botón del menú es gratis; quitar la vía de que alguien te
  // cuente algo, no.
  const { page } = await abrir('/foro')
  check('con sesión, «Enviar feedback» sale en el pie', (await page.locator('#pieFeedbackBtn').count()) === 1)
  await page.locator('#pieFeedbackBtn').click()
  await page.waitForTimeout(600)
  check('  …y al pulsarlo se abre el formulario',
    (await page.locator('.modal-overlay:not(.hidden), #feedbackModal').count()) > 0)
  await page.close()

  // Sin sesión no se enseña: el formulario la necesita.
  const { page: anon } = await abrir('/foro', { sesion: 'none' })
  check('sin cuenta no se enseña', (await anon.locator('#pieFeedbackBtn').count()) === 0)
  await anon.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Los bordes tienen escala ──')
{
  // Había NUEVE grosores distintos haciendo el trabajo de dos: 180
  // reglas a 1px, 46 a 1.5, 25 a 2, y sueltas a 2.5, 3, 4, 4.5 y 6.
  //
  // La regla: un CONTORNO (`border:`) es de 1px o de 2px. Un lado suelto
  // (`border-left`) no es un contorno, es una barra de cita; y hay tres
  // sitios donde un `border` DIBUJA algo —la lupa del buscador, el canto
  // blanco de una carta— y esos van aparte, declarados aquí para que se
  // vea que son excepciones y no despistes.
  const FIGURAS = ['1.8', '3']
  const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '')
  const hojas = readdirSync(`${RAIZ}/css`).filter((f) => f.endsWith('.css'))
  const fuera = []
  for (const f of hojas) {
    for (const m of sinComentarios(leer(`css/${f}`)).matchAll(/border:\s*([0-9.]+)px/g)) {
      if (!['1', '2'].includes(m[1]) && !FIGURAS.includes(m[1])) fuera.push(`css/${f}: ${m[1]}px`)
    }
  }
  check('ningún contorno fuera de 1px y 2px', fuera.length === 0, [...new Set(fuera)].slice(0, 6).join(', '))

  // Y las tarjetas, todas del mismo grosor: la de guía llevaba 2px y la
  // de perfil 1, y juntas se veían de dos épocas distintas.
  // `.guide-card` la pinta /categoria y /guardados (js/guide-card.js);
  // /aprender tiene su propia tarjeta.
  const { page } = await abrir('/categoria?slug=basico', {
    semillas: { __FAKE_GUIAS__: [{ id: 'g1', slug: 'g1', title: 'Guía', category_id: 'cat-1' }] },
  })
  const borde = await page.locator('.guide-card').first().evaluate((n) => getComputedStyle(n).borderTopWidth)
  check('la tarjeta de guía tiene el borde fino', borde === '1px', String(borde))
  // Y la de la ficha de persona, el mismo: eran las dos que se veían de
  // épocas distintas una al lado de la otra.
  const { page: perfil } = await abrir('/perfil')
  const bordeFicha = await perfil.locator('.profile-hero').evaluate((n) => getComputedStyle(n).borderTopWidth)
  check('  …el mismo que la tarjeta del perfil', bordeFicha === borde, `${bordeFicha} vs ${borde}`)
  await perfil.close()
  await page.close()

  // Los radios que YA valen lo que vale un token no se escriben a pelo.
  const TOKENS = { 7: 'sm', 10: 'md', 14: 'lg', 18: 'xl', 999: 'pill' }
  const pelo = []
  for (const f of hojas) {
    for (const m of sinComentarios(leer(`css/${f}`)).matchAll(/border-radius:\s*([0-9.]+)px\s*;/g)) {
      if (TOKENS[m[1]]) pelo.push(`css/${f}: ${m[1]}px (es --radius-${TOKENS[m[1]]})`)
    }
  }
  check('ningún radio repite a pelo el valor de un token', pelo.length === 0, [...new Set(pelo)].slice(0, 5).join(', '))
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
