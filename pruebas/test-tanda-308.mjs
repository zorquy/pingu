import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

// Tanda 308: las pestañas del perfil dicen cuánto hay y se abre la que
// tiene algo; y /noticias y /aprender cargan con la silueta de lo que
// van a enseñar.
//
// De dónde viene: PINGU, «¿además qué mejoras me propones?», después de
// arreglar la pestaña «Foro».

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

// Cuatro temas y nueve mensajes: trece cosas en el foro, y el muro vacío.
const SEMILLAS = {
  __FAKE_FOROS__: [{ id: 'foro-1', name: 'General', slug: 'general' }],
  __FAKE_TEMAS__: Array.from({ length: 4 }, (_, i) => ({ id: `tema-${i + 1}`, author_id: 'user-1', title: `Tema ${i + 1}` })),
  __FAKE_MENSAJES__: Array.from({ length: 9 }, (_, i) => ({ id: `msg-${i + 1}`, author_id: 'user-1' })),
}

const abrir = async (ruta, { sesion = 'user-1', semillas = SEMILLAS, ancho = 1000, js = true } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 900 }, javaScriptEnabled: js })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  if (js) {
    await page.addInitScript((s) => {
      for (const [k, v] of Object.entries(s)) window[k] = v
    }, { __FAKE_SESSION__: sesion, ...semillas })
  }
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(js ? 3000 : 500)
  return { page, errores }
}

