// Tanda 1365 — El valor de cada expansión en el tiempo (la E y la F de «Lo
// nuevo de la API de TCGGO»; PINGU: «las dos, y el sellado semanal»).
//
// Se mira: lo puro (las páginas de TCGGO a puntos, un día por día con el
// último valor en los huecos y nunca más allá del último punto, las
// expansiones por catálogo y lo que toca); la pasada (cartas sin pisar los
// días que ya hay, sellado aparte y a la semana, a medias SIN escribir y
// siguiendo por su página, el tope y el plan, sin la columna del sellado);
// la página de la expansión (cifra del sellado, gráfica con rangos y la
// lectura de un día); y la migración contra PostgreSQL.
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const S = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()
const { urlValorDeEpisodio, puntosDeValor, diaPorDia } = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
const H = await import(`${RAIZ}/netlify/functions/tcggo-valor-historico.mjs`)

console.log('── 1. Lo puro ──')
{
  check('la dirección: por su id, de lo viejo a lo nuevo, desde un día y por página', urlValorDeEpisodio(437, { desde: '2025-11-15', pagina: 3 }, 'B') === 'B/episodes/437/history-prices?sort=asc&date_from=2025-11-15&page=3')
  check('  …y el sellado con `scope=products`', /&scope=products$/.test(urlValorDeEpisodio(437, { productos: true }, 'B')))
  // La forma de su anuncio: «Response shape matches item /history-prices».
  const p = puntosDeValor({ data: { '2026-11-04': { cm_low: 650.1, tcg_player_market: 500 }, '2026-11-01': { cm_low: 640 }, '2026-11-02': { cm_low: 0 }, malo: { cm_low: 1 } }, paging: { current: 1, total: 1, per_page: 30 } })
  check('las páginas a puntos: en orden, solo con cifra y con día de verdad', JSON.stringify(p.map((x) => x.dia)) === '["2026-11-01","2026-11-04"]', JSON.stringify(p))
  const d = diaPorDia(p)
  check('un día por día, con el último valor en los huecos', d.length === 4 && d[1].cm === 640 && d[1].real === false && d[3].cm === 650.1 && d[3].real === true, JSON.stringify(d))
  check('  …y nunca más allá del último punto', d[d.length - 1].dia === '2026-11-04')
  const ex = H.expansionesDe([
    { id: 'dlr', market: 'WEST', tcggo_id: 437, release_date: '2026-11-06' },
    { id: 'me1', market: 'WEST', tcggo_id: 400, release_date: '2025-09-26' },
    { id: 'm4', market: 'JP', tcggo_id: 437, release_date: '2026-09-26' },
    { id: 'gal', market: 'WEST', tcggo_id: 437, release_date: null },
    { id: 'sin', market: 'WEST', tcggo_id: null },
  ])
  check('una expansión por catálogo e id de TCGGO, con sus sets, la más nueva primero', JSON.stringify(ex.map((e) => `${e.clave}=${e.sets.join('+')}`)) === '["WEST:437=dlr+gal","JP:437=m4","WEST:400=me1"]', JSON.stringify(ex.map((e) => e.clave)))
  const ahora = new Date('2026-11-15T10:00:00Z')
  const t = H.trabajoPendiente(ex, { cartas: { 'WEST:437': '2026-11-10', 'JP:437': 'fallo 2026-11-12', 'WEST:400': 'fallo 2026-11-01' }, sellado: { 'WEST:437': { pedido: '2026-11-12' }, 'JP:437': { pedido: '2026-11-01' } } }, ahora)
  check('lo que toca: cartas que faltan (o fallaron hace una semana), luego el sellado de hace una semana o más', JSON.stringify(t.map((x) => `${x.tipo}:${x.clave}`)) === '["cartas:WEST:400","sellado:JP:437","sellado:WEST:400"]', JSON.stringify(t.map((x) => `${x.tipo}:${x.clave}`)))
  check('  …y sin la columna del sellado hoy, solo cartas', H.trabajoPendiente(ex, { sinSellado: '2026-11-15' }, ahora).every((x) => x.tipo === 'cartas'))
}

