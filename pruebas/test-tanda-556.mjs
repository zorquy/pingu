// Tanda 556 — las eras se llamaban «ME», y el japonés se quedó sin cartas.
//
// PINGU: «las eras están mal. La era de Megaevolución se llama ME, Scarlet
// and Violet sale SV, Sword and Shield sale SWSH… revisa el nombre, ponmelo
// bonito, porque luego en el filtro se ve eso. Y los sets japoneses los
// tenemos en orden y con los logos; el único problema es que no hay ninguna
// carta. Eso es importante».
//
// Dos fallos y los dos de la misma familia: **algo que dejó de significar
// lo que significaba**.
//
//   1. El rótulo de una era sale de `serie_name`, y los sets OCCIDENTALES
//      no lo tienen —la 329 ya lo midió: el listado de TCGdex es un resumen
//      y la serie solo viene en el set completo—. Caía al `serie_id`: «me»,
//      «sv», «swsh». Nunca se vio porque hasta el filtro de la 546 esos
//      nombres no estaban juntos en una lista.
//
//   2. EL GORDO: `quedanPendientes` pregunta si queda alguna carta NUESTRA
//      sin marcar. Esa pregunta valía cuando el único trabajo era
//      enriquecer lo que ya teníamos. Desde la 547 el japonés se CALCA, y
//      después del borrón había CERO cartas japonesas: la respuesta fue «no
//      queda ninguna por marcar» y la pasada se volvió a dormir sin gastar
//      un crédito y sin traer una sola carta, cada cinco minutos, **con el
//      panel diciendo “hecho”**.
import { readFileSync } from 'node:fs'
import { procesar } from '/home/user/pingu/netlify/functions/scrydex-relleno.mjs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { gruposDeEstanteria } from '/home/user/pingu/js/mi-coleccion/estanteria.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 250) : ''}`)
}
const leer = (p) => readFileSync(`/home/user/pingu/${p}`, 'utf8')
const ENV = { SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't', SUPABASE_SERVICE_ROLE_KEY: 's' }

console.log('── 1. EL GORDO: un catálogo que se calca y está vacío ──')
{
  // El doble: un set japonés emparejado y NI UNA carta nuestra, que es
  // exactamente como quedó la base después del borrón de la 547.
  const hecho = { paginas: 0, escrito: [] }
  const d = {
    restImpl: async (ruta) => {
      if (/scrydex_estado/.test(ruta)) return [{ valor: {} }]
      // La pregunta del freno: «¿queda alguna carta sin marcar?». CERO,
      // porque no hay ninguna carta.
      if (/scrydex_at=is\.null/.test(ruta)) return []
      if (/tcg_sets/.test(ruta)) return [{ id: 'mf_ja', scrydex_id: 'mf_ja' }]
      return []
    },
    fetchImpl: async () => {
      hecho.paginas++
      return { ok: true, json: async () => ({
        data: hecho.paginas === 1
          ? [{ id: 'mf_ja-1', number: '001', name: 'イーブイ', supertype: 'Pokémon', subtypes: ['Basic'], expansion: { id: 'mf_ja' }, translation: { en: { name: 'Eevee' } } }]
          : [],
        page: hecho.paginas, page_size: 250, total_count: 1,
      }) }
    },
    escribirImpl: async (t, filas) => { hecho.escrito.push(...filas) },
  }
  const r = await procesar({
    env: ENV, paginas: 1, mercado: 'JP', idioma: 'ja', claveEstado: 'cartas-jp',
    restImpl: d.restImpl, fetchImpl: d.fetchImpl, escribirImpl: d.escribirImpl, guardarEstadoImpl: async () => {},
  })
  check('la pasada NO se duerme', !r.cuerpo.hecho, JSON.stringify(r.cuerpo.porque || r.cuerpo).slice(0, 140))
  check('  …pide su catálogo', hecho.paginas >= 1, String(hecho.paginas))
  check('  …y trae la carta', hecho.escrito.some((f) => f.id === 'mf_ja-1'), JSON.stringify(hecho.escrito.map((f) => f.id)))

  // Y LA OTRA MITAD, que es la que hace que esto sea una prueba y no una
  // afirmación: en el OCCIDENTAL, que no se calca, «no queda ninguna por
  // marcar» sigue significando lo que significaba y la pasada se calla.
  const w = { paginas: 0 }
  const rw = await procesar({
    env: ENV, paginas: 1,
    restImpl: async (ruta) => {
      if (/scrydex_estado/.test(ruta)) return [{ valor: {} }]
      if (/scrydex_at=is\.null/.test(ruta)) return []
      if (/tcg_sets/.test(ruta)) return [{ id: 'sv10', scrydex_id: 'sv10' }]
      return []
    },
    fetchImpl: async () => { w.paginas++; return { ok: true, json: async () => ({ data: [], total_count: 0 }) } },
    escribirImpl: async () => {}, guardarEstadoImpl: async () => {},
  })
  check('en el occidental sí se calla', rw.cuerpo.hecho === true, JSON.stringify(rw.cuerpo).slice(0, 120))
  check('  …sin gastar un crédito', w.paginas === 0 && rw.cuerpo.creditos === 0, String(w.paginas))
}

console.log('── 2. El nombre de una era ──')
{
  // Un set occidental de verdad: con `serie_id` y SIN `serie_name`, que es
  // como están los 210.
  const sets = [{ id: 'me01', market: 'WEST', name: 'Evolución Mega', serie_id: 'me', serie_name: null, serie_name_en: null, release_date: '2026-09-26', card_count_total: 10 }]
  // Antes: el identificador en la cara.
  check('sin nada, sale el identificador', gruposDeEstanteria(sets)[0].titulo === 'me', gruposDeEstanteria(sets)[0].titulo)
  // Con la fila de `tcg_eras`, el nombre de verdad.
  const eras = new Map([['me', { nombre: 'Megaevolución', orden: 0 }]])
  check('con su fila, el nombre bonito', gruposDeEstanteria(sets, new Set(), eras)[0].titulo === 'Megaevolución', gruposDeEstanteria(sets, new Set(), eras)[0].titulo)
  // El nombre del catálogo sigue mandando donde lo hay: el japonés trae
  // `serie_name_en` de Scrydex y no hace falta tocarlo.
  const jp = [{ id: 'm6a_ja', market: 'JP', name: 'セ', serie_id: 'mega-evolution', serie_name: null, serie_name_en: 'Mega Evolution', release_date: '2026-09-16', card_count_total: 10 }]
  check('donde el catálogo sí da nombre, se usa', gruposDeEstanteria(jp)[0].titulo === 'Mega Evolution', gruposDeEstanteria(jp)[0].titulo)
}

console.log('── 2b. Y en /cartas, que es la página PÚBLICA del catálogo ──')
{
  // `js/cartas.js` necesita un DOM, así que se prueba DONDE SE USA: una
  // función suelta no diría nada de la pantalla (la lección de la 313).
  // Y ahí el fallo era gordo: sin nombre de era, TODO el catálogo
  // occidental caía en «Sin clasificar».
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [
      { id: 'me01', market: 'WEST', name: 'Evolución Mega', serie_id: 'me', serie_name: null, release_date: '2026-09-26', card_count_official: 10, card_count_total: 10, logo_path: 'x/l' },
    ]
    window.__FAKE_ERAS__ = [{ market: 'WEST', id: 'me', nombre: 'Megaevolución', orden: 0 }]
  })
  await page.route('**assets.tcgdex.net/**', (r) => r.abort())
  await page.goto('http://localhost:8892/cartas.html', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const texto = await page.locator('#listaColecciones').innerText()
  check('la era sale con su nombre', /Megaevoluci/i.test(texto), texto.slice(0, 160))
  check('  …y no como «me» ni «Sin clasificar»', !/sin clasificar/i.test(texto), texto.slice(0, 160))
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  await browser.close()
}

console.log('── 3. La migración de los nombres ──')
{
  const mig = leer('supabase-migration-eras-nombres.sql')
  for (const [id, nombre] of [['me', 'Megaevolución'], ['sv', 'Escarlata y Púrpura'], ['swsh', 'Espada y Escudo'], ['sm', 'Sol y Luna']]) {
    check(`«${id}» pasa a «${nombre}»`, new RegExp(`'${id}',\\s*'${nombre}'`).test(mig), id)
  }
  check('y también las japonesas', /'mega-evolution',\s*'Megaevolución'/.test(mig))
  // No toca `serie_name` de ningún set: le pone nombre a la ERA, que es
  // para lo que nació `tcg_eras`.
  check('no toca los sets', !/update public\.tcg_sets/.test(mig.replace(/--[^\n]*/g, '')))
  // Y DICE lo que se deja fuera: la lista la he escrito a mano, así que
  // dar por hecho que están todas sería la lección de la 484 otra vez.
  check('dice qué eras se quedan sin nombre', /not exists \(select 1 from public\.tcg_eras/.test(mig))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
