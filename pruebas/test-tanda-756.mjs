// Tanda 756 — la portada dice lo mismo que el Panel, y lo que va a salir.
//
// PINGU: «el precio de la portada y el del panel de Mi colección no es el
// mismo; que coja los datos del panel». Y: «en lanzamientos quiero los
// próximos; TCGGO los tiene — Delta Reign sale el 6 de noviembre — y que
// lo coja solo». Lo que se mira: la suma es UNA (`valorDeLineas`, la usan
// el Panel y la portada) y el valor de ahora es el punto de hoy; el
// catálogo crea el set de una expansión FUTURA aunque venga con cero
// cartas (escondido), y cuando sus cartas llegan las mete en ese set y lo
// enseña; las listas se piden cada día; y el calendario enseña las
// escondidas de TCGGO, sin enlace.
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const { conElValorDeAhora } = await import(`${RAIZ}/js/hoy.js`)
const { valorDeLineas } = await import(`${RAIZ}/js/mi-coleccion/datos.js`)
const { eventosDelCatalogo, partir } = await import(`${RAIZ}/js/lanzamientos.js`)
const { procesar, CLAVE_ESTADO, DIAS_DE_EPISODIOS } = await import(`${RAIZ}/netlify/functions/tcggo-catalogo.mjs`)
const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)
const { resumirEpisodio } = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)

