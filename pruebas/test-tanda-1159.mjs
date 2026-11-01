// Tanda 1159 — «Buscar en Cardmarket» en la ficha de una carta de /admin y
// «Traer ahora lo que falta de TCGdex» en un set de rellenos (las MEP).
import { readFileSync } from 'node:fs'
import { buscar, mapaDeGuia, nombreBase, ataquesDe, plegar, precioDeGuia, esCarta, enlaceDeProducto } from '/home/user/pingu/netlify/lib/cardmarket-buscar.mjs'
import { responder, olvidar } from '/home/user/pingu/netlify/functions/cardmarket-buscar.mjs'
import { pasada, olvidarIntentosViejos, RELLENOS } from '/home/user/pingu/netlify/functions/tcgdex-rellenar-set.mjs'
import { traerAhora } from '/home/user/pingu/netlify/functions/tcgdex-rellenar-ahora.mjs'
import { rellenoDeSet, textoDeRelleno, RELLENOS_TCGDEX } from '/home/user/pingu/js/rellenos-tcgdex.js'
import { resultadosHtml, precioCorto } from '/home/user/pingu/admin/js/cardmarket-buscar.js'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const D = '/tmp/wt-pruebas/pruebas/fixtures/'
// Trozos REALES de los dos ficheros de Cardmarket (2026-10-04, Primal Clash
// y Paldea Evolved), los de la 587.
const productos = JSON.parse(readFileSync(D + 'cardmarket-products-prc-pal.json', 'utf8'))
const guiaJson = JSON.parse(readFileSync(D + 'cardmarket-price-guide-prc-pal.json', 'utf8'))
const guia = mapaDeGuia(guiaJson.priceGuides)

console.log('── Lo puro de la búsqueda ──')
{
  check('el nombre sin los ataques ni el paréntesis', nombreBase('Groudon EX [Rip Claw | Massive Rend]') === 'Groudon EX' && nombreBase('Feraligatr (Theme Deck)') === 'Feraligatr')
  check('los ataques entre corchetes', ataquesDe('Groudon EX [Rip Claw | Massive Rend]').join('/') === 'Rip Claw/Massive Rend')
  check('plegar quita tildes, guiones y apóstrofos', plegar("Pokémon Team Rocket's Mew-EX") === 'pokemon team rockets mew ex')
  check('un código de TCG Live no es una carta', !esCarta({ name: 'Online Code Card' }) && esCarta({ name: 'Pikachu' }))
  check('un 0 de la guía es «no hay», no gratis', precioDeGuia({ low: 0, trend: 0 }) === null && precioDeGuia({ low: 0.2 }).low === 0.2)
  check('el enlace por id es el de la web', enlaceDeProducto(903676) === 'https://www.cardmarket.com/es/Pokemon/Products?idProduct=903676')
}

console.log('── Buscar con el catálogo de verdad ──')
{
  const r = buscar(productos.products, 'groudon ex', { guia })
  check('«groudon ex» encuentra los cuatro Groudon EX y Primal Groudon EX', r.total === 5 && r.resultados.every((x) => /groudon ex/i.test(x.nombre)), r.resultados.map((x) => `${x.idProduct} ${x.nombre}`).join(' | '))
  check('  …el nombre exacto delante de «Primal…»', r.resultados[0].nombre === 'Groudon EX' && r.resultados[1].nombre === 'Groudon EX')
  check('  …con sus ataques, su expansión, su enlace y su precio', r.resultados[0].ataques.length === 2 && r.resultados[0].idExpansion === 1585 && /idProduct=273616$/.test(r.resultados[0].enlace) && r.resultados.some((x) => x.precio))
  const porAtaque = buscar(productos.products, 'groudon rock smash')
  check('un ataque afina («groudon rock smash» es uno)', porAtaque.total === 1 && porAtaque.resultados[0].idProduct === 273615)
  const pika = buscar(productos.products, 'pikachu', { cerca: [273532] })
  check('sin hermanas de su expansión, ninguna sale marcada', pika.resultados.every((x) => !x.misma) && pika.expansionesCerca.join() === '1585')
  const cerca = buscar(productos.products, 'pikachu', { cerca: [715538] })
  check('con una hermana de Paldea, las de su expansión salen marcadas y delante', cerca.resultados.length && cerca.resultados.every((x) => x.misma) && cerca.expansionesCerca.join() === '5318')
  const mezcla = buscar([...productos.products, { idProduct: 1, name: 'Pikachu [Thundershock]', idExpansion: 99 }], 'pikachu', { cerca: [715538] })
  check('  …y una de otra expansión va detrás', mezcla.resultados.at(-1).idProduct === 1 && !mezcla.resultados.at(-1).misma && mezcla.resultados[0].misma)
  const porId = buscar(productos.products, '273615')
  check('un número es un id: lo encuentra tal cual', porId.resultados[0]?.idProduct === 273615)
  check('una consulta vacía no busca', buscar(productos.products, '  ').total === 0)
  const tope = buscar(Array.from({ length: 200 }, (_, i) => ({ idProduct: i + 1, name: 'Pikachu', idExpansion: 1 })), 'pikachu')
  check('como mucho 60, y dice cuántas casan', tope.total === 200 && tope.resultados.length === 60)
}

