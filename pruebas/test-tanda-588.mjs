// Tanda 588 — emparejar con Cardmarket por TCGGO: el ayudante puro y la
// función, sin red. Los fixtures son los ejemplos de respuesta de SU
// documentación (api-1_1.json, 2026-10-05): la lista de expansiones y la
// primera página de /cards (Pitch Black, con cardmarket_id). El 895789 de
// Tropius existe en el fichero abierto de Cardmarket como «Tropius [Fruity
// Aroma | Solar Beam]» de la expansión 6569: mismo espacio de ids.
import { readFileSync } from 'node:fs'
import {
  cabeceras, urlEpisodios, urlCartasDeEpisodio, hayMasPaginas, resumirEpisodio, episodioDeSet, emparejarPorNumero, esLimiteDelPlan, HOST,
} from '/home/user/pingu/netlify/lib/tcggo.mjs'
import { procesar, CLAVE_ESTADO, TOPE_DIARIO } from '/home/user/pingu/netlify/functions/tcggo-emparejar.mjs'
import { CLAVE_ESTADO as CLAVE_GUIA } from '/home/user/pingu/netlify/functions/cardmarket-precios.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const DIR = new URL('./fixtures/', import.meta.url)
const CARTAS_PBL = JSON.parse(readFileSync(new URL('tcggo-cards-ejemplo.json', DIR), 'utf8'))
const EPISODIOS = JSON.parse(readFileSync(new URL('tcggo-episodios-ejemplo.json', DIR), 'utf8'))

