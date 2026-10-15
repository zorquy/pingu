// Tanda 807 — las VERSIONES de cada carta, desde TCGGO.
//
// PINGU, con el Snorlax de Plasma Storm: TCGGO enseña «Standard 24,95 €» y
// «Reverse Holo 90,24 €»; la API da la Reverse como otra carta (43552) que
// no sale en el listado del set. Los datos de esta prueba son LAS FICHAS QUE
// PEGÓ PINGU, tal cual (fixtures-807/): la 12774 (normal), la 43552 (la
// Reverse), la 43551 y la 43553 (las de al lado: Dodrio 100 y Togepi 102,
// también versiones) y la primera página del listado de Plasma Storm.
//   1. Lo puro: qué es cada carta para nosotros y la fila que se guarda.
//   2. El listado del set no trae versiones (por eso hay que ir por id).
//   3. La pasada: sonda, recorrido, lo que ya conocemos no se pide, frenos.
//   4. La migración, contra PostgreSQL: la tabla, la lectura y que la fila
//      que arma la función cabe entera.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const lib = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
const fn = await import(`${RAIZ}/netlify/functions/tcggo-versiones.mjs`)
const fixture = (n) => JSON.parse(readFileSync(join(AQUI, 'fixtures-807', n), 'utf8'))
const F = { 12774: fixture('carta-12774.json'), 43551: fixture('carta-43551.json'), 43552: fixture('carta-43552.json'), 43553: fixture('carta-43553.json') }
const LISTADO = fixture('episodio-93-pagina-1.json')
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }

// Nuestras tres cartas de Plasma Storm, como están en producción: la normal
// con su id de TCGGO en la fila de precio y el producto de Cardmarket.
const NUESTRAS = () => ({
  cartas: [
    { id: 'bw8-100', market: 'WEST', set_id: 'bw8', local_id: '100', tcggo_id: null, cm_id_product_propio: 280840 },
    { id: 'bw8-101', market: 'WEST', set_id: 'bw8', local_id: '101', tcggo_id: null, cm_id_product_propio: 280841 },
    { id: 'bw8-102', market: 'WEST', set_id: 'bw8', local_id: '102', tcggo_id: null, cm_id_product_propio: 280842 },
    // Una carta creada por el catálogo con su id de TCGGO: no se pide.
    { id: 'tcggo-43555', market: 'WEST', set_id: 'otro', local_id: '5', tcggo_id: 43555, cm_id_product_propio: 999 },
    // Una japonesa: su fila de precio lleva un id de OTRO catálogo.
    { id: 'SV1a-001', market: 'JP', set_id: 'SV1a', local_id: '001', tcggo_id: null, cm_id_product_propio: null },
  ],
  precios: [
    { card_id: 'bw8-100', tcggo_id: 12773, cm_id_product: 280840 },
    { card_id: 'bw8-101', tcggo_id: 12774, cm_id_product: 280841 },
    { card_id: 'bw8-102', tcggo_id: 12775, cm_id_product: 280842 },
    { card_id: 'SV1a-001', tcggo_id: 43556, cm_id_product: null },
  ],
  sets: [{ id: 'bw8', market: 'WEST', tcggo_id: 93 }],
  versiones: [],
})

