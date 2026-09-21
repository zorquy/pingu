import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 319: la barra de progreso dice la verdad, o no está.
//
// La 316 unificó la tarjeta de guía y le puso la barra también en la
// portada… sin traerse el progreso. Resultado: a quien ya se había leído
// una guía, la portada le decía «Sin empezar». Lo vio PINGU en su propia
// portada, no la suite — porque la prueba de la 316 comprobaba que la
// tarjeta tuviera las mismas CLASES en las dos pantallas, no que dijera
// lo mismo que pasó.
//
// La regla que queda: **una barra vacía por no saber es peor que no
// tener barra**, porque afirma algo falso en vez de callarse.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = 'http://localhost:8892'
const ahora = Date.now()

const CATS = [{ id: 'c1', slug: 'hist', name: 'Historia', order_pos: 0, guide_count: 4 }]
// Cuatro guías y cuatro estados distintos: si fueran todas iguales, una
// tarjeta que ignorase el progreso pasaría igual.
const GUIAS = Array.from({ length: 4 }, (_, i) => ({
  id: `g${i + 1}`, slug: `g${i + 1}`, title: `Guía número ${i + 1}`, description: 'Lo de dentro.',
  kind: 'guide', category_id: 'c1', level: 'beginner', guide_rarity: 'silver', estimated_mins: 8,
  author_id: 'admin-1', review_status: 'published',
  published_at: new Date(ahora - (i + 1) * 86400e3).toISOString(),
  blocks: [{ type: 'quiz' }, { type: 'quiz' }, { type: 'quiz' }, { type: 'quiz' }],
}))
const PROGRESO = [
  { user_id: 'user-1', guide_id: 'g1', status: 'in_progress', current_block: 0, read_at: new Date(ahora - 3600e3).toISOString(), started_at: new Date(ahora - 3600e3).toISOString() },
  { user_id: 'user-1', guide_id: 'g2', status: 'in_progress', current_block: 2, read_at: null, started_at: new Date(ahora - 7200e3).toISOString() },
  { user_id: 'user-1', guide_id: 'g3', status: 'completed', current_block: 4, read_at: new Date(ahora - 600e3).toISOString(), started_at: new Date(ahora - 600e3).toISOString() },
  // g4, a propósito sin fila: «sin empezar» de verdad.
  //
  // Y las de OTRA persona, que dicen justo lo contrario en las mismas
  // guías. Sin ellas, quitar el filtro por usuario de la consulta no
  // cambiaba nada y el rigor lo cantó: una prueba con un solo usuario
  // en la tabla no puede afirmar que el filtro funcione.
  { user_id: 'user-2', guide_id: 'g1', status: 'in_progress', current_block: 1, read_at: null, started_at: new Date(ahora - 5000e3).toISOString() },
  { user_id: 'user-2', guide_id: 'g2', status: 'completed', current_block: 4, read_at: new Date(ahora - 900e3).toISOString(), started_at: new Date(ahora - 9000e3).toISOString() },
  { user_id: 'user-2', guide_id: 'g4', status: 'completed', current_block: 4, read_at: new Date(ahora - 300e3).toISOString(), started_at: new Date(ahora - 3000e3).toISOString() },
]

const browser = await chromium.launch()
const abrir = async (ruta, quien = 'user-1') => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript(([c, g, pr, s]) => {
    // El doble inventa una sesión de admin si no se le dice nada: para
    // probar el caso SIN sesión hay que pedirlo con 'none'.
    window.__FAKE_SESSION__ = s
    window.__FAKE_CATEGORIAS__ = c; window.__FAKE_GUIAS__ = g
    window.__FAKE_PROGRESO__ = pr; window.__FAKE_RETOS__ = []
  }, [CATS, GUIAS, PROGRESO, quien])
  await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  return { page, errores }
}
const tarjetas = (page, contenedor) =>
  page.evaluate((sel) => [...document.querySelectorAll(`${sel} .guia-tarjeta`)].map((n) => ({
    titulo: n.querySelector('.guia-titulo')?.textContent.trim(),
    estado: n.querySelector('.guia-progreso-texto')?.textContent.trim() ?? null,
    relleno: n.querySelector('.guia-barra i')?.style.width ?? null,
  })), contenedor)

