// Tanda 474 — las migas de pan, en las cuatro pantallas que tienen «dentro».
//
// PINGU: «estás ocupando mucho espacio arriba… los botones de todas las
// colecciones, el botón de volver atrás, yo quitaría ese botón».
//
// Había CUATRO chapas de volver —«← Todas las colecciones», «← Todos los
// Pokémon», «← Carpetas» y «← Tus álbumes»— escritas cuatro veces y con
// tres pintas distintas según la tanda que las hubiera tocado por última
// vez. Cada una ocupaba una fila de 44 px para decir dónde estás; y lo
// decía al revés, porque una chapa cuenta A DÓNDE VAS y lo que hace falta
// saber es DE DÓNDE VIENES.
//
// Lo que NO puede pasar es que vuelvan a ser un «enlace pocho», que es lo
// que PINGU lleva cuatro tandas pidiendo que no haya: azul y subrayado.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { migasHtml } from '/home/user/pingu/js/mi-coleccion/migas.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. El molde, sin navegador ──')
// Es puro y sin dependencias a propósito: lo usan las tres mitades de la
// sección y una copia por pantalla es justo lo que había.
{
  const uno = migasHtml([{ texto: 'Expansiones', id: 'mcAlbumVolver' }])
  check('un solo paso sale con su «›» detrás', /Expansiones<\/button><span class="mc-miga-sep"[^>]*>›/.test(uno), uno)
  check('y es un BOTÓN, no un <a>', uno.includes('<button type="button" class="mc-miga" id="mcAlbumVolver">'), uno)
  const dos = migasHtml([{ texto: 'Carpetas', id: 'x' }, { texto: 'Mis dúos' }])
  check('el último paso sin id no se pulsa', dos.includes('<span class="mc-miga-aqui" aria-current="page">Mis dúos</span>'), dos)
  check('y lleva aria-current', dos.includes('aria-current="page"'))
  // El nombre de una carpeta lo escribe una persona.
  const malo = migasHtml([{ texto: 'Carpetas', id: 'x' }, { texto: '<img src=x onerror=alert(1)>' }])
  check('el texto va escapado', !malo.includes('<img'), malo)
  check('sin pasos, nada', migasHtml([]) === '' && migasHtml(null) === '')
  check('un paso sin texto se cae', migasHtml([{ id: 'x' }]) === '')
  check('lleva su nombre para quien no ve', uno.includes('aria-label="Dónde estás"'))
}

const browser = await chromium.launch()
const siembra = () => {
  window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', serie_name: 'Escarlata y Púrpura',
    market: 'WEST', card_count_official: 6, card_count_total: 6, logo_path: 'x/l', release_date: '2026-09-26' }]
  window.__FAKE_CARTAS__ = Array.from({ length: 6 }, (_, i) => ({
    id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1),
    name: `Bulbasaur ${i + 1}`, name_es: `Bulbasaur ${i + 1}`, image_path: `x/${i + 1}`,
    rarity: 'Rare', category: 'Pokemon', dex_ids: [1], variants: { normal: true },
  }))
  window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.slice(0, 3).map((c, i) => ({
    id: `l${i}`, card_id: c.id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM',
    variante: 'normal', created_at: new Date().toISOString(),
  }))
}

const abrir = async (ruta, ancho = 1280) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 }, hasTouch: ancho < 600, isMobile: ancho < 600 })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.route('**assets.tcgdex.net/**', (r) => r.abort())
  await page.route('**limitlesstcg**', (r) => r.abort())
  await page.addInitScript(siembra)
  await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3400)
  return { page, errores }
}

// Qué pinta tiene de verdad. Lo que se mira es que NO sea un enlace pocho.
const pinta = (page, sel) =>
  page.evaluate((s) => {
    const n = document.querySelector(s)
    if (!n) return null
    const cs = getComputedStyle(n)
    return { etiqueta: n.tagName, deco: cs.textDecorationLine, borde: cs.borderTopWidth, color: cs.color,
      alto: Math.round(n.getBoundingClientRect().height) }
  }, sel)

