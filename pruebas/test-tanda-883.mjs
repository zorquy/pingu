// Tanda 883 — los decks japoneses, de Scrydex, mientras dure la suscripción.
//
// Un Dark Dragonite 014/020 (2004) de un deck: TCGGO no tiene los decks
// japoneses y TCGdex tampoco. PINGU: «mete de Scrydex, que sigue activa la
// sub este mes». `scrydex-decks-jp` enseña lo escondido que vino de
// Scrydex y TCGGO no tiene (gratis) y trae de Scrydex lo que falta (con
// tope de créditos y parada definitiva al 402); el calco no lo esconde y,
// si TCGGO trae la expansión, la vuelca encima.
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const decks = await import(`${RAIZ}/netlify/functions/scrydex-decks-jp.mjs`)
const calco = await import(`${RAIZ}/netlify/functions/tcggo-calco-jp.mjs`)
const copia = (x) => JSON.parse(JSON.stringify(x))

const EPIS = [
  { id: 913, nombre: 'VSTAR Universe', codigo: 'S12a', fecha: '2022-12-02', cartas: 262, impresas: 172 },
  { id: 1200, nombre: 'Abyss Eye', codigo: 'M3', fecha: '2026-01-23', cartas: 110 },
]
const SILVER = { id: 'rocket_silver_ja', name: 'ロケット団シルバーデッキ', name_en: 'Rocket Gang Silver Deck', tcg_online_code: null, tcggo_id: null, scrydex_id: 'rocket_silver_ja', oculto: true, release_date: '2004-06-01', card_count_total: 20 }
const SETS = [
  { id: 's12a', name: 'VSTARユニバース', name_en: 'VSTAR Universe', tcg_online_code: 'S12a', tcggo_id: 913, scrydex_id: 's12a_ja', oculto: false, release_date: '2022-12-02', card_count_total: 262 },
  SILVER,
  // Escondido, de Scrydex, pero TCGGO lo tiene: se queda escondido.
  { id: 'm3_ja', name: 'アビスアイ', name_en: 'Abyss Eye', tcg_online_code: null, tcggo_id: null, scrydex_id: 'm3_ja', oculto: true, release_date: '2026-01-23', card_count_total: 110 },
  // Escondido, de Scrydex, sin cartas dentro: no se enseña un cascarón.
  { id: 'vacio_ja', name: '空', name_en: 'Empty Deck', tcg_online_code: null, tcggo_id: null, scrydex_id: 'vacio_ja', oculto: true, release_date: '2004-01-01', card_count_total: 10 },
]
const EXPANSIONES = [
  { id: 's12a_ja', name: 'VSTARユニバース', translation: { en: { name: 'VSTAR Universe' } }, code: 'S12a', total: 262, printed_total: 172, release_date: '2022/12/02', series: 'Sword & Shield' },
  { id: 'rocket_silver_ja', name: 'ロケット団シルバーデッキ', translation: { en: { name: 'Rocket Gang Silver Deck' } }, code: null, total: 20, printed_total: 20, release_date: '2004/06/01', series: 'EX' },
  { id: 'rocket_gold_ja', name: 'ロケット団ゴールドデッキ', translation: { en: { name: 'Rocket Gang Gold Deck' } }, code: null, total: 20, printed_total: 20, release_date: '2004/06/01', series: 'EX', logo: 'https://images.scrydex.com/pokemon/rocket_gold_ja-logo/logo' },
  // Cero cartas en Scrydex: no se crea nada por nada.
  { id: 'nada_ja', name: 'なし', translation: { en: { name: 'Nothing' } }, total: 0, release_date: '2004/02/01' },
]
const CARTAS_GOLD = [
  { id: 'rocket_gold_ja-14', name: 'わるいカイリュー', number: '14', printed_number: '014/020', translation: { en: { name: 'Dark Dragonite', supertype: 'Pokémon', subtypes: ['Stage 2'], types: ['Colorless'], rarity: 'Rare Holo' } }, national_pokedex_numbers: [149], rarity: 'キラ', artist: 'Ken Sugimori', hp: '120', images: [{ type: 'front', small: 'https://images.scrydex.com/pokemon/rocket_gold_ja-14/small', large: 'https://images.scrydex.com/pokemon/rocket_gold_ja-14/large' }] },
  { id: 'rocket_gold_ja-1', name: 'ワンリキー', number: '1', translation: { en: { name: 'Machop', supertype: 'Pokémon', subtypes: ['Basic'], types: ['Fighting'], rarity: 'Common' } }, national_pokedex_numbers: [66], artist: 'Ken Sugimori', hp: '50' },
]

