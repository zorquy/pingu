import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

// Tanda 313: lo que no se ve.
//
// El salto al contenido, el <h1> que faltaba, las animaciones que no
// respetaban «menos movimiento» y el hueco de las imágenes. De la lista
// que aprobó PINGU; dos de sus puntos resultaron medir menos de lo que
// yo había contado y eso también se comprueba aquí, para que no vuelva
// a contarse mal.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const PAGINAS = readdirSync(RAIZ).filter((f) => f.endsWith('.html'))
const HOJAS = readdirSync(`${RAIZ}/css`).filter((f) => f.endsWith('.css')).map((f) => `css/${f}`)
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<![:'"`])\/\/[^\n]*/g, '')
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const abrir = async (ruta, { ancho = 1100, alto = 800, tema = 'light', movimiento = 'no-preference' } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto }, reducedMotion: movimiento })
  await page.addInitScript((t) => {
    localStorage.setItem('pokedoc-theme', t)
    window.__FAKE_SESSION__ = 'user-1'
  }, tema)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return page
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Con teclado se llega al contenido de un salto ──')
{
  // Antes había que pasar por los doce enlaces de la barra en CADA
  // página. Y el enlace tiene que ESTAR SIEMPRE en el documento: un
  // `display: none` lo sacaría del recorrido del tabulador, que es justo
  // lo que se necesita que funcione.
  for (const ruta of ['/index.html', '/foro', '/torneos']) {
    const page = await abrir(ruta)
    await page.keyboard.press('Tab')
    await page.waitForTimeout(400)
    const r = await page.evaluate(() => {
      const n = document.activeElement
      const c = n.getBoundingClientRect()
      const destino = n.getAttribute && n.getAttribute('href')
      return {
        clase: (n.className || '').toString(),
        arriba: Math.round(c.top),
        destino,
        anclaExiste: destino ? !!document.querySelector(destino) : false,
      }
    })
    check(`[${ruta}] lo primero que se enfoca es el salto`, /salta-al-contenido/.test(r.clase), r.clase)
    check('  …y al enfocarlo se ve', r.arriba >= 0, `top ${r.arriba}`)
    check('  …y su ancla existe de verdad', r.anclaExiste === true, r.destino)
    await page.close()
  }

  // Sin enfocarlo NO se ve: si se viera, saldría un botón azul flotando
  // en la esquina de las 22 páginas.
  const page = await abrir('/index.html')
  const escondido = await page.evaluate(() => {
    const n = document.querySelector('.salta-al-contenido')
    return Math.round(n.getBoundingClientRect().bottom) <= 0
  })
  check('sin enfocarlo, no se ve', escondido === true)
  await page.close()

  // En TODAS las que tienen barra, no solo en las tres que he mirado
  // (la lección de la tanda 303).
  const conBarra = PAGINAS.filter((p) => /<nav class="navbar"/.test(leer(p)))
  const sinSalto = conBarra.filter((p) => !/class="salta-al-contenido"/.test(leer(p)))
  // El ancla no se comprueba por su NOMBRE sino porque exista: dos
  // páginas apuntan a un id que ya tenían (#torneosContenido,
  // #torneoContenido) en vez de estrenar uno.
  const sinAncla = conBarra.filter((p) => {
    const html = leer(p)
    const m = html.match(/class="salta-al-contenido" href="#([^"]+)"/)
    return !m || !new RegExp('id="' + m[1] + '"').test(html)
  })
  check('todas las páginas con barra llevan el salto', sinSalto.length === 0, sinSalto.join(', '))
  check('  …y todas apuntan a un ancla que existe', sinAncla.length === 0, sinAncla.join(', '))

  // EL FALLO QUE COSTÓ OCHO PRUEBAS EN ROJO: el barrido que puso el
  // ancla metió un `id` en dos `<main>` QUE YA TENÍAN UNO. Un elemento
  // no puede llevar dos: el navegador se queda con el primero y el
  // `getElementById` del otro devuelve null — en /torneos y en /torneo
  // eso era un TypeError y la página entera en blanco.
  const dobles = []
  for (const p of PAGINAS) {
    for (const m of leer(p).matchAll(/<[a-z]+\b[^>]*>/g)) {
      if ((m[0].match(/\bid=/g) || []).length > 1) dobles.push(`${p}: ${m[0].slice(0, 50)}`)
    }
  }
  check('  …y ninguna etiqueta se quedó con dos id', dobles.length === 0, dobles.join(' | '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Cada página tiene un <h1>, y solo uno ──')
{
  // /perfil y /usuario eran las únicas sin ninguno: el nombre de la
  // persona iba en un <h2> y encima del documento no colgaba nada.
  for (const ruta of ['/index.html', '/aprender', '/foro', '/usuarios', '/torneos', '/noticias', '/perfil', '/usuario?u=Ash', '/mis-partidas']) {
    const page = await abrir(ruta)
    const n = await page.evaluate(() => document.querySelectorAll('h1').length)
    check(`[${ruta}] tiene exactamente un <h1>`, n === 1, String(n))
    await page.close()
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Quien pide menos movimiento, lo tiene ──')
{
  // LA FORMA, no el caso: se recorren TODAS las hojas y por cada
  // selector que anima se busca si alguna regla dentro de un @media de
  // `prefers-reduced-motion` lo apaga. Así una animación nueva sin red
  // cae aquí sola.
  const apaga = new Set()
  for (const hoja of HOJAS) {
    const t = sinComentarios(leer(hoja))
    for (const m of t.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/g)) {
      for (const r of m[1].matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!/animation|transition/.test(r[2])) continue
        for (const s of r[1].split(',')) apaga.add(s.trim())
      }
    }
  }
  const sinRed = []
  for (const hoja of HOJAS) {
    const limpio = sinComentarios(leer(hoja)).replace(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/g, '')
    for (const m of limpio.matchAll(/([^{}@]+)\{([^{}]*animation:\s*(?!none)[^;}]*)[;}]/g)) {
      const sel = m[1].split(/\s+/).join(' ').trim()
      // Dentro de un @keyframes los «selectores» son `from`, `to` y
      // porcentajes: no son reglas que se puedan apagar.
      if (!sel || /^(from|to|\d+%)/.test(sel)) continue
      if (sel.split(',').every((p) => apaga.has(p.trim()))) continue
      sinRed.push(`${hoja}: ${sel.slice(0, 50)}`)
    }
  }
  check('ninguna animación se queda sin su red', sinRed.length === 0, sinRed.slice(0, 5).join(' | '))
  check('  …y el barrido encuentra reglas que apagar', apaga.size > 20, `${apaga.size} selectores`)

  // EL FALLO QUE HABÍA DEBAJO: el globo de «+puntos» del curso se borra
  // solo al terminar su animación… y con «menos movimiento» esa
  // animación no corre, así que `animationend` no llegaba nunca y los
  // globos se iban apilando en el marcador, invisibles pero ahí.
  //
  // La forma: TODO lo que se borra al terminar una animación necesita un
  // temporizador detrás.
  for (const f of ['js/curso.js', 'js/curso-estimulos.js']) {
    const t = leer(f)
    const escuchas = [...t.matchAll(/addEventListener\('animationend'[\s\S]{0,400}?\n/g)]
    for (const m of escuchas) {
      const trozo = t.slice(m.index, m.index + 700)
      check(`${f}: lo que se borra al acabar la animación tiene temporizador`,
        /setTimeout\(\(\) =>[^)]*\.remove\(\)/.test(trozo), trozo.slice(0, 60).replace(/\n/g, ' '))
    }
  }

  // Y medido en el navegador, no solo leído.
  for (const modo of ['no-preference', 'reduce']) {
    const page = await abrir('/foro', { movimiento: modo })
    const r = await page.evaluate(() => {
      const out = {}
      for (const c of ['esq-titular', 'achievement-card', 'lightbox', 'foro-mensaje-destello']) {
        const d = document.createElement('div')
        d.className = c
        document.body.appendChild(d)
        out[c] = getComputedStyle(d).animationName
        d.remove()
      }
      return out
    })
    const animan = Object.values(r).filter((x) => x !== 'none').length
    if (modo === 'reduce') check('[reduce] no anima ninguna de las cuatro', animan === 0, JSON.stringify(r))
    else check('[normal] las cuatro animan', animan === 4, JSON.stringify(r))
    await page.close()
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Toda imagen tiene su hueco reservado antes de llegar ──')
{
  // El número que yo había dado —«44 de 48 sin tamaño»— contaba
  // ATRIBUTOS, no saltos: casi todas tenían su caja decidida por CSS.
  // Medido de verdad, eran cuatro. Esta comprobación mira lo que
  // importa: que la caja esté decidida por ALGUNA de las tres vías —los
  // atributos, una proporción, o un alto fijo, suyo o del padre—.
  const css = sinComentarios(HOJAS.map(leer).join('\n'))
  const reserva = (clase) => {
    // El nombre ENTERO, con frontera detrás: `.x-no` contiene `.x` como
    // trozo de texto y daría por reservada una clase que ya no existe.
    // Es la trampa de la tanda 312, que aquí volvió a picar.
    const suyo = new RegExp('\\.' + clase.replace(/[-]/g, '\\-') + '(?![\\w-])')
    for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      if (!suyo.test(m[1])) continue
      if (/(?<!max-)(?<!min-)\bheight\s*:\s*(?!auto)/.test(m[2])) return true
      if (/aspect-ratio/.test(m[2])) return true
    }
    return false
  }
  const sinHueco = []
  const FUENTES = [...PAGINAS, ...readdirSync(`${RAIZ}/js`).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
                   ...readdirSync(`${RAIZ}/js/torneos`).filter((f) => f.endsWith('.js')).map((f) => `js/torneos/${f}`)]
  for (const f of FUENTES) {
    const t = leer(f)
    for (const m of t.matchAll(/<img\b[^>]*>/g)) {
      const tag = m[0]
      if (/width=/.test(tag) && /height=/.test(tag)) continue
      if (/style="[^"]*(height|aspect-ratio)/.test(tag)) continue
      // El hueco puede venir del JavaScript, calculado (la proporción
      // que guardan los bloques de curso desde esta tanda).
      if (/\$\{huecoDeImagen\(/.test(tag)) continue
      // Una clase puede llevar una interpolación dentro
      // (`class="torneo-imagen-preview ${oculta}"`). Se quitan los
      // `${…}` y se queda con los nombres de verdad: cortar en el primer
      // `$` dejaba la etiqueta sin nombre y la daba por huérfana aunque
      // su CSS existiera.
      const limpiar = (s) => s.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/).filter(Boolean)
      const cl = tag.match(/class="([^"]*)"/)
      const id = tag.match(/id="([^"]*)"/)
      const nombres = [...(cl ? limpiar(cl[1]) : []), ...(id ? limpiar(id[1]) : [])].filter(Boolean)
      if (nombres.some(reserva)) continue
      // Sin clase ni id: la caja la pone el padre. Eso no se puede leer
      // de aquí, así que se declara y se mira en el navegador más abajo.
      if (nombres.length === 0) continue
      sinHueco.push(`${f}: ${nombres[0]}`)
    }
  }
  check('ninguna imagen con clase se queda sin hueco reservado',
    sinHueco.length === 0, [...new Set(sinHueco)].slice(0, 6).join(', '))

  // `huecoDeImagen` (js/curso.js) se prueba EJECUTÁNDOLA. El doble de
  // Supabase todavía no sabe servir un curso, así que la función se saca
  // del fichero y se corre aquí: lo que importa es lo que devuelve, no
  // que alguien la llame. Si algún día el doble sirve cursos, esto se
  // cambia por abrir la pantalla y medir la caja.
  {
    const fuente = leer('js/curso.js')
    const m = fuente.match(/function huecoDeImagen\(ratio\) \{[\s\S]*?\n\}/)
    check('huecoDeImagen sigue existiendo', !!m)
    if (m) {
      // eslint-disable-next-line no-new-func
      const fn = new Function(`${m[0]}; return huecoDeImagen`)()
      check('  …reserva la proporción cuando el bloque la trae',
        /aspect-ratio:\s*1\.5/.test(fn(1.5)), JSON.stringify(fn(1.5)))
      check('  …y no se inventa ninguna cuando no la hay',
        fn(undefined) === '' && fn(0) === '' && fn('hola') === '',
        JSON.stringify([fn(undefined), fn(0), fn('hola')]))
    }
  }

  // Y en el navegador, sobre las que de verdad se pintan.
  const malas = new Map()
  let vistas = 0
  for (const ruta of ['/index.html', '/aprender', '/noticias', '/torneos', '/perfil', '/lanzamientos']) {
    const page = await abrir(ruta)
    const r = await page.evaluate(() => [...document.querySelectorAll('img')].map((n) => {
      const s = getComputedStyle(n)
      const p = n.parentElement ? getComputedStyle(n.parentElement) : null
      const fijo = (x) => x && x.height !== 'auto' && !x.height.startsWith('0')
      const ratio = (x) => x && x.aspectRatio && x.aspectRatio !== 'auto'
      return {
        ok: !!(n.getAttribute('width') && n.getAttribute('height')) || ratio(s) || fijo(s) || ratio(p) || fijo(p),
        q: (n.className || '').toString().split(' ')[0] || n.id || '(sin clase)',
      }
    }))
    vistas += r.length
    for (const x of r) if (!x.ok) malas.set(x.q, `${x.q} (${ruta})`)
    await page.close()
  }
  // El doble no trae fotos de verdad, así que se pintan pocas: el
  // umbral solo dice que el barrido LLEGA, no que haya muchas. Si
  // baja a cero, es que dejó de mirar y saldría verde por nada.
  check('el barrido llega a las imágenes', vistas >= 3, `${vistas} vistas`)
  check('  …y ninguna de las que se pintan se queda sin hueco', malas.size === 0, [...malas.values()].join(', '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. La descripción está donde sirve, y no donde no ──')
{
  // Otro número que yo había contado mal: «7 páginas sin meta
  // description». Las siete son exactamente las que llevan `noindex`,
  // o sea las que Google no mira — una descripción ahí no se enseña en
  // ningún sitio. Lo que sí importa es al revés, y es lo que se
  // comprueba: que no haya ninguna página INDEXABLE sin ella.
  const faltan = PAGINAS.filter((p) => {
    const t = leer(p)
    if (/name="robots"[^>]*content="[^"]*noindex/.test(t)) return false
    return !/name="description"/.test(t)
  })
  check('ninguna página indexable se queda sin descripción', faltan.length === 0, faltan.join(', '))
  const indexables = PAGINAS.filter((p) => !/name="robots"[^>]*content="[^"]*noindex/.test(leer(p)))
  check('  …y el barrido encuentra páginas indexables', indexables.length >= 15, String(indexables.length))
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
