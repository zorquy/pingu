// Tanda 752 — «en qué álbum la tienes» en la ficha de una carta (Y5). (Los
// tres niveles del perfil, P1, se fueron en la 867.)
//
// Lo que se mira: que arriba hay tres niveles y que Muro, Guías, Foro y
// Torneos son los filtros de Actividad; que se abre por la Vitrina cuando
// tiene cartas y por Actividad cuando no (una vitrina vacía no es «la que
// tiene algo»); que Medallas enseña los trofeos y esconde los filtros; que
// #about y #foro siguen llevando a su sitio; que la cifra de Trofeos lleva
// a Medallas; y que la ficha de una copia que está en un álbum lo dice y
// lleva a él.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()

const semilla = ({ vitrina, sesion }) => {
  window.__FAKE_SESSION__ = sesion
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST' }]
  window.__FAKE_CARTAS__ = Array.from({ length: 4 }, (_, i) => ({ id: `xy5-${i + 1}`, market: 'WEST', set_id: 'xy5', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `x/${i}` }))
  window.__FAKE_COLECCION__ = Array.from({ length: 4 }, (_, i) => ({ id: `l${i}`, user_id: sesion, card_id: `xy5-${i + 1}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
  window.__FAKE_VITRINA__ = vitrina
  window.__FAKE_CARPETAS__ = [{ id: 'carpeta-0', user_id: sesion, nombre: 'Mis Charizard', orden: 0 }, { id: 'carpeta-1', user_id: sesion, nombre: 'Vintage', orden: 1 }]
  window.__FAKE_CARPETA_CARTAS__ = [{ id: 'cc-0', user_id: sesion, folder_id: 'carpeta-0', line_id: 'l0' }]
}
async function abrir(ruta, { vitrina = [], sesion = 'user-1', opciones = { viewport: { width: 1280, height: 1000 } } } = {}) {
  const ctx = await browser.newContext({ ...opciones, locale: 'es-ES' })
  await ctx.addInitScript(semilla, { vitrina, sesion })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#3a7bd5"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}
const estado = (page) => page.evaluate(() => {
  const ve = (sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none' && !e.hidden && e.getBoundingClientRect().height > 0 }
  return {
    niveles: [...document.querySelectorAll('#perfilNiveles [data-pnivel]')].filter((b) => !b.hidden).map((b) => b.textContent.trim()),
    activo: document.querySelector('#perfilNiveles .active')?.dataset.pnivel,
    filtros: ve('#profileTabs'),
    filtrosLista: [...document.querySelectorAll('#profileTabs .tab-btn')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.dataset.ptab),
    vitrina: ve('#perfilVitrina'),
    muro: ve('#ptab-wall'),
    medallas: ve('#ptab-about'),
    foro: ve('#ptab-foro'),
  }
})

// Los tres niveles (P1) se fueron en la 867: el perfil es UNA fila de
// pestañas y lo prueba test-tanda-867-pantalla.mjs. Aquí queda la Y5.

console.log('── 4. En qué álbum la tienes (Y5) ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=cartas', { sesion: 'admin-1', opciones: { ...devices['iPhone 13'] } })
  await page.locator('#mcCartas [data-carta="xy5-1"], #mcCartas .mc-carta-foto').first().click()
  await page.waitForTimeout(1200)
  const linea = page.locator('#mcEdCopiaAlbum')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la ficha de una copia que está en un álbum lo dice arriba', await linea.isVisible() && /En tu álbum\s*Mis Charizard/.test((await linea.textContent()).replace(/\s+/g, ' ')), await linea.textContent())
  check('  …y el bloque de abajo se llama «En tus álbumes»', (await page.locator('#mcEdCarpetasBloque h3').textContent()) === 'En tus álbumes')
  await linea.locator('[data-abrir-carpeta]').click()
  await page.waitForTimeout(1200)
  check('  …y tocar el nombre abre ese álbum', new URL(page.url()).searchParams.get('ver') === 'carpetas' && /Mis Charizard/.test(await page.locator('#mcPanelCarpetas').textContent()), page.url())
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/mi-coleccion.html?ver=cartas', { sesion: 'admin-1', opciones: { ...devices['iPhone 13'] } })
  await page.locator('#mcCartas .mc-carta-foto').nth(1).click()
  await page.waitForTimeout(1200)
  check('una copia que no está en ningún álbum no dice nada', !(await page.locator('#mcEdCopiaAlbum').isVisible()))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
