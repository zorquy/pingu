// Tanda 810 — el catálogo japonés, sustituido entero por el de TCGGO.
//
// PINGU: «simplemente trae los sets de TCGGO, sustituye todo lo que haya en
// el catálogo japonés por lo que traes de TCGGO». La vuelta 3 del calco,
// SIN CASAR:
//   1. Al empezar, se esconden TODOS los sets japoneses sin `tcggo_id`.
//   2. El destino de cada expansión es el set con su `tcggo_id` o uno nuevo:
//      nunca uno que «se parezca» por nombre, código o huella.
//   3. El set se rotula con lo de TCGGO.
//   4. Al final, lo que lleve un `tcggo_id` que ya no está en su lista, fuera.
//   5. Varias expansiones por ejecución.
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const calco = await import(`${RAIZ}/netlify/functions/tcggo-calco-jp.mjs`)
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k' }

const EPIS = [
  { id: 1200, name: 'Abyss Eye', code: 'M3', cards_total: 110, cards_printed_total: 80, released_at: '2026-01-23', logo: 'https://images.tcggo.com/m3.png' },
  { id: 900, name: 'Expansion Pack', code: 'PMCG1', cards_total: 102, released_at: '1996-10-20' },
  { id: 950, name: 'Jungle', code: 'PMCG2', cards_total: 48, released_at: '1997-03-05' },
]
const montar = () => {
  // Abyss Eye la casó la vuelta 2 con el set de Scrydex (lleva su tcggo_id
  // pero su nombre y su logo); Jungle tiene un set de Scrydex con el MISMO
  // nombre y sin tcggo_id (la vuelta 2 lo habría usado); y hay uno con un
  // tcggo_id que TCGGO ya no tiene.
  const sets = [
    { id: 'm3_ja', name: 'アビスアイ', name_en: null, tcg_online_code: null, tcggo_id: 1200, oculto: false },
    { id: 'base1_ja', name: '拡張パック', name_en: 'Expansion Pack', tcg_online_code: 'PMCG1', tcggo_id: null, oculto: false },
    { id: 'base2_ja', name: 'ジャングル', name_en: 'Jungle', tcg_online_code: 'PMCG2', tcggo_id: null, oculto: false },
    { id: 'viejo_ja', name: 'Viejo', name_en: 'Viejo', tcggo_id: 7777, oculto: false },
  ]
  const estados = { [calco.CLAVE_ESTADO]: { vuelta: 2, hechos: { 1200: { set: 'm3_ja' } }, lista: { fecha: '2026-10-13T00:00:00Z', episodios: [] } } }
  const hechas = []
  const parches = []
  const creados = []
  const b = {
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: EPIS, paging: { current: 1, total: 1 } }) }),
    restImpl: async (ruta, opciones = null) => {
      const r = decodeURIComponent(ruta)
      if (opciones?.method === 'PATCH') {
        const cuerpo = JSON.parse(opciones.body)
        parches.push({ ruta: r, cuerpo })
        // El PATCH en bloque: todos los sin tcggo_id que se ven.
        if (/tcggo_id=is\.null&oculto=is\.false/.test(r)) {
          const tocados = sets.filter((s) => s.tcggo_id == null && !s.oculto)
          for (const s of tocados) Object.assign(s, cuerpo)
          return tocados.map((s) => ({ id: s.id, name: s.name, name_en: s.name_en }))
        }
        const id = (r.match(/id=eq\.([^&]+)/) || [])[1]
        const s = sets.find((x) => x.id === id)
        if (s) Object.assign(s, cuerpo)
        return null
      }
      if (/tcggo_id=not\.is\.null&oculto=is\.false/.test(r)) return sets.filter((s) => s.tcggo_id != null && !s.oculto)
      if (/tcggo_id=is\.null&oculto=is\.false/.test(r)) return sets.filter((s) => s.tcggo_id == null && !s.oculto)
      if (r.startsWith('tcg_sets?')) return sets
      return []
    },
    estadoImpl: async (k) => JSON.parse(JSON.stringify(estados[k] || {})),
    guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
    crearSetsImpl: async (filas) => { creados.push(...filas); for (const f of filas) sets.push({ ...f, oculto: false }); return filas.length },
    procesarImpl: async (o) => { hechas.push(o); const d = sets.find((s) => s.id === o.destino); if (d) d.tcggo_id = o.episodio; return { ok: true, suyas: 10, escritas: 10, borradas: 0, seQuedan: [] } },
  }
  return { sets, estados, hechas, parches, creados, b }
}