console.log('\n── 2. Dentro de una expansión ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html?ver=album&set=sv8')
  check('la miga está', (await page.locator('#mcAlbumMigas .mc-migas').count()) === 1)
  check('y dice de dónde vienes', (await page.locator('#mcAlbumVolver').textContent()).trim() === 'Expansiones',
    await page.locator('#mcAlbumVolver').textContent())
  // El título grande de debajo ya dice dónde estás, así que la miga no lo
  // repite: es la forma corta, con el «›» al final.
  check('no repite el nombre de la colección', (await page.locator('#mcAlbumMigas .mc-miga-aqui').count()) === 0)
  check('el título sigue estando', (await page.locator('#mcAlbumTitulo').textContent()).includes('Mega Evolution'))
  const p = await pinta(page, '#mcAlbumVolver')
  check('no es un enlace pocho: sin subrayar', p.deco === 'none', JSON.stringify(p))
  check('  …y sin contorno de chapa', p.borde === '0px', JSON.stringify(p))
  // Y lleva de vuelta de verdad: el clic va DELEGADO, porque la miga se
  // pinta con la pantalla y al arrancar no existe. Un `addEventListener`
  // sobre algo que no está no engancha nada y no da error — el botón sale
  // y no hace nada.
  await page.click('#mcAlbumVolver')
  await page.waitForTimeout(900)
  check('y vuelve a la estantería', await page.locator('#mcEstanteriaZona').isVisible())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 3. Dentro de un Pokémon de la Pokédex ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html?ver=pokedex&dex=1')
  check('la miga está', (await page.locator('#pdxVolver').count()) === 1)
  check('y dice «Pokédex»', (await page.locator('#pdxVolver').textContent()).trim() === 'Pokédex',
    await page.locator('#pdxVolver').textContent())
  const p = await pinta(page, '#pdxVolver')
  check('sin subrayar y sin contorno', p.deco === 'none' && p.borde === '0px', JSON.stringify(p))
  await page.click('#pdxVolver')
  await page.waitForTimeout(900)
  check('y vuelve a la lista', await page.locator('#mcPdxMandos').isVisible())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 4. Ya no queda ninguna chapa de volver ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=album&set=sv8')
  const restos = await page.evaluate(() =>
    [...document.querySelectorAll('.mc-album-volver-fila, .pdx-volver-fila, .mc-album-volver, .mc-alb-volver')]
      .map((n) => n.id || n.className))
  check('ni su fila ni su clase', restos.length === 0, restos.join(' | '))
  // Y tampoco un `link-btn` suelto, que es lo que PINGU llama «pocho».
  const pochos = await page.locator('#mcArchivadorZona .link-btn').count()
  check('ni un enlace pocho en la pantalla', pochos === 0, String(pochos))
  await page.close()
}

console.log('\n── 5. En el móvil, lo que se pulsa mide 44 ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=album&set=sv8', 390)
  // Desde la 706 la miga NO sale en el móvil con la barra de abajo: repetía
  // la pestaña de la burbuja («Expansiones ›»). Se comprueba que es eso —que
  // está escondida a propósito— y los 44 se miden donde sí se ve: una
  // tableta de 1.000 px con el dedo.
  const escondida = await page.evaluate(() => document.documentElement.classList.contains('con-barra-movil') && getComputedStyle(document.getElementById('mcAlbumMigas')).display === 'none')
  check('en el móvil la miga se esconde a propósito (706: la burbuja ya dice dónde estás)', escondida)
  const tableta = await browser.newPage({ viewport: { width: 1000, height: 900 }, hasTouch: true, isMobile: true })
  await tableta.route('**assets.tcgdex.net/**', (r) => r.abort())
  await tableta.route('**limitlesstcg**', (r) => r.abort())
  await tableta.addInitScript(siembra)
  await tableta.goto(BASE + '/mi-coleccion.html?ver=album&set=sv8', { waitUntil: 'domcontentloaded' })
  await tableta.waitForTimeout(3400)
  const p = await pinta(tableta, '#mcAlbumVolver')
  // ALTO y no ancho: una miga es texto, y estirarla a 44 de ancho dejaría
  // un área invisible pisando a la de al lado (la regla de la 312).
  check('la miga mide 44 de alto con el dedo', p?.alto >= 44, JSON.stringify(p))
  await tableta.close()
  const r = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }))
  check('y la página no se va de ancho', r.s <= r.c + 1, `${r.s} > ${r.c}`)
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
