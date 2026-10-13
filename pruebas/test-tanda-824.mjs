// Tanda 824 (PO3) — las cartas japonesas que se quedaron en sets escondidos:
// adónde irían, solo como informe (no se toca ninguna colección).
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const f = await import(`${RAIZ}/netlify/functions/jp-lineas-viejas.mjs`)
check('apagado: no reapunta', f.APLICAR === false)
const NUEVOS = [{ id: 'tcggo-1200', name_en: 'Abyss Eye', tcg_online_code: 'M3' }, { id: 'tcggo-900', name_en: 'Expansion Pack', tcg_online_code: 'PMCG1' }, { id: 'tcggo-901', name_en: 'Jungle', tcg_online_code: 'X' }, { id: 'tcggo-902', name_en: 'Jungle', tcg_online_code: 'Y' }]
check('el set nuevo por nombre inglés', f.setNuevoDe({ name_en: 'Abyss Eye' }, NUEVOS)?.set.id === 'tcggo-1200')
check('  …y si no, por código', f.setNuevoDe({ name_en: 'Otro nombre', tcg_online_code: 'pmcg1' }, NUEVOS)?.set.id === 'tcggo-900')
check('  …y dos con el mismo nombre es dudoso, no uno a suertes', JSON.stringify(f.setNuevoDe({ name_en: 'Jungle' }, NUEVOS)) === JSON.stringify({ dudoso: ['tcggo-901', 'tcggo-902'] }))
check('la carta por número («001» es la 1) y solo si es única', f.cartaNuevaDe({ local_id: '001' }, [{ id: 'a', local_id: '1' }, { id: 'b', local_id: '2' }])?.id === 'a' && f.cartaNuevaDe({ local_id: '5' }, [{ id: 'a', local_id: '1' }]) === null)

const escritos = []
const parches = []
const rest = async (ruta, _c, o = null) => {
  const r = decodeURIComponent(ruta)
  if (o?.method === 'POST') { escritos.push(JSON.parse(o.body)[0]); return null }
  if (o?.method === 'PATCH') { parches.push(r); return null }
  if (r.startsWith('scrydex_estado?')) return []
  if (r.includes('oculto=is.true')) return [{ id: 'm3_ja', name_en: 'Abyss Eye' }, { id: 'raro', name_en: 'Nada igual' }]
  if (r.startsWith('tcg_sets?')) return NUEVOS
  if (r.startsWith('user_collection?')) return [{ id: 'l1', card_id: 'm3_ja-001' }, { id: 'l2', card_id: 'm3_ja-099' }, { id: 'l3', card_id: 'raro-1' }, { id: 'l4', card_id: 'tcggo-1200-5' }]
  if (r.startsWith('tcg_cards?') && r.includes('id=in.')) return [{ id: 'm3_ja-001', set_id: 'm3_ja', local_id: '001' }, { id: 'm3_ja-099', set_id: 'm3_ja', local_id: '099' }, { id: 'raro-1', set_id: 'raro', local_id: '1' }, { id: 'tcggo-1200-5', set_id: 'tcggo-1200', local_id: '5' }]
  if (r.startsWith('tcg_cards?') && r.includes('set_id=eq.tcggo-1200')) return [{ id: 'tcggo-1200-1', local_id: '1' }, { id: 'tcggo-1200-5', local_id: '5' }]
  return []
}
const AHORA = new Date('2026-10-14T05:37:00Z')
const r = await f.pasada({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, restImpl: rest, ahora: AHORA })
const e = escritos[0]?.valor
check('cuenta las líneas en sets escondidos (y no la que ya está en uno de TCGGO)', r.huerfanas === 3 && e.huerfanas === 3 && e.lineasJp === 4, JSON.stringify(r))
check('  …casa por número la que tiene pareja', e.porSet.m3_ja.casadas === 1 && e.porSet.m3_ja.ejemplos[0] === 'm3_ja-001 → tcggo-1200-1' && e.porSet.m3_ja.sinCarta[0] === 'm3_ja-099', JSON.stringify(e.porSet.m3_ja))
check('  …y apunta el set que no tiene a dónde ir', e.porSet.raro.destino === null && e.porSet.raro.lineas === 1)
check('NO toca ninguna colección', parches.length === 0)
const otra = await f.pasada({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, restImpl: async (ruta, c, o) => (decodeURIComponent(ruta).startsWith('scrydex_estado?') ? [{ valor: { dia: '2026-10-14' } }] : rest(ruta, c, o)), ahora: AHORA })
check('una vez al día', /ya se miró hoy/.test(otra.saltado || ''))
const mal = await f.ejecutar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, restImpl: async (ruta, c, o) => { if (o?.method === 'POST') { escritos.push(JSON.parse(o.body)[0]); return null } if (decodeURIComponent(ruta).startsWith('scrydex_estado?')) return []; throw new Error('Supabase 500: caída') }, ahora: AHORA })
check('un fallo va al estado, donde /admin lo lee', !mal.ok && /caída/.test(escritos.at(-1)?.valor?.ultimoError?.error || ''))
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