console.log('── La función ──')
{
  const req = (q, tok = 'buena') => new Request(`https://pokedoc.es/.netlify/functions/cardmarket-buscar?q=${encodeURIComponent(q)}&cerca=715538,abc`, { headers: { authorization: `Bearer ${tok}` } })
  const esAdmin = async (t) => (t === 'buena' ? 'admin-1' : null)
  let bajadas = 0
  const fetchImpl = async (url) => { bajadas++; return { ok: true, json: async () => (/productList/.test(url) ? productos : guiaJson) } }
  olvidar()
  const no = await responder(req('pikachu', 'mala'), { fetchImpl, esAdmin })
  check('sin ser admin, 401 y sin bajar nada', no.status === 401 && bajadas === 0)
  const r = await responder(req('pikachu'), { fetchImpl, esAdmin, ahora: 1000 })
  const j = await r.json()
  check('busca, con precio y con la expansión de la hermana', r.status === 200 && j.ok && j.total === 4 && j.conPrecio && j.resultados[0].misma, JSON.stringify(j).slice(0, 200))
  await responder(req('groudon'), { fetchImpl, esAdmin, ahora: 2000 })
  check('la segunda búsqueda no vuelve a bajar los ficheros', bajadas === 2)
  await responder(req('groudon'), { fetchImpl, esAdmin, ahora: 1000 + 7 * 3600 * 1000 })
  check('a las seis horas, sí (Cardmarket los rehace cada día)', bajadas === 4)
  olvidar()
  const lenta = async (url) => (/productList/.test(url) ? { ok: true, json: async () => productos } : new Promise(() => {}))
  const t0 = Date.now()
  const sinGuia = await (await responder(req('pikachu'), { fetchImpl: lenta, esAdmin, ahora: 5000 })).json()
  check('si la guía no llega, contesta sin precio y a tiempo', sinGuia.ok && !sinGuia.conPrecio && sinGuia.resultados[0].precio === null && Date.now() - t0 < 4000, `${Date.now() - t0} ms`)
  olvidar()
  const caida = await responder(req('pikachu'), { fetchImpl: async () => ({ ok: false, status: 503 }), esAdmin, ahora: 9000 })
  const jc = await caida.json()
  check('si Cardmarket no contesta, lo dice tal cual', caida.status === 502 && /catálogo de Cardmarket 503/.test(jc.error), jc.error)
  const vacia = await responder(new Request('https://pokedoc.es/x?q=', { headers: { authorization: 'Bearer buena' } }), { fetchImpl, esAdmin })
  check('sin nombre, 400', vacia.status === 400)
  olvidar()
}