console.log('── 1. Lo puro ──')
{
  const { laTieneTcggo, setsEscondidosQueVolver, expansionesQueFaltan, filaDeSetDeScrydex } = decks
  check('TCGGO tiene VSTAR Universe: por código', laTieneTcggo({ code: 's12a', translation: { en: { name: 'Otro' } } }, EPIS))
  check('  …por nombre inglés', laTieneTcggo({ name: 'アビスアイ', translation: { en: { name: 'Abyss Eye' } } }, EPIS) && laTieneTcggo({ name_en: 'VSTAR Universe' }, EPIS))
  check('  …y por el día de salida con la misma cuenta', laTieneTcggo({ name: 'x', release_date: '2022/12/02', total: 262 }, EPIS) && !laTieneTcggo({ name: 'x', release_date: '2022/12/02', total: 20 }, EPIS))
  check('un deck de 2004, no', !laTieneTcggo(EXPANSIONES[1], EPIS) && !laTieneTcggo(SILVER, EPIS))
  check('los escondidos que vuelven: el Silver Deck (de Scrydex, sin TCGGO); Abyss Eye no (TCGGO lo tiene); s12a no (a la vista)', setsEscondidosQueVolver(SETS, EPIS).map((s) => s.id).sort().join() === 'rocket_silver_ja,vacio_ja')
  check('  …y uno ya conservado no se vuelve a mirar', setsEscondidosQueVolver(SETS, EPIS, { rocket_silver_ja: {} }).map((s) => s.id).join() === 'vacio_ja')
  const faltan = expansionesQueFaltan(EXPANSIONES, SETS, EPIS)
  check('lo que falta de Scrydex: solo el Gold Deck (el Silver ya es nuestro, VSTAR es de TCGGO, «Nothing» tiene cero)', faltan.map((e) => e.id).join() === 'rocket_gold_ja', faltan.map((e) => e.id).join())
  check('  …y un creado no se repite', expansionesQueFaltan(EXPANSIONES, SETS, EPIS, { rocket_gold_ja: { estado: 'creado' } }).length === 0)
  const fila = filaDeSetDeScrydex(EXPANSIONES[2], 'JP', SETS)
  check('la fila del set nuevo: su id, a la vista, con fecha, cuentas, logo y «decks»', fila.id === 'rocket_gold_ja' && fila.market === 'JP' && fila.oculto === false && fila.scrydex_por === 'decks' && fila.release_date === '2004-06-01' && fila.card_count_total === 20 && fila.logo_scrydex && fila.name_en === 'Rocket Gang Gold Deck', JSON.stringify(fila))
}

