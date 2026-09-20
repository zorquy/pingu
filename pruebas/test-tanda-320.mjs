import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 320: la barra de arriba cabe SIEMPRE, con torneo y sin él.
//
// PINGU, con una pachanga en juego: «se va todo para la izquierda y se
// junta con el logo». Al medirlo eran tres cosas, y solo una la causaba
// el torneo:
//
//  · el corte de los enlaces estaba en 860 px cuando PIDEN 1.074;
//  · el logo, hijo de flex, CEDÍA su sitio (126 → 44 px) y el texto se
//    amontonaba encima del icono — por eso «no se salía» antes;
//  · el chip del torneo se sumaba a todo eso desde los 860.
//
// Lo que se comprueba aquí es la FORMA del fallo —que la barra no pida
// más de lo que hay— en un barrido de anchos, y no los cortes concretos:
// un corte se puede mover con el diseño; que la web no se desplace de
// lado, no.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = 'http://localhost:8892'
const ahora = Date.now()
const NOMBRE_LARGO = 'Pachanga de inauguración de PokeDoc con un nombre larguísimo'
const TORNEOS = [{ id: 't1', slug: 'p', name: NOMBRE_LARGO, status: 'in_progress', format: 'standard',
  starts_at: new Date(ahora - 3600e3).toISOString(), start_at: new Date(ahora - 3600e3).toISOString(),
  max_players: 32, created_by: 'admin-1' }]
const INSCRIPCIONES = [{ id: 'i1', tournament_id: 't1', user_id: 'admin-1', status: 'active' }]

const browser = await chromium.launch()
const abrir = async (ancho, conChip) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 700 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript(([to, ins, c]) => {
    window.__FAKE_SESSION__ = 'admin-1'; window.__FAKE_RETOS__ = []
    if (c) { window.__FAKE_TORNEOS__ = to; window.__FAKE_INSCRIPCIONES__ = ins }
  }, [TORNEOS, INSCRIPCIONES, conChip])
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La barra cabe en todos los anchos ──')
{
  // De un móvil pequeño a un monitor grande, y en los dos estados. Los
  // anchos NO son redondos a propósito: 1074 y 1162 son justo lo que
  // piden los dos estados, y un corte mal puesto se nota ahí primero.
  const ANCHOS = [320, 360, 390, 480, 540, 600, 768, 860, 1000, 1074, 1080, 1162, 1180, 1280, 1340, 1440, 1920]
  for (const conChip of [false, true]) {
    const malos = []
    for (const ancho of ANCHOS) {
      const { page } = await abrir(ancho, conChip)
      const r = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        ventana: window.innerWidth,
        pide: Math.ceil(document.querySelector('.nav-inner').scrollWidth),
      }))
      if (r.doc > r.ventana) malos.push(`${ancho} (se sale ${r.doc - r.ventana}px, pide ${r.pide})`)
      await page.close()
    }
    check(`${conChip ? 'con' : 'sin'} torneo en juego, ningún ancho se sale`, malos.length === 0, malos.join(' · '))
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El logo no cede su sitio ──')
{
  // La causa de que «se juntara con el logo»: es hijo de flex y por
  // defecto se encoge. Medir que MIDE LO MISMO con y sin el chip es lo
  // que caza el fallo; mirar el CSS no, porque un `min-width` también
  // parece que lo arregla y no lo arregla.
  const mide = async (conChip) => {
    const { page } = await abrir(1280, conChip)
    const w = await page.evaluate(() => Math.round(document.querySelector('.nav-logo').getBoundingClientRect().width))
    await page.close()
    return w
  }
  const sin = await mide(false)
  const con = await mide(true)
  check('el logo mide lo mismo con torneo y sin él', sin === con && sin > 100, `sin: ${sin} · con: ${con}`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. El chip del torneo se ve SIEMPRE, de una forma u otra ──')
{
  // Un torneo EN JUEGO no se esconde nunca en el menú: o el nombre, o
  // «Jugar», pero algo que lleve a tu mesa tiene que estar a la vista.
  for (const ancho of [320, 600, 900, 1100, 1280, 1440]) {
    const { page, errores } = await abrir(ancho, true)
    const r = await page.evaluate(() => {
      const vivos = [...document.querySelectorAll('.nav-torneo-vivo')]
        .filter((n) => getComputedStyle(n).display !== 'none')
      return { cuantos: vivos.length, texto: vivos[0]?.textContent.trim().slice(0, 30),
        destino: vivos[0]?.getAttribute('href') }
    })
    check(`[${ancho}] hay UNO y solo uno a la vista`, r.cuantos === 1, `${r.cuantos} · «${r.texto}»`)
    check(`  …y lleva a la ficha del torneo`, /\/torneo\?slug=/.test(r.destino || ''), r.destino)
    check(`  …sin errores`, errores.length === 0, errores.join(' | '))
    await page.close()
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. El nombre largo se corta con puntos suspensivos ──')
{
  // Cortado a hachazo parece un fallo; con «…» se lee como un recorte.
  // `text-overflow` NO hace nada sobre un contenedor flex, así que el
  // nombre necesita su propia caja — y eso solo se ve midiendo.
  const { page } = await abrir(1440, true)
  const r = await page.evaluate(() => {
    const n = document.querySelector('.nav-torneo-nombre')
    if (!n) return null
    const s = getComputedStyle(n)
    return { corta: n.scrollWidth > n.clientWidth + 1, overflow: s.textOverflow, minW: s.minWidth }
  })
  check('el nombre tiene su propia caja', !!r, JSON.stringify(r))
  if (r) {
    check('  …que recorta', r.corta, JSON.stringify(r))
    check('  …con puntos suspensivos', r.overflow === 'ellipsis', r.overflow)
    check('  …y puede encogerse (min-width: 0)', r.minW === '0px', r.minW)
  }
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
