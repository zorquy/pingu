// Tanda 1000 — las promos de Mega Evolution (MEP), de TCGGO y sin borrar nada.
//
// PINGU: «mep black star promos, faltan cartas, te puedes traer la expansión
// desde TCGGO? Faltan promos que ya han salido y sí están en TCGGO». Una
// entrada de `REEMPLAZOS` como la de Black Bolt (lo que casa por número
// conserva su id y su español) pero que no borra lo que TCGGO no lista, y
// que numera las nuevas como las nuestras («016», no «MEP 016»). Y una entrada
// que espera su expansión ya no tapa a las de detrás ni al barrido.
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const R = await import(`${RAIZ}/netlify/functions/tcggo-reemplazar-set.mjs`)

console.log('── 1. La entrada y lo puro ──')
{
  const e = R.REEMPLAZOS.find((x) => x.clave === 'mep-promos')
  check('MEP entra: destino «mep», por número, SIN borrar y con el número como el nuestro, no entero', e && e.destino === 'mep' && e.sets.join() === 'mep' && e.mercado === 'WEST' && !e.entero && e.conservarPorNumero && e.sinBorrar && e.numeroComoElNuestro && !e.numerosDeTcggo, JSON.stringify(e))
  const n = R.numeroComoLosNuestros
  check('«MEP 016» → «016» si los nuestros son de tres cifras; «MEP-7» → «007»', n('MEP 016', ['001', '002']) === '016' && n('MEP-7', ['001']) === '007')
  check('  …un número ya en cifras, tal cual; y si los nuestros llevan letras, el suyo tal cual', n('16', ['001']) === '16' && n('SWSH001', ['SWSH002']) === 'SWSH001' && n('MEP 016', ['SVP001', 'SVP002', '003']) === 'MEP 016')
}

const montar = ({ cartas, lineas = [], sets }) => {
  const guardadas = []
  const llamadas = []
  const db = { cartas: cartas.map((c) => ({ ...c })), lineas: lineas.map((l) => ({ ...l })), sets: sets.map((s) => ({ ...s })) }
  return {
    guardadas, llamadas, db,
    restImpl: async (ruta, opciones = null) => {
      const r = decodeURIComponent(ruta)
      llamadas.push({ ruta: r, metodo: opciones?.method || 'GET', cuerpo: opciones?.body ? JSON.parse(opciones.body) : null })
      const ids = (k) => ((r.match(new RegExp(`${k}=in\\.\\(([^)]*)\\)`)) || [])[1] || '').split(',').map((x) => x.replace(/"/g, '')).filter(Boolean)
      if (!opciones || !opciones.method || opciones.method === 'GET') {
        if (r.startsWith('tcg_sets?')) return db.sets.filter((s) => ids('id').includes(s.id))
        if (r.startsWith('tcg_cards?') && ids('set_id').length) return db.cartas.filter((c) => ids('set_id').includes(c.set_id))
        if (r.startsWith('tcg_cards?')) return db.cartas.filter((c) => ids('id').includes(c.id))
        if (r.startsWith('user_collection?')) return db.lineas.filter((l) => ids('card_id').includes(l.card_id))
        return []
      }
      if (opciones.method === 'PATCH' && r.startsWith('tcg_sets?')) Object.assign(db.sets[0], JSON.parse(opciones.body))
      if (opciones.method === 'DELETE' && r.startsWith('tcg_cards?')) db.cartas = db.cartas.filter((c) => !ids('id').includes(c.id))
      if (opciones.method === 'PATCH' && r.startsWith('user_collection?')) throw new Error('no se reapunta nada')
      return null
    },
    guardarCartasImpl: async (filas) => {
      guardadas.push(...filas)
      for (const f of filas) {
        const c = db.cartas.find((x) => x.id === f.id)
        if (c) Object.assign(c, { tcggo_id: f.tcggo_id })
        else db.cartas.push({ id: f.id, set_id: f.set_id, local_id: f.local_id, name: f.name, name_en: f.name_en, tcggo_id: f.tcggo_id })
      }
      return filas.length
    },
  }
}
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }
const tcggo = (suyas) => async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: suyas, paging: { current: 1, total: 1 } }) })
// Nuestras (de TCGdex, en español): las 1-10 y la 12, que TCGGO no lista.
const NUESTRAS = () => [...Array.from({ length: 10 }, (_, i) => i + 1), 12].map((n) => ({ id: `mep-${String(n).padStart(3, '0')}`, set_id: 'mep', local_id: String(n).padStart(3, '0'), name: `Promo ${n} es`, name_en: `Promo ${n}`, tcggo_id: null }))
// Las suyas: 1-10 y tres que nos faltan (14, 15, 16), con su prefijo.
const SUYAS = [...Array.from({ length: 10 }, (_, i) => i + 1), 14, 15, 16].map((n) => ({ id: 90000 + n, name: `Promo ${n}`, card_number: `MEP ${String(n).padStart(3, '0')}`, cardmarket_id: 80000 + n, type: 'singles' }))

