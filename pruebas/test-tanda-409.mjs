// Tanda 409 — las expansiones, por eras y por año.
//
// PINGU: «deberían estar ordenadas por eras, y dentro por año, de las más
// nuevas a las más viejas hacia abajo. Y los sets especiales como los
// Trainer Kits, los POP Series y estas cosas, abajo del todo. Y arriba,
// que estén tus colecciones porque tienen una carta, yo lo quitaría:
// arriba solo si la pones como favorito».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { esEspecial, esPromoDeEra, gruposDeEstanteria } from '/home/user/pingu/js/mi-coleccion/estanteria.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')

const S = (id, name, serie_id, serie_name, fecha) => ({ id, name, serie_id, serie_name,
  market: 'WEST', card_count_official: 100, card_count_total: 110, release_date: fecha,
  logo_path: 'x/' + id, tcg_online_code: id.toUpperCase().slice(0, 3) })
const SETS = [
  S('sv8', 'Surging Sparks', 'sv', 'Escarlata y Púrpura', '2024-11-08'),
  S('sv1', 'Scarlet & Violet', 'sv', 'Escarlata y Púrpura', '2023-03-31'),
  S('me1', 'Mega Evolution', 'me', 'Mega Evolución', '2025-09-26'),
  S('xy1', 'XY', 'xy', 'XY', '2014-02-05'),
  S('xyp', 'XY Black Star Promos', 'xy', 'XY', '2013-10-01'),
  S('svp', 'SVP Black Star Promos', 'sv', 'Escarlata y Púrpura', '2023-01-01'),
  S('tk1a', 'XY Trainer Kit: Latias', 'tk', 'Trainer Kits', '2014-05-01'),
  S('pop1', 'POP Series 1', 'pop', 'POP', '2004-09-01'),
  S('rara', 'Sin fecha', 'sv', 'Escarlata y Púrpura', null),
]

console.log('\n── 1. La colocación, con datos a mano ──')
{
  // Por identificador y no por posición: meter un set en la lista de
  // arriba corría los índices y rompía comprobaciones que no tenían nada
  // que ver.
  const uno = (id) => SETS.find((x) => x.id === id)
  check('un trainer kit es especial', esEspecial(uno('tk1a')))
  check('una POP series también', esEspecial(uno('pop1')))
  // Los promos de una era NO son especiales: son de su era. PINGU, al ver
  // la primera versión: «las Black Star Promo de cada era tienen que ir en
  // cada era, la primera».
  check('los promos de una era NO son especiales', !esEspecial(uno('xyp')))
  check('  …pero sí se van al fondo de la suya', esPromoDeEra(uno('xyp')))
  check('un set normal no', !esEspecial(uno('sv8')))
  // La lista es de lo ESPECIAL y no de lo normal a propósito: al quedarse
  // vieja, lo que se cuela en medio es una colección de promos nueva y no
  // una ERA entera cayendo al fondo, que es lo más buscado que hay.
  check('  …ni un set de una era que todavía no existe',
    !esEspecial(S('zz1', 'Lo que salga en 2030', 'zz', 'Lo que sea', '2030-01-01')))

  const g = gruposDeEstanteria(SETS)
  check('la era más nueva, primero', g[0].titulo === 'Mega Evolución', g[0].titulo)
  check('los especiales, al final', g.at(-1).titulo === 'Sets especiales', g.at(-1).titulo)
  check('  …y son solo los que no son de ninguna era',
    g.at(-1).sets.map((s) => s.id).join() === 'tk1a,pop1', g.at(-1).sets.map((s) => s.id).join())
  const sv = g.find((x) => x.titulo === 'Escarlata y Púrpura')
  check('dentro de una era, lo más nuevo arriba y los promos al fondo',
    sv.sets.map((s) => s.id).join() === 'sv8,sv1,rara,svp', sv.sets.map((s) => s.id).join())
  check('  …y un set sin fecha no se inventa un año', sv.sets.at(-2).id === 'rara')
  const xy = g.find((x) => x.titulo === 'XY')
  check('  …y lo mismo en una era con dos', xy.sets.map((s) => s.id).join() === 'xy1,xyp',
    xy.sets.map((s) => s.id).join())

  check('sin favoritos no hay grupo de favoritos', g[0].titulo !== 'Tus favoritas')
  const f = gruposDeEstanteria(SETS, new Set(['sv1']))
  check('con favoritos, van primero', f[0].titulo === 'Tus favoritas' && f[0].sets[0].id === 'sv1')
  // Y sale de su era: en dos sitios a la vez, el de arriba no se lee como
  // «lo que has marcado» sino como «lo de siempre, repetido».
  check('  …y no se repite en su era',
    !f.find((x) => x.titulo === 'Escarlata y Púrpura').sets.some((s) => s.id === 'sv1'))
}