console.log('── 1. El ayudante puro ──')
{
  check('las cabeceras llevan la clave y el host de RapidAPI', cabeceras('k')['x-rapidapi-key'] === 'k' && cabeceras('k')['x-rapidapi-host'] === HOST)
  check('las URLs: expansiones por página, cartas por expansión de 100 en 100', /episodes\?page=2$/.test(urlEpisodios(2)) && /cards\?episode_id=415&per_page=100&page=3$/.test(urlCartasDeEpisodio(415, 3)))
  check('`paging` dice si hay más (1 de 9 sí, 9 de 9 no, sin paging no)', hayMasPaginas(EPISODIOS) === true && hayMasPaginas({ paging: { current: 9, total: 9 } }) === false && hayMasPaginas({}) === false)
  const eps = EPISODIOS.data.map(resumirEpisodio)
  check('una expansión resumida: id, nombre, código, cartas', eps[2].id === 415 && eps[2].codigo === 'PBL' && eps[2].nombre === 'Pitch Black' && eps[2].cartas === 120, JSON.stringify(eps[2]))

  const porCodigo = episodioDeSet({ id: 'me05', name: 'Negro Absoluto', name_en: 'Pitch Black', tcg_online_code: 'PBL' }, eps)
  check('un set se reconoce por su código de TCG Live', porCodigo.episodio?.id === 415 && porCodigo.por === 'codigo', JSON.stringify(porCodigo))
  check('  …sin distinguir mayúsculas', episodioDeSet({ id: 'x', name: 'x', tcg_online_code: 'pbl' }, eps).episodio?.id === 415)
  const porNombre = episodioDeSet({ id: 'sv08.5', name: 'Evoluciones Prismáticas', name_en: 'Prismatic Evolutions', tcg_online_code: null }, eps)
  check('sin código, por el nombre inglés', porNombre.episodio?.id === 212 && porNombre.por === 'nombre', JSON.stringify(porNombre))
  check('  …y «Scarlet & Violet» casa con «Scarlet and Violet»', episodioDeSet({ id: 'x', name_en: 'Scarlet and Violet', name: 'x' }, [{ id: 1, nombre: 'Scarlet & Violet', codigo: 'SVI' }]).episodio?.id === 1)
  const nada = episodioDeSet({ id: 'base1', name: 'Base Set', name_en: 'Base Set', tcg_online_code: 'BS' }, eps)
  check('un set que no está se queda sin expansión diciendo por qué', nada.episodio === null && /BS/.test(nada.porque) && /Base Set/.test(nada.porque), nada.porque)
  const dos = episodioDeSet({ id: 'swsh12.5gg', name: 'Galería Galar', name_en: 'Crown Zenith Galarian Gallery', tcg_online_code: 'CRZ' }, [{ id: 21, nombre: 'Crown Zenith', codigo: 'CRZ' }, { id: 22, nombre: 'Crown Zenith Galarian Gallery', codigo: 'CRZ' }])
  check('dos expansiones con el mismo código: decide el nombre', dos.episodio?.id === 22 && dos.por === 'codigo+nombre', JSON.stringify(dos))
  const empate = episodioDeSet({ id: 'x', name: 'Otro', name_en: 'Otro', tcg_online_code: 'CRZ' }, [{ id: 21, nombre: 'A', codigo: 'CRZ' }, { id: 22, nombre: 'B', codigo: 'CRZ' }])
  check('  …y si el nombre tampoco decide, no se elige', empate.episodio === null && /2 expansiones/.test(empate.porque))

  // Emparejar por número: nuestras cartas de Pitch Black con las suyas.
  const nuestras = [
    { id: 'me05-1', local_id: '1', cm_id_product_propio: null },
    { id: 'me05-002', local_id: '002', cm_id_product_propio: null }, // ceros a la izquierda
    { id: 'me05-20', local_id: '20', cm_id_product_propio: 895808 },
    { id: 'me05-999', local_id: '999', cm_id_product_propio: null },
  ]
  const r = emparejarPorNumero(nuestras, CARTAS_PBL.data)
  check('la 1 es el Tropius 895789 (el id de Cardmarket, no el suyo)', r.pares.find((p) => p.id === 'me05-1')?.idProduct === 895789, JSON.stringify(r.pares[0]))
  check('  …con su tcgplayer_id y su tcgid al lado', r.pares[0].tcgplayerId === 704758 && r.pares[0].tcgid === 'PBL-1')
  check('«002» casa con su «2»', r.pares.find((p) => p.id === 'me05-002')?.idProduct === 895790)
  check('la 999 no existe allí: sin par y diciéndolo', r.sinPar.length === 1 && r.sinPar[0].id === 'me05-999' && /ninguna carta suya/.test(r.sinPar[0].porque), JSON.stringify(r.sinPar))
  check('sobran las 17 suyas que no tenemos', r.sobran === 17, String(r.sobran))
  const sinId = emparejarPorNumero([{ id: 'a-1', local_id: '1' }], [{ id: 9, card_number: '1', cardmarket_id: null }])
  check('una carta suya sin cardmarket_id deja la nuestra sin par, con ese motivo', sinId.pares.length === 0 && /sin|no le da/.test(sinId.sinPar[0].porque), JSON.stringify(sinId.sinPar))
  const dobles = emparejarPorNumero([{ id: 'a-1', local_id: '1' }], [{ id: 9, card_number: '1', cardmarket_id: 5 }, { id: 10, card_number: '1', cardmarket_id: 6 }])
  check('dos suyas con el mismo número: no se elige', dobles.pares.length === 0 && /2 cartas suyas/.test(dobles.sinPar[0].porque))
  check('429 y 403 con «quota» son el plan; un 500 no', esLimiteDelPlan(429) && esLimiteDelPlan(403, 'You have exceeded the MONTHLY quota') && !esLimiteDelPlan(500, 'boom') && !esLimiteDelPlan(403, 'forbidden'))
}

