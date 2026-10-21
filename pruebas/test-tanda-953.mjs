// Tanda 953 — el Serperior de Nihil Zero (R, japonés de 2026) salía
// «Normal» en la ficha abierta desde la expansión: la regla de la 950 mira
// el día del set, y las cartas de una expansión (`cartasDeSet`) no lo pedían.
// Una columna que no se pide llega `undefined` (la 523). Se vigila que toda
// lista de columnas de Mi colección que embebe el set pida `release_date`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
for (const f of ['js/mi-coleccion/datos.js', 'js/mi-coleccion.js']) {
  const src = readFileSync(join(RAIZ, f), 'utf8')
  const listas = [...src.matchAll(/'[^'\n]*\brarity\b[^'\n]*tcg_sets\(([^)]*)\)[^'\n]*'/g)]
  check(`${f}: hay listas de columnas con el set embebido`, listas.length > 0)
  for (const m of listas) check(`  …y piden release_date: tcg_sets(${m[1]})`, /\brelease_date\b/.test(m[1]))
}
const { brillaDeSerie, variantesDeCarta } = await import(join(RAIZ, 'js/mi-coleccion/variantes.js'))
const serperior = { id: 'tcggo-1', market: 'JP', set_id: 'm3_ja', rarity: 'Rare', variants: null, tcg_sets: { tcg_online_code: 'M3', serie_id: 'me', release_date: '2026-01-23' } }
check('una R japonesa con la fila como la da cartasDeSet brilla de serie', brillaDeSerie(serperior))
const vs = (c, ...a) => variantesDeCarta(c, ...a).map((v) => v.nuestro).join()
const mirada = { ...serperior, versiones: [{ etiqueta: 'Standard', origen: null }] }
check('  …y su versión es «Holo», no «Normal» (con la fila Standard de TCGGO)', vs(mirada) === 'holo', vs(mirada))
check('  …y también sin saber nada de ella', vs(serperior) === 'holo', vs(serperior))
check('  …pero las cuatro de «no se sabe» se quedan las cuatro', vs(serperior, ['a', 'b', 'c', 'd'].map((x) => ({ nuestro: x }))) === 'a,b,c,d')
check('sin el día del set (como llegaba antes) no se puede saber: «Normal»', vs({ ...mirada, tcg_sets: { tcg_online_code: 'M3' } }) === 'normal')
check('una R de antes de Sol y Luna sigue sin brillar', !brillaDeSerie({ ...serperior, tcg_sets: { release_date: '2015-05-01' } }))
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
