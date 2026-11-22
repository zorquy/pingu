// Tanda 1415 — «Quién tiene lo que buscas» en la ficha de un evento (PINGU, de
// «Dónde va cada función»: «9, sí»). Debajo de «Quién va», solo si has dicho
// «Voy»: los que van y dan cartas de tu La quiero o buscan las tuyas, con sus
// cartas y «Escribir». Sin la migración no sale nada; sin cruces, un vacío
// con salida a La quiero y Las que doy. Y lo puro: chapas, resumen e ids.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
const ev = (asistentes) => ({ id: 'id-ib', slug: 'iberian', nombre: 'IBERIAN CARD SHOW', tipo: 'card_show', publicado: true, color: '#3a5fb8', ciudad: 'Madrid', sitio: 'Pabellón de Cristal',
  horario: [{ dia: dia(3), desde: '10:00', hasta: '19:00' }], empieza: new Date(dia(3) + 'T10:00').toISOString(), termina: new Date(dia(3) + 'T19:00').toISOString(), asistentes })
const VAN = [{ user_id: 'user-1' }, { user_id: 'mod-1' }, { user_id: 'user-2' }]
const CRUCES = [
  { user_id: 'user-1', username: 'ash', display_name: 'Ash Ketchum', avatar_url: null, tiene_n: 6, busca_n: 1, tiene: ['sv1-1', 'sv1-2', 'sv1-3', 'sv1-4', 'sv1-5', 'sv1-6'].map((id) => ({ id, market: 'WEST' })), busca: [{ id: 'sv1-9', market: 'WEST' }] },
  { user_id: 'mod-1', username: 'misty', display_name: 'Misty', avatar_url: null, tiene_n: 0, busca_n: 2, tiene: [], busca: [{ id: 'sv1-7', market: 'WEST' }, { id: 'sv1-8', market: 'WEST' }] },
]

