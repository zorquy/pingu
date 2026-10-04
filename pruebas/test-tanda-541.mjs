// Tanda 541 — el filtro de expansiones se quedaba en un idioma, y mis
// sets importados no tenían era.
//
// PINGU: «el filtro de todas las expansiones parece que solo está cogiendo
// [las de un idioma]. Tendría que depender del idioma que escojas:
// inglés y español van a ser lo mismo, pero el japonés no».
//
// Y tenía razón por un sitio que no era el que yo miraba. La consulta SÍ
// filtra por mercado y la caché SÍ se tira al cambiar de catálogo. Lo que
// pasaba es más tonto: **los sets que la 540 trae de Scrydex no llevaban
// `serie_id`**, y tanto el desplegable de eras como el agrupado de la
// estantería miran esa columna. Así que los recién importados no salían en
// el desplegable Y caían todos en un grupo sin nombre.
import { serieDeSuSet, filaDeSetSuyo } from '/home/user/pingu/netlify/functions/scrydex-importar-jp.mjs'
import { eraDeSet } from '/home/user/pingu/js/catalogo-series.js'
import { gruposDeEstanteria } from '/home/user/pingu/js/mi-coleccion/estanteria.js'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Un set importado tiene era ──')
{
  check('de su nombre de serie sale un identificador', serieDeSuSet({ series: 'Mega Evolution' }) === 'mega-evolution', serieDeSuSet({ series: 'Mega Evolution' }))
  check('  …comparable, con símbolos y todo', serieDeSuSet({ series: 'Sword & Shield' }) === 'sword-shield', serieDeSuSet({ series: 'Sword & Shield' }))
  // Tres estados: sin serie no se inventa una.
  check('sin serie, no se inventa', serieDeSuSet({}) === null && serieDeSuSet({ series: '   ' }) === null)
  const f = filaDeSetSuyo({ id: 'm6a_ja', name: 'セ', series: 'Mega Evolution', translation: { en: { name: '30th Celebration' } } })
  check('la fila la lleva', f.serie_id === 'mega-evolution', f.serie_id)
  check('  …y el nombre de la era, para enseñar', f.serie_name_en === 'Mega Evolution', f.serie_name_en)
  // DOS SETS DE LA MISMA SERIE CAEN EN LA MISMA CAJA, que es para lo que
  // existe el identificador.
  const a = filaDeSetSuyo({ id: 'm5_ja', series: 'Mega Evolution' })
  check('dos de la misma serie comparten caja', a.serie_id === f.serie_id, `${a.serie_id} / ${f.serie_id}`)
}

console.log('── 2. Y se agrupa y se rotula en occidental ──')
{
  const sets = [
    { id: 'm6a_ja', name: '30th セレブレーション', name_en: '30th Celebration', serie_id: 'mega-evolution', serie_name: null, serie_name_en: 'Mega Evolution', release_date: '2026-09-16', card_count_total: 176 },
    { id: 'm5_ja', name: 'アビスアイ', name_en: 'Abyss Eye', serie_id: 'mega-evolution', serie_name: null, serie_name_en: 'Mega Evolution', release_date: '2026-07-17', card_count_total: 118 },
  ]
  check('la era se lee en occidental', eraDeSet(sets[0]) === 'Mega Evolution', eraDeSet(sets[0]))
  const grupos = gruposDeEstanteria(sets)
  check('los dos caen en el mismo grupo', grupos.length === 1 && grupos[0].sets.length === 2, JSON.stringify(grupos.map((g) => [g.titulo, g.sets.length])))
  check('  …y el grupo se titula en occidental', grupos[0].titulo === 'Mega Evolution', grupos[0].titulo)
  // Y el desplegable: su rótulo sale de `eraDeSet`, no de `serie_name` —
  // que en un set importado viene VACÍO.
  const mc = readFileSync('/home/user/pingu/js/mi-coleccion.js', 'utf8')
  check('el desplegable rotula con `eraDeSet`', /\[s\.serie_id, eraDeSet\(s\) \|\| s\.serie_id\]/.test(mc))
}

console.log('── 3. La caché de sets es POR MERCADO ──')
{
  // Esto ya estaba bien y conviene que quede fijado: al cambiar de
  // catálogo se tira la lista. Si alguien quita esa línea, el desplegable
  // se queda con los sets del idioma anterior — que es justo lo que PINGU
  // describió.
  const mc = readFileSync('/home/user/pingu/js/mi-coleccion.js', 'utf8')
  check('la consulta filtra por mercado', /\.eq\('market', mercado\)/.test(mc))
  check('y al cambiar de catálogo se tira la lista', /todosLosSets = null/.test(mc))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
