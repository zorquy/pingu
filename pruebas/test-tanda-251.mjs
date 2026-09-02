import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 251, lo que pidió PINGU tras apuntar su primer torneo en
// /mis-partidas: cerrarlo para que deje de pedir rondas, poder reabrirlo
// y arreglar una ronda mal apuntada, y un filtro para que la lista no
// sea un scroll sin fin.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const abrir = async (semillas = {}) => {
  const page = await browser.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, { __FAKE_SESSION__: 'admin-1', ...semillas })
  await page.goto(`${BASE}/mis-partidas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}
const escrituras = (page, tabla, tipo) =>
  page.evaluate(
    ([t, k]) => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === t && e.tipo === k),
    [tabla, tipo]
  )

const TORNEO = { id: 'logt-1', nombre: 'Liga del jueves', donde: 'Tienda de Cádiz', mi_mazo: 'd:dragapult', mi_mazo_nombre: 'Dragapult', jugado_el: '2026-08-30' }
const RONDAS = [
  { id: 'r1', user_id: 'admin-1', torneo_id: 'logt-1', mi_mazo: 'd:dragapult', mi_mazo_nombre: 'Dragapult', rival_mazo: 'd:gardevoir', rival_mazo_nombre: 'Gardevoir', resultado: 'win', tipo: 'normal', jugada_el: '2026-08-30' },
  { id: 'r2', user_id: 'admin-1', torneo_id: 'logt-1', mi_mazo: 'd:dragapult', mi_mazo_nombre: 'Dragapult', rival_mazo: 'd:charizard', rival_mazo_nombre: 'Charizard', resultado: 'loss', tipo: 'normal', jugada_el: '2026-08-30' },
]
const MUNDO = { __FAKE_LOG_TORNEOS__: [TORNEO], __FAKE_PARTIDAS__: RONDAS }

const desplegar = async (page, id = 'logt-1') => {
  await page.locator(`[data-abrir-torneo="${id}"]`).click()
  await page.waitForTimeout(350)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Un torneo abierto ofrece seguir metiendo ──')
{
  const { page, errores } = await abrir(MUNDO)
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  await desplegar(page)
  check('hay «+ Añadir ronda»', (await page.locator('[data-anadir-ronda]').count()) === 1)
  check('y «Cerrar torneo»', (await page.locator('[data-cerrar-torneo]').count()) === 1)
  check('no hay «Reabrir»', (await page.locator('[data-reabrir-torneo]').count()) === 0)
  check('sin chapa de cerrado', (await page.locator('.partidas-chapa-cerrado').count()) === 0)
  check('y sus rondas se pueden editar', (await page.locator('[data-editar-ronda]').count()) === 2)
  await page.close()
}

console.log('\n── 2. Cerrarlo deja de pedir rondas ──')
{
  const { page } = await abrir(MUNDO)
  await desplegar(page)
  await page.locator('[data-cerrar-torneo]').click()
  await page.waitForTimeout(1200)
  const escritas = await escrituras(page, 'match_log_torneos', 'update')
  check('se guarda la fecha de cierre', escritas.length === 1 && !!escritas[0].filas[0]?.cerrado_el, JSON.stringify(escritas).slice(0, 120))
  check('la tarjeta se marca como cerrada', (await page.locator('.partidas-torneo.cerrado').count()) === 1)
  check('sale la chapa', (await page.locator('.partidas-chapa-cerrado').count()) === 1)
  await desplegar(page)
  check('ya NO hay «+ Añadir ronda»', (await page.locator('[data-anadir-ronda]').count()) === 0)
  check('ni se pueden editar sus rondas', (await page.locator('[data-editar-ronda]').count()) === 0)
  check('pero sí reabrirlo', (await page.locator('[data-reabrir-torneo]').count()) === 1)
  await page.close()
}

console.log('\n── 3. Y reabrirlo lo devuelve a como estaba ──')
{
  const { page } = await abrir({ __FAKE_LOG_TORNEOS__: [{ ...TORNEO, cerrado_el: '2026-08-31T10:00:00Z' }], __FAKE_PARTIDAS__: RONDAS })
  check('empieza cerrado', (await page.locator('.partidas-torneo.cerrado').count()) === 1)
  await desplegar(page)
  await page.locator('[data-reabrir-torneo]').click()
  await page.waitForTimeout(1200)
  const escritas = await escrituras(page, 'match_log_torneos', 'update')
  check('el cierre se borra (vuelve a null)', escritas.length === 1 && escritas[0].filas[0]?.cerrado_el === null, JSON.stringify(escritas).slice(0, 120))
  check('ya no está apagado', (await page.locator('.partidas-torneo.cerrado').count()) === 0)
  check('y vuelve «+ Añadir ronda»', (await page.locator('[data-anadir-ronda]').count()) === 1)
  await page.close()
}

console.log('\n── 4. Editar una ronda mal apuntada ──')
{
  const { page } = await abrir(MUNDO)
  await desplegar(page)
  await page.locator('[data-editar-ronda="r2"]').click()
  await page.waitForTimeout(700)
  check('el formulario dice que se edita', /Editar ronda/.test(await page.locator('#partidaFormTitulo').innerText()))
  check('y el botón también', /Guardar cambios/.test(await page.locator('#btnGuardarPartida').innerText()))
  // Lo importante: el mazo del rival vuelve al campo. Si saliera vacío,
  // guardar lo cambiaría por «sin mazo» sin que nadie lo pidiera.
  const rival = await page.locator('#selRival1 .selector-mazo-texto').inputValue()
  check('el mazo del rival vuelve puesto', rival === 'Charizard', rival)
  check('y el resultado también', (await page.locator('#partidaResultado').inputValue()) === 'loss')

  await page.locator('#partidaResultado').selectOption('win')
  await page.locator('#btnGuardarPartida').click()
  await page.waitForTimeout(1400)
  const upd = await escrituras(page, 'match_log', 'update')
  check('se ACTUALIZA, no se inserta otra', upd.length === 1 && (await escrituras(page, 'match_log', 'insert')).length === 0, JSON.stringify(upd).slice(0, 100))
  check('con el resultado nuevo', upd[0]?.filas[0]?.resultado === 'win', upd[0]?.filas[0]?.resultado || '')
  // Y NO se cambia de casilla en la matriz por haberla editado: la
  // clave del mazo rival tiene que salir igual que entró.
  check('el mazo rival no se ha movido de casilla', upd[0]?.filas[0]?.rival_mazo === 'd:charizard', upd[0]?.filas[0]?.rival_mazo || '')
  await page.close()
}

console.log('\n── 5. Borrar una ronda suelta, en dos toques ──')
{
  const { page } = await abrir(MUNDO)
  await desplegar(page)
  const btn = page.locator('[data-borrar-ronda="r1"]')
  await btn.click()
  await page.waitForTimeout(300)
  check('el primer toque pregunta', /Seguro/i.test(await btn.innerText()), await btn.innerText())
  check('y no ha borrado nada', (await escrituras(page, 'match_log', 'delete')).length === 0)
  await btn.click()
  await page.waitForTimeout(1200)
  const del = await escrituras(page, 'match_log', 'delete')
  check('el segundo sí borra', del.length === 1 && del[0].filas[0]?.id === 'r1', JSON.stringify(del).slice(0, 100))
  await page.close()
}

console.log('\n── 6. El buscador y el estado ──')
{
  // OJO con el «dónde»: si todos dijeran «Tienda de Cádiz», buscar
  // «cadiz» los encontraría los doce y la prueba no probaría nada.
  const muchos = Array.from({ length: 12 }, (_, i) => ({
    ...TORNEO,
    id: `logt-${i + 1}`,
    nombre: i === 0 ? 'Regional de Cádiz' : `Liga del jueves ${i + 1}`,
    donde: i === 0 ? 'Regional' : 'Tienda del barrio',
    cerrado_el: i % 2 === 0 ? '2026-08-31T10:00:00Z' : null,
  }))
  const { page, errores } = await abrir({ __FAKE_LOG_TORNEOS__: muchos, __FAKE_PARTIDAS__: [] })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('no salen los doce de golpe', (await page.locator('.partidas-torneo').count()) === 8, String(await page.locator('.partidas-torneo').count()))
  check('y lo dice con un botón', /Ver 4 más/.test(await page.locator('#partidasTorneos').innerText()))

  await page.locator('#btnVerMasTorneosLog').click()
  await page.waitForTimeout(400)
  check('«ver más» los enseña todos', (await page.locator('.partidas-torneo').count()) === 12)

  // Buscar sin tilde tiene que encontrar «Cádiz».
  await page.locator('#torneoBuscar').fill('cadiz')
  await page.waitForTimeout(400)
  check('el buscador ignora las tildes', (await page.locator('.partidas-torneo').count()) === 1)
  check('y es el que toca', /Regional de C/.test(await page.locator('#partidasTorneos').innerText()))

  // Y al revés: escribir la tilde tiene que encontrarlo igual. Este es
  // el caso que prueba que se normaliza LO QUE SE ESCRIBE y no solo los
  // datos — el rigor lo pilló porque solo se buscaba «cadiz».
  await page.locator('#torneoBuscar').fill('Cádiz')
  await page.waitForTimeout(400)
  check('escribiendo la tilde también lo encuentra', (await page.locator('.partidas-torneo').count()) === 1, String(await page.locator('.partidas-torneo').count()))

  await page.locator('#torneoBuscar').fill('')
  await page.locator('#torneoEstado').selectOption('abiertos')
  await page.waitForTimeout(400)
  check('«sin cerrar» deja solo los abiertos', (await page.locator('.partidas-torneo').count()) === 6, String(await page.locator('.partidas-torneo').count()))
  check('y ninguno lleva chapa de cerrado', (await page.locator('.partidas-chapa-cerrado').count()) === 0)

  await page.locator('#torneoEstado').selectOption('cerrados')
  await page.waitForTimeout(400)
  check('«cerrados» deja los otros seis', (await page.locator('.partidas-torneo').count()) === 6, String(await page.locator('.partidas-torneo').count()))

  await page.locator('#torneoBuscar').fill('zzzz')
  await page.waitForTimeout(400)
  check('sin resultados lo dice en cristiano', /Ningún torneo casa/.test(await page.locator('#partidasTorneos').innerText()))
  await page.close()
}

console.log('\n── 7. Las partidas sueltas no se cortan en silencio ──')
{
  // 35 sueltas: antes se enseñaban 30 y las otras cinco desaparecían sin
  // que nada lo dijera. El rigor pilló que no había prueba de esto.
  const sueltas = Array.from({ length: 35 }, (_, i) => ({
    id: `s-${i + 1}`,
    user_id: 'admin-1',
    mi_mazo: 'd:dragapult',
    mi_mazo_nombre: 'Dragapult',
    rival_mazo: 'd:gardevoir',
    rival_mazo_nombre: 'Gardevoir',
    resultado: 'win',
    tipo: 'normal',
    donde: 'Escalera',
    jugada_el: '2026-08-30',
  }))
  const { page } = await abrir({ __FAKE_PARTIDAS__: sueltas })
  await page.locator('[data-vista="sueltas"]').click()
  await page.waitForTimeout(500)
  check('se enseñan 30', (await page.locator('#partidasLista .partidas-fila').count()) === 30, String(await page.locator('#partidasLista .partidas-fila').count()))
  check('y DICE que hay cinco más', /Ver 5 más/.test(await page.locator('#partidasLista').innerText()))
  await page.locator('#btnVerMasSueltas').click()
  await page.waitForTimeout(400)
  check('«ver más» las enseña todas', (await page.locator('#partidasLista .partidas-fila').count()) === 35)
  check('y el botón desaparece', (await page.locator('#btnVerMasSueltas').count()) === 0)
  await page.close()
}

console.log('\n── 8. Editar el torneo entero, mazo incluido ──')
{
  const { page } = await abrir(MUNDO)
  await desplegar(page)
  await page.locator('[data-editar-torneo="logt-1"]').click()
  await page.waitForTimeout(700)
  check('el formulario dice que se edita', /Editar el torneo/.test(await page.locator('#torneoLogTitulo').innerText()))
  check('avisa de que las rondas se mueven', !(await page.locator('#torneoLogAviso').isHidden()))
  check('el nombre viene puesto', (await page.locator('#torneoLogNombre').inputValue()) === 'Liga del jueves')
  check('la fecha también', (await page.locator('#torneoLogFecha').inputValue()) === '2026-08-30')
  const mazo = await page.locator('#selTorneoMio1 .selector-mazo-texto').inputValue()
  check('y el mazo que se jugó', mazo === 'Dragapult', mazo)

  await page.locator('#torneoLogNombre').fill('Liga del viernes')
  await page.locator('#btnGuardarTorneoLog').click()
  await page.waitForTimeout(1400)
  const upd = await escrituras(page, 'match_log_torneos', 'update')
  check('se actualiza el torneo', upd.length === 1 && upd[0].filas[0]?.nombre === 'Liga del viernes', JSON.stringify(upd).slice(0, 110))
  check('no se crea otro torneo', (await escrituras(page, 'match_log_torneos', 'insert')).length === 0)
  // Las rondas NO las toca el cliente: de arrastrarlas se encarga el
  // disparador de la base, comprobado aparte contra PostgreSQL de
  // verdad. Si algún día alguien mete aquí un segundo update, esto lo
  // dice — y ese es justo el fallo que el disparador evita.
  check('y el cliente NO toca las rondas a mano', (await escrituras(page, 'match_log', 'update')).length === 0)
  await page.close()
}

console.log('\n── 9. Las estadísticas, sin scroll lateral ──')
{
  const muchas = []
  // OJO con esta semilla: si todos los rivales tuvieran el mismo número
  // de partidas, ordenar por «lo más jugado» o por porcentaje daría lo
  // mismo y la prueba no probaría el orden. Así que «Gardevoir» es el
  // más cruzado y NO el mejor, y «Snorlax» es 2-0 con solo dos.
  const rivales = [
    ['Gardevoir', 5, 5],
    ['Charizard', 2, 3],
    ['Raging Bolt', 3, 1],
    ['Lugia', 1, 2],
    ['Snorlax', 2, 0],
    ['Miraidon', 1, 1],
    ['Lost Box', 0, 2],
    ['Gholdengo', 2, 1],
  ]
  let nn = 0
  for (const [r, v, d] of rivales) {
    for (let n = 0; n < v + d; n++) {
      muchas.push({
        id: `m-${nn++}`, user_id: 'admin-1',
        mi_mazo: 'd:dragapult', mi_mazo_nombre: 'Dragapult',
        rival_mazo: `d:${r.toLowerCase()}`, rival_mazo_nombre: r,
        resultado: n < v ? 'win' : 'loss', tipo: 'normal', donde: 'Escalera', jugada_el: '2026-08-30',
      })
    }
  }
  const { page, errores } = await abrir({ __FAKE_PARTIDAS__: muchas })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  await page.locator('[data-vista="stats"]').click()
  await page.waitForTimeout(600)

  check('ya no hay tabla que arrastrar', (await page.locator('.partidas-matriz-scroll, table.partidas-matriz').count()) === 0)
  check('hay un bloque por mazo mío', (await page.locator('.partidas-mazo-bloque').count()) === 1)
  check('con sus ocho rivales en lista', (await page.locator('.partidas-enf').count()) === 8, String(await page.locator('.partidas-enf').count()))

  // Lo que se pidió: que NADA se salga de ancho.
  const desborde = await page.evaluate(() => {
    const c = document.getElementById('partidasMatriz')
    return { caja: c.scrollWidth > c.clientWidth + 1, pagina: document.documentElement.scrollWidth > window.innerWidth + 1 }
  })
  check('la caja no scrollea de lado', !desborde.caja)
  check('ni la página entera', !desborde.pagina)

  // Y en un móvil estrecho tampoco.
  await page.setViewportSize({ width: 360, height: 780 })
  await page.waitForTimeout(300)
  const movil = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  check('tampoco a 360 px', !movil)

  // El orden: primero lo que MÁS te cruzas, aunque no sea lo que mejor
  // se te da. Gardevoir va 5-5 (10 partidas) y Snorlax 2-0 (100%): si se
  // ordenara por porcentaje, mandaría Snorlax.
  const nombres = await page.locator('.partidas-enf-rival > span').allInnerTexts()
  check('manda lo más jugado, no lo mejor', nombres[0] === 'Gardevoir', nombres.join(' / '))
  check('y el 100% de dos partidas no se cuela arriba', nombres.indexOf('Snorlax') > 0, nombres.join(' / '))

  const primera = await page.locator('.partidas-enf').first().innerText()
  check('cada fila lleva su récord y su porcentaje', /5-5/.test(primera) && /50%/.test(primera), primera.replace(/\n/g, ' '))

  // La barra tiene que MEDIR: sin esto, una barra fija pasaría por
  // buena y no diría nada de nada.
  const barras = await page.locator('.partidas-enf-barra > span').evaluateAll((n) => n.map((x) => x.style.width))
  check('la barra de un 100% va llena', barras[nombres.indexOf('Snorlax')] === '100%', barras.join(' / '))
  check('la de un 0% va vacía', barras[nombres.indexOf('Lost Box')] === '0%', barras.join(' / '))
  check('y la del 5-5 va por la mitad', barras[0] === '50%', barras[0] || '')
  check('no son todas iguales', new Set(barras).size > 1, barras.join(' / '))
  await page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