// ── La función, con un TCGGO de mentira que cuenta peticiones ──
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k' }
const SETS = [
  { id: 'me05', name: 'Negro Absoluto', name_en: 'Pitch Black', tcg_online_code: 'PBL', release_date: '2026-07-17' },
  { id: 'me04', name: 'Caos Creciente', name_en: 'Chaos Rising', tcg_online_code: 'CRI', release_date: '2026-05-22' },
  { id: 'base1', name: 'Base Set', name_en: 'Base Set', tcg_online_code: 'BS', release_date: '1999-01-09' },
  { id: 'A1', name: 'Pocket', release_date: '2024-10-30' },
]
const NUESTRAS = {
  me05: Array.from({ length: 22 }, (_, i) => ({ id: `me05-${i + 1}`, local_id: String(i + 1), cm_id_product_propio: i === 0 ? 895789 : null })),
  me04: [{ id: 'me04-1', local_id: '1', cm_id_product_propio: null }],
}
// Nueve páginas de expansiones (la primera real, las demás vacías de
// relleno), y las cartas: Pitch Black en 1 página; Chaos Rising en 2.
function tcggoDeMentira({ fallaEn = null, codigoFallo = 429, textoFallo = 'Too many requests' } = {}) {
  const urls = []
  const fetchImpl = async (url, { headers }) => {
    urls.push(url)
    if (headers['x-rapidapi-key'] !== 'k') return { ok: false, status: 401, text: async () => 'no key' }
    if (fallaEn && urls.length >= fallaEn) return { ok: false, status: codigoFallo, text: async () => textoFallo }
    const u = new URL(url)
    const pagina = Number(u.searchParams.get('page') || 1)
    if (u.pathname.endsWith('/episodes')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ data: pagina === 1 ? EPISODIOS.data : [{ id: 9000 + pagina, name: `Relleno ${pagina}`, code: `R${pagina}`, cards_total: 1 }], paging: { current: pagina, total: 9, per_page: 20 } }) }
    }
    const ep = Number(u.searchParams.get('episode_id'))
    if (ep === 415) return { ok: true, status: 200, text: async () => JSON.stringify({ data: CARTAS_PBL.data, paging: { current: 1, total: 1, per_page: 100 } }) }
    if (ep === 413) {
      const data = pagina === 1 ? Array.from({ length: 100 }, (_, i) => ({ id: 5000 + i, card_number: String(i + 1), cardmarket_id: 700000 + i, tcgplayer_id: 1 })) : [{ id: 5100, card_number: '101', cardmarket_id: 700100 }]
      return { ok: true, status: 200, text: async () => JSON.stringify({ data, paging: { current: pagina, total: 2, per_page: 100 } }) }
    }
    return { ok: false, status: 404, text: async () => 'no' }
  }
  return { urls, fetchImpl }
}
function baseDeMentira(estadoInicial = {}) {
  const estados = { [CLAVE_ESTADO]: estadoInicial }
  const escrituras = []
  const restImpl = async (ruta) => {
    if (ruta.startsWith('tcg_sets?')) return SETS
    const m = ruta.match(/set_id=eq\.([^&]+)/)
    if (m) return NUESTRAS[decodeURIComponent(m[1])] || []
    throw new Error(`ruta inesperada ${ruta}`)
  }
  return {
    estados, escrituras, restImpl,
    guardarImpl: async (p) => { escrituras.push(...p); return p.length },
    estadoImpl: async () => estados[CLAVE_ESTADO],
    guardarEstadoImpl: async (clave, valor) => { estados[clave] = JSON.parse(JSON.stringify(valor)) },
  }
}
const AHORA = new Date('2026-10-05T10:00:00Z')
const sinPausa = async () => {}

console.log('── 2. Sin clave, se dice cuál falta ──')
{
  const r = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 's' }, ...baseDeMentira(), fetchImpl: async () => { throw new Error('no debería pedir') }, pausa: sinPausa, ahora: AHORA })
  check('sin TCGGO_API_KEY contesta 409 nombrando la variable', r.estado === 409 && /TCGGO_API_KEY/.test(r.cuerpo.error), JSON.stringify(r.cuerpo))
}