const b = await chromium.launch()
async function abrir({ movil = false, voy = true, cruces = CRUCES } = {}) {
  const ctx = await contexto(b, movil, 'admin-1')
  const asistentes = voy ? [...VAN, { user_id: 'admin-1' }] : VAN
  await ctx.addInitScript(`window.__FAKE_EVENTOS__ = ${JSON.stringify([ev(asistentes)])}; ${cruces ? `window.__FAKE_EVENTO_CRUCES__ = ${JSON.stringify(cruces)};` : ''}`)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/ViewTransition|Transition was/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}/eventos/iberian`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ev-quien', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1200)
  return { ctx, page, errores }
}

console.log('── Lo puro ──')
{
  const { ctx, page } = await abrir()
  const r = await page.evaluate(async () => {
    const { chapasDe, resumenDe, idsParaFotos } = await import('/js/evento-cruces.js')
    return {
      a: chapasDe({ tiene_n: 3, busca_n: 1 }).map((c) => c.texto).join('|'),
      b: chapasDe({ tiene_n: 0, busca_n: 2 }).map((c) => c.texto).join('|'),
      c: resumenDe([{ tiene_n: 2, busca_n: 0 }, { tiene_n: 0, busca_n: 1 }, { tiene_n: 1, busca_n: 1 }]),
      d: idsParaFotos([{ tiene: [{ id: 'a' }, { id: 'b' }], busca: [{ id: 'a' }] }, { tiene: [{ id: 'c' }], busca: [] }], 1).join(),
    }
  })
  check('chapas: «Da 3 de tu La quiero» y «Busca 1 tuya»', r.a === 'Da 3 de tu La quiero|Busca 1 tuya', r.a)
  check('  …y «Busca 2 tuyas», sin la de dar si no da', r.b === 'Busca 2 tuyas', r.b)
  check('resumen con los dos lados', r.c === 'De los que van, 2 dan cartas de tu La quiero y 2 buscan cartas que tú das.', r.c)
  check('ids para las fotos: los primeros de cada lado, sin repetir', r.d === 'a,c', r.d)
  await ctx.close()
}

console.log('── Con «Voy» ──')
{
  const { ctx, page, errores } = await abrir()
  const r = await page.evaluate(() => {
    const s = document.querySelector('#evCruces')
    return {
      hay: !!s, despues: !!document.querySelector('.ev-quien + #evCruces'),
      titulo: s?.querySelector('h2')?.textContent.trim(),
      intro: s?.querySelector('.ev-cruces-intro')?.textContent.trim(),
      filas: [...(s?.querySelectorAll('.ev-cruce') || [])].map((li) => ({
        nombre: li.querySelector('.ev-cruce-quien b')?.textContent, chapas: [...li.querySelectorAll('.ev-cruce-chapa')].map((c) => c.textContent).join('|'),
        cartas: li.querySelectorAll('.ev-cruce-carta').length, mas: li.querySelector('.ev-cruce-mas')?.textContent || '',
        escribir: li.querySelector('.ev-cruce-escribir')?.getAttribute('href'),
      })),
    }
  })
  check('el bloque sale justo debajo de «Quién va»', r.hay && r.despues)
  check('con su título', r.titulo === 'Quién tiene lo que buscas', r.titulo)
  check('el resumen cuenta los dos lados', r.intro?.startsWith('De los que van, 1 da cartas de tu La quiero y 2 buscan cartas que tú das.'), r.intro)
  check('Ash primero: da 6 y busca 1', r.filas[0]?.nombre === 'Ash Ketchum' && r.filas[0].chapas === 'Da 6 de tu La quiero|Busca 1 tuya', JSON.stringify(r.filas[0]))
  check('  …cuatro cartas de lo que da y «+2», y la que busca', r.filas[0]?.cartas === 5 && r.filas[0].mas === '+2', `${r.filas[0]?.cartas} ${r.filas[0]?.mas}`)
  check('  …«Escribir» abre la conversación con él', r.filas[0]?.escribir === '/mensajes.html?with=user-1', r.filas[0]?.escribir)
  check('Misty: busca 2 tuyas', r.filas[1]?.chapas === 'Busca 2 tuyas', r.filas[1]?.chapas)
  if (process.env.CAPTURAS) await page.locator('#evCruces').screenshot({ path: `${process.env.CAPTURAS}/1415-pc.png` }).catch(() => {})
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── Sin «Voy» ──')
{
  const { ctx, page, errores } = await abrir({ voy: false })
  check('no sale el bloque', !(await page.$('#evCruces')))
  await page.click('[data-voy]')
  await page.waitForSelector('#evCruces .ev-cruce', { timeout: 8000 }).catch(() => {})
  check('al darle a «Voy», sale', (await page.$$('#evCruces .ev-cruce')).length === 2)
  await page.click('[data-voy]')
  await page.waitForTimeout(800)
  check('y al quitarlo, se va', !(await page.$('#evCruces')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── Sin cruces y sin migración ──')
{
  const { ctx, page, errores } = await abrir({ cruces: [] })
  const v = await page.evaluate(() => ({ texto: document.querySelector('#evCruces .ev-cruces-vacio')?.textContent || '', salidas: [...document.querySelectorAll('#evCruces .ev-cruces-salidas a')].map((a) => a.getAttribute('href')).join(',') }))
  check('sin cruces: lo dice y lleva a La quiero y Las que doy', /nadie da todavía/.test(v.texto) && v.salidas === '/mi-coleccion?ver=quiero,/mi-coleccion?ver=cambios', JSON.stringify(v))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
  const sin = await abrir({ cruces: null })
  check('sin la migración: nada, ni el hueco', !(await sin.page.$('#evCruces')))
  check('sin errores', !sin.errores.length, sin.errores.join(' | '))
  await sin.ctx.close()
}

console.log('── Móvil ──')
{
  const { ctx, page, errores } = await abrir({ movil: true })
  await page.locator('#evCruces').scrollIntoViewIfNeeded().catch(() => {})
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  check('nada se sale de lado', ancho <= 1, ancho)
  if (process.env.CAPTURAS) await page.locator('#evCruces').screenshot({ path: `${process.env.CAPTURAS}/1415-movil.png` }).catch(() => {})
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
