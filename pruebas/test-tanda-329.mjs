// Tanda 329 — lo que solo viene en el set completo.
//
// La consulta de PINGU del 2026-09-22, después de borrar Pocket: **los
// 210 sets con `serie_id` a NULL** y solo 112 con código de TCG Live.
//
// Es la lección de la 322 sin aplicar. `setToRow` corre sobre el
// LISTADO, que es un «SetResume», y allí no viene ni la serie, ni el
// código, ni la fecha. Y eso explica tres cosas de golpe: por qué no
// hay eras en el índice, por qué se colaron catorce sets de Pokémon TCG
// Pocket (el filtro del importador miraba `s.serie?.id`, que nunca
// llega) y por qué el Mew ex de 30th Celebration no encontraba su set.
import { readFileSync } from 'node:fs'
import {
  codigoLiveDeSet,
  leFaltaAlgo,
  loQueFaltaDeUnSet,
  serieDeSet,
} from '/home/user/pingu/netlify/lib/carta-detalle.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = '/home/user/pingu'

const COMPLETO = {
  id: 'sv5', name: 'Twilight Masquerade', releaseDate: '2024-05-24', tcgOnline: 'twm',
  serie: { id: 'sv', name: 'Scarlet & Violet' },
}
// Tal y como está en la base: solo lo que trae el listado.
const EN_LA_BASE = { id: 'sv5', release_date: null, serie_id: null, serie_name: null, tcg_online_code: null }

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Se cura el set ENTERO, no solo la fecha ──')
{
  const cambios = loQueFaltaDeUnSet(EN_LA_BASE, COMPLETO)
  check('la fecha', cambios.release_date === '2024-05-24')
  check('la serie', cambios.serie_id === 'sv', JSON.stringify(cambios))
  check('…con su nombre, que es lo que se lee en el índice', cambios.serie_name === 'Scarlet & Violet')
  check('y el código de TCG Live, normalizado', cambios.tcg_online_code === 'TWM', cambios.tcg_online_code)
  // El código es el que traduce «TWM 43» de una decklist a una carta. Sin
  // él, la carta se busca por nombre y el comprobador de reglamento se
  // queda sin poder juzgarla (tanda 328).
  check('en minúsculas no casaría con una decklist', codigoLiveDeSet({ tcgOnline: 'twm' }) === 'TWM')
  check('y un valor raro no es un código', codigoLiveDeSet({ tcgOnline: 'no-es-un-codigo' }) === null)
  check('ni uno vacío', codigoLiveDeSet({ tcgOnline: '  ' }) === null)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Nunca se pisa lo que ya estaba ──')
{
  // Lo curado es más de fiar que lo que conteste una API comunitaria en
  // un mal día: si esto pisara, una respuesta rara borraría un código
  // bueno y las decklists de ese set dejarían de resolverse.
  const yaCompleto = { id: 'sv5', release_date: '2024-05-24', serie_id: 'sv',
    serie_name: 'Escarlata y Púrpura', tcg_online_code: 'TWM' }
  check('un set completo no genera ni un cambio',
    Object.keys(loQueFaltaDeUnSet(yaCompleto, COMPLETO)).length === 0,
    JSON.stringify(loQueFaltaDeUnSet(yaCompleto, COMPLETO)))
  // Y el caso que de verdad duele: el nombre de la serie ya traducido a
  // mano no lo pisa el inglés de TCGdex.
  check('…ni siquiera si el nuestro está traducido',
    loQueFaltaDeUnSet(yaCompleto, COMPLETO).serie_name === undefined)
  // Lo que la API no manda no puede borrar nada.
  check('si la API no manda nada, no se escribe nada',
    Object.keys(loQueFaltaDeUnSet(EN_LA_BASE, { id: 'sv5' })).length === 0)
  check('y una serie vacía no cuenta como serie',
    serieDeSet({ serie: { id: '  ', name: '' } }).serie_id === null)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Quién entra en la fase de curación ──')
{
  // Si solo entrara lo que no tiene fecha, los 210 sets con fecha y sin
  // serie no entrarían NUNCA y la fase se daría por acabada.
  check('un set al que le falta la serie entra', leFaltaAlgo({ release_date: 'x', tcg_online_code: 'Y' }))
  check('…y uno al que solo le falta el nombre de la serie',
    leFaltaAlgo({ release_date: 'x', serie_id: 'a', tcg_online_code: 'C' }))
  check('uno con serie no entra',
    !leFaltaAlgo({ release_date: 'x', serie_id: 'a', serie_name: 'b', tcg_online_code: 'C' }))

  // ── Y LO QUE NO PUEDE CONTAR COMO INCOMPLETO ──
  //
  // Esto lo escribí al revés en la 329 y costó un día de catálogo
  // parado. Pedía también fecha y código, y ~100 sets NO LOS TIENEN en
  // TCGdex: los anteriores a TCG Online no tienen código y algunas
  // promos no traen fecha. Como la fase de sets era excluyente, esos
  // cien se volvían a pedir cada cinco minutos PARA SIEMPRE y el
  // engorde de cartas, que iba detrás, no arrancó jamás — 3.676 de
  // 21.356 y ninguna en español. Lo encontró la sesión de IBAI.
  //
  // El marcador bueno es la SERIE, que el set completo trae siempre: un
  // set con serie es un set ya visitado. La fecha y el código se curan
  // en esa misma visita SI EXISTEN, y si no existen hoy tampoco van a
  // existir mañana.
  check('un set SIN código ya visitado no vuelve a entrar',
    !leFaltaAlgo({ release_date: 'x', serie_id: 'base', serie_name: 'Base', tcg_online_code: null }),
     'los anteriores a TCG Online no tienen código y volverían a pedirse para siempre')
  check('…ni uno sin fecha',
    !leFaltaAlgo({ release_date: null, serie_id: 'base', serie_name: 'Base', tcg_online_code: 'BS' }),
    'algunas promos no traen fecha')
  check('…ni uno sin ninguna de las dos',
    !leFaltaAlgo({ release_date: null, serie_id: 'base', serie_name: 'Base', tcg_online_code: null }))

  // Y la otra mitad del cerrojo: la fase de sets ya no puede quedarse
  // con la pasada entera. Corre acotada y el engorde corre SIEMPRE con
  // el tiempo que quede.
  const tarea = readFileSync(`${RAIZ}/netlify/functions/cartas-detalle.mjs`, 'utf8')
  check('la fase de sets tiene su propio presupuesto',
    /PRESUPUESTO_SETS_MS/.test(tarea), 'volvería a poder comerse la pasada entera')
  check('…y no corta la pasada: el engorde va después igual',
    !/return Response\.json\(\{ fase: 'sets'/.test(tarea),
    'la fase de sets vuelve a ser excluyente')
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. El importador no vuelve a vaciarlo ──')
{
  // `setToRow` corre sobre el listado. Si escribe la serie desde ahí,
  // pone null en los 210 y BORRA lo que la tarea acaba de curar — y solo
  // se nota al reimportar, que es cuando ya es tarde.
  const fuente = readFileSync(`${RAIZ}/js/tcgdex.js`, 'utf8')
  const fila = fuente.slice(fuente.indexOf('export function setToRow'), fuente.indexOf('export function codigoLiveDeSet'))
  check('la serie NO va en el objeto base', !/serie_id: set\.serie/.test(fila), 'la escribiría a null desde el listado')
  check('…se pone solo si llega de verdad', /if \(set\.serie\?\.id\) fila\.serie_id/.test(fila))
  check('…igual que el código, que ya lo hacía así', /if \(codigo\) fila\.tcg_online_code/.test(fila))

  // Y el filtro de Pocket del importador, que es como entraron los catorce.
  check('fetchSets filtra con esDelTCG, no con la serie',
    /filter\(esDelTCG\)/.test(fuente), 'volvería a filtrar por algo que el listado no trae')
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