console.log('── 3. Una pasada con tope de 9: la lista de expansiones y nada más ──')
{
  const t = tcggoDeMentira()
  const b = baseDeMentira()
  const r = await procesar({ env: ENV, ...b, fetchImpl: t.fetchImpl, pausa: sinPausa, ahora: AHORA, peticiones: 9 })
  check('gasta exactamente 9 (las 9 páginas de expansiones)', r.cuerpo.peticionesEstaLlamada === 9 && t.urls.length === 9 && t.urls.every((u) => /episodes/.test(u)), JSON.stringify(t.urls.slice(0, 2)))
  check('la lista queda guardada con fecha (28 expansiones: 20 + 8 de relleno)', b.estados[CLAVE_ESTADO].episodios?.lista?.length === 28 && b.estados[CLAVE_ESTADO].episodios.fecha === AHORA.toISOString(), String(b.estados[CLAVE_ESTADO].episodios?.lista?.length))
  check('ningún set hecho todavía, y dice que quedan', r.cuerpo.setsHechos === 0 && r.cuerpo.siguiente === true && r.cuerpo.setsPendientes === 3 && r.cuerpo.nuestrosSets === 3, JSON.stringify([r.cuerpo.setsHechos, r.cuerpo.siguiente, r.cuerpo.setsPendientes]))
  check('el gasto del día queda apuntado', b.estados[CLAVE_ESTADO].gasto?.dia === '2026-10-05' && b.estados[CLAVE_ESTADO].gasto.peticiones === 9)

  console.log('── 4. La segunda llamada: ya no pide expansiones, hace sets ──')
  const r2 = await procesar({ env: ENV, ...b, fetchImpl: t.fetchImpl, pausa: sinPausa, ahora: AHORA, peticiones: 9 })
  check('gasta 3: Pitch Black (1 página) y Chaos Rising (2 páginas)', r2.cuerpo.peticionesEstaLlamada === 3 && t.urls.slice(9).every((u) => /cards\?episode_id/.test(u)), JSON.stringify(t.urls.slice(9)))
  const pbl = r2.cuerpo.esteTurno.find((f) => f.set === 'me05')
  check('Pitch Black → su expansión 415 por código: 20 pares de 22, 2 sin par', pbl?.episodio === 415 && pbl.por === 'codigo' && pbl.pares === 20 && pbl.sinPar === 2, JSON.stringify(pbl))
  check('  …escribe 19 (la 1 ya tenía el 895789) por la función de la base, con por=tcggo', pbl.escritas === 19 && b.escrituras.filter((e) => e.id.startsWith('me05-')).length === 19 && b.escrituras.every((e) => e.por === 'tcggo') && !b.escrituras.some((e) => e.id === 'me05-1'), JSON.stringify(b.escrituras.slice(0, 2)))
  check('  …la 2 va al 895790', b.escrituras.find((e) => e.id === 'me05-2')?.id_product === 895790)
  const cri = r2.cuerpo.esteTurno.find((f) => f.set === 'me04')
  check('Chaos Rising se pide entero (2 páginas) y casa su carta', cri?.suyas === 101 && cri.pares === 1 && b.escrituras.find((e) => e.id === 'me04-1')?.id_product === 700000, JSON.stringify(cri))
  const base = r2.cuerpo.esteTurno.find((f) => f.set === 'base1')
  check('Base Set no está en TCGGO: se apunta sin expansión, sin gastar', !!base?.sinEpisodio && b.estados[CLAVE_ESTADO].sinEpisodio.base1 && r2.cuerpo.setsSinEpisodio === 1, JSON.stringify(base))
  check('Pocket se queda fuera; no queda nada pendiente', r2.cuerpo.siguiente === false && r2.cuerpo.setsPendientes === 0 && r2.cuerpo.setsHechos === 2)
  check('la guía de precios se reabre para hoy', b.estados[CLAVE_GUIA]?.dia === '2026-10-05' && b.estados[CLAVE_GUIA].hecho === false, JSON.stringify(b.estados[CLAVE_GUIA]))

  console.log('── 5. La tercera: no pide nada (todo hecho o sin expansión) ──')
  const antes = t.urls.length
  const r3 = await procesar({ env: ENV, ...b, fetchImpl: t.fetchImpl, pausa: sinPausa, ahora: AHORA, peticiones: 9 })
  check('cero peticiones', r3.cuerpo.peticionesEstaLlamada === 0 && t.urls.length === antes && r3.cuerpo.siguiente === false)
  const r4 = await procesar({ env: ENV, ...b, fetchImpl: t.fetchImpl, pausa: sinPausa, ahora: AHORA, peticiones: 9, reiniciar: true })
  check('con `reiniciar` vuelve a pedir expansiones y sets', r4.cuerpo.peticionesEstaLlamada === 9 && r4.cuerpo.setsHechos === 0, JSON.stringify([r4.cuerpo.peticionesEstaLlamada, r4.cuerpo.setsHechos]))
}

