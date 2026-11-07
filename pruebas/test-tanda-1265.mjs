// Tanda 1265 — una expansión recién salida se mira por sí misma. PINGU: «ha
// salido Dominio Delta pero en PokeDoc no sale el set en Colección». El set
// de Delta Reign se creó escondido (756) y solo volvía a mirarse cuando la
// LISTA de TCGGO (que se pide una vez al día) decía que ya tenía cartas; y si
// al mirarla solo había sobres, se daba por hecha toda la semana. Ahora, en
// sus primeros días, se le piden las cartas directamente cada tres horas como
// mucho, sin fiarse de la cuenta de la lista, y si aún no hay cartas sueltas
// sigue en las vacías.
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const { procesar, CLAVE_ESTADO, esRecienSalida, DIAS_DE_RECIEN, HORAS_ENTRE_MIRADAS } = await import(`${RAIZ}/netlify/functions/tcggo-catalogo.mjs`)
const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)
const { resumirEpisodio } = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)

console.log('── 1. Lo puro ──')
check('recién salida: desde el día que sale y dos semanas', esRecienSalida({ fecha: '2026-11-06' }, new Date('2026-11-06T09:00:00Z')) && esRecienSalida({ fecha: '2026-11-06' }, new Date('2026-11-19T09:00:00Z')) && !esRecienSalida({ fecha: '2026-11-06' }, new Date('2026-11-21T09:00:00Z')) && !esRecienSalida({ fecha: '2026-11-06' }, new Date('2026-11-05T09:00:00Z')) && !esRecienSalida({ fecha: null }, new Date()))
check('  …con sus frenos: 14 días, cada 3 horas', DIAS_DE_RECIEN === 14 && HORAS_ENTRE_MIRADAS === 3)

console.log('── 2. Delta Reign, del anuncio a sus cartas ──')
const DELTA = { id: 437, name: 'Delta Reign', code: 'DLR', released_at: '2026-11-06', cards_total: 0, logo: 'https://images.tcggo.com/x/deltareignlogo.png', series: { name: 'Mega Evolution', slug: 'mega-evolution' } }
const VIEJA = { id: 20, name: 'Scarlet & Violet Energies', code: 'SVE', cards_total: 0, released_at: '2023-03-31' }
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }
const lista = () => [resumirEpisodio(DELTA), resumirEpisodio(VIEJA)]
const estados = { [CLAVE_PARES]: { episodios: { fecha: '2026-11-05T09:00:00Z', lista: lista() }, hechos: {} }, [CLAVE_ESTADO]: { episodiosJp: { fecha: '2026-11-07T00:00:00Z', lista: [] } } }
const sets = [{ id: 'me3', name: 'Héroes Ascendentes', name_en: 'Ascended Heroes', tcg_online_code: 'ASC', serie_id: 'me', tcggo_id: null, oculto: false }]
const parches = []
const creados = []
const cartas = []
let urls = []
let conCartas = false
const b = {
  fetchImpl: async (url) => {
    urls.push(url)
    const u = new URL(url)
    const page = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify({ data, paging: { current: 1, total: 1, per_page: 100 } }) })
    if (u.pathname.endsWith('/episodes')) return page([])
    if (Number(u.searchParams.get('episode_id')) === 437) return page([{ id: 51262, name: 'Delta Reign Booster', type: 'sealed' }, ...(conCartas ? [{ id: 90001, name: 'Ampharos ex', card_number: '1', cardmarket_id: 990001, type: 'singles' }] : [])])
    if (Number(u.searchParams.get('episode_id')) === 20) return page([])
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
const pasada = (iso) => { urls = []; return procesar({ env: ENV, ...b, pausa: async () => {}, ahora: new Date(iso) }) }
const pideDelta = () => urls.some((u) => /episode_id=437/.test(u))
const pideVieja = () => urls.some((u) => /episode_id=20(&|$)/.test(u))
const dlr = () => sets.find((s) => s.tcggo_id === 437)

let r = await pasada('2026-11-05T10:00:00Z')
check('la víspera: su set, escondido, sin pedirle nada a TCGGO', r.ok && dlr() && dlr().oculto === true && !pideDelta(), JSON.stringify(r.esteTurno))
r = await pasada('2026-11-06T12:00:00Z')
check('el día que sale, con la lista diciendo CERO, se le piden sus cartas igual', r.ok && pideDelta(), JSON.stringify(urls))
check('  …solo sobres: sigue escondido, sin cartas, y no se da por hecha', dlr().oculto === true && !cartas.length && estados[CLAVE_ESTADO].vacias.WEST.includes(437), JSON.stringify(estados[CLAVE_ESTADO].vacias))
r = await pasada('2026-11-06T13:00:00Z')
check('una hora después, no se vuelve a pedir (cada tres horas)', r.ok && !pideDelta(), JSON.stringify(urls))
check('  …y la vieja de cero cartas no se pide nunca', !pideVieja())
conCartas = true
r = await pasada('2026-11-06T15:30:00Z')
check('tres horas y pico después, ya con cartas sueltas: entran en SU set, sin crear otro', r.ok && pideDelta() && cartas.some((c) => c.id === 'tcggo-90001' && c.set_id === dlr().id) && !cartas.some((c) => c.id === 'tcggo-51262') && creados.length === 1, JSON.stringify([r.esteTurno, cartas.map((c) => [c.id, c.set_id])]))
check('  …y el set se enseña', dlr().oculto === false && parches.some((p) => p.cuerpo.oculto === false))
check('  …y deja de estar en las vacías', !estados[CLAVE_ESTADO].vacias.WEST.includes(437))
r = await pasada('2026-11-06T19:00:00Z')
check('después ya no se pide más esa semana', r.ok && !pideDelta(), JSON.stringify(urls))

console.log('── 3. La lista dice que hay cartas, pero solo hay sobres ──')
{
  conCartas = false
  estados[CLAVE_PARES].episodios.lista = [resumirEpisodio({ ...DELTA, id: 438, name: 'Otra', code: 'OTR', released_at: '2026-09-01', cards_total: 5 })]
  estados[CLAVE_ESTADO].vacias.WEST.push(438)
  estados[CLAVE_ESTADO].hechos.WEST.push(438)
  const pide438 = () => urls.some((u) => /episode_id=438/.test(u))
  b.fetchImpl = ((f) => async (url) => (/episode_id=438/.test(url) ? (urls.push(url), { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 1, name: 'Booster', type: 'sealed' }], paging: { current: 1, total: 1 } }) }) : f(url)))(b.fetchImpl)
  r = await pasada('2026-11-07T10:00:00Z')
  check('la mira', pide438(), JSON.stringify([urls, r.esteTurno, r.error || r.saltado || null]))
  check('  …y como no hay cartas sueltas sigue en las vacías (antes: hecha toda la semana)', estados[CLAVE_ESTADO].vacias.WEST.includes(438), JSON.stringify(estados[CLAVE_ESTADO].vacias))
  r = await pasada('2026-11-07T11:00:00Z')
  check('  …sin pedirla en cada pasada (cada tres horas)', !pide438())
  r = await pasada('2026-11-07T13:30:00Z')
  check('  …y a las tres horas, otra vez', pide438())
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