console.log('\n── 2. La pasada ──')
const AHORA = new Date('2026-11-15T10:00:00Z')
function montar({ estado = {}, sets = null, paginas = 2, status = 200, sinColumna = false, reloj = null } = {}) {
  const urls = []
  const escritas = []
  let est = JSON.parse(JSON.stringify(estado))
  const pagina = (url) => {
    const u = new URL(url)
    const n = Number(u.searchParams.get('page'))
    const productos = u.searchParams.get('scope') === 'products'
    // Cada página, dos muestras separadas: la 1 el 1 y el 4 de nov, la 2 el 8 y el 10.
    const dias = n === 1 ? ['2026-11-01', '2026-11-04'] : ['2026-11-08', '2026-11-10']
    const data = Object.fromEntries(dias.map((d, i) => [d, { cm_low: (productos ? 2000 : 600) + n * 10 + i, tcg_player_market: 500 }]))
    return { data, paging: { current: n, total: paginas, per_page: 30 } }
  }
  const b = {
    env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' },
    ahora: AHORA,
    reloj: reloj || (() => 0),
    pausa: async () => {},
    fetchImpl: async (url) => { urls.push(url); return { ok: status === 200, status, text: async () => (status === 200 ? JSON.stringify(pagina(url)) : 'You have exceeded the DAILY quota for Requests on your current plan') } },
    restImpl: async (ruta, o = null) => {
      if (o?.method === 'POST') {
        const filas = JSON.parse(o.body)
        if (sinColumna && filas.some((f) => 'valor_sellado' in f)) throw new Error('Supabase 400: {"code":"PGRST204","message":"Could not find the \'valor_sellado\' column of \'tcg_set_valor\'"}')
        escritas.push(...filas)
        return null
      }
      if (ruta.startsWith('tcg_sets?')) return sets || [{ id: 'dlr', market: 'WEST', tcggo_id: 437, release_date: '2026-11-06' }]
      // Ya teníamos el 4 y el 10 de noviembre (de la pasada de precios).
      if (ruta.startsWith('tcg_set_valor?')) return [{ dia: '2026-11-04' }, { dia: '2026-11-10' }]
      throw new Error(`ruta inesperada ${ruta}`)
    },
    estadoImpl: async () => est,
    guardarEstadoImpl: async (v) => { est = JSON.parse(JSON.stringify(v)) },
  }
  return { b, urls, escritas, estado: () => est }
}
{
  const m = montar()
  const r = await H.procesar(m.b)
  const cartas = m.escritas.filter((f) => 'valor_cm' in f)
  const sellado = m.escritas.filter((f) => 'valor_sellado' in f)
  check('las cartas: el año entero, página a página', r.ok && m.urls.filter((u) => !/scope=products/.test(u)).length === 2 && /date_from=2025-11-15/.test(m.urls[0]) && /sort=asc/.test(m.urls[0]), JSON.stringify(m.urls))
  check('  …día por día (1 al 10), SIN los días que ya teníamos (4 y 10)', cartas.length === 8 && !cartas.some((f) => ['2026-11-04', '2026-11-10'].includes(f.dia)) && cartas.every((f) => f.origen === 'tcggo-historico' && f.set_id === 'dlr' && f.market === 'WEST'), JSON.stringify(cartas.map((f) => f.dia)))
  check('  …con el último valor en los huecos (el 2 y el 3 valen lo del 1)', cartas.find((f) => f.dia === '2026-11-02')?.valor_cm === 610 && cartas.find((f) => f.dia === '2026-11-03')?.valor_cm === 610, JSON.stringify(cartas.slice(0, 3)))
  check('el sellado aparte, solo con su columna (no toca lo de las cartas)', sellado.length === 10 && sellado.every((f) => Object.keys(f).sort().join(',') === 'dia,market,set_id,valor_sellado') && sellado[0].valor_sellado === 2010, JSON.stringify(sellado.slice(0, 2)))
  check('el estado apunta las dos y cuenta lo pagado', m.estado().cartas['WEST:437'] === '2026-11-15' && m.estado().sellado['WEST:437']?.pedido === '2026-11-15' && m.estado().sellado['WEST:437']?.hasta === '2026-11-10' && m.estado().peticiones === 4 && m.estado().hecho === true, JSON.stringify(m.estado()))
}
{
  const m = montar({ estado: { dia: '2026-11-15', peticiones: 0, cartas: { 'WEST:437': '2026-10-01' }, sellado: { 'WEST:437': { pedido: '2026-11-07', hasta: '2026-11-07' } } } })
  await H.procesar(m.b)
  check('el sellado se repasa a la semana, desde un día antes de lo último guardado', m.urls.length === 2 && m.urls.every((u) => /scope=products/.test(u) && /date_from=2026-11-06/.test(u)), JSON.stringify(m.urls))
  const n = montar({ estado: { dia: '2026-11-15', peticiones: 0, cartas: { 'WEST:437': '2026-10-01' }, sellado: { 'WEST:437': { pedido: '2026-11-12', hasta: '2026-11-12' } } } })
  await H.procesar(n.b)
  check('  …y con menos de una semana, nada que pedir', n.urls.length === 0)
}
{
  // Se acaba el tiempo tras la primera página: nada escrito, y se sigue por la 2.
  // El reloj avanza 25 s por cada petición a TCGGO: tras la primera página no
  // queda tiempo para la segunda.
  let pedidas = null
  const m = montar({ reloj: () => (pedidas ? pedidas.length * 25_000 : 0) })
  pedidas = m.urls
  await H.procesar(m.b)
  check('a medias no se escribe nada', m.escritas.length === 0 && m.urls.length === 1, JSON.stringify({ urls: m.urls, esc: m.escritas.length }))
  check('  …y se guarda dónde iba', m.estado().enCurso?.pagina === 2 && m.estado().enCurso?.puntos?.length === 2, JSON.stringify(m.estado().enCurso))
  const sigue = montar({ estado: m.estado() })
  await H.procesar(sigue.b)
  check('la pasada siguiente sigue por la página 2 (no vuelve a pagar la 1)', /page=2/.test(sigue.urls[0]) && sigue.escritas.filter((f) => 'valor_cm' in f).length === 8 && !sigue.estado().enCurso, JSON.stringify(sigue.urls))
}
{
  const m = montar({ estado: { dia: '2026-11-15', peticiones: 1000 } })
  const r = await H.procesar(m.b)
  check('con el tope diario gastado no se pide nada', m.urls.length === 0 && r.gastadas === 0)
  const p = montar({ status: 429 })
  const r2 = await H.procesar(p.b)
  check('un «el plan no da» para hasta mañana (y /admin lo ve en rojo)', /plan/.test(r2.parado || '') && p.estado().planBloqueado?.dia === '2026-11-15' && p.escritas.length === 0, JSON.stringify(r2))
  const p2 = montar({ estado: p.estado() })
  await H.procesar(p2.b)
  check('  …y la pasada siguiente de hoy no pide nada', p2.urls.length === 0)
}
{
  const m = montar({ sinColumna: true })
  const r = await H.procesar(m.b)
  check('sin la migración, las cartas entran y el sellado se salta diciéndolo', r.ok && m.escritas.filter((f) => 'valor_cm' in f).length === 8 && m.estado().sinSellado === '2026-11-15' && /1365/.test(m.estado().ultimoError?.error || ''), JSON.stringify(m.estado()).slice(0, 300))
}
check('/admin la lee (semáforo)', /\['tcggo_valor_historico', /.test(readFileSync(`${RAIZ}/admin/js/semaforo.js`, 'utf8')) && H.CLAVE_ESTADO === 'tcggo_valor_historico')
check('cada 20 minutos, no cada minuto', H.config?.schedule === '11-59/20 * * * *' && H.TOPE_DIARIO === 1000 && H.POR_PASADA === 30)

console.log('\n── 3. La gráfica, lo puro ──')
{
  const V = await import(`${RAIZ}/js/valor-set.js`)
  const hoy = new Date('2026-11-15T12:00:00Z')
  const filas = Array.from({ length: 200 }, (_, k) => ({ dia: new Date(hoy.getTime() - (199 - k) * 86_400_000).toISOString().slice(0, 10), valor_cm: 500 + k, valor_sellado: k > 150 ? 2000 + k : null }))
  check('los rangos que tienen datos (con 200 días, los cuatro: 1A enseña 18 días más que 6M)', JSON.stringify(V.rangosConDatos(filas, hoy).map((r) => r.texto)) === '["1M","3M","6M","1A"]', JSON.stringify(V.rangosConDatos(filas, hoy).map((r) => r.texto)))
  const html = V.graficaValorSetHtml(filas, { rango: '3m', hoy })
  check('las dos líneas, cada una con lo suyo', /class="vs-cartas"/.test(html) && /class="vs-sellado"/.test(html) && /Sus cartas/.test(html) && /Su sellado/.test(html))
  check('  …y sin texto dentro del SVG (la 653)', !/<text/.test(html))
  check('sin dos días de nada, nada', V.graficaValorSetHtml([{ dia: '2026-11-15', valor_cm: 3 }], { hoy }) === '')
  const t = V.filasDelRango(filas, '1m', hoy)
  check('la fila de una posición: el principio, el final', V.filaEn(t, 0).dia === t[0].dia && V.filaEn(t, 1).dia === t[t.length - 1].dia)
}

console.log('\n── 4. La página de la expansión ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => { if (!/ViewTransition|Transition was skipped/.test(String(e))) errores.push(String(e).slice(0, 180)) })
  const hoy = new Date()
  const filas = Array.from({ length: 120 }, (_, k) => ({ set_id: 'me05', market: 'WEST', dia: new Date(hoy.getTime() - (119 - k) * 86_400_000).toISOString().slice(0, 10), valor_cm: Math.round(500 + 60 * Math.sin(k / 9) + k), valor_sellado: k > 60 ? 2600 + k * 2 : null }))
  await page.addInitScript((f) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'me05', name: 'Pitch Black', name_en: 'Pitch Black', serie_id: 'me', serie_name_en: 'Mega Evolution', market: 'WEST', release_date: '2026-07-17', card_count_official: 120, card_count_total: 120, tcg_online_code: 'PBL', tcggo_id: 415 }]
    window.__FAKE_CARTAS__ = [{ id: 'me05-1', market: 'WEST', set_id: 'me05', local_id: '1', name: 'Tropius', name_es: 'Tropius', image_path: 'x/1', category: 'Pokemon' }]
    window.__FAKE_SET_VALOR__ = f
  }, filas)
  await page.route(/assets\.tcgdex\.net|images\.tcggo\.com|api\.tcgdex\.net/, (r) => r.abort())
  await page.goto(`${BASE}/coleccion/pbl`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const cifras = limpio(await page.locator('.coleccion-cifras').innerText())
  check('la cifra del sellado, la del último día que lo tiene', /Valor del sellado 2\.838 €/i.test(cifras), cifras)
  const grafica = page.locator('.coleccion-valor')
  check('la gráfica, con sus dos líneas', (await grafica.count()) === 1 && (await grafica.locator('.vs-cartas').count()) === 1 && (await grafica.locator('.vs-sellado').count()) === 1)
  check('  …y con 120 días, rangos 1M, 3M y 6M (1A no añade nada)', limpio((await grafica.locator('.vs-rango').allInnerTexts()).join(' ')) === '1M 3M 6M', (await grafica.locator('.vs-rango').allInnerTexts()).join(' '))
  await grafica.locator('[data-rango="1m"]').click()
  check('el chip 1M se pone', (await grafica.locator('[data-rango="1m"]').getAttribute('aria-pressed')) === 'true')
  const lienzo = grafica.locator('.vs-lienzo')
  const caja = await lienzo.boundingBox()
  await page.mouse.move(caja.x + caja.width - 2, caja.y + caja.height / 2)
  await page.waitForTimeout(150)
  const marca = limpio(await grafica.locator('.vs-marca').innerText())
  check('pasar el ratón lee ese día: fecha, cartas y sellado', /Cartas \d/.test(marca) && /Sellado 2\.8\d\d €/.test(marca), marca)
  await page.screenshot({ path: `${S}/cap1365/expansion-pc.png` }).catch(() => {})
  check('sin errores en la página', errores.length === 0, errores.join(' | '))
  await browser.close()
}

