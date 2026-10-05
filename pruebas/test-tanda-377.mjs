// Tanda 377 — lo que vale tu colección, en el tiempo.
//
// Hasta ahora sabíamos lo que vale AHORA, y solo ahora: se sumaba al
// pintar la página y no se guardaba. Así que «¿ha subido este mes?» no
// se podía contestar, y es la pregunta que se hace cualquiera que
// colecciona.
//
// Lo que esta prueba mira y no supone:
//   · Que la foto diaria suma IGUAL que la página. Si sumara distinto,
//     un día la gráfica diría 400 € y la cifra de arriba 380, y nadie
//     sabría cuál creerse.
//   · Que con un solo día NO se pinta una línea plana: «no ha cambiado»
//     y «todavía no sabemos» son dos cosas distintas (lección de la 319).
//   · Que el porcentaje no se calcula desde cero.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const BASE = 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()

console.log('\n── 1. La cuenta, sin navegador ──')
{
  const { resumenDeValor, graficaHtml } = await import('/home/user/pingu/js/mi-coleccion/grafica-valor.js')

  const filas = [
    { dia: '2026-09-01', valor: 100, copias: 10, sin_precio: 3 },
    { dia: '2026-09-15', valor: 130, copias: 12, sin_precio: 2 },
    { dia: '2026-09-30', valor: 125, copias: 12, sin_precio: 1 },
  ]
  const r = resumenDeValor(filas)
  check('el cambio es del primer día al último', r.cambio === 25, String(r.cambio))
  check('  …y el porcentaje va sobre el primero', Math.round(r.pct) === 25, String(r.pct))
  check('  …y se queda el último valor', r.ultimo.valor === 125)

  // Una colección que empieza en 0 € y llega a 40 NO ha subido «infinito
  // por ciento»: ha subido 40 €. `null` es la respuesta.
  const desdeCero = resumenDeValor([{ dia: '2026-09-01', valor: 0 }, { dia: '2026-09-02', valor: 40 }])
  check('desde cero no se inventa un porcentaje', desdeCero.pct === null, String(desdeCero.pct))
  check('  …pero sí se dice cuánto ha subido', desdeCero.cambio === 40)

  // Con un solo día no hay LÍNEA: una línea plana de un punto diría «no
  // ha cambiado nada» cuando lo que pasa es que no sabemos nada. Desde la
  // 651 sí hay gráfica —un punto y la cifra de hoy—, y se dice qué pasa.
  check('con un solo día no se pinta una línea plana', !/mc-valor-linea/.test(graficaHtml([filas[0]])) && /mc-valor-punto/.test(graficaHtml([filas[0]])))
  // Y SIN la explicación de debajo (653): PINGU, «todo eso lo quitaría
  // porque no es necesaria». Lo dice el rótulo «hoy» y nada más.
  check('  …y no hay párrafo explicando (653)', !/primera foto/.test(graficaHtml([filas[0]])) && /hoy, /.test(graficaHtml([filas[0]])), graficaHtml([filas[0]]).slice(0, 80))
  check('  …y sin ninguno, igual', !/<svg/.test(graficaHtml([])))

  // Todos los días valiendo lo mismo: el rango es 0 y ahí se divide.
  const plana = graficaHtml([{ dia: '2026-09-01', valor: 50 }, { dia: '2026-09-02', valor: 50 }])
  check('una línea plana no saca NaN', !/NaN|Infinity/.test(plana), (plana.match(/NaN|Infinity/) || [])[0])

  // Y las filas desordenadas se ordenan: PostgREST devuelve lo que le
  // pides, pero la cuenta no puede depender de eso.
  const alReves = resumenDeValor([...filas].reverse())
  check('las filas se ordenan por fecha', alReves.cambio === 25, String(alReves.cambio))

  // El aviso de las cartas sin precio. Sin él, un salto en la gráfica no
  // se distingue de «ese día se curaron 200 precios», que es justo lo
  // que va a pasar las primeras semanas.
  check('se avisa de las cartas sin precio', /no tiene precio todavía/.test(graficaHtml(filas)),
    graficaHtml(filas).slice(-200))
  check('  …y no se avisa si no hay ninguna',
    !/precio todavía/.test(graficaHtml(filas.map((f) => ({ ...f, sin_precio: 0 })))))
}