const ESPERADO = {
  'Guía número 1': ['✓ Leída', '100%'],
  'Guía número 2': ['Vas por el 50%', '50%'],
  'Guía número 3': ['✓ Curso hecho', '100%'],
  'Guía número 4': ['Sin empezar', '0%'],
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La portada dice el progreso de VERDAD ──')
{
  const { page, errores } = await abrir('/index.html')
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  const cartas = await tarjetas(page, '#recentGrid')
  check('salen las cuatro guías', cartas.length === 4, String(cartas.length))
  for (const c of cartas) {
    const esperado = ESPERADO[c.titulo]
    if (!esperado) { check(`guía inesperada: ${c.titulo}`, false); continue }
    check(`«${c.titulo}» dice «${esperado[0]}»`, c.estado === esperado[0], `dice «${c.estado}»`)
    check(`  …y la barra va al ${esperado[1]}`, c.relleno === esperado[1], c.relleno)
  }
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Y /aprender sigue diciendo lo mismo ──')
{
  // La tarjeta es la misma desde la 316: si una pantalla acierta y la
  // otra no, es que el dato lo trae cada una por su cuenta y una se
  // olvidó — que es exactamente lo que pasó.
  const { page } = await abrir('/aprender')
  const cartas = await tarjetas(page, '.guia-rejilla')
  check('salen las cuatro guías', cartas.length === 4, String(cartas.length))
  for (const c of cartas) {
    const esperado = ESPERADO[c.titulo]
    if (esperado) check(`«${c.titulo}» dice «${esperado[0]}»`, c.estado === esperado[0], `dice «${c.estado}»`)
  }
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Sin sesión no hay barra, que no es lo mismo que cero ──')
{
  // «No has empezado» y «no hay nadie de quien saberlo» son cosas
  // distintas, y la segunda no se afirma: se calla.
  const { page, errores } = await abrir('/index.html', 'none')
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  const cartas = await tarjetas(page, '#recentGrid')
  check('salen las cuatro guías igual', cartas.length === 4, String(cartas.length))
  const conBarra = cartas.filter((c) => c.estado !== null)
  check('  …y ninguna enseña barra', conBarra.length === 0, conBarra.map((c) => `${c.titulo}: ${c.estado}`).join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Y una pantalla que ni se acuerde del progreso ──')
{
  // Las dos pantallas de arriba pasan el dato siempre, así que el VALOR
  // POR DEFECTO no lo ejercita nadie — el rigor lo cantó: cambiarlo a
  // `{}` no rompía ninguna prueba, y ese `{}` es exactamente el fallo de
  // la 316. Lo que hay que sostener es la propiedad, no las dos
  // pantallas de hoy: una tercera que monte la tarjeta y se olvide del
  // progreso tiene que quedarse SIN barra, no con una barra a cero.
  // Se monta DENTRO del navegador y no en Node: el módulo tira de
  // js/app.js, que toca el `document` nada más cargarse.
  const { page } = await abrir('/index.html')
  const [sinDecirNada, sabiendoQueNada] = await page.evaluate(async () => {
    const { tarjetaDeGuia } = await import('/js/guia-tarjeta.js')
    const guia = { id: 'g1', slug: 'g1', title: 'Guía número 1', kind: 'guide', blocks: [{}, {}, {}, {}] }
    return [tarjetaDeGuia(guia), tarjetaDeGuia(guia, { progreso: {} })]
  })
  check('sin pasarle progreso, no pinta barra', !/guia-progreso/.test(sinDecirNada),
    sinDecirNada.match(/guia-progreso-texto">([^<]*)/)?.[1] ?? '')
  // Y el control: pasándole un mapa vacío SÍ la pinta, porque eso es
  // «lo sé y no hay nada». Sin esta mitad, un componente que no pintara
  // la barra JAMÁS pasaría la de arriba.
  check('  …y con un mapa vacío sí, diciendo «Sin empezar»',
    /guia-progreso/.test(sabiendoQueNada) && /Sin empezar/.test(sabiendoQueNada))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
