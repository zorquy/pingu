// Tanda 794 — NU7, el lunes de PokeDoc: UN aviso por persona a la semana
// con lo que ha cambiado (valor, bajadas de su lista, quién da lo que busca
// y lo que sale), sin repetirse, respetando Ajustes y solo si hay algo.
// Y NU5, el modo feria: un QR propio (js/qr.js) que lleva a tu perfil con el
// cruce, y tus listas guardadas para verlas sin cobertura.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const m = await import(`${RAIZ}/netlify/functions/lunes.mjs`)
// Intl pone un espacio duro antes del «€»: se compara con uno normal.
const llano = (x) => String(x ?? '').replace(/\u00a0/g, ' ')

console.log('── 1. Lo puro ──')
const v = m.cambiosDeValor([
  { user_id: 'a', dia: '2026-10-05', valor: 100 }, { user_id: 'a', dia: '2026-10-12', valor: 142.4 },
  { user_id: 'b', dia: '2026-10-11', valor: 10 }, { user_id: 'b', dia: '2026-10-12', valor: 50 },
])
check('el valor de la semana, y no de dos días seguidos', v.get('a') === 42 && !v.has('b'), JSON.stringify([...v]))
check('ha bajado: la media de la semana un 10 % bajo la del mes', m.haBajado({ cm_avg7: 9, cm_avg30: 10 }) && !m.haBajado({ cm_avg7: 9.5, cm_avg30: 10 }) && !m.haBajado({ cm_avg7: null, cm_avg30: 10 }))
const t = m.textoDelLunes({ valor: 42, bajadas: 3, personas: 2, salen: ['Mega Evolución'] })
check('el texto, en el orden de la propuesta', llano(t?.body) === 'Tu colección: +42 € esta semana. 3 cartas de tu lista han bajado. 2 personas dan algo que buscas. Esta semana sale Mega Evolución.', t?.body)
check('sin nada que contar, no hay aviso (y un lanzamiento solo no basta)', m.textoDelLunes({}) === null && m.textoDelLunes({ salen: ['X'] }) === null)
check('una bajada en negativo', /−17 €/.test(llano(m.textoDelLunes({ valor: -17 })?.body)))

console.log('── 2. La pasada, con una base de mentira ──')
const escritas = []
const pedidas = []
const datos = {
  user_collection_value: [{ user_id: 'u1', dia: '2026-10-05', valor: 100 }, { user_id: 'u1', dia: '2026-10-12', valor: 130 }, { user_id: 'u3', dia: '2026-10-04', valor: 5 }, { user_id: 'u3', dia: '2026-10-12', valor: 6 }],
  user_wants: [{ user_id: 'u1', card_id: 'c1' }, { user_id: 'u2', card_id: 'c2' }, { user_id: 'u4', card_id: 'c1' }],
  tcg_sets: [],
  user_notifications: [{ recipient_id: 'u4' }],
  tcg_card_prices: [{ card_id: 'c1', cm_avg7: 5, cm_avg30: 10 }, { card_id: 'c2', cm_avg7: 10, cm_avg30: 10 }],
  user_collection: [{ user_id: 'u2', card_id: 'c1' }, { user_id: 'u1', card_id: 'c1' }],
  user_profiles: [{ id: 'u3', notification_prefs_disabled: ['resumen_lunes'] }],
}
const rest = async (ruta, clave, op = {}) => {
  pedidas.push(ruta)
  if (op.method === 'POST') { escritas.push(...JSON.parse(op.body)); return null }
  return datos[ruta.split('?')[0]] || []
}
const r = await m.procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'x' }, rest, ahora: new Date('2026-10-12T06:47:00Z') })
const de = (u) => escritas.find((e) => e.recipient_id === u)
check('u1: +30 €, una bajada y una persona que la da (no él mismo)', llano(de('u1')?.body) === 'Tu colección: +30 € esta semana. Una carta de tu lista ha bajado. Una persona da algo que buscas.', de('u1')?.body)
check('u2: nada que contar, no recibe nada', !de('u2'))
check('u3 lo tiene apagado en Ajustes', !de('u3'))
check('u4 ya lo recibió esta semana', !de('u4'))
check('todo a la campanita, con su tipo', escritas.every((e) => e.type === 'resumen_lunes' && e.link) && r.ok, JSON.stringify(r))
check('ninguna petición fuera de nuestra base', pedidas.every((p) => !/^https?:/.test(p)))
check('sin la clave, no hace nada y lo dice', (await m.procesar({ env: {}, rest })).error === 'Falta SUPABASE_SERVICE_ROLE_KEY')
check('una vez por semana', m.config.schedule === '47 6 * * 1')
check('Ajustes deja apagarlo', /resumen_lunes:/.test(readFileSync(`${RAIZ}/js/notifications.js`, 'utf8')))