console.log('── La vuelta 3, sin casar ──')
{
  check('la vuelta en curso es sin casar (3 o más)', calco.VUELTA >= 3)
  const m = montar()
  const pasar = (ahora = '2026-10-13T20:00:00Z') => calco.pasada({ env: ENV, ...m.b, ahora: new Date(ahora), pausa: async () => {} })
  const e = () => m.estados[calco.CLAVE_ESTADO]
  await pasar()
  check('al empezar se esconden TODOS los japoneses sin tcggo_id, de una vez', m.sets.find((s) => s.id === 'base1_ja').oculto && m.sets.find((s) => s.id === 'base2_ja').oculto && e().limpieza?.escondidos === 2, JSON.stringify(e().limpieza))
  check('  …y la primera es Abyss Eye, ENTERA, en el set que ya lleva su tcggo_id', m.hechas[0]?.episodio === 1200 && m.hechas[0]?.destino === 'm3_ja' && m.hechas[0]?.entero === true, JSON.stringify(m.hechas[0] && { e: m.hechas[0].episodio, d: m.hechas[0].destino }))
  check('  …sin comprobar «si es la misma» (la fuente es TCGGO)', m.hechas[0]?.comprobarQueEsLaMisma === false)
  const m3 = m.sets.find((s) => s.id === 'm3_ja')
  check('  …y el set queda rotulado como TCGGO: nombre, logo, código, fecha y cuentas', m3.name === 'Abyss Eye' && m3.name_en === 'Abyss Eye' && m3.logo_tcggo === 'https://images.tcggo.com/m3.png' && m3.tcg_online_code === 'M3' && m3.release_date === '2026-01-23' && m3.card_count_total === 110 && m3.card_count_official === 80, JSON.stringify(m3))
  await pasar()
  await pasar()
  const jungla = m.hechas.find((h) => h.episodio === 950)
  check('Jungle NO va al set de Scrydex que se llama igual: se crea uno nuevo de TCGGO', jungla && jungla.destino !== 'base2_ja' && m.creados.some((c) => c.id === jungla.destino && c.tcggo_id === 950), JSON.stringify(jungla && jungla.destino))
  check('  …y el viejo se queda escondido (no se borra: puede tener cartas de alguien)', m.sets.find((s) => s.id === 'base2_ja').oculto === true)
  await pasar()
  await pasar()
  check('al final, lo que lleva un tcggo_id que TCGGO ya no tiene, escondido', m.sets.find((s) => s.id === 'viejo_ja').oculto === true && /ya no está en TCGGO/.test(e().escondidosAlFinal.viejo_ja?.por || ''), JSON.stringify(e().escondidosAlFinal.viejo_ja))
  check('  …y lo de TCGGO, a la vista', m.sets.filter((s) => !s.oculto).every((s) => [1200, 900, 950].includes(Number(s.tcggo_id))), JSON.stringify(m.sets.filter((s) => !s.oculto).map((s) => [s.id, s.tcggo_id])))
}

console.log('\n── Varias por ejecución ──')
{
  let n = 0
  let t = 0
  const r = await calco.ejecucion({ pasadaImpl: async () => { n++; t += 3000; return { ok: true, hecha: { episodio: n } } }, reloj: () => t })
  check(`hasta ${calco.POR_EJECUCION} expansiones en una ejecución`, n === calco.POR_EJECUCION && r.enEstaEjecucion === n, n)
  n = 0; t = 0
  await calco.ejecucion({ pasadaImpl: async () => { n++; t += 11_000; return { ok: true, hecha: {} } }, reloj: () => t })
  check('  …pero si una tarda, no se empieza otra (Netlify corta a los 30 s)', n === 1, n)
  n = 0
  await calco.ejecucion({ pasadaImpl: async () => { n++; return { ok: false, error: 'x' } } })
  check('  …y un fallo para la ejecución', n === 1)
  n = 0
  await calco.ejecucion({ pasadaImpl: async () => { n++; return { ok: true, hecho: true } } })
  check('  …igual que no tener nada que hacer', n === 1)
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