console.log('\n── 2. `procesar` con las promos ──')
{
  const b = montar({ sets: [{ id: 'mep', name: 'MEP Black Star Promos' }], cartas: NUESTRAS(), lineas: [{ id: 'l1', card_id: 'mep-012', user_id: 'u1', cantidad: 1 }] })
  const r = await R.procesar({ env: ENV, fetchImpl: tcggo(SUYAS), ...b, sets: ['mep'], destino: 'mep', mercado: 'WEST', episodio: 777, conservarPorNumero: true, sinBorrar: true, numeroComoElNuestro: true, pausa: async () => {} })
  check('sale bien', r.ok, JSON.stringify(r).slice(0, 300))
  const ids = b.db.cartas.map((c) => c.id).sort()
  check('se conservan las 11 nuestras (con su español) y entran las tres que faltaban', ids.length === 14 && ids.includes('mep-012') && ['tcggo-90014', 'tcggo-90015', 'tcggo-90016'].every((x) => ids.includes(x)) && b.db.cartas.find((c) => c.id === 'mep-001').name === 'Promo 1 es', ids.join())
  check('  …casadas por número aunque TCGGO escriba «MEP 001»', r.porNumero === 10 && r.conservadas === 10 && b.db.cartas.find((c) => c.id === 'mep-001').tcggo_id === 90001, JSON.stringify({ porNumero: r.porNumero, conservadas: r.conservadas }))
  check('las nuevas con el número como el nuestro («014»)', ['014', '015', '016'].every((n) => b.db.cartas.some((c) => c.id.startsWith('tcggo-') && c.local_id === n)), JSON.stringify(b.db.cartas.filter((c) => c.id.startsWith('tcggo-'))))
  check('la 12, que TCGGO no lista, NO se borra (ni se reapunta lo de nadie)', r.borradas === 0 && r.fueraDeSuLista === 1 && !b.llamadas.some((l) => l.metodo === 'DELETE'), JSON.stringify({ borradas: r.borradas, fuera: r.fueraDeSuLista }))
  const patch = b.llamadas.find((l) => l.metodo === 'PATCH' && l.ruta.startsWith('tcg_sets?'))
  check('el set queda con su expansión y la cuenta de las dos (13 suyas + la 12)', patch?.cuerpo?.tcggo_id === 777 && patch.cuerpo.card_count_total === 14, JSON.stringify(patch?.cuerpo))
}

console.log('\n── 3. Sin `sinBorrar`, como antes (Black Bolt): lo que no lista se va ──')
{
  const b = montar({ sets: [{ id: 'mep', name: 'MEP' }], cartas: NUESTRAS() })
  const r = await R.procesar({ env: ENV, fetchImpl: tcggo(SUYAS), ...b, sets: ['mep'], destino: 'mep', mercado: 'WEST', episodio: 777, conservarPorNumero: true, pausa: async () => {} })
  check('la 12 se borra y las nuevas llevan el número de TCGGO', r.ok && r.borradas === 1 && !b.db.cartas.some((c) => c.id === 'mep-012') && b.db.cartas.some((c) => c.local_id === 'MEP 014'), JSON.stringify(r).slice(0, 200))
}

