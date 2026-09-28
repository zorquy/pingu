// Tanda 353 — las guías se mudan a /guia/<slug>.
//
// Search Console, 2026-09-28: 14 páginas indexadas en TODO PokeDoc, y ni
// una guía. Las guías eran la única sección del sitio con dirección de
// parámetro (`/guia.html?slug=…`) — las noticias se mudaron en la 269 y
// estas se quedaron a medias.
//
// Y se hace ahora justamente porque no hay nada indexado: cambiar una
// dirección que Google ya ha posicionado cuesta semanas; cambiar una que
// no conoce no cuesta nada.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { rutaDeArticulo, slugDeArticuloEnLaUrl } from '/home/user/pingu/js/articulos.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('\n── 1. La dirección ──')
{
  check('una guía vive en /guia/<slug>', rutaDeArticulo('guide', 'como-se-lee-una-carta') === '/guia/como-se-lee-una-carta',
    rutaDeArticulo('guide', 'como-se-lee-una-carta'))
  check('una noticia sigue donde estaba', rutaDeArticulo('news', 'algo') === '/noticias/algo')
  check('y el slug se escapa', rutaDeArticulo('guide', 'a b') === '/guia/a%20b')
}

console.log('\n── 2. Y se lee de vuelta, venga por donde venga ──')
{
  const leerDe = (pathname, search = '') => slugDeArticuloEnLaUrl({ pathname, search })
  check('por la ruta nueva', leerDe('/guia/como-se-lee-una-carta') === 'como-se-lee-una-carta')
  check('por la de una noticia', leerDe('/noticias/una-noticia') === 'una-noticia')
  // Los enlaces viejos siguen existiendo en correos ya enviados y en
  // avisos guardados en la base: esos no se pueden reescribir.
  check('por la vieja con query', leerDe('/guia.html', '?slug=vieja') === 'vieja')
  // Y `/guia` a secas NO es un slug: es la página sin artículo.
  check('«/guia» a secas no inventa un slug', leerDe('/guia') === null, String(leerDe('/guia')))
  check('«/guia.html» tampoco', leerDe('/guia.html') === null)
}

console.log('\n── 3. Nadie escribe ya la forma vieja ──')
{
  // Son 29 sitios en 20 ficheros: en vez de importar el módulo en todos,
  // se cambió la cadena. Lo que impide que se vuelvan a separar es ESTA
  // comprobación — si alguien escribe la forma vieja, salta.
  const sospechosos = []
  const recorrer = (dir) => {
    for (const n of readdirSync(dir)) {
      if (n === '.git' || n === 'node_modules') continue
      const p = join(dir, n)
      if (statSync(p).isDirectory()) { recorrer(p); continue }
      if (!/\.(js|mjs|html)$/.test(n)) continue
      const texto = readFileSync(p, 'utf8')
      // Se miran los ENLACES, no los comentarios: la forma vieja se sigue
      // nombrando para explicar por qué se mudó.
      for (const linea of texto.split('\n')) {
        const limpia = linea.trim()
        if (limpia.startsWith('//') || limpia.startsWith('*') || limpia.startsWith('<!--')) continue
        if (/guia\.html\?slug=/.test(limpia)) sospechosos.push(`${p.replace(RAIZ + '/', '')}: ${limpia.slice(0, 70)}`)
      }
    }
  }
  recorrer(RAIZ)
  check('ni un enlace con la forma vieja', sospechosos.length === 0, sospechosos.join(' | '))
}

console.log('\n── 4. Pero la vieja sigue llegando ──')
{
  const toml = leer('netlify.toml')
  // Un 301 y no un 200: hay que decirle a Google que la dirección se ha
  // mudado, no servir la misma página en dos sitios.
  check('hay 301 de la vieja a la nueva',
    /from = "\/guia\.html"[\s\S]{0,200}status = 301/.test(toml))
  check('…condicionado al slug', /query = \{slug = ":slug"\}/.test(toml))
  // `force` porque /guia.html es un fichero de verdad, y sin él gana el
  // fichero y el 301 no se aplica nunca.
  check('…y forzado, que si no gana el fichero',
    /from = "\/guia\.html"[\s\S]{0,260}force = true/.test(toml))
  check('la ruta nueva se sirve con la misma página',
    /from = "\/guia\/:slug"[\s\S]{0,120}to = "\/guia\.html\?slug=:slug"[\s\S]{0,60}status = 200/.test(toml))
  // Y el orden: la regla de las noticias apunta a /guia.html?slug=…, así
  // que tiene que ir ANTES del 301. Si no, una noticia acabaría
  // redirigida a /guia/<slug> y dejaría de ser una noticia.
  check('las noticias van antes que el 301',
    toml.indexOf('from = "/noticias/:slug"') < toml.indexOf('from = "/guia.html"'))
}

console.log('\n── 5. El sitemap, el RSS y el borde dicen lo mismo ──')
{
  check('el sitemap ofrece la nueva', /\$\{SITIO\}\/guia\/\$\{encodeURIComponent\(g\.slug\)\}/.test(leer('netlify/functions/sitemap.mjs')))
  check('el RSS también', /\$\{SITIO\}\/guia\/\$\{encodeURIComponent\(fila\.slug\)\}/.test(leer('netlify/functions/rss.mjs')))
  const borde = leer('netlify/edge-functions/meta-social.js')
  check('el borde escucha en /guia/*', /'\/guia\/\*'/.test(borde))
  check('…y saca el slug de la ruta', /\\\/\(\?:noticias\|guia\)\\\//.test(borde))
  // El servidor de las pruebas imita netlify.toml: si se añade una regla
  // allí y no aquí, las pruebas prueban otra web.
  check('y el servidor de pruebas la conoce', /\^\/guia\/\[\^\/\]\+\$/.test(readFileSync('/tmp/wt-pruebas/herramientas/servir.py', 'utf8')))
}

console.log('\n── 6. Y la página abre por la dirección nueva ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(() => {
    window.__FAKE_GUIAS__ = [{
      id: 'g1', slug: 'como-se-lee-una-carta', title: 'Cómo se lee una carta',
      kind: 'guide', author_id: 'admin-1', review_status: 'published',
      published_at: '2026-08-01T10:00:00Z', created_at: '2026-08-01T10:00:00Z',
      submitted_at: '2026-08-01T10:00:00Z', category_id: null, blocks: [],
      description: 'Una guía de prueba',
    }]
  })
  await page.goto('http://localhost:8892/guia/como-se-lee-una-carta', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const titulo = (await page.locator('h1').first().textContent()) || ''
  check('la guía se abre por /guia/<slug>', /Cómo se lee una carta/.test(titulo), titulo.trim())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
  await browser.close()
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
