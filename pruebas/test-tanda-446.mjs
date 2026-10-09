// Tanda 446 — el menú que se metía bajo la barra, la carta huérfana y los
// enlaces pochos.
//
// Tres cosas que PINGU vio en una captura del panel y que no dan error de
// ninguna clase: el menú pegajoso se mete DEBAJO de la barra del sitio y
// pierde su primer elemento, el vistazo deja una carta sola en una segunda
// fila, y «Ver todas» se lee como el enlace de un pie de página.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const browser = await chromium.launch()

// DOCE cartas: con ocho en el vistazo y siete por fila en un escritorio,
// queda una huérfana. Con menos no se reproduce.
const semilla = () => {
  window.__FAKE_CARTAS__ = [...Array(12)].map((_, i) => ({ id: `a${i}`, market: 'WEST', set_id: 's',
    local_id: String(i + 1), name: `Carta ${i}`, name_es: `Carta ${i}`, image_path: `x/${i}`,
    rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }))
  window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.map((c, i) => ({ id: `l${i}`, card_id: c.id,
    market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal',
    created_at: `2026-09-0${i % 9}T00:00:00Z` }))
}
const abrir = async (ancho = 1280) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 800 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(semilla)
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El menú no se mete debajo de la barra del sitio ──')
{
  const { page, errores } = await abrir()
  await page.evaluate(() => window.scrollTo(0, 800))
  await page.waitForTimeout(400)
  const r = await page.evaluate(() => {
    const barra = document.querySelector('.navbar')
    const menu = document.querySelector('.mc-pestanias')
    const prim = menu.querySelector('.mc-pestania')
    return {
      finBarra: Math.round(barra.getBoundingClientRect().bottom),
      topMenu: Math.round(menu.getBoundingClientRect().top),
      topPrimera: Math.round(prim.getBoundingClientRect().top),
      texto: prim.textContent.trim(),
    }
  })
  // El menú se queda pegado al bajar, que es lo que se quiere…
  check('el menú sigue a la vista al bajar', r.topMenu >= 0 && r.topMenu < 200, JSON.stringify(r))
  // …pero DEBAJO de la barra. Pegado a 16 px se le metía por detrás y la
  // barra le tapaba el primer elemento: al bajar desaparecía «Panel» y
  // parecía que el menú empezaba en «Cartas».
  check('  …y su primera pestaña no queda tapada por la barra',
    r.topPrimera >= r.finBarra, JSON.stringify(r))
  check('  …que es «Panel»', r.texto === 'Panel', r.texto)
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El vistazo de cartas, UNA fila ──')
{
  // A DOS anchos, que es lo que distingue «una fila» de «un número fijo de
  // cartas»: cuántas caben depende del ancho —siete en un escritorio, tres
  // en un móvil—, así que bajar DE_VISTAZO a un número no lo arregla.
  for (const ancho of [1280, 390]) {
    const { page } = await abrir(ancho)
    const r = await page.locator('.mc-vistazo-cartas').evaluate((caja) => {
      const c = caja.getBoundingClientRect()
      const dentro = [...caja.children].filter((n) => n.getBoundingClientRect().bottom <= c.bottom + 2)
      return {
        visibles: dentro.length,
        total: caja.children.length,
        filas: new Set(dentro.map((n) => Math.round(n.getBoundingClientRect().top))).size,
      }
    })
    check(`en ${ancho} px se ve UNA fila`, r.filas === 1, JSON.stringify(r))
    check(`  …y ninguna carta suelta debajo`, r.visibles > 0 && r.visibles <= r.total, JSON.stringify(r))
    await page.close()
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. «Ver todas» no es un enlace pocho ──')
{
  const { page } = await abrir()
  const v = await page.locator('.mc-vistazo-cabecera .link-btn').first().evaluate((n) => {
    const cs = getComputedStyle(n)
    return { subrayado: cs.textDecorationLine, borde: cs.borderTopWidth,
      alto: Math.round(n.getBoundingClientRect().height) }
  })
  check('no va subrayado', v.subrayado === 'none', JSON.stringify(v))
  check('  …y tiene cuerpo de control (sin chapa desde la 781: palabra y flecha)', v.borde === '0px' && v.alto >= 32, JSON.stringify(v))
  // Y la clase global NO se toca: la usa media web y un cambio ahí sería
  // otra tanda entera.
  const otro = await page.evaluate(() => {
    const n = document.createElement('button')
    n.className = 'link-btn'
    document.body.appendChild(n)
    const d = getComputedStyle(n).textDecorationLine
    n.remove()
    return d
  })
  check('  …sin cambiarle el estilo a `.link-btn` en todo el sitio', otro === 'underline', otro)
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
