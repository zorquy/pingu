import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// /noticias, que hasta la tanda 308 NO tenía ni una prueba: un cambio
// ahí salía a producción sin red debajo. Lo pidió PINGU en la lista de
// mejoras — «el hueco grande que queda».
//
// Una noticia es una fila de `guides` con `kind = 'news'`. Eso es lo que
// más importa aquí: que los dos listados no se mezclen.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const noticia = (i, extra = {}) => ({
  id: `n-${i}`,
  slug: `noticia-${i}`,
  title: `Noticia ${i}`,
  description: `Resumen ${i}`,
  kind: 'news',
  review_status: 'published',
  published_at: new Date(Date.now() - i * 3600e3).toISOString(),
  ...extra,
})

const abrir = async (ruta, { sesion = 'none', semillas = {}, ancho = 1100 } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, { __FAKE_SESSION__: sesion, ...semillas })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Las noticias se ven ──')
{
  const { page, errores } = await abrir('/noticias', {
    semillas: { __FAKE_NOTICIAS__: [1, 2, 3, 4].map((i) => noticia(i)) },
  })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  // La más reciente va GRANDE y las demás en la rejilla: cuatro
  // noticias son un titular y tres tarjetas, no cuatro tarjetas.
  check('la más reciente sale como titular', (await page.locator('.noticia-titular').count()) === 1)
  check('  …y es la más reciente de verdad',
    /Noticia 1/.test((await page.locator('.noticia-titular').textContent()) || ''),
    (await page.locator('.noticia-titular').textContent())?.slice(0, 40))
  check('las otras tres van en la rejilla', (await page.locator('.noticia-tarjeta').count()) === 3)
  // Y el titular NO se repite abajo: se sacó de la lista con un `...resto`.
  const enRejilla = await page.locator('.noticia-tarjeta').evaluateAll((ns) => ns.map((n) => n.textContent))
  check('  …y la del titular no se repite en la rejilla', !enRejilla.some((t) => /Noticia 1\b/.test(t)), JSON.stringify(enRejilla.map((t) => t.slice(0, 18))))
  check('cada una lleva a su ficha',
    (await page.locator('.noticia-tarjeta').first().getAttribute('href'))?.includes('noticia-'))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Las guías NO son noticias (ni al revés) ──')
{
  // Comparten tabla: este es EL fallo que puede pasar aquí, y no se ve
  // hasta que alguien publica una guía y aparece en /noticias.
  const { page } = await abrir('/noticias', {
    semillas: {
      __FAKE_NOTICIAS__: [noticia(1)],
      __FAKE_GUIAS__: [{ id: 'g1', slug: 'guia-1', title: 'Guía de Charizard', kind: 'guide' }],
    },
  })
  const texto = (await page.locator('main').textContent()) || ''
  check('una guía no se cuela en /noticias', !/Charizard/.test(texto))
  check('  …y la noticia sí está', /Noticia 1/.test(texto))
  await page.close()

  // Y al revés: /aprender no puede llenarse de noticias.
  const { page: ap } = await abrir('/aprender', {
    semillas: {
      __FAKE_NOTICIAS__: [noticia(1, { title: 'Esto es una noticia' })],
      __FAKE_GUIAS__: [{ id: 'g1', slug: 'guia-1', title: 'Guía de Charizard', kind: 'guide' }],
      __FAKE_CATEGORIAS__: [{ id: 'cat-1', name: 'Básico', slug: 'basico' }],
    },
  })
  const textoAp = (await ap.locator('main').textContent()) || ''
  check('una noticia no se cuela en /aprender', !/Esto es una noticia/.test(textoAp))
  await ap.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Sin noticias, y sin romperse ──')
{
  const { page, errores } = await abrir('/noticias', { semillas: { __FAKE_NOTICIAS__: [] } })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const texto = (await page.locator('#noticiasRejilla').textContent()) || ''
  check('lo dice con palabras', /todavía no hay noticias/i.test(texto), texto.trim().slice(0, 60))
  // Y no se queda la silueta puesta encima del mensaje.
  check('  …y la silueta se ha ido', (await page.locator('.esq-tarjeta').count()) === 0)
  check('  …y no hay titular vacío', (await page.locator('.noticia-titular').count()) === 0)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. «Ver más» solo cuando hay más ──')
{
  // Se piden 13 para pintar 12: así se sabe si queda alguna sin contar
  // la tabla entera. Con 13 tiene que salir el botón.
  const { page } = await abrir('/noticias', {
    semillas: { __FAKE_NOTICIAS__: Array.from({ length: 13 }, (_, i) => noticia(i + 1)) },
  })
  check('con 13 noticias sale el botón de ver más', (await page.locator('#btnMasNoticias').count()) === 1)
  check('  …y se han pintado 12 (un titular y once tarjetas)',
    (await page.locator('.noticia-tarjeta').count()) === 11)
  await page.locator('#btnMasNoticias').click()
  await page.waitForTimeout(1200)
  check('  …y al pulsarlo llega la que faltaba', (await page.locator('.noticia-tarjeta').count()) === 12)
  check('  …y el botón desaparece cuando no queda ninguna', (await page.locator('#btnMasNoticias').count()) === 0)
  await page.close()

  const { page: pocas } = await abrir('/noticias', {
    semillas: { __FAKE_NOTICIAS__: Array.from({ length: 5 }, (_, i) => noticia(i + 1)) },
  })
  check('con cinco no sale el botón', (await pocas.locator('#btnMasNoticias').count()) === 0)
  await pocas.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. «Escribir noticia» es solo del equipo ──')
{
  // El candado de verdad está en la base (un disparador devuelve la fila
  // a «guía» si quien escribe no es del equipo). Esto es no enseñar un
  // botón que no lleva a ninguna parte.
  const semillas = { __FAKE_NOTICIAS__: [noticia(1)] }
  for (const [quien, sesion, debe] of [
    ['sin cuenta', 'none', false],
    ['alguien normal', 'user-1', false],
    ['administración', 'admin-1', true],
  ]) {
    const { page } = await abrir('/noticias', { sesion, semillas })
    const hay = (await page.locator('#noticiasEscribir a').count()) === 1
    check(`${quien}: ${debe ? 'sí' : 'no'} ve «Escribir noticia»`, hay === debe)
    if (debe) {
      // Con `?tipo=noticia`: el editor abre ya puesto en noticia, que es
      // la diferencia entre escribir una noticia y acordarse de marcarla.
      const href = await page.locator('#noticiasEscribir a').getAttribute('href')
      check('  …y el editor abre ya puesto en noticia', /tipo=noticia/.test(href || ''), String(href))
    }
    await page.close()
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Nada se sale de la pantalla ──')
{
  for (const ancho of [320, 393, 1280]) {
    const { page } = await abrir('/noticias', {
      ancho,
      semillas: { __FAKE_NOTICIAS__: Array.from({ length: 6 }, (_, i) => noticia(i + 1)) },
    })
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(`${ancho}px: sin scroll lateral`, sobra <= 1, `sobran ${sobra}px`)
    await page.close()
  }
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
