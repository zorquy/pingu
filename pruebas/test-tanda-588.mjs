// Tanda 588 — emparejar con Cardmarket por TCGGO: el ayudante puro y la
// función, sin red. Los fixtures son los ejemplos de respuesta de SU
// documentación (api-1_1.json, 2026-10-05): la lista de expansiones y la
// primera página de /cards (Pitch Black, con cardmarket_id). El 895789 de
// Tropius existe en el fichero abierto de Cardmarket como «Tropius [Fruity
// Aroma | Solar Beam]» de la expansión 6569: mismo espacio de ids.
import { readFileSync } from 'node:fs'
import {
  cabeceras, baseDe, urlEpisodios, urlCartasDeEpisodio, hayMasPaginas, resumirEpisodio, episodioDeSet, emparejarPorNumero, esLimiteDelPlan, HOST,
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
  check('la base de serie es la puerta del PDF con /pokemon, y TCGGO_BASE la cambia con su host', baseDe({}).base === 'https://cardmarket-api-tcg.p.rapidapi.com/pokemon' && baseDe({}).host === 'cardmarket-api-tcg.p.rapidapi.com' && baseDe({ TCGGO_BASE: 'https://pokemon-tcg-api.p.rapidapi.com/' }).base === 'https://pokemon-tcg-api.p.rapidapi.com' && baseDe({ TCGGO_BASE: 'https://pokemon-tcg-api.p.rapidapi.com/' }).host === 'pokemon-tcg-api.p.rapidapi.com', JSON.stringify(baseDe({ TCGGO_BASE: 'https://pokemon-tcg-api.p.rapidapi.com/' })))
  check('  …y una base rota no rompe: se queda con la de serie como host', baseDe({ TCGGO_BASE: 'no es una url' }).host === 'cardmarket-api-tcg.p.rapidapi.com')
  check('las URLs: /pokemon/episodes por página, /pokemon/cards por expansión de 100 en 100', urlEpisodios(2) === 'https://cardmarket-api-tcg.p.rapidapi.com/pokemon/episodes?page=2' && urlCartasDeEpisodio(415, 3) === 'https://cardmarket-api-tcg.p.rapidapi.com/pokemon/cards?episode_id=415&per_page=100&page=3', urlEpisodios(2))
  check('`paging` dice si hay más (1 de 9 sí, 9 de 9 no, sin paging no)', hayMasPaginas(EPISODIOS) === true && hayMasPaginas({ paging: { current: 9, total: 9 } }) === false && hayMasPaginas({}) === false)
  const eps = EPISODIOS.data.map(resumirEpisodio)
  check('una expansión resumida: id, nombre, código, cartas', eps[2].id === 415 && eps[2].codigo === 'PBL' && eps[2].nombre === 'Pitch Black' && eps[2].cartas === 120, JSON.stringify(eps[2]))

  const porNombre0 = episodioDeSet({ id: 'me05', name: 'Negro Absoluto', name_en: 'Pitch Black', tcg_online_code: 'PBL' }, eps)
  check('un set se reconoce PRIMERO por su nombre inglés exacto', porNombre0.episodio?.id === 415 && porNombre0.por === 'nombre', JSON.stringify(porNombre0))
  const porCodigo = episodioDeSet({ id: 'me05', name: 'Negro Absoluto', name_en: 'Negro Absoluto', tcg_online_code: 'PBL' }, eps)
  check('  …y si el nombre no casa, por el código de TCG Live', porCodigo.episodio?.id === 415 && porCodigo.por === 'codigo', JSON.stringify(porCodigo))
  check('  …sin distinguir mayúsculas', episodioDeSet({ id: 'x', name: 'x', tcg_online_code: 'pbl' }, eps).episodio?.id === 415)
  // EL CASO ex7: nuestro «RR» (EX Team Rocket Returns) es el «RR» de Rising
  // Rivals en TCGGO; ellos llaman «TRR» al nuestro. El nombre manda.
  const rr = [{ id: 114, nombre: 'Rising Rivals', codigo: 'RR' }, { id: 143, nombre: 'EX Team Rocket Returns', codigo: 'TRR' }]
  const ex7 = episodioDeSet({ id: 'ex7', name: 'Team Rocket Returns', name_en: 'EX Team Rocket Returns', tcg_online_code: 'RR' }, rr)
  check('ex7 [RR] va a «EX Team Rocket Returns» por el nombre, no a Rising Rivals por el código', ex7.episodio?.id === 143 && ex7.por === 'nombre', JSON.stringify(ex7))
  check('  …y pl2 [RR] sigue yendo a Rising Rivals', episodioDeSet({ id: 'pl2', name_en: 'Rising Rivals', name: 'Rivales Emergentes', tcg_online_code: 'RR' }, rr).episodio?.id === 114)
  check('la puntuación no cuenta: «Celebrations: Classic Collection»', episodioDeSet({ id: 'cel25cc', name_en: 'Celebrations Classic Collection', name: 'x', tcg_online_code: 'CEL' }, [{ id: 35, nombre: 'Celebrations', codigo: 'CEL' }, { id: 36, nombre: 'Celebrations: Classic Collection', codigo: 'CEL' }]).episodio?.id === 36)
  const palabras = episodioDeSet({ id: '30th-c', name_en: '30th Classic Collection', name: 'x', tcg_online_code: null }, [{ id: 431, nombre: '30th Celebration', codigo: '30C' }, { id: 440, nombre: '30th Celebration: Classic Collection', codigo: '30C' }])
  check('como último recurso, la única expansión que contiene todas nuestras palabras', palabras.episodio?.id === 440 && palabras.por === 'palabras', JSON.stringify(palabras))
  const porNombre = episodioDeSet({ id: 'sv08.5', name: 'Evoluciones Prismáticas', name_en: 'Prismatic Evolutions', tcg_online_code: null }, eps)
  check('sin código, por el nombre inglés', porNombre.episodio?.id === 212 && porNombre.por === 'nombre', JSON.stringify(porNombre))
  check('  …y «Scarlet & Violet» casa con «Scarlet and Violet»', episodioDeSet({ id: 'x', name_en: 'Scarlet and Violet', name: 'x' }, [{ id: 1, nombre: 'Scarlet & Violet', codigo: 'SVI' }]).episodio?.id === 1)
  const nada = episodioDeSet({ id: 'base1', name: 'Base Set', name_en: 'Base Set', tcg_online_code: 'BS' }, eps)
  check('un set que no está se queda sin expansión diciendo por qué', nada.episodio === null && /BS/.test(nada.porque) && /Base Set/.test(nada.porque), nada.porque)
  const dos = episodioDeSet({ id: 'swsh12.5gg', name: 'Galería Galar', name_en: 'Crown Zenith Galarian Gallery', tcg_online_code: 'CRZ' }, [{ id: 21, nombre: 'Crown Zenith', codigo: 'CRZ' }, { id: 22, nombre: 'Crown Zenith Galarian Gallery', codigo: 'CRZ' }])
  check('dos expansiones con el mismo código: decide el nombre', dos.episodio?.id === 22 && dos.por === 'nombre', JSON.stringify(dos))
  const dosSinNombre = episodioDeSet({ id: 'x', name: 'Galería', name_en: 'Galería', tcg_online_code: 'CRZ' }, [{ id: 21, nombre: 'Crown Zenith', codigo: 'CRZ' }, { id: 22, nombre: 'Crown Zenith Galarian Gallery', codigo: 'CRZ' }])
  check('  …y con el nombre sin casar y dos del mismo código, no se elige', dosSinNombre.episodio === null && /2 expansiones/.test(dosSinNombre.porque))
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
  check('  …y las suyas dicen ser de «pbl» (prefijo del tcgid dominante)', r.prefijoDominante === 'pbl', String(r.prefijoDominante))
  // Base Set: ilimitada y 1.ª edición con el MISMO número; solo una lleva
  // nuestro id como tcgid. Y una sin par con el motivo y los nombres.
  const base = [
    { id: 1, card_number: '4', cardmarket_id: 100, tcgid: 'base1-4', name: 'Charizard', name_numbered: 'Charizard 4' },
    { id: 2, card_number: '4', cardmarket_id: 101, tcgid: null, name: 'Charizard', name_numbered: 'Charizard 4 (1st Edition)' },
    { id: 3, card_number: '5', cardmarket_id: 102, tcgid: null, name: 'Clefairy', name_numbered: 'Clefairy 5' },
    { id: 4, card_number: '5', cardmarket_id: 103, tcgid: null, name: 'Clefairy', name_numbered: 'Clefairy 5 (1st Edition)' },
  ]
  const rb = emparejarPorNumero([{ id: 'base1-4', local_id: '4' }, { id: 'base1-5', local_id: '5' }], base)
  check('Base Set: la 4 casa por tcgid con la ilimitada (100), no con la 1.ª edición', rb.pares.find((p) => p.id === 'base1-4')?.idProduct === 100 && rb.pares[0].por === 'tcgid', JSON.stringify(rb.pares))
  check('  …y la 5, sin tcgid que decida, se queda sin par nombrando las dos', rb.sinPar.length === 1 && /2 cartas suyas con ese número: «Clefairy 5» sin tcgid, «Clefairy 5 \(1st Edition\)» sin tcgid/.test(rb.sinPar[0].porque), JSON.stringify(rb.sinPar))
  // Trainer Gallery: nuestras «TG01» y las suyas «1» (expansión aparte).
  const tg = emparejarPorNumero([{ id: 'swsh10tg-TG01', local_id: 'TG01' }, { id: 'swsh10tg-TG02', local_id: 'TG02' }], [{ id: 7, card_number: '1', cardmarket_id: 500 }, { id: 8, card_number: '2', cardmarket_id: 501 }, { id: 9, card_number: '30', cardmarket_id: 502 }])
  check('Trainer Gallery: «TG01» casa con su «1» por los dígitos', tg.pares.length === 2 && tg.pares[0].idProduct === 500 && tg.pares[0].por === 'digitos' && tg.sobran === 1, JSON.stringify(tg.pares))
  const amb = emparejarPorNumero([{ id: 'a-TG01', local_id: 'TG01' }, { id: 'a-1', local_id: '1' }], [{ id: 7, card_number: '1', cardmarket_id: 500 }])
  check('  …pero no cuando los dígitos no son únicos por nuestro lado (TG01 y 1 contra su 1)', amb.pares.length === 1 && amb.pares[0].id === 'a-1' && amb.sinPar.length === 1, JSON.stringify([amb.pares, amb.sinPar]))
  check('los números suyos sin usar se devuelven como ejemplo', JSON.stringify(tg.ejemplosSuyos) === '["30"]')
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
  check('Pitch Black → su expansión 415 por nombre: 20 pares de 22, 2 sin par', pbl?.episodio === 415 && pbl.por === 'nombre' && pbl.pares === 20 && pbl.sinPar === 2, JSON.stringify(pbl))
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

console.log('── 5a. La guarda del set ajeno, y «solo estos sets» ──')
{
  // Un set nuestro «ex7» cuyo nombre no casa con nada, con código «CRI»
  // (el de Chaos Rising): por código iría a Chaos Rising, y las cartas de
  // allí llevan tcgid «cri-…» — hmm, mejor: llevan el id de OTRO set
  // nuestro, «me04». Eso es exactamente ex7 → Rising Rivals.
  const SETS_RR = [
    { id: 'me04', name: 'Caos Creciente', name_en: 'Chaos Rising', tcg_online_code: 'CRI', release_date: '2026-05-22' },
    { id: 'ex7', name: 'Team Rocket Returns', name_en: 'No Existe Aquí', tcg_online_code: 'CRI', release_date: '2004-11-01' },
  ]
  const NUESTRAS_RR = { me04: [{ id: 'me04-1', local_id: '1', cm_id_product_propio: null }], ex7: [{ id: 'ex7-1', local_id: '1', cm_id_product_propio: null }, { id: 'ex7-2', local_id: '2', cm_id_product_propio: null }] }
  const t = tcggoDeMentira()
  const fetchRR = async (url, o) => {
    const r = await t.fetchImpl(url, o)
    if (!/episode_id=413/.test(url)) return r
    const j = JSON.parse(await r.text())
    j.data = j.data.map((c) => ({ ...c, tcgid: `me04-${c.card_number}` }))
    return { ok: true, status: 200, text: async () => JSON.stringify(j) }
  }
  const b = baseDeMentira()
  const restRR = async (ruta) => (ruta.startsWith('tcg_sets?') ? SETS_RR : NUESTRAS_RR[decodeURIComponent(ruta.match(/set_id=eq\.([^&]+)/)[1])] || [])
  await procesar({ env: ENV, ...b, restImpl: restRR, fetchImpl: fetchRR, pausa: sinPausa, ahora: AHORA, peticiones: 9 })
  const r = await procesar({ env: ENV, ...b, restImpl: restRR, fetchImpl: fetchRR, pausa: sinPausa, ahora: AHORA, peticiones: 9 })
  const fx = r.cuerpo.esteTurno.find((f) => f.set === 'ex7')
  check('ex7 cae por código en Chaos Rising, pero sus cartas llevan «me04-…»: SOSPECHOSO y no se escribe', !!fx?.SOSPECHOSO && /«me04»/.test(fx.SOSPECHOSO) && fx.escritas === 0 && !b.escrituras.some((e) => e.id.startsWith('ex7-')), JSON.stringify(fx))
  check('  …y me04, que sí es suyo, se escribe', b.escrituras.some((e) => e.id === 'me04-1'))
  check('  …y el set queda apuntado como hecho con la marca', b.estados[CLAVE_ESTADO].hechos.ex7?.sospechoso === 'me04')
  // «Solo estos sets»: me04 ya está hecho y se repite igual, sin tocar los demás.
  const antes = t.urls.length
  const r2 = await procesar({ env: ENV, ...b, restImpl: restRR, fetchImpl: fetchRR, pausa: sinPausa, ahora: AHORA, peticiones: 9, soloSets: ['ME04'] })
  check('con soloSets se repite un set hecho (2 páginas) y solo ese', t.urls.length === antes + 2 && r2.cuerpo.esteTurno.length === 1 && r2.cuerpo.esteTurno[0].set === 'me04', JSON.stringify([t.urls.length - antes, r2.cuerpo.esteTurno.map((f) => f.set)]))
}

console.log('── 5b. La lista de expansiones se reanuda, y el plan de pago ──')
{
  const t = tcggoDeMentira()
  const b = baseDeMentira()
  const r1 = await procesar({ env: ENV, ...b, fetchImpl: t.fetchImpl, pausa: sinPausa, ahora: AHORA, peticiones: 5 })
  check('con tope 5 bajan 5 páginas y la lista queda EN CURSO, no decidida', r1.cuerpo.peticionesEstaLlamada === 5 && !b.estados[CLAVE_ESTADO].episodios && b.estados[CLAVE_ESTADO].episodiosEnCurso?.siguientePagina === 6 && b.estados[CLAVE_ESTADO].episodiosEnCurso.lista.length === 24, JSON.stringify(b.estados[CLAVE_ESTADO].episodiosEnCurso?.siguientePagina))
  const r2 = await procesar({ env: ENV, ...b, fetchImpl: t.fetchImpl, pausa: sinPausa, ahora: AHORA, peticiones: 5 })
  check('la siguiente sigue por la página 6, acaba la lista y le sobra una para un set', t.urls[5].endsWith('episodes?page=6') && b.estados[CLAVE_ESTADO].episodios?.lista?.length === 28 && !b.estados[CLAVE_ESTADO].episodiosEnCurso && r2.cuerpo.peticionesEstaLlamada === 5 && r2.cuerpo.setsHechos === 1, JSON.stringify([t.urls[5], r2.cuerpo.setsHechos]))
  // Con la pausa del plan Ultra caben 60 por llamada; con la del gratis, 9.
  const b3 = baseDeMentira()
  const t3 = tcggoDeMentira()
  const r3 = await procesar({ env: { ...ENV, TCGGO_PAUSA_MS: '250', TCGGO_TOPE_DIARIO: '14000' }, ...b3, fetchImpl: t3.fetchImpl, pausa: sinPausa, ahora: AHORA, peticiones: 60 })
  check('con TCGGO_PAUSA_MS=250 una llamada hace la lista y los sets de una vez', r3.cuerpo.tope === 60 && r3.cuerpo.pausaMs === 250 && r3.cuerpo.peticionesEstaLlamada === 12 && r3.cuerpo.setsHechos === 2 && r3.cuerpo.topeDiario === 14000, JSON.stringify([r3.cuerpo.tope, r3.cuerpo.peticionesEstaLlamada, r3.cuerpo.setsHechos]))
  const r4 = await procesar({ env: ENV, ...baseDeMentira(), fetchImpl: tcggoDeMentira().fetchImpl, pausa: sinPausa, ahora: AHORA, peticiones: 60 })
  check('con la pausa del gratis el tope por llamada se acota a 9', r4.cuerpo.tope === 9)
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
