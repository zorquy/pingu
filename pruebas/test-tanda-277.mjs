// Tanda 277: una noticia deja de disfrazarse de guía.
//
// PINGU, al entrar en la primera noticia publicada: abajo ponía «¿Te ha
// servido esta guía?», había una invitación a «Escribe tu propia guía», y
// el aviso de XP decía «Guía leída». Y en el editor había media pantalla
// de campos que una noticia no tiene (categoría, nivel, rareza, curso).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 120) : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()
const abrir = async (ruta, semillas = {}) => {
  const page = await browser.newPage({ viewport: { width: 1150, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, {
    __FAKE_SESSION__: 'user-1',
    __FAKE_GUIAS__: [{ title: 'Cómo saber si una carta es falsa' }],
    __FAKE_NOTICIAS__: [{ title: 'Cartas del 30 aniversario', description: 'Todas.' }],
    ...semillas,
  })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1700)
  return { page, errores }
}

console.log('\n── 1. La noticia no se vende como guía ──')
{
  const { page, errores } = await abrir('/guia?slug=noticia-1')
  const todo = await page.locator('main').textContent()
  check('sin «¿Te ha servido esta guía?»', !todo.includes('servido esta guía'), todo.match(/.{0,40}servido.{0,30}/)?.[0])
  check('sin la invitación a escribir una guía', !todo.includes('Escribe tu propia guía'))
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 2. Una guía las conserva ──')
{
  // Lo de arriba no puede haberse llevado por delante lo de las guías,
  // que es donde SÍ tiene sentido.
  const { page, errores } = await abrir('/guia?slug=guia-1')
  check('la guía sigue pudiendo valorarse', (await page.locator('#guideRating').textContent()).trim().length > 0)
  check('y sigue invitando a escribir', (await page.locator('#guideWriteInvite').textContent()).includes('Escribe tu propia guía'))
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()
}

console.log('\n── 3. El editor pide solo lo de una noticia ──')
{
  const { page, errores } = await abrir('/admin/editor-guia?tipo=noticia', { __FAKE_SESSION__: 'admin-1' })
  const visibles = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.editor-panel .form-group label, .tab-btn')]
        .filter((l) => l.offsetParent !== null)
        .map((l) => l.textContent.trim().split('\n')[0])
    )
  const v = await visibles()
  const hay = (t) => v.some((x) => x.startsWith(t))
  check('está el titular', hay('Título'))
  check('el slug', hay('Slug'))
  check('la portada', hay('Imagen de portada'))
  check('la descripción', hay('Descripción'))
  // Publicar no es «avanzado»: estaba enterrado en esa pestaña.
  check('y el estado, a mano', hay('Estado'))
  for (const fuera of ['Categoría', 'Nivel', 'Rareza', 'XP de recompensa', 'Colección', 'Minutos', 'Tags']) {
    check(`sin «${fuera}»`, !hay(fuera), v.join(' | '))
  }
  check('sin la pestaña del curso', !v.some((x) => x.includes('Curso interactivo')))
  check('sin errores', errores.length === 0, errores[0] || '')

  // Y al cambiar a guía, vuelve todo: se esconden, no se borran.
  await page.evaluate(() => {
    const k = document.getElementById('gKind')
    k.value = 'guide'
    k.dispatchEvent(new Event('change'))
  })
  await page.waitForTimeout(300)
  const g = await visibles()
  check('cambiando a guía vuelven los campos', g.some((x) => x.startsWith('Categoría')) && g.some((x) => x.startsWith('Nivel')))
  await page.close()
}

console.log('\n── 4. La última noticia, en la portada ──')
{
  const { page, errores } = await abrir('/')
  check('sale la tarjeta', (await page.locator('#noticiaPortada a').count()) === 1)
  check('con su titular', (await page.locator('#noticiaPortada').textContent()).includes('Cartas del 30 aniversario'))
  check('y lleva a la noticia', (await page.locator('#noticiaPortada a').getAttribute('href')) === '/noticias/noticia-1')
  check('sin errores', errores.length === 0, errores[0] || '')
  await page.close()

  // Sin noticias no se deja un hueco que no explica nada.
  const vacia = await abrir('/', { __FAKE_NOTICIAS__: [] })
  check('sin noticias, la sección se recoge', (await vacia.page.locator('#noticiaPortada a').count()) === 0)
  check('sin errores', vacia.errores.length === 0, vacia.errores[0] || '')
  await vacia.page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
