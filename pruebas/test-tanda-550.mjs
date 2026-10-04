// Tanda 550 — las colecciones, colocadas a mano; y tres cartas por fila.
//
// PINGU: «me gustaría que los sets en el panel de admin fuesen editables.
// Ya sea para ordenar yo manualmente los sets por eras, añadir una era
// nueva… que yo pudiese crear una era, por ejemplo McDonald's, y ahí
// incluir todas las expansiones del McDonald's. Los sets que sobren los
// borro, y los que estén mal los puedo corregir yo. También para meterle el
// logo o no, y para mover el orden».
//
// Y: «en las expansiones salen de 2 en 2 y son demasiado grandes; me
// gustaría 3 para que quepan más cartas por página sin tener que
// scrollear».
//
// Lo que esta prueba vigila de verdad es que colocar UNA cosa no obligue a
// colocarlas TODAS: lo puesto a mano manda, y lo que no esté sigue
// ordenándose como siempre. Si no fuera así, la primera era que PINGU mueva
// mandaría las otras veinte al fondo de golpe.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { gruposDeEstanteria } from '/home/user/pingu/js/mi-coleccion/estanteria.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 250) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (p) => readFileSync(`/home/user/pingu/${p}`, 'utf8')

const set = (id, extra = {}) => ({
  id, market: 'WEST', name: id, serie_id: 'sv', serie_name: 'Escarlata y Púrpura',
  release_date: '2026-01-01', card_count_total: 10, ...extra,
})

console.log('── 1. Una era colocada a mano manda ──')
{
  const sets = [
    set('a', { serie_id: 'sv', serie_name: 'Escarlata y Púrpura', release_date: '2026-09-01' }),
    set('b', { serie_id: 'mcdonalds', serie_name: null, release_date: '2014-01-01' }),
  ]
  // Sin nada puesto: manda la fecha, y «Escarlata y Púrpura» va primero.
  const sinNada = gruposDeEstanteria(sets)
  check('sin nada puesto, manda la fecha', sinNada[0].id === 'sv', JSON.stringify(sinNada.map((g) => g.id)))
  // Con la era puesta a mano: va primero aunque sus sets sean de 2014.
  const eras = new Map([['mcdonalds', { nombre: "McDonald's", orden: 1 }]])
  const conMano = gruposDeEstanteria(sets, new Set(), eras)
  check('colocada a mano, va delante', conMano[0].id === 'mcdonalds', JSON.stringify(conMano.map((g) => g.id)))
  check('  …y con el nombre que se le ha puesto', conMano[0].titulo === "McDonald's", conMano[0].titulo)
  // Y LO QUE IMPORTA: la que no está puesta no se descoloca.
  check('  …y la que no está puesta sigue detrás, no al revés', conMano[1].id === 'sv', JSON.stringify(conMano.map((g) => g.id)))
  check('  …con su nombre de siempre', conMano[1].titulo === 'Escarlata y Púrpura', conMano[1].titulo)
}

console.log('── 2. Y un set colocado dentro de su era ──')
{
  const sets = [
    set('viejo', { release_date: '2020-01-01' }),
    set('nuevo', { release_date: '2026-01-01' }),
    set('elegido', { release_date: '2015-01-01', orden: 1 }),
  ]
  const g = gruposDeEstanteria(sets)[0]
  check('el que lleva número va primero', g.sets[0].id === 'elegido', JSON.stringify(g.sets.map((s) => s.id)))
  // Los demás NO se tocan: siguen por fecha, lo nuevo arriba. Así se puede
  // colocar uno sin tener que numerar los doscientos.
  check('  …y los demás siguen por fecha', g.sets[1].id === 'nuevo' && g.sets[2].id === 'viejo', JSON.stringify(g.sets.map((s) => s.id)))
  // Dos con número, entre ellos manda el número.
  const dos = gruposDeEstanteria([set('x', { orden: 2 }), set('y', { orden: 1 })])[0]
  check('entre dos colocados, manda el número', dos.sets[0].id === 'y', JSON.stringify(dos.sets.map((s) => s.id)))
}

console.log('── 3. Lo que la biblioteca tiene que PEDIR ──')
{
  // Una columna que no se pide llega `undefined`, y el orden a mano no se
  // usaría — sin dar error (la lección de la 523).
  const mc = leer('js/mi-coleccion.js')
  const select = mc.split('.from(\'tcg_sets\')')[1]?.split(')')[0] || ''
  for (const col of ['orden', 'oculto']) {
    check(`la consulta de sets pide \`${col}\``, new RegExp(`\\b${col}\\b`).test(select), select.slice(0, 160))
  }
  check('y las eras se piden de `tcg_eras`', /from\('tcg_eras'\)/.test(mc))
  // Un set escondido no sale. Es lo que se usa en vez de borrar.
  check('un set escondido se cae de la lista', /!s\.oculto/.test(mc))
  // Y al cambiar de catálogo se tiran: son POR MERCADO.
  check('al cambiar de catálogo se tiran las eras', /erasAMano = null/.test(mc))
}

