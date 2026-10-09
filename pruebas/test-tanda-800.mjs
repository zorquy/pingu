// Tanda 800 — una impresión vieja con reimpresión legal se juega, también
// en una lista de torneo. PINGU: «puedo meter una Ultra Ball con la letra
// F… esa sí es jugable, porque tiene un print actual». El revisor de los
// torneos tenía su propia regla de la reimpresión, más corta que la del
// constructor: solo buscaba por `name` y solo reimpresiones CON letra
// legal, y las de TCGGO no traen letra. Ahora la regla es UNA.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. Una sola regla ──')
check('el constructor ya no tiene su copia', !/function nombresConReimpresionLegal/.test(leer('js/constructor/datos.js')) && !/function coleccionesRecientes/.test(leer('js/constructor/datos.js')))
check('…la importa de carta-legalidad', /import \{[^}]*nombresConReimpresionLegal[^}]*\} from '\.\.\/carta-legalidad\.js'/.test(leer('js/constructor/datos.js')))
check('el revisor del torneo usa la misma', /nombresConReimpresionLegal\(viejas\)/.test(leer('js/torneos/cartas-decklist.js')))
check('la ficha del servidor cuenta las reimpresiones sin letra', /regulation_mark=is\.null/.test(leer('netlify/edge-functions/meta-social.js')) && /name_key\.eq|\['name_key', carta\?\.name_key\]/.test(leer('netlify/edge-functions/meta-social.js')))
check('carta-legalidad no arrastra el núcleo del constructor', !/constructor\/nucleo\.js/.test(leer('js/carta-legalidad.js')))

console.log('── 2. La lista de torneo ──')
const b = await chromium.launch()
async function lista(cartas, sets) {
  const p = await b.newPage({ viewport: { width: 1150, height: 900 } })
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.addInitScript(([cartas, sets]) => {
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
  }, [cartas, sets])
  await p.goto(`${BASE}/carta.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1000)
  const r = await p.evaluate(async () => {
    const { pintarDecklistVisual } = await import('/js/torneos/cartas-decklist.js')
    const caja = document.createElement('div')
    document.body.appendChild(caja)
    await pintarDecklistVisual(caja, { pokemon: [], trainer: [{ quantity: 4, name: 'Ultra Ball', set: 'BRS', number: '150' }], energy: [] })
    const aviso = caja.querySelector('[data-reglamento]')
    return { ilegales: caja.querySelectorAll('.torneo-carta-ilegal').length, aviso: (aviso && !aviso.classList.contains('hidden') && aviso.textContent) || '' }
  })
  await p.close()
  return { ...r, errores }
}
const SETS = [
  { id: 'swsh9', name: 'Brilliant Stars', market: 'WEST', serie_id: 'swsh', tcg_online_code: 'BRS', release_date: '2022-02-25' },
  { id: 'sv5', name: 'Temporal Forces', market: 'WEST', serie_id: 'sv', tcg_online_code: 'TEF', release_date: '2024-03-22' },
  { id: 'tcggo-me1', name: 'Mega Evolution', market: 'WEST', serie_id: 'me', tcg_online_code: 'MEG', release_date: '2025-09-26' },
]
const VIEJA = { id: 'swsh9-150', set_id: 'swsh9', market: 'WEST', local_id: '150', name: 'Ultra Ball', category: 'Trainer', image_path: 'swsh/swsh9/150', regulation_mark: 'F' }
// Una carta de la marca legal más vieja (H) fija la fecha de corte.
const MARCA_H = { id: 'sv5-1', set_id: 'sv5', market: 'WEST', local_id: '1', name: 'Bulbasaur', category: 'Pokemon', regulation_mark: 'H' }
const NUEVA_SIN_LETRA = { id: 'tcggo-me1-131', set_id: 'tcggo-me1', market: 'WEST', local_id: '131', name: 'Ultra Ball', category: 'Trainer', regulation_mark: null }
{
  const r = await lista([VIEJA, MARCA_H, NUEVA_SIN_LETRA], SETS)
  check('sin errores', r.errores.length === 0, r.errores.join(' | '))
  check('la Ultra Ball F con reimpresión SIN letra de una colección nueva NO se acusa', r.ilegales === 0 && !/fuera del reglamento/i.test(r.aviso), JSON.stringify(r))
}
{
  const r = await lista([VIEJA, MARCA_H, { ...NUEVA_SIN_LETRA, regulation_mark: 'I' }], SETS)
  check('…ni con reimpresión con letra legal', r.ilegales === 0, JSON.stringify(r))
}
{
  // La moderna con el español aún en `name` (reparación de la 335 a medias):
  // no casa por `name` ni por su clave —que la base calcula de `name`—, sí
  // por el traducido, que llevan las dos.
  const r = await lista([{ ...VIEJA, name: "Boss's Orders", name_es: 'Órdenes de Jefes' }, MARCA_H, { ...NUEVA_SIN_LETRA, regulation_mark: 'J', name: 'Órdenes de Jefes', name_es: 'Órdenes de Jefes' }], SETS)
  check('…ni si la moderna solo casa por el nombre traducido', r.ilegales === 0, JSON.stringify(r))
}
{
  // Y el contrario, para que el arreglo no apague el revisor: sin
  // reimpresión legal, se acusa.
  const r = await lista([VIEJA, MARCA_H], SETS)
  check('sin reimpresión legal, la F SÍ se acusa', r.ilegales === 1 && /fuera del reglamento/i.test(r.aviso), JSON.stringify(r))
  // Una sin letra de una colección VIEJA no es reimpresión legal.
  const r2 = await lista([VIEJA, MARCA_H, { ...NUEVA_SIN_LETRA, id: 'swsh9-x', set_id: 'swsh9' }], SETS)
  check('…y una sin letra de una colección vieja no la salva', r2.ilegales === 1, JSON.stringify(r2))
}

console.log('── 3. La ficha de carta y el constructor dicen lo mismo ──')
{
  const p = await b.newPage()
  await p.addInitScript(([cartas, sets]) => { window.__FAKE_SETS__ = sets; window.__FAKE_CARTAS__ = cartas }, [[VIEJA, MARCA_H, NUEVA_SIN_LETRA], SETS])
  await p.goto(`${BASE}/carta.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(800)
  const r = await p.evaluate(async (vieja) => {
    const L = await import('/js/carta-legalidad.js')
    const D = await import('/js/constructor/datos.js')
    return { ficha: (await L.legalidadDeCarta(vieja))?.reimpresion, constructor: [...(await D.nombresConReimpresionLegal([vieja]))], misma: D.nombresConReimpresionLegal === L.nombresConReimpresionLegal }
  }, VIEJA)
  check('la ficha dice que tiene reimpresión legal', r.ficha === true, JSON.stringify(r))
  check('el constructor también', r.constructor.length === 1, JSON.stringify(r))
  check('y es LA MISMA función, no una copia', r.misma === true)
  await p.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
