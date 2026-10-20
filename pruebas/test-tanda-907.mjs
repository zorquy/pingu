// Tanda 907 — la imagen para compartir el reto diario, y las de la cuenta.
//
// PINGU: «la captura para compartir es bastante pocha y no se sabe de qué
// se habla… ¿no puedes sacar una imagen de uno de los retos para ponerlo
// como portada?», y luego: «debería ser compartible de dos maneras, una
// como usuario con el resultado… y otra para las cuentas de PokeDoc».
//
//   1. Lo puro (js/reto-portada.js): qué portada sale de las preguntas de
//      hoy, los temas, el color, los textos y los números de la noche.
//   2. Lo estático: quién pasa qué al marco nuevo.
//   3. En pantalla: las imágenes se dibujan con el marco (el logo arriba),
//      y /admin → Redes saca la de la mañana y la de la noche con su tuit.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro ──')
const P = await import(`${RAIZ}/js/reto-portada.js`)
{
  const qs = [
    { type: 'quiz', question: '¿Cuántas?', __guideId: 'g1', __guideTitle: 'Pull rates: cómo funcionan' },
    { type: 'cartaquiz', card_ids: ['sv1-1', 'sv1-2'], correct_id: 'sv1-1', __guideId: 'g2', __guideTitle: 'Rarezas' },
    { type: 'zonas', image_url: 'https://ejemplo/zonas.png', __guideId: 'g3', __guideTitle: 'Reglas' },
    { type: 'quiz', __guideId: 'g1', __guideTitle: 'Pull rates: cómo funcionan' },
  ]
  const p = P.portadaDelReto(qs)
  check('la portada es la primera pregunta con carta…', p?.tipo === 'carta' && p.indice === 1, JSON.stringify(p))
  check('  …y NO la carta buena de «elegir la carta» (sería destripar)', p?.id === 'sv1-2')
  check('sin carta, la imagen de una pregunta; sin nada, null', P.portadaDelReto([qs[0], qs[2]])?.tipo === 'imagen' && P.portadaDelReto([qs[0]]) === null && P.portadaDelReto(null) === null)
  check('la chapa dice el número y el TEMA, no el enunciado', P.chipDePortada(p) === 'Pregunta 2 · Rarezas' && !/elegir|cuál/i.test(P.chipDePortada(p)))
  check('el tema se queda con lo de antes de los dos puntos', P.temaDe(qs[0]) === 'Pull rates')
  check('los temas sin repetir y en su orden', P.temasDelReto(qs).join('|') === 'Pull rates|Rarezas|Reglas')
  check('el color del tipo, en inglés o en español', P.tonoDeCarta({ types: ['Fire'] }) === P.tonoDeCarta({ types: ['Fuego'] }) && P.tonoDeCarta({ types: ['Fuego'] }) && P.tonoDeCarta({}) === null)
  const t = P.textoDelAnuncio({ numero: 47, temas: ['Pull rates', 'Rarezas', 'Reglas'] })
  check('el tuit de la mañana: número, temas, la invitación y el enlace', /#47/.test(t) && /pull rates, rarezas y reglas/.test(t) && /Contesta con tu resultado/.test(t) && /pokedoc\.es\/reto$/.test(t), t)
  const r = P.resumenDeResultados([{ correct: 5, total: 5 }, { correct: 4, total: 5 }, { correct: 3, total: 5 }, { correct: 4, total: 5 }, { correct: 0, total: 0 }])
  check('la noche: jugadores, media y plenos (una fila sin total no cuenta)', r.jugadores === 4 && r.media === 4 && r.plenos === 1 && r.pctPlenos === 25, JSON.stringify(r))
  check('  …y el reparto de mejor a peor, de 5/5 a 0/5', r.reparto.length === 6 && r.reparto[0].aciertos === 5 && r.reparto[1].personas === 2 && r.reparto[1].pct === 50)
  check('sin nadie, sin media (no un 0 que no ha pasado)', P.resumenDeResultados([]).media === null)
  const stats = { 'g1|a': { respondida: 40, acertada: 30 }, 'g2|b': { respondida: 3, acertada: 0 }, 'g3|c': { respondida: 20, acertada: 6 } }
  const claves = ['a', 'b', 'c', 'd']
  const d = P.laMasDificil(qs, stats, (q) => claves[qs.indexOf(q)])
  check('la más difícil, con un mínimo de respuestas (un 0 de 3 no manda)', d?.indice === 2 && d.pct === 30 && d.tema === 'Reglas', JSON.stringify(d))
  const tn = P.textoDelResumen({ numero: 47, resumen: r, dificil: d })
  check('el tuit de la noche con los mismos números', /4 personas, 4 aciertos de media y un 25 % de plenos/.test(tn) && /pregunta 3 \(reglas\): solo la acierta el 30 %/.test(tn), tn)
  const { lineaDeMedalla } = await import(`${RAIZ}/js/reto-imagen.js`)
  check('la medalla y la racha en una línea', lineaDeMedalla('plata', 6) === 'Medalla de plata · 6 días seguidos' && lineaDeMedalla(null, 1) === '' && lineaDeMedalla(null, 3) === '3 días seguidos')
}

console.log('\n── 2. Lo estático ──')
{
  const curso = leer('js/curso.js')
  check('el reto diario pasa portada, número, medalla, lema y tono', /portadaDeHoy\(portadaMod\)/.test(curso) && /numero: numeroDelDia\(hoyISO\(\)\)/.test(curso) && /medalla: ultimoResumen\.medal/.test(curso) && /lema: '5 preguntas de Pokémon TCG, cada día'/.test(curso) && /chip,\n/.test(curso))
  check('  …y guarda las preguntas de hoy al empezar', /preguntasDeHoy = preguntas\n    empezarPartidaSuelta/.test(curso))
  for (const f of ['carta-del-dia-juego', 'mas-caro-juego', 'ordena-precio-juego', 'que-expansion-juego', 'quien-es-juego']) {
    const s = leer(`js/${f}.js`)
    const bloque = s.slice(s.indexOf('pintarResultadoReto(document'), s.indexOf('pintarResultadoReto(document') + 700)
    check(`${f}: su número y su lema, y el número ya no va en el detalle`, /numero: numeroDelDia\(dia\)/.test(bloque) && /lema: '/.test(bloque) && !/detalle: `Reto #/.test(bloque))
  }
  check('los logros invitan a apuntarse, no a superar nada', /invitacion: '¿Te apuntas\?'/.test(leer('js/logro-compartir.js')))
  check('cardsByIds trae el tipo (el color del fondo)', /image_tcggo, types, tcg_sets\(/.test(leer('js/tcgdex.js')))
  check('reto-portada.js no importa nada (lo usan la web y /admin)', !/^import /m.test(leer('js/reto-portada.js')))
}

console.log('\n── 3. En pantalla ──')
const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64')
const browser = await chromium.launch()
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/404.html`, { waitUntil: 'domcontentloaded' })
  const r = await page.evaluate(async () => {
    const m = await import('/js/reto-imagen.js')
    const c = document.createElement('canvas'); c.width = 245; c.height = 342
    const x = c.getContext('2d'); x.fillStyle = '#e8a33c'; x.fillRect(0, 0, 245, 342)
    const foto = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = c.toDataURL() })
    const base = { titulo: 'El reto de hoy', cuenta: '4/5', numero: 47, tira: [true, true, false, true, true], racha: 6, medalla: 'plata', lema: '5 preguntas de Pokémon TCG, cada día', enlace: 'pokedoc.es/reto' }
    const muestra = (lienzo, px, py) => Array.from(lienzo.getContext('2d').getImageData(px, py, 1, 1).data.slice(0, 3))
    const colores = (lienzo) => { const ctx = lienzo.getContext('2d'); const s = new Set(); for (let y = 10; y < lienzo.height; y += 60) for (let x = 10; x < lienzo.width; x += 60) { const [r, g, b] = ctx.getImageData(x, y, 1, 1).data; s.add(`${r >> 4},${g >> 4},${b >> 4}`) } return s.size }
    const out = {}
    for (const formato of ['historia', 'apaisada']) {
      const con = m.pintarResultadoReto(document.createElement('canvas'), { ...base, foto, tono: '#c4502a', chip: 'Pregunta 2 · Rarezas', formato })
      out[formato] = { w: con.width, h: con.height, colores: colores(con), logo: formato === 'historia' ? muestra(con, 90, 70) : null }
    }
    const muchas = m.pintarResultadoReto(document.createElement('canvas'), { ...base, foto, filas: Array.from({ length: 6 }, () => [true, false, true, true]) })
    // La franja del lema (H − 150) no la pisan las casillas: se mira que
    // en la fila de 20 px de encima no haya ni verde ni rojo de casilla.
    const ctx = muchas.getContext('2d')
    let pisa = 0
    for (let x = 300; x < 780; x += 4) { const [r, g, b] = ctx.getImageData(x, 1350 - 182, 1, 1).data; if ((g > 140 && r < 80) || (r > 190 && g < 90)) pisa++ }
    out.seisFilas = pisa
    out.manana = colores(m.pintarAnuncioReto(document.createElement('canvas'), { numero: 47, temas: ['Pull rates', 'Rarezas'], foto, tono: '#c4502a' }))
    out.noche = colores(m.pintarResumenReto(document.createElement('canvas'), { numero: 47, resumen: { jugadores: 4, media: 4, plenos: 1, pctPlenos: 25, reparto: [{ aciertos: 5, de: 5, personas: 1, pct: 25 }, { aciertos: 4, de: 5, personas: 2, pct: 50 }] }, dificil: { indice: 2, pct: 30, tema: 'Reglas' } }))
    out.nocheX = m.pintarResumenReto(document.createElement('canvas'), { numero: 47, resumen: { jugadores: 0, media: null, plenos: 0, pctPlenos: 0, reparto: [] }, formato: 'apaisada' }).width
    return out
  })
  check('la historia y la de X, con sus medidas y pintadas', r.historia.w === 1080 && r.historia.h === 1350 && r.apaisada.w === 1200 && r.apaisada.h === 630 && r.historia.colores >= 8 && r.apaisada.colores >= 8, JSON.stringify(r))
  check('  …con el logo de la web arriba a la izquierda', r.historia.logo && Math.abs(r.historia.logo[0] - 142) < 12 && Math.abs(r.historia.logo[2] - 234) < 12, JSON.stringify(r.historia.logo))
  check('seis filas de «¿Qué carta es?» con foto no pisan el lema', r.seisFilas === 0, String(r.seisFilas))
  check('las de la cuenta se dibujan (mañana y noche, también sin nadie)', r.manana >= 6 && r.noche >= 6 && r.nocheX === 1200, JSON.stringify([r.manana, r.noche]))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}
{
  const page = await browser.newPage({ viewport: { width: 1250, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    const hoy = new Date().toISOString().slice(0, 10)
    window.__FAKE_GUIAS__ = [
      { id: 'g1', slug: 'pull', title: 'Pull rates: cómo funcionan', blocks: [{ type: 'quiz', question: '¿Cuántas ex?', options: ['1', '2'], correct: 0 }, { type: 'truefalse', statement: 'Sale una por sobre', is_true: false }] },
      { id: 'g2', slug: 'rarezas', title: 'Rarezas', blocks: [{ type: 'cartaquiz', question: '¿Cuál es la ilustración?', card_ids: ['sv1-1', 'sv1-2'], correct_id: 'sv1-1' }, { type: 'quiz', question: '¿Qué símbolo?', options: ['a', 'b'], correct: 1 }] },
      { id: 'g3', slug: 'reglas', title: 'Reglas', blocks: [{ type: 'quiz', question: '¿Cuándo evolucionas?', options: ['a', 'b'], correct: 1 }] },
    ]
    window.__FAKE_CARTAS__ = [
      { id: 'sv1-1', market: 'WEST', set_id: 'sv1', local_id: '1', name: 'Charizard ex', image_path: 'sv/sv1/1', types: ['Fuego'] },
      { id: 'sv1-2', market: 'WEST', set_id: 'sv1', local_id: '2', name: 'Pikachu', image_path: 'sv/sv1/2', types: ['Lightning'] },
    ]
    window.__FAKE_RETOS__ = [{ correct: 5, total: 5, day: hoy, user_id: 'u1' }, { correct: 4, total: 5, day: hoy, user_id: 'u2' }, { correct: 3, total: 5, day: hoy, user_id: 'u3' }]
  })
  await page.route(/assets\.tcgdex\.net|limitlesstcg|images\.tcggo|imagen-carta/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png1x1 }))
  await page.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.locator('[data-section="redes"]').click()
  await page.waitForTimeout(400)
  check('/admin → Redes tiene «El reto de hoy» con su día puesto', await page.locator('#btnRedesRetoManana').isVisible() && (await page.inputValue('#redesRetoDia')) === new Date().toISOString().slice(0, 10))
  await page.locator('#btnRedesRetoManana').click()
  await page.waitForFunction(() => document.querySelectorAll('#redesRetoLienzos canvas').length === 2, null, { timeout: 20000 }).catch(() => {})
  const m = await page.evaluate(() => ({ n: document.querySelectorAll('#redesRetoLienzos canvas').length, formatos: [...document.querySelectorAll('#redesRetoLienzos canvas')].map((c) => `${c.width}x${c.height}`), texto: document.getElementById('redesRetoTexto').value, tuit: !document.getElementById('redesRetoTuit').hidden }))
  check('la de la mañana: historia y X', m.n === 2 && m.formatos.join() === '1080x1350,1200x630', JSON.stringify(m.formatos))
  check('  …con el tuit escrito (número del día y sus temas)', m.tuit && /Ya está el reto de hoy \(#\d+\)/.test(m.texto) && /rarezas/.test(m.texto), m.texto)
  await page.locator('#btnRedesRetoNoche').click()
  await page.waitForFunction(() => /Así fue/.test(document.getElementById('redesRetoTexto').value), null, { timeout: 20000 }).catch(() => {})
  const n = await page.evaluate(() => ({ n: document.querySelectorAll('#redesRetoLienzos canvas').length, texto: document.getElementById('redesRetoTexto').value, descargas: document.querySelectorAll('#redesRetoLienzos figcaption button').length }))
  check('la de la noche: las dos, con sus descargas, y los números de todos en el tuit', n.n === 2 && n.descargas === 2 && /3 personas, 4 aciertos de media y un 33 % de plenos/.test(n.texto), n.texto)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.screenshot({ path: `${process.env.PD_CAPTURAS || '/tmp'}/907-admin.png`, fullPage: true }).catch(() => {})
  await page.close()
}
await browser.close()

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