console.log('\n── 2. La pasada: enseña el Silver, crea el Gold, cuenta créditos ──')
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't' }
function montar({ estado = {}, calcoEstado = { lista: { fecha: '2026-10-18T06:00:00Z', episodios: EPIS } }, scrydexStatus = 200, sets = SETS } = {}) {
  const estados = { [decks.CLAVE_ESTADO]: copia(estado), [decks.CLAVE_CALCO]: copia(calcoEstado) }
  const llamadas = []
  const fetches = []
  const b = {
    env: ENV,
    estadoImpl: async (k) => copia(estados[k] || {}),
    guardarEstadoImpl: async (k, v) => { estados[k] = copia(v) },
    restImpl: async (ruta, opciones = null) => {
      llamadas.push({ ruta: decodeURIComponent(ruta), metodo: opciones?.method || 'GET', cuerpo: opciones?.body ? JSON.parse(opciones.body) : null })
      if (opciones) return null
      if (ruta.startsWith('tcg_sets?')) return copia(sets)
      if (ruta.startsWith('tcg_cards?') && ruta.includes('set_id=eq.vacio_ja')) return []
      if (ruta.startsWith('tcg_cards?')) return [{ id: 'una' }]
      return []
    },
    fetchImpl: async (url) => {
      fetches.push(url)
      if (scrydexStatus !== 200) return { ok: false, status: scrydexStatus, text: async () => 'Payment Required' }
      const u = new URL(url)
      let data = []
      if (u.pathname.endsWith('/ja/expansions')) data = EXPANSIONES
      else if (u.pathname.endsWith('/ja/cards') && u.searchParams.get('q') === 'expansion.id:rocket_gold_ja') data = CARTAS_GOLD
      return { ok: true, status: 200, text: async () => JSON.stringify({ data, page: 1, page_size: 100, total_count: data.length }) }
    },
    pausa: async () => {},
    ahora: new Date('2026-10-18T12:00:00Z'),
  }
  return { b, estados, llamadas, fetches, e: () => estados[decks.CLAVE_ESTADO] }
}
{
  const m = montar()
  const r = await decks.pasada(m.b)
  check('ok, y el Silver Deck vuelve a la vista', r.ok && r.vueltos.join() === 'rocket_silver_ja', JSON.stringify(r))
  const ensenados = m.llamadas.filter((l) => l.metodo === 'PATCH' && l.cuerpo?.oculto === false && l.ruta.startsWith('tcg_sets?')).map((l) => l.ruta.match(/id=eq\.([^&]+)/)[1])
  check('  …con un PATCH solo a él (Abyss Eye sigue escondido; el vacío, ni se enseña)', ensenados.includes('rocket_silver_ja') && !ensenados.includes('m3_ja') && !ensenados.includes('vacio_ja'), ensenados.join())
  check('  …y el vacío queda apuntado como tal', m.e().revisados.vacio_ja?.estado === 'vacio' && m.e().revisados.rocket_silver_ja?.estado === 'vuelto')
  check('pide a Scrydex su lista y las cartas del Gold: dos créditos', m.fetches.length === 2 && /ja\/expansions/.test(m.fetches[0]) && /ja\/cards\?q=expansion\.id%3Arocket_gold_ja/.test(m.fetches[1]) && m.e().gasto.creditos === 2, m.fetches.join(' | '))
  check('  …sin pedir precios (include=prices no hace falta para un deck)', !m.fetches.some((u) => /include=/.test(u)))
  const setNuevo = m.llamadas.find((l) => l.metodo === 'POST' && l.ruta === 'tcg_sets')
  check('crea el set del Gold Deck a la vista', setNuevo?.cuerpo?.[0]?.id === 'rocket_gold_ja' && setNuevo.cuerpo[0].oculto === false && setNuevo.cuerpo[0].market === 'JP', JSON.stringify(setNuevo?.cuerpo))
  const cartas = m.llamadas.find((l) => l.metodo === 'POST' && l.ruta.startsWith('tcg_cards?on_conflict=id,market'))?.cuerpo || []
  const drag = cartas.find((c) => c.local_id === '14')
  check('  …y sus dos cartas, con el id de Scrydex, el nombre japonés, el inglés, la foto y la Pokédex', cartas.length === 2 && drag?.id === 'scrydex-rocket_gold_ja-14' && drag.set_id === 'rocket_gold_ja' && drag.market === 'JP' && drag.name === 'わるいカイリュー' && drag.name_en === 'Dark Dragonite' && /rocket_gold_ja-14/.test(drag.image_scrydex || '') && drag.origen === 'scrydex', JSON.stringify(drag))
  check('  …ninguna columna obligatoria a null (local_id, name, set_id)', cartas.every((c) => c.local_id && c.name && c.set_id))
  const parche = m.llamadas.find((l) => l.metodo === 'PATCH' && l.ruta.includes('id=eq.rocket_gold_ja'))
  check('  …y el set queda apuntado a su expansión y a «decks»', parche?.cuerpo?.scrydex_id === 'rocket_gold_ja' && parche.cuerpo.scrydex_por === 'decks' && parche.cuerpo.oculto === false, JSON.stringify(parche?.cuerpo))
  check('los dos quedan conservados (el calco los respeta)', m.e().conservados.rocket_silver_ja?.por === 'vuelto' && m.e().conservados.rocket_gold_ja?.por === 'creado' && m.e().conservados.rocket_gold_ja.cartas === 2, JSON.stringify(m.e().conservados))
  check('«Nothing» (cero cartas) no se crea', !m.llamadas.some((l) => l.metodo === 'POST' && l.cuerpo?.[0]?.id === 'nada_ja') && r.creadas.length === 1)
  // Segunda pasada: la lista es de hoy y no falta nada.
  const antes = m.fetches.length
  const r2 = await decks.pasada({ ...m.b, restImpl: async (ruta, o) => m.b.restImpl(ruta, o).then((x) => (ruta.startsWith('tcg_sets?') ? [...SETS.map((s) => (s.id === 'rocket_silver_ja' ? { ...s, oculto: false } : s)), { id: 'rocket_gold_ja', scrydex_id: 'rocket_gold_ja', tcggo_id: null, oculto: false, name_en: 'Rocket Gang Gold Deck' }] : x)) })
  check('la segunda pasada no pide nada (lista de hoy, nada que crear) y dice «hecho»', r2.ok && r2.hecho === true && m.fetches.length === antes && r2.creadas.length === 0 && r2.vueltos.length === 0, JSON.stringify(r2))
}