console.log('── 1. Lo puro ──')
{
  const c = (id) => lib.cartaDeRespuesta(F[id])
  check('«Get card» se lee del envoltorio `data`', c(43552)?.id === 43552 && lib.cartaDeRespuesta({ data: null }) === null && lib.cartaDeRespuesta({ message: 'Not found' }) === null)
  check('la ruta es /cards/{id}', lib.urlCarta(43552) === 'https://cardmarket-api-tcg.p.rapidapi.com/pokemon/cards/43552')
  const nuestras = [
    { id: 'bw8-101', set_id: 'bw8', local_id: '101', producto: 280841, principal: 12774 },
    { id: 'bw8-100', set_id: 'bw8', local_id: '100', producto: 280840, principal: null },
  ]
  const v = lib.decidirVersion(c(43552), nuestras)
  check('la 43552 es una VERSIÓN del bw8-101', v.tipo === 'version' && v.carta.id === 'bw8-101', JSON.stringify(v))
  check('la 12774 es la carta misma', lib.decidirVersion(c(12774), nuestras).tipo === 'principal')
  check('la 43551 casa con el bw8-100, que no sabe su id de TCGGO: no se adivina', lib.decidirVersion(c(43551), nuestras).tipo === 'sinPrincipal')
  check('sin carta nuestra con ese número', lib.decidirVersion(c(43553), nuestras).tipo === 'sinCarta')
  check('mismo número, otro producto: es otra carta (un sello)', lib.decidirVersion(c(43552), [{ id: 'bw8-101', local_id: '101', producto: 111, principal: 12774 }]).tipo === 'otraCarta')
  check('el número se exige aunque case el producto', lib.decidirVersion(c(43552), [{ id: 'bw8-99', local_id: '99', producto: 280841, principal: 12774 }]).tipo === 'sinCarta')
  check('dos nuestras con el mismo número y producto: dudosa', lib.decidirVersion(c(43552), [{ id: 'a', local_id: '101', producto: 280841, principal: 1 }, { id: 'b', local_id: '101', producto: 280841, principal: 2 }]).tipo === 'dudosa')
  check('un producto sellado no es carta', lib.decidirVersion({ ...c(43552), type: 'sealed' }, nuestras).tipo === 'ajena')
  check('una japonesa tampoco (por ahora)', lib.decidirVersion({ ...c(43552), lang: 'ja' }, nuestras).tipo === 'ajena')

  const fila = lib.filaDeVersion(c(43552), { id: 'bw8-101', set_id: 'bw8' }, { ahora: new Date('2026-10-13T10:00:00Z') })
  check('la fila lleva el precio de la Reverse (90,24), no el de la normal', fila.cm_low === 90.24 && fila.cm_low_de === 45 && fila.cm_low_fr === 30 && fila.cm_low_it === 20 && fila.cm_low_es === null, JSON.stringify(fila))
  check('  …las medias, las disponibles y TCGplayer en euros', fila.cm_avg30 === 24.12 && fila.cm_avg7 === 21.79 && fila.cm_disponibles === 22 && fila.tp_market_eur === 25.57)
  check('  …el enlace de TCGGO a Cardmarket, que lleva el filtro de la versión', fila.link_cm === 'https://www.tcggo.com/external/cm/43552')
  check('  …y su carta, su número y su producto', fila.card_id === 'bw8-101' && fila.set_id === 'bw8' && fila.numero === '101' && fila.cm_id_product === 280841 && fila.tcggo_id === 43552 && fila.market === 'WEST')
  check('un enlace que no es de TCGGO no se guarda', lib.filaDeVersion({ ...c(43552), links: { cardmarket: 'javascript:alert(1)' } }, { id: 'x' }).link_cm === null)
}

console.log('\n── 2. El listado del set no trae las versiones ──')
{
  const ids = LISTADO.data.map((x) => x.id)
  check('la página 1 de Plasma Storm: 20 cartas, 138 en total (= cards_total)', LISTADO.data.length === 20 && LISTADO.results === 138, `${LISTADO.data.length} / ${LISTADO.results}`)
  check('  …ninguna es de las versiones (43551–43553)', !ids.some((id) => id >= 43551 && id <= 43553))
  check('  …y separarVersiones no encuentra ninguna (una carta por número)', lib.separarVersiones(LISTADO.data).versiones.length === 0)
}

