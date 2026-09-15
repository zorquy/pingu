import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// La ficha de una guía y la de un curso, que hasta la tanda 308 NO
// tenían ninguna prueba. Son las dos pantallas donde vive el contenido
// del sitio: un cambio ahí salía a producción sin red debajo.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const BLOQUES = [
  { type: 'heading', text: 'Cómo se juega' },
  { type: 'paragraph', text: 'Primero robas siete cartas y buscas un básico.' },
  { type: 'heading', text: 'Los premios' },
  { type: 'paragraph', text: 'Seis cartas de premio: quien las coge todas gana.' },
]

const guia = (extra = {}) => ({
  id: 'g-1',
  slug: 'mi-guia',
  title: 'Empezar en el TCG',
  description: 'Lo básico para tu primera partida.',
  kind: 'guide',
  author_id: 'admin-1',
  review_status: 'published',
  published_at: '2026-08-01T10:00:00Z',
  reference_blocks: BLOQUES,
  category_id: 'cat-1',
  ...extra,
})

const abrir = async (ruta, { sesion = 'none', semillas = {}, ancho = 1100 } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, { __FAKE_SESSION__: sesion, __FAKE_CATEGORIAS__: [{ id: 'cat-1', name: 'Básico', slug: 'basico' }], ...semillas })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La guía se lee ──')
{
  const { page, errores } = await abrir('/guia?slug=mi-guia', { semillas: { __FAKE_GUIAS__: [guia()] } })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('sale el título', (await page.locator('#articleMain h1').textContent()) === 'Empezar en el TCG',
    await page.locator('#articleMain h1').textContent())
  // El CUERPO, que es lo que la gente viene a leer: los bloques de
  // referencia pintados, no el resumen de relleno.
  const cuerpo = (await page.locator('.article-body').textContent()) || ''
  check('  …y el texto de sus bloques', /robas siete cartas/.test(cuerpo) && /cartas de premio/.test(cuerpo), cuerpo.slice(0, 60))
  check('  …con sus encabezados', (await page.locator('.article-body h2, .article-body h3').count()) >= 2)
  // La miga de pan lleva a su categoría, no a un enlace vacío.
  const miga = await page.locator('.breadcrumb a').last().getAttribute('href')
  check('la miga de pan lleva a su categoría', /slug=basico/.test(miga || ''), String(miga))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El esqueleto se va cuando llega la guía ──')
{
  // Si se quedara, la página enseñaría la silueta debajo del artículo.
  const { page } = await abrir('/guia?slug=mi-guia', { semillas: { __FAKE_GUIAS__: [guia()] } })
  check('no queda ni una silueta', (await page.locator('.esq-articulo').count()) === 0)
  check('  …ni el aviso de «cargando» para lectores',
    !/cargando/i.test((await page.locator('.sr-only').first().textContent().catch(() => '')) || ''))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Una guía sin publicar lo dice ──')
{
  // Venía de creer que tienes una guía viva que no aparece en ningún
  // sitio: sin publicar se veía EXACTAMENTE igual que publicada.
  const { page } = await abrir('/guia?slug=mi-guia', {
    sesion: 'admin-1',
    semillas: { __FAKE_GUIAS__: [guia({ review_status: 'draft', published_at: null })] },
  })
  check('avisa de que no lo ve nadie', (await page.locator('.guia-aviso-borrador').count()) === 1)
  const aviso = (await page.locator('.guia-aviso-borrador').textContent()) || ''
  check('  …y dice que no sale en la web ni en buscadores', /no sale en la web/i.test(aviso), aviso.slice(0, 70))
  await page.close()

  // Y una publicada NO lleva ese aviso: si lo llevara, cada guía viva
  // diría que no la ve nadie.
  const { page: viva } = await abrir('/guia?slug=mi-guia', { sesion: 'admin-1', semillas: { __FAKE_GUIAS__: [guia()] } })
  check('una publicada no lo lleva', (await viva.locator('.guia-aviso-borrador').count()) === 0)
  await viva.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Una noticia tiene UNA dirección ──')
{
  // Se puede llegar a una noticia por /guia.html?slug=… (desde la
  // búsqueda, o desde un enlace viejo), pero la buena es /noticias/<slug>.
  // Dos direcciones con el mismo texto es lo que hace que Google vea dos
  // páginas donde hay una.
  const { page } = await abrir('/guia?slug=una-noticia', {
    semillas: { __FAKE_NOTICIAS__: [{ id: 'n1', slug: 'una-noticia', title: 'Sale un set nuevo', reference_blocks: BLOQUES }] },
  })
  check('la barra de direcciones se corrige sola', /\/noticias\/una-noticia/.test(page.url()), page.url())
  check('  …sin recargar (el artículo sigue pintado)',
    (await page.locator('#articleMain h1').textContent()) === 'Sale un set nuevo')
  // Y la miga de pan la manda a Noticias, no a una categoría vacía.
  const miga = (await page.locator('.breadcrumb').textContent()) || ''
  check('  …y la miga de pan dice Noticias', /Noticias/.test(miga), miga.trim().slice(0, 50))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. El JavaScript no se lleva por delante lo que ya estaba ──')
{
  // LA FORMA DEL FALLO de la tanda 270, que pasó de verdad al estrenar
  // las noticias: el servidor pinta el artículo en el HTML (para el
  // buscador y para quien comparte el enlace) y el JavaScript, que no
  // encontraba el slug, lo sustituyó por «Guía no encontrada». O sea que
  // un fallo del cliente se llevó por delante una página QUE YA ESTABA
  // BIEN. Con Supabase caído pasaría igual.
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } })
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_GUIAS__ = []
    // El artículo que habría dejado puesto la función de servidor.
    document.addEventListener('DOMContentLoaded', () => {
      const main = document.getElementById('articleMain')
      if (main) main.innerHTML = '<h1>Artículo puesto por el servidor</h1><div class="article-body"><p>Texto de verdad.</p></div>'
    })
  })
  await page.goto(`${BASE}/guia?slug=lo-que-sea`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const h1 = await page.locator('#articleMain h1').textContent().catch(() => null)
  check('un artículo ya pintado sobrevive a que el cliente no lo encuentre',
    h1 === 'Artículo puesto por el servidor', String(h1))
  check('  …y no lo sustituye por «no encontrada»',
    !/no encontrada/i.test((await page.locator('#articleMain').textContent()) || ''))
  await page.close()

  // Pero si NO había nada pintado, sí tiene que decirlo: si no, quien
  // llega a un enlace roto se queda mirando una página en blanco.
  const { page: vacia, errores } = await abrir('/guia?slug=no-existe', { semillas: { __FAKE_GUIAS__: [] } })
  check('sin nada pintado, dice que no la encuentra',
    /no encontrada/i.test((await vacia.locator('#articleMain').textContent()) || ''))
  check('  …y sin reventar', errores.length === 0, errores[0] || '')
  await vacia.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. La vista previa al compartir tiene dónde entrar ──')
{
  // Los marcadores que rellena la función de meta-social. Si alguien los
  // quita al tocar la plantilla, los enlaces compartidos vuelven a salir
  // sin título ni foto — y eso no se nota hasta que se comparte uno.
  const page = await browser.newPage({ javaScriptEnabled: false })
  await page.goto(`${BASE}/guia?slug=x`, { waitUntil: 'domcontentloaded' })
  const html = await page.content()
  check('guia.html conserva los marcadores del artículo',
    html.includes('articulo:inicio') && html.includes('articulo:fin'))
  check('  …y los de meta-social', html.includes('meta-social:inicio') && html.includes('meta-social:fin'))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. El curso ──')
{
  const curso = {
    id: 'c-1', slug: 'mi-curso', title: 'Practica tu primera partida', kind: 'course',
    review_status: 'published', published_at: '2026-08-01T10:00:00Z', category_id: 'cat-1',
    blocks: [
      { type: 'hook', headline: '¿Listo para jugar?', subtext: 'Vamos con tu primera partida.' },
      { type: 'concept', title: 'El turno', body: 'Robas, juegas y atacas.' },
    ],
  }
  const { page, errores } = await abrir('/curso?slug=mi-curso', { semillas: { __FAKE_GUIAS__: [curso] } })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const stage = (await page.locator('#cursoStage').textContent()) || ''
  check('el curso arranca y pinta su primer bloque', /Listo para jugar/.test(stage), stage.trim().slice(0, 60))
  check('  …y la silueta se ha ido', (await page.locator('.esq-articulo').count()) === 0)
  check('  …y sale el botón de continuar', await page.locator('#btnContinue').isVisible())
  await page.close()

  // Un curso SIN bloques no es un curso: lo dice en vez de dejar la
  // pantalla en blanco con un botón que no hace nada.
  const { page: vacio } = await abrir('/curso?slug=mi-curso', {
    semillas: { __FAKE_GUIAS__: [{ ...curso, blocks: [] }] },
  })
  check('un curso sin bloques lo dice', /todavía no está disponible/i.test((await vacio.locator('#cursoStage').textContent()) || ''))
  check('  …y esconde el botón de continuar', !(await vacio.locator('#btnContinue').isVisible()))
  await vacio.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. Nada se sale de la pantalla ──')
{
  for (const ancho of [320, 393, 1280]) {
    const { page } = await abrir('/guia?slug=mi-guia', { ancho, semillas: { __FAKE_GUIAS__: [guia()] } })
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(`${ancho}px la guía: sin scroll lateral`, sobra <= 1, `sobran ${sobra}px`)
    await page.close()
  }
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