console.log('── 3. El QR, módulo a módulo contra la referencia ──')
// La referencia es segno 1.6.6 con el relleno de la norma al pie de la letra
// (segno mete un byte de ceros de más cuando el flujo ya acaba en frontera
// de byte: válido, pero distinto). Pegada tal cual sale, no a mano (la 501).
const { matrizQR, svgQR } = await import(`${RAIZ}/js/qr.js`)
const ref = JSON.parse(readFileSync(new URL('./fixture-qr-794.json', import.meta.url), 'utf8'))
let iguales = 0, total = 0
for (const [texto, porMascara] of Object.entries(ref)) for (const [k, filas] of Object.entries(porMascara)) {
  total++
  const mia = matrizQR(texto, Number(k)).map((f) => f.map((v) => (v ? '1' : '0')).join(''))
  if (mia.length === filas.length && mia.every((f, i) => f === filas[i])) iguales++
}
check(`las ${total} matrices (tres textos, ocho máscaras, versiones 3 a 16) son idénticas`, iguales === total && total === 24, `${iguales} de ${total}`)
check('el SVG lleva su margen y el tamaño pedido', /viewBox="0 0 37 37" width="200"/.test(svgQR('https://pokedoc.es/usuario/pingu?cruce=1', { tam: 200 })))

console.log('── 4. El modo feria y el cruce ──')
const html = readFileSync(`${RAIZ}/feria.html`, 'utf8')
check('/feria no se indexa y carga su hoja', /name="robots" content="noindex"/.test(html) && /href="\/css\/feria\.css"/.test(html))
check('el service worker guarda /feria para abrirla sin cobertura', /pathname\.replace\(\/\\\.html\$\/, ''\) === '\/feria'/.test(readFileSync(`${RAIZ}/sw.js`, 'utf8')))
check('«Tú» lleva al modo feria', /fila\('\/feria'/.test(readFileSync(`${RAIZ}/js/menu-tu.js`, 'utf8')))
check('la ficha de la persona pinta el cruce al llegar por el QR', /has\('cruce'\)/.test(readFileSync(`${RAIZ}/js/usuario.js`, 'utf8')) && /id="perfilCruce"/.test(readFileSync(`${RAIZ}/usuario.html`, 'utf8')))
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const b = await chromium.launch()
{
  const p = await b.newPage()
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  const r = await p.evaluate(async () => {
    const { cruceCon } = await import('/js/cruce-persona.js')
    const { enlaceDeFeria } = await import('/js/feria.js')
    const c = cruceCon('x', [{ user_id: 'x', card_id: 'a' }, { user_id: 'y', card_id: 'b' }], [{ user_id: 'x', card_id: 'c' }])
    return { teDa: c.teDa.map((f) => f.card_id), leDas: c.leDas.map((f) => f.card_id), e1: enlaceDeFeria({ username: 'pingu' }), e2: enlaceDeFeria({ id: 'u-1' }) }
  })
  check('el cruce es lo SUYO de los dos lados', r.teDa.join() === 'a' && r.leDas.join() === 'c', JSON.stringify(r))
  check('el enlace del QR: el perfil con ?cruce=1', r.e1 === 'https://pokedoc.es/usuario/pingu?cruce=1' && r.e2 === 'https://pokedoc.es/usuario.html?id=u-1&cruce=1', JSON.stringify(r))
  await p.close()
}
{
  const ctx = await b.newContext({ serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    // Sin red: la consulta de las listas falla (el doble la hace fallar).
    window.__FAKE_FALLA__ = { user_collection: true }
    localStorage.setItem('pd-feria-v1', JSON.stringify({ cuando: '2026-10-11T09:00:00Z', enlace: 'https://pokedoc.es/usuario/pingu?cruce=1', nombre: 'PINGU', doy: [{ n: 2, nombre: 'Charizard ex', num: 'obf 125' }], busco: [{ n: 1, nombre: 'Pikachu', num: '' }] }))
  })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/feria`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('#feriaQr svg', { timeout: 6000 }).catch(() => {})
  const v = await p.evaluate(() => ({ qr: Boolean(document.querySelector('#feriaQr svg path')), doy: document.getElementById('feriaDoy')?.textContent, aviso: document.getElementById('feriaGuardado')?.textContent }))
  check('sin red, enseña lo guardado y lo dice', v.qr && /2× Charizard ex/.test(v.doy) && /Sin conexión/.test(v.aviso), JSON.stringify(v))
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
