// Tanda 652 — las cartas de la Classic del 30 aniversario, dos veces.
//
// PINGU, en el móvil: «en el 30 aniversario hay cartas que se enseñan mal:
// dice Charizard, que debería ser el de la Classic, pero sale un
// Exeggcute». TCGGO mete la Classic dentro del 30 aniversario con los
// números de la carta original; TCGdex la numera 001–030. Por número no
// casó ninguna, así que el catálogo las creó por segunda vez, y las
// nuestras —sin foto— caían a Limitless por código + número: «30C» y
// «001» es el Exeggcute. Lo arreglan el paso por NOMBRE del catálogo (que
// prueban la 588 y la 640) y la migración que funde los duplicados.
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. El catálogo casa por nombre lo que el número no casa ──')
{
  const lib = leer('netlify/lib/tcggo.mjs')
  const i = lib.indexOf('export function emparejarPorNumero')
  const cuerpo = lib.slice(i, lib.indexOf('// Lo que queda, con el motivo.', i))
  check('el paso por nombre existe y va DESPUÉS de tcgid, número y dígitos', /'tcgid'[\s\S]*'numero'[\s\S]*'digitos'[\s\S]*'nombre'/.test(cuerpo))
  check('  …solo cuando el nombre es único en los DOS lados', /candidatas\.length !== 1 \|\| nuestrasPorNombre\.get\(n\) !== 1/.test(cuerpo))
  check('  …comparando nuestro name_en (y name si no hay) con el suyo', /nombreComparable\(c\.name_en \|\| c\.name\)/.test(cuerpo) && /nombreComparable\(s\.name\)/.test(cuerpo))
  check('y el catálogo pide name_en en la consulta de las nuestras', /select=id,set_id,local_id,name,name_en,cm_id_product_propio,tcggo_id/.test(leer('netlify/functions/tcggo-catalogo.mjs')))
}

console.log('\n── 2. La migración que funde los duplicados ──')
{
  const sql = leer('supabase-migration-30-aniversario-duplicados.sql')
  check('va con una vista previa ANTES del bloque que escribe', sql.indexOf('-- ── 1. Vista previa') < sql.indexOf('do $$'))
  check('funde solo con nombre único en los dos lados (las dos guardas «= 1»)', (sql.match(/\) = 1/g) || []).length >= 4)
  check('la nuestra conserva su id y gana con coalesce (no pisa lo que tenía)', /image_tcggo = coalesce\(image_tcggo, r\.image_tcggo\)/.test(sql) && /cm_id_product_propio = coalesce\(cm_id_product_propio, r\.cm_id_product_propio\)/.test(sql) && /tcggo_id = coalesce\(tcggo_id, r\.tcggo_id\)/.test(sql))
  check('mueve la colección (sumando copias si ya había una igual), los deseos, los álbumes, los precios y el histórico', /update public\.user_collection set card_id = r\.id_nuestra/.test(sql) && /least\(999, cantidad \+ dup\.cantidad\)/.test(sql) && /update public\.user_wants set card_id = r\.id_nuestra/.test(sql) && /update public\.user_albums/.test(sql) && /update public\.tcg_card_prices set card_id = r\.id_nuestra/.test(sql) && /update public\.tcg_card_history set card_id = r\.id_nuestra/.test(sql))
  check('  …y borra el duplicado al final, solo el de origen tcggo del set 30th', /delete from public\.tcg_cards where id = r\.id_tcggo and market = 'WEST'/.test(sql) && /t\.set_id = '30th' and t\.origen = 'tcggo'/.test(sql))
  check('los $$ van emparejados (la trampa del String.replace de la 640)', (sql.match(/\$\$/g) || []).length % 2 === 0)
  check('y termina con la cuenta de lo que queda', /duplicados_que_quedan/.test(sql))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
