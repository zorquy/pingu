import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

// Tanda 310: la escala de espaciado, los desplegables, los estados
// vacíos, las sombras y transiciones, la barra de una sola pestaña y la
// carga diferida de las imágenes.
//
// De dónde viene: PINGU, «¿más mejoras visuales?» — y esta vez medidas
// sobre el código antes de proponerlas.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const HOJAS = readdirSync(`${RAIZ}/css`).filter((f) => f.endsWith('.css')).map((f) => `css/${f}`)
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<![:'"`])\/\/[^\n]*/g, '')
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const abrir = async (ruta, { sesion = 'user-1', semillas = {}, ancho = 1100, tema = 'light' } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript((s) => {
    localStorage.setItem('pokedoc-theme', s.__TEMA__)
    for (const [k, v] of Object.entries(s)) if (k !== '__TEMA__') window[k] = v
  }, { __TEMA__: tema, __FAKE_SESSION__: sesion, ...semillas })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El espaciado no se elige a ojo ──')
{
  // 226 de los 31 valores distintos eran IMPARES: 3, 5, 7, 9, 11, 13…
  // los mismos «medio pasos» que tenían los tamaños de letra antes de la
  // tanda 305. Nada respiraba igual que lo de al lado.
  //
  // LA FORMA, no el caso: da igual qué impar sea, lo que no puede haber
  // es uno.
  const impares = []
  for (const hoja of HOJAS) {
    for (const m of sinComentarios(leer(hoja)).matchAll(/(?:padding|margin|gap)(?:-[a-z]+)?\s*:([^;]+);/g)) {
      for (const p of m[1].matchAll(/(\d+)px/g)) {
        const n = Number(p[1])
        if (n > 1 && n % 2 === 1) impares.push(`${hoja}: ${n}px`)
      }
    }
  }
  check('ningún espaciado impar en ninguna hoja', impares.length === 0, [...new Set(impares)].slice(0, 6).join(', '))

  const style = sinComentarios(leer('css/style.css'))
  const pasos = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'].map((p) => {
    const m = style.match(new RegExp(`--e-${p}:\\s*(\\d+)px`))
    return m ? Number(m[1]) : null
  })
  check('están los seis pasos de la escala', pasos.every((v) => v !== null), JSON.stringify(pasos))
  check('  …y van de menor a mayor', pasos.every((v, i) => i === 0 || v > pasos[i - 1]), JSON.stringify(pasos))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Los desplegables son del sitio, no del sistema ──')
{
  // Había 34 `<select>` y ni un `appearance: none`: heredaban el borde y
  // el radio, pero el navegador ponía SU flecha y SU altura.
  //
  // No se comprueba «lleva appearance: none»: se MIDE que un desplegable
  // se vea como el campo de al lado, que es lo que se notaba.
  const { page, errores } = await abrir('/mis-partidas')
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const medidas = await page.evaluate(() => {
    const visible = (n) => n.getBoundingClientRect().height > 0
    const sel = [...document.querySelectorAll('select')].find(visible)
    // A LA VISTA: el primer <input> de la página estaba oculto y medía 0
    // de alto, así que la comparación no comparaba nada.
    const inp = [...document.querySelectorAll('input[type="text"], input[type="search"], input:not([type])')].find(visible)
    if (!sel || !inp) return null
    const c = (n) => {
      const s = getComputedStyle(n)
      return { alto: Math.round(n.getBoundingClientRect().height), borde: s.borderTopWidth, radio: s.borderTopLeftRadius, tam: s.fontSize }
    }
    return { sel: c(sel), inp: c(inp), flecha: getComputedStyle(sel).backgroundImage }
  })
  check('hay un desplegable y un campo que comparar', medidas !== null)
  if (medidas) {
    check('el desplegable mide lo mismo de alto que el campo',
      Math.abs(medidas.sel.alto - medidas.inp.alto) <= 1, JSON.stringify([medidas.sel.alto, medidas.inp.alto]))
    check('  …con el mismo borde y el mismo radio',
      medidas.sel.borde === medidas.inp.borde && medidas.sel.radio === medidas.inp.radio,
      JSON.stringify([medidas.sel, medidas.inp]))
    check('  …y con NUESTRA flecha, no la del sistema', /url\(/.test(medidas.flecha), medidas.flecha.slice(0, 40))
  }
  await page.close()

  // Y en oscuro la flecha tiene que cambiar: el color va dentro del SVG,
  // así que una sola copia se quedaría invisible sobre el fondo oscuro.
  const { page: oscuro } = await abrir('/mis-partidas', { tema: 'dark' })
  const flechaOscura = await oscuro.locator('select').first().evaluate((n) => getComputedStyle(n).backgroundImage)
  check('en modo oscuro la flecha es otra', flechaOscura !== medidas?.flecha, 'igual que en claro')
  await oscuro.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Un estado vacío parece vacío, no a medio cargar ──')
{
  const { page } = await abrir('/guardados')
  const caja = await page.locator('.empty-state').first().evaluate((n) => {
    const s = getComputedStyle(n)
    return { borde: s.borderTopStyle, ancho: s.borderTopWidth, fondo: s.backgroundColor, radio: s.borderTopLeftRadius }
  })
  // El punteado dice «esto está vacío», que es justo la duda que dejaba
  // una frase gris flotando en medio de la página.
  check('el estado vacío tiene cuerpo', caja.borde === 'dashed' && caja.ancho !== '0px', JSON.stringify(caja))
  check('  …y esquinas redondeadas como el resto', caja.radio !== '0px', caja.radio)
  await page.close()

  // Dentro de una tarjeta que YA tiene borde, el punteado sobra: dos
  // bordes concéntricos se leen como un fallo de pintado.
  const dentro = leer('css/style.css')
  check('dentro de una tarjeta no se dobla el borde', /\.simple-card > \.empty-state/.test(dentro))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Las sombras y las transiciones tienen sistema ──')
{
  const duraciones = new Set()
  for (const hoja of HOJAS) {
    for (const m of sinComentarios(leer(hoja)).matchAll(/transition:[^;]*?([0-9.]+)s/g)) duraciones.add(m[1])
  }
  // Una duración para lo que responde a un gesto y otra para lo que
  // ENTRA en escena. Nueve se notaban como que unas cosas van «más
  // rápido» que otras sin motivo.
  check('solo dos duraciones de transición', duraciones.size === 2, [...duraciones].join(', '))

  check('existe el token de lo que flota', /--shadow-lg:\s*0/.test(sinComentarios(leer('css/style.css'))))
  // Y ya no se pide con respaldo: el respaldo existía porque el token no,
  // y mientras los dos convivan dicen cosas distintas.
  const conRespaldo = HOJAS.filter((h) => /var\(--shadow-lg,/.test(sinComentarios(leer(h))))
  check('  …y nadie lo pide ya con respaldo', conRespaldo.length === 0, conRespaldo.join(', '))

  // Los cuatro paneles que flotan sobre la página, con la misma sombra.
  const flotantes = ['.mencion-lista', '.foro-mod-menu', '.foro-mod-barra', '.selector-mazo-lista']
  const sueltos = []
  for (const hoja of HOJAS) {
    const t = sinComentarios(leer(hoja))
    for (const sel of flotantes) {
      // TODAS las sombras del bloque, no una. Con `[^}]*` codicioso el
      // regex encontraba la ÚLTIMA —la buena— y una sombra a pelo
      // añadida delante pasaba desapercibida. Lo cazó el rigor.
      const bloque = t.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`))
      if (!bloque) continue
      for (const m of bloque[1].matchAll(/box-shadow:\s*([^;]+);/g)) {
        if (!m[1].includes('var(')) sueltos.push(`${hoja}: ${sel} → ${m[1].trim().slice(0, 30)}`)
      }
    }
  }
  check('los paneles que flotan comparten sombra', sueltos.length === 0, sueltos.join(', '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Una barra de UNA pestaña no es una barra ──')
{
  const TORNEO = { id: 't1', slug: 'copa', name: 'Copa', status: 'registration_open', admin_id: 'admin-1', max_players: 8, swiss_rounds: 3 }
  const { page } = await abrir('/torneo?slug=copa', {
    sesion: 'none',
    semillas: { __FAKE_TORNEOS__: [TORNEO], __FAKE_INSCRIPCIONES__: [{ id: 'i1', tournament_id: 't1', user_id: 'user-2', status: 'active' }] },
  })
  const n = await page.locator('#torneoPestanas .torneo-pestana').count()
  check('con inscripciones abiertas solo hay una pestaña', n === 1, String(n))
  check('  …y la barra no se enseña', !(await page.locator('#torneoPestanas').isVisible()))
  await page.close()

  // Con más de una, la barra vuelve: esconderla siempre sería perder la
  // navegación del torneo entero.
  const { page: enJuego } = await abrir('/torneo?slug=copa', {
    sesion: 'none',
    semillas: {
      __FAKE_TORNEOS__: [{ ...TORNEO, status: 'in_progress' }],
      __FAKE_INSCRIPCIONES__: [
        { id: 'i1', tournament_id: 't1', user_id: 'user-1', status: 'active' },
        { id: 'i2', tournament_id: 't1', user_id: 'user-2', status: 'active' },
      ],
      __FAKE_RONDAS__: [{ id: 'r1', tournament_id: 't1', number: 1, status: 'in_progress' }],
      __FAKE_MESAS__: [{ id: 'm1', round_id: 'r1', tournament_id: 't1', table_number: 1, player1_id: 'user-1', player2_id: 'user-2' }],
    },
  })
  const n2 = await enJuego.locator('#torneoPestanas .torneo-pestana').count()
  check('en juego hay más de una pestaña', n2 > 1, String(n2))
  check('  …y entonces la barra sí se enseña', await enJuego.locator('#torneoPestanas').isVisible())
  await enJuego.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Las imágenes de una lista no se piden todas de golpe ──')
{
  // DOS EXCEPCIONES, y las dos las encontró la suite cuando el barrido
  // de la tanda 310 metió el atributo a lo bruto en todas:
  //
  //  · js/noticias-foro.js arma el cuerpo de un mensaje de foro, que se
  //    GUARDA en `forum_posts.body_html`. Eso no es markup de una
  //    página: es contenido de la base, y el atributo se lo llevaría
  //    puesto cada anuncio futuro. Lo cazó test-tanda-273.
  //  · js/lightbox.js pinta la imagen que ACABAS de pulsar. Diferir eso
  //    es retrasar lo único que has pedido.
  //
  // Van declaradas aquí, no silenciadas: si mañana alguien mete una
  // imagen de lista en uno de esos dos ficheros, esta prueba no la verá,
  // y conviene que se lea.
  const EXCEPCIONES = new Set(['js/noticias-foro.js', 'js/lightbox.js'])
  const sinDiferir = []
  for (const dir of ['js', 'js/torneos']) {
    for (const f of readdirSync(`${RAIZ}/${dir}`)) {
      if (!f.endsWith('.js') || EXCEPCIONES.has(`${dir}/${f}`)) continue
      for (const m of leer(`${dir}/${f}`).matchAll(/<img [^>]*>/g)) {
        if (!/loading=/.test(m[0])) sinDiferir.push(`${dir}/${f}`)
      }
    }
  }
  check('toda imagen que pinta el JavaScript pide carga diferida',
    sinDiferir.length === 0, [...new Set(sinDiferir)].slice(0, 5).join(', '))

  // Y el cuerpo que se guarda en la base NO lleva atributos de pintado.
  check('  …salvo lo que se guarda en la base, que no lleva ninguno',
    !/loading=/.test(sinComentarios(leer('js/noticias-foro.js'))))
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