// ── Un doble de la base que entiende los filtros que pide la función ──
const montar = (datos) => {
  const db = { cartas: [], precios: [], sets: [], versiones: [], ...datos }
  const tablas = { tcg_cards: 'cartas', tcg_card_prices: 'precios', tcg_sets: 'sets', tcg_card_versions: 'versiones' }
  const llamadas = []
  const guardadas = []
  const borradas = []
  let romper = null
  const filtrar = (filas, params) => {
    let out = filas
    for (const [k, v] of params) {
      if (['select', 'limit', 'order'].includes(k)) continue
      const [op, ...resto] = v.split('.')
      const val = resto.join('.')
      const de = (f) => (k === 'market' ? f.market || 'WEST' : f[k])
      if (op === 'eq') out = out.filter((f) => String(de(f)) === val)
      else if (op === 'gte') out = out.filter((f) => de(f) != null && Number(de(f)) >= Number(val))
      else if (op === 'lte') out = out.filter((f) => de(f) != null && Number(de(f)) <= Number(val))
      else if (op === 'lt') out = out.filter((f) => de(f) != null && String(de(f)) < val)
      else if (op === 'in') { const l = val.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/"/g, '')); out = out.filter((f) => l.includes(String(de(f)))) }
      else throw new Error(`el doble no sabe ${k}=${v}`)
    }
    return out
  }
  return {
    db, llamadas, guardadas, borradas,
    romperCon: (re) => { romper = re },
    restImpl: async (ruta) => {
      const r = decodeURIComponent(ruta)
      llamadas.push(r)
      if (romper && romper.test(r)) throw new Error('Supabase 500: se ha caído')
      const [tabla, qs] = r.split('?')
      const params = []
      for (const par of (qs || '').split('&')) { const i = par.indexOf('='); if (i > 0) params.push([par.slice(0, i), par.slice(i + 1)]) }
      if (!tablas[tabla]) throw new Error(`el doble no sabe ${tabla}`)
      let filas = filtrar(db[tablas[tabla]], params)
      if (params.some(([k, v]) => k === 'order' && v === 'actualizado_at.asc')) filas = [...filas].sort((a, b) => String(a.actualizado_at).localeCompare(String(b.actualizado_at)))
      const lim = params.find(([k]) => k === 'limit')
      return lim ? filas.slice(0, Number(lim[1])) : filas
    },
    guardarImpl: async (filas) => {
      if (romper && romper.test('guardar')) throw new Error('Supabase 404: relation "public.tcg_card_versions" does not exist (42P01)')
      guardadas.push(...filas)
      for (const f of filas) { db.versiones = db.versiones.filter((v) => v.tcggo_id !== f.tcggo_id).concat([f]) }
    },
    borrarImpl: async (id) => { borradas.push(id); db.versiones = db.versiones.filter((v) => v.tcggo_id !== id) },
  }
}
// TCGGO de mentira: las fichas de PINGU por id, 404 lo demás.
const tcggo = ({ estado = null } = {}) => {
  const pedidas = []
  return {
    pedidas,
    fetchImpl: async (url) => {
      const id = Number(String(url).split('/').pop())
      pedidas.push(id)
      if (estado) return { ok: false, status: estado, text: async () => 'You have exceeded the DAILY quota' }
      if (F[id]) return { ok: true, status: 200, text: async () => JSON.stringify(F[id]) }
      return { ok: false, status: 404, text: async () => '{"message":"Not found"}' }
    },
  }
}
const pasada = async (b, t, estadoIni, extra = {}) => {
  let estado = estadoIni
  const r = await fn.procesar({
    env: ENV, fetchImpl: t.fetchImpl, restImpl: b.restImpl, guardarImpl: b.guardarImpl, borrarImpl: b.borrarImpl,
    estadoImpl: async () => estado, guardarEstadoImpl: async (v) => { estado = JSON.parse(JSON.stringify(v)) },
    pausa: async () => {}, ahora: new Date('2026-10-13T10:00:00Z'), ...extra,
  })
  return { r, estado: () => estado }
}

console.log('\n── 3. La pasada ──')
{
  const b = montar(NUESTRAS())
  const t = tcggo()
  const { r, estado } = await pasada(b, t, {})
  check('la primera petición es la sonda (43552) y la ruta queda comprobada', t.pedidas[0] === 43552 && estado().sonda?.ruta?.endsWith('/cards/{id}'), JSON.stringify(t.pedidas))
  check('8 peticiones como mucho por pasada, sonda incluida', t.pedidas.length === 8 && r.pedidas === 8, JSON.stringify(r))
  check('sube desde el 43551', t.pedidas.slice(1, 4).join() === '43551,43552,43553')
  const g = Object.fromEntries(b.guardadas.map((f) => [f.tcggo_id, f]))
  check('la Reverse del Snorlax se guarda colgada del bw8-101, con su precio', g[43552]?.card_id === 'bw8-101' && g[43552]?.cm_low === 90.24, JSON.stringify(b.guardadas.map((f) => [f.tcggo_id, f.card_id])))
  check('  …y las de al lado colgadas de las suyas (Dodrio 100, Togepi 102)', g[43551]?.card_id === 'bw8-100' && g[43553]?.card_id === 'bw8-102')
  check('lo que ya es carta nuestra (43555) no se pide', !t.pedidas.includes(43555))
  check('  …pero una fila de precio JAPONESA con ese id no lo tapa (43556 sí se pide)', t.pedidas.includes(43556))
  check('lo que no se llegó a pedir queda para la próxima', estado().reintentar.length === 1, JSON.stringify(estado().reintentar))
  check('las cuentas cuadran', estado().cuentas.versiones === 3 && estado().cuentas.pedidas === 8 && estado().gasto.peticiones === 8, JSON.stringify(estado().cuentas))

  const sig = await pasada(b, t, estado())
  check('la segunda pasada no repite la sonda y empieza por lo aplazado', t.pedidas[8] === estado().reintentar[0] || t.pedidas[8] === 43560, JSON.stringify(t.pedidas.slice(8)))
  check('  …ni vuelve a pedir versiones ya guardadas', !t.pedidas.slice(8).some((id) => id >= 43551 && id <= 43553))
  check('  …y el hueco de arriba se va contando', sig.estado().subiendo.vaciosSeguidos > 0)

  // El freno de arriba: 2.000 vacíos seguidos.
  const casi = await pasada(montar(NUESTRAS()), tcggo(), { ...sig.estado(), subiendo: { siguiente: 50000, vaciosSeguidos: fn.VACIOS_PARA_PARAR - 3, acabado: false }, reintentar: [] })
  check('a los 2.000 ids seguidos sin carta, el recorrido de arriba se acaba', casi.estado().subiendo.acabado === true, JSON.stringify(casi.estado().subiendo))
  const abajo = await pasada(montar(NUESTRAS()), tcggo(), casi.estado())
  check('  …y la pasada siguiente baja desde el 43550', abajo.r.modo === 'bajando' && abajo.estado().bajando.siguiente < 43550, JSON.stringify(abajo.r))
  const fin = await pasada(montar(NUESTRAS()), tcggo(), { ...abajo.estado(), bajando: { ...abajo.estado().bajando, sinVersionSeguidos: fn.SIN_VERSION_PARA_PARAR - 2 } })
  check('abajo se para a los 3.000 pedidos seguidos sin una versión', fin.estado().bajando.acabado === true, JSON.stringify(fin.estado().bajando))
}

console.log('\n── 3b. Los frenos ──')
{
  // La ruta mal: la sonda no contesta y no se gasta nada más.
  const t = tcggo()
  const sinRuta = { ...t, fetchImpl: async (u) => { t.pedidas.push(u); return { ok: false, status: 404, text: async () => '' } } }
  const r1 = await pasada(montar(NUESTRAS()), sinRuta, {})
  check('si la sonda no contesta, para el día con UNA petición', t.pedidas.length === 1 && r1.estado().parado?.dia === '2026-10-13', JSON.stringify(r1.r))
  const r1b = await pasada(montar(NUESTRAS()), sinRuta, r1.estado())
  check('  …y la pasada siguiente no pide nada', t.pedidas.length === 1 && /parado/.test(r1b.r.saltado || ''))

  // El plan.
  const tp = tcggo({ estado: 429 })
  const r2 = await pasada(montar(NUESTRAS()), tp, { sonda: { fecha: 'x' } })
  check('un 429 para la pasada a la primera', tp.pedidas.length === 1 && r2.estado().planBloqueado?.dia === '2026-10-13', JSON.stringify(r2.r))
  check('  …lo que no se pidió no se pierde', r2.estado().reintentar.length === 8, JSON.stringify(r2.estado().reintentar))
  const r2b = await pasada(montar(NUESTRAS()), tp, r2.estado())
  check('  …y hasta mañana no se pide nada', tp.pedidas.length === 1 && /plan/.test(r2b.r.saltado || ''))

  // El tope diario.
  const tt = tcggo()
  await pasada(montar(NUESTRAS()), tt, {}, { env: { ...ENV, TCGGO_TOPE_VERSIONES: '3' } })
  check('el tope diario manda (3)', tt.pedidas.length === 3, JSON.stringify(tt.pedidas))

  // Nuestra base: se corta, se aplaza, y a la tercera se para.
  const b = montar(NUESTRAS())
  b.romperCon(/cm_id_product_propio=in/)
  const t3 = tcggo()
  let e = { sonda: { fecha: 'x' } }
  let ult
  for (let i = 0; i < 3; i++) { ult = await pasada(b, t3, e); e = ult.estado() }
  check('si falla nuestra base al cotejar, la pasada no sigue y lo pedido se aplaza', e.reintentar.includes(43552), JSON.stringify(e.reintentar))
  check('  …y a la tercera seguida, parada hasta mañana', /3 veces/.test(e.parado?.motivo || ''), JSON.stringify(e.parado))
  const pedidasAntes = t3.pedidas.length
  await pasada(b, t3, e)
  check('  …sin pedir nada más a TCGGO', t3.pedidas.length === pedidasAntes)

  // Sin la migración: para y lo dice.
  const bm = montar(NUESTRAS())
  bm.romperCon(/^guardar$/)
  const rm = await pasada(bm, tcggo(), { sonda: { fecha: 'x' } })
  check('sin la tabla, para y dice qué migración falta', /supabase-migration-versiones\.sql/.test(rm.estado().parado?.motivo || ''), JSON.stringify(rm.estado().parado))
}

console.log('\n── 3c. Con todo recorrido: el refresco ──')
{
  const datos = NUESTRAS()
  datos.versiones = [
    { tcggo_id: 43552, card_id: 'bw8-101', set_id: 'bw8', cm_low: 50, actualizado_at: '2026-09-01T00:00:00Z' },
    { tcggo_id: 49999, card_id: 'bw8-1', set_id: 'bw8', cm_low: 1, actualizado_at: '2026-09-02T00:00:00Z' },
    { tcggo_id: 43551, card_id: 'bw8-100', set_id: 'bw8', cm_low: 1, actualizado_at: '2026-10-12T00:00:00Z' },
  ]
  const b = montar(datos)
  const t = tcggo()
  // `repaso861` hecho: si no, la pasada vuelve a subir desde el 43551 (el repaso de la 861, probado en test-tanda-861).
  const hecho = { sonda: { fecha: 'x' }, repaso861: 'hecho', subiendo: { acabado: true, acabadoAt: '2026-10-12T00:00:00Z' }, bajando: { acabado: true, acabadoAt: '2026-10-12T00:00:00Z' } }
  const { r } = await pasada(b, t, hecho)
  check('pide solo las de más de una semana, la más vieja primero', r.modo === 'refresco' && t.pedidas.join() === '43552,49999', JSON.stringify(t.pedidas))
  check('  …renueva el precio sin volver a decidir la carta', b.db.versiones.find((v) => v.tcggo_id === 43552)?.cm_low === 90.24 && b.db.versiones.find((v) => v.tcggo_id === 43552)?.card_id === 'bw8-101')
  check('  …y quita (contándola) la que ya no existe', b.borradas.join() === '49999')
  const semana = await pasada(montar(NUESTRAS()), tcggo(), { ...hecho, maxVisto: 43700, subiendo: { acabado: true, acabadoAt: '2026-10-05T00:00:00Z' } })
  check('a la semana, vuelve a mirar por arriba desde lo último visto', semana.r.modo === 'subiendo' && semana.estado().subiendo.reabierto && semana.estado().subiendo.siguiente > 43700, JSON.stringify(semana.estado().subiendo))
}

console.log('\n── 3d. Lo que cuesta ──')
{
  const [min] = fn.config.schedule.split(' ')
  check('va en los minutos pares (el calco japonés, en los impares)', min === '0-58/2')
  const alDia = fn.POR_PASADA * 30 * 24
  check(`8 por pasada × 720 pasadas = ${alDia}, y el tope (${fn.TOPE_DIARIO}) lo deja por debajo del plan (15.000)`, fn.POR_PASADA <= 8 && fn.TOPE_DIARIO <= 5000)
  const admin = readFileSync(`${RAIZ}/admin/js/admin.js`, 'utf8')
  // Desde la 817 las claves que lee /admin son las del semáforo (PASADAS).
  const semaforo = readFileSync(`${RAIZ}/admin/js/semaforo.js`, 'utf8')
  check('/admin lee y enseña su estado', /'tcggo_versiones'/.test(semaforo) && /PASADAS\.map/.test(admin) && /VERSIONES \(tcggo_versiones, 807\)/.test(admin))
}

console.log('\n── 3e. Parada por la migración: se quita sola en cuanto hay tabla ──')
{
  const b = montar(NUESTRAS())
  const t = tcggo()
  const { r, estado } = await pasada(b, t, { sonda: { fecha: 'x' }, parado: { dia: '2026-10-13', motivo: 'falta ejecutar supabase-migration-versiones.sql' } })
  check('la tabla ya contesta: sigue el mismo día, sin esperar a mañana', r.modo === 'subiendo' && !estado().parado && t.pedidas.length > 0, JSON.stringify(r))
  const b2 = montar(NUESTRAS())
  b2.romperCon(/^tcg_card_versions\?select=tcggo_id&limit=1$/)
  const t2 = tcggo()
  const r2 = await pasada(b2, t2, { sonda: { fecha: 'x' }, parado: { dia: '2026-10-13', motivo: 'falta ejecutar supabase-migration-versiones.sql' } })
  check('  …y si sigue faltando, no pide nada', t2.pedidas.length === 0 && /parado/.test(r2.r.saltado || ''), JSON.stringify(r2.r))
  const r3 = await pasada(montar(NUESTRAS()), tcggo(), { sonda: { fecha: 'x' }, parado: { dia: '2026-10-13', motivo: 'nuestra base ha fallado 3 veces seguidas' } })
  check('  …una parada por otra cosa no se quita sola', /parado/.test(r3.r.saltado || ''))
}

console.log('\n── 5. El catálogo: dos filas con el mismo id en un lote (Neo Discovery) ──')
{
  const cat = await import(`${RAIZ}/netlify/functions/tcggo-catalogo.mjs`)
  const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)
  // Nuestra «tcggo-101» la creó el catálogo con su id de TCGGO. Otra suya
  // (la 999) comparte producto de Cardmarket y llega PRIMERO en la página.
  const montarCat = (estadoCat = {}) => {
    const estados = { [CLAVE_PARES]: { episodios: { fecha: '2026-10-13T00:00:00Z', lista: [] }, hechos: {} }, [cat.CLAVE_ESTADO]: estadoCat }
    const lotes = []
    const fetchImpl = async (url) => {
      const u = new URL(url)
      const page = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify({ data, paging: { current: 1, total: 1, per_page: 100 } }) })
      if (u.pathname.endsWith('/episodes')) return page(/pokemon-jp/.test(u.pathname) ? [{ id: 1, name: 'Neo Discovery', code: 'N2_', cards_total: 2, released_at: '2001-06-01' }] : [])
      return page([
        { id: 999, name: 'Unown', card_number: '15', cardmarket_id: 5000, type: 'singles' },
        { id: 101, name: 'Unown', card_number: '14', cardmarket_id: 5000, type: 'singles', image: 'https://images.tcggo.com/101.png' },
      ])
    }
    const restImpl = async (ruta) => {
      if (ruta.startsWith('tcg_sets?')) return [{ id: 'neo2_ja', name: 'Neo Discovery', name_en: 'Neo Discovery', tcg_online_code: 'N2_', tcggo_id: 1 }]
      if (/set_id=in\./.test(ruta)) return [{ id: 'tcggo-101', set_id: 'neo2_ja', local_id: '14', name: 'Unown', tcggo_id: 101, cm_id_product_propio: 5000 }]
      return []
    }
    return {
      estados, lotes,
      b: {
        env: { ...ENV, TCGGO_TOPE_DIARIO: '1000' }, fetchImpl, restImpl, pausa: async () => {}, ahora: new Date('2026-10-13T10:00:00Z'),
        guardarCartasImpl: async (filas) => {
          const ids = filas.map((f) => f.id)
          if (new Set(ids).size !== ids.length) throw new Error('Supabase 500: {"code":"21000","message":"ON CONFLICT DO UPDATE command cannot affect row a second time"}')
          lotes.push(filas); return filas.length
        },
        crearSetsImpl: async (f) => f.length, nombrarSetImpl: async () => {},
        estadoImpl: async (k) => estados[k], guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
      },
    }
  }
  const m = montarCat()
  const r = await cat.procesar(m.b)
  const filas = m.lotes.flat()
  check('el lote se escribe (sin el 21000)', r.ok !== false && filas.length >= 1, JSON.stringify(r).slice(0, 300))
  check('  …nuestra «tcggo-101» se queda con SU carta (la 101), no con la que llega antes', filas.find((f) => f.id === 'tcggo-101')?.tcggo_id === 101, JSON.stringify(filas.map((f) => [f.id, f.tcggo_id])))
  check('  …y no hay dos filas con el mismo id', new Set(filas.map((f) => f.id)).size === filas.length)
  // Lo que ya estaba en `fallidos` (el Neo Discovery de antes) se reabre una vez.
  const m2 = montarCat({ semana: cat.semanaDe ? cat.semanaDe(new Date('2026-10-13T10:00:00Z')) : undefined, hechos: { WEST: [], JP: [1] }, fallidos: { WEST: {}, JP: { 1: { intentos: 3, error: '21000' } } }, hecho: true })
  if (!cat.semanaDe) m2.estados[cat.CLAVE_ESTADO].semana = undefined
  await cat.procesar(m2.b)
  check('la expansión que falló se vuelve a intentar sin esperar a la semana', m2.lotes.length > 0 && m2.estados[cat.CLAVE_ESTADO].reabiertosFallidos === cat.REABRIR_FALLIDOS, JSON.stringify(m2.estados[cat.CLAVE_ESTADO].hechos))
}