console.log('\n── 2. En la pantalla ──')
const browser = await chromium.launch()
const abrir = async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript((sets) => {
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = [{ id: 'sv1-1', set_id: 'sv1', local_id: '1', name: 'Pikachu',
      image_path: 'x/1', market: 'WEST', rarity: 'Common', category: 'Pokemon', variants: { normal: true } }]
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv1-1', cantidad: 1, idioma: 'es',
      estado: 'NM', variante: 'normal', notas: null }]
  }, SETS)
  await page.goto('http://localhost:8892/mi-coleccion.html?ver=album', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}
const titulos = (page) =>
  page.locator('#mcEstanteriaRejilla > h3').evaluateAll((l) => l.map((e) => e.textContent.trim()))
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const t = await titulos(page)
  check('los rótulos son las eras', t[0] === 'Mega Evolución' && t.at(-1) === 'Sets especiales', t.join(' | '))
  // Lo que se QUITA: tener una carta ya no sube una expansión arriba.
  check('  …y ya no hay un «Tus colecciones»', !t.includes('Tus colecciones'), t.join(' | '))
  check('  …ni un «Empezar otra»', !t.includes('Empezar otra'), t.join(' | '))
  // La que tiene una carta (sv1) sigue en SU era, no arriba.
  const enSuEra = await page.evaluate(() => {
    const h = [...document.querySelectorAll('#mcEstanteriaRejilla > h3')]
      .find((e) => e.textContent.includes('Escarlata'))
    return [...h.nextElementSibling.querySelectorAll('[data-set]')].map((e) => e.dataset.set)
  })
  check('  …y la que tiene una carta sigue en su era', enSuEra.includes('sv1'), enSuEra.join(','))
  check('  …y el promo de esa era, el último', enSuEra.at(-1) === 'svp', enSuEra.join(','))
  await page.close()
}
{
  const { page } = await abrir()
  await page.locator('[data-set="sv1"]').click()
  await page.waitForTimeout(900)
  const b = page.locator('#mcAlbumFavorito')
  check('dentro de una expansión hay estrella', await b.isVisible())
  check('  …con su icono de js/icons.js', (await b.locator('svg').count()) === 1)
  check('  …y sin marcar de entrada', (await b.getAttribute('aria-pressed')) === 'false')
  await b.click()
  await page.waitForTimeout(400)
  check('al marcarla, queda marcada', (await b.getAttribute('aria-pressed')) === 'true')
  await page.locator('#mcAlbumVolver').click()
  await page.waitForTimeout(700)
  const t = await titulos(page)
  check('  …y sube a «Tus favoritas»', t[0] === 'Tus favoritas', t.join(' | '))
  await page.close()
}

console.log('\n── 3. La migración ──')
{
  const sql = leer('supabase-migration-sets-favoritos.sql')
  check('la tabla lleva RLS', /enable row level security/i.test(sql))
  check('  …y su política mira auth.uid()', /using \(user_id = auth\.uid\(\)\)/i.test(sql))
  check('  …y también al escribir', /with check \(user_id = auth\.uid\(\)\)/i.test(sql))
  // Sin foránea a `tcg_sets` A PROPÓSITO: el catálogo se reimporta entero
  // y una foránea se llevaría por delante los favoritos de la gente.
  check('sin foránea al catálogo', !/references public\.tcg_sets/i.test(sql))
  check('la pareja es la clave', /primary key \(user_id, set_id\)/i.test(sql))
  // Y el cliente distingue «no hay ninguno» de «no está la migración».
  const js = leer('js/mi-coleccion/datos.js')
  check('sin la migración se devuelve null, no un conjunto vacío',
    /sinMigracion\) return null/.test(js.slice(js.indexOf('favoritosDeSets'))))
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
