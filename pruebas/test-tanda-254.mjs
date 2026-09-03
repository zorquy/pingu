import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 254: «Relacionar parejas» con respuestas REPETIDAS.
//
// Lo reportó un alumno de PINGU en un curso de cartas falsas: cuatro
// señales, dos «Original» y dos «Falsa». Se pintaba un botón por PAREJA
// y se comparaba por número de pareja, así que salían dos botones
// idénticos y solo UNO valía para cada señal: unir con el otro —el que
// dice exactamente lo mismo— se marcaba como fallo, y el ejercicio solo
// se podía terminar adivinando cuál de los dos botones iguales era «el
// bueno».
//
// Primera prueba de un curso: hasta hoy los cursos no tenían ninguna.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const cursoCon = (bloque) => ({
  __FAKE_SESSION__: 'admin-1',
  __FAKE_GUIAS__: [{ id: 'g1', slug: 'falsas', title: 'Cartas falsas', author_id: 'admin-1', blocks: [bloque] }],
})

// El caso de PINGU, tal cual: dos «Original» y dos «Falsa».
const REPETIDAS = {
  type: 'match',
  title: 'Cada señal, con su veredicto',
  pairs: [
    { left: 'Negro profundo', right: 'Original' },
    { left: 'Negro grisáceo', right: 'Falsa' },
    { left: 'Remolino del reverso centrado', right: 'Original' },
    { left: 'Bordes que se abren', right: 'Falsa' },
  ],
}
const DISTINTAS = {
  type: 'match',
  title: 'Cada set con su año',
  pairs: [
    { left: 'Base Set', right: '1999' },
    { left: 'Neo Genesis', right: '2000' },
    { left: 'Ruby & Sapphire', right: '2003' },
  ],
}

const abrir = async (semillas) => {
  const page = await browser.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, semillas)
  await page.goto(`${BASE}/curso?slug=falsas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}
const izq = (page, texto) => page.locator(`.match-item[data-side="left"]`, { hasText: texto }).first()
const der = (page, texto) => page.locator(`.match-item[data-side="right"]`).filter({ hasText: texto }).first()
const unir = async (page, a, b) => {
  await izq(page, a).click()
  await der(page, b).click()
  await page.waitForTimeout(250)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Las respuestas repetidas son UN botón ──')
{
  const { page, errores } = await abrir(cursoCon(REPETIDAS))
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('cuatro señales a la izquierda', (await page.locator('.match-item[data-side="left"]').count()) === 4)
  // Esto es lo que estaba mal: antes salían CUATRO botones a la derecha,
  // dos de ellos idénticos.
  const derechas = await page.locator('.match-item[data-side="right"]').allInnerTexts()
  check('y solo DOS respuestas a la derecha', derechas.length === 2, JSON.stringify(derechas))
  check('una «Original» y una «Falsa»',
    derechas.filter((t) => /Original/.test(t)).length === 1 && derechas.filter((t) => /Falsa/.test(t)).length === 1,
    JSON.stringify(derechas))
  await page.close()
}

console.log('\n── 2. Acertar con la respuesta buena, sea la pareja que sea ──')
{
  const { page } = await abrir(cursoCon(REPETIDAS))
  // La SEGUNDA señal que responde «Original». Con la comparación por
  // índice, esta era la que se marcaba como fallo.
  await unir(page, 'Remolino del reverso centrado', 'Original')
  check('la señal queda emparejada', await izq(page, 'Remolino del reverso centrado').evaluate((e) => e.classList.contains('matched')))
  check('y NO se marca como fallo', (await page.locator('.match-item.wrong').count()) === 0)
  // El botón aún tiene otra señal que recibir: no puede apagarse.
  check('la respuesta sigue disponible', !(await der(page, 'Original').evaluate((e) => e.classList.contains('matched'))))
  check('pero avisa del acierto', await der(page, 'Original').evaluate((e) => e.classList.contains('acierto')))

  await unir(page, 'Negro profundo', 'Original')
  check('la otra señal también entra', await izq(page, 'Negro profundo').evaluate((e) => e.classList.contains('matched')))
  check('y AHORA sí se apaga la respuesta', await der(page, 'Original').evaluate((e) => e.classList.contains('matched')))
  await page.close()
}

console.log('\n── 3. Equivocarse sigue siendo equivocarse ──')
{
  const { page } = await abrir(cursoCon(REPETIDAS))
  await unir(page, 'Negro grisáceo', 'Original')
  check('se marca en rojo', (await page.locator('.match-item.wrong').count()) >= 1)
  check('y no queda emparejada', !(await izq(page, 'Negro grisáceo').evaluate((e) => e.classList.contains('matched'))))
  await page.close()
}

console.log('\n── 4. El ejercicio se termina sin fallar ──')
{
  const { page } = await abrir(cursoCon(REPETIDAS))
  await unir(page, 'Negro profundo', 'Original')
  await unir(page, 'Remolino del reverso centrado', 'Original')
  await unir(page, 'Negro grisáceo', 'Falsa')
  await unir(page, 'Bordes que se abren', 'Falsa')
  check('las cuatro emparejadas', (await page.locator('.match-item[data-side="left"].matched').count()) === 4)
  check('ninguna en rojo', (await page.locator('.match-item.wrong').count()) === 0)
  check('y se puede continuar', !(await page.locator('#btnContinue').isDisabled()))
  await page.close()
}

console.log('\n── 5. Con respuestas distintas, nada cambia ──')
{
  const { page, errores } = await abrir(cursoCon(DISTINTAS))
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('tres y tres, como siempre',
    (await page.locator('.match-item[data-side="left"]').count()) === 3 &&
      (await page.locator('.match-item[data-side="right"]').count()) === 3)
  await unir(page, 'Neo Genesis', '2000')
  check('acertar apaga la respuesta al momento', await der(page, '2000').evaluate((e) => e.classList.contains('matched')))
  await unir(page, 'Base Set', '2003')
  check('y equivocarse se marca', (await page.locator('.match-item.wrong').count()) >= 1)
  await page.close()
}

console.log('\n── 6. Mayúsculas y espacios no hacen dos respuestas ──')
{
  const { page } = await abrir(
    cursoCon({
      type: 'match',
      title: 'Con la mano izquierda',
      pairs: [
        { left: 'Uno', right: 'Original' },
        { left: 'Dos', right: '  original ' },
        { left: 'Tres', right: 'Falsa' },
      ],
    })
  )
  const derechas = await page.locator('.match-item[data-side="right"]').allInnerTexts()
  check('«Original» y « original » son la misma', derechas.length === 2, JSON.stringify(derechas))
  await unir(page, 'Dos', 'Original')
  check('y valen la una por la otra', await izq(page, 'Dos').evaluate((e) => e.classList.contains('matched')))
  await page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