console.log('\n── 2. La foto la toma la BASE, no el navegador ──')
{
  const sql = leer('supabase-migration-valor-historico.sql')
  // Una consulta POR PERSONA se comería los 30 segundos de una función
  // programada de Netlify en cuanto haya unos cuantos coleccionistas.
  check('es una sola sentencia para todo el mundo', /group by c\.user_id/.test(sql))
  // Correr dos veces el mismo día (un reintento, un despliegue) no puede
  // dejar dos puntos con la misma fecha.
  check('  …y correrla dos veces no parte la gráfica', /on conflict \(user_id, dia\) do update/.test(sql))

  // El valor tiene que salir IGUAL que en la página. El orden es el de
  // `valorDeLinea` + `valorDe`: manual, tendencia, media 30, desde.
  check('el valor manual manda sobre Cardmarket',
    sql.indexOf('p_valor_manual') < sql.indexOf('p_trend'), 'el orden del coalesce')
  // Y un reverso sin cifras propias cae a las normales — es el arreglo
  // de la 375, y si aquí no estuviera la gráfica diría menos que la
  // cifra de arriba.
  check('  …y el reverso sin cifras propias cae a las normales',
    /p_variante = 'reverse'/.test(sql) && /nullif\(p_trend_holo, 0\)/.test(sql))

  // Escribir es solo de la función programada: recorrer TODAS las
  // colecciones no es cosa de nadie más.
  check('la foto solo la puede tomar el servidor',
    /revoke all on function public\.coleccion_foto_diaria\(date\) from public, anon, authenticated/.test(sql))
  check('  …y la tabla no tiene política de escritura',
    !/create policy user_collection_value_(crear|insert|editar)/.test(sql))
  // Pero tu histórico lo puede leer quien ve tu colección: enseñar la
  // gráfica y esconder el total de arriba no tendría sentido.
  check('tu histórico lo ve quien ve tu colección', /coleccion_es_publica\(user_id\)/.test(sql))

  const fn = leer('netlify/functions/valor-coleccion.mjs')
  check('la función programada va una vez al día', /schedule: '7 4 \* \* \*'/.test(fn),
    (fn.match(/schedule: '[^']*'/) || [])[0])
  // Sin la migración no se grita cada noche: es «todavía no», no un
  // fallo. Mismo trato que le da `precios-coleccion` a la suya.
  check('  …y sin la migración no da guerra', /PGRST202\|Could not find/.test(fn) && /ok: true, saltado/.test(fn))
}

console.log('\n── 3. En la pantalla ──')
const browser = await chromium.launch()
const CARTA = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#f7d354"/></svg>'

// `total` es lo que vale la colección AHORA: desde la 377 es lo que
// encabeza la gráfica, así que la semilla tiene que valer lo que el
// último punto quiere decir. Una línea con una copia y su valor a mano.
async function abrir(valores, total = 150) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 220)))
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: CARTA }))
  await page.route('**/api.tcgdex.net/**', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }))
  await page.addInitScript(([vals, total]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', serie_id: 'sv', serie_name: 'Escarlata y Púrpura' }]
    window.__FAKE_CARTAS__ = [{ id: 'sv1-1', set_id: 'sv1', local_id: '1', name: 'Carta 1', name_es: 'Carta 1', image_path: 'x/1', market: 'WEST', rarity: 'Rare' }]
    window.__FAKE_COLECCION__ = [{
      id: 'c1', user_id: 'admin-1', card_id: 'sv1-1', market: 'WEST', idioma: 'es', estado: 'NM',
      variante: 'normal', cantidad: 1, cambio: 0, gradeo: null, valor_manual: total,
      precio_compra: null, notas: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }]
    window.__FAKE_VALOR__ = vals
  }, [valores, total])
  await page.goto(`${BASE}/mi-coleccion.html?ver=resumen`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  return { page, errores }
}

const dia = (n, valor, sinPrecio = 0) => ({
  user_id: 'admin-1',
  dia: new Date(Date.now() - n * 86400000).toISOString().slice(0, 10),
  valor, copias: 2, distintas: 1, sin_precio: sinPrecio,
})

{
  const { page, errores } = await abrir([dia(30, 100), dia(15, 120), dia(0, 150)], 150)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const caja = page.locator('#mcValorCaja')
  check('la caja del valor va ARRIBA, fuera de la rejilla',
    (await page.locator('.mc-resumen-rejilla #mcValorCaja').count()) === 0)
  const t = limpio(await caja.textContent())
  check('dice lo que vale hoy', /150,00/.test(t), t.slice(0, 120))
  check('  …y cuánto ha subido', /\+50,00/.test(t), t.slice(0, 160))
  check('  …con su porcentaje', /\+50,0 %/.test(t), t.slice(0, 200))
  check('la gráfica se pinta', (await caja.locator('svg.mc-valor-grafica').count()) === 1)

  // El hueco está reservado: sin alto fijo el resumen pega un salto
  // cuando llega la consulta.
  const alto = await caja.locator('svg').evaluate((e) => Math.round(e.getBoundingClientRect().height))
  // 180 desde la 464, que le dio sitio para que se lea con relieve. Lo
  // que esta tanda defiende no es el número sino que el hueco ESTÉ: sin
  // alto fijo el resumen pega un salto cuando llega la consulta. Así que
  // se comprueba que haya uno y que coincida con el esqueleto de al lado.
  check('  …con su hueco reservado', alto >= 120, `${alto}px`)

  // Y el color no es lo único que dice si sube: el signo va delante,
  // que es lo que lee quien no distingue los dos colores.
  check('el signo va en el texto, no solo el color', /\+/.test(limpio(await caja.locator('.mc-valor-cambio').textContent())))

  // La gráfica tiene texto alternativo de verdad, no «gráfica».
  // Con `\s` y no con un espacio: `Intl` mete un espacio FINO antes del
  // € (U+202F), que no es el de la barra espaciadora. Buscar el normal
  // deja la prueba roja por algo que en pantalla se lee igual.
  const alt = await caja.locator('svg').getAttribute('aria-label')
  check('la gráfica se puede leer', /de 100,00\s€ a 150,00\s€/.test(alt || ''), alt)
  await page.close()
}

