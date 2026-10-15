// Tanda 854 — la Classic Collection de Celebrations, en su set.
//
// PINGU: «en la API de TCGGO solo hay un set, Celebrations, y mezclan la
// Classic con lo normal. Yo las sacaría y las metería en la Classic
// Collection: 25 en un lado y 25 en otro». Tres piezas: `cel25cc` es
// hermano de `cel25` para el catálogo y los precios SIN plegarse en la
// estantería (`HERMANOS_SOLO_DE_CATALOGO`), el reemplazo entero de la 687
// ya no nombra la Classic, y la migración funde las `tcggo-*` de `cel25`
// en su gemela de `cel25cc` por el nombre (y mueve las que no la tengan).
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { setsHermanos, HERMANOS_SOLO_DE_CATALOGO, COLECCIONES_JUNTAS, padreDeColeccion } = await import(`${RAIZ}/js/catalogo-series.js`)
const { REEMPLAZOS } = await import(`${RAIZ}/netlify/functions/tcggo-reemplazar-set.mjs`)
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Hermanos para el catálogo, dos filas en la estantería ──')
{
  const ids = ['cel25', 'cel25cc', 'cel25c', 'cel25x', 'swsh11', 'swsh11tg']
  check('cel25 → cel25cc (y cel25c, el id de Scrydex, por si acaso)', setsHermanos('cel25', ids).join() === 'cel25cc,cel25c', setsHermanos('cel25', ids).join())
  check('  …y no está en COLECCIONES_JUNTAS: la Classic no se pliega en Celebrations', !COLECCIONES_JUNTAS.some((c) => c.padre === 'cel25' || c.hijos?.includes('cel25cc')) && padreDeColeccion('cel25cc') == null)
  check('  …la lista es solo de catálogo', HERMANOS_SOLO_DE_CATALOGO.some((c) => c.padre === 'cel25' && c.hijos.includes('cel25cc')))
  check('los de siempre siguen igual', setsHermanos('swsh11', ids).join() === 'swsh11tg')
}

console.log('── 2. El reemplazo entero ya no toca la Classic ──')
{
  const c = REEMPLAZOS.find((x) => x.clave === 'cel25-entero')
  check('cel25-entero: solo cel25', c && c.sets.join() === 'cel25' && c.destino === 'cel25', JSON.stringify(c))
  check('ningún reemplazo nombra cel25cc', !REEMPLAZOS.some((x) => x.sets.includes('cel25cc') || x.destino === 'cel25cc'))
}

console.log('── 3. La migración ──')
{
  const sql = readFileSync(`${RAIZ}/supabase-migration-celebrations-classic.sql`, 'utf8')
  check('sin tablas temporales (la 631)', !/create temp/i.test(sql))
  check('solo las de TCGGO de cel25 (las de siempre son cel25-N)', /t\.set_id = 'cel25' and t\.id like 'tcggo-%'/.test(sql))
  check('gemela por el nombre inglés, único en los dos lados', /lower\(coalesce\(g\.name_en, g\.name\)\) = lower\(coalesce\(t\.name_en, t\.name\)\)/.test(sql) && /g2\.set_id = 'cel25cc'/.test(sql) && /t2\.set_id = 'cel25'/.test(sql))
  for (const t of ['user_collection', 'user_wants', 'user_albums', 'user_price_alerts', 'user_showcase', 'tcg_card_versions', 'tcg_card_prices', 'tcg_card_history', 'carta_del_dia', 'mas_caro_del_dia', 'collection_folder_cards']) {
    check(`  …mueve ${t}`, new RegExp(`(update|delete from) public\\.${t}\\b`).test(sql))
  }
  check('la gemela se queda con el id de TCGGO y el de Cardmarket', /tcggo_id = coalesce\(g\.tcggo_id, r\.tcggo_id\)/.test(sql) && /cm_id_product_propio = coalesce/.test(sql))
  check('lo que no tiene gemela se mueve a cel25cc tal cual, sin borrar', /update public\.tcg_cards set set_id = 'cel25cc' where market = 'WEST' and set_id = 'cel25' and id like 'tcggo-%'/.test(sql) && !/delete from public\.tcg_cards where id = r\.id_gemela/.test(sql))
  check('y comprueba 25 y 25 al final', /group by set_id/.test(sql))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