console.log('── 6. Los frenos ──')
{
  // El tope diario: con 94 gastadas hoy, solo cabe una más.
  const t = tcggoDeMentira()
  const b = baseDeMentira({ gasto: { dia: '2026-10-05', peticiones: TOPE_DIARIO - 1 } })
  const r = await procesar({ env: ENV, ...b, fetchImpl: t.fetchImpl, pausa: sinPausa, ahora: AHORA, peticiones: 9 })
  check(`con ${TOPE_DIARIO - 1} gastadas hoy solo hace 1 y PARA nombrando el tope diario`, r.cuerpo.peticionesEstaLlamada === 1 && /tope diario/.test(r.cuerpo.parado) && r.cuerpo.siguiente === false, JSON.stringify([r.cuerpo.peticionesEstaLlamada, r.cuerpo.parado]))
  check('  …y la lista a medias NO se guarda', !b.estados[CLAVE_ESTADO].episodios)
  // Otro día, el contador vuelve a cero.
  const r2 = await procesar({ env: ENV, ...b, fetchImpl: t.fetchImpl, pausa: sinPausa, ahora: new Date('2026-10-06T10:00:00Z'), peticiones: 9 })
  check('al día siguiente el contador empieza de cero', r2.cuerpo.peticionesEstaLlamada === 9 && r2.cuerpo.peticionesHoy === 9)
  // El tope por variable de entorno.
  const b3 = baseDeMentira()
  const r3 = await procesar({ env: { ...ENV, TCGGO_TOPE_DIARIO: '3' }, ...b3, fetchImpl: tcggoDeMentira().fetchImpl, pausa: sinPausa, ahora: AHORA, peticiones: 9 })
  check('TCGGO_TOPE_DIARIO manda sobre el de serie', r3.cuerpo.peticionesEstaLlamada === 3 && r3.cuerpo.topeDiario === 3)
  // RapidAPI dice que no: se para y se cuenta la petición igual.
  const t4 = tcggoDeMentira({ fallaEn: 11, codigoFallo: 429 })
  const b4 = baseDeMentira()
  await procesar({ env: ENV, ...b4, fetchImpl: t4.fetchImpl, pausa: sinPausa, ahora: AHORA, peticiones: 9 })
  const r4 = await procesar({ env: ENV, ...b4, fetchImpl: t4.fetchImpl, pausa: sinPausa, ahora: AHORA, peticiones: 9 })
  check('un 429 a mitad de un set PARA, el set no se da por hecho y la petición se cuenta', /plan no da más/.test(r4.cuerpo.parado) && !b4.estados[CLAVE_ESTADO].hechos.me04 && b4.estados[CLAVE_ESTADO].gasto.peticiones === 11, JSON.stringify([r4.cuerpo.parado, b4.estados[CLAVE_ESTADO].gasto]))
  check('  …y lo hecho antes del 429 sí queda (Pitch Black)', !!b4.estados[CLAVE_ESTADO].hechos.me05 && b4.escrituras.length === 19)
  // Una respuesta sin cardmarket_id en ninguna carta: no es «nada casa».
  const t5 = tcggoDeMentira()
  const fetch5 = async (url, o) => {
    const r = await t5.fetchImpl(url, o)
    if (!/episode_id=415/.test(url)) return r
    const j = JSON.parse(await r.text())
    j.data = j.data.map((c) => ({ ...c, cardmarket_id: undefined }))
    return { ok: true, status: 200, text: async () => JSON.stringify(j) }
  }
  const b5 = baseDeMentira()
  await procesar({ env: ENV, ...b5, fetchImpl: fetch5, pausa: sinPausa, ahora: AHORA, peticiones: 9 })
  const r5 = await procesar({ env: ENV, ...b5, fetchImpl: fetch5, pausa: sinPausa, ahora: AHORA, peticiones: 9 })
  check('cartas sin cardmarket_id: se para diciéndolo y no se escribe nada', /sin cardmarket_id/.test(r5.cuerpo.parado) && b5.escrituras.length === 0 && !b5.estados[CLAVE_ESTADO].hechos.me05, JSON.stringify(r5.cuerpo.parado))
  // Sin tiempo: para sin dar el set por hecho.
  let tic = 0
  const r6 = await procesar({ env: ENV, ...baseDeMentira(), fetchImpl: tcggoDeMentira().fetchImpl, pausa: sinPausa, ahora: AHORA, peticiones: 9, reloj: () => (tic++ > 3 ? 1e9 : 0) })
  check('sin tiempo, devuelve lo que hay y no inventa lista', r6.estado === 200 && /no ha dado tiempo/.test(r6.cuerpo.nota || ''), JSON.stringify(r6.cuerpo).slice(0, 200))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