console.log('── Lo que pinta /admin ──')
{
  const r = { ok: true, ...buscar(productos.products, 'groudon ex', { guia, cerca: [273615] }) }
  const html = resultadosHtml(r, 273616)
  check('cada resultado con «Ver ↗» a su página y «Usar»', (html.match(/data-cmb-usar=/g) || []).length === 5 && html.includes('href="https://www.cardmarket.com/es/Pokemon/Products?idProduct=273616"'))
  check('  …la que ya está puesta dice «Puesta»', /cmb-puesta[\s\S]*?Puesta</.test(html))
  check('  …y las de la misma expansión, «misma expansión»', (html.match(/misma expansión<\/b>/g) || []).length === 5)
  check('sin resultados, una pista que sirve', /nombre en inglés/.test(resultadosHtml({ ok: true, total: 0, resultados: [] })))
  check('un error se enseña tal cual', resultadosHtml({ ok: false, error: 'Solo para administradores.' }).includes('Solo para administradores.'))
  check('el precio corto: normal y holo', precioCorto({ low: 0.02, lowHolo: 0.2 }) === 'desde 0,02 € · holo 0,20 €' && precioCorto(null) === 'sin precio')
}

console.log('── «Traer ahora» del relleno de TCGdex ──')
{
  check('la lista es UNA (la función lee la de js/)', RELLENOS === RELLENOS_TCGDEX)
  check('el botón sale en el set de las MEP (por id o código, sin caja) y en ningún otro', rellenoDeSet({ id: 'mep' })?.clave === 'mep-tcgdex' && rellenoDeSet({ id: 'tcggo-1', tcg_online_code: 'mep' })?.clave === 'mep-tcgdex' && !rellenoDeSet({ id: 'sv1' }) && !rellenoDeSet({ id: 'mep' }, 'JP'))

  const pad = (n) => String(n).padStart(3, '0')
  const env = { SUPABASE_SERVICE_ROLE_KEY: 'x' }
  const suyas = [89, 90, 91, 92, 1].map((n) => ({ id: `mep-${pad(n)}`, localId: pad(n), name: `Carta ${n}` }))
  const nuestras = [{ id: 'tcggo-1', local_id: '001' }]
  const escritas = []
  const restImpl = async (ruta, op) => {
    if (op?.method === 'POST' && ruta.startsWith('tcg_cards')) { escritas.push(...JSON.parse(op.body)); return null }
    if (op?.method === 'POST') return null
    if (ruta.startsWith('tcg_sets')) return [{ id: 'mep', name: 'MEP Black Star Promos', tcggo_id: 1 }]
    if (ruta.startsWith('tcg_cards?select=id,local_id')) return nuestras
    if (ruta.startsWith('tcg_cards?select=id,set_id')) return [{ id: 'mep-091', set_id: 'svp', local_id: '091' }]
    return []
  }
  const fetchImpl = async () => ({ ok: true, json: async () => ({ cards: suyas }) })
  // Hecho hace una hora: la pasada normal no haría nada.
  let estado = { hechos: { 'mep-tcgdex': { fecha: '2026-11-01T17:00:00Z', estado: 'hecho' } }, intentos: {} }
  const io = { env, fetchImpl, restImpl, estadoImpl: async () => estado, guardarEstadoImpl: async (k, v) => { estado = v }, ahora: new Date('2026-11-01T18:00:00Z') }
  const normal = await pasada(io)
  check('la pasada normal, recién hecha, no hace nada', normal.saltado === 'nada pendiente' && !escritas.length)
  const r = await pasada({ ...io, forzar: true, clave: 'mep-tcgdex' })
  check('forzada, la hace aunque no toque', r.ok && escritas.map((f) => f.local_id).join() === '089,090,092', JSON.stringify(r))
  check('  …y dice qué se ha saltado porque ya está en otro set, y dónde', r.hecho.enOtroSet?.[0]?.id === 'mep-091' && r.hecho.enOtroSet[0].set === 'svp' && r.hecho.faltaban === 4 && r.hecho.escritas === 3)
  const otra = await pasada({ ...io, forzar: true, clave: 'no-existe' })
  check('un relleno que no está en la lista, error con su nombre', !otra.ok && /no-existe/.test(otra.error))

  const t = textoDeRelleno({ ...r, web: { ok: true } })
  check('la frase de /admin cuenta lo que ha pasado', /TCGdex tiene 5 cartas de este set y aquí había 1\./.test(t) && /Faltaban 4; escritas 3 \(089, 090, 092\)/.test(t) && /091 \(mep-091 en «svp»\)/.test(t) && /La web ya las enseña/.test(t), t)
  check('  …y lo que no ha podido, como no ha podido', textoDeRelleno({ ok: false, error: 'TCGdex 503' }) === 'No se ha podido: TCGdex 503.' && /No falta ninguna/.test(textoDeRelleno({ ok: true, hecho: { suyas: 3, teniamos: 3, faltaban: 0, escritas: 0 } })))

  // Los intentos fallidos de antes de rehacerDesde se olvidan.
  const e = { intentos: { 'mep-tcgdex': 3 }, ultimoError: { clave: 'mep-tcgdex', fecha: '2026-11-01T14:00:00Z' } }
  olvidarIntentosViejos(e, [{ clave: 'mep-tcgdex', rehacerDesde: '2026-11-01T15:30:00Z' }], new Date('2026-11-01T16:00:00Z'))
  check('tres intentos de antes de rehacerDesde se olvidan', !e.intentos['mep-tcgdex'])
  const e2 = { intentos: { 'mep-tcgdex': 3 }, ultimoError: { clave: 'mep-tcgdex', fecha: '2026-11-01T15:45:00Z' } }
  olvidarIntentosViejos(e2, [{ clave: 'mep-tcgdex', rehacerDesde: '2026-11-01T15:30:00Z' }], new Date('2026-11-01T16:00:00Z'))
  check('  …los de después, no (un fallo nuevo sigue frenando)', e2.intentos['mep-tcgdex'] === 3)
  let intentosQueda = { hechos: { 'mep-tcgdex': { fecha: '2026-11-01T14:31:00Z' } }, intentos: { 'mep-tcgdex': 3 }, ultimoError: { clave: 'mep-tcgdex', fecha: '2026-11-01T14:50:00Z' } } // la lista: rehacerDesde 16:30 (1160)
  escritas.length = 0
  const vuelta = await pasada({ ...io, estadoImpl: async () => intentosQueda, guardarEstadoImpl: async (k, v) => { intentosQueda = v }, ahora: new Date('2026-11-01T17:00:00Z') })
  check('con el rehacerDesde de la lista, la pasada programada vuelve a hacer las MEP', vuelta.ok && vuelta.hecho?.escritas >= 3, JSON.stringify(vuelta))

  // La función de /admin.
  const pedir = (metodo, tok, cuerpo) => new Request('https://pokedoc.es/.netlify/functions/tcgdex-rellenar-ahora', { method: metodo, headers: { authorization: `Bearer ${tok}` }, body: metodo === 'POST' ? JSON.stringify(cuerpo) : undefined })
  const esAdmin = async (t) => (t === 'buena' ? 'admin-1' : null)
  let llamada = null
  let purgas = 0
  const pasadaImpl = async (o) => { llamada = o; return { ok: true, hecho: { escritas: 3 } } }
  const purgarImpl = async (et) => { purgas++; return { ok: et[0] === 'sets' } }
  check('por GET, 405', (await traerAhora(pedir('GET', 'buena'), { esAdmin, pasadaImpl, purgarImpl })).status === 405)
  check('sin ser admin, 401 y no pasa nada', (await traerAhora(pedir('POST', 'mala', { clave: 'mep-tcgdex' }), { esAdmin, pasadaImpl, purgarImpl })).status === 401 && !llamada)
  const ok = await traerAhora(pedir('POST', 'buena', { clave: 'mep-tcgdex' }), { esAdmin, pasadaImpl, purgarImpl, env })
  const jo = await ok.json()
  check('admin: la pasada forzada de ESE relleno y vacía la CDN', ok.status === 200 && llamada.forzar === true && llamada.clave === 'mep-tcgdex' && purgas === 1 && jo.web.ok)
  await traerAhora(pedir('POST', 'buena', { clave: 'mep-tcgdex' }), { esAdmin, pasadaImpl: async () => ({ ok: true, hecho: { escritas: 0 } }), purgarImpl, env })
  check('  …sin nada escrito, no vacía nada', purgas === 1)
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