console.log('\n── 4. La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
  if (hay.status === 0) {
    psql(['-c', 'drop database if exists prueba_807'])
    psql(['-c', 'create database prueba_807'])
    const mig = join(RAIZ, 'supabase-migration-versiones.sql')
    for (let i = 0; i < 2; i++) {
      const r = psql(['-d', 'prueba_807', '-f', mig])
      check(`la migración carga${i ? ' otra vez (se puede repetir)' : ''}`, r.status === 0, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    }
    // La fila que arma la función, entera, tal cual la mandaría PostgREST.
    const fila = lib.filaDeVersion(lib.cartaDeRespuesta(F[43552]), { id: 'bw8-101', set_id: 'bw8' })
    // Solo las columnas que la fila trae, como un POST de PostgREST: las
    // demás se quedan con su valor por defecto.
    const lista = Object.keys(fila).join(', ')
    const ins = psql(['-d', 'prueba_807', '-c', `insert into public.tcg_card_versions (${lista}) select ${lista} from jsonb_populate_record(null::public.tcg_card_versions, '${JSON.stringify(fila).replace(/'/g, "''")}'::jsonb)`])
    check('la fila que arma la función cabe en la tabla', ins.status === 0, ins.stderr)
    const cols = psql(['-t', '-A', '-d', 'prueba_807', '-c', "select string_agg(column_name, ',') from information_schema.columns where table_name = 'tcg_card_versions'"]).stdout.trim().split(',')
    const sobran = Object.keys(fila).filter((k) => !cols.includes(k))
    check('  …y no manda ninguna columna que no exista (PostgREST tumbaría el lote)', sobran.length === 0, sobran.join(', '))
    const lee = psql(['-t', '-A', '-d', 'prueba_807', '-c', "set role anon; select cm_low || ' ' || link_cm from public.tcg_card_versions where tcggo_id = 43552"])
    check('sin cuenta se lee (la política de la 510 va en la misma migración)', lee.stdout.trim() === '90.24 https://www.tcggo.com/external/cm/43552', lee.stdout + lee.stderr)
    const escribe = psql(['-d', 'prueba_807', '-c', "set role authenticated; update public.tcg_card_versions set cm_low = 1"])
    const sigue = psql(['-t', '-A', '-d', 'prueba_807', '-c', 'select cm_low from public.tcg_card_versions where tcggo_id = 43552']).stdout.trim()
    check('  …pero desde la web no se escribe', escribe.status !== 0 || sigue === '90.24', escribe.stderr.slice(0, 120))
    psql(['-c', 'drop database if exists prueba_807'])
  }
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