console.log('\n── 5. La migración, contra PostgreSQL ──')
{
  const PG = { ...process.env, PGUSER: 'postgres', PGHOST: '/var/tmp', PGPORT: '5433' }
  const DB = 'p1365'
  const psql = (sql) => execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-d', DB, '-c', sql], { env: PG, encoding: 'utf8' }).trim()
  execFileSync('psql', ['-X', '-q', '-d', 'postgres', '-c', `drop database if exists ${DB}`, '-c', `create database ${DB}`], { env: PG, encoding: 'utf8' })
  const esquema = readFileSync(`${RAIZ}/supabase-esquema-actual.sql`, 'utf8')
  const i = esquema.indexOf('CREATE TABLE public.tcg_set_valor (')
  psql(esquema.slice(i, esquema.indexOf('\n);', i) + 3) + '; alter table public.tcg_set_valor add primary key (set_id, market, dia);')
  const f = `${S}/m1365.sql`
  writeFileSync(f, readFileSync(`${RAIZ}/supabase-migration-1365-valor-de-expansiones.sql`, 'utf8'))
  const correr = () => execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', DB, '-f', f], { env: PG, encoding: 'utf8' })
  let bien = true
  try { correr(); correr() } catch (e) { bien = false; console.log(String(e.stderr || e.message).slice(0, 300)) }
  check('la migración entra, dos veces', bien)
  // Lo que hace la pasada: primero el sellado (fila nueva), luego las cartas encima, sin tocar el sellado.
  psql(`insert into public.tcg_set_valor (set_id, market, dia, valor_sellado) values ('dlr','WEST','2026-11-01', 2010) on conflict (set_id, market, dia) do update set valor_sellado = excluded.valor_sellado`)
  psql(`insert into public.tcg_set_valor (set_id, market, dia, valor_cm, valor_tp, origen) values ('dlr','WEST','2026-11-01', 610, 500, 'tcggo-historico') on conflict (set_id, market, dia) do update set valor_cm = excluded.valor_cm, valor_tp = excluded.valor_tp, origen = excluded.origen`)
  check('una fila con las dos cosas, sin pisarse', /^610(\.00)?\|2010\.00\|tcggo-historico$/.test(psql("select valor_cm||'|'||valor_sellado||'|'||origen from public.tcg_set_valor where set_id='dlr'")), psql("select * from public.tcg_set_valor"))
  check('una fila sin decir su origen es de TCGGO (el de serie)', psql("insert into public.tcg_set_valor (set_id, market, dia, valor_sellado) values ('x','WEST','2026-11-02', 1) returning origen") === 'tcggo')
  execFileSync('psql', ['-X', '-q', '-d', 'postgres', '-c', `drop database if exists ${DB}`], { env: PG })
}

console.log(fails ? `\n${fails} FALLAN` : '\nTodo bien')
process.exit(fails ? 1 : 0)