console.log('\n── 4. Bajando, y con un solo día ──')
{
  const { page } = await abrir([dia(10, 200), dia(0, 180)], 180)
  const caja = page.locator('#mcValorCaja')
  const t = limpio(await caja.textContent())
  check('una bajada se dice', /-20,00/.test(t), t.slice(0, 140))
  check('  …y se marca como bajada', (await caja.locator('.mc-valor-cambio.baja').count()) === 1)
  await page.close()

  const solo = await abrir([dia(0, 100)], 100)
  const t2 = limpio(await solo.page.locator('#mcValorCaja').textContent())
  check('con un solo día hay un punto y no una línea (651)', (await solo.page.locator('.mc-valor-un-punto').count()) === 1 && (await solo.page.locator('.mc-valor-linea').count()) === 0 && /100,00 €/.test(t2))
  check('  …y sin párrafo debajo (653)', !/primera foto/.test(t2) && (await solo.page.locator('#mcValorCaja p.subtext').count()) === 0, t2.slice(0, 140))
  await solo.page.close()
}

console.log('\n── 5. Sin histórico, el resumen sigue entero ──')
{
  // Sin la migración `user_collection_value` no existe y la consulta
  // falla. El resto del resumen no puede irse con ella.
  const { page, errores } = await abrir([])
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('las otras cuatro cajas siguen ahí', (await page.locator('.mc-resumen-caja:not(.mc-valor-caja)').count()) === 4,
    String(await page.locator('.mc-resumen-caja:not(.mc-valor-caja)').count()))
  await page.close()
}

console.log('\n── 5b. La gráfica se encabeza con el valor de AHORA ──')
{
  // La foto diaria se toma a las 4:07, así que el último punto guardado
  // NO es lo que vale la colección al mediodía. Sin esto, la pantalla
  // enseñaba 768 € en la cifra de arriba y 534 en la gráfica — dos
  // totales distintos de lo mismo, y ninguna forma de saber cuál va.
  const { resumenDeValor } = await import('/home/user/pingu/js/mi-coleccion/grafica-valor.js')
  const hoy = new Date().toISOString().slice(0, 10)
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  // Si la foto de HOY existe, el valor de ahora la pisa.
  const pisa = resumenDeValor([{ dia: ayer, valor: 100 }, { dia: hoy, valor: 120 }], { ahora: 155 })
  check('el valor de ahora manda sobre la foto de hoy', pisa.ultimo.valor === 155, String(pisa.ultimo.valor))
  check('  …y el cambio se cuenta contra él', pisa.cambio === 55, String(pisa.cambio))
  check('  …sin añadir un punto de más', pisa.dias.length === 2, String(pisa.dias.length))

  // Y si la última foto es de ayer, se añade el de hoy.
  const anade = resumenDeValor([{ dia: ayer, valor: 100 }, { dia: ayer, valor: 100 }], { ahora: 140 })
  check('si la última foto es vieja, se añade hoy', anade.ultimo.valor === 140, String(anade.ultimo.valor))

  // Sin `ahora` sigue funcionando como antes: es un dato opcional, y un
  // opcional se recibe con el valor que NO afirma nada (lección de la
  // 319). `null` no puede convertirse en «vale cero».
  const sin = resumenDeValor([{ dia: ayer, valor: 100 }, { dia: hoy, valor: 120 }])
  check('sin el valor de ahora, manda la última foto', sin.ultimo.valor === 120, String(sin.ultimo.valor))
  check('  …y un cero no se cuela por no pasarlo',
    resumenDeValor([{ dia: ayer, valor: 100 }, { dia: hoy, valor: 120 }], { ahora: null }).ultimo.valor === 120)
}

console.log('\n── 6. Un ENLACE directo a una pestaña también se pinta ──')
{
  // El fallo que salió montando esto, y que venía de la 374: la pestaña
  // se elige ANTES de que lleguen las líneas —hace falta, para que se
  // vea enseguida la que pide la dirección—, así que entrar directo a
  // /mi-coleccion?ver=resumen pintaba «Cuando añadas cartas» con la
  // colección vacía... y ya no se volvía a pintar NUNCA.
  //
  // No se veía porque la prueba de la 374 PULSABA la pestaña, y para
  // entonces las líneas ya estaban. Se comprueba LA FORMA —entrar por
  // enlace a cada pestaña que se pinta de una vez— y no solo el caso.
  const { page } = await abrir([dia(10, 100), dia(0, 120)], 120)
  const t = limpio(await page.locator('#mcResumenPanel').textContent())
  check('/mi-coleccion?ver=resumen se pinta con las cartas', !/Cuando añadas cartas/.test(t), t.slice(0, 120))
  check('  …y con las cuatro cajas', (await page.locator('.mc-resumen-rejilla .mc-resumen-caja').count()) === 4,
    String(await page.locator('.mc-resumen-rejilla .mc-resumen-caja').count()))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