const activa = async (page) => (await page.locator('.tab-btn.active').textContent())?.replace(/\d+$/, '').trim()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Cada pestaña dice cuánto hay ──')
{
  for (const [ruta, sesion] of [['/perfil', 'user-1'], ['/usuario?u=Ash', 'user-2']]) {
    const { page, errores } = await abrir(ruta, { sesion })
    check(`${ruta}: sin errores de JavaScript`, errores.length === 0, errores[0] || '')
    const foro = await page.locator('.tab-btn[data-ptab="foro"] .pest-cuenta').textContent()
    check(`${ruta}: la del foro suma temas y mensajes`, foro === '13', String(foro))
    // El cero NO se pinta: «Muro 0» ocupa sitio para decir que no hay
    // nada, y para eso ya está el panel cuando entras.
    check(`${ruta}: la del muro, vacía, no lleva chapa`,
      (await page.locator('.tab-btn[data-ptab="wall"] .pest-cuenta').count()) === 0)
    await page.close()
  }
  // Y que la chapa no se salga con un número largo.
  const { page } = await abrir('/perfil', {
    semillas: { ...SEMILLAS, __FAKE_MENSAJES__: Array.from({ length: 140 }, (_, i) => ({ id: `m${i}`, author_id: 'user-1' })) },
  })
  const mucho = await page.locator('.tab-btn[data-ptab="foro"] .pest-cuenta').textContent()
  check('con más de 99 se recorta a 99+', mucho === '99+', String(mucho))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Se abre la pestaña que tiene algo ──')
{
  // «Muro» era siempre la primera y en casi todos los perfiles está
  // vacía: entrabas y te encontrabas un «todavía no hay nada escrito»
  // con 13 cosas a una pestaña de distancia.
  for (const [ruta, sesion] of [['/perfil', 'user-1'], ['/usuario?u=Ash', 'user-2']]) {
    const { page } = await abrir(ruta, { sesion })
    check(`${ruta}: con el muro vacío se abre el foro`, (await activa(page)) === 'Foro', await activa(page))
    // Y el panel que se ve es el suyo, no solo el botón marcado.
    check(`${ruta}:   …y lo que se ve es su panel`, await page.locator('#ptab-foro').isVisible())
    await page.close()
  }

  // Con el muro CON algo manda el muro: es donde se te escribe a ti.
  const { page } = await abrir('/perfil', {
    semillas: { ...SEMILLAS, __FAKE_MURO__: [{ id: 'c1' }, { id: 'c2' }] },
  })
  const cual = await activa(page)
  check('con el muro lleno se queda en el muro', cual === 'Muro', cual)
  await page.close()

  // Sin NADA en ninguna parte se queda en el muro: no hay a dónde ir, y
  // dejar la página sin ninguna pestaña activa sería peor.
  const { page: vacio } = await abrir('/usuario?u=Misty', { sesion: 'user-1', semillas: {} })
  check('sin nada en ninguna parte, se queda en el muro', (await activa(vacio)) === 'Muro', await activa(vacio))
  await vacio.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Quien manda es quien mira ──')
{
  // Un #hash es una intención explícita —lo pone un aviso de la
  // campanita, o alguien que comparte el enlace— y gana siempre.
  const { page } = await abrir('/perfil#guides')
  check('con #guides se abre Guías aunque el foro tenga 13', (await activa(page)) === 'Guías', await activa(page))
  await page.close()

  // Y si ya has tocado tú una pestaña, la página no te mueve de sitio.
  //
  // El primer intento de esta prueba pulsaba «pronto» y esperaba ganarle
  // la carrera a las cuentas. NO la ganaba: con el doble las cuentas
  // llegan en ~80 ms y el clic caía después, así que la página abría el
  // foro, el clic lo cambiaba a «Acerca» y el resultado era el mismo con
  // la guarda puesta y quitada. El rigor lo cazó: la comprobación no
  // ejercitaba nada.
  //
  // Sin carreras: se deja que la página se asiente, se pulsa de verdad y
  // se vuelve a pedir la apertura automática. Si la guarda funciona, no
  // se mueve. El módulo se importa desde la propia página, así que es la
  // MISMA instancia y el mismo estado — no una copia.
  const { page: asentada } = await abrir('/perfil')
  await asentada.locator('.tab-btn[data-ptab="about"]').click()
  await asentada.waitForTimeout(300)
  check('al pulsar, se va a Acerca', (await activa(asentada)) === 'Acerca', await activa(asentada))
  await asentada.evaluate(async () => {
    const m = await import('/js/perfil-pestanias.js')
    m.abrirLaQueTengaAlgo()
  })
  await asentada.waitForTimeout(300)
  const sigue = await activa(asentada)
  check('  …y ya no te mueve de ahí aunque vuelva a tocarle', sigue === 'Acerca', String(sigue))
  await asentada.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. /noticias y /aprender cargan con su forma ──')
{
  // Con el JavaScript apagado: es el primer fotograma de verdad, sin
  // carreras contra el `waitUntil`.
  const { page: n } = await abrir('/noticias', { js: false })
  check('/noticias: seis siluetas de tarjeta', (await n.locator('.esq-tarjeta').count()) === 6)
  // La silueta tiene que PARECERSE a lo que llega: portada arriba y
  // texto debajo. Un rectángulo gris no es un esqueleto, es un hueco.
  check('  …cada una con su portada', (await n.locator('.esq-tarjeta .esq-bloque').count()) === 6)
  check('  …y con sus renglones', (await n.locator('.esq-tarjeta .esq-linea').count()) === 18)
  const anchoCard = await n.locator('.esq-tarjeta .esq-bloque').first().evaluate((x) => x.getBoundingClientRect())
  check('  …y la portada es apaisada, como la de verdad', anchoCard.width > anchoCard.height, JSON.stringify(anchoCard))
  check('  …y se avisa a un lector de pantalla', /cargando/i.test((await n.locator('.sr-only').first().textContent()) || ''))
  await n.close()

  const { page: a } = await abrir('/aprender', { js: false })
  check('/aprender: cuatro siluetas de guía', (await a.locator('.esq-guia').count()) === 4)
  // La guía es HORIZONTAL: icono a la izquierda y texto a la derecha.
  const caja = await a.locator('.esq-guia').first().evaluate((g) => {
    const i = g.querySelector('i').getBoundingClientRect()
    const c = g.querySelector('.esq-cuerpo').getBoundingClientRect()
    return {
      ancho: Math.round(i.width),
      cuadrado: Math.abs(i.width - i.height) < 2,
      iconoIzq: i.right <= c.left + 1,
      // Que estén EN LA MISMA LÍNEA, no uno encima del otro: si la
      // tarjeta deja de ser flex, la <i> vuelve a ser inline —el ancho
      // no se aplica a un inline— y se queda de tamaño cero encima del
      // texto. Medir solo «el icono está a la izquierda» daba verde con
      // la tarjeta rota, porque un icono de ancho cero está a la
      // izquierda de todo.
      mismaLinea: i.top < c.bottom && c.top < i.bottom,
    }
  })
  check('  …con un icono de tamaño de verdad', caja.ancho >= 40, JSON.stringify(caja))
  check('  …cuadrado, como el de la tarjeta', caja.cuadrado, JSON.stringify(caja))
  check('  …a la izquierda del texto y en su misma línea',
    caja.iconoIzq && caja.mismaLinea, JSON.stringify(caja))
  check('  …y se avisa a un lector de pantalla', /cargando/i.test((await a.locator('.sr-only').first().textContent()) || ''))
  await a.close()

  // Y el esqueleto SE VA cuando llegan los datos: si se quedara, la
  // página enseñaría siluetas debajo de las noticias de verdad.
  const { page: viva } = await abrir('/noticias', {
    semillas: { __FAKE_NOTICIAS__: Array.from({ length: 3 }, (_, i) => ({ id: `n${i}`, slug: `n${i}` })) },
  })
  check('cuando llegan las noticias, la silueta desaparece', (await viva.locator('.esq-tarjeta').count()) === 0)
  check('  …y salen las noticias', (await viva.locator('.noticia-tarjeta, .noticia-titular').count()) > 0)
  await viva.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. La mecánica de las pestañas vive en un solo sitio ──')
{
  // Estaba copiada en perfil.js y usuario.js, con el mismo bucle y el
  // mismo bloque del #hash escritos dos veces.
  const modulo = leer('js/perfil-pestanias.js')
  check('existe js/perfil-pestanias.js', modulo.length > 0)
  for (const f of ['js/perfil.js', 'js/usuario.js']) {
    const src = leer(f)
    check(`${f}: lo usa`, /from '\.\/perfil-pestanias\.js'/.test(src))
    check(`${f}:   …y ya no se monta las pestañas por su cuenta`,
      !/querySelectorAll\('\.tab-btn'\)\.forEach/.test(src) && !/tab-btn'\).forEach\(\(b\)/.test(src))
  }
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