console.log('── 1. Una sola suma, y el valor de ahora como punto de hoy ──')
{
  const guardados = new Map([['a', { card_id: 'a', cm_low: 10, cm_low_es: 12 }], ['b', { card_id: 'b', cm_low: 5 }]])
  const lineas = [{ card_id: 'a', cantidad: 2, idioma: 'es' }, { card_id: 'b', cantidad: 1, valor_manual: 40 }, { card_id: 'c', cantidad: 3 }]
  const v = valorDeLineas(lineas, guardados)
  check('dos copias españolas al mínimo español, una con su precio a mano, una sin precio (no cuenta)', v === 64, String(v))
  const mc = readFileSync(`${RAIZ}/js/mi-coleccion.js`, 'utf8')
  const hoy = readFileSync(`${RAIZ}/js/hoy.js`, 'utf8')
  check('el Panel y la portada suman con LA MISMA función', /datos\.valorDeLineas\(/.test(mc) && /valorDeLineas\(lineas, await preciosGuardados/.test(hoy))
  const filas = [{ dia: '2026-10-06', valor: 100 }, { dia: '2026-10-07', valor: 150 }, { dia: '2026-10-08', valor: 160 }]
  const r = conElValorDeAhora(filas, 170, '2026-10-08')
  check('la foto de hoy se cambia por el valor de ahora', r.length === 3 && r[2].valor === 170 && r[2].dia === '2026-10-08', JSON.stringify(r))
  const s = conElValorDeAhora(filas.slice(0, 2), 170, '2026-10-08')
  check('sin foto de hoy, se añade', s.length === 3 && s[2].valor === 170, JSON.stringify(s))
  check('sin valor de ahora, el histórico tal cual', conElValorDeAhora(filas, null, '2026-10-08') === filas)
}

console.log('\n── 2. El catálogo: Delta Reign, anunciada y sin cartas ──')
{
  // El episodio TAL COMO LO DA TCGGO (de la respuesta que pegó PINGU).
  const DELTA = { id: 437, name: 'Delta Reign', slug: 'delta-reign', lang: 'en', released_at: '2026-11-06', logo: 'https://images.tcggo.com/tcggo/storage/40198/deltareignlogo.png', code: 'DLR', cards_total: 0, cards_printed_total: 0, prices: { cardmarket: { total: 0, currency: 'EUR' }, tcgplayer: { total: 0, currency: 'EUR' } }, game: { name: 'Pokémon', slug: 'pokemon' }, series: { id: 17, name: 'Mega Evolution', slug: 'mega-evolution' } }
  const VIEJA = { id: 20, name: 'Scarlet & Violet Energies', code: 'SVE', cards_total: 0, released_at: '2023-03-31' }
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }
  const AHORA = new Date('2026-10-08T10:00:00Z')
  const lista = (cartasDelta) => [resumirEpisodio({ ...DELTA, cards_total: cartasDelta }), resumirEpisodio(VIEJA)]
  const estados = { [CLAVE_PARES]: { episodios: { fecha: AHORA.toISOString(), lista: lista(0) }, hechos: {} }, [CLAVE_ESTADO]: { episodiosJp: { fecha: AHORA.toISOString(), lista: [] } } }
  const sets = [{ id: 'me3', name: 'Héroes Ascendentes', name_en: 'Ascended Heroes', tcg_online_code: 'ASC', serie_id: 'me', serie_name: 'Megaevolución', serie_name_en: 'Mega Evolution', tcggo_id: null, oculto: false }]
  const parches = []
  const creados = []
  const cartas = []
  const urls = []
  const b = {
    fetchImpl: async (url) => {
      urls.push(url)
      const u = new URL(url)
      const page = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify({ data, paging: { current: 1, total: 1, per_page: 100 } }) })
      if (u.pathname.endsWith('/episodes')) return page([])
      if (Number(u.searchParams.get('episode_id')) === 437) return page([{ id: 90001, name: 'Ampharos ex', card_number: '1', cardmarket_id: 990001, type: 'singles' }, { id: 51262, name: 'Delta Reign Booster', type: 'sealed' }])
      return { ok: false, status: 404, text: async () => 'no' }
    },
    restImpl: async (ruta, opciones = null) => {
      const r = decodeURIComponent(ruta)
      if (opciones?.method === 'PATCH') { parches.push({ ruta: r, cuerpo: JSON.parse(opciones.body) }); const s = sets.find((x) => r.includes(`id=eq.${x.id}`)); if (s) Object.assign(s, JSON.parse(opciones.body)); return null }
      if (r.startsWith('tcg_sets?')) return /market=eq\.WEST/.test(r) ? sets.map((s) => ({ ...s })) : []
      if (r.startsWith('tcg_cards?')) return []
      throw new Error(`ruta inesperada ${r}`)
    },
    guardarCartasImpl: async (filas) => { cartas.push(...filas); return filas.length },
    crearSetsImpl: async (filas) => { creados.push(...filas); sets.push(...filas.map((f) => ({ ...f, oculto: false }))); return filas.length },
    estadoImpl: async (k) => JSON.parse(JSON.stringify(estados[k] || {})),
    guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
  }
  const r1 = await procesar({ env: ENV, ...b, pausa: async () => {}, ahora: AHORA })
  const dlr = creados.find((s) => s.tcggo_id === 437)
  check('la futura de cero cartas tiene su set: nombre, código, fecha, logo y serie', r1.ok && dlr && dlr.name === 'Delta Reign' && dlr.tcg_online_code === 'DLR' && dlr.release_date === '2026-11-06' && /deltareignlogo/.test(dlr.logo_tcggo) && dlr.serie_id === 'me', JSON.stringify(dlr))
  check('  …ESCONDIDO (sin cartas no va al catálogo)', parches.some((p) => p.ruta.includes(`id=eq.${dlr?.id}`) && p.cuerpo.oculto === true), JSON.stringify(parches))
  check('  …sin pedirle nada a TCGGO (la lista ya lo dice)', urls.every((u) => !/episode_id=437/.test(u)), JSON.stringify(urls))
  check('la vieja de cero cartas (energías de 2023) NO crea nada', creados.length === 1 && r1.esteTurno.find((t) => t.episodio === 20)?.nota === 'vacía', JSON.stringify(r1.esteTurno))
  // Llega el día: la lista de TCGGO ya trae sus cartas, la misma semana.
  estados[CLAVE_PARES].episodios.lista = lista(2)
  const r2 = await procesar({ env: ENV, ...b, pausa: async () => {}, ahora: new Date('2026-10-09T10:00:00Z') })
  const t = r2.esteTurno.find((x) => x.episodio === 437)
  check('con cartas en la lista, vuelve a estar pendiente esa misma semana y sus cartas van a SU set (por el tcggo_id), sin crear otro', t && JSON.stringify(t.sets) === JSON.stringify([dlr.id]) && !t.setNuevo && creados.length === 1 && cartas.some((c) => c.id === 'tcggo-90001' && c.set_id === dlr.id) && !cartas.some((c) => c.id === 'tcggo-51262'), JSON.stringify([t, cartas]))
  check('  …y el set se enseña', parches.some((p) => p.ruta.includes(`id=eq.${dlr.id}`) && p.cuerpo.oculto === false), JSON.stringify(parches))
  check('las listas de expansiones se piden cada día', DIAS_DE_EPISODIOS === 1 && /const DIAS_DE_EPISODIOS = 1/.test(readFileSync(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`, 'utf8')))
  const calco = readFileSync(`${RAIZ}/netlify/functions/tcggo-calco-jp.mjs`, 'utf8')
  check('el calco japonés vuelve a mirar una apuntada vacía cuando su lista ya trae cartas', /nota === 'vacía en TCGGO' && e\.cartas > 0/.test(calco))
}

console.log('\n── 3. El calendario ──')
{
  const filas = [
    { id: 'tcggo-437', name: 'Delta Reign', release_date: '2026-11-06', tcg_online_code: 'DLR', serie_id: 'me', oculto: true, tcggo_id: 437 },
    { id: 'me3', name: 'Héroes Ascendentes', release_date: '2026-01-30', serie_id: 'me', oculto: false, tcggo_id: 400 },
    { id: 'cascaron', name: 'Un cascarón de TCGdex', release_date: '2026-12-01', serie_id: 'x', oculto: true, tcggo_id: null },
  ]
  const ev = eventosDelCatalogo(filas, 'WEST')
  const delta = ev.find((e) => e.id === 'tcggo-437')
  check('la escondida de TCGGO sale; el cascarón escondido sin expansión, no', delta && !ev.some((e) => e.id === 'cascaron') && ev.length === 2, JSON.stringify(ev.map((e) => e.id)))
  check('  …sin enlace (todavía no tiene página)', delta?.href === null)
  const p = partir(ev, '2026-10-08')
  check('  …y es «el siguiente»', p.siguiente?.id === 'tcggo-437', JSON.stringify(p.siguiente))
  const home = readFileSync(`${RAIZ}/js/home.js`, 'utf8')
  const regla = /\(!s\.oculto \|\| s\.tcggo_id\) && s\.release_date/
  check('la portada y «Hoy» cuentan las próximas escondidas de TCGGO, con la misma regla', regla.test(home) && regla.test(readFileSync(`${RAIZ}/js/hoy.js`, 'utf8')))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