console.log('\n── 4. La pasada: lo que espera no tapa nada ──')
{
  const estados = { tcggo_reemplazos: { hechos: Object.fromEntries(R.REEMPLAZOS.filter((x) => x.clave !== 'mep-promos').map((x) => [x.clave, { fecha: 'x' }])), intentos: {} }, tcggo_pares: {} }
  let opciones = null
  const r = await R.pasada({
    env: ENV,
    restImpl: async (ruta) => (/^tcg_sets\?.*id=eq\.mep/.test(ruta) ? [{ id: 'mep', name: 'MEP Black Star Promos', tcggo_id: 777 }] : []),
    estadoImpl: async (k) => estados[k] || {},
    guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
    procesarImpl: async (o) => { opciones = o; return { ok: true, suyas: 13, nuevas: 3, fueraDeSuLista: 1, borradas: 0 } },
  })
  check('MEP, con la expansión de la fila y sus opciones', opciones?.destino === 'mep' && opciones.episodio === 777 && opciones.sinBorrar === true && opciones.numeroComoElNuestro === true && opciones.conservarPorNumero === true && opciones.entero === false, JSON.stringify(opciones))
  check('  …y queda hecho, con lo que se quedó fuera en el resumen', estados.tcggo_reemplazos.hechos['mep-promos']?.resumen?.fueraDeSuLista === 1, JSON.stringify(estados.tcggo_reemplazos.hechos['mep-promos']))

  // Sin expansión conocida: espera, lo apunta, y la de detrás y el barrido siguen.
  const estados2 = { tcggo_reemplazos: { hechos: Object.fromEntries(R.REEMPLAZOS.map((x) => [x.clave, { fecha: 'x' }])), intentos: {} }, tcggo_pares: {} }
  const lista = [{ clave: 'a-espera', sets: ['aa'], destino: 'aa', mercado: 'WEST' }, { clave: 'b-sigue', sets: ['bb'], destino: 'bb', mercado: 'WEST' }]
  let hecha = null
  const r2 = await R.pasada({
    env: ENV, reemplazos: lista,
    restImpl: async (ruta) => (/id=eq\.aa/.test(ruta) ? [{ id: 'aa', name: 'Sin pareja' }] : /id=eq\.bb/.test(ruta) ? [{ id: 'bb', name: 'Con', tcggo_id: 5 }] : []),
    estadoImpl: async (k) => estados2[k] || {},
    guardarEstadoImpl: async (k, v) => { estados2[k] = JSON.parse(JSON.stringify(v)) },
    procesarImpl: async (o) => { hecha = o.destino; return { ok: true, suyas: 1 } },
  })
  check('la que espera no tapa a la de detrás', hecha === 'bb' && r2.clave === 'b-sigue', JSON.stringify({ hecha, clave: r2.clave }))
  check('  …y queda apuntada como esperando, sin gastar un intento', estados2.tcggo_reemplazos.esperando?.[0]?.clave === 'a-espera' && !estados2.tcggo_reemplazos.intentos['a-espera'], JSON.stringify(estados2.tcggo_reemplazos.esperando))
  const r3 = await R.pasada({
    env: ENV, reemplazos: [lista[0]],
    restImpl: async (ruta) => (/id=eq\.aa/.test(ruta) ? [{ id: 'aa', name: 'Sin pareja' }] : []),
    estadoImpl: async (k) => estados2[k] || {},
    guardarEstadoImpl: async (k, v) => { estados2[k] = JSON.parse(JSON.stringify(v)) },
    procesarImpl: async () => { throw new Error('no debería') },
  })
  check('con solo la que espera, la pasada sigue al barrido de huecos (no «esperando» y fuera)', r3.ok && 'huecos' in r3 && r3.esperando?.length === 1 && r3.hecho === false, JSON.stringify(r3).slice(0, 200))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
