import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

// Tanda 312: las seis mejoras visuales que eligió PINGU, con sus
// prototipos delante.
//
// De dónde viene: «dame mejoras visuales con ejemplos en imágenes».
// Cada bloque comprueba LA FORMA del fallo, no el caso: el hueco vacío
// de una tarjeta, el pie que no ofrece nada, la fila que repite, el
// hueco de imagen que parece roto y lo que no se puede tocar con un dedo.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const PAGINAS = readdirSync(RAIZ).filter((f) => f.endsWith('.html'))
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const SEMILLA = {
  __FAKE_CATEGORIAS__: [{ id: 'cat-1', name: 'Mazos', slug: 'mazos' }],
  __FAKE_GUIAS__: [
    { id: 'g1', slug: 'g1', title: 'Cómo montar tu primer mazo', description: 'Un resumen.', category_id: 'cat-1', level: 'beginner', estimated_mins: 8, guide_rarity: 'bronze' },
  ],
  __FAKE_NOTICIAS__: [{ id: 'n1', slug: 'n1', title: 'Una noticia', description: 'La entradilla.' }],
}

const abrir = async (ruta, { ancho = 1100, alto = 900, sesion = 'user-1', semillas = SEMILLA, tema = 'light', movil = false } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript((s) => {
    localStorage.setItem('pokedoc-theme', s.__TEMA__)
    window.__FAKE_SESSION__ = s.__SESION__
    for (const [k, v] of Object.entries(s.__SEM__)) window[k] = v
  }, { __TEMA__: tema, __SESION__: sesion, __SEM__: semillas })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La franja de color de la tarjeta de guía dice algo ──')
{
  // Eran 100 px —un tercio de la tarjeta— con un degradado y nada
  // dentro. Y la CATEGORÍA no salía en la tarjeta por ningún lado,
  // aunque los chips de arriba filtren justo por eso.
  const { page, errores } = await abrir('/aprender')
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const m = await page.evaluate(() => {
    const arte = document.querySelector('.guia-tarjeta .guia-arte')
    if (!arte) return null
    const info = arte.querySelector('.guia-arte-info')
    const cat = arte.querySelector('.guia-chapa-cat')
    const min = arte.querySelector('.guia-chapa-min')
    const ca = arte.getBoundingClientRect()
    const trozo = (n) => (n ? n.getBoundingClientRect() : null)
    return {
      texto: { cat: cat?.textContent.trim() || null, min: min?.textContent.trim() || null },
      // Que estén DENTRO de la franja y no debajo: una chapa que se
      // pinta bien pero cae fuera de la caja no ha llenado nada.
      dentro: [trozo(cat), trozo(min)].every((r) => r && r.top >= ca.top - 1 && r.bottom <= ca.bottom + 1),
      // Y una a cada lado, que es lo que reparte el hueco.
      catIzq: trozo(cat)?.left, minDer: trozo(min)?.right, arteIzq: ca.left, arteDer: ca.right,
      hayInfo: !!info,
    }
  })
  check('la franja lleva su fila de información', m?.hayInfo === true)
  check('  …con el nombre de la categoría', m?.texto.cat === 'Mazos', JSON.stringify(m?.texto))
  check('  …y los minutos de lectura', m?.texto.min === '8 min', JSON.stringify(m?.texto))
  check('  …las dos DENTRO de la franja', m?.dentro === true, JSON.stringify(m))
  check('  …y una a cada lado',
    m && m.catIzq - m.arteIzq < 24 && m.arteDer - m.minDer < 24, JSON.stringify(m))

  // El pie de la tarjeta: la barra se pinta SIEMPRE. Antes aparecía solo
  // si habías empezado, así que dos tarjetas seguidas tenían pies de
  // altura distinta y la rejilla se veía descuadrada.
  const pie = await page.evaluate(() => {
    const p = document.querySelector('.guia-progreso')
    const b = p?.querySelector('.guia-barra')
    if (!p || !b) return null
    const rp = p.getBoundingClientRect(), rb = b.getBoundingClientRect()
    const rt = p.querySelector('.guia-progreso-texto').getBoundingClientRect()
    return {
      hayBarra: true,
      // En LÍNEA, no apilados: el texto y la barra a la misma altura.
      mismaLinea: Math.abs(rb.top + rb.height / 2 - (rt.top + rt.height / 2)) < 6,
      textoIzq: rt.left < rb.left,
      raya: getComputedStyle(p).borderTopWidth,
      relleno: p.querySelector('.guia-barra i')?.style.width,
    }
  })
  check('la barra de progreso está aunque no hayas empezado', pie?.hayBarra === true)
  check('  …con el relleno a cero', pie?.relleno === '0%', pie?.relleno)
  check('  …en la misma línea que el estado, y a su derecha',
    pie?.mismaLinea === true && pie?.textoIzq === true, JSON.stringify(pie))
  check('  …separada del resumen por una raya', pie && pie.raya !== '0px', pie?.raya)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El pie de página ofrece algo, y las páginas cortas no dejan un vacío ──')
{
  // El pie era un copyright y tres enlaces. El problema de fondo no era
  // el pie: `min-height: 100vh` en el contenido obligaba a CADA página a
  // medir una pantalla entera, así que una lista con un elemento dejaba
  // cientos de píxeles de nada y encima había que hacer scroll.
  const { page } = await abrir('/torneos', { alto: 900 })
  const r = await page.evaluate(() => {
    const f = document.querySelector('footer.footer')
    const cols = f.querySelectorAll('.pie-col')
    const main = document.querySelector('.page-content')
    const rm = main.getBoundingClientRect()
    const rf = f.getBoundingClientRect()
    const ultimo = [...main.querySelectorAll('*')]
      .filter((n) => n.getBoundingClientRect().height > 0)
      .reduce((max, n) => Math.max(max, n.getBoundingClientRect().bottom), rm.top)
    return {
      columnas: cols.length,
      enlaces: f.querySelectorAll('a').length,
      // El hueco entre lo último que hay escrito y el pie.
      hueco: Math.round(rf.top - ultimo),
      minAlto: parseFloat(getComputedStyle(main).minHeight) || 0,
      alturaDoc: Math.round(document.documentElement.scrollHeight),
      pantalla: window.innerHeight,
      anchoMain: Math.round(rm.width),
      anchoVentana: window.innerWidth,
    }
  })
  check('el pie tiene columnas de secciones', r.columnas >= 3, String(r.columnas))
  check('  …y enlaza a bastantes sitios', r.enlaces >= 12, String(r.enlaces))
  // LA FORMA del fallo, que no es «cuánto hueco queda» —una página con
  // una tarjeta deja hueco por definición— sino que el CONTENIDO estaba
  // obligado a medir una pantalla entera él solo, así que el pie caía
  // debajo de eso y había que bajar a buscarlo.
  check('el contenido no está obligado a medir una pantalla', r.minAlto < r.pantalla,
    `min-height ${r.minAlto} con pantalla de ${r.pantalla}`)
  check('  …así que una página corta cabe sin hacer scroll', r.alturaDoc <= r.pantalla + 2,
    `${r.alturaDoc} vs ${r.pantalla}`)
  // Y la columna no se encogió al volver el cuerpo flexible: un margen
  // automático en el eje transversal anula el estirado.
  check('  …sin que el contenido se estreche', r.anchoMain > r.anchoVentana * 0.9,
    `${r.anchoMain} de ${r.anchoVentana}`)
  await page.close()

  // En TODAS las páginas que lo tienen, no solo en la que acabo de
  // mirar: la lección de la tanda 303.
  const sinPie = PAGINAS.filter((f) => !/<footer class="footer">/.test(leer(f)))
  check('las 22 páginas con pie lo tienen nuevo',
    PAGINAS.length - sinPie.length === 22, `${PAGINAS.length - sinPie.length} de ${PAGINAS.length}`)
  // En CADA página, y con sus piezas contadas. Mirar solo si aparece la
  // palabra «pie-rejilla» dejaba pasar una página con la rejilla pero
  // sin columnas — el rigor metió justo esa y salió verde.
  const rotas = PAGINAS.filter((p) => {
    const html = leer(p)
    if (!/<footer class="footer">/.test(html)) return false
    const pie = html.slice(html.indexOf('<footer class="footer">'))
    // La clase ENTERA entre comillas, no la palabra suelta: buscar
    // «pie-rejilla» daba por buena una `pie-rejilla-no`, que es
    // exactamente lo que metió el rigor. Un `includes` de un nombre de
    // clase acepta cualquier cosa que empiece igual.
    return !/class="pie-rejilla"/.test(pie) ||
      (pie.match(/class="pie-col"/g) || []).length < 3 ||
      (pie.match(/pie-titulo/g) || []).length < 3
  })
  check('  …ninguna se quedó con el de antes ni a medias', rotas.length === 0, rotas.join(', '))
  // Y el enlace de feedback lo engancha el JavaScript a `.footer-links`:
  // si el pie nuevo no lo llevara, desaparecería del sitio entero.
  const sinAncla = PAGINAS.filter((f) => /<footer class="footer">/.test(leer(f)) && !/footer-links/.test(leer(f)))
  check('  …y todas conservan el ancla del feedback', sinAncla.length === 0, sinAncla.join(', '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Los números de la comunidad son un bloque, no cuatro cajas ──')
{
  const { page } = await abrir('/usuarios')
  const r = await page.evaluate(() => {
    const caja = document.querySelector('.com-cifras')
    const hijos = [...caja.querySelectorAll('.com-cifra')]
    const s = getComputedStyle(caja)
    return {
      cuantos: hijos.length,
      bordeFuera: s.borderTopWidth,
      // Ninguno de dentro lleva su propio borde completo ni su sombra:
      // eso es lo que los hacía cuatro tarjetas sueltas.
      sombrasDentro: hijos.filter((n) => getComputedStyle(n).boxShadow !== 'none').length,
      alto: Math.round(caja.getBoundingClientRect().height),
    }
  })
  check('los cuatro números van en una sola caja', r.cuantos === 4 && r.bordeFuera !== '0px', JSON.stringify(r))
  check('  …y ninguno lleva sombra propia', r.sombrasDentro === 0, String(r.sombrasDentro))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. La actividad no repite la misma palabra ni el mismo icono ──')
{
  // Cinco filas seguidas empezaban por «Nueva noticia:» y además
  // llevaban el MISMO icono a la izquierda y a la derecha.
  const { page } = await abrir('/usuarios', {
    semillas: { ...SEMILLA, __FAKE_NOTICIAS__: [1, 2, 3].map((i) => ({ id: `n${i}`, slug: `n${i}`, title: `Noticia ${i}`, description: 'x' })) },
  })
  const r = await page.evaluate(() => {
    const filas = [...document.querySelectorAll('.activity-item')]
    return filas.map((f) => ({
      chapa: f.querySelector('.activity-tipo')?.textContent.trim() || null,
      // El icono de tipo a la derecha solo aporta cuando a la izquierda
      // hay la cara de una persona.
      iconos: f.querySelectorAll('svg').length,
      deLaCasa: !!f.querySelector('.activity-avatar-casa'),
      empieza: (f.querySelector('p')?.textContent || '').trim().slice(0, 14),
    }))
  })
  const casa = r.filter((f) => f.deLaCasa)
  check('hay filas de lo que publica la casa', casa.length >= 2, String(casa.length))
  check('  …con su chapa de tipo', casa.every((f) => f.chapa), JSON.stringify(casa.slice(0, 2)))
  check('  …sin el icono repetido a los dos lados', casa.every((f) => f.iconos === 1), JSON.stringify(casa.map((f) => f.iconos)))
  check('  …y sin el «Nueva noticia:» delante del titular',
    casa.every((f) => !/^Nueva noticia/.test(f.empieza)), JSON.stringify(casa.map((f) => f.empieza)))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Una noticia sin foto no parece una imagen rota ──')
{
  const { page } = await abrir('/noticias')
  const r = await page.evaluate(() => {
    const h = document.querySelector('.noticia-portada-vacia')
    if (!h) return null
    const s = getComputedStyle(h)
    const icono = h.querySelector('svg')
    return {
      // Un fondo de verdad, no el gris de «aquí iba algo».
      degradado: /gradient/.test(s.backgroundImage),
      // Y opaco: lo que lo hacía parecer roto era el 45% de opacidad.
      opacidad: Number(s.opacity),
      sello: getComputedStyle(h, '::after').content,
      iconoAlto: icono ? Math.round(icono.getBoundingClientRect().height) : 0,
    }
  })
  check('el hueco sin foto tiene un fondo de la marca', r?.degradado === true, JSON.stringify(r))
  check('  …a plena opacidad', r?.opacidad === 1, String(r?.opacidad))
  check('  …con el sello del sitio', /PokeDoc/.test(r?.sello || ''), r?.sello)
  check('  …y el icono a un tamaño que se ve', r?.iconoAlto >= 30, String(r?.iconoAlto))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Lo que se pulsa con un dedo mide 44 px ──')
{
  // LA FORMA: se barren TODOS los controles visibles de ocho páginas en
  // una pantalla táctil y se mide su caja. No se comprueba «la campana
  // mide 44»: se comprueba que no quede ninguno corto.
  //
  // Las excepciones van DECLARADAS, no silenciadas, y las tres son las
  // que la propia norma admite:
  //
  //  · Un enlace dentro de una FRASE (los legales del pie, un nombre
  //    dentro de un texto). Estirarlo rompe el renglón que lo contiene.
  //  · Un enlace que repite un destino que YA cubre una caja más grande
  //    —el nombre dentro de la tarjeta de una persona, el título dentro
  //    de una tarjeta que entera es un enlace—.
  //  · La lista de actividad, que es un hilo compacto y cumple la otra
  //    salida de la norma: la de SEPARACIÓN. Sus filas están lo bastante
  //    lejos unas de otras como para que no se toque la de al lado.
  //
  // Si mañana alguien mete un botón de verdad en uno de esos sitios,
  // esta prueba no lo verá: por eso se lee aquí en vez de esconderse.
  const EXENTOS = /pie-enlace|footer-links|com-persona-nombre|guia-tarjeta-enlace/
  const EN_HILO = '.activity-item, .activity-list'
  const cortos = new Map()
  let medidos = 0
  for (const ruta of ['/index.html', '/aprender', '/foro', '/usuarios', '/torneos', '/perfil', '/mis-partidas', '/noticias']) {
    const { page } = await abrir(ruta, { ancho: 393, alto: 850, movil: true })
    const r = await page.evaluate((selHilo) => {
      window.__HILO__ = selHilo
      // La excepción «en línea», medida y no listada: un enlace cuyo
      // `display` calculado es `inline` ES texto corrido —una miga de
      // pan, un nombre dentro de una frase, un enlace legal del pie— y
      // estirarlo rompería el renglón. Un botón, una pestaña o un
      // enlace de tarjeta nunca son `inline`, así que esta salida no
      // deja pasar ningún control de verdad.
      const enLinea = (n) => n.tagName === 'A' && getComputedStyle(n).display === 'inline'
      return [...document.querySelectorAll('a, button, input:not([type=hidden]), select')]
        .filter((n) => n.offsetParent !== null)
        .map((n) => {
          const c = n.getBoundingClientRect()
          return {
            w: Math.round(c.width), h: Math.round(c.height),
            q: n.tagName + '.' + (n.className || '').toString().split(' ')[0],
            frase: enLinea(n), hilo: !!n.closest(window.__HILO__),
            conTexto: (n.textContent || '').trim().length > 0,
          }
        })
        .filter((x) => x.w > 0 && x.h > 0)
    }, EN_HILO)
    medidos += r.length
    for (const x of r) {
      if (x.frase || x.hilo || EXENTOS.test(x.q)) continue
      // Un control CON TEXTO mide de ancho lo que mide su palabra, y
      // eso no se puede —ni se debe— estirar: «Inicio» en una miga de
      // pan ocupa 34 px y forzarle 44 sería un área invisible pisando
      // al separador de al lado. Lo que sí se le puede pedir siempre es
      // ALTO. Un botón de solo icono no tiene esa excusa: ahí se piden
      // las dos.
      const corto = x.conTexto ? x.h < 44 : x.h < 44 || x.w < 44
      if (corto) cortos.set(x.q, `${x.w}×${x.h} ${x.q} (${ruta})`)
    }
    await page.close()
  }
  // Que el barrido LLEGUE: sin controles no hay nada corto y saldría
  // verde igual (lección de la 307).
  check('el barrido llega a los controles', medidos > 100, `${medidos} medidos`)
  check('ninguno se queda por debajo de 44×44', cortos.size === 0, [...cortos.values()].slice(0, 6).join(' | '))

  // Y el botón de tema: EXACTAMENTE uno a cualquier ancho. Esconder el
  // de la barra sin el gemelo del menú dejaría sin cambiar de tema a
  // quien tenga una pantalla estrecha; enseñar los dos es un duplicado.
  for (const ancho of [320, 359, 360, 393, 1280]) {
    const { page } = await abrir('/index.html', { ancho, alto: 700 })
    const cuantos = await page.evaluate(() => {
      const enBarra = document.getElementById('navThemeToggle')
      const enMenu = document.getElementById('navThemeToggleMenu')
      const vale = (n) => n && getComputedStyle(n).display !== 'none'
      return (vale(enBarra) ? 1 : 0) + (vale(enMenu) ? 1 : 0)
    })
    check(`[${ancho}px] hay exactamente un botón de tema`, cuantos === 1, String(cuantos))
    await page.close()
  }

  // Y el caso que se me pasó y cazó test-torneos-15: con un torneo EN
  // JUEGO la barra lleva un pasajero más —la chapa que te lleva a tu
  // partida—, y con todo a 44 px dejaba de caber. La regla sigue siendo
  // la misma: quepa lo que quepa, tiene que haber UN botón de tema y la
  // página no puede salirse de lado.
  for (const ancho of [320, 360, 393, 430]) {
    const { page } = await abrir('/torneos', {
      ancho, alto: 800,
      semillas: {
        ...SEMILLA,
        __FAKE_TORNEOS__: [{ slug: 'vivo', name: 'Copa de Interfaz Movil Con Nombre Largo', status: 'in_progress', max_players: 16, swiss_rounds: 4 }],
        __FAKE_INSCRIPCIONES__: [{ id: 'i1', tournament_id: 'torneo-1', user_id: 'user-1' }],
      },
    })
    const r = await page.evaluate(() => {
      const vale = (n) => n && getComputedStyle(n).display !== 'none'
      return {
        chapa: !!document.querySelector('.nav-torneo-vivo'),
        desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        temas: (vale(document.getElementById('navThemeToggle')) ? 1 : 0) + (vale(document.getElementById('navThemeToggleMenu')) ? 1 : 0),
        logo: Math.round(document.querySelector('.nav-logo').getBoundingClientRect().width),
      }
    })
    check(`[${ancho}px, torneo en juego] la barra no se sale`, r.desborde <= 1, `${r.desborde}px · chapa=${r.chapa}`)
    check(`  …sigue habiendo un botón de tema`, r.temas === 1, String(r.temas))
    // Antes de la tanda, con la chapa puesta el logo se encogía a 2 px:
    // la barra le robaba el sitio al nombre del sitio.
    check(`  …y el logo no se aplasta`, r.logo >= 26, `${r.logo}px`)
    await page.close()
  }
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