console.log('\n── 3. Los frenos: el 402 para del todo; el tope de créditos ──')
{
  const m = montar({ scrydexStatus: 402 })
  const r = await decks.pasada(m.b)
  check('un 402 (la suscripción se acabó): la pasada falla y queda PARADA', r.ok === false && /402/.test(r.error) && m.e().parado?.motivo && /suscripci/.test(m.e().parado.motivo), JSON.stringify(m.e().parado))
  check('  …sin crear nada', !m.llamadas.some((l) => l.metodo === 'POST'))
  const r2 = await decks.pasada(m.b)
  check('  …y la siguiente se salta sin gastar (la quita un humano)', r2.saltado && /parado/.test(r2.saltado) && m.fetches.length === 1, JSON.stringify(r2))
  // Lo gratis (fase A) sí corrió antes de parar.
  check('  …pero lo gratis (enseñar el Silver) se hizo igual', m.e().conservados.rocket_silver_ja?.por === 'vuelto')
  const t = montar({ estado: { gasto: { creditos: decks.TOPE_CREDITOS }, conservados: { rocket_silver_ja: { por: 'vuelto' } }, revisados: { vacio_ja: { estado: 'vacio' } } } })
  const r3 = await decks.pasada(t.b)
  check('con el tope gastado no se pide nada y lo dice', r3.ok && /tope/.test(r3.saltado) && t.fetches.length === 0, JSON.stringify(r3))
  const s = montar({ calcoEstado: {} })
  const r4 = await decks.pasada(s.b)
  check('sin la lista de TCGGO no se sabe qué falta: se salta', r4.saltado && /TCGGO/.test(r4.saltado) && s.fetches.length === 0)
  const sin = await decks.pasada({ ...montar().b, env: { SUPABASE_SERVICE_ROLE_KEY: 's' } })
  check('sin las claves de Scrydex, se salta y dice cuáles', /SCRYDEX_API_KEY/.test(sin.saltado))
}