console.log('── 4. La migración ──')
{
  const mig = leer('supabase-migration-colecciones-editables.sql')
  for (const c of ['orden', 'oculto', 'scrydex_manda']) {
    check(`añade \`${c}\``, new RegExp(`add column if not exists ${c}\\b`).test(mig))
  }
  check('crea `tcg_eras`', /create table if not exists public\.tcg_eras/.test(mig))
  // La RLS no da error: devuelve una lista VACÍA. Sin política de lectura,
  // la biblioteca de quien no ha entrado se quedaría sin los nombres y la
  // misma pantalla diría dos cosas según quién mire (la lección de la 510).
  check('  …que la lee todo el mundo', /create policy "tcg_eras_read"[\s\S]{0,80}using \(true\)/.test(mig))
  check('  …y la escribe solo el admin', /create policy "tcg_eras_write"[\s\S]{0,120}is_admin\(\)/.test(mig))
  // No borra nada: es una tanda de añadir.
  check('no borra ni una fila', !/\bdelete from\b|\bdrop table\b/i.test(mig.replace(/--[^\n]*/g, '')))
}

console.log('── 5. El panel: lo que se queda y lo que se va ──')
{
  const html = leer('admin/index.html')
  check('hay una sección de Colecciones', /data-section="colecciones"/.test(html) && /id="section-colecciones"/.test(html))
  // Los botones de sondeo eran de una sola vez y lo que contestaron está
  // escrito en SCHEMA.md: dejarlos es dejar delante botones que nadie va a
  // volver a pulsar.
  for (const b of ['btnMirarSet', 'btnSondearMercado', 'btnSondearScrydex', 'btnMedirIngles', 'btnVerificarScrydex', 'btnContarMercados', 'btnDiagnosticar']) {
    check(`fuera «${b}»`, !html.includes(b))
  }
  // Y lo que SÍ se usa cada día se queda.
  check('se queda «¿Cómo va el relleno?»', html.includes('btnComoVaScrydex'))
  check('y los logos de Scrydex', html.includes('btnSetsScrydex'))
  // Sin código muerto detrás: un manejador de un botón que ya no existe es
  // justo lo que PINGU pidió limpiar.
  const js = leer('admin/js/admin.js')
  for (const f of ['mirarUnSet', 'sondearMercado', 'sondearScrydex', 'medirInglesScrydex', 'verificarScrydex', 'contarMercados', 'diagnosticarCartas']) {
    check(`y su función \`${f}\` tampoco está`, !new RegExp(`function ${f}\\b`).test(js))
  }
  check('ni el módulo que solo usaban ellos', !js.includes('cuentas-mercado'))
}

console.log('── 6. El set que manda Scrydex, uno a uno ──')
{
  // PINGU: «el 30 Classic Collection lo estamos trayendo de TCGdex; tráelo
  // de Scrydex». Es OCCIDENTAL, así que el catálogo sigue siendo de TCGdex
  // —eso alimenta «Jugar»— y la excepción se marca en la fila del set.
  const relleno = leer('netlify/functions/scrydex-relleno.mjs')
  check('el relleno lee `scrydex_manda`', /scrydex_manda/.test(relleno))
  check('  …y lo usa para dejar pasar un set suelto', /!calcamos && !mandaScrydex\.has/.test(relleno))
  // Y si la columna no existe todavía, la pasada no se cae entera.
  check('  …y aguanta que la migración no esté puesta', /42703/.test(relleno))
}

console.log('── 7. Tres cartas por fila en el móvil ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST', card_count_official: 9, card_count_total: 9, logo_path: 'x/l' }]
    window.__FAKE_CARTAS__ = Array.from({ length: 9 }, (_, i) => ({
      id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1),
      name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `x/${i + 1}`,
      rarity: 'Rare', category: 'Pokemon', variants: { normal: true },
    }))
    // Una línea: la estantería solo enseña una colección de la que tengas
    // algo cuando miras la de otra persona… y sin sesión, todas son de
    // otro. Con una carta dentro, la colección sale y el álbum pinta sus
    // nueve huecos igual.
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: new Date().toISOString() }]
  })
  await page.route('**assets.tcgdex.net/**', (r) => r.abort())
  // Por `?ver=`, que es como se comparte una pestaña: en el móvil las
  // pestañas viven en otra barra y pulsar la del escritorio falla con
  // «element is not visible» —encontrar un elemento no es verlo, la lápida
  // de la 447—.
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  await page.locator('#mcEstanteriaRejilla').getByText('Mega Evolution').first().click()
  await page.waitForTimeout(2000)
  // Cuántas caben en la PRIMERA FILA: se miran las posiciones de verdad,
  // que es lo que ve quien mira la pantalla, y no la regla de CSS (una
  // prueba que mira la regla no prueba lo que la regla hace).
  const porFila = await page.evaluate(() => {
    const celdas = [...document.querySelectorAll('.mc-album-rejilla > *')]
    if (!celdas.length) return 0
    const arriba = celdas[0].getBoundingClientRect().top
    return celdas.filter((c) => Math.abs(c.getBoundingClientRect().top - arriba) < 2).length
  })
  check('en un móvil caben TRES por fila', porFila === 3, `caben ${porFila}`)
  // Y que no se desborde: una rejilla de tres que saca barra horizontal es
  // peor que una de dos (la lección de la 320).
  const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  check('  …y sin barra horizontal', !desborda)
  await browser.close()
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