console.log('\n── 4. El calco japonés respeta los conservados ──')
{
  const EPIS_CALCO = [{ id: 5000, nombre: 'Rocket Gang Silver Deck', codigo: null, cartas: 20, fecha: '2004-06-01' }]
  const SETS_CALCO = [{ ...SILVER, oculto: false }, { id: 'otro_ja', name: 'otro', name_en: 'Otro', tcg_online_code: null, tcggo_id: null, oculto: false }]
  const estados = {
    [calco.CLAVE_ESTADO]: { vuelta: 3, hechos: {}, lista: { fecha: '2026-10-18T06:00:00Z', episodios: EPIS_CALCO }, limpieza: { hecha: true } },
    [calco.CLAVE_DECKS]: { conservados: { rocket_silver_ja: { por: 'vuelto' } } },
  }
  const hechas = []
  const rutas = []
  const parches = []
  const b = {
    fetchImpl: async () => { throw new Error('la lista es de hoy: no se pide') },
    restImpl: async (ruta, opciones = null) => {
      rutas.push(decodeURIComponent(ruta))
      if (opciones?.method === 'PATCH') { parches.push({ ruta: decodeURIComponent(ruta), cuerpo: JSON.parse(opciones.body) }); return [] }
      if (ruta.startsWith('tcg_sets?')) {
        // El doble aplica el `id=not.in.(…)` como lo haría PostgREST.
        const fuera = (decodeURIComponent(ruta).match(/id=not\.in\.\(([^)]*)\)/)?.[1] || '').split(',').map((x) => x.replace(/"/g, '')).filter(Boolean)
        const conId = /tcggo_id=not\.is\.null/.test(ruta)
        return copia(SETS_CALCO.filter((s) => !fuera.includes(s.id) && (!conId || s.tcggo_id != null)))
      }
      return []
    },
    estadoImpl: async (k) => copia(estados[k] || {}),
    guardarEstadoImpl: async (k, v) => { estados[k] = copia(v) },
    crearSetsImpl: async (f) => f.length,
    procesarImpl: async (o) => { hechas.push(o); return { ok: true, suyas: 20, escritas: 20, borradas: 0, seQuedan: [] } },
  }
  const pasar = () => calco.pasada({ env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k' }, ...b, ahora: new Date('2026-10-18T12:00:00Z'), pausa: async () => {}, vuelta: 3 })
  await pasar()
  check('TCGGO trae por fin el Silver Deck: el destino es NUESTRO set conservado (no uno nuevo), entera y por número', hechas[0]?.destino === 'rocket_silver_ja' && hechas[0].entero === true && hechas[0].recolocarPorNumero === true && hechas[0].episodio === 5000, JSON.stringify(hechas[0] && { d: hechas[0].destino, e: hechas[0].entero }))
  check('  …apuntado como «conservado»', /^conservado/.test(estados[calco.CLAVE_ESTADO].hechos[5000]?.por || ''), estados[calco.CLAVE_ESTADO].hechos[5000]?.por)
  await pasar()
  const consulta = rutas.find((r) => /tcggo_id=is\.null&oculto=is\.false/.test(r) && /order=id/.test(r))
  check('al esconder lo que no tiene tcggo_id, la consulta deja fuera a los conservados', consulta && /id=not\.in\.\("rocket_silver_ja"\)/.test(consulta), consulta)
  const ocultos = parches.filter((p) => p.cuerpo.oculto === true).map((p) => p.ruta.match(/id=eq\.([^&]+)/)[1])
  check('  …y lo que no es conservado se esconde como siempre', ocultos.includes('otro_ja') && !ocultos.includes('rocket_silver_ja'), ocultos.join())
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
